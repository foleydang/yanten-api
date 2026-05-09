#!/usr/bin/env python3
"""
哇哇笑笑话爬虫 - 纯网络爬取
不使用任何兜底，只从网络获取真实笑话
"""

import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime, date
import random
import time
import re
import os

JOKES_FILE = '/root/github/yanten-api/data/database/wawaxiao-jokes.json'
DAILY_LIMIT = 50

# 创建session保持连接
session = requests.Session()

# Headers池 - 模拟不同浏览器
HEADERS_POOL = [
    {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
    },
    {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    },
    {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
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
    backup_dir = '/root/logs/jokes-backup'
    os.makedirs(backup_dir, exist_ok=True)
    backup_file = f"{backup_dir}/jokes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)
    with open(JOKES_FILE, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)

BAD_WORDS = ['傻逼', '操', '他妈', '性', '裸', '胸', '强奸', '嫖', '妓']

def is_appropriate(content):
    return not any(w in content for w in BAD_WORDS)

def clean_text(text):
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ===== 爬取来源 =====

def crawl_xiaohua168():
    """笑话168 - 搞笑段子"""
    jokes = []
    urls = [
        'http://www.xiaohua168.com/',
        'http://www.xiaohua168.com/duanzi/',
        'http://www.xiaohua168.com/gaoxiao/',
    ]
    try:
        print('爬取笑话168...')
        headers = get_headers()
        for url in urls:
            try:
                resp = session.get(url, headers=headers, timeout=15)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.content, 'lxml')
                    items = soup.find_all('div', class_='item') or soup.find_all('li', class_='list-item')
                    for item in items[:15]:
                        try:
                            title_elem = item.find('a') or item.find('h3')
                            content_elem = item.find('p') or item.find('div', class_='content')
                            if content_elem:
                                content = clean_text(content_elem.get_text())
                                title = clean_text(title_elem.get_text()) if title_elem else content[:30]
                                if content and len(content) > 30 and is_appropriate(content):
                                    jokes.append({
                                        'category': '笑话168',
                                        'title': title[:50],
                                        'content': content,
                                    })
                        except:
                            continue
                time.sleep(1)
            except:
                continue
        print(f'笑话168: {len(jokes)} 条')
    except Exception as e:
        print(f'笑话168失败: {e}')
    return jokes

def crawl_jokeji_cn():
    """笑话集"""
    jokes = []
    try:
        print('爬取笑话集...')
        headers = get_headers()
        url = 'https://www.jokeji.cn/'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            # 找笑话列表
            links = soup.find_all('a', href=True)
            for link in links[:20]:
                href = link.get('href')
                if href and href.startswith('/') and not href.startswith('//'):
                    title = clean_text(link.get_text())
                    if len(title) > 5 and len(title) < 50:
                        try:
                            detail_url = f'https://www.jokeji.cn{href}'
                            detail_resp = session.get(detail_url, headers=get_headers(), timeout=10)
                            if detail_resp.status_code == 200:
                                detail_soup = BeautifulSoup(detail_resp.content, 'lxml')
                                content_div = detail_soup.find('div', class_='content') or detail_soup.find('p')
                                if content_div:
                                    content = clean_text(content_div.get_text())
                                    if content and len(content) > 50 and is_appropriate(content):
                                        jokes.append({
                                            'category': '笑话集',
                                            'title': title,
                                            'content': content,
                                        })
                            time.sleep(0.5)
                        except:
                            continue
        print(f'笑话集: {len(jokes)} 条')
    except Exception as e:
        print(f'笑话集失败: {e}')
    return jokes

def crawl_haha365():
    """哈哈365"""
    jokes = []
    try:
        print('爬取哈哈365...')
        headers = get_headers()
        url = 'https://www.haha365.com/'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('article') or soup.find_all('div', class_='post')
            for item in items[:15]:
                try:
                    title_elem = item.find('h2') or item.find('a')
                    content_elem = item.find('div', class_='content') or item.find('p')
                    if content_elem:
                        content = clean_text(content_elem.get_text())
                        title = clean_text(title_elem.get_text()) if title_elem else content[:30]
                        if content and len(content) > 30 and is_appropriate(content):
                            jokes.append({
                                'category': '哈哈365',
                                'title': title[:50],
                                'content': content,
                            })
                except:
                    continue
        print(f'哈哈365: {len(jokes)} 条')
    except Exception as e:
        print(f'哈哈365失败: {e}')
    return jokes

def crawl_lengxiaohua():
    """冷笑话"""
    jokes = []
    try:
        print('爬取冷笑话...')
        headers = get_headers()
        url = 'http://www.lengxiaohua.com/'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('div', class_='joke-item') or soup.find_all('li')
            for item in items[:15]:
                try:
                    content_elem = item.find('div', class_='content') or item.find('p')
                    if content_elem:
                        content = clean_text(content_elem.get_text())
                        title = content[:30] if len(content) > 30 else content
                        if content and len(content) > 20 and is_appropriate(content):
                            jokes.append({
                                'category': '冷笑话',
                                'title': title,
                                'content': content,
                            })
                except:
                    continue
        print(f'冷笑话: {len(jokes)} 条')
    except Exception as e:
        print(f'冷笑话失败: {e}')
    return jokes

def crawl_gaoxiaoword():
    """搞笑文字网"""
    jokes = []
    try:
        print('爬取搞笑文字网...')
        headers = get_headers()
        url = 'http://www.gaoxiaoword.com/'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('div', class_='content') or soup.find_all('p')
            for item in items[:15]:
                try:
                    content = clean_text(item.get_text())
                    if content and len(content) > 30 and is_appropriate(content):
                        title = content[:40] if len(content) > 40 else content
                        jokes.append({
                            'category': '搞笑文字',
                            'title': title,
                            'content': content,
                        })
                except:
                    continue
        print(f'搞笑文字: {len(jokes)} 条')
    except Exception as e:
        print(f'搞笑文字失败: {e}')
    return jokes

def crawl_youmojoke():
    """幽默笑话网"""
    jokes = []
    try:
        print('爬取幽默笑话网...')
        headers = get_headers()
        url = 'http://www.youmojoke.com/'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('div', class_='joke') or soup.find_all('article')
            for item in items[:15]:
                try:
                    title_elem = item.find('h3') or item.find('a')
                    content_elem = item.find('div', class_='text') or item.find('p')
                    if content_elem:
                        content = clean_text(content_elem.get_text())
                        title = clean_text(title_elem.get_text()) if title_elem else content[:30]
                        if content and len(content) > 30 and is_appropriate(content):
                            jokes.append({
                                'category': '幽默笑话',
                                'title': title[:50],
                                'content': content,
                            })
                except:
                    continue
        print(f'幽默笑话: {len(jokes)} 条')
    except Exception as e:
        print(f'幽默笑话失败: {e}')
    return jokes

def crawl_budejie():
    """百思不得姐"""
    jokes = []
    try:
        print('爬取百思不得姐...')
        headers = get_headers()
        url = 'http://www.budejie.com/'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('div', class_='joke-list-item') or soup.find_all('li')
            for item in items[:15]:
                try:
                    content_elem = item.find('div', class_='content') or item.find('p')
                    if content_elem:
                        content = clean_text(content_elem.get_text())
                        if content and len(content) > 30 and is_appropriate(content):
                            title = content[:40] if len(content) > 40 else content
                            jokes.append({
                                'category': '百思不得姐',
                                'title': title,
                                'content': content,
                            })
                except:
                    continue
        print(f'百思不得姐: {len(jokes)} 条')
    except Exception as e:
        print(f'百思不得姐失败: {e}')
    return jokes

def crawl_duanziwang():
    """段子网"""
    jokes = []
    try:
        print('爬取段子网...')
        headers = get_headers()
        url = 'http://www.duanziwang.com/'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('article') or soup.find_all('div', class_='post')
            for item in items[:15]:
                try:
                    content_elem = item.find('div', class_='content') or item.find('p')
                    if content_elem:
                        content = clean_text(content_elem.get_text())
                        if content and len(content) > 30 and is_appropriate(content):
                            title = content[:40] if len(content) > 40 else content
                            jokes.append({
                                'category': '段子网',
                                'title': title,
                                'content': content,
                            })
                except:
                    continue
        print(f'段子网: {len(jokes)} 条')
    except Exception as e:
        print(f'段子网失败: {e}')
    return jokes

def crawl_lequwang():
    """乐趣网"""
    jokes = []
    try:
        print('爬取乐趣网...')
        headers = get_headers()
        url = 'http://www.lequwang.com/'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('div', class_='list-item') or soup.find_all('li')
            for item in items[:15]:
                try:
                    title_elem = item.find('a') or item.find('h4')
                    content_elem = item.find('p') or item.find('div', class_='content')
                    if content_elem:
                        content = clean_text(content_elem.get_text())
                        title = clean_text(title_elem.get_text()) if title_elem else content[:30]
                        if content and len(content) > 30 and is_appropriate(content):
                            jokes.append({
                                'category': '乐趣网',
                                'title': title[:50],
                                'content': content,
                            })
                except:
                    continue
        print(f'乐趣网: {len(jokes)} 条')
    except Exception as e:
        print(f'乐趣网失败: {e}')
    return jokes

def crawl_tieba_ruozhiba():
    """贴吧弱智吧 - RSS方式"""
    jokes = []
    try:
        print('爬取弱智吧RSS...')
        headers = get_headers()
        # 使用贴吧RSS
        url = 'https://tieba.baidu.com/rss/fid/1834784'
        resp = session.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, 'lxml')
            items = soup.find_all('item')
            for item in items[:20]:
                try:
                    title_elem = item.find('title')
                    desc_elem = item.find('description')
                    if title_elem:
                        title = clean_text(title_elem.get_text())
                        content = clean_text(desc_elem.get_text()) if desc_elem else title
                        if title and len(title) > 5 and is_appropriate(title):
                            jokes.append({
                                'category': '弱智吧',
                                'title': title[:50],
                                'content': content[:200] if content else title,
                            })
                except:
                    continue
        print(f'弱智吧RSS: {len(jokes)} 条')
    except Exception as e:
        print(f'弱智吧RSS失败: {e}')
    return jokes

