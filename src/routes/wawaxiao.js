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
  const { category = '全部', page = 1, limit = 20, date, recentDays } = req.query;
  let jokes = getJokes().filter(j => j.status === 'approved');
  
  if (category !== '全部') {
    jokes = jokes.filter(j => j.category === category);
  }
  
  if (date) {
    jokes = jokes.filter(j => j.date === date);
  }
  
  if (recentDays) {
    const days = parseInt(recentDays);
    const today = new Date();
    const cutoff = new Date(today - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    jokes = jokes.filter(j => j.date && j.date >= cutoffStr);
  }
  
  jokes = jokes.map(joke => ({
    ...joke,
    score: (joke.likes || 0) - (joke.dislikes || 0)
  }));
  
  jokes.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
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

// GET /latest
router.get('/latest', (req, res) => {
  const { limit = 50 } = req.query;
  const jokes = getJokes().filter(j => j.status === 'approved');
  
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

// GET /today
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

// GET /hot
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

// POST /like/:id - 累计点赞（每次点击都+1）
router.post('/like/:id', (req, res) => {
  const jokeId = parseInt(req.params.id);
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  // 累计点赞，每次点击都+1
  joke.likes = (joke.likes || 0) + 1;
  joke.score = joke.likes - (joke.dislikes || 0);
  joke.isHot = joke.score >= 10;
  
  saveJokes(jokes);
  
  res.json({
    success: true,
    data: {
      likes: joke.likes,
      neutrals: joke.neutrals || 0,
      dislikes: joke.dislikes || 0,
      score: joke.score
    },
    message: '喜欢+1'
  });
});

// POST /neutral/:id - 累计评价为平（每次点击都+1）
router.post('/neutral/:id', (req, res) => {
  const jokeId = parseInt(req.params.id);
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  // 累计评价，每次点击都+1
  joke.neutrals = (joke.neutrals || 0) + 1;
  joke.score = (joke.likes || 0) - (joke.dislikes || 0);
  
  saveJokes(jokes);
  
  res.json({
    success: true,
    data: {
      likes: joke.likes || 0,
      neutrals: joke.neutrals,
      dislikes: joke.dislikes || 0,
      score: joke.score
    },
    message: '平+1'
  });
});

// POST /dislike/:id - 累计不喜欢（每次点击都+1）
router.post('/dislike/:id', (req, res) => {
  const jokeId = parseInt(req.params.id);
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  // 累计不喜欢，每次点击都+1
  joke.dislikes = (joke.dislikes || 0) + 1;
  joke.score = (joke.likes || 0) - joke.dislikes;
  joke.isHot = joke.score >= 10;
  
  saveJokes(jokes);
  
  res.json({
    success: true,
    data: {
      likes: joke.likes || 0,
      neutrals: joke.neutrals || 0,
      dislikes: joke.dislikes,
      score: joke.score
    },
    message: '不喜欢+1'
  });
});

// GET /stats
router.get('/stats', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved');
  
  const totalLikes = jokes.reduce((sum, j) => sum + (j.likes || 0), 0);
  const totalNeutrals = jokes.reduce((sum, j) => sum + (j.neutrals || 0), 0);
  const totalDislikes = jokes.reduce((sum, j) => sum + (j.dislikes || 0), 0);
  
  const dates = jokes.filter(j => j.date).map(j => j.date).sort();
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;
  
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
