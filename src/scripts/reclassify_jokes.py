#!/usr/bin/env python3
"""
笑话重新分类脚本
将2110条approved笑话从"搞笑"大杂烩重新归入精细分类

新分类体系:
🏫 校园 - 老师/小明/同学/考试/上课/作业
🐾 动物 - 狗/猫/猪/猴子/兔子等
👨‍👩‍👦 家庭 - 爸妈/爷爷/奶奶/儿子/女儿/孩子
😄 生活 - 其他生活趣事(医院/交通/食物/职场/节日等)
🧠 脑筋急转弯 - 趣味问答(归入生活)
"""

import sqlite3
import re
import sys
from datetime import datetime

DB_FILE = '/root/github/yanten-api/data/database/main.db'

# 分类规则：按优先级匹配，得分最高的胜出
CATEGORY_RULES = {
    '校园': {
        'keywords': ['老师', '小明', '同学', '考试', '上课', '作业', '学生', '校长', '宿舍', 
                     '语文', '数学', '英语', '老师问', '小红', '小刚', '同桌', '班主任',
                     '幼儿园', '小学', '中学', '大学', '老师师', '课堂上', '下课', '开学'],
        'weight': 2
    },
    '动物': {
        'keywords': ['小狗', '小猫', '兔子', '猴子', '大象', '老虎', '狮子', '老鼠', '蚂蚁',
                     '乌龟', '鱼', '小鸟', '熊', '蛇', '马', '牛', '羊', '鸡', '鸭', '鹅',
                     '动物', '宠物', '昆虫', '蝴蝶', '蜜蜂', '蜘蛛', '螃蟹', '虾',
                     '狗吃', '猫抓', '猪八戒', '猴', '青蛙', '蜗牛', '蝙蝠', '鲸鱼'],
        'weight': 2
    },
    '家庭': {
        'keywords': ['爸爸', '妈妈', '爷爷', '奶奶', '儿子', '女儿', '孩子', '姥姥', '姥爷',
                     '外公', '外婆', '叔叔', '阿姨', '弟弟', '妹妹', '哥哥', '姐姐',
                     '父母', '家长', '爸妈', '父子', '母女', '二胎', '带娃', '辅导作业',
                     '我儿子', '我女儿', '我家', '麻麻', '粑粑'],
        'weight': 2
    },
    '食物': {
        'keywords': ['吃饭', '饺子', '面条', '苹果', '蛋糕', '糖果', '冰淇淋', '零食',
                     '牛奶', '面包', '米饭', '做菜', '做饭', '美食', '汉堡', '薯条',
                     '西瓜', '香蕉', '葡萄', '草莓', '巧克力', '饼干', '饮料', '豆浆',
                     '油条', '包子', '馒头', '火锅', '烧烤', '减肥', '减肥药', '吃饭了',
                     '好吃的', '嘴馋', '吃货'],
        'weight': 2
    },
    '医院': {
        'keywords': ['医生', '医院', '护士', '吃药', '打针', '看病', '发烧', '感冒',
                     '牙医', '手术室', '病人', '处方', '药片', '体温', '住院', '门诊',
                     '中医', '西医', '挂号', '急诊'],
        'weight': 2
    },
    '交通': {
        'keywords': ['公交', '地铁', '火车', '飞机', '打车', '开车', '出租车', '高铁',
                     '自行车', '电动车', '摩托车', '大巴', '公交车', '地铁上', '火车上',
                     '飞机上', '司机', '交警', '红灯', '绿灯', '驾照', '停车', '堵车',
                     '加油', '加油站', '过马路'],
        'weight': 2
    },
    '职场': {
        'keywords': ['老板', '公司', '加班', '面试', '同事', '工资', '程序员', '经理',
                     '上班', '下班', '打卡', '辞职', '跳槽', 'HR', '简历', '实习',
                     '部门', '主管', '年终奖', 'KPI', 'PPT', '开会', '出差', '报销'],
        'weight': 2
    },
    '节日': {
        'keywords': ['过年', '春节', '中秋', '元宵', '端午', '国庆', '圣诞', '元旦',
                     '除夕', '拜年', '红包', '压岁钱', '团圆', '饺子', '龙舟',
                     '教师节', '儿童节', '劳动节', '清明', '重阳', '万圣节', '感恩节'],
        'weight': 3
    },
}

