// 请求日志中间件（生产环境）
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'api.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // 响应完成后记录
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: duration + 'ms',
      ip: req.ip || req.headers['x-real-ip'],
      userAgent: req.headers['user-agent']?.substring(0, 100)
    };
    
    // 只记录错误和慢请求（>1秒）
    if (res.statusCode >= 400 || duration > 1000) {
      const logLine = JSON.stringify(log) + '\n';
      fs.appendFileSync(LOG_FILE, logLine);
    }
  });
  
  next();
}

module.exports = requestLogger;