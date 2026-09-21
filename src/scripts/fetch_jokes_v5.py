#!/usr/bin/env python3
"""
哇哇笑多源笑话抓取脚本 v3
- TianAPI 笑话 + 脑筋急转弯
- ALAPI 笑话
- 智能分类 + 标题生成
- 儿童适宜性过滤
- 去重检查
"""

import sqlite3
import requests
import json
import re
import hashlib
import time
import random
from datetime import datetime, date

DB_FILE = '/root/github/yanten-api/data/database/main.db'

# === API 配置 ===
TIANAPI_KEY = '870a7f7c0ee13224754ceb077b5a4adc'
ALAPI_TOKEN = '2emlih5umpvcpwkownzbgbo6avhqiz'

# === 分类规则 ===
CATEGORY_RULES = {
    '校园': ['老师', '小明', '同学', '考试', '上课', '作业', '学生', '校长', '宿舍',
             '语文', '数学', '英语', '小红', '小刚', '同桌', '班主任', '幼儿园',
             '小学', '中学', '大学', '下课', '开学'],
    '动物': ['小狗', '小猫', '兔子', '猴子', '大象', '老虎', '狮子', '老鼠', '蚂蚁',
             '乌龟', '小鸟', '熊', '蛇', '马', '牛', '羊', '鸡', '鸭', '鹅',
             '动物', '宠物', '蝴蝶', '蜜蜂', '螃蟹', '青蛙', '蜗牛', '鲸鱼'],
    '家庭': ['爸爸', '妈妈', '爷爷', '奶奶', '儿子', '女儿', '孩子', '姥姥', '姥爷',
             '叔叔', '阿姨', '弟弟', '妹妹', '哥哥', '姐姐', '父母', '家长', '爸妈'],
    '食物': ['吃饭', '饺子', '面条', '苹果', '蛋糕', '糖果', '冰淇淋', '零食',
             '牛奶', '面包', '米饭', '做饭', '美食', '汉堡', '西瓜', '香蕉',
             '巧克力', '饼干', '火锅', '烧烤', '减肥', '吃货'],
    '医院': ['医生', '医院', '护士', '吃药', '打针', '看病', '发烧', '感冒',
             '牙医', '病人', '住院', '门诊', '中医', '挂号', '急诊'],
    '交通': ['公交', '地铁', '火车', '飞机', '打车', '开车', '出租车', '高铁',
             '自行车', '电动车', '摩托车', '大巴', '司机', '交警', '堵车'],
    '职场': ['老板', '公司', '加班', '面试', '同事', '工资', '程序员', '经理',
             '上班', '下班', '辞职', '简历', '实习', '主管', '年终奖', '开会'],
    '节日': ['过年', '春节', '中秋', '元宵', '端午', '国庆', '圣诞', '元旦',
             '除夕', '拜年', '红包', '压岁钱', '团圆', '教师节', '儿童节'],
}

# === 不适宜儿童内容检测 ===
INAPPROPRIATE = {
    '成人': ['老婆', '丈夫', '夫妻', '妻子', '老公', '小三', '出轨', '偷情', '妓',
             '嫖', '处女', '强奸', '性', '情人', '包养', '二奶', '劈腿', '床戏'],
    '酒精': ['喝酒', '醉酒', '酒鬼', '酗酒', '拼酒'],
    '暴力': ['棺材', '死人', '坟地', '杀人', '凶杀', '自杀', '跳楼'],
    '军事': ['士兵', '将军', '军队', '战争', '炮弹', '手榴弹', '原子弹'],
    '翻译': ['汤姆', '杰克', '约翰', '彼得', '玛丽', '布朗', '史密斯', '威廉'],
    '古文': ['答曰', '乃曰', '秀才', '监生', '县官', '员外', '陛下', '寡人'],
    '低俗': ['屎', '尿', '屁', '屁股', '茅坑', '脱裤'],
}

def classify(content):
    """智能分类"""
    scores = {}
    for cat, keywords in CATEGORY_RULES.items():
        score = sum(2 for kw in keywords if kw in content)
        if score > 0:
            scores[cat] = score
    if not scores:
        return '生活'
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else '生活'

def is_inappropriate(content):
    """检查是否不适合儿童"""
    for issue, patterns in INAPPROPRIATE.items():
        hits = sum(1 for p in patterns if p in content)
        if hits >= 2:
            return True, issue
        if issue in ('成人', '低俗') and hits >= 1:
            return True, issue
    return False, ''

