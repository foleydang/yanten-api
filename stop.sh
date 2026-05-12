#!/bin/bash
# 安全停止脚本

APP_NAME="yanten-api"
PORT=3000

echo "停止 $APP_NAME..."

# 先停止PM2
pm2 stop $APP_NAME
pm2 save

# 确认端口释放
sleep 2
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "端口仍被占用，强制清理..."
    fuser -k $PORT/tcp
fi

echo "✅ 服务已停止"
