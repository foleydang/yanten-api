/**
 * 数据库管理 - 支持OSS恢复
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { restoreFromOSS } = require('../scripts/restore-from-oss');

const DB_PATH = path.join(__dirname, '../../data/database/main.db');

let db = null;

async function initDatabase() {
  // 启动时尝试从OSS恢复（可选）
  // 如果担心本地数据丢失，取消下面注释
  // await restoreFromOSS();

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('Database initialized successfully');
  } else {
    db = new SQL.Database();
    console.log('Database created (new)');
  }
  
  return db;
}

function getDb() {
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

module.exports = { initDatabase, getDb, saveDb };
