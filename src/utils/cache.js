/**
 * 简单内存缓存 - 减少数据库读取
 */

class Cache {
  constructor() {
    this.data = {};
    this.expireTime = 5 * 60 * 1000; // 5分钟缓存
  }

  get(key) {
    const item = this.data[key];
    if (!item) return null;
    
    if (Date.now() > item.expire) {
      delete this.data[key];
      return null;
    }
    
    return item.value;
  }

  set(key, value) {
    this.data[key] = {
      value,
      expire: Date.now() + this.expireTime
    };
  }

  clear() {
    this.data = {};
  }

  // 清理过期缓存
  cleanup() {
    const now = Date.now();
    for (const key in this.data) {
      if (now > this.data[key].expire) {
        delete this.data[key];
      }
    }
  }
}

// 单例
const cache = new Cache();

// 每分钟清理一次
setInterval(() => cache.cleanup(), 60 * 1000);

module.exports = cache;
