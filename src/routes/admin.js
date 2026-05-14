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

// 统计
router.get('/stats', async (req, res) => {
    try {
        const database = await getDB();
        const r = database.exec("SELECT '总数',COUNT(*) FROM jokes UNION ALL SELECT '已审核',COUNT(*) WHERE status='approved' UNION ALL SELECT '待审核',COUNT(*) WHERE status='pending'");
        res.json({s: true, d: r[0]?.values.map(x => ({category: x[0], count: x[1]})) || []});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 分类统计
router.get('/categories', async (req, res) => {
    try {
        const database = await getDB();
        const r = database.exec("SELECT category, COUNT(*) FROM jokes GROUP BY category ORDER BY COUNT(*) DESC");
        res.json({s: true, d: r[0]?.values.map(x => ({category: x[0], count: x[1]})) || []});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 列表
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
        
        const listR = database.exec(`SELECT id,category,title,content,status FROM jokes ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`);
        res.json({s: true, d: {list: listR[0]?.values.map(r => ({id: r[0], category: r[1], title: r[2], content: r[3], status: r[4]})) || [], total}});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 更新
router.put('/:id', async (req, res) => {
    try {
        const database = await getDB();
        const id = parseInt(req.params.id);
        const {title, content, status} = req.body;
        
        if (status && !title && !content) {
            database.exec(`UPDATE jokes SET status='${status}' WHERE id=${id}`);
            saveDB();
            return res.json({s: true});
        }
        
        if (title && content) {
            const safeTitle = title.replace(/'/g, "''");
            const safeContent = content.replace(/'/g, "''");
            database.exec(`UPDATE jokes SET title='${safeTitle}', content='${safeContent}', status='approved' WHERE id=${id}`);
            saveDB();
            return res.json({s: true});
        }
        
        res.json({s: false, m: '参数错误'});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 删除
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

// 批量通过
router.post('/batch/approve', async (req, res) => {
    try {
        const database = await getDB();
        const {ids} = req.body;
        if (!ids?.length) return res.json({s: false, m: '无选中'});
        database.exec(`UPDATE jokes SET status='approved' WHERE id IN (${ids.join(',')})`);
        saveDB();
        res.json({s: true, d: {approved: ids.length}});
    } catch (e) { res.json({s: false, m: e.message}); }
});

module.exports = router;
