const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const JOKES_FILE = path.join(__dirname, '../../data/database/wawaxiao-jokes.json');

function getJokes() {
  try {
    return JSON.parse(fs.readFileSync(JOKES_FILE, 'utf8'));
  } catch (e) { return []; }
}

function saveJokes(jokes) {
  fs.writeFileSync(JOKES_FILE, JSON.stringify(jokes, null, 2));
}

function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

// GET /jokes - 支持按日期筛选
router.get('/jokes', (req, res) => {
  const { category = '全部', page = 1, limit = 20, date, recentDays } = req.query;
  let jokes = getJokes().filter(j => j.status === 'approved');
  
  // 按分类筛选
  if (category !== '全部') {
    jokes = jokes.filter(j => j.category === category);
  }
  
  // 按日期筛选
  if (date) {
    jokes = jokes.filter(j => j.date === date);
  }
  
  // 最近N天的笑话
  if (recentDays) {
    const days = parseInt(recentDays);
    const today = new Date();
    const cutoff = new Date(today - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    jokes = jokes.filter(j => j.date && j.date >= cutoffStr);
  }
  
  // 计算评分并排序
  jokes = jokes.map(joke => ({
    ...joke,
    score: (joke.likes || 0) - (joke.dislikes || 0)
  }));
  
  // 按日期和评分排序（最新的排前面）
  jokes.sort((a, b) => {
    // 先按日期降序
    if (a.date && b.date && a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    // 同日期按评分降序
    return b.score - a.score;
  });
  
  const start = (page - 1) * limit;
  const paginated = jokes.slice(start, start + limit);
  
  res.json({
    success: true,
    data: {
      list: paginated,
      total: jokes.length,
      page: parseInt(page),
      limit: parseInt(limit),
      categories: ['全部', '职场', '生活', '家庭', '校园'],
      latestDate: jokes.length > 0 ? jokes[0].date : null
    }
  });
});

// GET /latest - 获取最新笑话（最近7天）
router.get('/latest', (req, res) => {
  const { limit = 50 } = req.query;
  const jokes = getJokes().filter(j => j.status === 'approved');
  
  // 最近7天
  const today = new Date();
  const cutoff = new Date(today - 7 * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  
  const latest = jokes
    .filter(j => j.date && j.date >= cutoffStr)
    .map(joke => ({
      ...joke,
      score: (joke.likes || 0) - (joke.dislikes || 0)
    }))
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.score - a.score;
    })
    .slice(0, parseInt(limit));
  
  res.json({
    success: true,
    data: {
      list: latest,
      total: latest.length,
      latestDate: latest.length > 0 ? latest[0].date : null
    }
  });
});

// GET /today - 今日笑话
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const jokes = getJokes()
    .filter(j => j.status === 'approved' && j.date === today)
    .map(joke => ({
      ...joke,
      score: (joke.likes || 0) - (joke.dislikes || 0)
    }))
    .sort((a, b) => b.score - a.score);
  
  res.json({
    success: true,
    data: {
      list: jokes,
      total: jokes.length,
      date: today
    }
  });
});

// GET /dates - 获取所有日期列表
router.get('/dates', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved');
  
  const dates = {};
  jokes.forEach(j => {
    if (j.date) {
      dates[j.date] = dates.get(j.date, 0) + 1;
    }
  });
  
  const dateList = Object.entries(dates)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, count]) => ({ date, count }));
  
  res.json({
    success: true,
    data: dateList
  });
});

// GET /hot - 热门笑话
router.get('/hot', (req, res) => {
  let jokes = getJokes()
    .filter(j => j.status === 'approved')
    .map(joke => ({
      ...joke,
      score: (joke.likes || 0) - (joke.dislikes || 0)
    }))
    .filter(j => j.score >= 10)
    .sort((a, b) => b.score - a.score);
  
  res.json({ success: true, data: jokes });
});

// GET /random
router.get('/random', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved');
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  
  if (joke) {
    joke.score = (joke.likes || 0) - (joke.dislikes || 0);
  }
  
  res.json({ success: true, data: joke });
});

// GET /jokes/:id
router.get('/jokes/:id', (req, res) => {
  const joke = getJokes().find(j => j.id === parseInt(req.params.id));
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  joke.score = (joke.likes || 0) - (joke.dislikes || 0);
  
  res.json({ success: true, data: joke });
});

// POST /rate/:id - 三档评价
router.post('/rate/:id', (req, res) => {
  const { prevRating, newRating } = req.body;
  const jokeId = parseInt(req.params.id);
  
  if (!newRating || !['like', 'neutral', 'dislike', null].includes(newRating)) {
    return res.json({ success: false, message: '评价类型无效' });
  }
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  // 初始化统计
  joke.likes = joke.likes || 0;
  joke.neutrals = joke.neutrals || 0;
  joke.dislikes = joke.dislikes || 0;
  
  // 减少旧评价
  if (prevRating === 'like') joke.likes--;
  else if (prevRating === 'neutral') joke.neutrals--;
  else if (prevRating === 'dislike') joke.dislikes--;
  
  // 增加新评价
  if (newRating === 'like') joke.likes++;
  else if (newRating === 'neutral') joke.neutrals++;
  else if (newRating === 'dislike') joke.dislikes++;
  
  // 确保不为负
  joke.likes = Math.max(0, joke.likes);
  joke.neutrals = Math.max(0, joke.neutrals);
  joke.dislikes = Math.max(0, joke.dislikes);
  
  joke.score = joke.likes - joke.dislikes;
  joke.isHot = joke.score >= 10;
  
  saveJokes(jokes);
  
  const messages = {
    'like': '已喜欢 👍',
    'neutral': '评价为平 😐',
    'dislike': '已不喜欢 👎',
    null: '取消评价'
  };
  
  res.json({
    success: true,
    data: {
      likes: joke.likes,
      neutrals: joke.neutrals,
      dislikes: joke.dislikes,
      score: joke.score,
      date: joke.date
    },
    message: messages[newRating] || '评价成功'
  });
});

// GET /stats
router.get('/stats', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved');
  
  const totalLikes = jokes.reduce((sum, j) => sum + (j.likes || 0), 0);
  const totalNeutrals = jokes.reduce((sum, j) => sum + (j.neutrals || 0), 0);
  const totalDislikes = jokes.reduce((sum, j) => sum + (j.dislikes || 0), 0);
  
  // 获取最新日期
  const dates = jokes.filter(j => j.date).map(j => j.date).sort();
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;
  
  // 今日笑话数
  const today = new Date().toISOString().split('T')[0];
  const todayCount = jokes.filter(j => j.date === today).length;
  
  res.json({
    success: true,
    data: {
      total: jokes.length,
      totalLikes,
      totalNeutrals,
      totalDislikes,
      hotCount: jokes.filter(j => (j.likes || 0) - (j.dislikes || 0) >= 10).length,
      latestDate,
      todayCount
    }
  });
});

module.exports = router;
