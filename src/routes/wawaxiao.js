const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const JOKES_FILE = path.join(__dirname, '../../database/wawaxiao-jokes.json');
const ACTIONS_FILE = path.join(__dirname, '../../database/wawaxiao-actions.json');

function getJokes() {
  try {
    return JSON.parse(fs.readFileSync(JOKES_FILE, 'utf8'));
  } catch (e) { return []; }
}

function saveJokes(jokes) {
  fs.writeFileSync(JOKES_FILE, JSON.stringify(jokes, null, 2));
}

function getActions() {
  try {
    return JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf8'));
  } catch (e) { 
    const init = { likes: {}, dislikes: {}, shares: {} };
    fs.writeFileSync(ACTIONS_FILE, JSON.stringify(init, null, 2));
    return init;
  }
}

function saveActions(data) {
  fs.writeFileSync(ACTIONS_FILE, JSON.stringify(data, null, 2));
}

// GET /jokes
router.get('/jokes', (req, res) => {
  const { category = '全部', page = 1, limit = 20 } = req.query;
  let jokes = getJokes().filter(j => j.status === 'approved');
  
  if (category !== '全部') {
    jokes = jokes.filter(j => j.category === category);
  }
  
  jokes.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
  
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

// GET /hot
router.get('/hot', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved' && j.isHot);
  res.json({ success: true, data: jokes });
});

// GET /random
router.get('/random', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved');
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  res.json({ success: true, data: joke });
});

// GET /jokes/:id
router.get('/jokes/:id', (req, res) => {
  const joke = getJokes().find(j => j.id === parseInt(req.params.id));
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  res.json({ success: true, data: joke });
});

// POST /like/:id
router.post('/like/:id', (req, res) => {
  const { userId, action } = req.body;
  const jokeId = parseInt(req.params.id);
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  const actions = getActions();
  const key = `${userId}_${jokeId}`;
  
  if (action === 'like') {
    // 添加喜欢
    if (!actions.likes[key]) {
      actions.likes[key] = true;
      // 如果之前不喜欢，取消不喜欢
      if (actions.dislikes[key]) {
        delete actions.dislikes[key];
        joke.dislikes = Math.max(0, joke.dislikes - 1);
      }
      joke.likes += 1;
    }
  } else {
    // 取消喜欢
    if (actions.likes[key]) {
      delete actions.likes[key];
      joke.likes = Math.max(0, joke.likes - 1);
    }
  }
  
  // 更新热门标记
  joke.isHot = joke.likes >= 20;
  
  saveActions(actions);
  saveJokes(jokes);
  
  res.json({
    success: true,
    data: { likes: joke.likes, dislikes: joke.dislikes },
    message: action === 'like' ? '已喜欢' : '已取消喜欢'
  });
});

// POST /dislike/:id
router.post('/dislike/:id', (req, res) => {
  const { userId, action } = req.body;
  const jokeId = parseInt(req.params.id);
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  const actions = getActions();
  const key = `${userId}_${jokeId}`;
  
  if (action === 'dislike') {
    // 添加不喜欢
    if (!actions.dislikes[key]) {
      actions.dislikes[key] = true;
      // 如果之前喜欢，取消喜欢
      if (actions.likes[key]) {
        delete actions.likes[key];
        joke.likes = Math.max(0, joke.likes - 1);
      }
      joke.dislikes += 1;
    }
  } else {
    // 取消不喜欢
    if (actions.dislikes[key]) {
      delete actions.dislikes[key];
      joke.dislikes = Math.max(0, joke.dislikes - 1);
    }
  }
  
  saveActions(actions);
  saveJokes(jokes);
  
  res.json({
    success: true,
    data: { likes: joke.likes, dislikes: joke.dislikes },
    message: action === 'dislike' ? '已不喜欢' : '已取消不喜欢'
  });
});

// POST /share/:id
router.post('/share/:id', (req, res) => {
  const jokeId = parseInt(req.params.id);
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  joke.shares = (joke.shares || 0) + 1;
  saveJokes(jokes);
  
  res.json({
    success: true,
    data: { shares: joke.shares },
    message: '分享成功'
  });
});

// POST /jokes
router.post('/jokes', (req, res) => {
  const { category, title, content, author } = req.body;
  
  if (!category || !title || !content) {
    return res.json({ success: false, message: '请填写完整信息' });
  }
  
  const jokes = getJokes();
  const newId = jokes.length > 0 ? Math.max(...jokes.map(j => j.id)) + 1 : 1;
  
  jokes.push({
    id: newId,
    category,
    title,
    content,
    author: author || '匿名用户',
    likes: 0,
    dislikes: 0,
    shares: 0,
    isHot: false,
    status: 'pending',
    createdAt: Date.now()
  });
  
  saveJokes(jokes);
  
  res.json({ success: true, data: { id: newId }, message: '提交成功，等待审核' });
});

// GET /stats
router.get('/stats', (req, res) => {
  const jokes = getJokes().filter(j => j.status === 'approved');
  
  res.json({
    success: true,
    data: {
      total: jokes.length,
      hotCount: jokes.filter(j => j.isHot).length,
      totalLikes: jokes.reduce((sum, j) => sum + j.likes, 0),
      totalDislikes: jokes.reduce((sum, j) => sum + j.dislikes, 0),
      totalShares: jokes.reduce((sum, j) => sum + (j.shares || 0), 0)
    }
  });
});

module.exports = router;
