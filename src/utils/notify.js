/**
 * 通知工具 - 各模块统一调用来创建通知
 */
const { getDb } = require('./database');

const TEMPLATES = {
  schedule_remind: (title, date) => ({ title: '📅 日程提醒', content: `「${title}」将于${date}举行` }),
  todo_assign: (title, assigner) => ({ title: '✅ 新待办', content: `${assigner}指派了「${title}」给你` }),
  shopping_added: (title, adder) => ({ title: '🛒 新购物', content: `${adder}添加了「${title}」` }),
  wish_fulfilled: (title) => ({ title: '🌟 心愿达成', content: `「${title}」已实现！` }),
  family_join: (name) => ({ title: '👋 新成员', content: `${name}加入了家庭` }),
  schedule_add: (title, date, adder) => ({ title: '📅 新日程', content: `${adder}添加了「${title}」${date}` }),
};

function createNotification(familyId, userId, type, relatedId, extra = {}) {
  const db = getDb();
  const tpl = TEMPLATES[type];
  if (!tpl) return;
  const { title, content } = tpl(...(extra.args || []));
  try {
    db.prepare(
      'INSERT INTO notifications (family_id, user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(familyId, userId, type, title, content, relatedId || null);
  } catch (e) {
    console.error('创建通知失败:', e.message);
  }
}

// 给家庭所有成员发通知（排除创建者）
function notifyFamily(familyId, excludeUserId, type, relatedId, extra = {}) {
  const db = getDb();
  try {
    const members = db.prepare('SELECT user_id FROM family_members WHERE family_id = ? AND user_id != ?').all(familyId, excludeUserId);
    members.forEach(m => createNotification(familyId, m.user_id, type, relatedId, extra));
  } catch (e) {
    console.error('通知家庭成员失败:', e.message);
  }
}

module.exports = { createNotification, notifyFamily };