# 阿里云 OSS 数据备份说明

## ✅ OSS 配置已完成

**Bucket 信息：**
- 名称：yanten-data
- 区域：华东1（杭州）
- 创建时间：2026-05-07

**已备份文件：**
- `database/2026-05-07/main-14-22-19.db` (88 KB) - 主数据库
- `database/schema.sql` (3.34 KB) - 数据库结构
- `wawaxiao/2026-05-07/jokes-14-22-19.json` (50 KB) - 笑话数据（102条）
- `wawaxiao/2026-05-07/actions-14-22-19.json` (0.42 KB) - 用户行为

---

## 🔧 OSS 命令

```bash
# 测试 OSS 连接并备份
npm run test-oss

# 定期备份（生产环境）
npm run backup
```

---

## ⏰ 设置定时自动备份

### 方法1：PM2 Cron（推荐）

修改 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'yanten-api',
      script: './src/index.js',
      cron_restart: '0 * * * *', // 每小时重启（可选）
      // ...
    },
    {
      name: 'yanten-backup',
      script: './src/scripts/backup-to-oss.js',
      cron: '0 * * * *', // 每小时备份
      autorestart: false,
      watch: false
    }
  ]
};
```

### 方法2：Linux Crontab

```bash
# 编辑定时任务
crontab -e

# 每小时备份一次
0 * * * * cd /root/github/yanten-api && npm run backup >> /root/logs/backup.log 2>&1

# 每天凌晨3点备份
0 3 * * * cd /root/github/yanten-api && npm run backup >> /root/logs/backup.log 2>&1
```

### 方法3：Node.js 定时任务

在主程序中添加定时备份：

```javascript
// src/index.js 添加
const cron = require('node-cron');
const { backupToOSS } = require('./scripts/backup-to-oss');

// 每小时备份
cron.schedule('0 * * * *', () => {
  console.log('⏰ 定时备份开始...');
  backupToOSS();
});
```

---

## 📥 从 OSS 恢复数据

### 服务器迁移时恢复数据

```javascript
// src/scripts/restore-from-oss.js
const OSS = require('ali-oss');

async function restoreFromOSS() {
  const client = new OSS({
    region: 'oss-cn-hangzhou',
    bucket: 'yanten-data',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    secure: true
  });

  // 获取最新的数据库文件
  const result = await client.list({
    prefix: 'database/',
    'max-keys': 100
  });

  // 找到最新的 .db 文件
  const dbFiles = result.objects
    .filter(obj => obj.name.endsWith('.db'))
    .sort((a, b) => b.lastModified - a.lastModified);

  if (dbFiles.length > 0) {
    const latestDb = dbFiles[0];
    console.log('下载最新数据库:', latestDb.name);

    await client.get(latestDb.name, './data/database/main.db');
    console.log('✅ 数据库恢复成功');
  }
}

restoreFromOSS();
```

---

## 🔒 OSS 权限说明

### Bucket 权限

当前配置：**私有（推荐）**

访问控制：
- 公读私写：允许公开下载，但不推荐（数据安全）
- 私有读写：仅授权用户可访问（推荐）

### AccessKey 权限

建议使用 RAM 子账号：
1. 登录阿里云 RAM 控制台
2. 创建子账号
3. 授权：`AliyunOSSFullAccess` 或自定义权限
4. 使用子账号的 AccessKey

---

## 📊 OSS 使用情况监控

阿里云 OSS 控制台查看：
https://oss.console.aliyun.com/bucket/oss-cn-hangzhou/yanten-data

监控指标：
- 存储容量
- 流量使用
- 请求次数

---

## 💰 OSS 费用说明

**免费额度：**
- 存储空间：40GB
- 下行流量：有限额

**当前使用：**
- 已备份：142 KB
- 占用额度：极小

**预计费用：**
- 当前数据量下，完全免费
- 数据增长到 1GB+ 可能产生费用

---

## 🔗 OSS 文件 URL

每个备份文件都有独立 URL：

```
https://yanten-data.oss-cn-hangzhou.aliyuncs.com/database/2026-05-07/main-14-22-19.db
https://yanten-data.oss-cn-hangzhou.aliyuncs.com/wawaxiao/2026-05-07/jokes-14-22-19.json
```

**注意：**
- 私有 Bucket 需要 AccessKey 才能下载
- 可临时设置公开分享链接（7天有效期）

---

## 📝 备份策略建议

| 数据类型 | 备份频率 | 保留时间 |
|---------|---------|----------|
| SQLite 数据库 | 每小时 | 7天 |
| 笑话 JSON | 每天 | 30天 |
| Schema 文件 | 每周 | 永久 |

---

## ✅ 完成

- ✅ OSS Bucket 创建：yanten-data
- ✅ AccessKey 配置完成
- ✅ 首次备份成功（142 KB）
- ✅ OSS 连接测试成功

**下一步：设置定时自动备份**（部署到服务器后）