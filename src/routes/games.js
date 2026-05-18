/**
 * 小游戏排行榜 API
 * 功能：排行榜查询、提交成绩、用户最佳成绩
 * 用户体系：通过 authMiddleware 获取 req.userId，关联统一 users 表
 * 注意：已登录用户用 user_id，未登录小程序用户保留 openid 兼容
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

// 排行榜缓存
const rankCache = {};
const CACHE_TTL = 30000;

// ==================== 排行榜 API ====================

// 获取排行榜
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

    // 关联统一 users 表获取昵称和头像
    const results = db.prepare(`
      SELECT 
        r.id, r.game_id, r.score, r.user_id, r.openid, r.created_at,
        u.nickname, u.avatar_index
      FROM game_ranks r
      LEFT JOIN users u ON (r.user_id = u.id) OR (r.openid = u.openid AND r.user_id IS NULL)
      WHERE r.game_id = ? AND r.score > 0
      ORDER BY r.score ${order}
      LIMIT ?
    `).all(gameId, limit);

    const data = results.map((row, index) => ({
      rank: index + 1,
      score: row.score,
      nickname: row.nickname || '玩家',
      avatar: row.avatar_index || 0,
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

// 提交成绩（支持已登录 user_id 和未登录 openid）
router.post('/rank/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const { score, openid } = req.body;

    if (!score || score <= 0) {
      return res.json({ success: false, message: '无效分数' });
    }

    const db = getDb();

    // 查找用户：优先 openid → 统一 users 表
    let userId = null;
    let userInfo = null;
    if (openid) {
      userInfo = db.prepare('SELECT id, nickname, avatar_index FROM users WHERE openid = ?').get(openid);
      if (userInfo) userId = userInfo.id;
    }

    // 插入记录
    db.prepare(`
      INSERT INTO game_ranks (game_id, score, user_id, openid, created_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(gameId, score, userId, openid || null);

    // 清除缓存
    Object.keys(rankCache).forEach(key => {
      if (key.startsWith(gameId)) delete rankCache[key];
    });

    // 计算排名
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
        nickname: userInfo?.nickname || '玩家',
        avatar: userInfo?.avatar_index || 0,
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

    // 先从 openid 找到 user_id
    const user = db.prepare('SELECT id, nickname, avatar_index FROM users WHERE openid = ?').get(openid);
    const userId = user?.id;

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
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch { return dateStr; }
}

module.exports = router;
