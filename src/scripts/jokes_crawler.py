#!/usr/bin/env python3
"""
哇哇笑笑话爬虫 - 多来源爬取
使用多种方式获取笑话内容
"""

import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime, date
import random
import time
import re
import os

# 配置
JOKES_FILE = '/root/github/yanten-api/data/database/wawaxiao-jokes.json'
MAX_JOKES = 500
DAILY_LIMIT = 50
BACKUP_DIR = '/root/logs/jokes-backup'

# Headers模拟浏览器
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
}

# 过滤关键词
FILTER_KEYWORDS = ['性', '裸', '胸', '屁股', '强奸', '嫖', '妓', '淫', '毒品', '赌博']
BAD_WORDS = ['傻逼', '操', '他妈', '屁', '屎', '尿', '滚', '贱', '畜生', '装逼']

def load_jokes():
    try:
        with open(JOKES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_jokes(jokes):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup_file = f"{BACKUP_DIR}/jokes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)
    with open(JOKES_FILE, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)

def is_appropriate(content):
    content_lower = content.lower()
    for kw in FILTER_KEYWORDS + BAD_WORDS:
        if kw in content_lower:
            return False
    return True

def clean_content(content):
    content = re.sub(r'<[^>]+>', '', content)
    content = re.sub(r'\s+', ' ', content).strip()
    content = re.sub(r'[^\w\s，。！？、：；"\'（）\n\u4e00-\u9fff]', '', content)
    return content

def crawl_weibo_hot():
    """微博热搜搞笑话题"""
    jokes = []
    try:
        print('正在获取微博热搜...')
        url = 'https://weibo.com/hot/search'
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'lxml')
            items = soup.find_all('tr', class_='TR')
            for item in items[:10]:
                try:
                    title_elem = item.find('a')
                    if title_elem:
                        title = title_elem.get_text().strip()
                        if title and len(title) > 5 and is_appropriate(title):
                            jokes.append({
                                'category': '微博热搜',
                                'title': title[:40],
                                'content': title + ' #搞笑话题',
                            })
                except:
                    continue
        print(f'微博热搜: {len(jokes)} 条')
    except Exception as e:
        print(f'微博热搜失败: {e}')
    return jokes

def crawl_xiaohuaquan():
    """笑话大全网站"""
    jokes = []
    try:
        print('正在爬取笑话大全...')
        url = 'http://www.xiaohuaquan.com/'
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'lxml')
            items = soup.find_all('div', class_='item') or soup.find_all('li')
            for item in items[:20]:
                try:
                    title_elem = item.find('a') or item.find('h3')
                    content_elem = item.find('p') or item.find('div', class_='content')
                    if title_elem and content_elem:
                        title = title_elem.get_text().strip()
                        content = content_elem.get_text().strip()
                        content = clean_content(content)
                        if title and content and len(content) > 30 and is_appropriate(content):
                            jokes.append({
                                'category': '笑话大全',
                                'title': title[:40],
                                'content': content,
                            })
                except:
                    continue
            time.sleep(1)
        print(f'笑话大全: {len(jokes)} 条')
    except Exception as e:
        print(f'笑话大全失败: {e}')
    return jokes

def crawl_joke_api():
    """使用公开笑话API"""
    jokes = []
    try:
        print('正在调用笑话API...')
        # 尝试一些公开的笑话API
        apis = [
            'https://api.vvhan.com/api/joke',  # 韩小韩API
        ]
        for api_url in apis:
            try:
                response = requests.get(api_url, timeout=10)
                if response.status_code == 200:
                    data = response.text.strip()
                    if data and len(data) > 20 and is_appropriate(data):
                        title = data[:30] + '...' if len(data) > 30 else data
                        jokes.append({
                            'category': 'API笑话',
                            'title': title,
                            'content': clean_content(data),
                        })
                time.sleep(0.5)
            except:
                continue
        print(f'API笑话: {len(jokes)} 条')
    except Exception as e:
        print(f'笑话API失败: {e}')
    return jokes

