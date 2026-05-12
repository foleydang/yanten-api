#!/usr/bin/env python3
"""
ALAPI笑话爬虫 v2 - 放宽筛选条件
"""

import requests
import sqlite3
import re
import random
from datetime import date
import sys
import html

DB_FILE = '/root/github/yanten-api/data/database/main.db'
API_URL = 'https://v3.alapi.cn/api/joke'
TOKEN = '2emlih5umpvcpwkownzbgbo6avhqiz'

def clean_content(content):
    """清理内容"""
    # 处理HTML实体
    content = html.unescape(content)
    content = content.replace('&nbsp;', ' ')
    content = content.replace('&#8220;', '"').replace('&#8221;', '"')
    content = content.replace('&#8216;', "'").replace('&#8217;', "'")
    
    # 处理换行符（合并为空格）
    content = content.replace('\n', ' ')
    content = re.sub(r'\s+', ' ', content)
    
    return content.strip()

def classify(content):
    """智能分类"""
    scores = {'职场': 0, '校园': 0, '家庭': 0, '恋爱': 0, '生活': 0}
    
    for w in ['老板', '公司', '加班', '面试', '工资', '程序员', '代码', '辞职', '同事', '工作']:
        if w in content: scores['职场'] += 2
    for w in ['老师', '学校', '同学', '考试', '作业', '上课', '小明', '小红', '校长']:
        if w in content: scores['校园'] += 2
    for w in ['老婆', '老公', '媳妇', '孩子', '儿子', '女儿', '爸妈', '结婚', '奶奶', '爷爷']:
        if w in content: scores['家庭'] += 2
    for w in ['女朋友', '男朋友', '女友', '男友', '约会', '相亲', '恋爱', '表白', '分手']:
        if w in content: scores['恋爱'] += 3
    for w in ['外卖', '快递', '医院', '理发', '打车', '减肥', '手机', '空调', '网购', '公交', '地铁', '火车', '超市']:
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
        '火车': '火车趣事', '地铁': '地铁糗事',
    }
    
    for k, t in scenes.items():
        if k in content[:50]:
            return t
    
    return content.split('。')[0][:8].strip() or content[:8]

def is_valid(content):
    """检查有效性 - 放宽条件"""
    content = content.strip()
    
    # 长度放宽：只要不极端就行
    if len(content) < 15:  # 太短没意义
        return False, '太短'
    if len(content) > 800:  # 太长可能是文章
        return False, '太长'
    
    # 非笑话关键词检查
    non_joke = ['语录', '签名', '诗词', '名言', '新闻', '据报道', '声明', '官方发布']
    for kw in non_joke:
        if kw in content[:100]:
            return False, f'非笑话({kw})'
    
    # 以、开头的是多条合并，需要拆分处理
    if content.startswith('、'):
        return False, '多条合并'
    
    # 结尾检查放宽
    # 接受更多结尾形式
    ending_chars = ['。', '！', '？', '~', '"', '》', '…', '...', '」', '』', ')', '）']
    
    # 检查是否以这些结尾
    has_end = False
    for end in ending_chars:
        if content.endswith(end):
            has_end = True
            break
    
    # 如果以...结尾，检查是否截断
    if content.endswith('...'):
        # ...前如果是完整句子（有冒号或引号），认为是无语梗，完整
        before = content[:-3].rstrip()
        if before.endswith('：') or before.endswith('"') or before.endswith("'"):
            has_end = True
    
    if not has_end:
        return False, '无结尾'
    
    return True, None

def split_multi_jokes(content):
    """拆分多条合并的笑话"""
    # 格式：、第一条  2、第二条  3、第三条
    parts = re.split(r'\n\d+、', content)
    
    if parts:
        parts[0] = parts[0].lstrip('、').strip()
    
    # 检查每个部分
    valid_parts = []
    for part in parts:
        part = clean_content(part)
        valid, reason = is_valid(part)
        if valid:
            valid_parts.append(part)
    
    return valid_parts

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
    skipped = []
    
    try:
        url = f'{API_URL}?token={TOKEN}&num={num}&page={page}'
        resp = requests.get(url, timeout=30)
        data = resp.json()
        
        jokes_data = data.get('data', [])
        
        if jokes_data and isinstance(jokes_data, list):
            for item in jokes_data:
                content_raw = item.get('content', '')
                
                # 清理内容
                content = clean_content(content_raw)
                
                # 检查有效性
                valid, reason = is_valid(content)
                
                if valid:
                    jokes.append({
                        'title': generate_title(content),
                        'content': content,
                        'category': classify(content)
                    })
                else:
                    # 如果是多条合并，尝试拆分
                    if reason == '多条合并':
                        parts = split_multi_jokes(content_raw)
                        for part in parts:
                            jokes.append({
                                'title': generate_title(part),
                                'content': part,
                                'category': classify(part)
                            })
                    else:
                        skipped.append(reason)
            
            return len(jokes_data), jokes, skipped
    
    except Exception as e:
        return 0, [], []
    
    return 0, [], []

def main():
    print("=" * 40)
    print(f"ALAPI笑话爬虫 v2 - {date.today()}")
    sys.stdout.flush()
    
    all_jokes = []
    all_skipped = []
    
    # 获取10页
    for page in range(1, 11):
        count, jokes, skipped = fetch_page(page, 20)
        
        valid_count = len(jokes)
        print(f'page={page}: 返回{count}条 → 有效{valid_count}条')
        sys.stdout.flush()
        
        if count == 0:
            break
        
        all_jokes.extend(jokes)
        all_skipped.extend(skipped)
        
        import time
        time.sleep(1)
    
    # 统计跳过原因
    if all_skipped:
        from collections import Counter
        skip_counts = Counter(all_skipped)
        print(f'跳过统计:')
        for reason, count in skip_counts.most_common():
            print(f'  {reason}: {count}条')
        sys.stdout.flush()
    
    if all_jokes:
        added, total = save_jokes(all_jokes)
        print(f'新增: {added}条, 总数: {total}条')
        sys.stdout.flush()
        
        for j in all_jokes[:5]:
            print(f'  [{j["category"]}] {j["title"]}')
            sys.stdout.flush()
    
    print("完成")

if __name__ == '__main__':
    main()
