// API 限流中间件
const rateLimit = require('express-rate-limit');

// 通用限流：每个IP每15分钟最多100次请求
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制100次请求
  message: {
    success: false,
    message: '请求过多，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 严格的限流：登录等敏感接口
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 限制10次
  message: {
    success: false,
    message: '操作过于频繁，请稍后再试'
  }
});

// 哇哇笑限流：轻松点，可以多请求
const jokeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 50, // 限制50次请求
  message: {
    success: false,
    message: '看笑话太快了，歇一会儿~'
  }
});

module.exports = {
  apiLimiter,
  strictLimiter,
  jokeLimiter
};