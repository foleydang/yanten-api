# Yanten API

统一后端服务，支持多个小程序和 Web 项目。

## 服务项目

| 项目 | 前端仓库 | API 路径 | 说明 |
|------|----------|----------|------|
| 家庭备忘录 | family-memo | /api/family/* | 家庭协作工具 |
| 哇哇笑 | wawaxiao | /api/wawaxiao/* | 笑话小程序 |

## 开发

```bash
npm install
npm run dev
npm run init-db
```

## 部署

```bash
pm2 start ecosystem.config.js
```
