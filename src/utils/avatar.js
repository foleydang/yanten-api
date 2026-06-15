const config = require('../../config/default');

/**
 * 构建头像 URL 的统一函数
 * - cloud:// 微信云存储 URL → 不展示（需要 wx.cloud 临时链接，后端无法访问）
 * - http:// https:// → 直接用，加时间戳防缓存
 * - 相对路径 → 拼接 baseUrl
 */
function buildAvatarUrl(avatar) {
  if (!avatar) return '';
  if (avatar.startsWith('cloud://')) return '';
  if (avatar.startsWith('http')) return avatar.includes('?') ? avatar : avatar + '?_t=' + Date.now();
  return config.baseUrl + avatar;
}

module.exports = { buildAvatarUrl };
