-- 家庭备忘录数据库初始化脚本
-- SQLite

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openid TEXT UNIQUE NOT NULL,
    nickname TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 家庭表
CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 家庭成员关联表
CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    nickname TEXT,
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, user_id)
);

-- 购物清单表
CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT '其他',
    quantity INTEGER DEFAULT 1,
    unit TEXT DEFAULT '个',
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    added_by INTEGER NOT NULL,
    done_by INTEGER,
    done_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 待办事项表
CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    assignee_id INTEGER,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    added_by INTEGER NOT NULL,
    done_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 日程表
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    schedule_date DATE NOT NULL,
    schedule_time TIME,
    type TEXT DEFAULT 'other',
    remind_before INTEGER DEFAULT 1,
    repeat_type TEXT DEFAULT 'none',
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 消息通知表
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    related_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 反馈表
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT DEFAULT 'bug',
    content TEXT NOT NULL,
    contact TEXT,
    images TEXT,
    status TEXT DEFAULT 'pending',
    reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shopping_family ON shopping_items(family_id);
CREATE INDEX IF NOT EXISTS idx_shopping_status ON shopping_items(status);
CREATE INDEX IF NOT EXISTS idx_todo_family ON todos(family_id);
CREATE INDEX IF NOT EXISTS idx_todo_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_schedule_family ON schedules(family_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_family_members ON family_members(family_id, user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
