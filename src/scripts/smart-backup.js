/**
 * 智能备份 - 只在数据变化时备份，保留最近7天
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

async function smartBackup() {
  try {
    const localStats = fs.statSync(DB_PATH);
    const localSize = localStats.size;
    const localTime = localStats.mtime.getTime();
    
    console.log(`本地数据库: ${localSize} bytes, ${localStats.mtime.toLocaleString()}`);
    
    // 获取OSS最新备份
    const result = await client.list({ prefix: 'backup/', 'max-keys': 50 });
    
    if (result.objects && result.objects.length > 0) {
      const dbBackups = result.objects
        .filter(obj => obj.name.includes('main-') && obj.name.endsWith('.db'))
        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
      
      if (dbBackups.length > 0) {
        const latest = dbBackups[0];
        const ossTime = new Date(latest.lastModified).getTime();
        const ossSize = latest.size;
        
        console.log(`OSS最新: ${latest.name}, ${ossSize} bytes`);
        
        // 本地和OSS大小相同且时间相近（<1小时），不备份
        if (localSize === ossSize && (localTime - ossTime) < 3600000) {
          console.log('数据未变化，跳过备份');
          
          // 清理旧备份（保留最近7天）
          await cleanupOldBackups(dbBackups);
          return false;
        }
      }
    }
    
    // 数据有变化，执行备份
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const timeStr = today.toTimeString().slice(0, 8).replace(/:/g, '-');
    const ossName = `backup/${dateStr}/main-${timeStr}.db`;
    
    console.log(`上传: ${ossName}`);
    await client.put(ossName, DB_PATH);
    console.log('✅ 备份完成');
    
    // 清理旧备份
    if (result.objects) {
      await cleanupOldBackups(
        result.objects.filter(obj => obj.name.includes('main-') && obj.name.endsWith('.db'))
          .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      );
    }
    
    return true;
    
  } catch (err) {
    console.error('备份失败:', err.message);
    return false;
  }
}

async function cleanupOldBackups(backups) {
  // 保留最近7天（7个备份文件）
  const keepCount = 7;
  
  if (backups.length <= keepCount) {
    console.log(`备份文件数: ${backups.length}，无需清理`);
    return;
  }
  
  const toDelete = backups.slice(keepCount);
  console.log(`清理旧备份: ${toDelete.length} 个文件`);
  
  for (const obj of toDelete) {
    try {
      await client.delete(obj.name);
      console.log(`  删除: ${obj.name}`);
    } catch (e) {
      console.log(`  删除失败: ${obj.name}`);
    }
  }
}

module.exports = { smartBackup };

if (require.main === module) {
  smartBackup().then(() => process.exit(0));
}
