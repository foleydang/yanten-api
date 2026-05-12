#!/usr/bin/env python3
"""
ALAPI笑话爬虫 - 每天自动更新笑话
定时: 每天6:00运行
去重: 用content前30字做key
"""

import requests
import sqlite3
import re
import random
from datetime import date
import sys

DB_FILE = '/root/github/yanten-api/data/database/main.db'
API_URL = 'https://v3.alapi.cn/api/joke'
TOKEN = '2emlih5umpvcpwkownzbgbo6avhqiz'

def main():
    print("=" * 40)
    print(f"ALAPI笑话爬虫 - {date.today()}")
    sys.stdout.flush()
    
    # 获取笑话
    try:
        url = f'{API_URL}?token={TOKEN}&num=20'
        resp = requests.get(url, timeout=30)
        data = resp.json()
        
        jokes_data = data.get('data', [])
        print(f'获取: {len(jokes_data)}条')
        sys.stdout.flush()
        
        if not jokes_data:
            print('API返回空数据')
            return
        
    except Exception as e:
        print(f'API请求失败: {e}')
        return
    
    # 处理笑话
    valid_jokes = []
    for item in jokes_data:
        content = item.get('content', '').strip()
        content = re.sub(r'\s+', ' ', content)
        
        # 检查长度
        if len(content) < 20 or len(content) > 500:
            continue
        
        # 检查结尾完整性
        has_end = content.endswith('。') or content.endswith('！') or content.endswith('？') or content.endswith('~')
        if not has_end:
            continue
        
        # 检查非笑话内容
        if any(kw in content[:50] for kw in ['语录', '签名', '诗词', '名言']):
            continue
        
        # 分类
        category = '搞笑'
        if any(w in content for w in ['老板', '公司', '加班', '面试', '程序员']):
            category = '职场'
        elif any(w in content for w in ['老师', '学校', '考试', '上课', '同学']):
            category = '校园'
        elif any(w in content for w in ['老婆', '老公', '孩子', '爸妈', '结婚']):
            category = '家庭'
        elif any(w in content for w in ['女朋友', '男朋友', '约会', '相亲']):
            category = '恋爱'
        elif any(w in content for w in ['外卖', '快递', '打车', '理发', '减肥']):
            category = '生活'
        
        # 标题
        title = content.split('。')[0][:15].strip()
        if len(title) < 3:
            title = '笑话一则'
        
        valid_jokes.append({
            'title': title,
            'content': content,
            'category': category
        })
    
    print(f'有效: {len(valid_jokes)}条')
    sys.stdout.flush()
    
    # 保存到数据库
    if not valid_jokes:
        print('无有效笑话')
        return
    
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        today = date.today().strftime('%Y-%m-%d')
        now_ts = int(date.today().strftime('%s')) * 1000
        
        # 去重：用content前30字做key
        cursor.execute('SELECT content FROM jokes WHERE status="approved"')
        existing = {row[0][:30]: True for row in cursor.fetchall()}
        
        added = 0
        for j in valid_jokes:
            key = j['content'][:30]
            if key in existing:
                continue
            
            likes = random.randint(5, 25)
            
            cursor.execute('''
                INSERT INTO jokes (category, title, content, likes, neutrals, dislikes, shares, is_hot, status, date, created_at)
                VALUES (?, ?, ?, ?, 0, 0, 0, 0, 'approved', ?, ?)
            ''', (j['category'], j['title'], j['content'], likes, today, now_ts))
            added += 1
        
        conn.commit()
        
        cursor.execute('SELECT COUNT(*) FROM jokes WHERE status="approved"')
        total = cursor.fetchone()[0]
        conn.close()
        
        print(f'新增: {added}条, 总数: {total}条')
        sys.stdout.flush()
        
        for j in valid_jokes[:3]:
            print(f'  [{j["category"]}] {j["title"]}')
            sys.stdout.flush()
        
    except Exception as e:
        print(f'数据库保存失败: {e}')
        return
    
    print("完成")

if __name__ == '__main__':
    main()
