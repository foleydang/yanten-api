const express = require('express');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取购物清单
router.get('/list', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, status, category } = req.query;
  
  if (!familyId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少家庭ID' 
    });
  }
  
  try {
    let sql = `
      SELECT s.*, 
        u1.nickname as added_by_name,
        u2.nickname as done_by_name
      FROM shopping_items s
      LEFT JOIN users u1 ON s.added_by = u1.id
      LEFT JOIN users u2 ON s.done_by = u2.id
      WHERE s.family_id = ?
    `;
    const params = [familyId];
    
    if (status && status !== 'all') {
      sql += ' AND s.status = ?';
      params.push(status);
    }
    
    if (category && category !== 'all') {
      sql += ' AND s.category = ?';
      params.push(category);
    }
    
    sql += ' ORDER BY s.priority DESC, s.created_at DESC';
    
    const items = db.prepare(sql).all(...params);
    
    // 按状态分组
    const pending = items.filter(item => item.status === 'pending');
    const done = items.filter(item => item.status === 'done');
    
    res.json({
      success: true,
      data: {
        all: items,
        pending,
        done,
        stats: {
          total: items.length,
          pending: pending.length,
          done: done.length
        }
      }
    });
  } catch (error) {
    console.error('获取购物清单失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 添加购物项
router.post('/add', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, title, category, quantity, unit, priority } = req.body;
  
  if (!familyId || !title) {
    return res.status(400).json({ 
      success: false, 
      message: '请填写完整信息' 
    });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO shopping_items (family_id, title, category, quantity, unit, priority, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      familyId, 
      title.trim(), 
      category || '其他',
      quantity || 1,
      unit || '个',
      priority || 0,
      req.userId
    );
    
    const item = db.prepare(`
      SELECT s.*, u.nickname as added_by_name
      FROM shopping_items s
      LEFT JOIN users u ON s.added_by = u.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);
    
    res.json({
      success: true,
      data: item,
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加购物项失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '添加失败' 
    });
  }
});

// 更新购物项
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, category, quantity, unit, priority } = req.body;
  
  try {
    db.prepare(`
      UPDATE shopping_items 
      SET title = ?, category = ?, quantity = ?, unit = ?, priority = ?
      WHERE id = ?
    `).run(
      title?.trim(),
      category || '其他',
      quantity || 1,
      unit || '个',
      priority || 0,
      id
    );
    
    const item = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id);
    
    res.json({
      success: true,
      data: item,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新购物项失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新失败' 
    });
  }
});

// 标记完成/取消完成
router.put('/:id/toggle', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  try {
    const item = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id);
    
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: '项目不存在' 
      });
    }
    
    if (item.status === 'pending') {
      db.prepare(`
        UPDATE shopping_items 
        SET status = 'done', done_by = ?, done_at = datetime('now')
        WHERE id = ?
      `).run(req.userId, id);
    } else {
      db.prepare(`
        UPDATE shopping_items 
        SET status = 'pending', done_by = NULL, done_at = NULL
        WHERE id = ?
      `).run(id);
    }
    
    const updated = db.prepare(`
      SELECT s.*, u.nickname as done_by_name
      FROM shopping_items s
      LEFT JOIN users u ON s.done_by = u.id
      WHERE s.id = ?
    `).get(id);
    
    res.json({
      success: true,
      data: updated,
      message: item.status === 'pending' ? '已标记完成' : '已取消完成'
    });
  } catch (error) {
    console.error('操作失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '操作失败' 
    });
  }
});

// 删除购物项
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  try {
    db.prepare('DELETE FROM shopping_items WHERE id = ?').run(id);
    
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

// 清空已完成的项
router.delete('/clear-done/:familyId', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.params;
  
  try {
    db.prepare('DELETE FROM shopping_items WHERE family_id = ? AND status = ?').run(familyId, 'done');
    
    res.json({
      success: true,
      message: '已清空完成项'
    });
  } catch (error) {
    console.error('清空失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '操作失败' 
    });
  }
});

// 获取分类列表
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'food', name: '🥬 食品', icon: '🥬' },
      { id: 'daily', name: '🧴 日用品', icon: '🧴' },
      { id: 'electronics', name: '📱 电器', icon: '📱' },
      { id: 'clothing', name: '👕 服饰', icon: '👕' },
      { id: 'medicine', name: '💊 医药', icon: '💊' },
      { id: 'other', name: '📦 其他', icon: '📦' }
    ]
  });
});

// 获取我的购物记录
router.get('/my-records', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.query;
  
  if (!familyId) {
    return res.json({ success: true, data: [] });
  }
  
  try {
    const items = db.prepare(`
      SELECT * FROM shopping_items 
      WHERE family_id = ? AND added_by = ?
      ORDER BY created_at DESC
    `).all(familyId, req.userId);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('获取我的购物记录失败:', error);
    res.json({ success: true, data: [] });
  }
});

module.exports = router;