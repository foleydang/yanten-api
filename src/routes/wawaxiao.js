const express = require('express');
const router = express.Router();
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const cache = require('../utils/cache');

const DB_FILE = path.join(__dirname, '../../data/database/main.db');

// 数据库加载 - 每次重新读取文件
async function loadDB() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_FILE);
  return new SQL.Database(buffer);
}

// 获取缓存笑话
async function getCachedJokes(key, fetchFn) {
  const cached = cache.get(key);
  if (cached) return cached;
  const result = await fetchFn();
  cache.set(key, result);
  return result;
}

// 查询笑话列表
router.get('/jokes', async (req, res) => {
  try {
    const db = await loadDB();  // 每次重新加载数据库
    const { category, page = 1, limit = 20, date } = req.query;
    
    // 获取总数
    const totalResult = db.exec('SELECT COUNT(*) as total FROM jokes WHERE status = "approved"');
    const total = totalResult[0]?.values[0]?.[0] || 0;
    
    // 获取分类统计
    const catResult = db.exec('SELECT category, COUNT(*) as count FROM jokes WHERE status = "approved" GROUP BY category ORDER BY count DESC');
    const categories = ['全部'];
    if (catResult[0]) {
      catResult[0].values.forEach(row => categories.push(row[0]));
    }
    
    // 构建查询
    let where = 'WHERE status = "approved"';
    if (category && category !== '全部') {
      where += ` AND category = '${category.replace(/'/g, "''")}'`;
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // 获取笑话列表
    const listResult = db.exec(`SELECT id, title, content, category FROM jokes ${where} ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`);
    const list = listResult[0]?.values.map(row => ({
      id: row[0],
      title: row[1],
      content: row[2],
      category: row[3]
    })) || [];
    
    res.json({
      success: true,
      data: {
        list,
        total,
        categories,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 清除缓存
router.post('/clear-cache', async (req, res) => {
  cache.clear();
  res.json({ success: true, message: '缓存已清除' });
});

module.exports = router;
