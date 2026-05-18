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
    path: process.env.DB_PATH || './data/database/main.db',
  },
  
  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'family-memo-secret-key-2024',
    expiresIn: process.env.JWT_EXPIRES_IN || '90d',
  },
  
  // 管理员配置
  admin: {
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  
  // 服务地址
  baseUrl: process.env.BASE_URL || 'https://api.yanten.top',
};
