const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../public/uploads');
const avatarDir = path.join(uploadDir, 'avatars');
const feedbackDir = path.join(uploadDir, 'feedback');

[uploadDir, avatarDir, feedbackDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 配置头像上传
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar_${req.userId}_${Date.now()}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式'));
    }
  }
});

// 配置反馈图片上传
const feedbackStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, feedbackDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `fb_${req.userId}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const feedbackUpload = multer({
  storage: feedbackStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式'));
    }
  }
});

// 上传头像 - /api/upload/avatar
router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '请选择图片'
    });
  }
  
  const url = `/static/uploads/avatars/${req.file.filename}`;
  
  res.json({
    success: true,
    data: { url }
  });
});

// 上传反馈图片 - /api/upload/feedback
router.post('/feedback', authMiddleware, feedbackUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '请选择图片'
    });
  }
  
  const url = `/static/uploads/feedback/${req.file.filename}`;
  
  res.json({
    success: true,
    data: { url }
  });
});

module.exports = router;
