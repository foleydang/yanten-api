#!/usr/bin/env python3
"""
哇哇笑笑话爬取和更新脚本
- 每天爬取50条新笑话
- 笑话库上限500条
- 淘汰机制：评分最低的笑话
- 去重：Rouge相似度检查
"""

import json
import requests
from datetime import datetime, date
import random
import hashlib
import os

# 配置
JOKES_FILE = '/root/github/yanten-api/data/database/wawaxiao-jokes.json'
MAX_JOKES = 500
DAILY_LIMIT = 50
BACKUP_DIR = '/root/logs/jokes-backup'

# 笑话数据源（可扩展）
JOKE_SOURCES = [
    {
        'name': '本地新增',
        'type': 'local',
        'enabled': True
    },
    # 可添加更多数据源：
    # {
    #     'name': '笑话网',
    #     'url': 'https://xxx.com/api/jokes',
    #     'type': 'api'
    # }
]

def load_jokes():
    """加载现有笑话"""
    try:
        with open(JOKES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_jokes(jokes):
    """保存笑话"""
    # 备份
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup_file = f"{BACKUP_DIR}/jokes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)
    
    # 保存
    with open(JOKES_FILE, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)

def calculate_score(joke):
    """计算笑话评分"""
    likes = joke.get('likes', 0)
    dislikes = joke.get('dislikes', 0)
    neutrals = joke.get('neutrals', 0)
    
    # 评分 = 喜欢 - 不喜欢 - 0.5*平（平也不算太好）
    score = likes - dislikes - (neutrals * 0.5)
    
    # 加分：近期笑话加分
    joke_date = joke.get('date', '')
    today = date.today().strftime('%Y-%m-%d')
    if joke_date == today:
        score += 5  # 今日笑话加分
    
    return score

def calculate_similarity(text1, text2):
    """
    计算文本相似度（简化版 Rouge-L）
    返回相似度 0-1
    """
    # 使用最长公共子序列
    def lcs(s1, s2):
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i-1] == s2[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])
        
        return dp[m][n]
    
    if not text1 or not text2:
        return 0
    
    lcs_len = lcs(text1, text2)
    return lcs_len / max(len(text1), len(text2))

def is_duplicate(new_joke, existing_jokes, threshold=0.8):
    """
    检查是否重复
    threshold: 相似度阈值，0.8 表示80%相似就认为重复
    """
    new_content = new_joke.get('content', '')
    
    for joke in existing_jokes:
        existing_content = joke.get('content', '')
        similarity = calculate_similarity(new_content, existing_content)
        
        if similarity > threshold:
            return True, joke['id']
    
    return False, None

def get_eviction_candidates(jokes):
    """
    获取需要淘汰的候选笑话
    按评分从低到高排序
    """
    # 计算评分
    for joke in jokes:
        joke['_score'] = calculate_score(joke)
    
    # 按评分排序（低评分在前）
    sorted_jokes = sorted(jokes, key=lambda j: j['_score'])
    
    # 移除临时字段
    for joke in jokes:
        joke.pop('_score', None)
    
    return sorted_jokes

def evict_jokes(jokes, count):
    """
    淘汰指定数量的笑话
    """
    if len(jokes) <= MAX_JOKES:
        return jokes
    
    # 获取淘汰候选
    candidates = get_eviction_candidates(jokes)
    
    # 淘汰最低评分的
    keep_count = MAX_JOKES - count  # 留下空间给新笑话
    evicted = candidates[:len(jokes) - keep_count]
    kept = candidates[len(jokes) - keep_count:]
    
    print(f'淘汰 {len(evicted)} 条低评分笑话:')
    for joke in evicted[:5]:  # 只显示前5条
        score = calculate_score(joke)
        print(f'  ID {joke["id"]}: {joke["title"]} (评分: {score:.1f})')
    
    return kept

def generate_new_jokes(count):
    """
    生成新笑话（示例数据）
    实际使用时可以对接真实的笑话网站API
    """
    new_jokes = []
    today = date.today().strftime('%Y-%m-%d')
    
    # 示例笑话模板（实际应该爬取真实数据）
    templates = [
        ('职场', '程序员面试', '面试官：你期望薪资是多少？\n程序员：3万。\n面试官：我们公司可以给你5万...\n程序员：真的吗？\n面试官：假的，是你先跟我开玩笑的。'),
        ('生活', '减肥计划', '我决定减肥了。\n第一天：晚上不吃饭！\n...\n第五天：算了，胖着也挺好的。'),
        ('家庭', '妈妈的逻辑', '我：妈，我饿了。\n妈：饿了不会自己做饭？...'),
        ('校园', '考试秘诀', '老师：小明，这次考试你怎么又考了0分？\n小明：老师，您不是说要诚实吗？...'),
    ]
    
    # 如果要爬取真实数据，可以在这里添加爬虫逻辑
    # response = requests.get('笑话网站API')
    # jokes_data = response.json()
    
    # 模拟生成（实际使用替换为真实爬取）
    for i in range(count):
        template = random.choice(templates)
        new_joke = {
            'category': template[0],
            'title': template[1],
            'content': template[2],
            'likes': 0,
            'neutrals': 0,
            'dislikes': 0,
            'shares': 0,
            'isHot': False,
            'status': 'approved',
            'createdAt': int(datetime.now().timestamp() * 1000),
            'date': today
        }
        new_jokes.append(new_joke)
    
    return new_jokes

def main():
    """主函数"""
    print('=' * 50)
    print(f'哇哇笑笑话更新任务 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 50)
    
    # 加载现有笑话
    jokes = load_jokes()
    current_count = len(jokes)
    print(f'\n当前笑话数: {current_count}')
    print(f'上限: {MAX_JOKES}')
    print(f'每日新增: {DAILY_LIMIT}')
    
    # 检查是否需要更新
    if current_count >= MAX_JOKES:
        print(f'\n已达上限 {MAX_JOKES}，需要淘汰')
        jokes = evict_jokes(jokes, DAILY_LIMIT)
        print(f'淘汰后: {len(jokes)} 条')
    
    # 生成新笑话
    print(f'\n准备新增 {DAILY_LIMIT} 条笑话...')
    new_jokes = generate_new_jokes(DAILY_LIMIT)
    
    # 去重检查
    print('\n去重检查...')
    duplicates_found = 0
    unique_jokes = []
    
    for new_joke in new_jokes:
        is_dup, dup_id = is_duplicate(new_joke, jokes)
        
        if is_dup:
            duplicates_found += 1
            print(f'  发现重复: {new_joke["title"]} 与 ID {dup_id} 相似')
        else:
            unique_jokes.append(new_joke)
    
    print(f'重复: {duplicates_found} 条')
    print(f'唯一: {len(unique_jokes)} 条')
    
    # 分配ID
    max_id = max([j['id'] for j in jokes]) if jokes else 0
    for joke in unique_jokes:
        max_id += 1
        joke['id'] = max_id
    
    # 合并
    jokes.extend(unique_jokes)
    
    # 保存
    save_jokes(jokes)
    
    print(f'\n✅ 更新完成!')
    print(f'新增: {len(unique_jokes)} 条')
    print(f'淘汰: {MAX_JOKES - len(jokes) + len(unique_jokes)} 条')
    print(f'现有: {len(jokes)} 条')
    
    # 统计
    approved = [j for j in jokes if j['status'] == 'approved']
    print(f'\n统计:')
    print(f'  已审核: {len(approved)} 条')
    print(f'  今日新增: {len([j for j in approved if j["date"] == date.today().strftime("%Y-%m-%d")])} 条')
    
    return jokes

if __name__ == '__main__':
    main()
