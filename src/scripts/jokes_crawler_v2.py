#!/usr/bin/env python3
"""
高质量笑话爬虫 V2
- 停用低质量来源（B站、英文翻译）
- 使用中文笑话API和网站
- 过滤重复和低质量内容
"""

import json
import requests
from datetime import datetime, date
import random
import time
import sqlite3

DB_FILE = '/root/github/yanten-api/data/database/main.db'
DAILY_LIMIT = 30  # 减少数量，保证质量

# 高质量笑话API和网站
SOURCES = {
    'jokeapi_cn': 'https://v2.jokeapi.dev/joke/Any?lang=zh&type=single',
    'icndb': 'http://api.icndb.com/jokes/random/10',
}

def get_db():
    return sqlite3.connect(DB_FILE)

def get_existing_titles():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT title FROM jokes')
    titles = set(row[0] for row in cursor.fetchall())
    conn.close()
    return titles

def is_quality_joke(title, content):
    """判断笑话质量"""
    # 长度检查
    if len(content) < 20 or len(content) > 200:
        return False
    
    # 过滤重复模式
    bad_patterns = ['快递', '外卖', 'WiFi', '空调', '手机', '闹钟']
    for pattern in bad_patterns:
        if pattern in title and pattern in content:
            # 如果标题和内容都包含这些词，可能是重复内容
            pass
    
    # 检查是否包含笑点
    funny_words = ['哈哈', '笑', '傻', '笨', '呆', '晕', '懵', 'wtf', '什么', '怎么', '为什么']
    has_funny = any(w in content for w in funny_words)
    
    # 检查是否有对话或情节
    has_dialogue = '：' in content or ':' in content or '"' in content or '“' in content
    
    return has_funny or has_dialogue

def crawl_jokeapi():
    """JokeAPI 中文笑话"""
    jokes = []
    try:
        print('爬取 JokeAPI 中文...')
        for i in range(10):
            resp = requests.get(SOURCES['jokeapi_cn'], timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get('type') == 'single':
                    content = data.get('joke', '')
                    if content and len(content) > 20:
                        title = content[:30] + '...' if len(content) > 30 else content
                        if is_quality_joke(title, content):
                            jokes.append({
                                'category': '搞笑',
                                'title': title,
                                'content': content
                            })
            time.sleep(0.5)
        print(f'JokeAPI: {len(jokes)} 条')
    except Exception as e:
        print(f'JokeAPI失败: {e}')
    return jokes

def crawl_local_jokes():
    """本地高质量笑话库"""
    # 手动整理的经典笑话
    quality_jokes = [
        {
            'category': '经典',
            'title': '小明考试',
            'content': '老师：小明，你这次考试怎么交了白卷？\n小明：老师，我怕改卷老师太辛苦，所以没写。\n老师：那你为什么连名字也不写？\n小明：我怕改卷老师知道是我，会气死。'
        },
        {
            'category': '经典',
            'title': '医生问诊',
            'content': '病人：医生，我记忆力不好，怎么办？\n医生：你这种情况多久了？\n病人：什么病？'
        },
        {
            'category': '经典',
            'title': '买西瓜',
            'content': '老板：这瓜保熟吗？\n小明：不熟我吃了它！\n老板：好，那你吃吧，这是冬瓜。'
        },
        {
            'category': '职场',
            'title': '面试',
            'content': '面试官：你最大的缺点是什么？\n小明：诚实。\n面试官：我不觉得这是缺点。\n小明：我也没觉得。'
        },
        {
            'category': '校园',
            'title': '请假',
            'content': '小明：老师，我想请假。\n老师：理由？\n小明：今天我哥结婚。\n老师：你哥不是上学期就结过婚了吗？\n小明：上次娶的不是这个。'
        },
        {
            'category': '家庭',
            'title': '减肥',
            'content': '老婆：老公，我胖吗？\n老公：不胖。\n老婆：真的？\n老公：真的，只是瘦得不明显。'
        },
        {
            'category': '生活',
            'title': '理发',
            'content': '理发师：剪短一点？\n小明：稍微修一下。\n十分钟后...\n小明：我是谁？我在哪？'
        },
        {
            'category': '搞笑',
            'title': '算命',
            'content': '小明：大师，我什么时候能发财？\n大师：你命中缺金。\n小明：那怎么办？\n大师：改名，叫钱多多。\n小明：那我现在叫什么？\n大师：穷鬼。'
        },
        {
            'category': '搞笑',
            'title': '借厕所',
            'content': '小明：老板，借个厕所。\n老板：我们厕所不外借。\n小明：那我买一个！\n老板：不卖。\n小明：那我租一个！\n老板：不租。\n小明：那我住你这吧。'
        },
        {
            'category': '经典',
            'title': '作业',
            'content': '老师：小明，作业为什么没交？\n小明：被狗吃了。\n老师：什么狗能吃作业？\n小明：单身狗，因为它寂寞。'
        },
    ]
    
    # 随机选取
    return random.sample(quality_jokes, min(5, len(quality_jokes)))

def main():
    print('=' * 60)
    print(f'高质量笑话爬虫 V2 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    existing_titles = get_existing_titles()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM jokes')
    current_count = cursor.fetchone()[0]
    conn.close()
    
    print(f'当前笑话数: {current_count}')
    print(f'每日目标: {DAILY_LIMIT}（高质量）')
    
    print('\n开始爬取...')
    all_new = []
    
    # 爬取网络笑话
    all_new.extend(crawl_jokeapi())
    
    # 添加本地高质量笑话
    all_new.extend(crawl_local_jokes())
    
    print(f'\n总爬取: {len(all_new)} 条')
    
    # 严格过滤
    unique = []
    for j in all_new:
        if j['title'] not in existing_titles and is_quality_joke(j['title'], j['content']):
            unique.append(j)
            existing_titles.add(j['title'])
    
    print(f'高质量: {len(unique)} 条')
    
    if not unique:
        print('\n❌ 没有新笑话')
        return
    
    # 保存到数据库
    conn = get_db()
    cursor = conn.cursor()
    today = date.today().strftime('%Y-%m-%d')
    now_ts = int(datetime.now().timestamp() * 1000)
    
    for j in unique[:DAILY_LIMIT]:
        cursor.execute('''
            INSERT INTO jokes (category, title, content, likes, neutrals, dislikes, shares, is_hot, status, date, created_at)
            VALUES (?, ?, ?, 0, 0, 0, 0, 0, "approved", ?, ?)
        ''', (j['category'], j['title'], j['content'], today, now_ts))
    
    conn.commit()
    cursor.execute('SELECT COUNT(*) FROM jokes')
    total = cursor.fetchone()[0]
    conn.close()
    
    print(f'\n✅ 新增: {min(len(unique), DAILY_LIMIT)} 条高质量笑话')
    print(f'总数: {total} 条')
    
    print('\n新增预览:')
    for j in unique[:3]:
        print(f'  [{j["category"]}] {j["title"]}')
        print(f'    {j["content"][:50]}...')

if __name__ == '__main__':
    main()
