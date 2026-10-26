// สัปดาห์ 4-5: POST /api/auth/register, POST /api/auth/login
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign } = require('../middleware/auth');

router.post('/register', (req, res) => {
  const { name, email, password, role, phone = '', line_id = '' } = req.body || {};
  if (!name || !email || !password || !['student', 'employer'].includes(role))
    return res.status(400).json({ error: 'กรอกข้อมูลไม่ครบ (name, email, password, role)' });
  if (password.length < 6)
    return res.status(400).json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
    return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role, phone, line_id) VALUES (?,?,?,?,?,?)')
    .run(name, email, hash, role, String(phone).slice(0, 30), String(line_id).slice(0, 40));
  const user = { id: Number(info.lastInsertRowid), name, role };
  res.status(201).json({ token: sign(user), user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!u || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  const user = { id: u.id, name: u.name, role: u.role };
  res.json({ token: sign(user), user });
});

module.exports = router;
