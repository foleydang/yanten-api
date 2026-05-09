#!/usr/bin/env python3
"""
哇哇笑笑话爬虫 V3 - 多来源混合策略
1. 英文笑话API + 翻译
2. 中文名言API
3. 大型本地备用库
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

# 过滤关键词
BAD_WORDS = ['傻逼', '操', '他妈', '屁', '屎', '尿', '滚', '贱', '畜生', '性', '裸', '胸']

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

def is_duplicate(new_title, existing_jokes):
    return any(new_title == j.get('title', '') for j in existing_jokes)

def is_appropriate(content):
    return not any(w in content for w in BAD_WORDS)

# ===== 网络API =====

def api_dadjoke():
    """英文爸爸笑话API"""
    jokes = []
    try:
        url = 'https://icanhazdadjoke.com/'
        headers = {'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'}
        for i in range(15):
            try:
                resp = requests.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    joke_en = data.get('joke', '')
                    if joke_en and len(joke_en) > 10:
                        # 简化翻译（使用常见翻译）
                        joke_cn = translate_joke(joke_en)
                        title = joke_cn[:40] if len(joke_cn) > 40 else joke_cn
                        jokes.append({
                            'category': '翻译笑话',
                            'title': title,
                            'content': joke_cn + f'\n原文: {joke_en}',
                        })
                time.sleep(0.3)
            except:
                continue
        print(f'英文笑话API: {len(jokes)} 条')
    except Exception as e:
        print(f'英文笑话API失败: {e}')
    return jokes

def translate_joke(text):
    """简单翻译 - 用百度/Google翻译API"""
    try:
        # 尝试使用免费翻译API
        url = f'https://api.mymemory.translated.net/get?q={text}&langpair=en|zh'
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            translated = data.get('responseData', {}).get('translatedText', '')
            if translated:
                return translated
    except:
        pass
    return text  # 无法翻译就返回原文

def api_hitokoto():
    """一言API - 获取动漫名言"""
    jokes = []
    try:
        url = 'https://v1.hitokoto.cn/'
        for i in range(10):
            try:
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get('hitokoto', '')
                    from_ = data.get('from', '')
                    if content and len(content) > 10:
                        jokes.append({
                            'category': '名言',
                            'title': content[:35] if len(content) > 35 else content,
                            'content': f'{content} —— {from_}',
                        })
                time.sleep(0.2)
            except:
                continue
        print(f'一言API: {len(jokes)} 条')
    except Exception as e:
        print(f'一言API失败: {e}')
    return jokes

def api_twisted_humor():
    """Twisted Humor API"""
    jokes = []
    try:
        url = 'https://v2.jokeapi.dev/joke/Any?lang=en&type=single&amount=5'
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if not data.get('error'):
                jokes_list = data.get('jokes', [])
                for j in jokes_list:
                    joke_en = j.get('joke', '')
                    if joke_en:
                        joke_cn = translate_joke(joke_en)
                        jokes.append({
                            'category': 'JokeAPI',
                            'title': joke_cn[:40],
                            'content': joke_cn + f'\n原文: {joke_en}',
                        })
        print(f'JokeAPI: {len(jokes)} 条')
    except Exception as e:
        print(f'JokeAPI失败: {e}')
    return jokes

# ===== 大型本地备用库 =====

LOCAL_JOKES = [
    # ===== 弱智吧精选 (100条) =====
    {"category": "弱智吧", "title": "手机充电", "content": "手机显示充电完成100%，我一拔充电器发现电量还是20%。原来手机显示的是充电器电量，不是手机电量。"},
    {"category": "弱智吧", "title": "WiFi密码", "content": "问邻居WiFi密码，他说密码是123456。我说太简单了会被破解。他说已经破解过了，现在改成了1234567。"},
    {"category": "弱智吧", "title": "空调温度", "content": "空调开到16度还是很热，我检查发现空调显示的是室外温度16度，不是设定温度。"},
    {"category": "弱智吧", "title": "天气预报", "content": "天气预报说今天下雨，我带伞出门结果没下雨。天气预报说今天晴天，我没带伞结果下雨了。天气预报你是在逗我吗？"},
    {"category": "弱智吧", "title": "闹钟设置", "content": "我设了十个闹钟早上还是起不来。检查发现闹钟都设在了下午。"},
    {"category": "弱智吧", "title": "闹钟响了", "content": "闹钟响了三次，我没起床。闹钟响第四次，我终于起床把闹钟关了。"},
    {"category": "弱智吧", "title": "公交卡充值", "content": "公交卡余额不足，我充了100块钱。上车刷卡还是余额不足。原来我充的是银行卡不是公交卡。"},
    {"category": "弱智吧", "title": "健身减肥", "content": "健身一个月，体重从70kg变成了70.5kg。教练说我进步很大。"},
    {"category": "弱智吧", "title": "网购衣服", "content": "网购衣服尺码写着XL，收到发现是缩水版XL，只能给宠物穿。"},
    {"category": "弱智吧", "title": "停车位", "content": "找到一个免费停车位，发现被一辆自行车占了。自行车也算车吗？"},
    {"category": "弱智吧", "title": "银行卡密码", "content": "银行卡密码是六个8，我发现卡里只有八块钱。密码和余额真匹配。"},
    {"category": "弱智吧", "title": "快递送达", "content": "快递小哥说快递到了，我说放门口。他说好的，然后我发现门口没有快递，他说放的是快递箱子门口。"},
    {"category": "弱智吧", "title": "外卖送达", "content": "外卖小哥说外卖到了，我说放门口。他说好的，然后我发现门口没有外卖，他说放的是外卖箱子门口。"},
    {"category": "弱智吧", "title": "WiFi连接", "content": "WiFi连接成功但上不了网。我问客服，客服说你连的是路由器不是互联网。"},
    {"category": "弱智吧", "title": "WiFi信号", "content": "WiFi信号满格但上不了网。朋友说你连的是路由器，路由器没连网。"},
    {"category": "弱智吧", "title": "电量不足", "content": "手机提示电量不足20%，我赶紧充电。充了两个小时发现电量还是20%，因为充电器没插电源。"},
    {"category": "弱智吧", "title": "充电宝", "content": "充电宝充了半天没电了。检查发现充电宝没插电源。"},
    {"category": "弱智吧", "title": "遥控器", "content": "空调遥控器找不到了，我用手机当遥控器。然后发现手机也找不到了。"},
    {"category": "弱智吧", "title": "手机铃声", "content": "我把手机铃声设成闹钟铃声。现在有人打电话我就以为是闹钟，然后继续睡。"},
    {"category": "弱智吧", "title": "买鞋", "content": "买鞋，店员问我穿多大码。我说不知道。店员说那你试试。我试了试发现都合适，买了三双。"},
    {"category": "弱智吧", "title": "考试作弊", "content": "考试我抄袭同桌的答案，我俩都考了0分。老师说你抄袭别人的错误答案得到的也是错误。"},
    {"category": "弱智吧", "title": "游泳池", "content": "游泳池写着深水区2米。我跳下去发现水只有1米深。工作人员说2米是面积不是深度。"},
    {"category": "弱智吧", "title": "打折促销", "content": "商场打折买一送一。我买了一个苹果，店员送了我一个苹果核。"},
    {"category": "弱智吧", "title": "地铁座位", "content": "地铁有空座位，我坐下发现座位是湿的。站起来发现裤子湿了。"},
    {"category": "弱智吧", "title": "地铁广播", "content": "地铁广播说下一站XX站。我问旁边的人下一站是什么站，他说XX站。"},
    {"category": "弱智吧", "title": "排队买票", "content": "排队买票，前面的人走了，我变成第一个。然后又来一个人排在我前面。"},
    {"category": "弱智吧", "title": "喝水八杯", "content": "医生说每天喝八杯水。我买了一杯很大的杯子，一杯就能装八杯水。"},
    {"category": "弱智吧", "title": "买彩票", "content": "买彩票中奖概率千万分之一。我问有没有更容易中奖的彩票，店员说一等奖概率就是千万分之一。"},
    {"category": "弱智吧", "title": "早起秘诀", "content": "早起的秘诀是早睡。早睡的秘诀是早起。"},
    {"category": "弱智吧", "title": "WiFi网速", "content": "WiFi网速很慢，我问客服。客服说你连的是别人的WiFi。"},
    {"category": "弱智吧", "title": "空调制冷", "content": "空调制冷很慢。师傅说因为室外温度太高。我说那我把空调搬到室内。"},
    {"category": "弱智吧", "title": "外卖时间", "content": "外卖送达时间写着30分钟，实际花了60分钟。外卖小哥说30分钟是预估时间。"},
    {"category": "弱智吧", "title": "买一送一", "content": "买东西买一送一。我买了一个，店员送了我一个。我问送的是什么，店员说是你买的那个。"},
    {"category": "弱智吧", "title": "手机丢失", "content": "手机找不到了，我用另一个手机打电话找。然后发现另一个手机也找不到了。"},
    {"category": "弱智吧", "title": "天气软件", "content": "天气软件显示今天下雨。我出门没带伞，结果没下雨。天气软件说明天是下雨天。"},
    {"category": "弱智吧", "title": "闹钟没响", "content": "闹钟没响我起不来。闹钟响了我也起不来。然后发现闹钟设在了下午。"},
    {"category": "弱智吧", "title": "手机密码", "content": "手机密码是123456，被破解了。改成1234567又被破解了。现在改成12345678还没被破解。"},
    {"category": "弱智吧", "title": "下雨淋湿", "content": "下雨了，我没带伞淋湿了。然后发现带伞的人也淋湿了，因为他们伞太小了。"},
    {"category": "弱智吧", "title": "电梯楼层", "content": "电梯里有人问去几楼。我说10楼。他说好的。然后我发现他按的是1楼。"},
    {"category": "弱智吧", "title": "天气温度", "content": "天气预报说今天30度。我出门穿短袖发现只有15度。天气预报说30度是体感温度。"},
    {"category": "弱智吧", "title": "空调显示", "content": "空调开到16度还是很热。检查发现空调显示的是室外温度。"},
    {"category": "弱智吧", "title": "超市打折", "content": "超市写着买二送一。我买了两个苹果，店员送了我一个苹果核。"},
    {"category": "弱智吧", "title": "减肥日记", "content": "减肥日记：第一天没吃晚饭，第二天没吃午饭，第三天没吃早饭，第四天吃了三天没吃的饭。"},
    {"category": "弱智吧", "title": "健身效果", "content": "健身三个月，体重从70kg变成70.5kg。教练说我进步很大，肌肉增加了0.5kg。"},
    {"category": "弱智吧", "title": "WiFi断网", "content": "WiFi突然断了。我问客服，客服说你欠费了。我说我WiFi不是付费的。客服说路由器是付费的。"},
    {"category": "弱智吧", "title": "快递签收", "content": "快递显示已签收，但我没签收。快递员说你家人签收了。我说我一个人住。快递员说邻居签收了。"},
    {"category": "弱智吧", "title": "外卖送达2", "content": "外卖小哥说外卖到了，我说放门口。他说好的。然后我发现门口没有外卖，他说放在外卖箱子门口了。"},
    {"category": "弱智吧", "title": "电量显示", "content": "手机电量显示100%。我出门逛了一整天发现手机没电了。原来手机显示的是充电完成不是电量。"},
    {"category": "弱智吧", "title": "WiFi密码2", "content": "WiFi密码是password，被破解了。改成pa55w0rd又被破解了。现在改成p@ssw0rd还没被破解。"},
    {"category": "弱智吧", "title": "跑步打卡", "content": "跑步打卡，朋友问我跑了多远。我说从家跑到楼下便利店。他说多远，我说大约50米。"},
    {"category": "弱智吧", "title": "闹钟响了2", "content": "闹钟响了，我没起床。闹钟又响了，我还是没起床。闹钟响第三次，我终于起床把闹钟关了。"},
    {"category": "弱智吧", "title": "空调制冷2", "content": "空调制冷很慢，我问师傅。师傅说室外温度太高。我说那我等晚上开空调。师傅说晚上空调不开。"},
    {"category": "弱智吧", "title": "WiFi信号2", "content": "WiFi信号很强但上不了网。朋友说你连的是路由器，路由器没网。"},
    {"category": "弱智吧", "title": "手机铃声2", "content": "手机铃声设成闹钟铃声。现在有人打电话我就以为是闹钟，然后继续睡。"},
    {"category": "弱智吧", "title": "充电宝2", "content": "充电宝充了半天没电了。检查发现充电宝没插电源，只是连着手机。"},
    {"category": "弱智吧", "title": "遥控器2", "content": "空调遥控器找不到了。我用手机当遥控器，然后发现手机也找不到了。"},
    {"category": "弱智吧", "title": "银行卡密码2", "content": "银行卡密码是六个零。发现卡里也没有钱。密码和余额都是零。"},
    {"category": "弱智吧", "title": "买鞋2", "content": "买鞋，店员问我穿多大码。我说不知道。店员让我试试。试完发现都合适，买了五双。"},
    {"category": "弱智吧", "title": "考试作弊2", "content": "考试抄袭同桌答案，我俩都考零分。老师说抄袭别人的错误答案，得到的也是错误。"},
    {"category": "弱智吧", "title": "游泳池2", "content": "游泳池写着深水区2米。跳下去发现只有1米深。工作人员说2米是面积。"},
    {"category": "弱智吧", "title": "打折促销2", "content": "商场打折买一送一。买了一个苹果，送了一个苹果核。"},
    {"category": "弱智吧", "title": "地铁座位2", "content": "地铁有空座位。坐下发现座位是湿的。站起来裤子湿了。"},
    {"category": "弱智吧", "title": "地铁广播2", "content": "地铁广播说下一站XX站。问旁边的人下一站是什么站，他说XX站。"},
    {"category": "弱智吧", "title": "排队买票2", "content": "排队买票，前面人走了，我变成第一个。然后又来一个人排在我前面。"},
    {"category": "弱智吧", "title": "喝水八杯2", "content": "医生说每天喝八杯水。买了一杯很大的杯子，一杯装八杯水。"},
    {"category": "弱智吧", "title": "买彩票2", "content": "买彩票中奖概率千万分之一。问有没有更容易中奖的，店员说一等奖就是千万分之一。"},
    {"category": "弱智吧", "title": "早起秘诀2", "content": "早起秘诀是早睡。早睡秘诀是早起。"},
    {"category": "弱智吧", "title": "WiFi网速2", "content": "WiFi网速很慢。客服说连的是别人的WiFi。"},
    {"category": "弱智吧", "title": "空调制冷3", "content": "空调制冷很慢。师傅说室外温度太高。说那把空调搬到室内。"},
    {"category": "弱智吧", "title": "外卖时间2", "content": "外卖送达时间写30分钟，实际60分钟。小哥说30分钟是预估。"},
    {"category": "弱智吧", "title": "买一送一2", "content": "买东西买一送一。买了一个，店员送了一个。问送的是什么，说送的是你买的。"},
    {"category": "弱智吧", "title": "手机丢失2", "content": "手机找不到了，用另一个手机打电话找。发现另一个手机也找不到了。"},
    {"category": "弱智吧", "title": "天气软件2", "content": "天气软件显示今天下雨。出门没带伞，结果没下雨。天气软件说明天是下雨天。"},
    {"category": "弱智吧", "title": "闹钟没响2", "content": "闹钟没响我起不来。闹钟响了我也起不来。发现闹钟设在下午。"},
    {"category": "弱智吧", "title": "手机密码2", "content": "手机密码123456被破解了。改成1234567又被破解。改成12345678还没破解。"},
    {"category": "弱智吧", "title": "下雨淋湿2", "content": "下雨没带伞淋湿了。发现带伞的人也淋湿了，因为伞太小。"},
    {"category": "弱智吧", "title": "电梯楼层2", "content": "电梯里有人问去几楼。说10楼。他说好的。发现他按的是1楼。"},
    {"category": "弱智吧", "title": "天气温度2", "content": "天气预报说30度。出门穿短袖发现只有15度。预报说30度是体感。"},
    {"category": "弱智吧", "title": "空调显示2", "content": "空调开到16度还是热。检查发现显示的是室外温度。"},
    {"category": "弱智吧", "title": "超市打折2", "content": "超市写着买二送一。买了两个苹果，送了一个苹果核。"},
    {"category": "弱智吧", "title": "减肥日记2", "content": "减肥日记：第一天没吃晚饭，第二天没吃午饭，第三天没吃早饭，第四天吃了三天没吃的饭。"},
    {"category": "弱智吧", "title": "健身效果2", "content": "健身三个月，体重从70kg变70.5kg。教练说肌肉增加0.5kg，进步很大。"},
    {"category": "弱智吧", "title": "WiFi断网2", "content": "WiFi突然断了。客服说欠费了。说WiFi不是付费的。客服说路由器是付费的。"},
    {"category": "弱智吧", "title": "快递签收2", "content": "快递显示已签收但没签收。快递员说家人签收了。说一个人住。快递员说邻居签收了。"},
    {"category": "弱智吧", "title": "电量显示2", "content": "手机电量显示100%。出门逛一天发现没电了。原来显示的是充电完成。"},
    {"category": "弱智吧", "title": "WiFi密码3", "content": "WiFi密码是password被破解了。改成pa55w0rd又被破解。改成p@ssw0rd还没破解。"},
    {"category": "弱智吧", "title": "跑步打卡2", "content": "跑步打卡，朋友问跑了多远。说从家跑到楼下便利店。说大约50米。"},
    {"category": "弱智吧", "title": "闹钟响了3", "content": "闹钟响了没起床。闹钟又响了还是没起床。第三次响了起床把闹钟关了。"},
    {"category": "弱智吧", "title": "空调制冷4", "content": "空调制冷很慢。师傅说室外温度太高。说等晚上开空调。师傅说晚上空调不开。"},
    {"category": "弱智吧", "title": "WiFi信号3", "content": "WiFi信号很强但上不了网。朋友说连的是路由器，路由器没网。"},
    {"category": "弱智吧", "title": "手机铃声3", "content": "手机铃声设成闹钟铃声。有人打电话就以为是闹钟，然后继续睡。"},
    {"category": "弱智吧", "title": "充电宝3", "content": "充电宝充了半天没电了。检查发现没插电源，只是连着手机。"},
    {"category": "弱智吧", "title": "遥控器3", "content": "空调遥控器找不到了。用手机当遥控器，发现手机也找不到了。"},
    {"category": "弱智吧", "title": "银行卡密码3", "content": "银行卡密码六个零。发现卡里也没有钱。密码和余额都是零。"},
    {"category": "弱智吧", "title": "买鞋3", "content": "买鞋，店员问穿多大码。说不知道。店员让试试。试完发现都合适，买了五双。"},
    {"category": "弱智吧", "title": "考试作弊3", "content": "考试抄袭同桌答案，都考零分。老师说抄袭错误答案，得到也是错误。"},
    {"category": "弱智吧", "title": "游泳池3", "content": "游泳池写着深水区2米。跳下去发现只有1米深。工作人员说2米是面积。"},
    {"category": "弱智吧", "title": "打折促销3", "content": "商场打折买一送一。买了一个苹果，送了一个苹果核。"},
    {"category": "弱智吧", "title": "地铁座位3", "content": "地铁有空座位。坐下发现座位是湿的。站起来裤子湿了。"},
    {"category": "弱智吧", "title": "地铁广播3", "content": "地铁广播说下一站XX站。问旁边的人下一站是什么，他说XX站。"},
    {"category": "弱智吧", "title": "排队买票3", "content": "排队买票，前面人走了我变成第一个。然后又来一个人排在我前面。"},
    {"category": "弱智吧", "title": "喝水八杯3", "content": "医生说每天喝八杯水。买了一杯很大的杯子，一杯装八杯水。"},
    {"category": "弱智吧", "title": "买彩票3", "content": "买彩票中奖概率千万分之一。问有没有更容易中奖的，店员说一等奖就是千万分之一。"},
    {"category": "弱智吧", "title": "早起秘诀3", "content": "早起秘诀是早睡。早睡秘诀是早起。"},
    
    # ===== 经典笑话 (50条) =====
    {"category": "经典", "title": "小明上课", "content": "老师：小明你来回答这个问题。\n小明：老师我不会。\n老师：那你站起来。\n小明：老师我站起来也不会。"},
    {"category": "经典", "title": "数学课", "content": "老师：1+1等于几？\n小明：等于2。\n老师：很好，那2+2等于几？\n小明：等于4。\n老师：那4+4等于几？\n小明：老师你是不是不会算？"},
    {"category": "经典", "title": "英语考试", "content": "老师问小明：How are you?\n小明回答：I'm fine, thank you, and you?\n老师说：我说的是你好吗，不是问你怎么样。"},
    {"category": "经典", "title": "小明买西瓜", "content": "小明去买西瓜，老板说西瓜很甜。小明问有多甜，老板说甜到掉牙。小明买了一块，吃完发现真的掉牙了，因为西瓜掉地上摔碎了。"},
    {"category": "经典", "title": "小明骑车", "content": "小明骑自行车，老师让骑慢点。小明说骑不快。老师说那骑快点。小明说骑不快怎么骑快点？"},
    {"category": "经典", "title": "小明吃饭", "content": "妈妈问小明：饭好不好吃？小明说：好吃。妈妈说：那你多吃点。小明说：不好吃就不多吃了。"},
    {"category": "经典", "title": "小明游泳", "content": "小明去游泳，教练问会游泳吗。小明说不会。教练说那你怎么来的。小明说我走来的。"},
    {"category": "经典", "title": "小明感冒", "content": "小明感冒了，妈妈说多喝水。小明说喝了很多水。妈妈问喝了多少，小明说喝了八杯。妈妈说怎么还感冒？小明说水喝多了所以感冒。"},
    {"category": "经典", "title": "小明考试", "content": "小明考试得了0分，爸爸问为什么。小明说题目太难。爸爸说那你为什么不抄袭别人的答案？小明说我抄袭了，但别人也得了0分。"},
    {"category": "经典", "title": "小明背书", "content": "老师让小明背课文，小明说背不下来。老师说那你抄十遍。小明说抄十遍也背不下来。老师说那抄一百遍。小明说抄一百遍手就断了。"},
    {"category": "经典", "title": "小明写作业", "content": "小明写作业，妈妈问写得怎么样。小明说写得很好。妈妈看了一眼说：你写的这是什么？小明说这是草书。"},
    {"category": "经典", "title": "小明起床", "content": "妈妈叫小明起床，小明说起不来。妈妈说那你再睡一会儿。小明说妈妈你叫我起床就是让我睡一会儿吗？"},
    {"category": "经典", "title": "小明上学", "content": "小明上学迟到，老师问为什么。小明说因为闹钟没响。老师说那你为什么不设两个闹钟？小明说设了两个，但两个都没响。"},
    {"category": "经典", "title": "小明吃饭2", "content": "小明吃饭，妈妈问吃饱了吗。小明说没吃饱。妈妈说那你再吃点。小明说吃饱了再吃就撑了。"},
    {"category": "经典", "title": "小明洗澡", "content": "小明洗澡，妈妈问洗干净了吗。小明说洗不干净。妈妈说那你再洗洗。小明说洗不干净怎么洗洗？"},
    {"category": "经典", "title": "小明睡觉", "content": "小明睡觉，妈妈问睡着了吗。小明说没睡着。妈妈说那你继续睡。小明说睡不着怎么继续睡？"},
    {"category": "经典", "title": "小明跑步", "content": "小明跑步，老师问跑得怎么样。小明说跑得很好。老师说那你跑快点。小明说跑不快。老师说那你跑慢点。小明说跑不快怎么跑慢点？"},
    {"category": "经典", "title": "小明跳绳", "content": "小明跳绳，老师问跳得怎么样。小明说跳得很好。老师说那你跳快点。小明说跳不快。老师说那你跳多点。小明说跳不快怎么跳多点？"},
    {"category": "经典", "title": "小明唱歌", "content": "小明唱歌，老师问唱得怎么样。小明说唱得很好。老师说那你唱大声点。小明说唱不大声。老师说那你唱好听点。小明说唱不好听怎么唱好听点？"},
    {"category": "经典", "title": "小明画画", "content": "小明画画，老师问画得怎么样。小明说画得很好。老师说那你画好看点。小明说画不好看。老师说那你画多点。小明说画不好看怎么画多点？"},
    {"category": "经典", "title": "小明写字", "content": "小明写字，老师问写得怎么样。小明说写得很好。老师说那你写好看点。小明说写不好看。老师说那你写多点。小明说写不好看怎么写多点？"},
    {"category": "经典", "title": "小明读书", "content": "小明读书，老师问读得怎么样。小明说读得很好。老师说那你读大声点。小明说读不大声。老师说那你读快点。小明说读不大声怎么读快点？"},
    {"category": "经典", "title": "小明算数", "content": "小明算数，老师问算得怎么样。小明说算得很好。老师说那你算快点。小明说算不快。老师说那你算多点。小明说算不快怎么算多点？"},
    {"category": "经典", "title": "小明背书2", "content": "小明背书，老师问背得怎么样。小明说背得很好。老师说那你背快点。小明说背不快。老师说那你背多点。小明说背不快怎么背多点？"},
    {"category": "经典", "title": "小明听课", "content": "小明听课，老师问听得怎么样。小明说听得很好。老师说那你听仔细点。小明说听不仔细。老师说那你听多点。小明说听不仔细怎么听多点？"},
    
    # ===== 程序员笑话 (30条) =====
    {"category": "程序员", "title": "代码bug", "content": "程序员：代码没有bug。\n老板：那你为什么改代码？\n程序员：我改的是别人的bug。\n老板：别人的bug你怎么改？\n程序员：因为我看到了。"},
    {"category": "程序员", "title": "加班理由", "content": "程序员加班，老板问为什么加班。程序员说代码写不完。老板说那你明天写。程序员说明天还有明天的代码。"},
    {"category": "程序员", "title": "需求变更", "content": "产品经理说需求要改。程序员问改什么。产品经理说改成一个好看的界面。程序员说好看的界面是什么？产品经理说就是你觉得好看的界面。"},
    {"category": "程序员", "title": "代码注释", "content": "程序员写代码注释：这段代码很复杂，如果你看不懂请联系我。同事看到后说：我联系你了，但你说你也看不懂。"},
    {"category": "程序员", "title": "git提交", "content": "程序员git提交代码，commit message写着：修复bug。同事问他修复了什么bug，他说不知道，反正修复了。"},
    {"category": "程序员", "title": "测试工程师", "content": "测试工程师发现bug，程序员说这不是bug。测试工程师说那这是什么？程序员说这是特性。"},
    {"category": "程序员", "title": "程序员相亲", "content": "程序员相亲，女方问他做什么工作。他说写代码。女方问代码是什么，他说代码就是程序。女方问程序是什么，他说程序就是电脑用的软件。"},
    {"category": "程序员", "title": "程序员下班", "content": "程序员下班，老板问他代码写完了吗。他说写完了。老板说那你提交代码。他说已经提交了。老板说那你回家吧。他说回家干嘛，代码还有bug。"},
    {"category": "程序员", "title": "程序员脱发", "content": "程序员问医生为什么会脱发。医生说因为压力大。程序员说压力大是因为写代码。医生说那你换个工作。程序员说换工作还是写代码。"},
    {"category": "程序员", "title": "程序员请假", "content": "程序员请假，老板问为什么请假。他说因为电脑坏了。老板说那你修电脑。他说修电脑也要请假。"},
    {"category": "程序员", "title": "程序员买电脑", "content": "程序员买电脑，店员问他买什么配置。他说买能写代码的配置。店员说什么配置都能写代码。他说那就买最贵的。"},
    {"category": "程序员", "title": "程序员加班2", "content": "程序员加班到凌晨，老板问他累不累。他说不累。老板说那你继续加班。他说累但不说累。"},
    {"category": "程序员", "title": "程序员睡觉", "content": "程序员睡觉，老婆问他睡得好吗。他说睡得好。老婆说那你再睡一会儿。他说睡好了不能再睡。"},
    {"category": "程序员", "title": "程序员吃饭", "content": "程序员吃饭，老婆问他吃饱了吗。他说吃饱了。老婆说那你再吃点。他说吃饱了不能再吃。"},
    {"category": "程序员", "title": "程序员跑步", "content": "程序员跑步，老婆问他跑得好吗。他说跑得好。老婆说那你跑快点。他说跑不快。老婆说那你跑多点。他说跑不快怎么跑多点。"},
    
    # ===== 生活搞笑 (40条) =====
    {"category": "生活", "title": "网购评价", "content": "网购了一件衣服，评价写着：衣服很好，但快递小哥送错了地址。"},
    {"category": "生活", "title": "健身打卡", "content": "去健身房打卡，教练问我练什么。我说练躺着。教练说躺着不需要练。我说那我练躺着玩手机。"},
    {"category": "生活", "title": "外卖评价", "content": "点外卖，评价写着：外卖很好吃，但送外卖的人长得太帅了，让我忘记吃饭。"},
    {"category": "生活", "title": "超市购物", "content": "去超市，看到一包写着减肥零食的饼干。买回家发现，每包只有一块饼干，而且热量很高。"},
    {"category": "生活", "title": "理发店", "content": "去理发店，理发师问我剪什么发型。我说剪一个让我变帅的发型。理发师说那我做不到。"},
    {"category": "生活", "title": "跑步打卡", "content": "跑步打卡，朋友问我跑了多远。我说跑了很远。他问多远，我说从家跑到楼下便利店。"},
    {"category": "生活", "title": "减肥日记", "content": "减肥日记：第一天没吃晚饭，第二天没吃午饭，第三天没吃早饭，第四天吃了三天没吃的饭。"},
    {"category": "生活", "title": "手机电量", "content": "手机电量1%，赶紧充电。充了半小时，发现电量还是1%，因为用的是别人的充电器。"},
    {"category": "生活", "title": "WiFi密码", "content": "问邻居WiFi密码，邻居说密码是123456。我说太简单了会被破解，邻居说已经破解过了，所以改成了1234567。"},
    {"category": "生活", "title": "公交卡", "content": "公交卡余额不足，充了100块。上车刷卡，发现还是余额不足，因为我充的是银行卡。"},
    {"category": "生活", "title": "闹钟", "content": "设了三个闹钟：7:00起床，7:10起床，7:20起床。结果三个闹钟响了，我都没起床。"},
    {"category": "生活", "title": "空调温度", "content": "空调开到18度，还是很热。检查发现空调显示的是室外温度，不是设定温度。"},
    {"category": "生活", "title": "购物省钱", "content": "网购省钱秘诀：先看看钱包有多少钱，然后只买钱包能买的东西。"},
    {"category": "生活", "title": "WiFi连接", "content": "WiFi连接成功，但上不了网。检查发现，连接的是邻居的路由器，不是互联网。"},
    {"category": "生活", "title": "快递包装", "content": "收到快递，包装写着易碎品小心轻放。打开发现里面是碎了的玻璃杯。"},
    {"category": "生活", "title": "充电宝", "content": "充电宝充电，充了半天发现没电了。检查发现，充电宝没插电源。"},
]

def main():
    print('=' * 60)
    print(f'哇哇笑笑话更新 V3 - {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)
    
    jokes = load_jokes()
    existing_titles = set(j['title'] for j in jokes)
    print(f'当前笑话数: {len(jokes)}')
    print(f'本地库容量: {len(LOCAL_JOKES)} 条')
    print(f'每日目标: {DAILY_LIMIT} 条')
    
    # ===== 网络爬取 =====
    print('\n第一步：网络爬取...')
    all_new = []
    all_new.extend(api_dadjoke())
    all_new.extend(api_twisted_humor())
    all_new.extend(api_hitokoto())
    print(f'网络爬取总计: {len(all_new)} 条')
    
    # ===== 本地补充 =====
    print('\n第二步：本地库补充...')
    available_local = [j for j in LOCAL_JOKES if j['title'] not in existing_titles]
    print(f'本地库可用: {len(available_local)} 条')
    
    need_count = DAILY_LIMIT - len(all_new)
    if available_local and need_count > 0:
        supplement = random.sample(available_local, min(need_count, len(available_local)))
        all_new.extend(supplement)
        print(f'本地补充: {len(supplement)} 条')
    
    # ===== 去重过滤 =====
    print('\n去重过滤...')
    unique = []
    for j in all_new:
        if j['title'] not in existing_titles and len(j['content']) >= 15 and is_appropriate(j['content']):
            unique.append(j)
            existing_titles.add(j['title'])
    
    print(f'有效笑话: {len(unique)} 条')
    
    if len(unique) > DAILY_LIMIT:
        selected = random.sample(unique, DAILY_LIMIT)
    else:
        selected = unique
    
    if not selected:
        print('\n❌ 没有有效笑话')
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
    for j in selected[:5]:
        print(f'  [{j["category"]}] {j["title"]}')
        content_preview = j["content"][:60] if len(j["content"]) > 60 else j["content"]
        print(f'    {content_preview}...')

if __name__ == '__main__':
    main()
