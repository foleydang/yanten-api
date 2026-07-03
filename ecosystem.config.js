module.exports = {
  apps: [{
    name: 'yanten-api',
    script: './src/index.js',
    cwd: '/root/github/yanten-api',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    restart_delay: 5000,
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    }
  }]
};
