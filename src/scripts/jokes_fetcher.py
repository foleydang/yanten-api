#!/usr/bin/env python3
"""
哇哇笑笑话爬取和更新脚本（优化版）
- 每天爬取50条新笑话
- 笑话库上限500条
- 淘汰机制：评分最低的笑话
- 去重：Rouge相似度检查 + 标题去重
- 数据源：真实笑话库（不重复）
"""

import json
import requests
from datetime import datetime, date
import random
import hashlib
import os
import re

# 配置
JOKES_FILE = '/root/github/yanten-api/data/database/wawaxiao-jokes.json'
MAX_JOKES = 500
DAILY_LIMIT = 50
BACKUP_DIR = '/root/logs/jokes-backup'

# 真实笑话库（适合4岁小朋友）
REAL_JOKES_DATABASE = [
    # 职场类
    {
        'category': '职场',
        'title': '程序员面试',
        'content': '面试官：你期望薪资是多少？\n程序员：3万。\n面试官：我们公司可以给你5万，还有期权，年终奖6个月，免费三餐，带薪休假。\n程序员：真的吗？\n面试官：假的，是你先跟我开玩笑的。'
    },
    {
        'category': '职场',
        'title': '准时下班',
        'content': '老板：小张啊，你怎么每天准时下班？\n小张：因为我要回家啊。\n老板：回家干嘛？\n小张：睡觉啊。\n老板：睡那么早干嘛？\n小张：养足精神明天准时下班。'
    },
    {
        'category': '职场',
        'title': '需求变更',
        'content': '产品经理：这个需求很简单，怎么实现我不管。\n程序员：好的，那我就不实现了。\n产品经理：？？\n程序员：你怎么实现我不管。'
    },
    {
        'category': '职场',
        'title': '加班费',
        'content': '老板：加班费给你计算好了。\n员工：多少？\n老板：每小时10块。\n员工：那我加班一小时，给你10块？\n老板：不对，是你加班一小时，公司给你10块。\n员工：算了，我回家睡觉。'
    },
    {
        'category': '职场',
        'title': '开会',
        'content': '老板：今天开会讨论一个问题。\n员工：什么问题？\n老板：为什么大家都不喜欢开会？\n员工：...（沉默）\n老板：好，下一个议题。'
    },
    {
        'category': '职场',
        'title': 'PPT',
        'content': '老板：PPT要做得好看一点。\n员工：我做得很好看啊。\n老板：那你把字体改大一点。\n员工：好的，改到最大。\n老板：现在又太大了。\n员工：...（崩溃）'
    },
    
    # 生活类
    {
        'category': '生活',
        'title': '减肥计划',
        'content': '我决定减肥了。\n第一天：晚上不吃饭！\n第二天：中午少吃点！\n第三天：早上起来跑两圈！\n第四天：点外卖的时候跟老板说少放点油。\n第五天：算了，胖着也挺好的。'
    },
    {
        'category': '生活',
        'title': '网购哲学',
        'content': '我：这件衣服500块好贵啊，不买了。\n我：点个外卖加配送费？没门！\n我：买个视频会员？等等再找找免费资源。\n我：奶茶25一杯？来两杯！\n我：？？'
    },
    {
        'category': '生活',
        'title': '省钱攻略',
        'content': '朋友：你怎么这么省钱？\n我：我不买衣服，不点外卖，不喝奶茶。\n朋友：那你存了多少钱？\n我：0块，因为工资太低。'
    },
    {
        'category': '生活',
        'title': '健身卡',
        'content': '我办了健身卡。\n第一个月：去了5次。\n第二个月：去了3次。\n第三个月：去了1次。\n第四个月：卡过期了。\n我：明年再办一张！'
    },
    {
        'category': '生活',
        'title': '外卖小哥',
        'content': '外卖小哥：您好，外卖到了。\n我：放门口吧。\n外卖小哥：好的，祝您用餐愉快。\n我：等等，怎么是凉的？\n外卖小哥：因为我骑自行车来的。'
    },
    
    # 家庭类
    {
        'category': '家庭',
        'title': '妈妈的逻辑',
        'content': '我：妈，我饿了。\n妈：饿了不会自己做饭？\n我：妈，我做饭。\n妈：你会做什么？别把厨房烧了。\n我：妈，那我点外卖。\n妈：天天外卖，不知道自己煮点健康的东西吃。\n我：妈那你帮我做点呗？\n妈：我养你这么大是来伺候你的？'
    },
    {
        'category': '家庭',
        'title': '爸爸的智慧',
        'content': '儿子：爸爸，我想买个玩具。\n爸爸：多少钱？\n儿子：200块。\n爸爸：那你自己存钱买。\n儿子：可是我存了200块想买冰淇淋。\n爸爸：那就买冰淇淋。\n儿子：爸爸真好！'
    },
    {
        'category': '家庭',
        'title': '催婚',
        'content': '妈：你什么时候结婚？\n我：等找到喜欢的人。\n妈：你喜欢什么样的人？\n我：喜欢我的人。\n妈：那你得先喜欢别人。\n我：那我还是不结婚吧。'
    },
    {
        'category': '家庭',
        'title': '洗碗',
        'content': '妈：去洗碗。\n我：好的。\n（10分钟后）\n妈：怎么还没洗好？\n我：碗太多了。\n妈：就3个碗。\n我：我还洗了锅、铲子、勺子...'
    },
    
    # 校园类
    {
        'category': '校园',
        'title': '考试秘诀',
        'content': '老师：小明，这次考试你怎么又考了0分？\n小明：老师，您不是说要诚实吗？\n老师：那也不能什么都不写啊。\n小明：因为题目太难，我怕写错了不诚实。'
    },
    {
        'category': '校园',
        'title': '英语考试',
        'content': '老师：翻译 "I love you"。 \n小明：我爱你。\n老师：错了，应该是 "I love you"。\n小明：可是中文就是我爱你啊。\n老师：...（无语）'
    },
    {
        'category': '校园',
        'title': '数学课',
        'content': '老师：小明，1+1等于多少？\n小明：等于2。\n老师：那2+2等于多少？\n小明：等于4。\n老师：那4+4等于多少？\n小明：老师，你是不是不会算？'
    },
    {
        'category': '校园',
        'title': '早起',
        'content': '老师：小明，你怎么每天迟到？\n小明：因为我起不来。\n老师：那你早点睡。\n小明：可是作业太多写不完。\n老师：那你早点写。\n小明：可是我起不来...'
    },
    {
        'category': '校园',
        'title': '毕业',
        'content': '老师：毕业后你们想做什么？\n小明：我想当程序员。\n老师：为什么？\n小明：因为程序员赚钱多。\n老师：那你要好好学习。\n小明：可是程序员都熬夜，我怕起不来。'
    },
    
    # 小朋友类（适合4岁）
    {
        'category': '儿童',
        'title': '小兔子拉粑粑',
        'content': '小兔子：妈妈，我要拉粑粑。\n兔子妈妈：去厕所拉。\n小兔子：可是厕所好远。\n兔子妈妈：那就在家门口拉。\n小兔子：可是邻居会看到。\n兔子妈妈：那就憋着。\n小兔子：憋不住了！\n兔子妈妈：那就拉在裤子上。\n小兔子：好的！（开心的拉粑粑）'
    },
    {
        'category': '儿童',
        'title': '数学题',
        'content': '小明：妈妈，1+1等于多少？\n妈妈：等于2。\n小明：那2+2等于多少？\n妈妈：等于4。\n小明：妈妈真聪明！\n妈妈：当然，妈妈什么都知道。\n小明：那为什么爸爸说妈妈什么都不知道？'
    },
    {
        'category': '儿童',
        'title': '爸爸睡着了',
        'content': '小明：妈妈，爸爸睡着了。\n妈妈：那就让他睡一会儿。\n小明：可是爸爸在看手机。\n妈妈：看手机怎么会睡着？\n小明：爸爸说看手机眼睛累了就闭眼休息，然后就睡着了。\n妈妈：...'
    },
    {
        'category': '儿童',
        'title': '蚂蚁搬家',
        'content': '小明：妈妈，蚂蚁为什么要搬家？\n妈妈：因为要下雨了。\n小明：蚂蚁知道要下雨？\n妈妈：是的，蚂蚁很聪明。\n小明：那蚂蚁为什么不带伞？\n妈妈：...（无语）'
    },
    {
        'category': '儿童',
        'title': '月亮',
        'content': '小明：妈妈，月亮为什么有时候圆有时候弯？\n妈妈：因为月亮在变化。\n小明：月亮会变化？\n妈妈：是的，月亮从弯变成圆，再从圆变成弯。\n小明：月亮是不是在减肥？\n妈妈：...'
    },
    {
        'category': '儿童',
        'title': '爸爸的肚子',
        'content': '小明：妈妈，爸爸的肚子好大。\n妈妈：那是啤酒肚。\n小明：啤酒肚是什么？\n妈妈：爸爸喝啤酒喝出来的肚子。\n小明：那我也要喝啤酒，长个大肚子！\n妈妈：不准喝！'
    },
    {
        'category': '儿童',
        'title': '星星',
        'content': '小明：妈妈，星星为什么会发光？\n妈妈：因为星星是太阳。\n小明：星星是太阳？\n妈妈：是的，星星像太阳一样发光。\n小明：那星星会不会烫手？\n妈妈：...（无语）'
    },
    {
        'category': '儿童',
        'title': '风筝',
        'content': '小明：妈妈，风筝为什么能飞？\n妈妈：因为有风。\n小明：有风就能飞？\n妈妈：是的，风吹风筝就飞了。\n小明：那我能不能也飞？\n妈妈：你没有翅膀。\n小明：那我绑个风筝？\n妈妈：不准！'
    },
    {
        'category': '儿童',
        'title': '爷爷的胡子',
        'content': '小明：妈妈，爷爷为什么有胡子？\n妈妈：因为爷爷老了。\n小明：老了就有胡子？\n妈妈：是的，男孩子老了会长胡子。\n小明：那我老了也会有胡子吗？\n妈妈：是的。\n小明：可是我是女孩子！\n妈妈：...'
    },
    {
        'category': '儿童',
        'title': '火柴奇遇记',
        'content': '小火柴：妈妈，我要出去玩。\n火柴妈妈：小心别被火烧。\n小火柴：好的，我会小心。\n（小火柴出去玩）\n小火柴：好冷啊，我要暖暖。\n小火柴：哇，好暖！\n小火柴：（变成了灰烬）'
    },
    
    # 更多笑话...
]

