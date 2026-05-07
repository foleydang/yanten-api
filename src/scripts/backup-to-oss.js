// OSS 备份脚本（可选）
// 如果配置了阿里云 OSS，定期备份数据库文件

const OSS = require('ali-oss'); // 需要安装：npm install ali-oss
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function backupToOSS() {
  console.log('🔄 开始备份数据到 OSS...');

  // 检查 OSS 配置
  if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
    console.log('⚠️  OSS 未配置，跳过备份');
    console.log('提示：在 .env 中配置 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET');
    return;
  }

  try {
    // 初始化 OSS 客户端
    const client = new OSS({
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      bucket: process.env.OSS_BUCKET || 'yanten-api-backup',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    });

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // 2024-05-07
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // 14-30-00

    // 要备份的文件
    const backupFiles = [
      {
        local: process.env.DB_PATH || './data/database/main.db',
        remote: `backup/${dateStr}/main-${timeStr}.db`
      },
      {
        local: './data/database/wawaxiao-jokes.json',
        remote: `backup/${dateStr}/wawaxiao-jokes-${timeStr}.json`
      },
      {
        local: './data/database/wawaxiao-actions.json',
        remote: `backup/${dateStr}/wawaxiao-actions-${timeStr}.json`
      }
    ];

    for (const file of backupFiles) {
      if (!fs.existsSync(file.local)) {
        console.log('⚠️  文件不存在，跳过:', file.local);
        continue;
      }

      console.log('📤 上传:', file.local, '→', file.remote);
      const result = await client.put(file.remote, file.local);
      console.log('✅ 成功:', result.url);
    }

    console.log('');
    console.log('🎉 备份完成！');
    console.log('💡 查看备份：https://oss.console.aliyun.com/bucket/oss-cn-hangzhou/' + process.env.OSS_BUCKET);

  } catch (error) {
    console.error('❌ 备份失败:', error.message);
    if (error.message.includes('NoSuchBucket')) {
      console.log('💡 请先在阿里云 OSS 创建 Bucket:', process.env.OSS_BUCKET);
    }
  }
}

// 执行备份
backupToOSS();