# 不适合儿童的内容检测
INAPPROPRIATE_PATTERNS = {
    '成人关系': ['老婆', '丈夫', '夫妻', '妻子', '老公', '小三', '出轨', '偷情', '妓', '嫖', 
                '处女', '强奸', '性', '床戏', '情人', '包养', '二奶', '劈腿'],
    '酒精': ['喝酒', '醉酒', '酒鬼', '酗酒', '拼酒'],
    '死亡': ['棺材', '死人', '坟地', '坟墓', '死了', '杀', '凶杀', '自杀', '跳楼'],
    '军事': ['士兵', '将军', '军队', '战争', '炮弹', '手榴弹', '原子弹', '枪杀'],
    '翻译笑话': ['汤姆', '杰克', '约翰', '彼得', '玛丽', '布朗', '史密斯', '威廉'],
    '古文': ['答曰', '乃曰', '秀才', '监生', '县官', '员外', '陛下', '朕', '寡人'],
    '低俗': ['屎', '尿', '屁', '屁股', '厕所', '茅坑', '脱裤'],
}

def classify_content(content):
    """根据内容智能分类，返回 (category, scores, is_inappropriate, reason)"""
    if not content:
        return '日常', {}, False, ''
    
    # 检查不适宜内容
    for issue, patterns in INAPPROPRIATE_PATTERNS.items():
        hits = sum(1 for p in patterns if p in content)
        if hits >= 2:  # 至少命中2个关键词才标记
            return '日常', {}, True, f'含{issue}内容'
        # 单个强关键词直接标记
        if issue in ('成人关系', '低俗') and hits >= 1:
            for p in patterns:
                if p in content:
                    return '日常', {}, True, f'含{issue}内容({p})'
    
    # 分类打分
    scores = {}
    for category, rule in CATEGORY_RULES.items():
        score = 0
        for kw in rule['keywords']:
            if kw in content:
                score += rule['weight']
        if score > 0:
            scores[category] = score
    
    if not scores:
        return '日常', scores, False, ''
    
    # 取最高分分类
    best_cat = max(scores, key=scores.get)
    
    # 如果最高分太低（只有1个关键词命中），归为日常
    if scores[best_cat] < 2:
        return '日常', scores, False, ''
    
    return best_cat, scores, False, ''


def generate_title(content, category):
    """为笑话生成合适的标题（4-12字）"""
    if not content:
        return '无题'
    
    # 取第一句有意义的话
    first_sentence = content.split('\n')[0].split('。')[0].split('！')[0].split('？')[0]
    first_sentence = first_sentence.strip()
    
    # 如果第一句已经够短
    if 4 <= len(first_sentence) <= 12:
        return first_sentence
    
    # 按场景生成标题
    scene_titles = {
        '老师': ['老师的问题', '课堂趣事', '老师与学生的对话'],
        '小明': ['小明趣事', '小明又来了', '小明回答'],
        '考试': ['考试趣闻', '考场糗事'],
        '医生': ['看医生', '医院趣事', '看病记'],
        '老板': ['老板说的', '公司趣事'],
        '公交': ['公交车上', '乘车记'],
        '打车': ['打车记', '出租车趣事'],
        '火车': ['火车上', '旅途趣事'],
        '飞机': ['飞机上', '高空趣事'],
        '妈妈': ['妈妈说', '妈妈和我说'],
        '爸爸': ['爸爸说', '父子对话'],
        '奶奶': ['奶奶说', '和奶奶的对话'],
        '爷爷': ['爷爷说', '和爷爷的对话'],
        '猫': ['猫趣事', '小猫的故事'],
        '狗': ['狗趣事', '小狗的故事'],
        '猴子': ['猴子的故事'],
        '兔子': ['兔子的故事'],
        '乌龟': ['乌龟的故事'],
        '吃饭': ['吃饭趣事', '餐桌上的故事'],
        '饺子': ['饺子记', '包饺子'],
        '减肥': ['减肥记', '减肥的故事'],
    }
    
    for keyword, titles in scene_titles.items():
        if keyword in content[:100]:
            return titles[0]
    
    # 从内容中提取有趣的短语
    # 找对话中的关键句
    if '：' in content or ':' in content:
        parts = re.split(r'[：:]', content)
        if len(parts) > 1:
            second_part = parts[1].strip()
            if 4 <= len(second_part) <= 12:
                return second_part
            if len(second_part) > 12:
                return second_part[:10]
    
    # 默认：取内容前几个字
    title = content[:8].replace('\n', '').strip()
    if len(title) < 4:
        title = content[:12].replace('\n', '').strip()
    
    return title or '趣事'