def load_jokes():
    """加载现有笑话"""
    try:
        with open(JOKES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_jokes(jokes):
    """保存笑话"""
    # 备份
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup_file = f"{BACKUP_DIR}/jokes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)
    
    # 保存
    with open(JOKES_FILE, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)

def calculate_score(joke):
    """计算笑话评分"""
    likes = joke.get('likes', 0)
    dislikes = joke.get('dislikes', 0)
    neutrals = joke.get('neutrals', 0)
    
    # 评分 = 喜欢 - 不喜欢 - 0.5*平（平也不算太好）
    score = likes - dislikes - (neutrals * 0.5)
    
    # 加分：近期笑话加分
    joke_date = joke.get('date', '')
    today = date.today().strftime('%Y-%m-%d')
    if joke_date == today:
        score += 5  # 今日笑话加分
    
    return score

def calculate_similarity(text1, text2):
    """
    计算文本相似度（简化版 Rouge-L）
    返回相似度 0-1
    """
    # 使用最长公共子序列
    def lcs(s1, s2):
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i-1] == s2[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])
        
        return dp[m][n]
    
    if not text1 or not text2:
        return 0
    
    lcs_len = lcs(text1, text2)
    return lcs_len / max(len(text1), len(text2))

def is_duplicate(new_joke, existing_jokes, threshold=0.8):
    """
    检查是否重复（标题 + 内容双重检查）
    threshold: 相似度阈值，0.8 表示80%相似就认为重复
    """
    new_title = new_joke.get('title', '')
    new_content = new_joke.get('content', '')
    
    for joke in existing_jokes:
        existing_title = joke.get('title', '')
        existing_content = joke.get('content', '')
        
        # 标题完全相同就跳过
        if new_title == existing_title:
            return True, joke['id']
        
        # 内容相似度检查
        similarity = calculate_similarity(new_content, existing_content)
        
        if similarity > threshold:
            return True, joke['id']
    
    return False, None

