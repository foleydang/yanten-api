// 数据库初始化脚本
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function initDatabase() {
  console.log('🚀 开始初始化数据库...');

  try {
    const SQL = await initSqlJs();

    // 数据库路径
    const dbPath = process.env.DB_PATH || './data/database/main.db';
    const dbDir = path.dirname(dbPath);

    // 确保目录存在
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('✅ 创建数据目录:', dbDir);
    }

    // 创建或加载数据库
    let db;
    if (fs.existsSync(dbPath)) {
      console.log('📂 加载现有数据库:', dbPath);
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      console.log('📝 创建新数据库:', dbPath);
      db = new SQL.Database();
    }

    // 执行 schema
    const schemaPath = path.join(__dirname, '../../data/database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const statements = schema.split(';').filter(s => s.trim());

      for (const stmt of statements) {
        try {
          db.run(stmt);
        } catch (e) {
          if (!e.message.includes('already exists')) {
            console.warn('⚠️  SQL warning:', e.message);
          }
        }
      }
      console.log('✅ Schema 执行完成');
    }

    // 查询表信息
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('📊 数据库表:', tables[0]?.values?.map(v => v[0]).join(', ') || '无');

    // 保存数据库
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log('💾 数据库已保存:', dbPath);

    // 统计
    const stats = {
      users: db.exec('SELECT COUNT(*) FROM users')[0]?.values[0][0] || 0,
      families: db.exec('SELECT COUNT(*) FROM families')[0]?.values[0][0] || 0,
      shopping_items: db.exec('SELECT COUNT(*) FROM shopping_items')[0]?.values[0][0] || 0,
      todos: db.exec('SELECT COUNT(*) FROM todos')[0]?.values[0][0] || 0,
      schedules: db.exec('SELECT COUNT(*) FROM schedules')[0]?.values[0][0] || 0
    };

    console.log('');
    console.log('📈 数据统计:');
    console.log('  用户:', stats.users);
    console.log('  家庭:', stats.families);
    console.log('  购物清单:', stats.shopping_items);
    console.log('  待办事项:', stats.todos);
    console.log('  日程:', stats.schedules);
    console.log('');
    console.log('🎉 数据库初始化完成！');

    db.close();
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();