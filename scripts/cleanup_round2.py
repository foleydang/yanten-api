#!/usr/bin/env python3
"""笑话库第二轮清理 - 去重 + 去低俗 + 去太外国的"""
import sqlite3

DB_PATH = "data/database/main.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def cleanup(conn):
    cursor = conn.cursor()
    deleted = 0
    
    # ===== 1. 去除重复内容（保留ID最小的） =====
    print("=== 1. 去重 ===")
    cursor.execute("""
        SELECT MIN(id) as keep_id, content, COUNT(*) as cnt 
        FROM jokes WHERE status='approved'
        GROUP BY content HAVING COUNT(*) > 1
    """)
    dups = cursor.fetchall()
    dup_ids = []
    for row in dups:
        keep_id = row['keep_id']
        content = row['content']
        # 找到所有相同content但id != keep_id的
        cursor.execute("""
            SELECT id FROM jokes WHERE status='approved' AND content=? AND id != ?
        """, (content, keep_id))
        for r in cursor.fetchall():
            dup_ids.append(r['id'])
    
    for jid in dup_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  去重删除: {len(dup_ids)} 条")
    deleted += len(dup_ids)
    
    # ===== 2. 低俗/脏话 =====
    print("\n=== 2. 低俗内容 ===")
    vulgar_keywords = [
        "操他妈", "他妈的猫", "脱光衣服", "性交", 
        "阳物", "妓女", "嫖",
    ]
    vulgar_ids = []
    for kw in vulgar_keywords:
        cursor.execute("SELECT id, title FROM jokes WHERE status='approved' AND content LIKE ?", (f'%{kw}%',))
        for r in cursor.fetchall():
            if r['id'] not in vulgar_ids:
                vulgar_ids.append(r['id'])
                print(f"    低俗 [{r['id']}] {r['title']}")
    
    for jid in vulgar_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  低俗删除: {len(vulgar_ids)} 条")
    deleted += len(vulgar_ids)
    
    # ===== 3. 太美国/西方的（需要背景知识）=====
    print("\n=== 3. 太外国的 ===")
    # 这些是中国人基本不了解的背景
    too_foreign_keywords = [
        "3K党", "3k党",
        "芝加哥",
        "克林顿", "希拉里", "戈尔",
        "肯尼迪", "凯弗维尔",
        "赫鲁晓夫",
        "卡特总统",
        "BBC广播电台",
        "普林斯顿",
        "日内瓦",
        "维也纳皇家",
        "约瑟夫二世",
        "佛罗里达大风暴",
        "拉登",
    ]
    foreign_ids = []
    for kw in too_foreign_keywords:
        cursor.execute("SELECT id, title FROM jokes WHERE status='approved' AND content LIKE ?", (f'%{kw}%',))
        for r in cursor.fetchall():
            if r['id'] not in foreign_ids:
                foreign_ids.append(r['id'])
                print(f"    太外国 [{r['id']}] {r['title']} (因: {kw})")
    
    for jid in foreign_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  太外国删除: {len(foreign_ids)} 条")
    deleted += len(foreign_ids)
    
    # ===== 4. 老和尚小和尚等擦边低俗 =====
    print("\n=== 4. 擦边低俗 ===")
    borderline_vulgar = [
        "脱光", "和尚.*色", "掰开一条腿",
    ]
    import re
    cursor.execute("SELECT id, title, content FROM jokes WHERE status='approved'")
    all_rows = cursor.fetchall()
    bv_ids = []
    for r in all_rows:
        for pat in borderline_vulgar:
            if re.search(pat, r['content']):
                if r['id'] not in bv_ids:
                    bv_ids.append(r['id'])
                    print(f"    擦边 [{r['id']}] {r['title']}")
                break
    
    for jid in bv_ids:
        cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
    print(f"  擦边删除: {len(bv_ids)} 条")
    deleted += len(bv_ids)
    
    conn.commit()
    
    # 最终统计
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
