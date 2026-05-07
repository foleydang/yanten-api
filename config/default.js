module.exports = {
  // 服务端口
  port: process.env.PORT || 3000,
  
  // 微信小程序配置
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
  },
  
  // 数据库配置
  database: {
    path: process.env.DB_PATH || './data/family-memo.db',
  },
  
  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'family-memo-secret-key-2024',
    expiresIn: '7d',
  },
  
  // 服务地址
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
};