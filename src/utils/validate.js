/**
 * 公共校验工具
 */

// openid 合法性校验（防止 SQL注入等恶意输入）
function isValidOpenid(openid) {
  if (!openid) return false;
  if (openid.length > 100) return false;
  if (/[;'"\-\-\/\*\n\r]/.test(openid)) return false;
  if (/union|select|insert|delete|drop|sleep|jndi|ldap|rmi/i.test(openid)) return false;
  return true;
}

module.exports = { isValidOpenid };
