const express = require('express');
const router = express.Router();
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data/database/main.db');
let db = null;

async function getDB() {
    if (!db) {
        const SQL = await initSqlJs();
        const buffer = fs.readFileSync(DB_FILE);
        db = new SQL.Database(buffer);
    }
    return db;
}

function saveDB() {
    if (db) {
        const data = db.export();
        fs.writeFileSync(DB_FILE, Buffer.from(data));
    }
}

// 统计接口
router.get('/stats', async (req, res) => {
    try {
        const database = await getDB();
        const result = database.exec(`
            SELECT '总数' as category, COUNT(*) as count FROM jokes
            UNION ALL SELECT '已通过', COUNT(*) FROM jokes WHERE status='approved'
            UNION ALL SELECT '待审核', COUNT(*) FROM jokes WHERE status='pending'
            UNION ALL SELECT '已拒绝', COUNT(*) FROM jokes WHERE status='rejected'
        `);
        const stats = result[0]?.values.map(r => ({category: r[0], count: r[1]})) || [];
        res.json({s: true, d: stats});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 分类统计
router.get('/categories', async (req, res) => {
    try {
        const database = await getDB();
        const result = database.exec('SELECT category, COUNT(*) as count FROM jokes GROUP BY category ORDER BY count DESC');
        const cats = result[0]?.values.map(r => ({category: r[0], count: r[1]})) || [];
        res.json({s: true, d: cats});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 列表接口
router.get('/', async (req, res) => {
    try {
        const database = await getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const category = req.query.category || '';
        const status = req.query.status || '';
        const search = req.query.search || '';
        const offset = (page - 1) * limit;
        
        let where = 'WHERE 1=1';
        if (category) where += ` AND category='${category.replace(/'/g,"''")}'`;
        if (status) where += ` AND status='${status.replace(/'/g,"''")}'`;
        if (search) where += ` AND (title LIKE '%${search.replace(/'/g,"''")}%' OR content LIKE '%${search.replace(/'/g,"''")}%')`;
        
        const totalR = database.exec(`SELECT COUNT(*) FROM jokes ${where}`);
        const total = totalR[0]?.values[0]?.[0] || 0;
        
        const listR = database.exec(`SELECT id,category,title,content,likes,neutrals,dislikes,shares,is_hot,status,date,created_at FROM jokes ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`);
        const list = listR[0]?.values.map(r => ({
            id: r[0], category: r[1], title: r[2], content: r[3],
            likes: r[4], neutrals: r[5], dislikes: r[6], shares: r[7],
            is_hot: r[8], status: r[9], date: r[10], created_at: r[11]
        })) || [];
        
        res.json({s: true, d: {list, total, page, limit}});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 更新
router.put('/:id', async (req, res) => {
    try {
        const database = await getDB();
        const id = parseInt(req.params.id);
        const {title, category, content, status} = req.body;
        if (!title || !content) return res.json({s: false, m: '标题和内容必填'});
        
        database.exec(`UPDATE jokes SET title='${title.replace(/'/g,"''")}',category='${category.replace(/'/g,"''")}',content='${content.replace(/'/g,"''")}',status='${status}' WHERE id=${id}`);
        saveDB();
        res.json({s: true});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 删除单条
router.delete('/:id', async (req, res) => {
    try {
        const database = await getDB();
        database.exec(`DELETE FROM jokes WHERE id=${parseInt(req.params.id)}`);
        saveDB();
        res.json({s: true});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 批量删除
router.delete('/batch', async (req, res) => {
    try {
        const database = await getDB();
        const {ids} = req.body;
        if (!ids?.length) return res.json({s: false, m: '无选中'});
        database.exec(`DELETE FROM jokes WHERE id IN (${ids.join(',')})`);
        saveDB();
        res.json({s: true, d: {deleted: ids.length}});
    } catch (e) { res.json({s: false, m: e.message}); }
});

module.exports = router;
