const express = require('express');
const router = express.Router();
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data/database/main.db');

// 数据库加载 - 每次重新读取文件
async function loadDB() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_FILE);
  return new SQL.Database(buffer);
}

// 查询笑话列表
router.get('/jokes', async (req, res) => {
  try {
    const db = await loadDB();
    const { category, page = 1, limit = 20 } = req.query;
    
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

// 获取单条笑话详情（小程序点击进入详情页使用）
router.get('/jokes/:id', async (req, res) => {
  try {
    const db = await loadDB();
    const id = parseInt(req.params.id);
    
    if (!id || id < 1) {
      return res.json({ success: false, message: '无效的笑话ID' });
    }
    
    // 查询笑话详情
    const result = db.exec(`SELECT id, title, content, category, likes, shares, date FROM jokes WHERE id = ${id} AND status = "approved"`);
    
    if (!result[0] || result[0].values.length === 0) {
      return res.json({ success: false, message: '笑话不存在' });
    }
    
    const row = result[0].values[0];
    const joke = {
      id: row[0],
      title: row[1],
      content: row[2],
      category: row[3] || '搞笑',
      likes: row[4] || 0,
      shares: row[5] || 0,
      date: row[6] || ''
    };
    
    res.json({
      success: true,
      data: joke
    });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

module.exports = router;
