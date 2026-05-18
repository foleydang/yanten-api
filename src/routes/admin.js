/**
 * 笑话管理后台 - 审核/删除/统计
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../../config/default');
const { getDb } = require('../utils/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 管理员登录（不需要认证）
router.post('/login', (req, res) => {
  const { password } = req.body;
  
  if (password === config.admin.password) {
    // 生成管理员 token，标记 role 为 admin
    const token = jwt.sign(
      { userId: 'admin', openid: 'admin', role: 'admin' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.json({ s: true, d: { token } });
  } else {
    res.json({ s: false, m: '密码错误' });
  }
});

// 以下路由需要管理员认证
router.use(authMiddleware, adminMiddleware);

// 统计
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as count FROM jokes').get()?.count || 0;
    const approved = db.prepare('SELECT COUNT(*) as count FROM jokes WHERE status="approved"').get()?.count || 0;
    const pending = db.prepare('SELECT COUNT(*) as count FROM jokes WHERE status="pending"').get()?.count || 0;
    res.json({s: true, d: [
      {category: '总数', count: total},
      {category: '已审核', count: approved},
      {category: '待审核', count: pending}
    ]});
  } catch (e) { res.json({s: false, m: e.message}); }
});

// 分类统计
router.get('/categories', (req, res) => {
  try {
    const db = getDb();
    const results = db.prepare('SELECT category, COUNT(*) as count FROM jokes GROUP BY category ORDER BY COUNT(*) DESC').all();
    res.json({s: true, d: results});
  } catch (e) { res.json({s: false, m: e.message}); }
});

// 列表
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const category = req.query.category || '';
    const status = req.query.status || '';
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    
    let conditions = [];
    let params = [];
    
    if (category) {
      conditions.push('category=?');
      params.push(category);
    }
    if (status) {
      conditions.push('status=?');
      params.push(status);
    }
    if (search) {
      conditions.push('(title LIKE ? OR content LIKE ?)');
      params.push('%' + search + '%', '%' + search + '%');
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    const total = db.prepare(`SELECT COUNT(*) as count FROM jokes ${whereClause}`).get(...params)?.count || 0;
    const list = db.prepare(`SELECT id, category, title, content, status FROM jokes ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    
    res.json({s: true, d: {list, total}});
  } catch (e) { res.json({s: false, m: e.message}); }
});

// 更新
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const {title, content, status} = req.body;
    
    if (status && !title && !content) {
      db.prepare('UPDATE jokes SET status=? WHERE id=?').run(status, id);
      return res.json({s: true});
    }
    
    if (title && content) {
      db.prepare('UPDATE jokes SET title=?, content=?, status="approved" WHERE id=?').run(title, content, id);
      return res.json({s: true});
    }
    
    res.json({s: false, m: '参数错误'});
  } catch (e) { res.json({s: false, m: e.message}); }
});

// 删除
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM jokes WHERE id=?').run(parseInt(req.params.id));
    res.json({s: true});
  } catch (e) { res.json({s: false, m: e.message}); }
});

// 批量删除
router.delete('/batch', (req, res) => {
  try {
    const db = getDb();
    const {ids} = req.body;
    if (!ids?.length) return res.json({s: false, m: '无选中'});
    
    const validIds = ids.map(id => parseInt(id)).filter(id => id > 0);
    if (validIds.length !== ids.length) return res.json({s: false, m: '参数错误'});
    
    const placeholders = validIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM jokes WHERE id IN (${placeholders})`).run(...validIds);
    res.json({s: true, d: {deleted: validIds.length}});
  } catch (e) { res.json({s: false, m: e.message}); }
});

// 批量通过
router.post('/batch/approve', (req, res) => {
  try {
    const db = getDb();
    const {ids} = req.body;
    if (!ids?.length) return res.json({s: false, m: '无选中'});
    
    const validIds = ids.map(id => parseInt(id)).filter(id => id > 0);
    if (validIds.length !== ids.length) return res.json({s: false, m: '参数错误'});
    
    const placeholders = validIds.map(() => '?').join(',');
    db.prepare(`UPDATE jokes SET status="approved" WHERE id IN (${placeholders})`).run(...validIds);
    res.json({s: true, d: {approved: validIds.length}});
  } catch (e) { res.json({s: false, m: e.message}); }
});

module.exports = router;
