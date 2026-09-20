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

import re

# ===== 质量过滤规则 =====
# 古文/文言文笑话标志（现代人看不懂）
CLASSICAL_MARKERS = [
    "答曰", "乃曰", "因曰", "或问", "遂", "曰：",
    "之乎", "者也", "笑林广记", "秀才", "监生",
    "县官", "员外", "书僮", "延师", "东家",
    "《风俗通》", "《笑林》", "《广记》",
    "举人", "县令",
]
# 低俗/不当内容关键词
VULGAR_MARKERS = ["处女膜", "强奸", "卖淫", "操他妈", "阳物", "妓女"]
# 西方文化背景标志（翻译笑话，需要背景才懂）
WESTERN_CULTURE_MARKERS = [
    "牧师", "神父", "教堂", "礼拜堂", "教徒", "圣母玛丽亚",
    "纳粹", "二战期间", "世界大战期间", "诺曼底",
    "法郎", "英镑", "美元", "美分", "橄榄球", "棒球",
    "3K党", "3k党", "芝加哥", "克林顿", "希拉里",
    "肯尼迪", "赫鲁晓夫", "卡特总统", "BBC广播",
    "普林斯顿", "日内瓦", "佛罗里达", "拉登",
    "约瑟夫二世", "维也纳皇家",
]
# 西式人名（多个出现 = 纯翻译）
WESTERN_NAMES = [
    "汤姆", "杰克", "约翰", "彼得", "布朗", "尼克", "史密斯",
    "玛丽", "安妮", "露西", "苏珊", "贝西", "格伦", "布劳",
    "阿斯德", "鲁提斯", "琼斯先生", "琼斯太太",
    "威尔", "克拉拉", "贝尼",
]
# HTML残留模式
HTML_PATTERN = re.compile(r'&nbsp;|&lt;|&gt;|<br\s*/?>|&amp;|&quot;|&#39;')

def quality_check(title, content):
    """质量检查，返回 (pass: bool, reason: str)"""
    clen = len(content.strip())
    full = title + content
    
    # 1. 内容太短
    if clen < 15:
        return False, f"太短({clen}字)"
    
    # 2. HTML残留
    if HTML_PATTERN.search(content):
        return False, "HTML残留"
    
    # 3. 古文笑话（3+古文标志 → 文言文阅读理解）
    classical_count = sum(1 for m in CLASSICAL_MARKERS if m in full)
    if classical_count >= 3:
        return False, "古文笑话"
    # 2-4字标题 + 2+古文标志 → 大概率笑林广记
    if re.match(r'^.{2,4}$', title) and classical_count >= 2 and clen > 30:
        return False, "古风标题+古文"
    
    # 4. 低俗内容
    for v in VULGAR_MARKERS:
        if v in full:
            return False, f"低俗({v})"
    
    # 5. 西方文化背景（翻译笑话）
    for marker in WESTERN_CULTURE_MARKERS:
        if marker in full:
            return False, f"西方文化({marker})"
    # 多个西式人名 = 纯翻译
    name_hits = [n for n in WESTERN_NAMES if n in content]
    if len(name_hits) >= 2:
        return False, f"翻译笑话({','.join(name_hits)})"
    
    return True, ""

def save_jokes(jokes):
    """保存到数据库，带质量过滤"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 获取最大ID
    cursor.execute("SELECT MAX(id) FROM jokes")
    max_id = cursor.fetchone()[0] or 0
    next_id = max_id + 1
    
    today = time.strftime("%Y-%m-%d")
    count = 0
    skipped_quality = 0
    
    for item in jokes:
        title = item.get('title', '')
        content = item.get('content', '')
        
        if not content:
            continue
        
        # 检查是否已存在（相同内容）
        cursor.execute("SELECT id FROM jokes WHERE content = ?", (content,))
        if cursor.fetchone():
            print(f"    跳过重复内容: {title[:20]}...")
            continue
        
        # 检查标题是否已存在（相同标题且标题>2字）
        if len(title.strip()) > 2:
            cursor.execute("SELECT id FROM jokes WHERE title = ? AND status='approved'", (title,))
            if cursor.fetchone():
                print(f"    跳过重复标题: {title[:20]}...")
                continue
        
        # 质量过滤
        passed, reason = quality_check(title, content)
        if not passed:
            print(f"    跳过低质({reason}): {title[:20]}...")
            skipped_quality += 1
            continue
        
        # 插入，自动approved
        cursor.execute("""
            INSERT INTO jokes (id, category, title, content, likes, status, date)
            VALUES (?, '搞笑', ?, ?, 0, 'approved', ?)
        """, (next_id, title, content, today))
        
        print(f"    新增 #{next_id}: {title[:30]}...")
        next_id += 1
        count += 1
    
    conn.commit()
    conn.close()
    return count, skipped_quality

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
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    print("=" * 50)
    print(f"获取天行API笑话 - {now}")
    print("规则：先停服务 → 删差评(👎≥3且👎>👍) + 新增 → 再启动服务")
    print("=" * 50)
    
    import subprocess
    
    # Step 0: 先停止服务！
    # 关键：sql.js 是内存数据库，旧进程退出时会把内存数据写回文件
    # 如果先写文件再重启，旧进程退出时会覆盖新写入的数据
    print("\nStep 0: 停止服务（防止内存数据覆盖文件）")
    subprocess.run(['pm2', 'stop', 'yanten-api'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2)  # 等待进程完全退出
    print("  服务已停止")
    
    # Step 1: 清理差评笑话
    print("\nStep 1: 清理差评笑话")
    cleanup_bad_jokes()
    
    # Step 2: 新增笑话
    print("\nStep 2: 新增笑话")
    total = 0
    
    total_skipped = 0
    
    # 获取笑话（多页）
    print("\n获取笑话:")
    for page in range(1, 11):  # 10页
        try:
            jokes = fetch_jokes(num=10, page=page)
            if jokes:
                count, skipped = save_jokes(jokes)
                total += count
                total_skipped += skipped
                print(f"  page {page}: 获取 {len(jokes)} 条，新增 {count} 条，跳过 {skipped} 条低质")
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
            count, skipped = save_jokes(jokes)
            total += count
            total_skipped += skipped
            print(f"  神回复: 获取 {len(jokes)} 条，新增 {count} 条，跳过 {skipped} 条低质")
    except Exception as e:
        print(f"  神回复: 错误 - {e}")
    
    print("=" * 50)
    # Step 3: 启动服务（从文件读取最新数据到内存）
    print("\nStep 3: 启动服务（从文件加载数据）")
    subprocess.run(['pm2', 'start', 'yanten-api'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print("  服务已启动")
    
    print("=" * 50)
    print(f"完成！新增 {total} 条笑话，过滤掉 {total_skipped} 条低质量")
    print("状态：approved（自动通过）")
    print("=" * 50)

if __name__ == "__main__":
    main()
