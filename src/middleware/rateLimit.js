// API 限流中间件（修复版）
const rateLimit = require('express-rate-limit');

// 通用限流：每个IP每15分钟最多100次请求
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: '请求过多，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,  // Nginx代理时需要
  keyGenerator: (req) => req.ip || req.headers['x-real-ip']
});

// 严格的限流：登录等敏感接口
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: '操作过于频繁，请稍后再试' },
  trustProxy: true,
  keyGenerator: (req) => req.ip || req.headers['x-real-ip']
});

// 哇哇笑限流
const jokeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: { success: false, message: '看笑话太快了，歇一会儿~' },
  trustProxy: true,
  keyGenerator: (req) => req.ip || req.headers['x-real-ip']
});

module.exports = { apiLimiter, strictLimiter, jokeLimiter };