def crawl_baidu_tieba():
    """百度贴吧 - 使用移动版"""
    jokes = []
    try:
        print('正在爬取百度贴吧移动版...')
        # 使用贴吧移动版，更容易访问
        url = 'https://tieba.baidu.com/mo/q----wsl----rs-1-2--/f?kw=%E5BC%B1%E6%99%BA%E5%90%A7'
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'lxml')
            # 找帖子链接
            links = soup.find_all('a', href=True)
            for link in links[:25]:
                href = link.get('href', '')
                if '/p/' in href:
                    title = link.get_text().strip()
                    if title and len(title) > 5 and is_appropriate(title):
                        jokes.append({
                            'category': '弱智吧',
                            'title': title[:50],
                            'content': title,  # 弱智吧很多标题就是笑点
                        })
            time.sleep(0.5)
        print(f'弱智吧: {len(jokes)} 条')
    except Exception as e:
        print(f'贴吧失败: {e}')
    return jokes

def crawl_lequwang():
    """乐趣网笑话"""
    jokes = []
    try:
        print('正在爬取乐趣网...')
        url = 'http://www.lequwang.com/'
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'lxml')
            items = soup.find_all('div', class_='list-item') or soup.find_all('li')
            for item in items[:15]:
                try:
                    title_elem = item.find('a') or item.find('h4')
                    content_elem = item.find('p') or item.find('div', class_='content')
                    if title_elem:
                        title = title_elem.get_text().strip()
                        content = content_elem.get_text().strip() if content_elem else title
                        content = clean_content(content)
                        if title and len(content) > 20 and is_appropriate(content):
                            jokes.append({
                                'category': '乐趣网',
                                'title': title[:40],
                                'content': content,
                            })
                except:
                    continue
        print(f'乐趣网: {len(jokes)} 条')
    except Exception as e:
        print(f'乐趣网失败: {e}')
    return jokes

def is_duplicate(new_joke, existing_jokes):
    new_title = new_joke.get('title', '')
    new_content = new_joke.get('content', '')
    for joke in existing_jokes:
        if new_title == joke.get('title', ''):
            return True
        existing_content = joke.get('content', '')
        if new_content == existing_content:
            return True
        if len(new_content) > 30 and len(existing_content) > 30:
            if new_content[:30] == existing_content[:30]:
                return True
    return False

def main():
    print('=' * 60)
    print(f'哇哇笑笑话爬虫 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    jokes = load_jokes()
    print(f'当前笑话数: {len(jokes)}')
    print(f'上限: {MAX_JOKES}')
    print(f'每日目标: {DAILY_LIMIT}')
    
    print('\n开始爬取...')
    all_new = []
    
    # 多来源爬取
    all_new.extend(crawl_baidu_tieba())
    all_new.extend(crawl_joke_api())
    all_new.extend(crawl_xiaohuaquan())
    all_new.extend(crawl_lequwang())
    all_new.extend(crawl_weibo_hot())
    
    print(f'\n总爬取: {len(all_new)} 条')
    
    # 去重过滤
    print('\n去重过滤...')
    unique = []
    for j in all_new:
        if not is_duplicate(j, jokes) and len(j['content']) >= 20 and is_appropriate(j['content']):
            unique.append(j)
    print(f'有效笑话: {len(unique)} 条')
    
    if len(unique) > DAILY_LIMIT:
        selected = random.sample(unique, DAILY_LIMIT)
    else:
        selected = unique
    
    if not selected:
        print('\n❌ 没有有效笑话')
        return
    
    # 分配ID
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
    
    print(f'\n✅ 更新完成!')
    print(f'新增: {len(selected)} 条')
    sources = {}
    for j in selected:
        sources[j['category']] = sources.get(j['category'], 0) + 1
    for s, c in sources.items():
        print(f'  {s}: {c} 条')
    print(f'总数: {len(jokes)} 条')
    
    print(f'\n预览:')
    for j in selected[:3]:
        print(f'  [{j["category"]}] {j["title"]}')
        print(f'    {j["content"][:60]}...')

if __name__ == '__main__':
    main()
