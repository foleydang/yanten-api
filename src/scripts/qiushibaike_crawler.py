#!/usr/bin/env python3
"""糗事百科爬虫 - 筛选高质量笑话（好笑>=1000，评论>=50）"""

import requests
import sqlite3
import time
import re
from datetime import datetime, date
from bs4 import BeautifulSoup

DB_FILE = '/root/github/yanten-api/data/database/main.db'
BASE_URL = 'https://www.qiushibaike.com/text/'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

def classify_category(content):
    """智能分类"""
    keywords = {
        '职场': ['老板', '同事', '加班', '工资', '面试', '上班'],
        '校园': ['老师', '学生', '考试', '作业', '学校'],
        '家庭': ['爸妈', '老婆', '老公', '孩子', '家里'],
        '恋爱': ['女朋友', '男朋友', '约会', '分手', '相亲'],
    }
    for cat, words in keywords.items():
        if any(w in content for w in words):
            return cat
    return '生活'

def crawl_page(page=1):
    """爬取单页"""
    url = f"{BASE_URL}page/{page}/" if page > 1 else BASE_URL
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, 'html.parser')
        articles = soup.find_all('div', class_='article')
        
        jokes = []
        for art in articles:
            content = art.find('div', class_='content')
            stats = art.find('div', class_='stats')
            if not content or not stats:
                continue
            
            text = content.get_text(strip=True)
            stats_text = stats.get_text(strip=True)
            numbers = re.findall(r'\d+', stats_text)
            
            if len(numbers) >= 2:
                likes, comments = int(numbers[0]), int(numbers[1])
                if likes >= 1000 and comments >= 50 and 50 < len(text) < 500:
                    jokes.append({
                        'title': text[:15] + '...',
                        'content': text,
                        'likes': likes,
                        'category': classify_category(text)
                    })
        return jokes
    except Exception as e:
        print(f"错误: {e}")
        return []

def save_to_db(jokes):
    """保存到数据库"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    today = date.today().strftime('%Y-%m-%d')
    now_ts = int(datetime.now().timestamp() * 1000)
    
    added = 0
    for joke in jokes:
        cursor.execute('SELECT id FROM jokes WHERE title LIKE ?', (joke['title'][:10] + '%',))
        if cursor.fetchone():
            continue
        
        cursor.execute('''
            INSERT INTO jokes (category, title, content, likes, status, date, created_at)
            VALUES (?, ?, ?, ?, "approved", ?, ?)
        ''', (joke['category'], joke['title'], joke['content'], joke['likes'], today, now_ts))
        added += 1
    
    conn.commit()
    conn.close()
    return added

if __name__ == '__main__':
    print("爬取糗事百科...")
    total = 0
    for page in range(1, 6):
        print(f"第{page}页...")
        jokes = crawl_page(page)
        if jokes:
            added = save_to_db(jokes)
            total += added
            print(f"  找到{len(jokes)}条，新增{added}条")
        time.sleep(2)
    print(f"\n✅ 完成！共新增{total}条")
