/**
 * 小游戏排行榜 API
 * - 用户系统共用 auth.js 的 users 表（不再有独立用户 CRUD）
 * - 排行榜提交只需 openid，昵称从 users 表自动获取
 * - 支持排行榜查询、成绩提交、最佳成绩查询
 */
const express = require('express');
const router = express.Router();
const config = require('../../config/default');
const { getDb } = require('../utils/database');

// 排行榜缓存
const rankCache = {};
const CACHE_TTL = 30000;

// ==================== 排行榜 API ====================

// 获取排行榜（关联 users 表获取昵称和头像）
router.get('/rank/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'desc';

    const cacheKey = `${gameId}_${sort}_${limit}`;
    const cached = rankCache[cacheKey];
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({ success: true, data: cached.data });
    }

    const db = getDb();
    const order = sort === 'asc' ? 'ASC' : 'DESC';

    const results = db.prepare(`
      SELECT r.id, r.game_id, r.score, r.openid, r.created_at,
        u.nickname, u.avatar_index, u.avatar
      FROM game_ranks r
      LEFT JOIN users u ON r.openid = u.openid
      WHERE r.game_id = ? AND r.score > 0
      ORDER BY r.score ${order}
      LIMIT ?
    `).all(gameId, limit);

    const baseUrl = config.baseUrl;
    const data = results.map((row, index) => ({
      rank: index + 1,
      score: row.score,
      nickname: row.nickname || '玩家',
      avatar: row.avatar && row.avatar.startsWith('http') ? row.avatar : (row.avatar ? baseUrl + row.avatar : ''),
      avatarIndex: row.avatar_index || 0,
      openid: row.openid,
      date: formatDate(row.created_at)
    }));

    rankCache[cacheKey] = { data, time: Date.now() };
    res.json({ success: true, data });
  } catch (e) {
    console.error('获取排行榜失败:', e);
    res.json({ success: false, message: e.message });
  }
});

// 提交成绩
router.post('/rank/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const { score, openid } = req.body;

    if (!score || score <= 0) {
      return res.json({ success: false, message: '无效分数' });
    }
    if (!openid) {
      return res.json({ success: false, message: '缺少 openid' });
    }

    const db = getDb();
    const user = db.prepare('SELECT nickname, avatar_index FROM users WHERE openid = ?').get(openid);
    const nickname = user?.nickname || '玩家';

    db.prepare(`
      INSERT INTO game_ranks (game_id, score, openid, nickname, created_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(gameId, score, openid, nickname);

    // 清除缓存
    Object.keys(rankCache).forEach(key => {
      if (key.startsWith(gameId)) delete rankCache[key];
    });

    const sort = gameId === 'memory' ? 'asc' : 'desc';
    const rankResult = db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM game_ranks
      WHERE game_id = ? AND score > 0 AND score ${sort === 'asc' ? '<' : '>'} ?
    `).get(gameId, score);

    res.json({
      success: true,
      data: {
        score,
        nickname,
        avatarIndex: user?.avatar_index || 0,
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

    if (!openid) return res.json({ success: true, data: null });

    const db = getDb();
    const sort = gameId === 'memory' ? 'asc' : 'desc';
    const order = sort === 'asc' ? 'ASC' : 'DESC';

    const result = db.prepare(`
      SELECT r.score, r.created_at, u.nickname, u.avatar_index, u.avatar
      FROM game_ranks r
      LEFT JOIN users u ON r.openid = u.openid
      WHERE r.game_id = ? AND r.openid = ?
      ORDER BY r.score ${order}
      LIMIT 1
    `).get(gameId, openid);

    if (result) {
      const baseUrl = config.baseUrl;
      res.json({
        success: true,
        data: {
          score: result.score,
          nickname: result.nickname || '玩家',
          avatar: result.avatar && result.avatar.startsWith('http') ? result.avatar : (result.avatar ? baseUrl + result.avatar : ''),
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
      SELECT game_id, COUNT(*) as players, MAX(score) as max_score, MIN(score) as min_score
      FROM game_ranks WHERE score > 0 GROUP BY game_id
    `).all();
    res.json({ success: true, data: stats });
  } catch (e) {
    console.error('获取统计失败:', e);
    res.json({ success: false, message: e.message });
  }
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return dateStr; }
}

module.exports = router;
