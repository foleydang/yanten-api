# Yanten API 优化建议报告

生成时间：2026-05-07 14:49

---

## 🔴 关键问题（立即修复）

### 1. PM2 服务不稳定
```
重启次数：27次（正常应该 < 5）
错误：EADDRINUSE null:3000（端口冲突）
```

**原因：** PM2 cluster模式启动多个实例，端口冲突

**修复：**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'yanten-api',
    script: './src/index.js',
    instances: 1,  // 单实例（SQLite不支持多进程）
    exec_mode: 'fork',  // 改成fork模式
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env_production: {
      NODE_ENV: 'production',  // ⚠️ 当前是development
      PORT: 3000
    }
  }]
};
```

### 2. NODE_ENV 配置错误
```
当前：NODE_ENV=development
应该：NODE_ENV=production
```

**影响：**
- 性能损失（开发模式慢）
- 安全风险（错误信息暴露）
- 日志过多

**修复：** 更新 `.env` 文件

### 3. 缺少哇哇笑微信配置
```
WECHAT_APP_SECRET_WAWAXIAO=your-secret-here
```

**影响：** 哇哇笑小程序无法登录

**修复：** 配置真实的微信 AppSecret

### 4. SERVER_URL 配置错误
```
当前：SERVER_URL=http://localhost:3000
应该：SERVER_URL=https://api.yanten.top
```

**修复：** 更新 `.env`

---

## 🟡 性能优化

### 5. 内存使用偏高
```
内存：1.2GB / 1.9GB（65%使用）
PM2进程：96MB
```

**优化建议：**
- SQLite数据量小，内存应该更低
- 可能是数据库连接未释放
- 建议：定期重启 PM2（每天凌晨3点）

### 6. 缺少API限流
**风险：** 可能被恶意请求攻击，消耗资源

**建议添加：**
```javascript
// middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个 IP 限制 100 请求
  message: '请求过多，请稍后再试'
});

app.use('/api/', limiter);
```

需要安装：`npm install express-rate-limit`

### 7. 缺少日志记录
**当前：** 只有 console.log，无结构化日志

**建议添加：**
```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

需要安装：`npm install winston`

---

## 🟢 安全优化

### 8. CORS 配置过于宽松
```
app.use(cors()); // 允许所有来源
```

**风险：** 任何网站都能调用你的 API

**建议：**
```javascript
const corsOptions = {
  origin: [
    'https://yanten.top',
    'https://api.yanten.top'
  ],
  credentials: true
};

app.use(cors(corsOptions));
```

### 9. JWT Secret 过于简单
```
JWT_SECRET=family-memo-secret-key-2024-secure
```

**建议：** 使用更强的随机密钥

```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 10. 缺少请求验证
**建议添加：**
- 输入验证（express-validator）
- XSS防护
- SQL注入防护（已用SQLite参数化查询）

---

## 🔵 功能优化

### 11. 缺少健康检查细节
**当前：**
```json
{"status":"ok"}
```

**建议增强：**
```javascript
app.get('/api/health', (req, res) => {
  const db = getDb();
  
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      connected: !!db,
      tables: db ? getTablesCount(db) : 0
    },
    timestamp: new Date().toISOString()
  });
});
```

### 12. 缺少API文档
**建议：** 使用 Swagger/OpenAPI

```bash
npm install swagger-ui-express
```

```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

### 13. 缺少定时任务管理
**当前：** 使用 cron

**建议：** 使用 node-cron 在应用内管理

```javascript
const cron = require('node-cron');

// 每小时备份数据库
cron.schedule('0 * * * *', () => {
  saveDatabase();
  backupToOSS();
});

// 每天凌晨3点清理日志
cron.schedule('0 3 * * *', () => {
  cleanupLogs();
});
```

---

## 🟣 数据库优化

### 14. SQLite 没有定期保存
**问题：** 数据库只在操作时保存，可能丢失数据

**建议：** 定期自动保存

```javascript
// 每分钟保存数据库
setInterval(() => {
  saveDatabase();
}, 60000);
```

### 15. 缺少数据库索引优化
**当前schema有索引，建议定期检查：**
```sql
-- 查看索引使用情况
SELECT * FROM sqlite_master WHERE type='index';
```

---

## 📊 优化优先级

| 优先级 | 问题 | 影响 | 修复难度 |
|--------|------|------|----------|
| 🔴 P0 | PM2配置错误 | 服务不稳定 | ⭐ 简单 |
| 🔴 P0 | NODE_ENV错误 | 性能+安全 | ⭐ 简单 |
| 🔴 P1 | 缺少微信配置 | 登录失败 | ⭐ 简单 |
| 🟡 P2 | 缺少API限流 | 安全风险 | ⭐⭐ 中等 |
| 🟡 P2 | CORS配置宽松 | 安全风险 | ⭐ 简单 |
| 🟡 P2 | 缺少日志 | 维护困难 | ⭐⭐ 中等 |
| 🟢 P3 | 健康检查简陋 | 监控不足 | ⭐ 简单 |
| 🟢 P3 | 缺少API文档 | 开发不便 | ⭐⭐ 中等 |

---

## 💰 成本评估

**免费优化（0成本）：**
- PM2配置修复
- NODE_ENV修改
- CORS配置
- 健康检查增强
- 数据库定期保存

**低成本优化（< ¥10）：**
- express-rate-limit（npm包免费）
- winston日志（npm包免费）
- node-cron定时任务（npm包免费）

**总计优化成本：¥0**

---

## 🚀 立即行动清单

1. ✅ 修复PM2配置（5分钟）
2. ✅ 修改NODE_ENV（1分钟）
3. ✅ 配置哇哇笑微信密钥（需要你去微信后台获取）
4. ✅ 更新SERVER_URL（1分钟）
5. ✅ 添加API限流（10分钟）
6. ✅ 修复CORS配置（2分钟）
7. ✅ 添加数据库定期保存（5分钟）

**预计总耗时：25分钟**

---

## 📈 优化后效果预估

| 指标 | 当前 | 优化后 | 提升 |
|------|------|--------|------|
| 服务稳定性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| 安全性 | ⭐⭐ | ⭐⭐⭐⭐ | +100% |
| 性能 | ⭐⭐⭐ | ⭐⭐⭐⭐ | +33% |
| 可维护性 | ⭐⭐ | ⭐⭐⭐⭐ | +100% |

---

**建议先修复 P0 级别问题，然后逐步优化其他项。**