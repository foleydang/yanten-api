#!/bin/bash
# 安全启动脚本

PORT=3000
APP_NAME="yanten-api"

echo "========================================"
echo "启动 $APP_NAME"
echo "========================================"

# 检查并清理端口
PID=$(lsof -t -i:$PORT 2>/dev/null)
if [ -n "$PID" ]; then
    echo "端口 $PORT 被占用 (PID: $PID)，正在清理..."
    
    # 删除PM2进程
    pm2 delete $APP_NAME 2>/dev/null
    sleep 1
    
    # 杀掉占用进程
    kill -9 $PID 2>/dev/null
    sleep 2
    
    # 再次检查
    PID=$(lsof -t -i:$PORT 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "❌ 端口仍被占用 (PID: $PID)"
        echo "尝试再次杀掉..."
        kill -9 $PID
        sleep 1
    fi
    
    # 最终检查
    if lsof -i :$PORT > /dev/null 2>&1; then
        echo "❌ 无法清理端口，请手动处理"
        lsof -i :$PORT
        exit 1
    fi
    
    echo "✅ 端口已清理"
fi

echo "✅ 端口可用，启动服务..."

# 启动PM2
cd /root/github/yanten-api
pm2 start ecosystem.config.js
sleep 5

# 保存配置
pm2 save

pm2 list
echo ""
echo "✅ 启动完成"
