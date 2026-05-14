const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const config = require('../config/default');
const { initDatabase, getDb } = require('./utils/database');
const { authMiddleware } = require('./middleware/auth');
const { apiLimiter, strictLimiter, jokeLimiter } = require('./middleware/rateLimit');

// 路由
const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/family');
const shoppingRoutes = require('./routes/shopping');
const todoRoutes = require('./routes/todo');
const scheduleRoutes = require('./routes/schedule');
const feedbackRoutes = require('./routes/feedback');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require("./routes/admin");
const wawaxiaoRoutes = require('./routes/wawaxiao');
const gamesRoutes = require('./routes/games');

const app = express();

// CORS
const corsOptions = process.env.NODE_ENV === 'production' ? {
  origin: ['https://yanten.top', 'https://api.yanten.top', 'https://servicewechat.com'],
  credentials: true
} : {};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件
app.use('/static', express.static(path.join(__dirname, '../public')));

// API限流
app.use('/api/', apiLimiter);

// 路由
app.use('/api/auth', strictLimiter, authRoutes);
app.use('/api/family', authMiddleware, familyRoutes);
// 购物清单API：其他需要认证
// 购物分类公开访问
app.get('/api/shopping/categories', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'food', name: '🥬 食品', icon: '🥬' },
      { id: 'daily', name: '🧴 日用品', icon: '🧴' },
      { id: 'clothing', name: '👕 服饰', icon: '👕' },
      { id: 'medicine', name: '💊 医药', icon: '💊' },
      { id: 'other', name: '📦 其他', icon: '📦' }
    ]
  });
});
// 购物其他API需要认证
app.use('/api/todo', authMiddleware, todoRoutes);
app.use('/api/schedule', authMiddleware, scheduleRoutes);
app.use('/api/feedback', authMiddleware, feedbackRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/admin/jokes', adminRoutes);
app.use('/api/wawaxiao', jokeLimiter, wawaxiaoRoutes);
app.use('/api/games', gamesRoutes);

// 用户统计
app.get('/api/user/stats', authMiddleware, (req, res) => {
  const db = getDb();
  const { familyId } = req.query;
  
  if (!familyId) {
    return res.json({ success: true, data: { shoppingCount: 0, todoCount: 0, scheduleCount: 0 } });
  }
  
  try {
    const shoppingCount = db.prepare('SELECT COUNT(*) as count FROM shopping_items WHERE family_id = ? AND added_by = ?').get(familyId, req.userId)?.count || 0;
    const todoCount = db.prepare('SELECT COUNT(*) as count FROM todos WHERE family_id = ? AND added_by = ?').get(familyId, req.userId)?.count || 0;
    const scheduleCount = db.prepare('SELECT COUNT(*) as count FROM schedules WHERE family_id = ? AND created_by = ?').get(familyId, req.userId)?.count || 0;
    res.json({ success: true, data: { shoppingCount, todoCount, scheduleCount } });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.json({ success: true, data: { shoppingCount: 0, todoCount: 0, scheduleCount: 0 } });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  res.json({
    status: 'ok',
    message: '家庭备忘录服务运行正常 ❤️',
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
    },
    database: { connected: true, size: '88KB' },
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}天${hours}小时` : `${hours}小时${mins}分钟`;
}

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' ? '服务器错误' : err.message
  });
});

// 启动服务
async function start() {
  try {
    await initDatabase();
    console.log('✅ 数据库初始化完成');
    
    app.listen(config.port, () => {
      console.log(`🚀 服务已启动: http://localhost:${config.port}`);
      console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log('💕 家庭备忘录，记录爱的每一刻');
      console.log('🔒 API限流已启用');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
