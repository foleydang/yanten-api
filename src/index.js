const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const config = require('../config/default');
const { initDatabase, getDb } = require('./utils/database');
const { authMiddleware } = require('./middleware/auth');

// 导入路由
const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/family');
const shoppingRoutes = require('./routes/shopping');
const todoRoutes = require('./routes/todo');
const scheduleRoutes = require('./routes/schedule');
const feedbackRoutes = require('./routes/feedback');
const uploadRoutes = require('./routes/upload');
const wawaxiaoRoutes = require('./routes/wawaxiao');

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件
app.use('/static', express.static(path.join(__dirname, '../public')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/todo', todoRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/wawaxiao', wawaxiaoRoutes);

// 用户统计 API
app.get('/api/user/stats', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.query;
  
  if (!familyId) {
    return res.json({
      success: true,
      data: { shoppingCount: 0, todoCount: 0, scheduleCount: 0 }
    });
  }
  
  try {
    const shoppingCount = db.prepare(
      'SELECT COUNT(*) as count FROM shopping_items WHERE family_id = ? AND added_by = ?'
    ).get(familyId, req.userId)?.count || 0;
    
    const todoCount = db.prepare(
      'SELECT COUNT(*) as count FROM todos WHERE family_id = ? AND added_by = ?'
    ).get(familyId, req.userId)?.count || 0;
    
    const scheduleCount = db.prepare(
      'SELECT COUNT(*) as count FROM schedules WHERE family_id = ? AND created_by = ?'
    ).get(familyId, req.userId)?.count || 0;
    
    res.json({
      success: true,
      data: { shoppingCount, todoCount, scheduleCount }
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.json({
      success: true,
      data: { shoppingCount: 0, todoCount: 0, scheduleCount: 0 }
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '家庭备忘录服务运行正常 ❤️' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: err.message || '服务器错误',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 初始化数据库并启动服务
async function start() {
  try {
    await initDatabase();
    console.log('✅ 数据库初始化完成');
    
    app.listen(config.port, () => {
      console.log(`🚀 服务已启动: http://localhost:${config.port}`);
      console.log('💕 家庭备忘录，记录爱的每一刻');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
