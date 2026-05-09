#!/usr/bin/env python3
"""
哇哇笑笑话爬虫 - 纯网络爬取版本
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

JOKES_FILE = '/root/github/yanten-api/data/database/wawaxiao-jokes.json'
DAILY_LIMIT = 50

session = requests.Session()

HEADERS_POOL = [
    {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
     'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
     'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    },
]

def get_headers():
    return random.choice(HEADERS_POOL)

def load_jokes():
    try:
        with open(JOKES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_jokes(jokes):
    os.makedirs('/root/logs/jokes-backup', exist_ok=True)
    backup = f"/root/logs/jokes-backup/jokes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)
    with open(JOKES_FILE, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)

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

def crawl_dadjoke():
    """icanhazdadjoke API - 程序员/英文笑话统一用"搞笑"分类"""
    jokes = []
    try:
        print('爬取dadjoke...')
        for i in range(20):
            resp = requests.get('https://icanhazdadjoke.com/', 
                headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'},
                timeout=10)
            if resp.status_code == 200:
                joke = resp.json().get('joke', '')
                if joke:
                    cn = translate(joke)
                    jokes.append({'category': '搞笑', 'title': cn[:40], 'content': cn})
            time.sleep(0.2)
        print(f'dadjoke: {len(jokes)} 条')
    except Exception as e:
        print(f'dadjoke失败: {e}')
    return jokes

def crawl_netfunny():
    """netfunny.com 英文笑话"""
    jokes = []
    try:
        print('爬取netfunny...')
        url = 'https://www.netfunny.com/rhf/current.html'
        resp = session.get(url, headers=get_headers(), timeout=20)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('li') or soup.find_all('p')
            for item in items[:20]:
                text = clean(item.get_text())
                if text and len(text) > 30:
                    cn = translate(text)
                    jokes.append({'category': '搞笑', 'title': cn[:40], 'content': cn})
        print(f'netfunny: {len(jokes)} 条')
    except Exception as e:
        print(f'netfunny失败: {e}')
    return jokes

def crawl_bilibili_hot():
    """B站热门"""
    jokes = []
    try:
        print('爬取B站热门...')
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
        print(f'B站热门: {len(jokes)} 条')
    except Exception as e:
        print(f'B站热门失败: {e}')
    return jokes

def main():
    print('=' * 60)
    print(f'哇哇笑笑话爬虫 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    jokes = load_jokes()
    existing_titles = set(j['title'] for j in jokes)
    print(f'当前笑话数: {len(jokes)}')
    print(f'每日目标: {DAILY_LIMIT}')
    
    print('\n开始爬取...')
    all_new = []
    
    all_new.extend(crawl_bilibili_hot())
    all_new.extend(crawl_netfunny())
    all_new.extend(crawl_dadjoke())
    
    print(f'\n总爬取: {len(all_new)} 条')
    
    # 去重
    unique = []
    for j in all_new:
        if j['title'] not in existing_titles and len(j['content']) >= 15 and is_ok(j['content']):
            unique.append(j)
            existing_titles.add(j['title'])
    print(f'有效: {len(unique)} 条')
    
    if not unique:
        print('\n❌ 今天没爬到')
        return
    
    selected = random.sample(unique, min(DAILY_LIMIT, len(unique)))
    
    # 保存
    max_id = max([j['id'] for j in jokes]) if jokes else 0
    today = date.today().strftime('%Y-%m-%d')
    
    for j in selected:
        max_id += 1
        j['id'] = max_id
        j['likes'] = 0
        j['neutrals'] = 0
        j['dislikes'] = 0
        j['shares'] = 0
        j['isHot'] = False
        j['status'] = 'approved'
        j['createdAt'] = int(datetime.now().timestamp() * 1000)
        j['date'] = today
    
    jokes.extend(selected)
    save_jokes(jokes)
    
    print(f'\n✅ 新增: {len(selected)} 条')
    sources = {}
    for j in selected:
        sources[j['category']] = sources.get(j['category'], 0) + 1
    for s, c in sources.items():
        print(f'  {s}: {c} 条')
    print(f'总数: {len(jokes)} 条')

if __name__ == '__main__':
    main()