def clean(content):
    """清理内容"""
    content = content.replace('\r\n', '\n').replace('\r', '\n')
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'<[^>]+>', '', content)
    content = content.replace('&nbsp;', ' ')
    content = content.replace('"', '"').replace('"', '"')
    content = content.replace(''', "'").replace(''', "'")
    lines = [l.strip() for l in content.split('\n')]
    content = '\n'.join(lines)
    content = re.sub(r'\n{3,}', '\n\n', content)
    return content.strip()

def gen_title(content, category):
    """生成标题"""
    first = content.split('\n')[0].split('。')[0].split('！')[0].split('？')[0].strip()
    if 4 <= len(first) <= 12:
        return first
    scenes = {
        '老师': '老师的问题', '小明': '小明趣事', '考试': '考试趣闻',
        '医生': '看医生', '老板': '老板说的', '公交': '公交车上',
        '打车': '打车记', '火车': '火车上', '飞机': '飞机上',
        '妈妈': '妈妈说', '爸爸': '爸爸说', '奶奶': '奶奶说',
        '猫': '小猫的故事', '狗': '小狗的故事',
        '猴子': '猴子的故事', '兔子': '兔子的故事',
        '吃饭': '吃饭趣事', '饺子': '包饺子', '减肥': '减肥记',
    }
    for kw, title in scenes.items():
        if kw in content[:100]:
            return title
    if '：' in content or ':' in content:
        parts = re.split(r'[：:]', content)
        if len(parts) > 1 and len(parts[1].strip()) >= 4:
            return parts[1].strip()[:10]
    return content[:8].replace('\n', '').strip() or '趣事'

def normalize_content(content):
    """标准化内容用于去重：去空白、去标点、转小写"""
    import re
    # 去除所有空白和标点
    text = re.sub(r'[\s\u3000\uff0c\uff01\uff1f\u3001\u3002\u201c\u201d\u2018\u2019\"\'!,.?;:]', '', content)
    return text.lower()

def is_duplicate(content, db, threshold=0.8):
    """去重：标准化后完全匹配 OR 前后缀包含"""
    normalized = normalize_content(content)
    if not normalized or len(normalized) < 10:
        return False
    # 方法1: 标准化后前30字完全匹配
    prefix = normalized[:30]
    existing = db.execute(
        "SELECT id FROM jokes WHERE substr(replace(replace(lower(content),' ',''),'\n',''),1,30)=? LIMIT 1",
        (prefix,)
    ).fetchone()
    if existing:
        return True
    # 方法2: 内容前20字出现在已有笑话中
    prefix20 = normalized[:20]
    existing2 = db.execute(
        "SELECT id FROM jokes WHERE instr(replace(replace(lower(content),' ',''),'\n',''),?) > 0 LIMIT 1",
        (prefix20,)
    ).fetchone()
    return existing2 is not None

# === 数据源 ===

def fetch_tianapi_jokes(num=10):
    """TianAPI 笑话"""
    url = f'http://api.tianapi.com/joke/index?key={TIANAPI_KEY}&num={num}&rand=1'
    try:
        resp = requests.get(url, timeout=15)
        data = resp.json()
        if data.get('code') != 200:
            print(f"  TianAPI错误: {data.get('msg')}")
            return []
        jokes = []
        for item in data.get('newslist', []):
            content = clean(item.get('content', ''))
            if not content or len(content) < 20:
                continue
            inapp, reason = is_inappropriate(content)
            if inapp:
                continue
            jokes.append({
                'title': gen_title(content, classify(content)),
                'content': content,
                'category': classify(content),
                'source': 'tianapi'
            })
        return jokes
    except Exception as e:
        print(f"  TianAPI失败: {e}")
        return []

def fetch_tianapi_brain_teasers(num=10):
    """TianAPI 脑筋急转弯 - 非常适合小朋友！"""
    url = f'http://api.tianapi.com/naowan/index?key={TIANAPI_KEY}&num={num}'
    try:
        resp = requests.get(url, timeout=15)
        data = resp.json()
        if data.get('code') != 200:
            print(f"  脑筋急转弯API错误: {data.get('msg')}")
            return []
        jokes = []
        for item in data.get('newslist', []):
            question = clean(item.get('quest', ''))
            answer = clean(item.get('result', ''))
            if not question or not answer:
                continue
            # 格式化为笑话格式
            content = f"问：{question}\n答：{answer}"
            jokes.append({
                'title': question[:12] if len(question) > 12 else question,
                'content': content,
                'category': '生活',
                'source': 'tianapi_naowan'
            })
        return jokes
    except Exception as e:
        print(f"  脑筋急转弯失败: {e}")
        return []