def clean_content(content):
    """清理内容格式"""
    if not content:
        return content
    
    # 统一换行符
    content = content.replace('\r\n', '\n').replace('\r', '\n')
    # 去除多余空格
    content = re.sub(r'[ \t]+', ' ', content)
    # 去除行首尾空格
    lines = [line.strip() for line in content.split('\n')]
    content = '\n'.join(lines)
    # 去除多余空行
    content = re.sub(r'\n{3,}', '\n\n', content)
    # 去除HTML残留
    content = re.sub(r'<[^>]+>', '', content)
    # 统一中文标点
    content = content.replace('"', '"').replace('"', '"')
    content = content.replace(''', "'").replace(''', "'")
    
    return content.strip()


def main():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 获取所有approved笑话
    cursor.execute("SELECT id, title, content, category FROM jokes WHERE status='approved'")
    jokes = cursor.fetchall()
    
    print(f"开始重新分类 {len(jokes)} 条笑话...")
    
    stats = {
        'category_changes': 0,
        'title_changes': 0,
        'content_cleaned': 0,
        'inappropriate_flagged': 0,
        'new_categories': {}
    }
    
    batch = []
    inappropriate_ids = []
    
    for joke_id, title, content, old_cat in jokes:
        content = content or ''
        
        # 清理内容
        cleaned = clean_content(content)
        content_changed = (cleaned != content)
        if content_changed:
            stats['content_cleaned'] += 1
        
        # 分类
        new_cat, scores, is_inappropriate, reason = classify_content(cleaned)
        
        if is_inappropriate:
            stats['inappropriate_flagged'] += 1
            inappropriate_ids.append((joke_id, reason))
            # 标记为pending（待复审）而不是直接拒绝
            batch.append((new_cat, title, cleaned, joke_id))
            continue
        
        # 生成标题
        new_title = generate_title(cleaned, new_cat)
        if new_title != title:
            stats['title_changes'] += 1
        
        # 记录分类变化
        if new_cat != old_cat:
            stats['category_changes'] += 1
        
        stats['new_categories'][new_cat] = stats['new_categories'].get(new_cat, 0) + 1
        
        batch.append((new_cat, new_title, cleaned, joke_id))
    
    # 批量更新
    print(f"\n更新数据库...")
    cursor.executemany(
        "UPDATE jokes SET category=?, title=?, content=? WHERE id=?",
        batch
    )
    
    # 将不适宜的标记为pending待复审
    if inappropriate_ids:
        ids_to_flag = [jid for jid, _ in inappropriate_ids]
        placeholders = ','.join(['?'] * len(ids_to_flag))
        cursor.execute(
            f"UPDATE jokes SET status='pending' WHERE id IN ({placeholders})",
            ids_to_flag
        )
    
    conn.commit()
    conn.close()
    
    # 打印统计
    print(f"\n{'='*50}")
    print(f"重新分类完成！")
    print(f"{'='*50}")
    print(f"总处理: {len(jokes)} 条")
    print(f"分类变更: {stats['category_changes']} 条")
    print(f"标题优化: {stats['title_changes']} 条")
    print(f"内容清理: {stats['content_cleaned']} 条")
    print(f"不适宜标记(pending): {stats['inappropriate_flagged']} 条")
    print(f"\n新分类分布:")
    for cat, cnt in sorted(stats['new_categories'].items(), key=lambda x: -x[1]):
        print(f"  {cat}: {cnt} 条 ({cnt/len(jokes)*100:.1f}%)")
    
    if inappropriate_ids:
        print(f"\n标记为pending的笑话:")
        for jid, reason in inappropriate_ids[:20]:
            print(f"  ID {jid}: {reason}")
        if len(inappropriate_ids) > 20:
            print(f"  ...还有 {len(inappropriate_ids)-20} 条")


if __name__ == '__main__':
    main()
