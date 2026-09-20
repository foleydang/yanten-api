#!/usr/bin/env python3
"""清理翻译笑话 - 只删需要西方文化背景才懂的"""
import sqlite3
import re
import sys

DB_PATH = "data/database/main.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ===== 强西方文化背景标志（出现即大概率看不懂）=====
HARD_WESTERN = [
    # 宗教场景
    "牧师", "神父", "教堂", "礼拜堂", "教徒", "圣母玛丽亚",
    "基督", "祷告", "禁食日", "布道",
    # 西方历史/军事
    "纳粹", "二战期间", "世界大战期间", "诺曼底",
    # 西方货币
    "法郎", "英镑", "美元", "美分",
    # 西方运动/文化
    "橄榄球", "棒球",
]

# 西式人名（出现在content里的，不是title）
WESTERN_NAMES = [
    "汤姆", "杰克", "约翰", "彼得", "布朗", "尼克", "史密斯",
    "玛丽", "安妮", "露西", "苏珊", "贝西", "格伦", "布劳",
    "阿斯德", "大卫", "保罗", "鲁提斯",
]

# 西方名人（有些笑话是通用的，有些不是）
WESTERN_CELEBS = [
    "卓别林", "辛普森", "爱因斯坦", "爱迪生", "林肯",
    "拿破仑", "华盛顿", "莎士比亚",
]


def classify(joke):
    """分类：keep / delete"""
    title = joke['title'] or ''
    content = joke['content'] or ''
    full = title + content
    
    # 1. 硬西方文化标志 → 删除
    for marker in HARD_WESTERN:
        if marker in full:
            return "delete", f"西方文化({marker})"
    
    # 2. 西式人名 + 检查是否有中国文化场景
    name_hits = [n for n in WESTERN_NAMES if n in content]
    if len(name_hits) >= 2:
        # 多个西式人名 → 大概率纯翻译
        return "delete", f"多西式人名({','.join(name_hits)})"
    elif len(name_hits) == 1:
        # 单个西式人名 → 检查笑话内容是否通用
        # 如果场景也是中国常见的（学校、家庭、医院），保留
        chinese_context = ["老师", "妈妈", "爸爸", "儿子", "女儿", 
                          "同学", "医生", "护士", "老板", "同事"]
        if any(c in full for c in chinese_context):
            return "keep", "有人名但场景通用"
        else:
            return "delete", f"单西式人名({name_hits[0]})无中式场景"
    
    # 3. 西方名人
    for celeb in WESTERN_CELEBS:
        if celeb in full:
            # 卓别林/辛普森 → 需要背景
            if celeb in ["卓别林", "辛普森"]:
                return "delete", f"需背景({celeb})"
            # 爱因斯坦/爱迪生/林肯 → 笑话通常是通用的
            else:
                return "keep", f"名人通用({celeb})"
    
    return "keep", "无明显西方背景"


def main():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, content FROM jokes WHERE status='approved' ORDER BY id")
    rows = cursor.fetchall()
    
    to_delete = []
    to_keep = []
    
    for row in rows:
        joke = dict(row)
        action, reason = classify(joke)
        if action == "delete":
            to_delete.append({**joke, "reason": reason})
        else:
            to_keep.append({**joke, "reason": reason})
    
    if len(sys.argv) > 1 and sys.argv[1] == "show":
        print(f"=== 建议删除的翻译笑话: {len(to_delete)} 条 ===\n")
        for j in to_delete:
            print(f"  [{j['id']:4d}] {j['reason']:25s} | {j['title'][:15]} | {j['content'][:60]}")
        print(f"\n=== 保留的: {len(to_keep)} 条（含西式名人但笑点通用的）===")
        kept_with_reason = [j for j in to_keep if j['reason'] != "无明显西方背景"]
        for j in kept_with_reason:
            print(f"  [{j['id']:4d}] {j['reason']:25s} | {j['title'][:15]} | {j['content'][:60]}")
    
    elif len(sys.argv) > 1 and sys.argv[1] == "delete":
        ids = [j['id'] for j in to_delete]
        for jid in ids:
            cursor.execute("UPDATE jokes SET status='rejected' WHERE id=?", (jid,))
        conn.commit()
        print(f"已删除 {len(ids)} 条需要西方文化背景的翻译笑话")
    else:
        print("用法:")
        print("  python3 clean_translated_jokes.py show    - 预览")
        print("  python3 clean_translated_jokes.py delete  - 执行删除")
    
    conn.close()


if __name__ == "__main__":
    main()
