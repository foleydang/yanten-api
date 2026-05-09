#!/usr/bin/env python3
"""
哇哇笑笑话爬虫 - 写入SQLite数据库
使用 sqlite3 命令行工具，确保数据持久化
"""

import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime, date
import random
import time
import re
import os
import urllib.parse
import sqlite3

DB_FILE = '/root/github/yanten-api/data/database/main.db'
DAILY_LIMIT = 50

session = requests.Session()

HEADERS_POOL = [
    {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
     'Accept-Language': 'zh-CN,zh;q=0.9',
    },
]

def get_headers():
    return random.choice(HEADERS_POOL)

BAD_WORDS = ['傻逼', '操', '他妈', '性', '裸', '胸', '强奸']

def is_ok(content):
    return not any(w in content for w in BAD_WORDS)

def clean(t):
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def translate(text):
    try:
        url = f'https://api.mymemory.translated.net/get?q={urllib.parse.quote(text)}&langpair=en|zh'
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            return resp.json().get('responseData', {}).get('translatedText', text)
    except:
        pass
    return text

def get_existing_titles():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT title FROM jokes')
    titles = set(row[0] for row in cursor.fetchall())
    conn.close()
    return titles

def insert_jokes(jokes):
    """插入笑话到数据库"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    today = date.today().strftime('%Y-%m-%d')
    now_ts = int(datetime.now().timestamp() * 1000)
    
    for j in jokes:
        cursor.execute('''
            INSERT INTO jokes (category, title, content, likes, neutrals, dislikes, shares, is_hot, status, date, created_at)
            VALUES (?, ?, ?, 0, 0, 0, 0, 0, "approved", ?, ?)
        ''', (j['category'], j['title'], j['content'], today, now_ts))
    
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM jokes WHERE status = "approved"')
    total = cursor.fetchone()[0]
    conn.close()
    return total

def crawl_dadjoke():
    jokes = []
    print('爬取dadjoke...')
    try:
        for i in range(15):
            resp = requests.get('https://icanhazdadjoke.com/',
                headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'},
                timeout=10)
            if resp.status_code == 200:
                joke = resp.json().get('joke', '')
                if joke:
                    cn = translate(joke)
                    jokes.append({'category': '搞笑', 'title': cn[:40], 'content': cn})
            time.sleep(0.3)
    except Exception as e:
        print(f'dadjoke失败: {e}')
    print(f'dadjoke: {len(jokes)} 条')
    return jokes

def crawl_bilibili_hot():
    jokes = []
    print('爬取B站热门...')
    try:
        url = 'https://api.bilibili.com/x/web-interface/popular'
        resp = session.get(url, headers=get_headers(), timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            items = data.get('data', {}).get('list', [])[:10]
            for item in items:
                title = item.get('title', '')
                desc = item.get('desc', '')
                if title and is_ok(title):
                    jokes.append({'category': 'B站热门', 'title': title[:40], 'content': desc[:100] if desc else title})
    except Exception as e:
        print(f'B站热门失败: {e}')
    print(f'B站热门: {len(jokes)} 条')
    return jokes

def main():
    print('=' * 60)
    print(f'哇哇笑笑话爬虫 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    existing_titles = get_existing_titles()
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM jokes WHERE status = "approved"')
    current_count = cursor.fetchone()[0]
    conn.close()
    
    print(f'当前笑话数: {current_count}')
    print(f'每日目标: {DAILY_LIMIT}')
    
    print('\n开始爬取...')
    all_new = []
    
    all_new.extend(crawl_bilibili_hot())
    all_new.extend(crawl_dadjoke())
    
    print(f'\n总爬取: {len(all_new)} 条')
    
    # 去重过滤
    unique = []
    for j in all_new:
        if j['title'] not in existing_titles and len(j['content']) >= 15 and is_ok(j['content']):
            unique.append(j)
            existing_titles.add(j['title'])
    
    print(f'有效: {len(unique)} 条')
    
    if not unique:
        print('\n❌ 今天没爬到新笑话')
        return
    
    selected = random.sample(unique, min(DAILY_LIMIT, len(unique)))
    
    # 写入数据库
    total = insert_jokes(selected)
    
    print(f'\n✅ 新增: {len(selected)} 条')
    sources = {}
    for j in selected:
        sources[j['category']] = sources.get(j['category'], 0) + 1
    for s, c in sources.items():
        print(f'  {s}: {c} 条')
    print(f'总数: {total} 条')
    
    # 重启 API 服务（让 sql.js 重新加载数据库）
    print('\n重启 API 服务...')
    os.system('pm2 restart yanten-api 2>/dev/null || true')

if __name__ == '__main__':
    main()
