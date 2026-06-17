/**
 * 心愿墙路由 - 添加/删除/标记实现/分类查询
 */
const express = require('express');
const { getDb } = require('../utils/database');
const { authMiddleware, familyMemberMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取心愿列表
router.get('/list', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, status } = req.query;
  
  if (!familyId) {
    return res.status(400).json({ success: false, message: '缺少家庭ID' });
  }
  
  try {
    let sql = `
      SELECT w.*, u.nickname as created_by_name
      FROM wishes w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.family_id = ?
    `;
    const params = [familyId];
    
    if (status && status !== 'all') {
      sql += ' AND w.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY w.priority DESC, w.created_at DESC';
    
    const items = db.prepare(sql).all(...params);
    
    const pending = items.filter(item => item.status === 'pending');
    const fulfilled = items.filter(item => item.status === 'fulfilled');
    
    res.json({
      success: true,
      data: {
        all: items,
        pending,
        fulfilled,
        stats: {
          total: items.length,
          pending: pending.length,
          fulfilled: fulfilled.length
        }
      }
    });
  } catch (error) {
    console.error('获取心愿列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 添加心愿
router.post('/add', authMiddleware, familyMemberMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, title, description, category, priority } = req.body;
  
  if (!familyId || !title) {
    return res.status(400).json({ success: false, message: '请填写心愿内容' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO wishes (family_id, user_id, title, description, category, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).run(familyId, req.userId, title.trim(), description || '', category || 'other', priority || 0);
    
    const item = db.prepare(`
      SELECT w.*, u.nickname as created_by_name
      FROM wishes w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.id = ?
    `).get(result.lastInsertRowid);
    
    res.json({ success: true, data: item, message: '心愿已发布' });
  } catch (error) {
    console.error('添加心愿失败:', error);
    res.status(500).json({ success: false, message: '添加失败' });
  }
});

// 更新心愿
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, description, category, priority } = req.body;
  
  const wish = db.prepare('SELECT family_id FROM wishes WHERE id = ?').get(id);
  if (!wish) return res.status(404).json({ success: false, message: '心愿不存在' });
  const member = db.prepare('SELECT id FROM family_members WHERE family_id = ? AND user_id = ?').get(wish.family_id, req.userId);
  if (!member) return res.status(403).json({ success: false, message: '无权操作' });
  
  try {
    db.prepare('UPDATE wishes SET title = ?, description = ?, category = ?, priority = ? WHERE id = ?')
      .run(title?.trim(), description || '', category || 'other', priority || 0, id);
    
    const item = db.prepare(`
      SELECT w.*, u.nickname as created_by_name
      FROM wishes w LEFT JOIN users u ON w.user_id = u.id WHERE w.id = ?
    `).get(id);
    
    res.json({ success: true, data: item, message: '已更新' });
  } catch (error) {
    console.error('更新心愿失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 标记心愿实现
router.put('/:id/fulfill', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  const wish = db.prepare('SELECT * FROM wishes WHERE id = ?').get(id);
  if (!wish) return res.status(404).json({ success: false, message: '心愿不存在' });
  const member = db.prepare('SELECT id FROM family_members WHERE family_id = ? AND user_id = ?').get(wish.family_id, req.userId);
  if (!member) return res.status(403).json({ success: false, message: '无权操作' });
  
  try {
    const newStatus = wish.status === 'fulfilled' ? 'pending' : 'fulfilled';
    const fulfilledAt = newStatus === 'fulfilled' ? "datetime('now')" : 'NULL';
    const fulfilledBy = newStatus === 'fulfilled' ? req.userId : 'NULL';
    
    db.prepare(`UPDATE wishes SET status = ?, fulfilled_at = ${fulfilledAt}, fulfilled_by = ${fulfilledBy} WHERE id = ?`)
      .run(newStatus, id);
    
    res.json({ success: true, message: newStatus === 'fulfilled' ? '心愿已实现！🎉' : '已取消实现' });
  } catch (error) {
    console.error('操作失败:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 删除心愿
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  const wish = db.prepare('SELECT family_id FROM wishes WHERE id = ?').get(id);
  if (!wish) return res.status(404).json({ success: false, message: '心愿不存在' });
  const member = db.prepare('SELECT id FROM family_members WHERE family_id = ? AND user_id = ?').get(wish.family_id, req.userId);
  if (!member) return res.status(403).json({ success: false, message: '无权操作' });
  
  try {
    db.prepare('DELETE FROM wishes WHERE id = ?').run(id);
    res.json({ success: true, message: '已删除' });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 清空已实现心愿
router.delete('/clear-fulfilled/:familyId', authMiddleware, familyMemberMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.params;
  
  try {
    db.prepare('DELETE FROM wishes WHERE family_id = ? AND status = ?').run(familyId, 'fulfilled');
    res.json({ success: true, message: '已清空' });
  } catch (error) {
    console.error('清空失败:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 心愿分类
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'travel', name: '🌍 旅行', icon: '🌍' },
      { id: 'gift', name: '🎁 礼物', icon: '🎁' },
      { id: 'experience', name: '✨ 体验', icon: '✨' },
      { id: 'purchase', name: '🛍️ 想买', icon: '🛍️' },
      { id: 'skill', name: '📚 学习', icon: '📚' },
      { id: 'other', name: '💭 其他', icon: '💭' }
    ]
  });
});

module.exports = router;
