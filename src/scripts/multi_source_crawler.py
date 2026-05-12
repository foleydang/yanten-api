#!/usr/bin/env python3
"""
多源笑话爬虫 - 使用多个ALAPI接口
"""

import requests
import sqlite3
import re
import random
from datetime import date
import html

DB_FILE = '/root/github/yanten-api/data/database/main.db'
TOKEN = '2emlih5umpvcpwkownzbgbo6avhqiz'

# 多个数据源
API_URLS = [
    ('https://v2.alapi.cn/api/joke', '笑话'),
    ('https://v2.alapi.cn/api/godreply', '神回复'),
    ('https://v2.alapi.cn/api/naowan', '脑筋急转弯'),
]

def clean_content(content):
    """清理内容"""
    content = html.unescape(content)
    content = content.replace('&nbsp;', ' ')
    content = content.replace('\n', ' ')
    content = re.sub(r'\s+', ' ', content)
    return content.strip()

def classify(content):
    """智能分类"""
    scores = {'职场': 0, '校园': 0, '家庭': 0, '恋爱': 0, '生活': 0}
    
    keywords = {
        '职场': ['老板', '公司', '加班', '面试', '工资', '程序员', '辞职', '同事'],
        '校园': ['老师', '学校', '同学', '考试', '作业', '小明', '小红'],
        '家庭': ['老婆', '老公', '媳妇', '孩子', '儿子', '女儿', '爸妈'],
        '恋爱': ['女朋友', '男朋友', '约会', '相亲', '表白', '分手'],
        '生活': ['外卖', '快递', '医院', '减肥', '公交', '地铁']
    }
    
    for cat, words in keywords.items():
        for w in words:
            if w in content:
                scores[cat] += 2
    
    max_cat = max(scores, key=scores.get)
    return max_cat if scores[max_cat] >= 2 else '搞笑'

def generate_title(content):
    """生成标题"""
    scenes = {
        '面试': '面试趣事', '相亲': '相亲现场', '加班': '加班糗事',
        '考试': '考试趣事', '外卖': '外卖糗事', '减肥': '减肥计划',
        '程序员': '程序员', '小明': '小明趣事', '老婆': '老婆说',
    }
    
    for k, t in scenes.items():
        if k in content[:50]:
            return t
    
    return content[:8].strip()

def is_duplicate(db, content):
    """检查是否重复"""
    cursor = db.execute('SELECT id FROM jokes WHERE content LIKE ?', (f'%{content[:50]}%',))
    return cursor.fetchone() is not None

def main():
    print(f"========================================")
    print(f"多源笑话爬虫 - {date.today()}")
    print(f"========================================")
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 获取当前总数
    cursor.execute('SELECT COUNT(*) FROM jokes WHERE status="approved"')
    current_total = cursor.fetchone()[0]
    print(f"当前总数: {current_total}")
    
    new_count = 0
    
    for api_url, source_name in API_URLS:
        print(f"\n【{source_name}】")
        
        try:
            params = {'token': TOKEN, 'num': 50}
            resp = requests.get(api_url, params=params, timeout=10)
            data = resp.json()
            
            if data.get('code') != 200:
                print(f"  错误: {data.get('msg')}")
                continue
            
            items = data.get('data', [])
            print(f"  返回: {len(items)} 条")
            
            for item in items:
                # 根据不同API解析内容
                if source_name == '笑话':
                    content = item.get('content', '')
                elif source_name == '神回复':
                    content = item.get('content', '')
                    title = item.get('title', '')
                    if title and content:
                        content = f"{title}\n\n{content}"
                elif source_name == '脑筋急转弯':
                    question = item.get('question', '')
                    answer = item.get('answer', '')
                    if question and answer:
                        content = f"{question}\n\n答案：{answer}"
                
                content = clean_content(content)
                
                if len(content) < 30 or len(content) > 500:
                    continue
                
                if is_duplicate(conn, content):
                    continue
                
                title = generate_title(content)
                category = classify(content)
                
                cursor.execute('''
                    INSERT INTO jokes (category, title, content, status, date)
                    VALUES (?, ?, ?, 'approved', ?)
                ''', (category, title, content, str(date.today())))
                
                new_count += 1
                print(f"  + [{category}] {title}")
            
        except Exception as e:
            print(f"  错误: {e}")
    
    conn.commit()
    
    # 最终统计
    cursor.execute('SELECT COUNT(*) FROM jokes WHERE status="approved"')
    final_total = cursor.fetchone()[0]
    
    print(f"\n========================================")
    print(f"新增: {new_count} 条")
    print(f"总数: {final_total} 条")
    print(f"========================================")
    
    conn.close()

if __name__ == '__main__':
    main()