def crawl_github_jokes():
    """从GitHub获取开源笑话库"""
    jokes = []
    try:
        print('爬取GitHub笑话库...')
        headers = get_headers()
        # 尝试一些GitHub上的笑话库raw文件
        urls = [
            'https://raw.githubusercontent.com/ffffee/jokes/master/jokes.json',
            'https://raw.githubusercontent.com/sunzhuo/joke/master/jokes.txt',
        ]
        for url in urls:
            try:
                resp = session.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    content = resp.text
                    # 尝试解析JSON
                    try:
                        data = json.loads(content)
                        if isinstance(data, list):
                            for item in data[:20]:
                                if isinstance(item, dict):
                                    joke_content = item.get('content') or item.get('joke') or item.get('text')
                                    if joke_content and is_appropriate(joke_content):
                                        jokes.append({
                                            'category': 'GitHub',
                                            'title': joke_content[:40],
                                            'content': joke_content,
                                        })
                    except:
                        # 按行分割
                        lines = content.split('\n')
                        for line in lines[:20]:
                            line = clean_text(line)
                            if line and len(line) > 30 and is_appropriate(line):
                                jokes.append({
                                    'category': 'GitHub',
                                    'title': line[:40],
                                    'content': line,
                                })
            except:
                continue
        print(f'GitHub笑话: {len(jokes)} 条')
    except Exception as e:
        print(f'GitHub笑话失败: {e}')
    return jokes

