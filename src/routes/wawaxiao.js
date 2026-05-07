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

// GET /jokes
router.get('/jokes', (req, res) => {
  const { category = '全部', page = 1, limit = 20 } = req.query;
  let jokes = getJokes().filter(j => j.status === 'approved');
  
  if (category !== '全部') {
    jokes = jokes.filter(j => j.category === category);
  }
  
  // 计算评分并排序
  jokes = jokes.map(joke => ({
    ...joke,
    score: (joke.likes || 0) - (joke.dislikes || 0)
  }));
  
  jokes.sort((a, b) => b.score - a.score);
  
  const start = (page - 1) * limit;
  const paginated = jokes.slice(start, start + limit);
  
  res.json({
    success: true,
    data: {
      list: paginated,
      total: jokes.length,
      page: parseInt(page),
      limit: parseInt(limit),
      categories: ['全部', '职场', '生活', '家庭', '校园']
    }
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

// POST /rate/:id - 三档评价（直接更新笑话统计）
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
  
  // 减少旧评价计数
  if (prevRating === 'like') joke.likes--;
  else if (prevRating === 'neutral') joke.neutrals--;
  else if (prevRating === 'dislike') joke.dislikes--;
  
  // 增加新评价计数
  if (newRating === 'like') joke.likes++;
  else if (newRating === 'neutral') joke.neutrals++;
  else if (newRating === 'dislike') joke.dislikes++;
  
  // 确保计数不为负数
  joke.likes = Math.max(0, joke.likes);
  joke.neutrals = Math.max(0, joke.neutrals);
  joke.dislikes = Math.max(0, joke.dislikes);
  
  // 计算评分
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
      score: joke.score
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
  
  res.json({
    success: true,
    data: {
      total: jokes.length,
      totalLikes,
      totalNeutrals,
      totalDislikes,
      hotCount: jokes.filter(j => (j.likes || 0) - (j.dislikes || 0) >= 10).length
    }
  });
});

module.exports = router;
