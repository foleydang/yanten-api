const express = require('express');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 提交反馈
router.post('/', authMiddleware, (req, res) => {
  const db = getDb();
  const { type, content, contact, images } = req.body;
  
  if (!content || content.trim() === '') {
    return res.status(400).json({
      success: false,
      message: '请填写反馈内容'
    });
  }
  
  const result = db.prepare(
    'INSERT INTO feedback (user_id, type, content, contact, images) VALUES (?, ?, ?, ?, ?)'
  ).run(
    req.userId,
    type || 'bug',
    content.trim(),
    contact || '',
    images ? JSON.stringify(images) : null
  );
  
  res.json({
    success: true,
    message: '感谢您的反馈！我们会尽快处理',
    data: { id: result.lastInsertRowid }
  });
});

// 获取我的反馈列表
router.get('/my', authMiddleware, (req, res) => {
  const db = getDb();
  const { page = 1, pageSize = 20 } = req.query;
  const offset = (page - 1) * pageSize;
  
  const list = db.prepare(`
    SELECT id, type, content, status, reply, created_at
    FROM feedback
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.userId, parseInt(pageSize), offset);
  
  const total = db.prepare(
    'SELECT COUNT(*) as count FROM feedback WHERE user_id = ?'
  ).get(req.userId)?.count || 0;
  
  res.json({
    success: true,
    data: {
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  });
});

// 获取反馈详情
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  
  const feedback = db.prepare(`
    SELECT id, type, content, contact, images, status, reply, created_at
    FROM feedback
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.userId);
  
  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: '反馈不存在'
    });
  }
  
  // 解析图片
  if (feedback.images) {
    try {
      feedback.images = JSON.parse(feedback.images);
    } catch (e) {
      feedback.images = [];
    }
  }
  
  res.json({
    success: true,
    data: feedback
  });
});

module.exports = router;
