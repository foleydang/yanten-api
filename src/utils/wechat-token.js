/**
 * 微信 access_token 管理
 * - 支持多小程序凭证（家庭备忘录 / 小游戏）
 * - 自动获取并缓存 access_token（默认 2 小时有效，提前 5 分钟刷新）
 * - 适用于 msgSecCheck / imgSecCheck 等内容安全接口
 */
require('dotenv').config();

// 凭证注册表：key → { appId, appSecret }
const APPS = {
  // 家庭备忘录小程序
  family: {
    appId: process.env.WECHAT_APP_ID,
    appSecret: process.env.WECHAT_APP_SECRET,
  },
  // 小游戏小程序（独立 appid，openid 不与家庭备忘录互通）
  games: {
    appId: process.env.WECHAT_GAMES_APP_ID,
    appSecret: process.env.WECHAT_GAMES_APP_SECRET,
  },
};

// 每个凭证独立的缓存
const tokenCaches = {};

/**
 * 获取微信 access_token（带缓存）
 * @param {string} appKey - 'games' | 'family'，默认 'family'
 * @returns {Promise<string>}
 */
async function getAccessToken(appKey = 'family') {
  const app = APPS[appKey];
  if (!app || !app.appId || !app.appSecret) {
    throw new Error(`缺少微信凭证: ${appKey} (WECHAT_${appKey.toUpperCase()}_APP_ID/SECRET)`);
  }

  const now = Date.now();
  const cache = tokenCaches[appKey];

  // 缓存有效（提前 5 分钟刷新，避免边界过期）
  if (cache && cache.token && now < cache.expiresAt - 5 * 60 * 1000) {
    return cache.token;
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${app.appId}&secret=${app.appSecret}`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (!data.access_token) {
    throw new Error(`获取 access_token 失败 [${appKey}]: ${data.errmsg || JSON.stringify(data)}`);
  }

  tokenCaches[appKey] = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 7200) * 1000,
  };

  console.log(`✅ 微信 access_token 已刷新 [${appKey}]，有效期 ${Math.round((data.expires_in || 7200) / 60)} 分钟`);
  return tokenCaches[appKey].token;
}

/** 强制清除缓存（调试用） */
function clearTokenCache(appKey) {
  if (appKey) {
    delete tokenCaches[appKey];
  } else {
    Object.keys(tokenCaches).forEach(k => delete tokenCaches[k]);
  }
}

module.exports = { getAccessToken, clearTokenCache };