def fetch_alapi_jokes(num=10):
    """ALAPI 笑话"""
    url = f'https://v3.alapi.cn/api/joke?token={ALAPI_TOKEN}&num={num}'
    try:
        resp = requests.get(url, timeout=15)
        data = resp.json()
        if not data.get('success'):
            print(f"  ALAPI错误: {data.get('message')}")
            return []
        jokes = []
        for item in data.get('data', []):
            content = clean(item.get('content', ''))
            if not content or len(content) < 20:
                continue
            inapp, reason = is_inappropriate(content)
            if inapp:
                continue
            jokes.append({
                'title': gen_title(content, classify(content)),
                'content': content,
                'category': classify(content),
                'source': 'alapi'
            })
        return jokes
    except Exception as e:
        print(f"  ALAPI失败: {e}")
        return []

def save_jokes(jokes, db):
    """保存到数据库"""
    saved = 0
    for j in jokes:
        if is_duplicate(j['content'], db):
            continue
        today = date.today().isoformat()
        db.execute(
            "INSERT INTO jokes (category, title, content, likes, status, date, source, created_at) "
            "VALUES (?, ?, ?, ?, 'approved', ?, ?, ?)",
            (j['category'], j['title'], j['content'], random.randint(3, 15),
             today, j['source'], int(datetime.now().timestamp()))
        )
        saved += 1
    db.commit()
    return saved

def main():
    conn = sqlite3.connect(DB_FILE)
    
    # 统计现有
    total = conn.execute("SELECT COUNT(*) FROM jokes WHERE status='approved'").fetchone()[0]
    print(f"当前笑话库: {total} 条\n")
    
    # 分类统计
    cats = conn.execute(
        "SELECT category, COUNT(*) FROM jokes WHERE status='approved' GROUP BY category ORDER BY COUNT(*) DESC"
    ).fetchall()
    print("当前分类分布:")
    for cat, cnt in cats:
        print(f"  {cat}: {cnt}")
    print()
    
    # === 抓取笑话 ===
    print("=" * 40)
    print("1. 抓取 TianAPI 笑话 (10条)")
    print("=" * 40)
    tianapi_jokes = fetch_tianapi_jokes(10)
    print(f"  获取有效笑话: {len(tianapi_jokes)} 条")
    saved1 = save_jokes(tianapi_jokes, conn)
    print(f"  新增入库: {saved1} 条")
    
    print()
    print("=" * 40)
    print("2. 抓取 TianAPI 脑筋急转弯 (10条)")
    print("=" * 40)
    brain_jokes = fetch_tianapi_brain_teasers(10)
    print(f"  获取有效脑筋急转弯: {len(brain_jokes)} 条")
    saved2 = save_jokes(brain_jokes, conn)
    print(f"  新增入库: {saved2} 条")
    
    print()
    print("=" * 40)
    print("3. 抓取 ALAPI 笑话 (10条)")
    print("=" * 40)
    alapi_jokes = fetch_alapi_jokes(10)
    print(f"  获取有效笑话: {len(alapi_jokes)} 条")
    saved3 = save_jokes(alapi_jokes, conn)
    print(f"  新增入库: {saved3} 条")
    
    # 最终统计
    print()
    print("=" * 40)
    print("抓取完成！")
    print("=" * 40)
    total_new = saved1 + saved2 + saved3
    print(f"本次新增: {total_new} 条")
    total_after = conn.execute("SELECT COUNT(*) FROM jokes WHERE status='approved'").fetchone()[0]
    print(f"笑话库总数: {total_after} 条")
    
    print("\n更新后分类分布:")
    cats = conn.execute(
        "SELECT category, COUNT(*) FROM jokes WHERE status='approved' GROUP BY category ORDER BY COUNT(*) DESC"
    ).fetchall()
    for cat, cnt in cats:
        print(f"  {cat}: {cnt}")
    
    conn.close()

if __name__ == '__main__':
    main()
