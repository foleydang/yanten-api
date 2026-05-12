const express = require('express');
const router = express.Router();
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data/database/main.db');
let db = null;

async function loadDB() {
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

// 笑话列表 - 无缓存版本
router.get('/jokes', async (req, res) => {
    try {
        const database = await loadDB();
        const { category, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // 获取总数
        const totalResult = database.exec('SELECT COUNT(*) as total FROM jokes WHERE status = "approved"');
        const total = totalResult[0]?.values[0]?.[0] || 0;
        
        // 获取笑话列表
        let query = `SELECT id, category, title, content FROM jokes WHERE status = "approved"`;
        if (category && category !== '全部') {
            query += ` AND category = '${category}'`;
        }
        query += ` ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
        
        const listResult = database.exec(query);
        const list = listResult[0]?.values.map(row => ({
            id: row[0],
            category: row[1],
            title: row[2],
            content: row[3]
        })) || [];
        
        // 获取分类统计
        const catResult = database.exec('SELECT category, COUNT(*) as count FROM jokes WHERE status = "approved" GROUP BY category ORDER BY count DESC');
        const categories = ['全部'];
        if (catResult[0]) {
            catResult[0].values.forEach(row => categories.push(row[0]));
        }
        
        res.json({
            success: true,
            data: {
                list,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                categories
            }
        });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// 获取单个笑话
router.get('/jokes/:id', async (req, res) => {
    try {
        const database = await loadDB();
        const result = database.exec(`SELECT id, category, title, content FROM jokes WHERE id = ${parseInt(req.params.id)}`);
        if (result[0]?.values.length > 0) {
            const row = result[0].values[0];
            res.json({
                success: true,
                data: {
                    id: row[0],
                    category: row[1],
                    title: row[2],
                    content: row[3]
                }
            });
        } else {
            res.json({ success: false, message: '笑话不存在' });
        }
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

module.exports = router;
