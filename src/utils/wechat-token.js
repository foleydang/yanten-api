/**
 * 微信 access_token 管理
 * - 自动获取并缓存 access_token（默认 2 小时有效，提前 5 分钟刷新）
 * - 适用于 msgSecCheck / imgSecCheck 等内容安全接口
 */
require('dotenv').config();

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;

let tokenCache = { token: null, expiresAt: 0 };

/**
 * 获取微信 access_token（带缓存）
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const now = Date.now();

  // 缓存有效（提前 5 分钟刷新，避免边界过期）
  if (tokenCache.token && now < tokenCache.expiresAt - 5 * 60 * 1000) {
    return tokenCache.token;
  }

  if (!WECHAT_APP_ID || !WECHAT_APP_SECRET) {
    throw new Error('缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET 环境变量');
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (!data.access_token) {
    throw new Error(`获取 access_token 失败: ${data.errmsg || JSON.stringify(data)}`);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 7200) * 1000
  };

  console.log(`✅ 微信 access_token 已刷新，有效期 ${Math.round((data.expires_in || 7200) / 60)} 分钟`);
  return tokenCache.token;
}

/** 强制清除缓存（调试用） */
function clearTokenCache() {
  tokenCache = { token: null, expiresAt: 0 };
}

module.exports = { getAccessToken, clearTokenCache };
