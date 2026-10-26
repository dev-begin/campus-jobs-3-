// สัปดาห์ 1-3: ออกแบบฐานข้อมูล (SQL) -- users / jobs / applications
// ใช้ node:sqlite ที่มากับ Node.js 22.13+ (ไม่ต้องคอมไพล์/ติดตั้ง Visual Studio)
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.DB_FILE || 'data.db');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','employer')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,
  pay INTEGER NOT NULL CHECK (pay >= 0),
  location TEXT DEFAULT '',
  work_date TEXT DEFAULT '',
  start_time TEXT DEFAULT '09:00',
  end_time TEXT DEFAULT '17:00',
  auto_accept INTEGER DEFAULT 0,
  positions INTEGER DEFAULT 1,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (job_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_jobs_filter ON jobs(status, category, pay);
`);
// เพิ่มคอลัมน์ใหม่ (ใช้ได้ทั้งฐานข้อมูลใหม่และไฟล์ data.db เดิม)
function addColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('users', 'phone', "TEXT DEFAULT ''");
addColumn('users', 'line_id', "TEXT DEFAULT ''");
addColumn('jobs', 'requirements', "TEXT DEFAULT ''");
addColumn('jobs', 'benefits', "TEXT DEFAULT ''");
addColumn('jobs', 'contact_phone', "TEXT DEFAULT ''");
addColumn('jobs', 'contact_line', "TEXT DEFAULT ''");

module.exports = db;
