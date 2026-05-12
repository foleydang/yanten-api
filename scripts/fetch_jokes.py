#!/usr/bin/env python3
"""获取笑话数据"""
import requests
import json
import time

JOKES_API = "https://icanhazdadjoke.com/"
DB_FILE = "/root/github/yanten-api/data/database/main.db"
OUTPUT_FILE = "/root/github/yanten-api/data/jokes_import.json"

def fetch_joke():
    headers = {"Accept": "application/json"}
    r = requests.get(JOKES_API, headers=headers, timeout=10)
    if r.status_code == 200:
        return r.json()
    return None

def main():
    jokes = []
    print("获取50条英文笑话...")
    
    for i in range(50):
        try:
            data = fetch_joke()
            if data and data.get('joke'):
                text = data['joke']
                if len(text) > 20 and len(text) < 400:
                    jokes.append({
                        'title': 'English Joke #' + str(i+1),
                        'content': text,
                        'category': '搞笑'
                    })
                    print(f"  {i+1}: {text[:40]}...")
            time.sleep(0.3)
        except Exception as e:
            print(f"  {i+1}: error")
    
    # 保存到JSON文件
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(jokes, f, ensure_ascii=False, indent=2)
    
    print(f"\n保存 {len(jokes)} 条笑话到: {OUTPUT_FILE}")
    print("可以通过管理后台导入这些笑话")

if __name__ == "__main__":
    main()
