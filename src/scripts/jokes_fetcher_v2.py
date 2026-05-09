#!/usr/bin/env python3
"""
哇哇笑笑话爬虫 V2 - 混合策略
优先网络爬取，失败时使用本地库补充
支持多种API来源
"""

import json
import requests
from datetime import datetime, date
import random
import time
import re
import os

JOKES_FILE = '/root/github/yanten-api/data/database/wawaxiao-jokes.json'
MAX_JOKES = 500
DAILY_LIMIT = 50
BACKUP_DIR = '/root/logs/jokes-backup'

# User-Agent池
USER_AGENTS = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
]

# 过滤关键词
BAD_WORDS = ['傻逼', '操', '他妈', '屁', '屎', '尿', '滚', '贱', '畜生', '性', '裸', '胸']

# ===== 网络API来源 =====

def api_hanhan():
    """韩小韩笑话API"""
    jokes = []
    try:
        url = 'https://api.vvhan.com/api/joke'
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        
        for i in range(10):  # 尝试10次
            try:
                resp = requests.get(url, headers=headers, timeout=8)
                if resp.status_code == 200:
                    content = resp.text.strip()
                    if content and len(content) > 15:
                        title = content[:30] + '...' if len(content) > 30 else content
                        jokes.append({
                            'category': '网络笑话',
                            'title': title,
                            'content': content,
                        })
                time.sleep(0.3)
            except:
                continue
        print(f'韩小韩API: {len(jokes)} 条')
    except Exception as e:
        print(f'韩小韩API失败: {e}')
    return jokes

def api_tianapi():
    """天行数据API（需要key）"""
    jokes = []
    # 这个需要API key，暂时跳过
    return jokes

def api_alapi():
    """ALAPI笑话"""
    jokes = []
    try:
        # 尝试公开的段子API
        urls = [
            'https://api.oick.cn/yulu/api.php',
        ]
        for url in urls:
            try:
                headers = {'User-Agent': random.choice(USER_AGENTS)}
                resp = requests.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    content = resp.text.strip()
                    if content and len(content) > 20 and not any(w in content for w in BAD_WORDS):
                        title = content[:35] if len(content) > 35 else content
                        jokes.append({
                            'category': '语录',
                            'title': title,
                            'content': content,
                        })
                time.sleep(0.5)
            except:
                continue
        print(f'语录API: {len(jokes)} 条')
    except Exception as e:
        print(f'语录API失败: {e}')
    return jokes

