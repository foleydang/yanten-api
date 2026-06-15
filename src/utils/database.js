const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../../config/default');

let db = null;

// 批量保存机制：避免每次写操作都 fs.writeFileSync
let saveTimer = null;
let dirtyCount = 0;
const SAVE_INTERVAL = 5000; // 5秒批量保存一次
const DIRTY_THRESHOLD = 50; // 或累计50次写操作立即保存

// 立即保存数据库到文件（用于初始化和关闭时）
function saveDatabaseNow() {
  if (db && config.database.path) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(config.database.path, buffer);
      dirtyCount = 0;
    } catch (e) {
      console.error('数据库保存失败:', e.message);
    }
  }
}

// 标记脏数据，触发延迟保存
function markDirty() {
  dirtyCount++;
  if (dirtyCount >= DIRTY_THRESHOLD) {
    // 达到阈值立即保存
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveDatabaseNow();
    return;
  }
  // 延迟保存
  if (!saveTimer) {
    saveTimer = setTimeout(() => {
      saveDatabaseNow();
      saveTimer = null;
    }, SAVE_INTERVAL);
  }
}

// 数据库初始化
async function initDatabase() {
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
    const schemaPath = path.join(__dirname, '../../data/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // 分割并执行每条 SQL 语句
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      try {
        db.run(stmt);
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.warn('SQL warning:', e.message);
        }
      }
    }

    // 初始化后立即保存
    saveDatabaseNow();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database init error:', error);
    throw error;
  }
}

// 优雅关闭：确保数据保存
function shutdownDatabase() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveDatabaseNow();
  console.log('Database shutdown, data saved');
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
            // 标记脏数据，延迟批量保存（不再每次 fs.writeFileSync）
            markDirty();
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
        markDirty();
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
  formatTime,
  saveDatabaseNow,
  shutdownDatabase
};
