#!/bin/bash
# 安全重启脚本

~/github/yanten-api/stop.sh
sleep 3
~/github/yanten-api/start.sh
