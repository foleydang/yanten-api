#!/usr/bin/env python3
"""笑话库第三轮清理"""
import sqlite3
import re

DB_PATH = "data/database/main.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def cleanup(conn):
    cursor = conn.cursor()
    deleted = 0
    
    # ===== 1. 遗漏的古文笑话 =====
    print("=== 1. 遗漏的古文笑话 ===")
    # 内容中有明显的古文特征词
    classical_content_markers = [
        "曰：", "曰:", "其人", "遂", "乃", "亦", "因曰",
        "《风俗通》", "《笑林》", "《广记》",
    ]
    # 标题是2-4字古风 + 内容有古文特征
    cursor.execute("SELECT id, title, content FROM jokes WHERE status='approved'")
    rows = cursor.fetchall()
    classical_ids = []
    for r in rows:
        title = r['title'] or ''
        content = r['content'] or ''
        # 短标题(2-4字) + 多个古文标志
        if len(title) <= 4 and len(title) >= 2:
            marker_count = sum(1 for m in classical_content_markers if m in content)
            # 如果内容有3+古文标志，且长度>40字（完整的古文笑话）
            if marker_count >= 3 and len(content) > 40:
                classical_ids.append(r['id'])
                print(f"    古文 [{r['id']}] {title}: {content[:50]}...")
            # 特别处理：内容里有"答曰"/"或问"/"因曰"等强古文标志
            elif any(m in content for m in ["答曰", "或问", "因曰", "乃曰"]) and len(content) > 30:
                classical_ids.append(r['id'])
                print(f"    古文 [{r['id']}] {title} (强标志): {content[:50]}...")
    
    for jid in classical_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  古文删除: {len(classical_ids)} 条")
    deleted += len(classical_ids)
    
    # ===== 2. 遗漏的翻译笑话 =====
    print("\n=== 2. 遗漏的翻译笑话 ===")
    # 西式人名（之前漏掉的）
    more_western_names = ["贝尼", "琼斯先生", "琼斯太太", "威尔", "克拉拉"]
    foreign_name_ids = []
    for name in more_western_names:
        cursor.execute("SELECT id, title FROM jokes WHERE status='approved' AND content LIKE ?", (f'%{name}%',))
        for r in cursor.fetchall():
            if r['id'] not in foreign_name_ids:
                foreign_name_ids.append(r['id'])
                print(f"    翻译 [{r['id']}] {r['title']} (因: {name})")
    
    for jid in foreign_name_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  翻译删除: {len(foreign_name_ids)} 条")
    deleted += len(foreign_name_ids)
    
    # ===== 3. HTML实体残留 =====
    print("\n=== 3. HTML实体残留 ===")
    cursor.execute("""
        SELECT id, title, content FROM jokes WHERE status='approved' 
        AND (content LIKE '%&quot;%' OR content LIKE '%&#39;%' OR content LIKE '%&#x27;%')
    """)
    html_ids = []
    for r in cursor.fetchall():
        html_ids.append(r['id'])
        print(f"    HTML [{r['id']}] {r['title']}")
    
    for jid in html_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  HTML删除: {len(html_ids)} 条")
    deleted += len(html_ids)
    
    # ===== 4. 过时科技梗 =====
    print("\n=== 4. 过时科技梗 ===")
    outdated_tech = ["KV", "拨号上网", "ICQ", "MSN", "软盘", "软驱", "光盘", "386", "486", "586"]
    tech_ids = []
    for kw in outdated_tech:
        cursor.execute("SELECT id, title FROM jokes WHERE status='approved' AND content LIKE ?", (f'%{kw}%',))
        for r in cursor.fetchall():
            if r['id'] not in tech_ids:
                tech_ids.append(r['id'])
                print(f"    过时 [{r['id']}] {r['title']} (因: {kw})")
    
    for jid in tech_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  过时删除: {len(tech_ids)} 条")
    deleted += len(tech_ids)
    
    # ===== 5. 更多重复标题（保留内容更长的）=====
    print("\n=== 5. 重复标题去重 ===")
    cursor.execute("""
        SELECT title, COUNT(*) as cnt FROM jokes 
        WHERE status='approved' AND title != '无题' AND LENGTH(title) > 2
        GROUP BY title HAVING COUNT(*) > 1
    """)
    dup_titles = cursor.fetchall()
    dup_title_ids = []
    for row in dup_titles:
        title = row['title']
        cursor.execute("""
            SELECT id, LENGTH(content) as clen FROM jokes 
            WHERE status='approved' AND title=? 
            ORDER BY clen DESC
        """, (title,))
        entries = cursor.fetchall()
        # 保留第一条（内容最长的），删除其余
        for entry in entries[1:]:
            dup_title_ids.append(entry['id'])
    
    for jid in dup_title_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  重复标题删除: {len(dup_title_ids)} 条")
    deleted += len(dup_title_ids)
    
    conn.commit()
    
    cursor.execute("SELECT COUNT(*) FROM jokes WHERE status='approved'")
    remaining = cursor.fetchone()[0]
    
    print(f"\n{'='*50}")
    print(f"本轮共删除: {deleted} 条")
    print(f"剩余 approved: {remaining} 条")
    print(f"{'='*50}")


if __name__ == "__main__":
    conn = get_conn()
    cleanup(conn)
    conn.close()
