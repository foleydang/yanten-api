/**
 * 消息通知 API
 * 列表、已读/全部已读、未读数
 */
const express = require('express');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 通知内容模板
const TEMPLATES = {
  schedule_remind: (title, date) => ({ title: '📅 日程提醒', content: `「${title}」将于${date}举行，别忘了哦` }),
  todo_assign: (title, assigner) => ({ title: '✅ 待办指派', content: `${assigner}给你指派了待办「${title}」` }),
  shopping_added: (title, adder) => ({ title: '🛒 购物新增', content: `${adder}添加了「${title}」到购物清单` }),
  wish_fulfilled: (title) => ({ title: '🌟 心愿达成', content: `心愿「${title}」已标记为实现了！` }),
  family_join: (name) => ({ title: '👋 新成员加入', content: `${name}加入了你的家庭` }),
};

// 获取通知列表
router.get('/list', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.query;
  if (!familyId) return res.status(400).json({ success: false, message: '缺少家庭ID' });
  
  try {
    const items = db.prepare(`
      SELECT * FROM notifications WHERE family_id = ? AND user_id = ?
      ORDER BY created_at DESC LIMIT 100
    `).all(familyId, req.userId);
    const unread = items.filter(i => !i.is_read).length;
    res.json({ success: true, data: { items, unread } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 标记已读
router.put('/read/:id', authMiddleware, (req, res) => {
  try {
    getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 全部已读
router.put('/read-all', authMiddleware, (req, res) => {
  const { familyId } = req.body;
  try {
    getDb().prepare('UPDATE notifications SET is_read = 1 WHERE family_id = ? AND user_id = ?').run(familyId, req.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 未读数
router.get('/unread', authMiddleware, (req, res) => {
  const { familyId } = req.query;
  if (!familyId) return res.json({ success: true, data: 0 });
  try {
    const r = getDb().prepare('SELECT COUNT(*) as count FROM notifications WHERE family_id = ? AND user_id = ? AND is_read = 0').get(familyId, req.userId);
    res.json({ success: true, data: r?.count || 0 });
  } catch (e) {
    res.json({ success: true, data: 0 });
  }
});

// 创建通知（内部调用）
router.post('/create', authMiddleware, (req, res) => {
  const { familyId, userId, type, relatedId, customTitle, customContent } = req.body;
  if (!familyId || !type) return res.status(400).json({ success: false, message: '参数不足' });
  
  const tpl = TEMPLATES[type];
  const title = customTitle || tpl?.title || type;
  const content = customContent || tpl?.content || '';
  
  try {
    // 如果指定了userId，发给那个人；否则发给自己
    const targetId = userId || req.userId;
    getDb().prepare(
      'INSERT INTO notifications (family_id, user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(familyId, targetId, type, title, content, relatedId || null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;