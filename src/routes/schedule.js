const express = require('express');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取日程列表
router.get('/list', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, startDate, endDate } = req.query;
  
  if (!familyId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少家庭ID' 
    });
  }
  
  try {
    let sql = `
      SELECT s.*, u.nickname as created_by_name
      FROM schedules s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.family_id = ?
    `;
    const params = [familyId];
    
    if (startDate) {
      sql += ' AND s.schedule_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      sql += ' AND s.schedule_date <= ?';
      params.push(endDate);
    }
    
    sql += ' ORDER BY s.schedule_date ASC, s.schedule_time ASC';
    
    const items = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('获取日程列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 获取某月日程
router.get('/month/:year/:month', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.query;
  const { year, month } = req.params;
  
  if (!familyId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少家庭ID' 
    });
  }
  
  try {
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    const items = db.prepare(`
      SELECT s.*, u.nickname as created_by_name
      FROM schedules s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.family_id = ? 
        AND s.schedule_date >= ? 
        AND s.schedule_date <= ?
      ORDER BY s.schedule_date ASC, s.schedule_time ASC
    `).all(familyId, startDate, endDate);
    
    // 按日期分组
    const grouped = {};
    items.forEach(item => {
      const date = item.schedule_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(item);
    });
    
    res.json({
      success: true,
      data: {
        items,
        grouped
      }
    });
  } catch (error) {
    console.error('获取月日程失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 添加日程
router.post('/add', authMiddleware, (req, res) => {
  const db = getDb();
  // 兼容两种字段名
  const { familyId, title, description, scheduleDate, scheduleTime, date, time, type, remindBefore, remind, repeatType } = req.body;
  const dateValue = scheduleDate || date;
  const timeValue = scheduleTime || time;
  const remindValue = remindBefore || remind || 1;
  
  if (!familyId || !title || !dateValue) {
    return res.status(400).json({ 
      success: false, 
      message: '请填写完整信息' 
    });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO schedules (family_id, title, description, schedule_date, schedule_time, type, remind_before, repeat_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      familyId, 
      title.trim(), 
      description || '',
      dateValue,
      timeValue || null,
      type || 'other',
      remindValue,
      repeatType || 'none',
      req.userId
    );
    
    // 获取刚插入的日程
    const schedules = db.prepare(`
      SELECT s.*, u.nickname as created_by_name
      FROM schedules s
      LEFT JOIN users u ON s.created_by = u.id
      ORDER BY s.id DESC LIMIT 1
    `).all();
    
    const schedule = schedules[0];
    
    res.json({
      success: true,
      data: schedule,
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加日程失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '添加失败' 
    });
  }
});

// 更新日程
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  // 兼容两种字段名
  const { title, description, scheduleDate, scheduleTime, date, time, type, remindBefore, remind, repeatType } = req.body;
  const dateValue = scheduleDate || date;
  const timeValue = scheduleTime || time;
  const remindValue = remindBefore || remind || 1;
  
  try {
    db.prepare(`
      UPDATE schedules 
      SET title = ?, description = ?, schedule_date = ?, schedule_time = ?, type = ?, remind_before = ?, repeat_type = ?
      WHERE id = ?
    `).run(
      title?.trim(),
      description || '',
      dateValue,
      timeValue || null,
      type || 'other',
      remindValue,
      repeatType || 'none',
      id
    );
    
    const item = db.prepare(`
      SELECT s.*, u.nickname as created_by_name
      FROM schedules s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `).get(id);
    
    res.json({
      success: true,
      data: item,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新日程失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新失败' 
    });
  }
});

// 删除日程
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  try {
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    
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

// 获取日程类型列表
router.get('/types', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'birthday', name: '🎂 生日', icon: '🎂', color: '#FF6B6B' },
      { id: 'anniversary', name: '💕 纪念日', icon: '💕', color: '#FF85A2' },
      { id: 'appointment', name: '📋 预约', icon: '📋', color: '#4ECDC4' },
      { id: 'meeting', name: '📅 会议', icon: '📅', color: '#45B7D1' },
      { id: 'trip', name: '✈️ 出行', icon: '✈️', color: '#96CEB4' },
      { id: 'other', name: '📌 其他', icon: '📌', color: '#A8A8A8' }
    ]
  });
});

// 按日期范围获取日程
router.get('/range', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, startDate, endDate } = req.query;
  
  if (!familyId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少家庭ID' 
    });
  }
  
  try {
    const items = db.prepare(`
      SELECT s.*, u.nickname as created_by_name
      FROM schedules s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.family_id = ? 
        AND s.schedule_date >= ?
        AND s.schedule_date <= ?
      ORDER BY s.schedule_date ASC, s.schedule_time ASC
    `).all(familyId, startDate || '2020-01-01', endDate || '2030-12-31');
    
    // 添加类型名称
    const typeNames = {
      birthday: '生日',
      anniversary: '纪念日',
      appointment: '预约',
      meeting: '会议',
      trip: '出行',
      other: '其他'
    };
    
    const result = items.map(item => ({
      ...item,
      typeName: typeNames[item.type] || '其他'
    }));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取日程范围失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 获取即将到来的日程（首页展示）
router.get('/upcoming', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId, days = 7 } = req.query;
  
  if (!familyId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少家庭ID' 
    });
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));
    const end = endDate.toISOString().split('T')[0];
    
    const items = db.prepare(`
      SELECT s.*, u.nickname as created_by_name
      FROM schedules s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.family_id = ? 
        AND s.schedule_date >= ?
        AND s.schedule_date <= ?
      ORDER BY s.schedule_date ASC, s.schedule_time ASC
      LIMIT 10
    `).all(familyId, today, end);
    
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('获取即将日程失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取失败' 
    });
  }
});

// 获取我的日程记录
router.get('/my-records', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.query;
  
  if (!familyId) {
    return res.json({ success: true, data: [] });
  }
  
  try {
    const items = db.prepare(`
      SELECT * FROM schedules 
      WHERE family_id = ? AND created_by = ?
      ORDER BY schedule_date DESC
    `).all(familyId, req.userId);
    
    // 添加类型名称和日期格式化
    const typeNames = {
      birthday: '生日',
      anniversary: '纪念日',
      appointment: '预约',
      meeting: '会议',
      trip: '出行',
      other: '其他'
    };
    
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    const result = items.map(item => {
      const date = new Date(item.schedule_date);
      const day = date.getDate().toString();
      const week = weekDays[date.getDay()];
      return {
        ...item,
        typeName: typeNames[item.type] || '其他',
        day,
        week
      };
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取我的日程记录失败:', error);
    res.json({ success: true, data: [] });
  }
});

module.exports = router;