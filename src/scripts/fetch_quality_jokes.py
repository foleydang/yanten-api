#!/usr/bin/env python3
"""抓取高质量完整笑话"""

import requests
import sqlite3
import time
import random
import re
from datetime import datetime, date

DB_FILE = '/root/github/yanten-api/data/database/main.db'

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

def classify(text):
    """智能分类"""
    text_lower = text.lower()
    if any(w in text for w in ['老板', '公司', '工作', '加班', '同事', '经理', '面试', '工资', '程序员']):
        return '职场'
    elif any(w in text for w in ['老师', '学校', '同学', '考试', '学生', '上课', '作业', '宿舍']):
        return '校园'
    elif any(w in text for w in ['老婆', '老公', '媳妇', '孩子', '儿子', '女儿', '奶奶', '爷爷', '爸妈', '结婚']):
        return '家庭'
    elif any(w in text for w in ['女朋友', '男朋友', '女友', '男友', '相亲', '约会', '表白']):
        return '恋爱'
    elif any(w in text for w in ['外卖', '快递', '医院', '医生', '理发', '打车', '超市', '吃饭', '购物']):
        return '生活'
    return '搞笑'

def fetch_qiushibaike(pages=10):
    """从糗事百科抓取"""
    jokes = []
    
    for page in range(1, pages + 1):
        url = f'https://www.qiushibaike.com/text/page/{page}/'
        try:
            print(f"抓取糗事百科第 {page} 页...")
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code != 200:
                continue
            
            # 提取笑话内容
            pattern = r'<div class="content">(.*?)</div>'
            matches = re.findall(pattern, resp.text, re.DOTALL)
            
            for content in matches:
                # 清理HTML
                content = re.sub(r'<[^>]+>', '', content)
                content = re.sub(r'&nbsp;', ' ', content)
                content = content.strip()
                
                # 过滤条件：完整笑话
                if len(content) < 50 or len(content) > 300:
                    continue
                if '原文' in content or 'http' in content:
                    continue
                
                # 生成标题（取前15字）
                title = content.split('\n')[0][:15]
                if len(title) < 5:
                    continue
                
                jokes.append({
                    'title': title,
                    'content': content,
                    'category': classify(content),
                    'likes': random.randint(5, 30)
                })
            
            print(f"  有效: {len(matches)}")
            time.sleep(2)
            
        except Exception as e:
            print(f"失败: {e}")
    
    return jokes

def fetch_joke4u(pages=5):
    """从笑话网抓取"""
    jokes = []
    
    for page in range(1, pages + 1):
        try:
            url = f'https://www.joke4u.com/joke/page_{page}.html' if page > 1 else 'https://www.joke4u.com/'
            print(f"抓取笑话网第 {page} 页...")
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code != 200:
                continue
            
            # 提取笑话
            pattern = r'<div class="joke-content">(.*?)</div>'
            matches = re.findall(pattern, resp.text, re.DOTALL)
            
            for content in matches:
                content = re.sub(r'<[^>]+>', '', content)
                content = re.sub(r'&nbsp;', ' ', content)
                content = content.strip()
                
                if len(content) < 50 or len(content) > 400:
                    continue
                
                title = content[:20].split('\n')[0]
                
                jokes.append({
                    'title': title[:15],
                    'content': content,
                    'category': classify(content),
                    'likes': random.randint(3, 25)
                })
            
            print(f"  有效: {len(matches)}")
            time.sleep(2)
            
        except Exception as e:
            print(f"失败: {e}")
    
    return jokes

def save_to_db(jokes):
    """保存到数据库"""
    if not jokes:
        return 0
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    today = date.today().strftime('%Y-%m-%d')
    now_ts = int(datetime.now().timestamp() * 1000)
    
    # 去重
    cursor.execute('SELECT content FROM jokes')
    existing = set(row[0][:50] for row in cursor.fetchall())
    
    added = 0
    for j in jokes:
        key = j['content'][:50]
        if key in existing:
            continue
        
        cursor.execute('''
            INSERT INTO jokes (category, title, content, likes, neutrals, dislikes, shares, is_hot, status, date, created_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, 0, 'approved', ?, ?)
        ''', (j['category'], j['title'], j['content'], j['likes'], today, now_ts))
        added += 1
        existing.add(key)
    
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM jokes WHERE status="approved"')
    total = cursor.fetchone()[0]
    conn.close()
    
    return added, total

def main():
    print("=" * 50)
    print("开始抓取高质量笑话")
    print("=" * 50)
    
    jokes = []
    jokes.extend(fetch_qiushibaike(8))
    jokes.extend(fetch_joke4u(5))
    
    print(f"\n总共抓取: {len(jokes)} 条")
    
    if jokes:
        added, total = save_to_db(jokes)
        print(f"新增: {added} 条, 总数: {total}")
    
    print("完成!")

if __name__ == '__main__':
    main()
