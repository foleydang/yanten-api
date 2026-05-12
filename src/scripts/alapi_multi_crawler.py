#!/usr/bin/env python3
"""
ALAPI笑话爬虫 - 尝试获取多页数据
注意：ALAPI可能不支持分页，这里尝试不同page值
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

def classify(content):
    """智能分类"""
    scores = {'职场': 0, '校园': 0, '家庭': 0, '恋爱': 0, '生活': 0}
    
    workplace = ['老板', '公司', '加班', '面试', '工资', '程序员', '代码']
    school = ['老师', '学校', '同学', '考试', '作业', '上课', '小明', '小红']
    family = ['老婆', '老公', '媳妇', '孩子', '儿子', '女儿', '爸妈', '结婚']
    love = ['女朋友', '男朋友', '女友', '男友', '约会', '相亲', '恋爱']
    life = ['外卖', '快递', '医院', '理发', '打车', '减肥', '手机', '公交', '地铁']
    
    for w in workplace:
        if w in content: scores['职场'] += 2
    for w in school:
        if w in content: scores['校园'] += 2
    for w in family:
        if w in content: scores['家庭'] += 2
    for w in love:
        if w in content: scores['恋爱'] += 3
    for w in life:
        if w in content: scores['生活'] += 2
    
    max_cat = max(scores, key=scores.get)
    return max_cat if scores[max_cat] >= 2 else '搞笑'

def generate_title(content):
    """生成8字以内标题"""
    scenes = {
        '面试': '面试趣事', '相亲': '相亲现场', '加班': '加班糗事',
        '考试': '考试趣事', '外卖': '外卖糗事', '减肥': '减肥计划',
        '打车': '打车糗事', '理发': '理发店', '程序员': '程序员',
        '小明': '小明趣事', '老婆': '老婆说', '老公': '老公说',
        '老板': '老板说', '孩子': '孩子趣事', '公交': '公交糗事',
    }
    
    for k, t in scenes.items():
        if k in content[:50]:
            return t
    
    return content.split('。')[0][:8].strip() or content[:8]

def is_valid(content):
    """检查有效性"""
    content = content.strip()
    if len(content) < 20 or len(content) > 500:
        return False
    if any(kw in content[:50] for kw in ['语录', '签名', '诗词', '名言', '新闻', '报道']):
        return False
    return content.endswith('。') or content.endswith('！') or content.endswith('？')

def save_jokes(jokes):
    """保存去重"""
    if not jokes:
        return 0, 0
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT content FROM jokes WHERE status="approved"')
    existing = {row[0][:30]: True for row in cursor.fetchall()}
    
    added = 0
    for j in jokes:
        key = j['content'][:30]
        if key in existing:
            continue
        
        likes = random.randint(5, 25)
        today = date.today().strftime('%Y-%m-%d')
        
        cursor.execute('''
            INSERT INTO jokes (category, title, content, likes, status, date, created_at)
            VALUES (?, ?, ?, ?, 'approved', ?, ?)
        ''', (j['category'], j['title'], j['content'], likes, today, 1778500000000))
        added += 1
    
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM jokes WHERE status="approved"')
    total = cursor.fetchone()[0]
    conn.close()
    
    return added, total

def fetch_page(page, num=20):
    """获取指定页笑话"""
    jokes = []
    
    try:
        url = f'{API_URL}?token={TOKEN}&num={num}&page={page}'
        resp = requests.get(url, timeout=30)
        data = resp.json()
        
        jokes_data = data.get('data', [])
        
        if jokes_data and isinstance(jokes_data, list):
            for item in jokes_data:
                content = item.get('content', '').strip()
                content = re.sub(r'\s+', ' ', content)
                
                if is_valid(content):
                    jokes.append({
                        'title': generate_title(content),
                        'content': content,
                        'category': classify(content)
                    })
            
            return len(jokes_data), jokes
    
    except:
        pass
    
    return 0, []

def main():
    print("=" * 40)
    print(f"ALAPI笑话爬虫 - {date.today()}")
    sys.stdout.flush()
    
    all_jokes = []
    
    # 尝试获取多个页（虽然API可能不支持）
    for page in range(1, 11):
        count, jokes = fetch_page(page, 20)
        print(f'page={page}: 返回{count}条, 有效{len(jokes)}条')
        sys.stdout.flush()
        
        if count == 0:
            print('  API不支持分页，停止')
            break
        
        all_jokes.extend(jokes)
        
        import time
        time.sleep(1)
    
    if all_jokes:
        added, total = save_jokes(all_jokes)
        print(f'新增: {added}条, 总数: {total}条')
        sys.stdout.flush()
    
    print("完成")

if __name__ == '__main__':
    main()
