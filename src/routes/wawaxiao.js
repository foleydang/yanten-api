const express = require('express');
const router = express.Router();
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data/database/main.db');

async function loadDB() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_FILE);
  return new SQL.Database(buffer);
}

// 获取统计
router.get('/stats', async (req, res) => {
  try {
    const db = await loadDB();
    const totalResult = db.exec('SELECT COUNT(*) FROM jokes WHERE status="approved"');
    const total = totalResult[0]?.values[0]?.[0] || 0;
    
    // 获取最新日期
    const dateResult = db.exec('SELECT MAX(date) FROM jokes WHERE status="approved"');
    const latestDate = dateResult[0]?.values[0]?.[0] || '';
    
    // 今日新增（按日期统计）
    const todayResult = db.exec('SELECT COUNT(*) FROM jokes WHERE status="approved" AND date = (SELECT MAX(date) FROM jokes)');
    const todayCount = todayResult[0]?.values[0]?.[0] || 0;
    
    res.json({
      success: true,
      data: { total, latestDate, todayCount }
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 获取热门笑话
router.get('/hot', async (req, res) => {
  try {
    const db = await loadDB();
    const result = db.exec('SELECT id, title, content, category, likes FROM jokes WHERE status="approved" ORDER BY likes DESC LIMIT 10');
    const hotJokes = result[0]?.values.map(row => ({
      id: row[0],
      title: row[1],
      content: row[2],
      category: row[3] || '搞笑',
      likes: row[4] || 0
    })) || [];
    
    res.json({ success: true, data: hotJokes });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 获取最新笑话
router.get('/latest', async (req, res) => {
  try {
    const db = await loadDB();
    const limit = parseInt(req.query.limit) || 50;
    const result = db.exec(`SELECT id, title, content, category FROM jokes WHERE status="approved" ORDER BY id DESC LIMIT ${limit}`);
    const jokes = result[0]?.values.map(row => ({
      id: row[0],
      title: row[1],
      content: row[2],
      category: row[3] || '搞笑'
    })) || [];
    
    res.json({ success: true, data: jokes });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 获取随机笑话
router.get('/random', async (req, res) => {
  try {
    const db = await loadDB();
    const countResult = db.exec('SELECT COUNT(*) FROM jokes WHERE status="approved"');
    const total = countResult[0]?.values[0]?.[0] || 0;
    const randomId = Math.floor(Math.random() * total) + 1;
    
    const result = db.exec(`SELECT id, title, content, category FROM jokes WHERE id >= ${randomId} AND status="approved" LIMIT 1`);
    const joke = result[0]?.values[0] ? {
      id: result[0].values[0][0],
      title: result[0].values[0][1],
      content: result[0].values[0][2],
      category: result[0].values[0][3] || '搞笑'
    } : null;
    
    res.json({ success: true, data: joke });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 查询笑话列表
router.get('/jokes', async (req, res) => {
  try {
    const db = await loadDB();
    const { category, page = 1, limit = 20 } = req.query;
    
    const totalResult = db.exec('SELECT COUNT(*) FROM jokes WHERE status="approved"');
    const total = totalResult[0]?.values[0]?.[0] || 0;
    
    // 获取分类统计
    const catResult = db.exec('SELECT category, COUNT(*) FROM jokes WHERE status="approved" GROUP BY category ORDER BY COUNT(*) DESC');
    const categoryCounts = catResult[0]?.values.map(row => ({
      category: row[0],
      count: row[1]
    })) || [];
    
    const categories = ['全部', ...categoryCounts.map(c => c.category)];
    
    let where = 'WHERE status="approved"';
    if (category && category !== '全部') {
      where += ` AND category="${category.replace(/"/g, "")}"`;
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const listResult = db.exec(`SELECT id, title, content, category, likes, shares FROM jokes ${where} ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`);
    const list = listResult[0]?.values.map(row => ({
      id: row[0],
      title: row[1],
      content: row[2],
      category: row[3] || '搞笑',
      likes: row[4] || 0,
      shares: row[5] || 0
    })) || [];
    
    res.json({
      success: true,
      data: { list, total, categories, categoryCounts, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 获取单条笑话详情
router.get('/jokes/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    
    const result = db.exec(`SELECT id, title, content, category, likes, neutrals, dislikes, shares, date FROM jokes WHERE id=${id} AND status="approved"`);
    
    if (!result[0] || result[0].values.length === 0) {
      return res.json({ success: false, message: '笑话不存在' });
    }
    
    const row = result[0].values[0];
    res.json({
      success: true,
      data: {
        id: row[0],
        title: row[1],
        content: row[2],
        category: row[3] || '搞笑',
        likes: row[4] || 0,
        neutrals: row[5] || 0,
        dislikes: row[6] || 0,
        shares: row[7] || 0,
        date: row[8] || ''
      }
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 点赞
router.post('/like/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    db.exec(`UPDATE jokes SET likes = likes + 1 WHERE id=${id}`);
    
    const result = db.exec(`SELECT likes, neutrals, dislikes FROM jokes WHERE id=${id}`);
    const row = result[0]?.values[0] || [0, 0, 0];
    
    // 保存数据库
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
    
    res.json({
      success: true,
      data: { likes: row[0], neutrals: row[1], dislikes: row[2] }
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 平
router.post('/neutral/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    db.exec(`UPDATE jokes SET neutrals = neutrals + 1 WHERE id=${id}`);
    
    const result = db.exec(`SELECT likes, neutrals, dislikes FROM jokes WHERE id=${id}`);
    const row = result[0]?.values[0] || [0, 0, 0];
    
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
    
    res.json({
      success: true,
      data: { likes: row[0], neutrals: row[1], dislikes: row[2] }
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// 不喜欢
router.post('/dislike/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    db.exec(`UPDATE jokes SET dislikes = dislikes + 1 WHERE id=${id}`);
    
    const result = db.exec(`SELECT likes, neutrals, dislikes FROM jokes WHERE id=${id}`);
    const row = result[0]?.values[0] || [0, 0, 0];
    
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
    
    res.json({
      success: true,
      data: { likes: row[0], neutrals: row[1], dislikes: row[2] }
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

module.exports = router;
