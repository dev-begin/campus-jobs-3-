// ลบฐานข้อมูลเดิมแล้วสร้างข้อมูลตัวอย่างใหม่: npm run reset (ต้องหยุดเซิร์ฟเวอร์ก่อน)
const fs = require('fs');
for (const f of ['data.db', 'data.db-journal', 'data.db-wal', 'data.db-shm']) fs.rmSync(f, { force: true });
require('./seed');
