// 安全Headers中间件
const helmet = require('helmet');

module.exports = helmet({
  contentSecurityPolicy: false, // 暂不启用CSP（小程序需要）
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // 禁用COOP，小程序不需要
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // 允许小程序等跨域加载图片资源
  hsts: {
    maxAge: 31536000, // 1年
    includeSubDomains: true
  },
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});