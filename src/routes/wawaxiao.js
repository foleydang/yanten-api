/**
 * 哇哇笑笑话 API
 * - 笑话查询（列表/热门/最新/随机/详情）
 * - 用户互动（点赞/一般/不喜欢）
 * - 收藏系统（添加/删除/列表/批量检查）
 * - 用户投稿（提交/查询我的投稿）
 * - 用户体系共用 auth.js 的 users 表
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/database');

// favorites 表和 jokes 的 source/submitter 列已在 schema.sql 中定义
// 不再需要运行时 DDL 迁移

// ==================== 收藏 API ====================

// 获取收藏列表
router.get('/favorites', (req, res) => {
  try {
    const db = getDb();
    const { openid, page = 1, limit = 50 } = req.query;
    if (!openid || !isValidOpenid(openid)) return res.json({ success: true, data: { list: [], total: 0 } });
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const results = db.prepare(`SELECT j.id, j.title, j.content, j.category, j.likes, j.shares, j.neutrals, j.dislikes, f.created_at as fav_at FROM favorites f JOIN jokes j ON f.joke_id = j.id WHERE f.openid = ? AND j.status = 'approved' ORDER BY f.created_at DESC LIMIT ? OFFSET ?`).all(openid, parseInt(limit), offset);
    const favorites = results.map(row => ({ id: row.id, title: row.title, content: row.content, category: row.category || '搞笑', likes: row.likes || 0, shares: row.shares || 0, neutrals: row.neutrals || 0, dislikes: row.dislikes || 0, favAt: row.fav_at || '' }));
    const total = db.prepare('SELECT COUNT(*) as count FROM favorites WHERE openid = ?').get(openid)?.count || 0;
    res.json({ success: true, data: { list: favorites, total } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 添加收藏
router.post('/favorites/:id', (req, res) => {
  try {
    const db = getDb();
    const jokeId = parseInt(req.params.id);
    const { openid } = req.body;
    if (!openid || !isValidOpenid(openid)) return res.json({ success: false, message: '缺少 openid' });
    const joke = db.prepare('SELECT id FROM jokes WHERE id=? AND status="approved"').get(jokeId);
    if (!joke) return res.json({ success: false, message: '笑话不存在' });
    const existing = db.prepare('SELECT id FROM favorites WHERE joke_id=? AND openid=?').get(jokeId, openid);
    if (existing) return res.json({ success: true, data: { already: true } });
    db.prepare('INSERT INTO favorites (joke_id, openid) VALUES (?, ?)').run(jokeId, openid);
    res.json({ success: true, data: { already: false } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 删除收藏
router.delete('/favorites/:id', (req, res) => {
  try {
    const db = getDb();
    const jokeId = parseInt(req.params.id);
    const { openid } = req.query;
    if (!openid || !isValidOpenid(openid)) return res.json({ success: false, message: '缺少 openid' });
    db.prepare('DELETE FROM favorites WHERE joke_id=? AND openid=?').run(jokeId, openid);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 检查是否已收藏（批量）
router.get('/favorites/check', (req, res) => {
  try {
    const db = getDb();
    const { openid, ids } = req.query;
    if (!openid || !isValidOpenid(openid)) return res.json({ success: true, data: {} });
    let idsArr = ids ? ids.split(',').map(id => parseInt(id)).filter(id => id > 0) : [];
    if (idsArr.length === 0) return res.json({ success: true, data: {} });
    const placeholders = idsArr.map(() => '?').join(',');
    const results = db.prepare(`SELECT joke_id FROM favorites WHERE openid=? AND joke_id IN (${placeholders})`).all(openid, ...idsArr);
    const favMap = {};
    results.forEach(row => { favMap[row.joke_id] = true; });
    res.json({ success: true, data: favMap });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ==================== 投稿 API ====================

// 用户投稿笑话
router.post('/submit', (req, res) => {
  try {
    const db = getDb();
    const { title, content, category, openid } = req.body;
    if (!title || !content) return res.json({ success: false, message: '标题和内容不能为空' });
    if (openid && !isValidOpenid(openid)) return res.json({ success: false, message: '无效的用户标识' });
    if (title.length > 50) return res.json({ success: false, message: '标题不能超过50字' });
    if (content.length > 500) return res.json({ success: false, message: '内容不能超过500字' });
    
    // 敏感词过滤
    const badWords = ['政治', '领导', '政府', '国家领导人'];
    const textToCheck = (title + content).toLowerCase();
    for (const word of badWords) {
      if (textToCheck.includes(word)) return res.json({ success: false, message: '内容包含敏感词，请修改后重新提交' });
    }
    
    // 频率限制：同一用户每天最多5条
    if (openid) {
      const today = new Date().toISOString().split('T')[0];
      const todayCount = db.prepare('SELECT COUNT(*) as count FROM jokes WHERE submitter=? AND date=?').get(openid, today)?.count || 0;
      if (todayCount >= 5) return res.json({ success: false, message: '今天投稿次数已达上限，明天再来吧' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    db.prepare('INSERT INTO jokes (category, title, content, likes, neutrals, dislikes, shares, is_hot, status, date, source, submitter) VALUES (?, ?, ?, 0, 0, 0, 0, 0, "pending", ?, "user_submit", ?)').run(category || '搞笑', title.trim(), content.trim(), today, openid || null);
    res.json({ success: true, data: { message: '投稿成功！审核通过后会出现在笑话库中 ❤️' } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 查询我的投稿状态
router.get('/submit/mine', (req, res) => {
  try {
    const db = getDb();
    const { openid } = req.query;
    if (!openid || !isValidOpenid(openid)) return res.json({ success: true, data: { list: [], total: 0 } });
    const results = db.prepare('SELECT id, title, content, category, status, date FROM jokes WHERE submitter=? ORDER BY id DESC LIMIT 20').all(openid);
    const list = results.map(row => ({ id: row.id, title: row.title, content: row.content, category: row.category || '搞笑', status: row.status, date: row.date || '' }));
    res.json({ success: true, data: { list, total: list.length } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ==================== 笑话 API ====================

// 获取统计
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as count FROM jokes WHERE status="approved"').get()?.count || 0;
    const latestDate = db.prepare('SELECT MAX(date) as date FROM jokes WHERE status="approved"').get()?.date || '';
    const todayCount = db.prepare('SELECT COUNT(*) as count FROM jokes WHERE status="approved" AND date = (SELECT MAX(date) FROM jokes)').get()?.count || 0;
    res.json({ success: true, data: { total, latestDate, todayCount } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 获取热门笑话
router.get('/hot', (req, res) => {
  try {
    const db = getDb();
    const results = db.prepare('SELECT id, title, content, category, likes FROM jokes WHERE status="approved" ORDER BY likes DESC LIMIT 10').all();
    res.json({ success: true, data: results.map(row => ({ id: row.id, title: row.title, content: row.content, category: row.category || '搞笑', likes: row.likes || 0 })) });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 获取最新笑话
router.get('/latest', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 50;
    const results = db.prepare('SELECT id, title, content, category FROM jokes WHERE status="approved" ORDER BY id DESC LIMIT ?').all(limit);
    res.json({ success: true, data: results.map(row => ({ id: row.id, title: row.title, content: row.content, category: row.category || '搞笑' })) });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// openid 合法性校验（防止 SQL注入等恶意输入）
function isValidOpenid(openid) {
  if (!openid) return false;
  // 合法 openid 格式：微信 oKMOe5* 开头，或开发测试 dev_/wx_/user_ 开头
  // 不允许包含 SQL关键词、特殊字符、超长字符串
  if (openid.length > 100) return false;
  if (/[;'"\-\-\/\*\n\r]/.test(openid)) return false;
  if (/union|select|insert|delete|drop|sleep|jndi|ldap|rmi/i.test(openid)) return false;
  return true;
}

// 获取随机笑话（使用 ORDER BY RANDOM() 保证均匀分布）
router.get('/random', (req, res) => {
  try {
    const db = getDb();
    const joke = db.prepare('SELECT id, title, content, category FROM jokes WHERE status="approved" ORDER BY RANDOM() LIMIT 1').get();
    if (joke) res.json({ success: true, data: { id: joke.id, title: joke.title, content: joke.content, category: joke.category || '搞笑' } });
    else res.json({ success: true, data: null });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 查询笑话列表
router.get('/jokes', (req, res) => {
  try {
    const db = getDb();
    const { category, page = 1, limit = 20 } = req.query;
    const categoryCounts = db.prepare('SELECT category, COUNT(*) as count FROM jokes WHERE status="approved" GROUP BY category ORDER BY COUNT(*) DESC').all();
    const allTotal = db.prepare('SELECT COUNT(*) as count FROM jokes WHERE status="approved"').get()?.count || 0;
    let list, total;
    if (category && category !== '全部') {
      total = db.prepare('SELECT COUNT(*) as count FROM jokes WHERE status="approved" AND category=?').get(category)?.count || 0;
      list = db.prepare('SELECT id, title, content, category, likes, shares FROM jokes WHERE status="approved" AND category=? ORDER BY id DESC LIMIT ? OFFSET ?').all(category, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    } else {
      total = allTotal;
      list = db.prepare('SELECT id, title, content, category, likes, shares FROM jokes WHERE status="approved" ORDER BY id DESC LIMIT ? OFFSET ?').all(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    }
    res.json({ success: true, data: { list: list.map(row => ({ id: row.id, title: row.title, content: row.content, category: row.category || '搞笑', likes: row.likes || 0, shares: row.shares || 0 })), total, categories: ['全部', ...categoryCounts.map(c => c.category)], categoryCounts, page: parseInt(page), limit: parseInt(limit) } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 获取单条笑话详情
router.get('/jokes/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const joke = db.prepare('SELECT id, title, content, category, likes, neutrals, dislikes, shares, date FROM jokes WHERE id=? AND status="approved"').get(id);
    if (!joke) return res.json({ success: false, message: '笑话不存在' });
    res.json({ success: true, data: { id: joke.id, title: joke.title, content: joke.content, category: joke.category || '搞笑', likes: joke.likes || 0, neutrals: joke.neutrals || 0, dislikes: joke.dislikes || 0, shares: joke.shares || 0, date: joke.date || '' } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 点赞（同时自动收藏）
router.post('/like/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const { openid } = req.body;
    db.prepare('UPDATE jokes SET likes = likes + 1 WHERE id=?').run(id);
    if (openid && isValidOpenid(openid)) {
      try { db.prepare('INSERT INTO favorites (joke_id, openid) VALUES (?, ?)').run(id, openid); } catch (e) {}
    }
    const row = db.prepare('SELECT likes, neutrals, dislikes FROM jokes WHERE id=?').get(id);
    res.json({ success: true, data: { likes: row?.likes || 0, neutrals: row?.neutrals || 0, dislikes: row?.dislikes || 0 } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 平
router.post('/neutral/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    db.prepare('UPDATE jokes SET neutrals = neutrals + 1 WHERE id=?').run(id);
    const row = db.prepare('SELECT likes, neutrals, dislikes FROM jokes WHERE id=?').get(id);
    res.json({ success: true, data: { likes: row?.likes || 0, neutrals: row?.neutrals || 0, dislikes: row?.dislikes || 0 } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// 不喜欢
router.post('/dislike/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    db.prepare('UPDATE jokes SET dislikes = dislikes + 1 WHERE id=?').run(id);
    const row = db.prepare('SELECT likes, neutrals, dislikes FROM jokes WHERE id=?').get(id);
    res.json({ success: true, data: { likes: row?.likes || 0, neutrals: row?.neutrals || 0, dislikes: row?.dislikes || 0 } });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;
