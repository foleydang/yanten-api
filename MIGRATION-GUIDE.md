# Yanten API 迁移指南

## 📋 迁移概述

从 `family-memo/server` 迁移到独立的 `yanten-api` 仓库。

**迁移内容：**
- ✅ 所有后端代码（路由、中间件、工具）
- ✅ 数据库 schema 和数据
- ✅ 哇哇笑笑话数据（102条）
- ✅ 配置文件和环境变量
- ✅ PM2 部署配置
- ✅ OSS 备份脚本（可选）

---

## 🚀 部署步骤

### 1. 准备 GitHub 仓库

```bash
# 在 GitHub 创建新仓库：yanten-api
# 然后：
cd ~/github/yanten-api
git remote add origin https://github.com/foleydang/yanten-api.git
git push -u origin main
```

### 2. 阿里云服务器部署

```bash
# SSH 登录服务器
ssh root@your-server

# 克隆代码
cd ~/github
git clone https://github.com/foleydang/yanten-api.git
cd yanten-api

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 初始化数据库
npm run init-db

# 停止旧服务
pm2 stop family-memo-server
pm2 delete family-memo-server

# 启动新服务
pm2 start ecosystem.config.js
pm2 save

# 查看日志
pm2 logs yanten-api
```

### 3. 验证服务

```bash
# 测试 API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/wawaxiao/stats

# 测试微信小程序
# 更新小程序中的 API 地址（无需改动，域名一样）
```

---

## 📊 数据迁移

### SQLite 数据库

**自动迁移：**
- 新数据库 `data/database/main.db` 已创建
- 结构与旧数据库完全一致

**手动迁移数据（可选）：**
```bash
# 如果需要迁移旧数据：
# 1. 从旧服务器下载 family-memo.db
scp root@old-server:/root/github/family-memo/server/data/family-memo.db ~/github/yanten-api/data/database/main.db

# 2. 或从 OSS 恢复（如果有备份）
npm run backup  # 从 OSS 拉取
```

### 哇哇笑数据

**已迁移：**
- ✅ 102条笑话数据 → `data/database/wawaxiao-jokes.json`
- ✅ 用户行为数据 → `data/database/wawaxiao-actions.json`

---

## 🔧 配置阿里云 OSS（可选）

### 1. 创建 OSS Bucket

登录阿里云 OSS 控制台：
https://oss.console.aliyun.com

创建 Bucket：
- 名称：`yanten-api-backup`
- 区域：华东1（杭州）
- 存储类型：标准存储
- 读写权限：私有

### 2. 获取 AccessKey

阿里云控制台 → AccessKey 管理：
- 创建 AccessKey
- 复制 ID 和 Secret

### 3. 配置 .env

```bash
OSS_ACCESS_KEY_ID=LTAI-xxx
OSS_ACCESS_KEY_SECRET=xxx
OSS_BUCKET=yanten-api-backup
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
```

### 4. 安装 OSS SDK

```bash
npm install ali-oss
```

### 5. 设置定时备份

```bash
# 添加到 crontab
crontab -e

# 每小时备份一次
0 * * * * cd ~/github/yanten-api && npm run backup >> ~/logs/backup.log 2>&1
```

---

## 🌐 Nginx 配置（如果需要）

```nginx
# /etc/nginx/sites-available/yanten-api.conf
server {
    listen 80;
    server_name api.yanten.top;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📱 小程序更新

**无需改动！**

API 地址保持不变：
- 家庭备忘录：`https://api.yanten.top/api/family/*`
- 哇哇笑：`https://api.yanten.top/api/wawaxiao/*`

---

## 🔄 服务器迁移（未来）

如果需要迁移到新服务器：

```bash
# 1. 新服务器安装 Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 2. 克隆代码
git clone https://github.com/foleydang/yanten-api.git

# 3. 配置环境变量
cp .env.example .env
nano .env

# 4. 从 OSS 恢复数据（如果有备份）
npm run backup  # 拉取最新备份

# 5. 启动服务
npm install
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## ✅ 迁移完成检查清单

- [ ] GitHub 仓库创建并推送
- [ ] 服务器克隆代码并安装依赖
- [ ] 配置 .env 环境变量
- [ ] 数据库初始化成功
- [ ] PM2 服务启动成功
- [ ] API 健康检查正常
- [ ] 小程序功能正常
- [ ] （可选）OSS 备份配置
- [ ] （可选）定时备份设置

---

## 🆘 问题排查

### 端口冲突
```bash
# 查看 3000 端口占用
lsof -i:3000
# 杀掉进程
kill -9 <PID>
```

### 数据库错误
```bash
# 重新初始化
rm data/database/main.db
npm run init-db
```

### PM2 问题
```bash
# 查看日志
pm2 logs yanten-api

# 重启服务
pm2 restart yanten-api
```

---

## 📞 支持

遇到问题？
- 查看日志：`pm2 logs yanten-api`
- 检查数据库：`npm run init-db` 会显示统计
- 测试 API：`curl http://localhost:3000/api/health`

---

**迁移完成后，原来的 `family-memo/server` 目录可以删除或保留作为备份。**

建议：保留 1 周，确认新服务稳定后再删除。