def api_says():
    """名言API"""
    jokes = []
    try:
        url = 'https://v1.hitokoto.cn/'
        categories = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']
        
        for cat in categories[:5]:
            try:
                resp = requests.get(f'{url}?c={cat}', timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get('hitokoto', '')
                    from_ = data.get('from', '未知')
                    if content and len(content) > 10:
                        jokes.append({
                            'category': '名言',
                            'title': content[:30] if len(content) > 30 else content,
                            'content': f'{content} —— {from_}',
                        })
                time.sleep(0.2)
            except:
                continue
        print(f'名言API: {len(jokes)} 条')
    except Exception as e:
        print(f'名言API失败: {e}')
    return jokes

def crawl_zhihu():
    """知乎热榜"""
    jokes = []
    try:
        url = 'https://www.zhihu.com/api/v3/feed/topstory/hot-list'
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            items = data.get('data', [])[:10]
            for item in items:
                target = item.get('target', {})
                title = target.get('title', '')
                excerpt = target.get('excerpt', '')
                if title and excerpt:
                    jokes.append({
                        'category': '知乎热榜',
                        'title': title[:40],
                        'content': excerpt[:200] if excerpt else title,
                    })
        print(f'知乎热榜: {len(jokes)} 条')
    except Exception as e:
        print(f'知乎热榜失败: {e}')
    return jokes

def crawl_tieba():
    """贴吧热门帖子"""
    jokes = []
    try:
        # 使用贴吧公开API
        url = 'https://tieba.baidu.com/dc/common/tabs'
        params = {'tabs': 'hot_topic'}
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            topics = data.get('data', {}).get('hot_topic', {}).get('topic_list', [])[:10]
            for topic in topics:
                title = topic.get('topic_name', '')
                desc = topic.get('topic_desc', '')
                if title:
                    jokes.append({
                        'category': '贴吧热门',
                        'title': title[:40],
                        'content': desc[:150] if desc else title,
                    })
        print(f'贴吧热门: {len(jokes)} 条')
    except Exception as e:
        print(f'贴吧热门失败: {e}')
    return jokes

# ===== 本地备用库 =====

LOCAL_BACKUP = [
    {"category": "弱智吧", "title": "充电难题", "content": "充电宝充电很慢，我问客服为什么。客服说因为你的充电宝容量大。我说容量大不是应该充电快吗？客服说容量大是充电慢的原因。"},
    {"category": "弱智吧", "title": "WiFi难题", "content": "WiFi连接成功但上不了网，我问客服。客服说你连的是路由器。我说路由器不就是网吗？客服说路由器是路由器，网是网。"},
    {"category": "弱智吧", "title": "空调难题", "content": "空调显示18度但还是很热，我问师傅。师傅说你看的是室外温度。我说室外温度显示在空调上？师傅说空调显示的就是室外温度。"},
    {"category": "弱智吧", "title": "外卖难题", "content": "外卖小哥说外卖到了，我说放门口。小哥说好的。然后我发现门口没有外卖。小哥说他放的是外卖箱子门口。"},
    {"category": "弱智吧", "title": "快递难题", "content": "快递显示已签收，但我没收到。我问快递员，快递员说我签收了。我说我没签收。快递员说你家人签收了。我说我一个人住。"},
    {"category": "弱智吧", "title": "闹钟难题", "content": "闹钟响了三次我没起床。第四次响了，我终于起床关闹钟。然后发现闹钟设在了下午三点。"},
    {"category": "弱智吧", "title": "公交难题", "content": "公交卡余额不足，我充了钱但还是不足。客服问我充了多少。我说充了100。客服问我用什么充的。我说用银行卡。客服说那你充的是银行卡不是公交卡。"},
    {"category": "弱智吧", "title": "WiFi密码", "content": "WiFi密码是八个八。我问邻居是88888888吗？邻居说是。然后我发现密码是八个汉字：八八八八八八八八。"},
    {"category": "弱智吧", "title": "手机电量", "content": "手机显示电量100%，我出门逛了一天回来发现手机没电了。然后发现手机显示的是充电完成不是电量。"},
    {"category": "弱智吧", "title": "天气预报", "content": "天气预报说明天晴天，我没带伞出门。然后下雨了。我问天气预报为什么。天气预报说预报明天晴天，今天是晴天吗？"},
    {"category": "生活", "title": "网购退货", "content": "网购了一件衣服，尺码不对想退货。客服问我为什么退货。我说尺码不对。客服问我买的什么尺码。我说XL。客服问我穿什么尺码。我说L。客服说那你买错了。"},
    {"category": "生活", "title": "健身卡", "content": "办了健身卡，第一个月去了五次。第二个月去了三次。第三个月去了一次。第四个月卡过期了。然后我又办了一张新卡。"},
    {"category": "生活", "title": "减肥失败", "content": "减肥一个月，瘦了五斤。然后吃了一顿火锅，胖了六斤。现在比减肥前还重一斤。"},
    {"category": "生活", "title": "外卖小哥", "content": "外卖小哥送外卖超时了。我说你超时了。小哥说他跑了很多单。我说跑了很多单就超时吗？小哥说他跑了很多单所以累。"},
    {"category": "程序员", "title": "代码bug", "content": "代码有bug。程序员说不是bug是特性。测试工程师说那这个特性有问题。程序员说特性没有问题，是用户使用有问题。"},
    {"category": "程序员", "title": "加班", "content": "程序员加班写代码。老板问他写完了吗。程序员说写完了。老板问bug修好了吗。程序员说没有bug。老板说那你为什么加班。程序员说我在写新功能。"},
    {"category": "程序员", "title": "需求", "content": "产品经理说需求很简单。程序员问怎么实现。产品经理说怎么实现是你的事。程序员说那我实现不了。产品经理说那就换个程序员。"},
    {"category": "程序员", "title": "面试", "content": "面试官问程序员会什么语言。程序员说我会Java。面试官问你会Python吗。程序员说不会。面试官问你会Go吗。程序员说不会。面试官说你只会Java？程序员说我还会加班。"},
    {"category": "校园", "title": "小明考试", "content": "小明考试考了零分。老师问他为什么。小明说题目太难了。老师说你抄袭别人的答案应该能得分。小明说我抄袭了，别人也考了零分。"},
    {"category": "校园", "title": "小明背书", "content": "老师让小明背课文。小明说背不下来。老师说那你抄十遍。小明说抄十遍也背不下来。老师说抄一百遍就能背下来。小明说抄一百遍手就断了。"},
    {"category": "校园", "title": "小明上学", "content": "小明上学迟到。老师问他为什么。小明说闹钟没响。老师说那你设两个闹钟。小明说设了两个都没响。老师说你手机闹钟没响？小明说我用的是闹钟不是手机。"},
    {"category": "家庭", "title": "妈妈做饭", "content": "妈妈做饭，爸爸问好不好吃。妈妈说好吃。爸爸说那多吃点。妈妈说吃多了会胖。爸爸说胖了就减肥。妈妈说减肥会饿。爸爸说饿了就吃饭。"},
    {"category": "家庭", "title": "爸爸买菜", "content": "爸爸去买菜，妈妈问买了什么。爸爸说买了菜。妈妈问买了什么菜。爸爸说买了买菜的菜。妈妈说你买的是什么菜？爸爸说买菜就是买菜。"},
    {"category": "家庭", "title": "孩子作业", "content": "孩子写作业，妈妈问写完了吗。孩子说写完了。妈妈问写对了吗。孩子说写对了。妈妈看了一眼说这是错的。孩子说那我就没写完。"},
    {"category": "糗事", "title": "地铁糗事", "content": "坐地铁，旁边的人问我几点上班。我说八点。他说那你还有时间。我说我说的是下午八点。他问现在几点。我说下午七点。"},
    {"category": "糗事", "title": "吃饭糗事", "content": "去餐厅吃饭，服务员问我点什么菜。我说点招牌菜。服务员问我点什么招牌菜。我说点最招牌的招牌菜。"},
    {"category": "糗事", "title": "打车糗事", "content": "打车，司机问我去哪里。我说去车站。司机问哪个车站。我说火车站。司机问哪个火车站。我说北京站。司机说北京站有三个。"},
    {"category": "糗事", "title": "理发糗事", "content": "去理发，理发师问我剪什么发型。我说剪短发。理发师问短多少。我说短到短为止。理发师问我短到什么程度。我说短到不能再短。"},
    {"category": "糗事", "title": "看电影糗事", "content": "看电影，旁边的人问我好看吗。我说好看。他问我好看在哪里。我说好看在好看。他说你说的是什么好看。我说我说的是电影好看。"},
    {"category": "经典", "title": "小明骑车", "content": "小明骑自行车，老师让他骑慢点。小明说骑不快。老师说那你骑快点。小明说骑不快怎么骑快点。"},
    {"category": "经典", "title": "小明游泳", "content": "小明去游泳，教练问他会不会游泳。小明说不会。教练说那你下水试试。小明说不会游泳下水会淹死。教练说那你学游泳。小明说学游泳要下水。"},
]

def load_jokes():
    try:
        with open(JOKES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_jokes(jokes):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup_file = f"{BACKUP_DIR}/jokes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)
    with open(JOKES_FILE, 'w', encoding='utf-8') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)

def is_duplicate(new_joke, existing_jokes):
    new_title = new_joke.get('title', '')
    new_content = new_joke.get('content', '')
    for joke in existing_jokes:
        if new_title == joke.get('title', ''):
            return True
        if new_content[:30] == joke.get('content', '')[:30]:
            return True
    return False

def is_appropriate(content):
    return not any(w in content for w in BAD_WORDS)

def main():
    print('=' * 60)
    print(f'哇哇笑笑话更新 V2 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    jokes = load_jokes()
    print(f'当前笑话数: {len(jokes)}')
    print(f'目标: {DAILY_LIMIT} 条')
    
    # ===== 第一步：网络爬取 =====
    print('\n第一步：网络爬取...')
    all_new = []
    
    all_new.extend(api_hanhan())
    all_new.extend(api_says())
    all_new.extend(crawl_zhihu())
    all_new.extend(crawl_tieba())
    all_new.extend(api_alapi())
    
    print(f'网络爬取: {len(all_new)} 条')
    
    # ===== 第二步：本地补充 =====
    if len(all_new) < DAILY_LIMIT:
        print('\n第二步：本地库补充...')
        existing_titles = set(j['title'] for j in jokes)
        available = [j for j in LOCAL_BACKUP if j['title'] not in existing_titles]
        need_count = DAILY_LIMIT - len(all_new)
        supplement = random.sample(available, min(need_count, len(available)))
        all_new.extend(supplement)
        print(f'本地补充: {len(supplement)} 条')
    
    # ===== 去重过滤 =====
    print('\n去重过滤...')
    unique = []
    for j in all_new:
        if not is_duplicate(j, jokes) and len(j['content']) >= 15 and is_appropriate(j['content']):
            unique.append(j)
    
    print(f'有效笑话: {len(unique)} 条')
    
    if len(unique) > DAILY_LIMIT:
        selected = random.sample(unique, DAILY_LIMIT)
    else:
        selected = unique
    
    if not selected:
        print('❌ 没有有效笑话')
        return
    
    # ===== 分配ID保存 =====
    max_id = max([j['id'] for j in jokes]) if jokes else 0
    today = date.today().strftime('%Y-%m-%d')
    
    for j in selected:
        max_id += 1
        j['id'] = max_id
        j['likes'] = 0
        j['neutrals'] = 0
        j['dislikes'] = 0
        j['shares'] = 0
        j['isHot'] = False
        j['status'] = 'approved'
        j['createdAt'] = int(datetime.now().timestamp() * 1000)
        j['date'] = today
    
    jokes.extend(selected)
    save_jokes(jokes)
    
    print(f'\n✅ 更新完成!')
    print(f'新增: {len(selected)} 条')
    sources = {}
    for j in selected:
        sources[j['category']] = sources.get(j['category'], 0) + 1
    for s, c in sources.items():
        print(f'  {s}: {c} 条')
    print(f'总数: {len(jokes)} 条')
    
    print('\n预览:')
    for j in selected[:3]:
        print(f'  [{j["category"]}] {j["title"]}')
        print(f'    {j["content"][:50]}...')

if __name__ == '__main__':
    main()
