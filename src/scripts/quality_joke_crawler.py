#!/usr/bin/env python3
"""
高质量笑话抓取 - 放宽标准但保证完整性
"""

import requests
import sqlite3
import time
import random
import re
from datetime import datetime, date
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/joke_crawler.log'),
        logging.StreamHandler()
    ]
)

DB_FILE = '/root/github/yanten-api/data/database/main.db'

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

def classify(text):
    """分类"""
    if any(w in text for w in ['老板', '公司', '工作', '加班', '面试', '工资', '程序员', '代码', '辞职']):
        return '职场'
    elif any(w in text for w in ['老师', '学校', '同学', '考试', '学生', '作业', '上课', '抄']):
        return '校园'
    elif any(w in text for w in ['老婆', '老公', '媳妇', '孩子', '儿子', '女儿', '爸妈', '结婚', '相亲']):
        return '家庭'
    elif any(w in text for w in ['女朋友', '男朋友', '女友', '男友', '约会']):
        return '恋爱'
    elif any(w in text for w in ['外卖', '快递', '医院', '理发', '打车', '超市', '减肥', '健身房', '手机', '空调', '闹钟', 'WiFi', '网购']):
        return '生活'
    return '搞笑'

def generate_title(content):
    """生成标题"""
    first = content[:50]
    scenes = {
        '面试': '面试经历', '相亲': '相亲现场', '加班': '加班糗事',
        '考试': '考试趣事', '外卖': '外卖糗事', '减肥': '减肥计划',
        '打车': '打车糗事', '理发': '理发店', '网购': '网购经历',
        '程序员': '程序员', '代码': '代码bug', '辞职': '辞职理由',
    }
    for k, t in scenes.items():
        if k in first: return t
    if '小明' in first: return '小明'
    if '老婆' in first: return '老婆说'
    if '老公' in first: return '老公说'
    if '老板' in first: return '老板说'
    return content.split('\n')[0][:12] or '搞笑一则'

def is_valid_joke(content):
    """
    放宽标准检查：
    1. 长度：20-300字（不按长度判断质量）
    2. 不是语录/诗词
    3. 没有HTML实体
    4. 结尾有标点或无语梗
    """
    content = content.strip()
    
    # 太短/太长
    if len(content) < 20 or len(content) > 300:
        return False, '长度不合适'
    
    # 非笑话
    non_joke = ['语录', '签名', '诗词', '名言', '小说', '神话', '希腊', '汽车渴望']
    for kw in non_joke:
        if kw in content[:30]:
            return False, '非笑话'
    
    # HTML实体
    if '&nbsp;' in content or '&amp;' in content:
        return False, 'HTML'
    
    # 结尾检查 - 必须有结束标点
    last = content[-10:]
    has_end = any(content.endswith(p) for p in ['。', '！', '？', '~', '"', '...'])
    
    # 省略号结尾检查
    if content.endswith('...'):
        before = content.rstrip('.').rstrip('。')
        # 省略号前有冒号=无语梗，完整
        if before.endswith('：') or '："' in before[-8:]:
            has_end = True
    
    if not has_end:
        return False, '无结尾标点'
    
    return True, None

def split_and_extract(content):
    """
    从多编号内容中提取独立笑话
    "1、xxx 2、xxx" -> ["xxx", "xxx"]
    """
    # 找编号
    pattern = r'[一二三四五六七八九十\d]+[、\.：:]\s*'
    matches = list(re.finditer(pattern, content))
    
    if len(matches) < 2:
        return [content]  # 单条笑话
    
    jokes = []
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i+1].start() if i+1 < len(matches) else len(content)
        
        text = content[start:end].strip()
        text = re.sub(r'\d+[、\.]$', '', text).strip()
        
        # 只保留完整的
        if len(text) >= 20:
            valid, _ = is_valid_joke(text)
            if valid:
                jokes.append(text)
    
    return jokes if jokes else [content]

def fetch_jokes(pages=3):
    """抓取"""
    jokes = []
    
    for page in range(1, pages + 1):
        url = f'https://duanzi.cn/page/{page}/' if page > 1 else 'https://duanzi.cn/'
        try:
            logging.info(f"抓取第 {page} 页...")
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code != 200:
                continue
            
            # 提取内容
            pattern = r'<div class="intro">(.*?)</div>'
            matches = re.findall(pattern, resp.text, re.DOTALL)
            
            page_count = 0
            for content_raw in matches:
                # 清理
                content = re.sub(r'<[^>]+>', '', content_raw).strip()
                content = re.sub(r'&nbsp;', ' ', content)
                
                # 拆分多编号
                parts = split_and_extract(content)
                
                for part in parts:
                    valid, reason = is_valid_joke(part)
                    if valid:
                        title = generate_title(part)
                        jokes.append({
                            'title': title,
                            'content': part,
                            'category': classify(part),
                            'likes': random.randint(5, 30)
                        })
                        page_count += 1
            
            logging.info(f"  有效: {page_count}")
            time.sleep(2)
            
        except Exception as e:
            logging.error(f"失败: {e}")
    
    return jokes

def save_to_db(jokes):
    """保存"""
    if not jokes:
        return 0, 0
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    today = date.today().strftime('%Y-%m-%d')
    now_ts = int(datetime.now().timestamp() * 1000)
    
    # 去重
    cursor.execute('SELECT content FROM jokes WHERE status="approved"')
    existing = set(row[0][:30] for row in cursor.fetchall())
    
    added = 0
    for j in jokes:
        key = j['content'][:30]
        if key in existing:
            continue
        
        cursor.execute('''
            INSERT INTO jokes (category, title, content, likes, neutrals, dislikes, shares, is_hot, status, date, created_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, 0, 'approved', ?, ?)
        ''', (j['category'], j['title'], j['content'], j['likes'], today, now_ts))
        added += 1
        existing.add(key)
    
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM jokes WHERE status="approved"')
    total = cursor.fetchone()[0]
    conn.close()
    
    return added, total

def main():
    logging.info("=" * 40)
    logging.info("开始抓取笑话")
    
    jokes = fetch_jokes(3)
    logging.info(f"抓取有效: {len(jokes)}")
    
    if jokes:
        added, total = save_to_db(jokes)
        logging.info(f"新增: {added}, 总数: {total}")
        
        # 示例
        for j in jokes[:3]:
            logging.info(f"  [{j['category']}] {j['title']}")
    
    logging.info("完成")

if __name__ == '__main__':
    main()
