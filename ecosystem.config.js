module.exports = {
  apps: [{
    name: 'yanten-api',
    script: './src/index.js',
    cwd: '/root/github/yanten-api',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    restart_delay: 3000,
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      WECHAT_APP_ID: 'wx0e9d435ac360a024',
      WECHAT_APP_SECRET: '3c31ebf06e43a1c84f9109d96fd70bd2',
      JWT_SECRET: 'yanten-family-memo-secret-key-2024',
      JWT_EXPIRES_IN: '7d'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      WECHAT_APP_ID: 'wx0e9d435ac360a024',
      WECHAT_APP_SECRET: '3c31ebf06e43a1c84f9109d96fd70bd2',
      JWT_SECRET: 'yanten-family-memo-secret-key-2024',
      JWT_EXPIRES_IN: '7d'
    }
  }]
};
