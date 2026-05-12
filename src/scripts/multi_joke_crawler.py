#!/usr/bin/env python3
"""
多源笑话爬虫 - 韩韩API + ALAPI + 手动补充
"""

import requests
import sqlite3
import re
import random
from datetime import date
import sys

DB_FILE = '/root/github/yanten-api/data/database/main.db'

def classify(text):
    """分类"""
    if any(w in text for w in ['老板', '公司', '加班', '面试', '程序员']):
        return '职场'
    elif any(w in text for w in ['老师', '学校', '考试', '上课', '同学']):
        return '校园'
    elif any(w in text for w in ['老婆', '老公', '孩子', '爸妈', '结婚']):
        return '家庭'
    elif any(w in text for w in ['女朋友', '男朋友', '约会', '相亲']):
        return '恋爱'
    elif any(w in text for w in ['外卖', '快递', '打车', '理发', '减肥']):
        return '生活'
    return '搞笑'

def is_valid(content):
    """检查有效性"""
    content = content.strip()
    
    if len(content) < 20 or len(content) > 500:
        return False
    
    non_joke = ['语录', '签名', '诗词', '名言', '广告']
    if any(kw in content[:50] for kw in non_joke):
        return False
    
    has_end = content.endswith('。') or content.endswith('！') or content.endswith('？')
    return has_end

def fetch_from_vvhan(times=10):
    """韩韩API - 每次返回不同随机笑话"""
    jokes = []
    
    print(f'韩韩API获取 {times} 条...')
    sys.stdout.flush()
    
    for i in range(times):
        try:
            resp = requests.get('https://api.vvhan.com/api/joke', timeout=10)
            content = resp.text.strip()
            
            if is_valid(content):
                title = content.split('。')[0][:15].strip()
                if len(title) < 3:
                    title = '笑话一则'
                
                jokes.append({
                    'title': title,
                    'content': content,
                    'category': classify(content)
                })
            
            # 每次API返回不同的笑话
            import time
            time.sleep(0.5)
            
        except Exception as e:
            print(f'  第{i+1}次失败: {e}')
            sys.stdout.flush()
    
    print(f'  有效: {len(jokes)}条')
    sys.stdout.flush()
    return jokes

def save_jokes(jokes):
    """保存去重"""
    if not jokes:
        return 0, 0
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    today = date.today().strftime('%Y-%m-%d')
    now_ts = int(date.today().strftime('%s')) * 1000
    
    # 去重
    cursor.execute('SELECT content FROM jokes WHERE status="approved"')
    existing = {row[0][:30]: True for row in cursor.fetchall()}
    
    added = 0
    for j in jokes:
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
    
    return added, total

def main():
    print("=" * 40)
    print(f"多源笑话爬虫 - {date.today()}")
    sys.stdout.flush()
    
    # 韩韩API - 每次返回不同笑话
    jokes = fetch_from_vvhan(15)
    
    if jokes:
        added, total = save_jokes(jokes)
        print(f'新增: {added}条, 总数: {total}条')
        sys.stdout.flush()
        
        for j in jokes[:5]:
            print(f'  [{j["category"]}] {j["title"]}')
            sys.stdout.flush()
    
    print("完成")

if __name__ == '__main__':
    main()
