/**
 * 从OSS恢复数据库
 */
require('dotenv').config();
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

const client = new OSS({
  region: 'oss-cn-hangzhou',
  bucket: 'yanten-data',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET
});

const DB_PATH = path.join(__dirname, '../../data/database/main.db');

async function restoreFromOSS() {
  try {
    console.log('检查OSS备份...');
    
    const result = await client.list({ prefix: 'backup/', 'max-keys': 100 });

    if (!result.objects || result.objects.length === 0) {
      console.log('OSS无备份');
      return false;
    }

    // 找最新main.db
    const dbBackups = result.objects
      .filter(obj => obj.name.includes('main-') && obj.name.endsWith('.db'))
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    if (dbBackups.length === 0) {
      console.log('无数据库备份');
      return false;
    }

    const latest = dbBackups[0];
    console.log(`最新备份: ${latest.name}`);
    console.log(`时间: ${new Date(latest.lastModified).toLocaleString()}`);

    // 检查本地
    const localExists = fs.existsSync(DB_PATH);
    const localDate = localExists ? fs.statSync(DB_PATH).mtime : new Date(0);

    console.log(`本地时间: ${localDate.toLocaleString()}`);

    if (new Date(latest.lastModified) > localDate) {
      console.log('从OSS恢复...');
      await client.get(latest.name, DB_PATH);
      console.log('✅ 恢复完成');
      return true;
    }
    
    console.log('本地已是最新');
    return false;

  } catch (err) {
    console.error('恢复失败:', err.message);
    return false;
  }
}

module.exports = { restoreFromOSS };

if (require.main === module) {
  restoreFromOSS().then(() => process.exit(0));
}
