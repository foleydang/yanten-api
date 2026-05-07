const jwt = require('jsonwebtoken');
const config = require('../../config/default');
const { getDb } = require('../utils/database');

// 认证中间件
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: '请先登录' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.userId = decoded.userId;
    req.openid = decoded.openid;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: '登录已过期，请重新登录' 
    });
  }
}

// 家庭成员检查中间件
function familyMemberMiddleware(req, res, next) {
  const db = getDb();
  const familyId = req.params.familyId || req.body.familyId || req.query.familyId;
  
  if (!familyId) {
    return res.status(400).json({ 
      success: false, 
      message: '缺少家庭ID' 
    });
  }
  
  const member = db.prepare(`
    SELECT fm.*, f.name as family_name
    FROM family_members fm
    JOIN families f ON fm.family_id = f.id
    WHERE fm.family_id = ? AND fm.user_id = ?
  `).get(familyId, req.userId);
  
  if (!member) {
    return res.status(403).json({ 
      success: false, 
      message: '你不是该家庭的成员' 
    });
  }
  
  req.familyMember = member;
  next();
}

// 管理员检查中间件
function adminMiddleware(req, res, next) {
  const db = getDb();
  
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: '需要管理员权限' 
    });
  }
  
  next();
}

module.exports = {
  authMiddleware,
  familyMemberMiddleware,
  adminMiddleware
};