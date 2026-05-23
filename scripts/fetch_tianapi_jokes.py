#!/usr/bin/env python3
"""
获取天行API笑话并保存到数据库
新增笑话自动approved，写入后重启服务使数据生效
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
        
        # 直接插入，自动approved
        cursor.execute("""
            INSERT INTO jokes (id, category, title, content, likes, status, date)
            VALUES (?, '搞笑', ?, ?, 0, 'approved', ?)
        """, (next_id, title, content, today))
        
        print(f"    新增 #{next_id}: {title[:30]}...")
        next_id += 1
        count += 1
    
    conn.commit()
    conn.close()
    return count

def cleanup_bad_jokes():
    """删除差评笑话：dislikes >= 3 且 dislikes > likes"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, title, likes, dislikes FROM jokes 
        WHERE status='approved' AND dislikes >= 3 AND dislikes > likes
    """)
    bad_jokes = cursor.fetchall()
    
    if bad_jokes:
        ids = [j[0] for j in bad_jokes]
        for j in bad_jokes:
            print(f"  删除差评 #{j[0]}: {j[1][:30]}... (👍{j[2]} 👎{j[3]})")
        
        placeholders = ','.join(['?'] * len(ids))
        cursor.execute(f"DELETE FROM jokes WHERE id IN ({placeholders})", ids)
        # 也删除相关收藏
        cursor.execute(f"DELETE FROM favorites WHERE joke_id IN ({placeholders})", ids)
        conn.commit()
        print(f"  共删除 {len(bad_jokes)} 条差评笑话")
    else:
        print("  无差评笑话需删除")
    
    conn.close()

def main():
    print("=" * 50)
    print("获取天行API笑话 - 先清理差评，再新增")
    print("=" * 50)
    
    # Step 1: 清理差评笑话
    print("\nStep 1: 清理差评笑话")
    cleanup_bad_jokes()
    
    # Step 2: 新增笑话
    print("\nStep 2: 新增笑话")
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
    # Step 3: 重启服务让数据库生效（因为Node用sql.js内存数据库，不自动读取文件变更）
    if total > 0:
        print("\nStep 3: 重启服务使数据生效")
        import subprocess
        subprocess.run(['pm2', 'restart', 'yanten-api'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("  服务已重启")
    
    print("=" * 50)
    print(f"完成！共新增 {total} 条笑话")
    print("状态：approved（自动通过）")
    print("=" * 50)

if __name__ == "__main__":
    main()