def get_eviction_candidates(jokes):
    """
    获取需要淘汰的候选笑话
    按评分从低到高排序
    """
    # 计算评分
    for joke in jokes:
        joke['_score'] = calculate_score(joke)
    
    # 按评分排序（低评分在前）
    sorted_jokes = sorted(jokes, key=lambda j: j['_score'])
    
    # 移除临时字段
    for joke in jokes:
        joke.pop('_score', None)
    
    return sorted_jokes

def evict_jokes(jokes, count):
    """
    淘汰指定数量的笑话
    """
    if len(jokes) <= MAX_JOKES:
        return jokes
    
    # 获取淘汰候选
    candidates = get_eviction_candidates(jokes)
    
    # 淘汰最低评分的
    keep_count = MAX_JOKES - count  # 留下空间给新笑话
    evicted = candidates[:len(jokes) - keep_count]
    kept = candidates[len(jokes) - keep_count:]
    
    print(f'淘汰 {len(evicted)} 条低评分笑话:')
    for joke in evicted[:5]:  # 只显示前5条
        score = calculate_score(joke)
        print(f'  ID {joke["id"]}: {joke["title"]} (评分: {score:.1f})')
    
    return kept

def generate_new_jokes(count, existing_jokes):
    """
    生成新笑话（从真实笑话库随机选择，不重复）
    """
    new_jokes = []
    today = date.today().strftime('%Y-%m-%d')
    
    # 过滤已有的笑话标题
    existing_titles = set(j['title'] for j in existing_jokes)
    
    # 从真实笑话库中选择未重复的笑话
    available_jokes = [j for j in REAL_JOKES_DATABASE if j['title'] not in existing_titles]
    
    # 如果可用笑话不够，提示补充
    if len(available_jokes) < count:
        print(f'⚠️  可用笑话只有 {len(available_jokes)} 条，需要补充 {count - len(available_jokes)} 条')
        print(f'建议：添加更多真实笑话到 REAL_JOKES_DATABASE')
    
    # 随机选择
    selected = random.sample(available_jokes, min(count, len(available_jokes)))
    
    for template in selected:
        new_joke = {
            'category': template['category'],
            'title': template['title'],  # 不添加数字后缀 ✅
            'content': template['content'],
            'likes': 0,
            'neutrals': 0,
            'dislikes': 0,
            'shares': 0,
            'isHot': False,
            'status': 'approved',
            'createdAt': int(datetime.now().timestamp() * 1000),
            'date': today
        }
        new_jokes.append(new_joke)
    
    return new_jokes

