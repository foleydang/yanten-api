const express = require('express');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取待办列表
router.get('/list', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, status, assignee } = req.query;
  
  if (!familyId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少家庭ID' 
    });
  }
  
  try {
    let sql = `
      SELECT t.*, 
        u1.nickname as added_by_name,
        u2.nickname as assignee_name
      FROM todos t
      LEFT JOIN users u1 ON t.added_by = u1.id
      LEFT JOIN users u2 ON t.assignee_id = u2.id
      WHERE t.family_id = ?
    `;
    const params = [familyId];
    
    if (status && status !== 'all') {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    
    if (assignee) {
      sql += ' AND t.assignee_id = ?';
      params.push(assignee);
    }
    
    sql += ' ORDER BY t.due_date ASC, t.created_at DESC';
    
    const items = db.prepare(sql).all(...params);
    
    // 按状态分组
    const pending = items.filter(item => item.status === 'pending');
    const doing = items.filter(item => item.status === 'doing');
    const done = items.filter(item => item.status === 'done');
    
    res.json({
      success: true,
      data: {
        all: items,
        pending,
        doing,
        done,
        stats: {
          total: items.length,
          pending: pending.length,
          doing: doing.length,
          done: done.length
        }
      }
    });
  } catch (error) {
    console.error('获取待办列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 添加待办
router.post('/add', authMiddleware, (req, res) => {
  const db = getDb();
  // 兼容两种字段名
  const { familyId, title, description, dueDate, assigneeId, assignee, priority } = req.body;
  const assigneeValue = assigneeId || assignee;
  
  if (!familyId || !title) {
    return res.status(400).json({ 
      success: false, 
      message: '请填写完整信息' 
    });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO todos (family_id, title, description, due_date, assignee_id, priority, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      familyId, 
      title.trim(), 
      description || '',
      dueDate || null,
      assigneeValue || null,
      priority || 0,
      req.userId
    );
    
    const item = db.prepare(`
      SELECT t.*, 
        u1.nickname as added_by_name,
        u2.nickname as assignee_name
      FROM todos t
      LEFT JOIN users u1 ON t.added_by = u1.id
      LEFT JOIN users u2 ON t.assignee_id = u2.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    
    res.json({
      success: true,
      data: item,
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加待办失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '添加失败' 
    });
  }
});

// 更新待办状态
router.put('/:id/status', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['pending', 'doing', 'done', 'cancelled'].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的状态' 
    });
  }
  
  try {
    const doneAt = status === 'done' ? "datetime('now')" : null;
    
    if (status === 'done') {
      db.prepare(`
        UPDATE todos SET status = ?, done_at = datetime('now') WHERE id = ?
      `).run(status, id);
    } else {
      db.prepare(`
        UPDATE todos SET status = ?, done_at = NULL WHERE id = ?
      `).run(status, id);
    }
    
    const item = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    
    res.json({
      success: true,
      data: item,
      message: '状态更新成功'
    });
  } catch (error) {
    console.error('更新状态失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新失败' 
    });
  }
});

// 更新待办
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  // 兼容两种字段名
  const { title, description, dueDate, assigneeId, assignee, priority } = req.body;
  const assigneeValue = assigneeId || assignee;
  
  try {
    db.prepare(`
      UPDATE todos 
      SET title = ?, description = ?, due_date = ?, assignee_id = ?, priority = ?
      WHERE id = ?
    `).run(
      title?.trim(),
      description || '',
      dueDate || null,
      assigneeValue || null,
      priority || 0,
      id
    );
    
    const item = db.prepare(`
      SELECT t.*, 
        u1.nickname as added_by_name,
        u2.nickname as assignee_name
      FROM todos t
      LEFT JOIN users u1 ON t.added_by = u1.id
      LEFT JOIN users u2 ON t.assignee_id = u2.id
      WHERE t.id = ?
    `).get(id);
    
    res.json({
      success: true,
      data: item,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新待办失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新失败' 
    });
  }
});

// 删除待办
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  try {
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '已删除'
    });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除失败' 
    });
  }
});

// 清空已完成待办
router.delete('/clear-done/:familyId', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.params;
  
  try {
    db.prepare('DELETE FROM todos WHERE family_id = ? AND status = ?').run(familyId, 'done');
    
    res.json({
      success: true,
      message: '已清空'
    });
  } catch (error) {
    console.error('清空失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '清空失败' 
    });
  }
});

// 获取我的待办记录
router.get('/my-records', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.query;
  
  if (!familyId) {
    return res.json({ success: true, data: [] });
  }
  
  try {
    const items = db.prepare(`
      SELECT t.*, u.nickname as assignee_name
      FROM todos t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.family_id = ? AND t.added_by = ?
      ORDER BY t.created_at DESC
    `).all(familyId, req.userId);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('获取我的待办记录失败:', error);
    res.json({ success: true, data: [] });
  }
});

module.exports = router;