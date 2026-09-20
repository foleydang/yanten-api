#!/usr/bin/env python3
"""笑话质量审核 v2 - 多维度评分 + 批量处理"""
import sqlite3
import re
import sys

DB_PATH = "data/database/main.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ===== 评分规则（扣分制，初始100分）=====

def score_joke(joke):
    """返回 (score, reasons_list)"""
    title = joke['title'] or ''
    content = joke['content'] or ''
    full = title + content
    score = 100
    reasons = []
    
    clen = len(content.strip())
    
    # ---- 长度问题 ----
    if clen < 15:
        score -= 50
        reasons.append(f"太短({clen}字)")
    elif clen < 25:
        score -= 25
        reasons.append(f"偏短({clen}字)")
    elif clen > 500:
        score -= 15
        reasons.append(f"太长({clen}字)")
    
    # ---- 古文/文言文笑话（现代人看不懂）----
    classical_markers = [
        "某人", "一人", "有人", "有客", "客问", "答曰", "其人",
        "遂", "乃", "曰：", "之乎", "者也", "亦", "矣",
        "笑林", "广记", "县官", "书生", "秀才", "相公",
        "员外", "财主", "仆人", "书僮", "和尚", "僧",
    ]
    classical_count = sum(1 for m in classical_markers if m in full)
    if classical_count >= 3:
        score -= 40
        reasons.append("古文风格")
    elif classical_count >= 2 and clen > 50:
        score -= 20
        reasons.append("半文言")
    
    # ---- 特定古文笑话标题模式 ----
    classical_title_patterns = [
        r'^.{2,4}$',  # 2-4字的古风标题
    ]
    if any(re.match(p, title) for p in classical_title_patterns) and classical_count >= 1:
        score -= 20
        reasons.append("古风标题")
    
    # ---- 笑林广记/古代笑话集原文或改编 ----
    # 这类笑话对现代人来说像文言文阅读理解
    xiaolin_markers = [
        "笑林广记", "一人", "某日", "某人曰", "或问", "答曰",
        "延师", "东家", "秀才", "监生", "县官", "财主",
        "相公曰", "其妻", "其夫", "乃曰", "遂", "因曰",
    ]
    xiaolin_count = sum(1 for m in xiaolin_markers if m in full)
    # 如果有2+笑林标志 且 标题是2-4字古风 且 内容>30字（是完整古文笑话）
    if xiaolin_count >= 2 and re.match(r'^.{2,4}$', title) and clen > 30:
        score -= 25
        reasons.append("古代笑话集")
    
    # ---- HTML/格式残留 ----
    if re.search(r'&nbsp;|&lt;|&gt;|<br\s*/?>|&amp;', content):
        score -= 20
        reasons.append("HTML残留")
    
    # ---- 纯问答体（知乎段子，通常质量低）----
    # title是问句，content是短句回答
    if re.search(r'[？?]$', title.strip()) and clen < 30:
        score -= 20
        reasons.append("问答段子")
    
    # ---- 伤感/鸡汤/语录（不是笑话）----
    sentiment_markers = [
        "心结", "伤感", "薄命", "离开", "分手", "忘不了",
        "孤独", "寂寞", "遗憾", "心痛", "流泪", "眼泪",
    ]
    if sum(1 for m in sentiment_markers if m in full) >= 2:
        score -= 30
        reasons.append("伤感语录")
    
    # ---- 过时的明星/时事梗 ----
    outdated_celebs = [
        "孙燕姿", "王菲", "谢霆锋", "张柏芝", "王力宏",
        "辛普森", "卓别林", "阿凡提", "留几手",
        "戚务生", "郝海东", "黎兵",  # 90年代足球
    ]
    celeb_hits = [c for c in outdated_celebs if c in full]
    if celeb_hits:
        score -= 15
        reasons.append(f"过时梗({','.join(celeb_hits)})")
    
    # ---- 低俗/不当内容 ----
    vulgar_markers = [
        "处女膜", "卖淫", "强奸", "禽兽",
        "屎住", "木有小JJ", "小JJ",
    ]
    vulgar_hits = [v for v in vulgar_markers if v in full]
    if vulgar_hits:
        score -= 40
        reasons.append(f"低俗({','.join(vulgar_hits)})")
    
    # ---- 无意义回复 ----
    if content.strip() in ["嗯", "哦", "啊", "是的", "不是", "对", "在", "手", "卖精"]:
        score -= 60
        reasons.append("无意义回复")
    
    # ---- "神回复"类但回复太短无笑点 ----
    if joke.get('category') in ['搞笑'] and clen <= 8:
        if not re.search(r'[！!？?。，,]', content.strip()):
            score -= 20
            reasons.append("短且无标点")
    
    return score, reasons


def run_review(conn, threshold=55, action="show"):
    """执行审核"""
    cursor = conn.cursor()
    cursor.execute("SELECT id, category, title, content FROM jokes WHERE status='approved' ORDER BY id")
    rows = cursor.fetchall()
    
    bad_jokes = []
    borderline = []
    
    for row in rows:
        joke = dict(row)
        score, reasons = score_joke(joke)
        joke['score'] = score
        joke['reasons'] = reasons
        
        if score < threshold:
            bad_jokes.append(joke)
        elif score < threshold + 15:
            borderline.append(joke)
    
    if action == "show":
        print(f"=== 评分 < {threshold} 分（建议删除）: {len(bad_jokes)} 条 ===\n")
        for j in bad_jokes:
            print(f"  [{j['id']:4d}] {j['score']:3d}分 {','.join(j['reasons']):20s} | {j['title'][:20]} | {j['content'][:50]}")
        
        print(f"\n=== 评分 {threshold}-{threshold+14} 分（待确认）: {len(borderline)} 条 ===\n")
        for j in borderline:
            print(f"  [{j['id']:4d}] {j['score']:3d}分 {','.join(j['reasons']):20s} | {j['title'][:20]} | {j['content'][:50]}")
        
        print(f"\n总计: 建议删除 {len(bad_jokes)} 条, 待确认 {len(borderline)} 条, 保留 {len(rows)-len(bad_jokes)-len(borderline)} 条")
    
    elif action == "delete":
        ids = [j['id'] for j in bad_jokes]
        for jid in ids:
            cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
        conn.commit()
        print(f"已删除 {len(ids)} 条低质量笑话（评分 < {threshold}）")
        
        # borderline 标记为 pending
        border_ids = [j['id'] for j in borderline]
        for jid in border_ids:
            cursor.execute("UPDATE jokes SET status='pending' WHERE id=?", (jid,))
        conn.commit()
        print(f"已将 {len(border_ids)} 条待确认笑话标记为 pending")
    
    elif action == "delete-only":
        ids = [j['id'] for j in bad_jokes]
        for jid in ids:
            cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
        conn.commit()
        print(f"已删除 {len(ids)} 条低质量笑话（评分 < {threshold}）")
    
    return bad_jokes, borderline


if __name__ == "__main__":
    conn = get_conn()
    
    threshold = int(sys.argv[2]) if len(sys.argv) > 2 else 55
    action = sys.argv[1] if len(sys.argv) > 1 else "show"
    
    run_review(conn, threshold=threshold, action=action)
    conn.close()
