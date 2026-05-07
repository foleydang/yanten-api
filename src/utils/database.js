const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../../config/default');

let db = null;

// 数据库初始化
async function initDatabase() {
  return new Promise(async (resolve, reject) => {
    try {
      const SQL = await initSqlJs();
      
      // 确保数据目录存在
      const dbPath = config.database.path;
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // 尝试加载已有数据库
      if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
      } else {
        db = new SQL.Database();
      }
      
      // 读取并执行初始化脚本
      const schemaPath = path.join(__dirname, '../../database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      
      // 分割并执行每条 SQL 语句
      const statements = schema.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        try {
          db.run(stmt);
        } catch (e) {
          // 忽略已存在的错误
          if (!e.message.includes('already exists')) {
            console.warn('SQL warning:', e.message);
          }
        }
      }
      
      saveDatabase();
      console.log('Database initialized successfully');
      resolve();
    } catch (error) {
      console.error('Database init error:', error);
      reject(error);
    }
  });
}

// 保存数据库到文件
function saveDatabase() {
  if (db && config.database.path) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.database.path, buffer);
  }
}

// 获取数据库连接
function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return {
    // 执行查询，返回所有结果
    prepare: (sql) => {
      return {
        all: (...params) => {
          try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
              const row = stmt.getAsObject();
              results.push(row);
            }
            stmt.free();
            return results;
          } catch (e) {
            console.error('SQL error:', e.message, sql);
            return [];
          }
        },
        get: (...params) => {
          try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            let result = null;
            if (stmt.step()) {
              result = stmt.getAsObject();
            }
            stmt.free();
            return result;
          } catch (e) {
            console.error('SQL error:', e.message, sql);
            return null;
          }
        },
        run: (...params) => {
          try {
            db.run(sql, params);
            saveDatabase();
            // 获取最后插入的 ID
            const idResult = db.exec("SELECT last_insert_rowid()");
            const lastId = idResult[0]?.values[0]?.[0] || 0;
            return {
              lastInsertRowid: lastId,
              changes: db.getRowsModified()
            };
          } catch (e) {
            console.error('SQL error:', e.message, sql);
            return { lastInsertRowid: 0, changes: 0 };
          }
        }
      };
    },
    // 直接执行 SQL
    exec: (sql) => {
      try {
        db.run(sql);
        saveDatabase();
      } catch (e) {
        console.error('SQL exec error:', e.message);
      }
    }
  };
}

// 生成邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 格式化日期
function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// 格式化时间
function formatTime(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toTimeString().split(' ')[0].slice(0, 5);
}

module.exports = {
  initDatabase,
  getDb,
  generateInviteCode,
  formatDate,
  formatTime
};