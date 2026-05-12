/**
 * 哇哇笑API - 带缓存优化
 */
const express = require('express');
const router = express.Router();
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const cache = require('../utils/cache');

const DB_FILE = path.join(__dirname, '../../data/database/main.db');

// 数据库加载（带缓存）
let dbPromise = null;

async function loadDB() {
  // 检查缓存
  const cached = cache.get('database');
  if (cached) return cached;

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_FILE);
  const db = new SQL.Database(buffer);
  
  // 缓存数据库实例
  cache.set('database', db);
  return db;
}
// 保存数据库到文件
function saveDB(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}


// 缓存笑话列表（热门查询）
async function getCachedJokes(key, queryFn) {
  const cached = cache.get(key);
  if (cached) return cached;
  
  const result = await queryFn();
  cache.set(key, result);
  return result;
}

// 查询笑话列表
router.get('/jokes', async (req, res) => {
  try {
    const db = await loadDB();
    const { category, page = 1, limit = 20, date } = req.query;
    
    // 缓存key
    const cacheKey = `jokes_${category || 'all'}_${page}_${limit}_${date || 'all'}`;
    
    const result = await getCachedJokes(cacheKey, () => {
      // 获取总数
      const totalResult = db.exec('SELECT COUNT(*) as total FROM jokes WHERE status = "approved"');
      const total = totalResult[0]?.values[0]?.[0] || 0;
      
      // 获取分类统计
      const catResult = db.exec('SELECT category, COUNT(*) as count FROM jokes WHERE status = "approved" GROUP BY category ORDER BY count DESC');
      const categories = ['全部'];
      const categoryCounts = [];
      if (catResult[0]) {
        catResult[0].values.forEach(row => {
          categories.push(row[0]);
          categoryCounts.push({ category: row[0], count: row[1] });
        });
      }
      
      // 构建查询
      let sql = 'SELECT * FROM jokes WHERE status = "approved"';
      if (category && category !== '全部') {
        sql += ` AND category = "${category}"`;
      }
      if (date) {
        sql += ` AND date = "${date}"`;
      }
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      sql += ` ORDER BY date DESC, likes DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
      
      const result = db.exec(sql);
      const jokes = [];
      
      if (result[0]) {
        const columns = result[0].columns;
        result[0].values.forEach(row => {
          const joke = {};
          columns.forEach((col, i) => {
            joke[col] = row[i];
          });
          joke.score = joke.likes - joke.dislikes;
          joke.isHot = joke.is_hot === 1;
          joke.createdAt = joke.created_at;
          jokes.push(joke);
        });
      }
      
      return {
        success: true,
        data: {
          list: jokes,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          categories,
          categoryCounts,
          latestDate: jokes.length > 0 ? jokes[0].date : null
        }
      };
    });
    
    res.json(result);
    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 热门笑话（缓存1小时）
router.get('/hot', async (req, res) => {
  try {
    const result = await getCachedJokes('hot_jokes', async () => {
      const db = await loadDB();
      const result = db.exec('SELECT * FROM jokes WHERE status = "approved" ORDER BY likes DESC LIMIT 5');
      const jokes = [];
      
      if (result[0]) {
        const columns = result[0].columns;
        result[0].values.forEach(row => {
          const joke = {};
          columns.forEach((col, i) => joke[col] = row[i]);
          joke.score = joke.likes - joke.dislikes;
          joke.isHot = joke.is_hot === 1;
          joke.createdAt = joke.created_at;
          jokes.push(joke);
        });
      }
      
      return { success: true, data: jokes };
    });
    
    res.json(result);
    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});



// 单个笑话详情
router.get('/jokes/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    const result = db.exec(`SELECT * FROM jokes WHERE id = ${id} AND status = "approved"`);
    
    if (!result[0] || result[0].values.length === 0) {
      return res.json({ success: false, message: '笑话不存在' });
    }
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const joke = {};
    columns.forEach((col, i) => joke[col] = row[i]);
    joke.score = joke.likes - joke.dislikes;
    joke.isHot = joke.is_hot === 1;
    joke.createdAt = joke.created_at;
    
    res.json({ success: true, data: joke });
    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 随机笑话
router.get('/random', async (req, res) => {
  try {
    const db = await loadDB();
    const result = db.exec('SELECT * FROM jokes WHERE status = "approved" ORDER BY RANDOM() LIMIT 1');
    
    if (!result[0] || result[0].values.length === 0) {
      return res.json({ success: false, message: '没有笑话' });
    }
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const joke = {};
    columns.forEach((col, i) => joke[col] = row[i]);
    joke.score = joke.likes - joke.dislikes;
    joke.isHot = joke.is_hot === 1;
    joke.createdAt = joke.created_at;
    
    res.json({ success: true, data: joke });
    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 统计信息（缓存）
router.get('/stats', async (req, res) => {
  try {
    const result = await getCachedJokes('stats', async () => {
      const db = await loadDB();
      
      const totalResult = db.exec('SELECT COUNT(*) as total FROM jokes WHERE status = "approved"');
      const total = totalResult[0]?.values[0]?.[0] || 0;
      
      const catResult = db.exec('SELECT category, COUNT(*) as count FROM jokes WHERE status = "approved" GROUP BY category ORDER BY count DESC');
      const categories = {};
      if (catResult[0]) {
        catResult[0].values.forEach(row => categories[row[0]] = row[1]);
      }
      
      const dateResult = db.exec('SELECT MAX(date) as latest, COUNT(*) as today FROM jokes WHERE status = "approved" AND date = DATE("now")');
      const latestDate = dateResult[0]?.values[0]?.[0] || null;
      const todayCount = dateResult[0]?.values[0]?.[1] || 0;
      
      return {
        success: true,
        data: { total, categories, latestDate, todayCount }
      };
    });
    
    res.json(result);
    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 点赞/踩（不缓存，实时更新）
router.post('/like/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    db.run(`UPDATE jokes SET likes = likes + 1 WHERE id = ${id}`);
    saveDB(db);
    
    // 清除缓存
    cache.clear();
    
    const result = db.exec(`SELECT likes, neutrals, dislikes FROM jokes WHERE id = ${id}`);
    if (!result[0] || result[0].values.length === 0) {
      return res.json({ success: false, message: '笑话不存在' });
    }
    
    const row = result[0].values[0];
    res.json({ success: true, data: { likes: row[0], neutrals: row[1], dislikes: row[2], score: row[0] - row[2] } });
    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/dislike/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    db.run(`UPDATE jokes SET dislikes = dislikes + 1 WHERE id = ${id}`);
    saveDB(db);
    
    cache.clear();
    
    const result = db.exec(`SELECT likes, neutrals, dislikes FROM jokes WHERE id = ${id}`);
    const row = result[0]?.values[0];
    res.json({ success: true, data: { likes: row[0], neutrals: row[1], dislikes: row[2], score: row[0] - row[2] } });
    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 清除缓存（管理员接口）
router.post('/clear-cache', async (req, res) => {
  cache.clear();
  res.json({ success: true, message: '缓存已清除' });
});



// 评价为平（不缓存，实时更新）
router.post('/neutral/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    db.run(`UPDATE jokes SET neutrals = neutrals + 1 WHERE id = ${id}`);
    saveDB(db);
    
    // 清除缓存
    cache.clear();
    
    const result = db.exec(`SELECT likes, neutrals, dislikes FROM jokes WHERE id = ${id}`);
    if (!result[0] || result[0].values.length === 0) {
      return res.json({ success: false, message: '笑话不存在' });
    }
    
    const row = result[0].values[0];
    res.json({ success: true, data: { likes: row[0], neutrals: row[1], dislikes: row[2], score: row[0] - row[2] } });
    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
