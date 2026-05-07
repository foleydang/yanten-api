const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../../config/default');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 微信登录
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少登录凭证' 
      });
    }
    
    // 调用微信接口获取 openid
    const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: config.wechat.appId,
        secret: config.wechat.appSecret,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });
    
    const { openid, session_key, errcode, errmsg } = wxRes.data;
    
    if (errcode) {
      console.error('微信登录失败:', errmsg);
      // 开发模式：使用模拟 openid
      const mockOpenid = 'dev_' + Date.now();
      return handleLogin(mockOpenid, res);
    }
    
    return handleLogin(openid, res);
  } catch (error) {
    console.error('登录错误:', error);
    // 开发模式：允许测试登录
    const mockOpenid = 'dev_' + req.body.testUserId || Date.now();
    return handleLogin(mockOpenid, res);
  }
});

// 处理登录逻辑
async function handleLogin(openid, res) {
  const db = getDb();
  
  // 查找或创建用户
  let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
  
  if (!user) {
    db.prepare(
      'INSERT INTO users (openid, nickname, avatar) VALUES (?, ?, ?)'
    ).run(openid, '新成员', '');
    
    // 重新查询
    user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
  }
  
  if (!user) {
    return res.status(500).json({ success: false, message: '创建用户失败' });
  }
  
  // 生成 token
  const token = jwt.sign(
    { userId: user.id, openid: user.openid },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  
  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role
      }
    },
    message: '登录成功'
  });
}

// 更新用户信息
router.put('/profile', authMiddleware, (req, res) => {
  const db = getDb();
  const { nickname, avatar } = req.body;
  
  db.prepare(
    'UPDATE users SET nickname = ?, avatar = ? WHERE id = ?'
  ).run(nickname || '新成员', avatar || '', req.userId);
  
  const user = db.prepare('SELECT id, nickname, avatar, role FROM users WHERE id = ?').get(req.userId);
  
  res.json({
    success: true,
    data: user,
    message: '更新成功'
  });
});

// 获取当前用户信息
router.get('/user', authMiddleware, (req, res) => {
  const db = getDb();
  
  const user = db.prepare('SELECT id, nickname, avatar, role FROM users WHERE id = ?').get(req.userId);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: '用户不存在' 
    });
  }
  
  // 获取用户的家庭信息
  const families = db.prepare(`
    SELECT f.id, f.name, f.invite_code, fm.nickname as member_nickname,
           (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as member_count
    FROM families f
    JOIN family_members fm ON f.id = fm.family_id
    WHERE fm.user_id = ?
  `).all(req.userId);
  
  res.json({
    success: true,
    data: {
      ...user,
      name: user.nickname,
      families,
      familyInfo: families[0] || null
    }
  });
});

// 获取用户统计数据
router.get('/stats', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.query;
  
  if (!familyId) {
    return res.json({
      success: true,
      data: {
        shoppingCount: 0,
        todoCount: 0,
        scheduleCount: 0
      }
    });
  }
  
  try {
    // 获取购物记录数
    const shoppingCount = db.prepare(
      'SELECT COUNT(*) as count FROM shopping_items WHERE family_id = ? AND added_by = ?'
    ).get(familyId, req.userId)?.count || 0;
    
    // 获取待办记录数
    const todoCount = db.prepare(
      'SELECT COUNT(*) as count FROM todos WHERE family_id = ? AND added_by = ?'
    ).get(familyId, req.userId)?.count || 0;
    
    // 获取日程记录数
    const scheduleCount = db.prepare(
      'SELECT COUNT(*) as count FROM schedules WHERE family_id = ? AND created_by = ?'
    ).get(familyId, req.userId)?.count || 0;
    
    res.json({
      success: true,
      data: {
        shoppingCount,
        todoCount,
        scheduleCount
      }
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 测试登录（开发环境）
router.post('/dev-login', (req, res) => {
  const { userId } = req.body;
  const mockOpenid = 'dev_' + (userId || Date.now());
  return handleLogin(mockOpenid, res);
});

module.exports = router;