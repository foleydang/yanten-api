const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const JOKES_FILE = path.join(__dirname, '../../data/database/wawaxiao-jokes.json');
const RATINGS_FILE = path.join(__dirname, '../../data/database/wawaxiao-ratings.json');

function getJokes() {
  try {
    return JSON.parse(fs.readFileSync(JOKES_FILE, 'utf8'));
  } catch (e) { return []; }
}

function saveJokes(jokes) {
  fs.writeFileSync(JOKES_FILE, JSON.stringify(jokes, null, 2));
}

function getRatings() {
  try {
    return JSON.parse(fs.readFileSync(RATINGS_FILE, 'utf8'));
  } catch (e) { 
    const init = {};
    fs.writeFileSync(RATINGS_FILE, JSON.stringify(init, null, 2));
    return init;
  }
}

function saveRatings(data) {
  fs.writeFileSync(RATINGS_FILE, JSON.stringify(data, null, 2));
}

// 计算笑话评分
function calculateRating(jokeId) {
  const ratings = getRatings();
  const likes = Object.values(ratings).filter(r => r[jokeId] === 'like').length;
  const neutrals = Object.values(ratings).filter(r => r[jokeId] === 'neutral').length;
  const dislikes = Object.values(ratings).filter(r => r[jokeId] === 'dislike').length;
  
  return {
    likes,
    neutrals,
    dislikes,
    total: likes + neutrals + dislikes,
    score: likes - dislikes  // 评分：喜欢数 - 不喜欢数
  };
}

// GET /jokes
router.get('/jokes', (req, res) => {
  const { category = '全部', page = 1, limit = 20 } = req.query;
  let jokes = getJokes().filter(j => j.status === 'approved');
  
  if (category !== '全部') {
    jokes = jokes.filter(j => j.category === category);
  }
  
  // 计算每个笑话的评分
  jokes = jokes.map(joke => {
    const rating = calculateRating(joke.id);
    return {
      ...joke,
      likes: rating.likes,
      neutrals: rating.neutrals,
      dislikes: rating.dislikes,
      score: rating.score
    };
  });
  
  // 按评分排序
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

// GET /hot - 热门笑话（评分>10）
router.get('/hot', (req, res) => {
  let jokes = getJokes().filter(j => j.status === 'approved');
  
  jokes = jokes.map(joke => {
    const rating = calculateRating(joke.id);
    return {
      ...joke,
      likes: rating.likes,
      neutrals: rating.neutrals,
      dislikes: rating.dislikes,
      score: rating.score
    };
  }).filter(j => j.score >= 10);
  
  jokes.sort((a, b) => b.score - a.score);
  res.json({ success: true, data: jokes });
});

// GET /random
router.get('/random', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved');
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  
  if (joke) {
    const rating = calculateRating(joke.id);
    joke.likes = rating.likes;
    joke.neutrals = rating.neutrals;
    joke.dislikes = rating.dislikes;
    joke.score = rating.score;
  }
  
  res.json({ success: true, data: joke });
});

// GET /jokes/:id
router.get('/jokes/:id', (req, res) => {
  const joke = getJokes().find(j => j.id === parseInt(req.params.id));
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  const rating = calculateRating(joke.id);
  joke.likes = rating.likes;
  joke.neutrals = rating.neutrals;
  joke.dislikes = rating.dislikes;
  joke.score = rating.score;
  
  res.json({ success: true, data: joke });
});

// POST /rate/:id - 三档评价（like/neutral/dislike）
router.post('/rate/:id', (req, res) => {
  const { userId, rating } = req.body;  // rating: 'like' | 'neutral' | 'dislike'
  const jokeId = parseInt(req.params.id);
  
  if (!userId) {
    return res.json({ success: false, message: '缺少用户ID' });
  }
  
  if (!['like', 'neutral', 'dislike'].includes(rating)) {
    return res.json({ success: false, message: '评价类型无效' });
  }
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  const ratings = getRatings();
  
  // 记录用户评价
  if (!ratings[userId]) {
    ratings[userId] = {};
  }
  
  // 更新评价
  ratings[userId][jokeId] = rating;
  saveRatings(ratings);
  
  // 计算新评分
  const newRating = calculateRating(jokeId);
  
  res.json({
    success: true,
    data: {
      rating: rating,
      likes: newRating.likes,
      neutrals: newRating.neutrals,
      dislikes: newRating.dislikes,
      score: newRating.score
    },
    message: rating === 'like' ? '已喜欢' : 
             rating === 'neutral' ? '评价为平' : '已不喜欢'
  });
});

// GET /user-rating/:userId/:jokeId - 获取用户对某笑话的评价
router.get('/user-rating/:userId/:jokeId', (req, res) => {
  const { userId, jokeId } = req.params;
  const ratings = getRatings();
  
  const userRating = ratings[userId]?.[parseInt(jokeId)] || null;
  
  res.json({
    success: true,
    data: {
      rating: userRating  // 'like' | 'neutral' | 'dislike' | null
    }
  });
});

// GET /stats
router.get('/stats', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved');
  
  let totalLikes = 0;
  let totalNeutrals = 0;
  let totalDislikes = 0;
  
  jokes.forEach(joke => {
    const rating = calculateRating(joke.id);
    totalLikes += rating.likes;
    totalNeutrals += rating.neutrals;
    totalDislikes += rating.dislikes;
  });
  
  res.json({
    success: true,
    data: {
      total: jokes.length,
      totalLikes,
      totalNeutrals,
      totalDislikes,
      hotCount: jokes.filter(j => {
        const rating = calculateRating(j.id);
        return rating.score >= 10;
      }).length
    }
  });
});

module.exports = router;
