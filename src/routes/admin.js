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

// 列表
router.get('/', async (req, res) => {
    try {
        const database = await getDB();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const status = req.query.status || '';
        const search = req.query.search || '';
        const offset = (page - 1) * limit;
        
        let where = 'WHERE 1=1';
        if (status) where += ` AND status='${status}'`;
        if (search) where += ` AND (title LIKE '%${search}%' OR content LIKE '%${search}%')`;
        
        const totalR = database.exec(`SELECT COUNT(*) FROM jokes ${where}`);
        const total = totalR[0]?.values[0]?.[0] || 0;
        
        const listR = database.exec(`SELECT id,title,content,status FROM jokes ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`);
        res.json({s: true, d: {list: listR[0]?.values.map(r => ({id: r[0], title: r[1], content: r[2], status: r[3]})) || [], total}});
    } catch (e) { res.json({s: false, m: e.message}); }
});

// 更新（通过审核或编辑内容）
router.put('/:id', async (req, res) => {
    try {
        const database = await getDB();
        const id = parseInt(req.params.id);
        const {title, content, status} = req.body;
        
        // 如果只传status，只更新状态
        if (status && !title && !content) {
            database.exec(`UPDATE jokes SET status='${status}' WHERE id=${id}`);
            saveDB();
            return res.json({s: true});
        }
        
        // 如果传了title和content，更新内容并设为已审核
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
