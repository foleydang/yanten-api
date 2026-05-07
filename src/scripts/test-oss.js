// OSS 测试和备份脚本
const OSS = require('ali-oss');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testAndBackup() {
  console.log('🔄 开始测试 OSS 连接并备份数据...\n');

  // 检查配置
  console.log('📋 OSS 配置:');
  console.log('  Bucket:', process.env.OSS_BUCKET);
  console.log('  Region:', process.env.OSS_REGION);
  console.log('  AccessKey:', process.env.OSS_ACCESS_KEY_ID ? '已配置 ✓' : '未配置 ✗');
  console.log('  Secret:', process.env.OSS_ACCESS_KEY_SECRET ? '已配置 ✓' : '未配置 ✗');
  console.log('');

  if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
    console.log('❌ OSS 未正确配置');
    return;
  }

  try {
    // 初始化 OSS 客户端
    const client = new OSS({
      region: process.env.OSS_REGION,
      bucket: process.env.OSS_BUCKET,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      secure: true,
    });

    console.log('✅ OSS 客户端初始化成功');

    // 测试：获取 bucket 信息
    const bucketInfo = await client.getBucketInfo(process.env.OSS_BUCKET);
    console.log('✅ Bucket 连接成功');
    console.log('  名称:', bucketInfo.bucket.Name);
    console.log('  区域:', bucketInfo.bucket.Location);
    console.log('  创建时间:', bucketInfo.bucket.CreationDate);
    console.log('');

    // 准备备份
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');

    const backupFiles = [
      {
        local: process.env.DB_PATH || './data/database/main.db',
        remote: 'database/' + dateStr + '/main-' + timeStr + '.db',
        desc: '主数据库'
      },
      {
        local: './data/database/wawaxiao-jokes.json',
        remote: 'wawaxiao/' + dateStr + '/jokes-' + timeStr + '.json',
        desc: '笑话数据'
      },
      {
        local: './data/database/wawaxiao-actions.json',
        remote: 'wawaxiao/' + dateStr + '/actions-' + timeStr + '.json',
        desc: '用户行为'
      },
      {
        local: './data/database/schema.sql',
        remote: 'database/schema.sql',
        desc: '数据库 Schema'
      }
    ];

    console.log('📦 开始上传备份文件...\n');

    for (const file of backupFiles) {
      const localPath = path.resolve(__dirname, '../../', file.local);

      if (!fs.existsSync(localPath)) {
        console.log('⚠️  文件不存在，跳过: ' + file.desc + ' (' + file.local + ')');
        continue;
      }

      const fileSize = fs.statSync(localPath).size;
      const fileSizeKB = (fileSize / 1024).toFixed(2);

      console.log('📤 上传: ' + file.desc);
      console.log('  本地: ' + file.local + ' (' + fileSizeKB + ' KB)');
      console.log('  远程: ' + file.remote);

      try {
        const result = await client.put(file.remote, localPath);
        console.log('  ✅ 成功: ' + result.url);
        console.log('');
      } catch (uploadError) {
        console.log('  ❌ 失败: ' + uploadError.message);
        console.log('');
      }
    }

    console.log('🎉 备份完成！');

    // 列出已上传的文件
    console.log('\n📂 OSS 文件列表:');
    try {
      const listResult = await client.list({ 'max-keys': 20 });
      if (listResult.objects && listResult.objects.length > 0) {
        listResult.objects.forEach(obj => {
          const sizeKB = (obj.size / 1024).toFixed(2);
          console.log('  ' + obj.name + ' (' + sizeKB + ' KB)');
        });
      } else {
        console.log('  暂无文件');
      }
    } catch (listError) {
      console.log('  无法获取文件列表:', listError.message);
    }

  } catch (error) {
    console.error('\n❌ OSS 操作失败:', error.message);
    if (error.message.includes('NoSuchBucket')) {
      console.log('\n💡 请检查 Bucket 名称是否正确:', process.env.OSS_BUCKET);
    } else if (error.message.includes('AccessDenied')) {
      console.log('\n💡 请检查 AccessKey 权限');
    }
  }
}

testAndBackup();
