/**
 * 全局搜索 API
 * 跨模块搜索：日程、待办、购物、记账
 */
const express = require('express');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const { familyId, q, limit } = req.query;
  if (!familyId || !q || q.trim().length === 0) {
    return res.json({ success: true, data: { schedules: [], todos: [], shopping: [], accounts: [] } });
  }

  const keyword = `%${q.trim()}%`;
  const l = parseInt(limit) || 10;

  try {
    const db = getDb();

    const schedules = db.prepare(`
      SELECT s.id, s.title, s.description, s.schedule_date, s.schedule_time, s.type,
             u.nickname as created_by_name
      FROM schedules s LEFT JOIN users u ON s.created_by = u.id
      WHERE s.family_id = ? AND (s.title LIKE ? OR s.description LIKE ?)
      ORDER BY s.schedule_date DESC LIMIT ?
    `).all(familyId, keyword, keyword, l);

    const todos = db.prepare(`
      SELECT t.id, t.title, t.description, t.due_date, t.status, t.priority,
             u1.nickname as added_by_name, u2.nickname as assignee_name
      FROM todos t
      LEFT JOIN users u1 ON t.added_by = u1.id
      LEFT JOIN users u2 ON t.assignee_id = u2.id
      WHERE t.family_id = ? AND (t.title LIKE ? OR t.description LIKE ?)
      ORDER BY t.id DESC LIMIT ?
    `).all(familyId, keyword, keyword, l);

    const shopping = db.prepare(`
      SELECT s.id, s.title, s.category, s.status, s.quantity, s.unit,
             u.nickname as added_by_name
      FROM shopping_items s LEFT JOIN users u ON s.added_by = u.id
      WHERE s.family_id = ? AND (s.title LIKE ? OR s.category LIKE ?)
      ORDER BY s.id DESC LIMIT ?
    `).all(familyId, keyword, keyword, l);

    const accounts = db.prepare(`
      SELECT a.id, a.title, a.category, a.amount, a.type, a.record_date,
             u.nickname as payer_name
      FROM accounts a LEFT JOIN users u ON a.payer_id = u.id
      WHERE a.family_id = ? AND (a.title LIKE ? OR a.description LIKE ? OR a.category LIKE ?)
      ORDER BY a.record_date DESC LIMIT ?
    `).all(familyId, keyword, keyword, keyword, l);

    res.json({ success: true, data: { schedules, todos, shopping, accounts } });
  } catch (e) {
    console.error('搜索失败:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;