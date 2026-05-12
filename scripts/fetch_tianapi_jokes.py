#!/usr/bin/env python3
"""
直接获取天行API笑话并保存到数据库
不做任何过滤或截断检查，让用户自己审核
"""
import requests
import json
import sqlite3
import time

KEY = "870a7f7c0ee13224754ceb077b5a4adc"
DB_FILE = "/root/github/yanten-api/data/database/main.db"

def fetch_jokes(num=10, page=1):
    """获取笑话 - 直接返回原始数据"""
    url = f"https://api.tianapi.com/joke/index?key={KEY}&num={num}&page={page}"
    r = requests.get(url, timeout=10)
    data = r.json()
    
    if data.get('code') == 200:
        return data.get('newslist', [])
    return []

def fetch_godreply(num=10, page=1):
    """获取神回复"""
    url = f"https://api.tianapi.com/godreply/index?key={KEY}&num={num}&page={page}"
    r = requests.get(url, timeout=10)
    data = r.json()
    
    if data.get('code') == 200:
        return data.get('newslist', [])
    return []

def save_jokes(jokes):
    """直接保存到数据库，不做任何过滤"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 获取最大ID
    cursor.execute("SELECT MAX(id) FROM jokes")
    max_id = cursor.fetchone()[0] or 0
    next_id = max_id + 1
    
    today = time.strftime("%Y-%m-%d")
    count = 0
    
    for item in jokes:
        title = item.get('title', '')
        content = item.get('content', '')
        
        if not content:
            continue
        
        # 检查是否已存在（相同内容）
        cursor.execute("SELECT id FROM jokes WHERE content = ?", (content,))
        if cursor.fetchone():
            print(f"    跳过重复: {title[:20]}...")
            continue
        
        # 直接插入，不做任何修改
        cursor.execute("""
            INSERT INTO jokes (id, category, title, content, likes, status, date)
            VALUES (?, '搞笑', ?, ?, 0, 'pending', ?)
        """, (next_id, title, content, today))
        
        print(f"    新增 #{next_id}: {title[:30]}...")
        next_id += 1
        count += 1
    
    conn.commit()
    conn.close()
    return count

def main():
    print("=" * 50)
    print("获取天行API笑话 - 直接保存，不做过滤")
    print("=" * 50)
    
    total = 0
    
    # 获取笑话（多页）
    print("\n获取笑话:")
    for page in range(1, 11):  # 10页
        try:
            jokes = fetch_jokes(num=10, page=page)
            if jokes:
                count = save_jokes(jokes)
                total += count
                print(f"  page {page}: 获取 {len(jokes)} 条，新增 {count} 条")
            else:
                print(f"  page {page}: 无数据")
            time.sleep(0.3)
        except Exception as e:
            print(f"  page {page}: 错误 - {e}")
    
    # 获取神回复
    print("\n获取神回复:")
    try:
        jokes = fetch_godreply(num=10, page=1)
        if jokes:
            count = save_jokes(jokes)
            total += count
            print(f"  神回复: 获取 {len(jokes)} 条，新增 {count} 条")
    except Exception as e:
        print(f"  神回复: 错误 - {e}")
    
    print("=" * 50)
    print(f"完成！共新增 {total} 条笑话")
    print("状态：pending（待审核）")
    print("请到管理后台审核：https://yanten.top/joker/admin")
    print("=" * 50)

if __name__ == "__main__":
    main()
