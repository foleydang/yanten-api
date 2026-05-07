# Yanten API 部署总结

## ✅ 部署完成

**服务地址：** `http://localhost:3000`（或你的阿里云服务器 IP）

**已完成：**
- ✅ GitHub 仓库创建：`yanten-api`
- ✅ 代码迁移完成（8个路由 + 数据库）
- ✅ OSS 配置成功（yanten-data bucket）
- ✅ PM2 部署成功（开机自启）
- ✅ API 测试成功
- ✅ 定时备份设置（每小时）

---

## 📊 API 测试结果

```bash
# 健康检查
curl http://localhost:3000/api/health
{"status":"ok","message":"家庭备忘录服务运行正常 ❤️"}

# 哇哇笑统计
curl http://localhost:3000/api/wawaxiao/stats
{"success":true,"data":{"total":102,"hotCount":0,"totalLikes":3,"totalDislikes":5}}

# 笑话列表
curl http://localhost:3000/api/wawaxiao/jokes?limit=3
返回 102 条笑话中的 3 条
```

---

## 🚀 GitHub 推送（需配置 SSH）

### 方法1：配置 SSH Key

```bash
# 生成 SSH key（如果还没有）
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub

# 复制公钥，添加到 GitHub：
# https://github.com/settings/ssh/new

# 推送
cd ~/github/yanten-api
git push -u origin main
```

### 方法2：HTTPS + Token

```bash
# 创建 GitHub Token：
# https://github.com/settings/tokens/new
# 选择：repo 权限

# 推送（输入 token 作为密码）
cd ~/github/yanten-api
git remote set-url origin https://github.com/foleydang/yanten-api.git
git push -u origin main
# Username: foleydang
# Password: <your-token>
```

---

## ⏰ 定时备份

已设置每小时自动备份到 OSS：

```bash
# 查看 cron 任务
crontab -l | grep backup
# 0 * * * * cd ~/github/yanten-api && node src/scripts/backup-to-oss.js >> ~/logs/backup.log 2>&1

# 查看备份日志
tail -f ~/logs/backup.log

# 手动备份
npm run test-oss
```

---

## 📱 小程序无需改动

API 地址保持不变：
- 家庭备忘录：`https://api.yanten.top/api/family/*`
- 哇哇笑：`https://api.yanten.top/api/wawaxiao/*`

---

## 💰 数据库成本对比

| 方案 | 月费用 | 说明 |
|------|---------|------|
| **当前方案** | **¥0** | SQLite + OSS 备份 |
| RDS MySQL | ¥100+ | 阿里云关系型数据库 |
| PolarDB | ¥80+ | 阿里云云原生数据库 |
| MongoDB | ¥100+ | 阿里云文档数据库 |

**你的方案完全免费！** SQLite 轻量高性能 + OSS 云端备份（40GB免费）

---

## 🔄 服务器迁移（未来）

如果需要迁移到新服务器：

```bash
# 1. 新服务器安装 Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# 2. 安装 PM2
npm install -g pm2

# 3. 克隆代码
git clone https://github.com/foleydang/yanten-api.git
cd yanten-api

# 4. 安装依赖
npm install

# 5. 配置 .env（复制现有配置）
# 6. 从 OSS 恢复数据（可选）
npm run test-oss  # 会下载最新备份

# 7. 启动服务
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🔧 常用命令

```bash
# 查看服务状态
pm2 list
pm2 logs yanten-api
pm2 monit

# 重启服务
pm2 restart yanten-api

# 停止服务
pm2 stop yanten-api

# 数据库初始化
npm run init-db

# OSS 备份
npm run test-oss

# 查看备份日志
tail ~/logs/backup.log
```

---

## 📁 OSS 文件结构

```
yanten-data bucket
├── database/
│   ├── 2026-05-07/
│   │   ├── main-14-22-19.db (88KB)
│   │   └── main-14-29-05.db (88KB)
│   └── schema.sql (3.34KB)
├── wawaxiao/
│   └── 2026-05-07/
│       ├── jokes-14-22-19.json (50KB)
│       └── actions-14-22-19.json (0.42KB)
└── backup/
    └── 2026-05-07/
        ├── main-14-29-05.db
        └── wawaxiao-jokes-14-29-05.json
        └ wawaxiao-actions-14-29-05.json
```

---

## ✅ 完成清单

- ✅ GitHub 仓库创建
- ⏳ GitHub 推送（需配置 SSH）
- ✅ 代码迁移
- ✅ 数据迁移
- ✅ OSS 配置
- ✅ OSS 备份成功
- ✅ PM2 部署
- ✅ API 测试
- ✅ 定时备份设置
- ✅ 开机自启配置

---

## 🎯下一步

1. **配置 SSH Key 并推送 GitHub**
2. **配置 Nginx（如果需要域名访问）**
3. **小程序测试**
4. **监控备份日志**

---

**项目地址：**
- 代码：`~/github/yanten-api`
- 数据：`~/github/yanten-api/data/database/`
- OSS：https://oss.console.aliyun.com/bucket/oss-cn-hangzhou/yanten-data