def crawl_dadjoke_en():
    """英文笑话翻译"""
    jokes = []
    try:
        print('爬取英文笑话...')
        headers = {'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'}
        url = 'https://icanhazdadjoke.com/'
        for i in range(15):
            try:
                resp = session.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    joke_en = data.get('joke', '')
                    if joke_en and len(joke_en) > 10:
                        # 使用翻译API
                        joke_cn = translate_text(joke_en)
                        jokes.append({
                            'category': '翻译笑话',
                            'title': joke_cn[:40],
                            'content': joke_cn,
                        })
                time.sleep(0.3)
            except:
                continue
        print(f'英文笑话: {len(jokes)} 条')
    except Exception as e:
        print(f'英文笑话失败: {e}')
    return jokes

def translate_text(text):
    """使用翻译API"""
    try:
        url = f'https://api.mymemory.translated.net/get?q={requests.utils.quote(text)}&langpair=en|zh'
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            return data.get('responseData', {}).get('translatedText', text)
    except:
        pass
    return text

def main():
    print('=' * 60)
    print(f'哇哇笑笑话爬虫 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    jokes = load_jokes()
    existing_titles = set(j['title'] for j in jokes)
    print(f'当前笑话数: {len(jokes)}')
    print(f'每日目标: {DAILY_LIMIT}')
    
    # ===== 爬取所有来源 =====
    print('\n开始爬取...')
    all_new = []
    
    # 中文笑话网站
    all_new.extend(crawl_xiaohua168())
    all_new.extend(crawl_jokeji_cn())
    all_new.extend(crawl_haha365())
    all_new.extend(crawl_lengxiaohua())
    all_new.extend(crawl_gaoxiaoword())
    all_new.extend(crawl_youmojoke())
    all_new.extend(crawl_budejie())
    all_new.extend(crawl_duanziwang())
    all_new.extend(crawl_lequwang())
    
    # RSS
    all_new.extend(crawl_tieba_ruozhiba())
    
    # GitHub
    all_new.extend(crawl_github_jokes())
    
    # 英文笑话翻译
    all_new.extend(crawl_dadjoke_en())
    
    print(f'\n总爬取: {len(all_new)} 条')
    
    # ===== 去重 =====
    print('去重...')
    unique = []
    for j in all_new:
        if j['title'] not in existing_titles and len(j['content']) >= 20:
            unique.append(j)
            existing_titles.add(j['title'])
    
    print(f'有效: {len(unique)} 条')
    
    if len(unique) > DAILY_LIMIT:
        selected = random.sample(unique, DAILY_LIMIT)
    else:
        selected = unique
    
    if not selected:
        print('\n❌ 今天没爬到笑话，明天继续')
        return
    
    # ===== 保存 =====
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
    
    print('\n预览:')
    for j in selected[:5]:
        print(f'  [{j["category"]}] {j["title"]}')

if __name__ == '__main__':
    main()
