/**
 * 家庭记账 API
 * 收入/支出记录、月度统计、分类汇总
 */
const express = require('express');
const { getDb } = require('../utils/database');
const { authMiddleware, familyMemberMiddleware } = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = ['餐饮', '交通', '购物', '医疗', '教育', '娱乐', '住房', '人情', '其他'];

// 获取记账列表
router.get('/list', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, type, category, startDate, endDate, payerId, page, limit } = req.query;
  
  if (!familyId) return res.status(400).json({ success: false, message: '缺少家庭ID' });
  
  try {
    let sql = `
      SELECT a.*, u.nickname as payer_name, u.avatar_index as payer_avatar
      FROM accounts a
      LEFT JOIN users u ON a.payer_id = u.id
      WHERE a.family_id = ?
    `;
    const params = [familyId];

    if (type) { sql += ' AND a.type = ?'; params.push(type); }
    if (category) { sql += ' AND a.category = ?'; params.push(category); }
    if (startDate) { sql += ' AND a.record_date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND a.record_date <= ?'; params.push(endDate); }
    if (payerId) { sql += ' AND a.payer_id = ?'; params.push(payerId); }

    sql += ' ORDER BY a.record_date DESC, a.id DESC';
    
    const p = parseInt(page) || 1;
    const l = parseInt(limit) || 50;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(l, (p - 1) * l);

    const items = db.prepare(sql).all(...params);
    
    // 按日期分组
    const grouped = {};
    items.forEach(item => {
      const date = item.record_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });

    res.json({ success: true, data: { grouped, items, categories: CATEGORIES } });
  } catch (e) {
    console.error('获取记账列表失败:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// 添加记账
router.post('/add', authMiddleware, familyMemberMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, type, amount, category, title, description, recordDate } = req.body;
  
  if (!familyId || !amount || !title || !recordDate) {
    return res.status(400).json({ success: false, message: '请填写完整信息（金额、标题、日期必填）' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO accounts (family_id, type, amount, category, title, description, payer_id, record_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      familyId, type || 'expense', parseFloat(amount),
      category || '其他', title.trim(), description || '',
      req.userId, recordDate
    );
    
    const item = db.prepare(`
      SELECT a.*, u.nickname as payer_name FROM accounts a
      LEFT JOIN users u ON a.payer_id = u.id WHERE a.id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, data: item, message: '记账成功' });
  } catch (e) {
    console.error('添加记账失败:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// 更新记账
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { type, amount, category, title, description, recordDate } = req.body;
  
  const item = db.prepare('SELECT family_id FROM accounts WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ success: false, message: '记录不存在' });
  
  const member = db.prepare('SELECT id FROM family_members WHERE family_id = ? AND user_id = ?').get(item.family_id, req.userId);
  if (!member) return res.status(403).json({ success: false, message: '无权操作' });
  
  try {
    db.prepare(`
      UPDATE accounts SET type = ?, amount = ?, category = ?, title = ?, description = ?, record_date = ?
      WHERE id = ?
    `).run(
      type || 'expense', parseFloat(amount), category || '其他',
      title?.trim(), description || '', recordDate, id
    );
    res.json({ success: true, message: '更新成功' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 删除记账
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  const item = db.prepare('SELECT family_id FROM accounts WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ success: false, message: '记录不存在' });
  
  const member = db.prepare('SELECT id FROM family_members WHERE family_id = ? AND user_id = ?').get(item.family_id, req.userId);
  if (!member) return res.status(403).json({ success: false, message: '无权操作' });
  
  try {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    res.json({ success: true, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 月度统计
router.get('/stats', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, year, month } = req.query;
  
  if (!familyId || !year || !month) {
    return res.status(400).json({ success: false, message: '缺少参数' });
  }
  
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  try {
    // 总额
    const totals = db.prepare(`
      SELECT type, SUM(amount) as total FROM accounts
      WHERE family_id = ? AND record_date >= ? AND record_date <= ?
      GROUP BY type
    `).all(familyId, startDate, endDate);
    
    // 分类统计
    const byCategory = db.prepare(`
      SELECT category, type, SUM(amount) as total, COUNT(*) as count
      FROM accounts WHERE family_id = ? AND record_date >= ? AND record_date <= ?
      GROUP BY category, type ORDER BY total DESC
    `).all(familyId, startDate, endDate);
    
    // 成员统计
    const byMember = db.prepare(`
      SELECT a.payer_id, u.nickname as payer_name, a.type, SUM(a.amount) as total, COUNT(*) as count
      FROM accounts a LEFT JOIN users u ON a.payer_id = u.id
      WHERE a.family_id = ? AND a.record_date >= ? AND a.record_date <= ?
      GROUP BY a.payer_id, a.type ORDER BY total DESC
    `).all(familyId, startDate, endDate);
    
    const expenseTotal = totals.find(t => t.type === 'expense')?.total || 0;
    const incomeTotal = totals.find(t => t.type === 'income')?.total || 0;

    res.json({
      success: true,
      data: { expenseTotal, incomeTotal, byCategory, byMember, startDate, endDate }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 获取分类列表
router.get('/categories', (req, res) => {
  res.json({ success: true, data: CATEGORIES });
});

module.exports = router;