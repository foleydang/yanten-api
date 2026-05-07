const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const config = require('../config/default');
const { initDatabase, getDb, saveDatabase } = require('./utils/database');
const { authMiddleware } = require('./middleware/auth');

// 安全和监控中间件
const { apiLimiter, strictLimiter, jokeLimiter } = require('./middleware/rateLimit');
const securityHeaders = require('./middleware/securityHeaders');
const requestLogger = require('./middleware/requestLogger');

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

// 安全Headers
app.use(securityHeaders);

// CORS 配置（生产环境限制来源）
const corsOptions = process.env.NODE_ENV === 'production' ? {
  origin: [
    'https://yanten.top',
    'https://api.yanten.top',
    'https://servicewechat.com'
  ],
  credentials: true
} : {};

app.use(cors(corsOptions));

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use(requestLogger);
}

// 静态文件
app.use('/static', express.static(path.join(__dirname, '../public')));

// 全局API限流
app.use('/api/', apiLimiter);

// 路由
app.use('/api/auth', strictLimiter, authRoutes);
app.use('/api/family', authMiddleware, familyRoutes);
app.use('/api/shopping', authMiddleware, shoppingRoutes);
app.use('/api/todo', authMiddleware, todoRoutes);
app.use('/api/schedule', authMiddleware, scheduleRoutes);
app.use('/api/feedback', authMiddleware, feedbackRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/wawaxiao', jokeLimiter, wawaxiaoRoutes);

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

// 增强健康检查
app.get('/api/health', (req, res) => {
  const db = getDb();
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  res.json({
    status: 'ok',
    message: '家庭备忘录服务运行正常 ❤️',
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
    },
    database: {
      connected: !!db,
      size: Math.round(getDatabaseSize() / 1024) + 'KB'
    },
    environment: process.env.NODE_ENV || 'development',
    version: require('../package.json').version,
    timestamp: new Date().toISOString()
  });
});

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}天${hours}小时` : `${hours}小时${mins}分钟`;
}

function getDatabaseSize() {
  try {
    const stats = require('fs').statSync(process.env.DB_PATH || './data/database/main.db');
    return stats.size;
  } catch (e) {
    return 0;
  }
}

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API不存在'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // 生产环境不暴露错误详情
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' ? '服务器错误' : err.message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 定期保存数据库（每分钟）
setInterval(() => {
  try {
    saveDatabase();
  } catch (e) {
    console.error('数据库保存失败:', e.message);
  }
}, 60000);

// 初始化数据库并启动服务
async function start() {
  try {
    await initDatabase();
    console.log('✅ 数据库初始化完成');
    
    app.listen(config.port, () => {
      console.log(`🚀 服务已启动: http://localhost:${config.port}`);
      console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log('💕 家庭备忘录，记录爱的每一刻');
      console.log('📊 数据库定期保存：每分钟');
      console.log('🔒 API限流已启用');
      console.log('🛡️  安全Headers已启用');
      console.log('📝 请求日志已启用（错误和慢请求）');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
