#!/usr/bin/env python3
"""笑话质量审核脚本 - 自动标记 + 人工确认删除"""
import sqlite3
import re
import json

DB_PATH = "data/database/main.db"

# ===== 自动标记规则 =====

# 1. 内容太短（< 10字符），基本是废数据
MIN_CONTENT_LEN = 10

# 2. 古文/诗词类关键词（这些不是笑话）
CLASSICAL_KEYWORDS = [
    "诗经", "论语", "鹊桥仙", "凤栖梧", "击鼓《", "三五七言",
    "柳永", "秦观", "白居易", "杜甫", "王维", "孟浩然",
    "衣带渐宽", "死生契阔", "执子之手", "两情若是久长",
    "相思相见知何日", "有美人兮", "关关雎鸠",
]

# 3. 不是笑话的内容模式（伤感语录、人生感悟、直男发言等）
NOT_JOKE_PATTERNS = [
    # 纯问答但没有笑点的
    (r'^.{2,8}[。.！!？?]$', "太短无笑点"),
    # HTML残留
    (r'&nbsp;|&lt;|&gt;|<br\s*/?>', "HTML残留"),
]

# 4. 明确的低质量/不合适内容
BAD_CONTENT_KEYWORDS = [
    "长得漂亮",  # 直男发言不是笑话
    "面由心生",  # 冷知识不是笑话
]


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def auto_flag(conn):
    """自动标记明显低质量笑话"""
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, content, category FROM jokes WHERE status='approved'")
    rows = cursor.fetchall()
    
    flagged = []
    
    for row in rows:
        jid, title, content, category = row['id'], row['title'], row['content'], row['category']
        reason = None
        
        # 规则1: 内容太短
        if len(content.strip()) < MIN_CONTENT_LEN:
            reason = f"内容太短({len(content.strip())}字符)"
        
        # 规则2: 古文/诗词
        elif any(kw in content or kw in title for kw in CLASSICAL_KEYWORDS):
            # 但如果是用古文梗做笑话（如"李白外传"），保留
            if "李白外传" in title or "日照香炉" in content:
                pass  # 这是改编笑话，保留
            else:
                reason = "古文/诗词非笑话"
        
        # 规则3: 正则模式
        else:
            for pattern, desc in NOT_JOKE_PATTERNS:
                if re.search(pattern, content):
                    reason = desc
                    break
        
        # 规则4: 明确的低质量
        if not reason:
            for kw in BAD_CONTENT_KEYWORDS:
                if content.strip() == kw or (len(content.strip()) < 15 and kw in content):
                    reason = f"低质量: {kw}"
                    break
        
        if reason:
            flagged.append({
                "id": jid,
                "title": title,
                "content": content[:80],
                "reason": reason
            })
    
    return flagged


def review_batch(conn, joke_ids, action="delete"):
    """批量处理笑话"""
    cursor = conn.cursor()
    if action == "delete":
        for jid in joke_ids:
            cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
        conn.commit()
        print(f"已标记 {len(joke_ids)} 条笑话为 rejected")
    elif action == "pending":
        for jid in joke_ids:
            cursor.execute("UPDATE jokes SET status='pending' WHERE id=?", (jid,))
        conn.commit()
        print(f"已标记 {len(joke_ids)} 条笑话为 pending（待人工确认）")


def stats(conn):
    """显示统计"""
    cursor = conn.cursor()
    cursor.execute("SELECT status, COUNT(*) as cnt FROM jokes GROUP BY status")
    for row in cursor.fetchall():
        print(f"  {row['status']}: {row['cnt']}")


if __name__ == "__main__":
    import sys
    conn = get_connection()
    
    if len(sys.argv) > 1 and sys.argv[1] == "flag":
        # 自动标记模式
        flagged = auto_flag(conn)
        print(f"自动标记了 {len(flagged)} 条笑话:\n")
        for f in flagged:
            print(f"  [{f['id']}] {f['reason']}: {f['title']} | {f['content'][:60]}")
        
        if flagged:
            ids = [f['id'] for f in flagged]
            print(f"\n共 {len(ids)} 条，执行标记为 rejected...")
            review_batch(conn, ids, "delete")
    
    elif len(sys.argv) > 1 and sys.argv[1] == "stats":
        print("笑话状态统计:")
        stats(conn)
    
    elif len(sys.argv) > 1 and sys.argv[1] == "export":
        # 导出待审核的JSON给AI review
        cursor = conn.cursor()
        cursor.execute("SELECT id, category, title, content FROM jokes WHERE status='approved' ORDER BY id")
        rows = cursor.fetchall()
        
        batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 200
        batch_start = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        
        batch = rows[batch_start:batch_start + batch_size]
        result = []
        for r in batch:
            result.append({
                "id": r['id'],
                "category": r['category'],
                "title": r['title'],
                "content": r['content']
            })
        
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print(f"\n// 批次: {batch_start}-{batch_start+batch_size}, 共 {len(result)} 条", file=sys.stderr)
    
    else:
        print("用法:")
        print("  python3 review_jokes.py flag     - 自动标记并删除明显低质量")
        print("  python3 review_jokes.py stats    - 显示状态统计")
        print("  python3 review_jokes.py export [batch_size] [offset] - 导出批次供AI审核")
    
    conn.close()
