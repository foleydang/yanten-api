/**
 * 导入云开发数据到SQLite（建立ID映射）
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/root/github/family-memo/data';

function parseJsonFile(filename) {
  const content = fs.readFileSync(path.join(DATA_DIR, filename), 'utf8');
  return content.trim().split('\n')
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(item => item !== null);
}

// ID映射表
const idMap = {
  users: {},      // cloudId -> newId
  families: {}    // cloudId -> newId
};

async function importData() {
  const SQL = await initSqlJs();
  
  const dbPath = '/root/github/yanten-api/data/database/main.db';
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  console.log('=== 开始导入云开发数据 ===');
  
  // 清空现有数据（保留表结构）
  console.log('\n清空现有数据...');
  ['shopping_items', 'todos', 'schedules', 'feedback', 'family_members'].forEach(table => {
    db.run(`DELETE FROM ${table}`);
  });
  
  // 1. 导入用户（用openid匹配或创建新用户）
  console.log('\n--- 导入用户 ---');
  const users = parseJsonFile('users.json');
  users.forEach(user => {
    // 查找现有用户
    const stmt = db.prepare('SELECT id FROM users WHERE openid = ?');
    stmt.bind([user.openid]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      idMap.users[user._id] = row.id;
      console.log('用户已存在:', user.nickname, '-> id', row.id);
    } else {
      // 创建新用户
      db.run(
        'INSERT INTO users (openid, nickname, avatar, role, created_at) VALUES (?, ?, ?, ?, ?)',
        [user.openid, user.nickname || '新成员', user.avatarUrl || '', 'member', user.createTime?.['$date']?.substring(0, 19) || null]
      );
      const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      idMap.users[user._id] = lastId;
      console.log('新用户:', user.nickname, '-> id', lastId);
    }
    stmt.free();
  });
  
  // 2. 导入家庭（创建新家庭或更新）
  console.log('\n--- 导入家庭 ---');
  const families = parseJsonFile('families.json');
  families.forEach(family => {
    // 查找现有家庭
    const stmt = db.prepare('SELECT id FROM families WHERE invite_code = ?');
    stmt.bind([family.inviteCode]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      idMap.families[family._id] = row.id;
      console.log('家庭已存在:', family.name, '-> id', row.id);
    } else {
      const createdById = idMap.users[family.createdBy] || 1;
      db.run(
        'INSERT INTO families (name, invite_code, created_by, created_at) VALUES (?, ?, ?, ?)',
        [family.name, family.inviteCode, createdById, family.createTime?.['$date']?.substring(0, 19) || null]
      );
      const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      idMap.families[family._id] = lastId;
      console.log('新家庭:', family.name, 'invite:', family.inviteCode, '-> id', lastId);
    }
    stmt.free();
  });
  
  // 3. 导入家庭成员
  console.log('\n--- 导入家庭成员 ---');
  const members = parseJsonFile('family_members.json');
  members.forEach(member => {
    const familyId = idMap.families[member.familyId];
    const userId = idMap.users[member.userId];
    if (!familyId || !userId) {
      console.log('跳过成员:', member._id, '(缺少映射)');
      return;
    }
    try {
      db.run(
        'INSERT OR IGNORE INTO family_members (family_id, user_id, nickname, role, joined_at) VALUES (?, ?, ?, ?, ?)',
        [familyId, userId, member.nickname || '', member.role || 'member', member.joinTime?.['$date']?.substring(0, 19) || null]
      );
      console.log('成员:', member.nickname || '匿名', 'family', familyId, 'user', userId);
    } catch (e) {
      console.log('成员导入失败:', e.message);
    }
  });
  
  // 4. 导入购物清单
  console.log('\n--- 导入购物清单 ---');
  const shopping = parseJsonFile('shopping.json');
  shopping.forEach(item => {
    const familyId = idMap.families[item.familyId];
    const addedBy = idMap.users[item.createdBy];
    const doneBy = item.doneBy ? idMap.users[item.doneBy] : null;
    if (!familyId || !addedBy) {
      console.log('跳过购物项:', item.title, '(缺少映射)');
      return;
    }
    try {
      db.run(
        'INSERT INTO shopping_items (family_id, title, category, quantity, unit, priority, status, added_by, done_by, done_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [familyId, item.title, item.category || 'other', item.quantity || 1, item.unit || '个', item.priority || 0, item.status || 'pending', addedBy, doneBy, item.doneTime?.['$date']?.substring(0, 19) || null, item.createTime?.['$date']?.substring(0, 19) || null]
      );
      console.log('购物项:', item.title, item.status);
    } catch (e) {
      console.log('购物项导入失败:', e.message);
    }
  });
  
  // 5. 导入待办事项
  console.log('\n--- 导入待办事项 ---');
  const todos = parseJsonFile('todos.json');
  todos.forEach(todo => {
    const familyId = idMap.families[todo.familyId];
    const addedBy = idMap.users[todo.createdBy];
    if (!familyId || !addedBy) {
      console.log('跳过待办:', todo.title, '(缺少映射)');
      return;
    }
    try {
      db.run(
        'INSERT INTO todos (family_id, title, description, due_date, priority, status, added_by, done_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [familyId, todo.title, todo.description || '', todo.dueDate || null, todo.priority || 0, todo.status || 'pending', addedBy, todo.doneTime?.['$date']?.substring(0, 19) || null, todo.createTime?.['$date']?.substring(0, 19) || null]
      );
      console.log('待办:', todo.title, todo.status);
    } catch (e) {
      console.log('待办导入失败:', e.message);
    }
  });
  
  // 6. 导入日程
  console.log('\n--- 导入日程 ---');
  const schedules = parseJsonFile('schedules.json');
  schedules.forEach(schedule => {
    const familyId = idMap.families[schedule.familyId];
    const createdBy = idMap.users[schedule.createdBy];
    if (!familyId || !createdBy) {
      console.log('跳过日程:', schedule.title, '(缺少映射)');
      return;
    }
    try {
      db.run(
        'INSERT INTO schedules (family_id, title, description, schedule_date, schedule_time, type, remind_before, repeat_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [familyId, schedule.title, schedule.description || '', schedule.scheduleDate || null, schedule.scheduleTime || null, schedule.type || 'other', schedule.remindBefore || 1, schedule.repeatType || 'none', createdBy, schedule.createTime?.['$date']?.substring(0, 19) || null]
      );
      console.log('日程:', schedule.title, schedule.scheduleDate);
    } catch (e) {
      console.log('日程导入失败:', e.message);
    }
  });
  
  // 7. 导入反馈
  console.log('\n--- 导入反馈 ---');
  const feedback = parseJsonFile('feedback.json');
  feedback.forEach(fb => {
    const userId = idMap.users[fb.userId];
    if (!userId) {
      console.log('跳过反馈:', fb._id, '(缺少用户映射)');
      return;
    }
    try {
      db.run(
        'INSERT INTO feedback (user_id, type, content, contact, images, status, reply, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, fb.type || 'bug', fb.content || '', fb.contact || '', JSON.stringify(fb.images || []), fb.status || 'pending', fb.reply || '', fb.createTime?.['$date']?.substring(0, 19) || null]
      );
      console.log('反馈:', fb.type, fb.status);
    } catch (e) {
      console.log('反馈导入失败:', e.message);
    }
  });
  
  // 保存数据库
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  
  // 验证
  console.log('\n=== 数据验证 ===');
  const counts = {};
  ['users', 'families', 'family_members', 'shopping_items', 'todos', 'schedules', 'feedback'].forEach(table => {
    const result = db.exec(`SELECT COUNT(*) FROM ${table}`);
    counts[table] = result[0]?.values[0]?.[0] || 0;
    console.log(`${table}: ${counts[table]} 条`);
  });
  
  console.log('\n✅ 导入完成！');
  return counts;
}

importData().catch(console.error);
