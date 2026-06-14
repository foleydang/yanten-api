const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const config = require('../config/default');
const { initDatabase, getDb } = require('./utils/database');
const { authMiddleware, familyMemberMiddleware } = require('./middleware/auth');
const { apiLimiter, strictLimiter, jokeLimiter } = require('./middleware/rateLimit');
const securityHeaders = require('./middleware/securityHeaders');
const requestLogger = require('./middleware/requestLogger');

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

// 自动审核：超过1天的pending笑话自动通过
function autoApproveJokes() {
  try {
    const db = getDb();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const result = db.prepare('UPDATE jokes SET status = "approved" WHERE status = "pending" AND date <= ?').run(yesterday);
    if (result.changes > 0) {
      console.log(`🤖 自动审核：${result.changes}条笑话已通过（超过1天未审核）`);
    }
  } catch (e) {
    console.error('自动审核失败:', e.message);
  }
}

// CORS
const corsOptions = process.env.NODE_ENV === 'production' ? {
  origin: ['https://yanten.top', 'https://api.yanten.top', 'https://servicewechat.com'],
  credentials: true
} : {};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 安全中间件
app.use(securityHeaders);
app.use(requestLogger);

// 静态文件
app.use('/static', express.static(path.join(__dirname, '../public')));

// API限流
app.use('/api/', apiLimiter);

// 路由
app.use('/api/auth', strictLimiter, authRoutes);
app.use('/api/family', authMiddleware, familyRoutes);
app.use('/api/shopping', authMiddleware, shoppingRoutes);
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
  
  // 动态获取数据库文件大小
  let dbSize = 'N/A';
  try {
    const dbPath = path.resolve(config.database.path);
    const stats = fs.statSync(dbPath);
    const sizeKB = Math.round(stats.size / 1024);
    dbSize = sizeKB < 1024 ? `${sizeKB}KB` : `${Math.round(sizeKB / 1024)}MB`;
  } catch (e) {
    dbSize = 'N/A';
  }
  
  res.json({
    status: 'ok',
    message: '家庭备忘录服务运行正常 ❤️',
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
    },
    database: { connected: true, size: dbSize },
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
let autoApproveInterval = null;
async function start() {
  try {
    await initDatabase();
    console.log('✅ 数据库初始化完成');
    
    if (!autoApproveInterval) {
      autoApproveJokes();
      autoApproveInterval = setInterval(autoApproveJokes, 3600000);
    }
    
    const server = app.listen(config.port, () => {
      console.log(`🚀 服务已启动: http://localhost:${config.port}`);
      console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log('💕 家庭备忘录，记录爱的每一刻');
      console.log('🔒 API限流已启用');
      console.log('🛡️ 安全Headers和请求日志已启用');
      console.log('🤖 笑话自动审核已启用（超过1天自动通过）');
    });

    // Graceful shutdown - 确保端口释放
    process.on('SIGINT', () => {
      console.log('收到 SIGINT，优雅关闭...');
      server.close(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
      console.log('收到 SIGTERM，优雅关闭...');
      server.close(() => process.exit(0));
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();