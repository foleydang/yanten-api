// 安全Headers中间件
const helmet = require('helmet');

module.exports = helmet({
  contentSecurityPolicy: false, // 暂不启用CSP（小程序需要）
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000, // 1年
    includeSubDomains: true
  },
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});