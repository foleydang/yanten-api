#!/usr/bin/env python3
"""
笑话爬取 - 多源聚合
"""

import requests
import sqlite3
import time
import random
import re
from datetime import date

DB_FILE = '/root/github/yanten-api/data/database/main.db'

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/json'
}

def classify(text):
    """分类"""
    if any(w in text for w in ['老板', '公司', '加班', '面试', '工资', '程序员', '辞职']):
        return '职场'
    elif any(w in text for w in ['老师', '学校', '同学', '考试', '作业', '上课']):
        return '校园'
    elif any(w in text for w in ['老婆', '老公', '媳妇', '孩子', '爸妈', '结婚']):
        return '家庭'
    elif any(w in text for w in ['女朋友', '男朋友', '女友', '男友', '约会', '相亲']):
        return '恋爱'
    elif any(w in text for w in ['外卖', '快递', '医院', '理发', '打车', '减肥', '手机', '空调', '网购']):
        return '生活'
    elif any(w in text for w in ['小明', '小红', '小华']):
        return '搞笑'
    return '搞笑'

def generate_title(content):
    """从内容生成标题"""
    # 取第一句话的前15字
    first = content.split('\n')[0][:15]
    return first if len(first) >= 3 else '笑话一则'

def is_valid(content):
    """检查是否完整（不检查长度）"""
    content = content.strip()
    
    # 太短（<15字）或太长（>400字）
    if len(content) < 15 or len(content) > 400:
        return False
    
    # 非笑话内容
    non_joke = ['语录', '签名', '诗词', '名言', '小说', '广告']
    if any(kw in content[:50] for kw in non_joke):
        return False
    
    # HTML实体
    if '&nbsp;' in content or '&amp;' in content:
        return False
    
    # 以"1."开头（多条合并）
    if content.startswith('1.') or content.startswith('1、'):
        return False
    
    # 检查结尾（有结束标点就算完整）
    ending_chars = ['。', '！', '？', '~', '"', '》']
    has_ending = any(content.endswith(c) for c in ending_chars)
    
    # 省略号结尾检查
    if content.endswith('...'):
        # 省略号前有冒号=无语梗，完整
        before = content.rstrip('.').rstrip()
        if before.endswith('：') or '："' in before[-10:]:
            has_ending = True
    
    return has_ending

def save_jokes(jokes):
    """保存到数据库"""
    if not jokes:
        return 0
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    today = date.today().strftime('%Y-%m-%d')
    now_ts = int(time.time() * 1000)
    
    # 去重
    cursor.execute('SELECT content FROM jokes WHERE status="approved"')
    existing = set(row[0][:30] for row in cursor.fetchall())
    
    added = 0
    for j in jokes:
        key = j['content'][:30]
        if key in existing:
            continue
        
        likes = random.randint(5, 25)  # 随机初始点赞
        
        cursor.execute('''
            INSERT INTO jokes (category, title, content, likes, neutrals, dislikes, shares, is_hot, status, date, created_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, 0, 'approved', ?, ?)
        ''', (j['category'], j['title'], j['content'], likes, today, now_ts))
        added += 1
        existing.add(key)
    
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM jokes WHERE status="approved"')
    total = cursor.fetchone()[0]
    conn.close()
    
    return added, total

def fetch_from_duanzi(pages=5):
    """从段子网爬取"""
    jokes = []
    
    for page in range(1, pages + 1):
        url = f'https://duanzi.cn/page/{page}/' if page > 1 else 'https://duanzi.cn/'
        try:
            print(f'爬取段子网第 {page} 页...')
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code != 200:
                continue
            
            # 提取内容
            pattern = r'<div class="intro">(.*?)</div>'
            matches = re.findall(pattern, resp.text, re.DOTALL)
            
            for content_raw in matches:
                # 清理HTML
                content = re.sub(r'<[^>]+>', '', content_raw).strip()
                content = re.sub(r'&nbsp;', ' ', content)
                content = re.sub(r'\s+', ' ', content)
                
                if is_valid(content):
                    jokes.append({
                        'title': generate_title(content),
                        'content': content,
                        'category': classify(content)
                    })
            
            print(f'  有效: {len([j for j in jokes if j["content"][:30] not in ["" for _ in range(0)]])}')
            time.sleep(2)
            
        except Exception as e:
            print(f'失败: {e}')
    
    return jokes

def fetch_from_qiushibaike(pages=3):
    """从糗事百科爬取"""
    jokes = []
    
    for page in range(1, pages + 1):
        url = f'https://www.qiushibaike.com/text/page/{page}/'
        try:
            print(f'爬取糗事百科第 {page} 页...')
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code != 200:
                continue
            
            # 提取内容
            pattern = r'<div class="content">(.*?)</div>'
            matches = re.findall(pattern, resp.text, re.DOTALL)
            
            for content_raw in matches:
                content = re.sub(r'<[^>]+>', '', content_raw).strip()
                content = re.sub(r'\s+', ' ', content)
                
                if is_valid(content):
                    jokes.append({
                        'title': generate_title(content),
                        'content': content,
                        'category': classify(content)
                    })
            
            time.sleep(2)
            
        except Exception as e:
            print(f'失败: {e}')
    
    return jokes

def main():
    print("=" * 40)
    print("开始爬取笑话")
    
    # 多源爬取
    all_jokes = []
    
    # 段子网
    jokes = fetch_from_duanzi(3)
    all_jokes.extend(jokes)
    print(f'段子网: {len(jokes)}条')
    
    # 糗事百科
    jokes = fetch_from_qiushibaike(2)
    all_jokes.extend(jokes)
    print(f'糗事百科: {len(jokes)}条')
    
    print(f'总计: {len(all_jokes)}条')
    
    if all_jokes:
        added, total = save_jokes(all_jokes)
        print(f'新增: {added}条, 总数: {total}条')
    
    print("完成")

if __name__ == '__main__':
    main()
