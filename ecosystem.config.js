module.exports = {
  apps: [{
    name: 'yanten-api',
    script: './src/index.js',
    instances: 1,           // 单实例（SQLite不支持多进程）
    exec_mode: 'fork',      // fork模式（不是cluster）
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    restart_delay: 3000,    // 重启延迟3秒
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',  // 生产环境
      PORT: 3000
    }
  }]
};