def main():
    """主函数"""
    print('=' * 50)
    print(f'哇哇笑笑话更新任务 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 50)
    
    # 加载现有笑话
    jokes = load_jokes()
    current_count = len(jokes)
    print(f'\n当前笑话数: {current_count}')
    print(f'上限: {MAX_JOKES}')
    print(f'每日新增: {DAILY_LIMIT}')
    print(f'笑话库可用: {len(REAL_JOKES_DATABASE)} 条')
    
    # 检查是否需要更新
    if current_count >= MAX_JOKES:
        print(f'\n已达上限 {MAX_JOKES}，需要淘汰')
        jokes = evict_jokes(jokes, DAILY_LIMIT)
        print(f'淘汰后: {len(jokes)} 条')
    
    # 生成新笑话（从真实库选择，不重复）
    print(f'\n准备新增 {DAILY_LIMIT} 条笑话...')
    new_jokes = generate_new_jokes(DAILY_LIMIT, jokes)
    
    if not new_jokes:
        print('❌ 没有可用的新笑话（笑话库已用完或不够）')
        print(f'建议：扩充 REAL_JOKES_DATABASE，添加更多真实笑话')
        return
    
    # 去重检查（标题 + 内容）
    print('\n去重检查...')
    duplicates_found = 0
    unique_jokes = []
    
    for new_joke in new_jokes:
        is_dup, dup_id = is_duplicate(new_joke, jokes)
        
        if is_dup:
            duplicates_found += 1
            print(f'  发现重复: {new_joke["title"]} 与 ID {dup_id} 相似')
        else:
            unique_jokes.append(new_joke)
    
    print(f'重复: {duplicates_found} 条')
    print(f'唯一: {len(unique_jokes)} 条')
    
    if not unique_jokes:
        print('❌ 所有笑话都是重复的，无法添加')
        return
    
    # 分配ID
    max_id = max([j['id'] for j in jokes]) if jokes else 0
    for joke in unique_jokes:
        max_id += 1
        joke['id'] = max_id
    
    # 合并
    jokes.extend(unique_jokes)
    
    # 保存
    save_jokes(jokes)
    
    print(f'\n✅ 更新完成!')
    print(f'新增: {len(unique_jokes)} 条')
    print(f'淘汰: {MAX_JOKES - len(jokes) + len(unique_jokes) if current_count >= MAX_JOKES else 0} 条')
    print(f'现有: {len(jokes)} 条')
    
    # 统计
    approved = [j for j in jokes if j['status'] == 'approved']
    print(f'\n统计:')
    print(f'  已审核: {len(approved)} 条')
    print(f'  今日新增: {len([j for j in approved if j["date"] == date.today().strftime("%Y-%m-%d")])} 条')
    print(f'  笑话库剩余可用: {len(REAL_JOKES_DATABASE) - len(set(j["title"] for j in jokes))} 条')
    
    return jokes

if __name__ == '__main__':
    main()