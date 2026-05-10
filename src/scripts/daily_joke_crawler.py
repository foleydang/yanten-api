#!/usr/bin/env python3
"""每日自动抓取笑话 - 定时任务脚本"""

import requests
import re
import sqlite3
import time
from datetime import datetime, date
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/joke_crawler.log'),
        logging.StreamHandler()
    ]
)

DB_FILE = '/root/github/yanten-api/data/database/main.db'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

def classify(text):
    """智能分类"""
    if any(w in text for w in ['老板', '公司', '工作', '加班', '同事', '经理']):
        return '职场'
    elif any(w in text for w in ['老师', '学校', '同学', '考试', '学生', '上课']):
        return '校园'
    elif any(w in text for w in ['老婆', '媳妇', '老公', '孩子', '儿子', '女儿', '奶奶', '爷爷']):
        return '家庭'
    elif any(w in text for w in ['女朋友', '男朋友', '女友', '男友', '女神', '相亲']):
        return '恋爱'
    elif any(w in text for w in ['外卖', '快递', '医院', '医生', '理发', '打车']):
        return '生活'
    return '搞笑'

def fetch_from_duanzi(pages=3):
    """从段子网抓取"""
    jokes = []
    
    for page in range(1, pages + 1):
        url = f'https://duanzi.cn/page/{page}/' if page > 1 else 'https://duanzi.cn/'
        try:
            logging.info(f"抓取第 {page} 页...")
            resp = requests.get(url, headers=headers, timeout=15)
            
            if resp.status_code != 200:
                logging.warning(f"第 {page} 页返回 {resp.status_code}")
                continue
            
            # 提取文章链接和内容
            pattern = r'<div class="post item">.*?<h2><a href="([^"]+)"[^>]*>(.*?)</a></h2>.*?<div class="intro">(.*?)</div>'
            matches = re.findall(pattern, resp.text, re.DOTALL)
            
            for link, title, intro in matches:
                title = re.sub(r'<[^>]+>', '', title).strip()
                intro = re.sub(r'<[^>]+>', '', intro).strip()
                
                # 如果简介够长，直接用
                if len(intro) > 100 and len(intro) < 800:
                    jokes.append({
                        'title': title[:30] + '...' if len(title) > 30 else title,
                        'content': intro,
                        'category': classify(intro)
                    })
            
            logging.info(f"  第 {page} 页找到 {len(matches)} 篇")
            time.sleep(1)  # 避免请求过快
            
        except Exception as e:
            logging.error(f"第 {page} 页失败: {e}")
    
    return jokes

def save_to_db(jokes):
    """保存到数据库"""
    if not jokes:
        return 0
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    today = date.today().strftime('%Y-%m-%d')
    now_ts = int(datetime.now().timestamp() * 1000)
    
    # 获取已有内容
    cursor.execute('SELECT title FROM jokes')
    existing_titles = set(row[0] for row in cursor.fetchall())
    
    added = 0
    for j in jokes:
        # 避免重复
        if j['title'] in existing_titles:
            continue
        
        cursor.execute('''
            INSERT INTO jokes (category, title, content, likes, neutrals, dislikes, shares, is_hot, status, date, created_at)
            VALUES (?, ?, ?, ?, 0, 0, 0, 1, "approved", ?, ?)
        ''', (j['category'], j['title'], j['content'], 500, today, now_ts))
        added += 1
        existing_titles.add(j['title'])
    
    conn.commit()
    
    # 统计
    cursor.execute('SELECT COUNT(*) FROM jokes')
    total = cursor.fetchone()[0]
    
    conn.close()
    return added, total

def main():
    """主函数"""
    logging.info("=" * 50)
    logging.info("开始每日笑话抓取任务")
    logging.info("=" * 50)
    
    # 抓取
    jokes = fetch_from_duanzi(3)
    logging.info(f"抓取到 {len(jokes)} 条笑话")
    
    # 保存
    if jokes:
        added, total = save_to_db(jokes)
        logging.info(f"新增 {added} 条，总数 {total}")
    
    logging.info("抓取任务完成")

if __name__ == '__main__':
    main()
