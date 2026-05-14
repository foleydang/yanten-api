/**
 * 小游戏排行榜 API
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/database');

// 排行榜缓存（减少数据库读取）
const rankCache = {};
const CACHE_TTL = 30000; // 30秒缓存

// 获取排行榜
router.get('/rank/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'desc'; // desc=分数高的在前，asc=分数少的在前
    
    // 检查缓存
    const cacheKey = `${gameId}_${sort}_${limit}`;
    const cached = rankCache[cacheKey];
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({ success: true, data: cached.data });
    }
    
    const db = getDb();
    const order = sort === 'asc' ? 'ASC' : 'DESC';
    
    const results = db.prepare(`
      SELECT id, game_id, score, nickname, avatar, created_at
      FROM game_ranks
      WHERE game_id = ? AND score > 0
      ORDER BY score ${order}
      LIMIT ?
    `).all(gameId, limit);
    
    const data = results.map((row, index) => ({
      rank: index + 1,
      score: row.score,
      nickname: row.nickname || '玩家',
      avatar: row.avatar,
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

// 提交成绩
router.post('/rank/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { score, nickname, openid, avatar } = req.body;
    
    // 0分不记录
    if (!score || score <= 0) {
      return res.json({ success: false, message: '无效分数' });
    }
    
    const db = getDb();
    
    // 插入记录
    db.prepare(`
      INSERT INTO game_ranks (game_id, score, nickname, openid, avatar, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(gameId, score, nickname || '玩家', openid || null, avatar || null);
    
    // 清除该游戏的缓存
    Object.keys(rankCache).forEach(key => {
      if (key.startsWith(gameId)) delete rankCache[key];
    });
    
    // 返回当前排名
    const sort = gameId === 'memory' ? 'ASC' : 'DESC';
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
router.get('/rank/:gameId/my-best', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { openid } = req.query;
    
    if (!openid) {
      return res.json({ success: true, data: null });
    }
    
    const db = getDb();
    const sort = gameId === 'memory' ? 'ASC' : 'DESC';
    const order = sort === 'asc' ? 'ASC' : 'DESC';
    
    const result = db.prepare(`
      SELECT score, nickname, created_at
      FROM game_ranks
      WHERE game_id = ? AND openid = ?
      ORDER BY score ${order}
      LIMIT 1
    `).get(gameId, openid);
    
    if (result) {
      res.json({
        success: true,
        data: {
          score: result.score,
          nickname: result.nickname,
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
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    
    // 各游戏参与人数和最高分
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

// 清除某游戏排行榜（需管理员权限，暂不实现）
router.delete('/rank/:gameId', async (req, res) => {
  res.json({ success: false, message: '暂不支持清除排行榜' });
});

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    // GMT+8 格式显示
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' , hour12: false });
  } catch {
    return dateStr;
  }
}

// 旧的 formatDate 函数被替换
function formatDateOld(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}

module.exports = router;
