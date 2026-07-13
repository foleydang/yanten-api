/**
 * 小游戏排行榜 API
 * - 用户系统共用 auth.js 的 users 表（不再有独立用户 CRUD）
 * - 排行榜提交只需 openid，昵称从 users 表自动获取
 * - 支持排行榜查询、成绩提交、最佳成绩查询
 */
// openid 合法性校验
function isValidOpenid(openid) {
  if (!openid) return false;
  if (openid.length > 100) return false;
  if (/[;'"\-\-\/\*\n\r]/.test(openid)) return false;
  if (/union|select|insert|delete|drop|sleep|jndi|ldap|rmi/i.test(openid)) return false;
  return true;
}

const express = require('express');
const router = express.Router();
const multer = require('multer');
const config = require('../../config/default');
const { getDb } = require('../utils/database');
const { getAccessToken } = require('../utils/wechat-token');

// ==================== 本地敏感词兜底 ====================
const SENSITIVE_WORDS = [
  '色情', '裸聊', '一夜情', '嫖娼', 'av女优', '成人电影', '做爱', '性交易',
  '赌博', '博彩', '赌场', '六合彩', '时时彩', '押注', '老虎机', '百家乐',
  '毒品', '冰毒', '大麻', '枪支', '办证', '发票代开', '洗钱', '传销',
  '诈骗', '刷单', '外挂', '私服',
  '傻逼', '傻B', '操你', '草泥马', 'nmsl', '狗娘养',
];

function containsSensitive(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.replace(/\s+/g, '');
  return SENSITIVE_WORDS.some(w => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(normalized));
}

// ==================== 登录 API ====================

/**
 * 微信登录（轻量版，仅返回 openid）
 * 前端约定: POST /api/games/login { code }
 * 返回: { success: true, openid: "真实openid" }
 * 内部调用微信 jscode2session 换取 openid
 */
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.json({ success: false, message: '缺少 code' });
    }

    // 使用小游戏凭证（appid: wx1529e72999162c2f）
    const gamesAppId = process.env.WECHAT_GAMES_APP_ID;
    const gamesAppSecret = process.env.WECHAT_GAMES_APP_SECRET;
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${gamesAppId}&secret=${gamesAppSecret}&js_code=${code}&grant_type=authorization_code`;
    const resp = await fetch(wxUrl);
    const data = await resp.json();

    if (data.openid) {
      // 确保 users 表有记录（不存在则创建）
      const db = getDb();
      const existing = db.prepare('SELECT id FROM users WHERE openid = ?').get(data.openid);
      if (!existing) {
        db.prepare('INSERT INTO users (openid, nickname, avatar) VALUES (?, ?, ?)').run(data.openid, '玩家', '');
      }
      console.log('🎮 小游戏登录 openid:', data.openid);
      return res.json({ success: true, openid: data.openid });
    }

    console.warn('jscode2session 失败:', data.errcode, data.errmsg);
    return res.json({ success: false, message: data.errmsg || '登录失败' });
  } catch (err) {
    console.error('games/login 错误:', err.message);
    return res.json({ success: false, message: '登录服务异常' });
  }
});

// multer 用于接收图片上传（imgSecCheck）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1 * 1024 * 1024 } }); // 1MB

// 排行榜缓存（定期清理过期条目，防止内存无限增长）
const rankCache = {};
const CACHE_TTL = 30000;
const MAX_CACHE_SIZE = 50;

// 每60秒清理过期缓存
setInterval(() => {
  const now = Date.now();
  const keys = Object.keys(rankCache);
  keys.forEach(key => {
    if (now - rankCache[key].time > CACHE_TTL) {
      delete rankCache[key];
    }
  });
  // 如果缓存条目仍超过上限，淘汰最旧的
  if (Object.keys(rankCache).length > MAX_CACHE_SIZE) {
    const entries = Object.entries(rankCache).sort((a, b) => a[1].time - b[1].time);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => delete rankCache[key]);
  }
}, 60000);

// ==================== 用户 API ====================

// 获取用户信息
router.get('/user/:openid', (req, res) => {
  try {
    const { openid } = req.params;
    if (!openid || !isValidOpenid(openid)) {
      return res.json({ success: false, message: '无效 openid' });
    }
    const db = getDb();
    const user = db.prepare('SELECT nickname, avatar_index, avatar FROM users WHERE openid = ?').get(openid);
    if (user) {
      res.json({ success: true, data: { nickname: user.nickname || '玩家', avatarIndex: user.avatar_index || 0, avatar: user.avatar || '' } });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (e) {
    console.error('获取用户信息失败:', e);
    res.json({ success: false, message: e.message });
  }
});

// 更新用户信息（昵称、头像索引）
router.post('/user', (req, res) => {
  try {
    const { openid, nickname, avatarIndex } = req.body;
    if (!openid || !isValidOpenid(openid)) {
      return res.json({ success: false, message: '无效 openid' });
    }

    // 后端兜底：违规昵称不写入数据库
    const safeNickname = containsSensitive(nickname) ? '玩家' : (nickname || '玩家');

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE openid = ?').get(openid);
    if (existing) {
      db.prepare('UPDATE users SET nickname = ?, avatar_index = ?, updated_at = datetime("now", "localtime") WHERE openid = ?').run(safeNickname, avatarIndex || 0, openid);
    } else {
      db.prepare('INSERT INTO users (openid, nickname, avatar_index, avatar) VALUES (?, ?, ?, ?)').run(openid, safeNickname, avatarIndex || 0, '');
    }

    // 清除排行榜缓存（昵称变了，排行榜展示也要更新）
    Object.keys(rankCache).forEach(key => delete rankCache[key]);

    res.json({ success: true, data: { nickname: safeNickname, avatarIndex: avatarIndex || 0 } });
  } catch (e) {
    console.error('更新用户信息失败:', e);
    res.json({ success: false, message: e.message });
  }
});

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
      avatarIndex: row.avatar_index || 0,
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
    if (!openid || !isValidOpenid(openid)) {
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

    if (!openid || !isValidOpenid(openid)) return res.json({ success: true, data: null });

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

// ==================== 内容安全 API ====================

/**
 * 文本安全检查 — 调用微信 msgSecCheck
 * 前端约定: POST /api/games/security/text-check { content, openid? }
 * 返回: { success: true, pass: true|false }
 */
router.post('/security/text-check', async (req, res) => {
  const { content, openid } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.json({ success: true, pass: true });
  }
  if (content.length > 500) {
    return res.json({ success: true, pass: false, reason: 'content too long' });
  }

  // 第一层：本地敏感词即时拦截
  if (containsSensitive(content)) {
    return res.json({ success: true, pass: false, reason: 'local' });
  }

  // 第二层：微信 msgSecCheck 云端复检
  try {
    const accessToken = await getAccessToken('games');
    const wxUrl = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`;

    // v2 需要 openid + scene；无 openid 时降级用 v1
    const body = openid && isValidOpenid(openid)
      ? { version: 2, scene: 1, openid, content }
      : { content };

    const resp = await fetch(wxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();

    if (data.errcode === 0) {
      // v2 返回 detail 数组和 result，检查是否有 suggest=risky/review
      let hasRisk = false;
      if (data.result && (data.result.suggest === 'risky' || data.result.suggest === 'review')) {
        hasRisk = true;
      }
      if (data.detail && Array.isArray(data.detail)) {
        hasRisk = hasRisk || data.detail.some(d => d.suggest === 'risky' || d.suggest === 'review');
      }
      console.log(hasRisk ? '🚫 内容违规' : '✅ 内容安全');
      return res.json({ success: true, pass: !hasRisk });
    }

    // errcode=87014 表示内容违规
    if (data.errcode === 87014) {
      return res.json({ success: true, pass: false, reason: 'remote' });
    }

    // 其他错误码（如 access_token 过期、频率限制等）— 不阻断，放行
    console.warn('msgSecCheck 异常:', data.errcode, data.errmsg);
    return res.json({ success: true, pass: true });
  } catch (err) {
    // 网络错误或 access_token 获取失败 — 不阻断正常使用
    console.error('text-check 失败:', err.message);
    return res.json({ success: true, pass: true, fallback: true });
  }
});

/**
 * 图片安全检查 — 调用微信 imgSecCheck（预留）
 * 前端约定: POST /api/games/security/img-check (multipart, 字段名 media)
 * 返回: { success: true, pass: true|false }
 */
router.post('/security/img-check', upload.single('media'), async (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: '缺少图片文件' });
  }

  try {
    const accessToken = await getAccessToken('games');
    const wxUrl = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${accessToken}`;

    // 构建 multipart/form-data
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('media', blob, req.file.originalname || 'image.png');

    const resp = await fetch(wxUrl, {
      method: 'POST',
      body: formData
    });
    const data = await resp.json();

    if (data.errcode === 0) {
      return res.json({ success: true, pass: true });
    }
    if (data.errcode === 87014) {
      return res.json({ success: true, pass: false, reason: 'remote' });
    }

    console.warn('imgSecCheck 异常:', data.errcode, data.errmsg);
    return res.json({ success: true, pass: true, fallback: true });
  } catch (err) {
    console.error('img-check 失败:', err.message);
    return res.json({ success: true, pass: true, fallback: true });
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
