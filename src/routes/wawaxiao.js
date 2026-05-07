const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const JOKES_FILE = path.join(__dirname, '../../data/database/wawaxiao-jokes.json');
const ACTIONS_FILE = path.join(__dirname, '../../data/database/wawaxiao-actions.json');

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
    const init = { 
      likes: {},      // 记录用户对每个笑话的点赞次数
      dislikes: {},   // 记录用户对每个笑话的不喜欢次数
      shares: {}      // 记录分享次数
    };
    fs.writeFileSync(ACTIONS_FILE, JSON.stringify(init, null, 2));
    return init;
  }
}

function saveActions(data) {
  fs.writeFileSync(ACTIONS_FILE, JSON.stringify(data, null, 2));
}

// GET /jokes
router.get('/jokes', (req, res) => {
  const { category = '全部', page = 1, limit = 20, userId } = req.query;
  let jokes = getJokes().filter(j => j.status === 'approved');
  
  if (category !== '全部') {
    jokes = jokes.filter(j => j.category === category);
  }
  
  // 按热度排序（喜欢数-不喜欢数）
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

// POST /like/:id - 累计点赞（每次点击都+1）
router.post('/like/:id', (req, res) => {
  const { userId } = req.body;
  const jokeId = parseInt(req.params.id);
  
  if (!userId) {
    return res.json({ success: false, message: '缺少用户ID' });
  }
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  const actions = getActions();
  const key = `${userId}_${jokeId}`;
  
  // 累计点赞次数（每次点击都+1）
  actions.likes[key] = (actions.likes[key] || 0) + 1;
  joke.likes += 1;
  
  // 更新热门标记（喜欢>=20）
  joke.isHot = joke.likes >= 20;
  
  saveActions(actions);
  saveJokes(jokes);
  
  res.json({
    success: true,
    data: { 
      likes: joke.likes, 
      dislikes: joke.dislikes,
      userLikes: actions.likes[key]  // 返回用户的累计点赞次数
    },
    message: '已喜欢'
  });
});

// POST /dislike/:id - 累计不喜欢（每次点击都+1）
router.post('/dislike/:id', (req, res) => {
  const { userId } = req.body;
  const jokeId = parseInt(req.params.id);
  
  if (!userId) {
    return res.json({ success: false, message: '缺少用户ID' });
  }
  
  const jokes = getJokes();
  const joke = jokes.find(j => j.id === jokeId);
  if (!joke) return res.json({ success: false, message: '笑话不存在' });
  
  const actions = getActions();
  const key = `${userId}_${jokeId}`;
  
  // 累计不喜欢次数（每次点击都+1）
  actions.dislikes[key] = (actions.dislikes[key] || 0) + 1;
  joke.dislikes += 1;
  
  saveActions(actions);
  saveJokes(jokes);
  
  res.json({
    success: true,
    data: { 
      likes: joke.likes, 
      dislikes: joke.dislikes,
      userDislikes: actions.dislikes[key]  // 返回用户的累计不喜欢次数
    },
    message: '已不喜欢'
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

// POST /jokes - 提交新笑话
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

// GET /user-stats/:userId - 获取用户的点赞统计
router.get('/user-stats/:userId', (req, res) => {
  const userId = req.params.userId;
  const actions = getActions();
  
  const userLikes = {};
  const userDislikes = {};
  
  // 统计用户对所有笑话的点赞次数
  Object.keys(actions.likes).forEach(key => {
    if (key.startsWith(userId + '_')) {
      const jokeId = key.split('_')[1];
      userLikes[jokeId] = actions.likes[key];
    }
  });
  
  Object.keys(actions.dislikes).forEach(key => {
    if (key.startsWith(userId + '_')) {
      const jokeId = key.split('_')[1];
      userDislikes[jokeId] = actions.dislikes[key];
    }
  });
  
  res.json({
    success: true,
    data: {
      likes: userLikes,
      dislikes: userDislikes,
      totalLikes: Object.values(userLikes).reduce((a, b) => a + b, 0),
      totalDislikes: Object.values(userDislikes).reduce((a, b) => a + b, 0)
    }
  });
});

module.exports = router;
