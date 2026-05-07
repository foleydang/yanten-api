const express = require('express');
const { getDb, generateInviteCode } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 创建家庭
router.post('/create', authMiddleware, (req, res) => {
  const db = getDb();
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ 
      success: false, 
      message: '请输入家庭名称' 
    });
  }
  
  try {
    const inviteCode = generateInviteCode();
    
    // 创建家庭
    db.prepare('INSERT INTO families (name, invite_code, created_by) VALUES (?, ?, ?)').run(name, inviteCode, req.userId);
    
    // 获取最后插入的家庭
    const families = db.prepare('SELECT * FROM families ORDER BY id DESC LIMIT 1').all();
    const family = families[0];
    
    if (!family) {
      return res.status(500).json({ success: false, message: '创建失败' });
    }
    
    // 将创建者加入家庭
    db.prepare('INSERT INTO family_members (family_id, user_id, nickname) VALUES (?, ?, ?)').run(family.id, req.userId, '创建者');
    
    // 更新用户角色
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', req.userId);
    
    res.json({
      success: true,
      data: {
        ...family,
        inviteCode: inviteCode
      },
      message: '家庭创建成功'
    });
  } catch (error) {
    console.error('创建家庭失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建失败，请重试' 
    });
  }
});

// 加入家庭
router.post('/join', authMiddleware, (req, res) => {
  const db = getDb();
  const { inviteCode, nickname } = req.body;
  
  if (!inviteCode) {
    return res.status(400).json({ 
      success: false, 
      message: '请输入邀请码' 
    });
  }
  
  try {
    // 查找家庭
    const family = db.prepare('SELECT * FROM families WHERE invite_code = ?').get(inviteCode.toUpperCase());
    
    if (!family) {
      return res.status(404).json({ 
        success: false, 
        message: '邀请码无效' 
      });
    }
    
    // 检查是否已是成员
    const existing = db.prepare(
      'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?'
    ).get(family.id, req.userId);
    
    if (existing) {
      return res.json({
        success: true,
        data: family,
        message: '你已是家庭成员'
      });
    }
    
    // 加入家庭
    db.prepare(
      'INSERT INTO family_members (family_id, user_id, nickname) VALUES (?, ?, ?)'
    ).run(family.id, req.userId, nickname || '新成员');
    
    res.json({
      success: true,
      data: family,
      message: `成功加入「${family.name}」`
    });
  } catch (error) {
    console.error('加入家庭失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '加入失败，请重试' 
    });
  }
});

// 获取家庭信息
router.get('/:familyId', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.params;
  
  try {
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    
    if (!family) {
      return res.status(404).json({ 
        success: false, 
        message: '家庭不存在' 
      });
    }
    
    // 获取成员列表
    const members = db.prepare(`
      SELECT u.id, u.nickname, u.avatar, fm.nickname as member_nickname
      FROM family_members fm
      JOIN users u ON fm.user_id = u.id
      WHERE fm.family_id = ?
      ORDER BY fm.joined_at
    `).all(familyId);
    
    res.json({
      success: true,
      data: {
        ...family,
        members
      }
    });
  } catch (error) {
    console.error('获取家庭信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 获取我的家庭列表
router.get('/my/list', authMiddleware, (req, res) => {
  const db = getDb();
  
  try {
    const families = db.prepare(`
      SELECT f.*, fm.nickname as my_nickname,
        (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as member_count
      FROM families f
      JOIN family_members fm ON f.id = fm.family_id
      WHERE fm.user_id = ?
      ORDER BY f.created_at DESC
    `).all(req.userId);
    
    res.json({
      success: true,
      data: families
    });
  } catch (error) {
    console.error('获取家庭列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 获取邀请码
router.get('/:familyId/invite', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.params;
  
  try {
    const family = db.prepare('SELECT id, name, invite_code FROM families WHERE id = ?').get(familyId);
    
    if (!family) {
      return res.status(404).json({ 
        success: false, 
        message: '家庭不存在' 
      });
    }
    
    res.json({
      success: true,
      data: family
    });
  } catch (error) {
    console.error('获取邀请码失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 更新家庭成员昵称
router.put('/:familyId/nickname', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.params;
  const { nickname } = req.body;
  
  try {
    db.prepare(
      'UPDATE family_members SET nickname = ? WHERE family_id = ? AND user_id = ?'
    ).run(nickname, familyId, req.userId);
    
    res.json({
      success: true,
      message: '昵称更新成功'
    });
  } catch (error) {
    console.error('更新昵称失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新失败' 
    });
  }
});

// 生成新邀请码
router.post('/:familyId/invite-code', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.params;
  
  try {
    const newCode = generateInviteCode();
    db.prepare('UPDATE families SET invite_code = ? WHERE id = ?').run(newCode, familyId);
    
    res.json({
      success: true,
      data: { code: newCode },
      message: '邀请码已更新'
    });
  } catch (error) {
    console.error('生成邀请码失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '生成失败' 
    });
  }
});

// 移除成员
router.delete('/:familyId/member/:memberId', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, memberId } = req.params;
  
  try {
    // 检查是否是家庭创建者
    const family = db.prepare('SELECT created_by FROM families WHERE id = ?').get(familyId);
    
    if (family?.created_by !== req.userId) {
      return res.status(403).json({ 
        success: false, 
        message: '只有创建者可以移除成员' 
      });
    }
    
    if (memberId == req.userId) {
      return res.status(400).json({ 
        success: false, 
        message: '不能移除自己' 
      });
    }
    
    db.prepare(
      'DELETE FROM family_members WHERE family_id = ? AND user_id = ?'
    ).run(familyId, memberId);
    
    res.json({
      success: true,
      message: '已移除成员'
    });
  } catch (error) {
    console.error('移除成员失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '移除失败' 
    });
  }
});

// 设置成员角色
router.put('/:familyId/member/:memberId/role', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, memberId } = req.params;
  const { role } = req.body;
  
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的角色' 
    });
  }
  
  try {
    // 检查是否是家庭创建者
    const family = db.prepare('SELECT created_by FROM families WHERE id = ?').get(familyId);
    
    if (family?.created_by !== req.userId) {
      return res.status(403).json({ 
        success: false, 
        message: '只有创建者可以设置管理员' 
      });
    }
    
    db.prepare(
      'UPDATE family_members SET role = ? WHERE family_id = ? AND user_id = ?'
    ).run(role, familyId, memberId);
    
    res.json({
      success: true,
      message: '角色已更新'
    });
  } catch (error) {
    console.error('设置角色失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '操作失败' 
    });
  }
});

// 退出家庭（改为 POST）
router.post('/:familyId/leave', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.params;
  
  try {
    db.prepare(
      'DELETE FROM family_members WHERE family_id = ? AND user_id = ?'
    ).run(familyId, req.userId);
    
    res.json({
      success: true,
      message: '已退出家庭'
    });
  } catch (error) {
    console.error('退出家庭失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '操作失败' 
    });
  }
});

module.exports = router;