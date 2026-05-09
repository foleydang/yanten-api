const rateLimit = require('express-rate-limit');

// 放宽限流：每个IP每分钟300次
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: { success: false, message: '请求过多，请稍后再试' },
  trustProxy: true,
  keyGenerator: (req) => req.ip || req.headers['x-real-ip'] || 'unknown'
});

// 严格限流：登录等敏感接口
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { success: false, message: '操作过于频繁，请稍后再试' },
  trustProxy: true,
  keyGenerator: (req) => req.ip || req.headers['x-real-ip'] || 'unknown'
});

// 哇哇笑限流：放宽到每分钟200次
const jokeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { success: false, message: '看笑话太快了，歇一会儿~' },
  trustProxy: true,
  keyGenerator: (req) => req.ip || req.headers['x-real-ip'] || 'unknown'
});

module.exports = { apiLimiter, strictLimiter, jokeLimiter };
