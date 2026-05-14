/**
 * 小游戏排行榜 API - 支持用户系统
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/database');

// 排行榜缓存
const rankCache = {};
const CACHE_TTL = 30000;

// ==================== 用户相关 API ====================

// 保存/更新用户信息
router.post('/user', (req, res) => {
  try {
    const { openid, nickname, avatarIndex } = req.body;
    
    if (!openid) {
      return res.json({ success: false, message: '缺少 openid' });
    }
    
    const db = getDb();
    
    // 先检查用户是否存在
    const existing = db.prepare('SELECT openid FROM users WHERE openid = ?').get(openid);
    
    if (existing) {
      // 更新用户信息
      db.prepare(`
        UPDATE users 
        SET nickname = ?, avatar_index = ?, updated_at = datetime('now', 'localtime')
        WHERE openid = ?
      `).run(nickname || '玩家', avatarIndex || 0, openid);
    } else {
      // 创建新用户
      db.prepare(`
        INSERT INTO users (openid, nickname, avatar_index, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
      `).run(openid, nickname || '玩家', avatarIndex || 0);
    }
    
    res.json({
      success: true,
      data: { openid, nickname: nickname || '玩家', avatarIndex: avatarIndex || 0 }
    });
  } catch (e) {
    console.error('保存用户失败:', e);
    res.json({ success: false, message: e.message });
  }
});

// 获取用户信息
router.get('/user/:openid', (req, res) => {
  try {
    const { openid } = req.params;
    
    if (!openid) {
      return res.json({ success: false, message: '缺少 openid' });
    }
    
    const db = getDb();
    const user = db.prepare('SELECT openid, nickname, avatar_index, created_at FROM users WHERE openid = ?').get(openid);
    
    if (user) {
      res.json({
        success: true,
        data: {
          openid: user.openid,
          nickname: user.nickname || '玩家',
          avatarIndex: user.avatar_index || 0
        }
      });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (e) {
    console.error('获取用户失败:', e);
    res.json({ success: false, message: e.message });
  }
});

// ==================== 排行榜 API ====================

// 获取排行榜（关联用户表获取昵称）
router.get('/rank/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'desc';
    
    // 检查缓存
    const cacheKey = `${gameId}_${sort}_${limit}`;
    const cached = rankCache[cacheKey];
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({ success: true, data: cached.data });
    }
    
    const db = getDb();
    const order = sort === 'asc' ? 'ASC' : 'DESC';
    
    // 关联 users 表获取最新昵称和头像
    const results = db.prepare(`
      SELECT 
        r.id, r.game_id, r.score, r.openid, r.created_at,
        u.nickname, u.avatar_index
      FROM game_ranks r
      LEFT JOIN users u ON r.openid = u.openid
      WHERE r.game_id = ? AND r.score > 0
      ORDER BY r.score ${order}
      LIMIT ?
    `).all(gameId, limit);
    
    const data = results.map((row, index) => ({
      rank: index + 1,
      score: row.score,
      nickname: row.nickname || '玩家',
      avatar: `color:${row.avatar_index || 0}`,
      openid: row.openid,
      date: formatDate(row.created_at)
    }));
    
    // 更新缓存
    rankCache[cacheKey] = { data, time: Date.now() };
    
    res.json({ success: true, data });
  } catch (e) {
    console.error('获取排行榜失败:', e);
    res.json({ success: false, message: e.message });
  }
});

// 提交成绩（只存 openid，昵称从 users 表获取）
router.post('/rank/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const { score, openid } = req.body;
    
    // 0分不记录
    if (!score || score <= 0) {
      return res.json({ success: false, message: '无效分数' });
    }
    
    const db = getDb();
    
    // 获取用户信息
    const user = openid ? db.prepare('SELECT nickname, avatar_index FROM users WHERE openid = ?').get(openid) : null;
    
    // 插入记录（只存 openid）
    db.prepare(`
      INSERT INTO game_ranks (game_id, score, openid, created_at)
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `).run(gameId, score, openid || null);
    
    // 清除缓存
    Object.keys(rankCache).forEach(key => {
      if (key.startsWith(gameId)) delete rankCache[key];
    });
    
    // 计算排名
    const sort = gameId === 'memory' ? 'asc' : 'desc';
    const order = sort === 'asc' ? 'ASC' : 'DESC';
    
    const rankResult = db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM game_ranks
      WHERE game_id = ? AND score > 0 AND score ${sort === 'asc' ? '<' : '>'} ?
    `).get(gameId, score);
    
    res.json({
      success: true,
      data: {
        score,
        nickname: user?.nickname || '玩家',
        avatar: `color:${user?.avatar_index || 0}`,
        rank: rankResult?.rank || 1,
        message: '成绩已提交'
      }
    });
  } catch (e) {
    console.error('提交成绩失败:', e);
    res.json({ success: false, message: e.message });
  }
});

// 获取用户在某游戏的最佳成绩
router.get('/rank/:gameId/my-best', (req, res) => {
  try {
    const { gameId } = req.params;
    const { openid } = req.query;
    
    if (!openid) {
      return res.json({ success: true, data: null });
    }
    
    const db = getDb();
    const sort = gameId === 'memory' ? 'asc' : 'desc';
    const order = sort === 'asc' ? 'ASC' : 'DESC';
    
    const result = db.prepare(`
      SELECT r.score, r.created_at, u.nickname, u.avatar_index
      FROM game_ranks r
      LEFT JOIN users u ON r.openid = u.openid
      WHERE r.game_id = ? AND r.openid = ?
      ORDER BY r.score ${order}
      LIMIT 1
    `).get(gameId, openid);
    
    if (result) {
      res.json({
        success: true,
        data: {
          score: result.score,
          nickname: result.nickname || '玩家',
          avatarIndex: result.avatar_index || 0,
          date: formatDate(result.created_at)
        }
      });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (e) {
    console.error('获取最佳成绩失败:', e);
    res.json({ success: false, message: e.message });
  }
});

// 获取所有游戏统计
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    
    const stats = db.prepare(`
      SELECT 
        game_id,
        COUNT(*) as players,
        MAX(score) as max_score,
        MIN(score) as min_score
      FROM game_ranks
      WHERE score > 0
      GROUP BY game_id
    `).all();
    
    res.json({ success: true, data: stats });
  } catch (e) {
    console.error('获取统计失败:', e);
    res.json({ success: false, message: e.message });
  }
});

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const options = {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    return d.toLocaleString('zh-CN', options);
  } catch {
    return dateStr;
  }
}

module.exports = router;
