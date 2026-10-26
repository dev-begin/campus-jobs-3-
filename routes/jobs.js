// สัปดาห์ 6-9: CRUD งาน + ค้นหา/กรองแบบ Dynamic + สมัครงาน
const router = require('express').Router();
const db = require('../db');
const { auth, optionalAuth, requireRole } = require('../middleware/auth');

// คอลัมน์ที่เปิดเผยในรายการสาธารณะ (ไม่รวมช่องทางติดต่อ)
const JOB_COLS = `j.id, j.employer_id, j.title, j.description, j.category, j.pay, j.location,
  j.work_date, j.start_time, j.end_time, j.auto_accept, j.positions, j.status, j.created_at`;

// GET /api/jobs?category=&pay_min=&q=   (สาธารณะ ใช้ parameterized query กัน SQL Injection)
router.get('/', (req, res) => {
  const { category, pay_min, q } = req.query;
  const where = ["j.status = 'open'"];
  const params = [];
  if (category) { where.push('j.category = ?'); params.push(category); }
  if (pay_min && !Number.isNaN(Number(pay_min))) { where.push('j.pay >= ?'); params.push(Number(pay_min)); }
  if (q) { where.push('(j.title LIKE ? OR j.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const { date, time_from, time_to } = req.query; // แถบวันที่ + ช่วงเวลาทำงาน
  if (date) { where.push('j.work_date = ?'); params.push(date); }
  if (time_from) { where.push('j.start_time >= ?'); params.push(time_from); }
  if (time_to) { where.push('j.end_time <= ?'); params.push(time_to); }
  const rows = db.prepare(`
    SELECT ${JOB_COLS}, u.name AS employer_name,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'accepted') AS filled
    FROM jobs j JOIN users u ON u.id = j.employer_id
    WHERE ${where.join(' AND ')}
    ORDER BY j.created_at DESC, j.id DESC`).all(...params);
  res.json(rows);
});

// GET /api/jobs/mine  (นายจ้าง: งานของฉัน) -- ต้องอยู่ก่อน /:id
router.get('/mine', auth, requireRole('employer'), (req, res) => {
  res.json(db.prepare('SELECT * FROM jobs WHERE employer_id = ? ORDER BY id DESC').all(req.user.id));
});

// รายละเอียดงาน: ช่องทางติดต่อเห็นได้เฉพาะผู้ที่ล็อกอิน (กันบอตเก็บเบอร์/สแปม)
router.get('/:id', optionalAuth, (req, res) => {
  const job = db.prepare(`
    SELECT ${JOB_COLS}, j.requirements, j.benefits, u.name AS employer_name,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'accepted') AS filled
    FROM jobs j JOIN users u ON u.id = j.employer_id WHERE j.id = ?`).get(req.params.id);
  if (!job) return res.status(404).json({ error: 'ไม่พบงาน' });
  if (req.user) {
    const c = db.prepare('SELECT contact_phone, contact_line FROM jobs WHERE id = ?').get(job.id);
    job.contact_phone = c.contact_phone;
    job.contact_line = c.contact_line;
    if (req.user.role === 'student') {
      const mine = db.prepare('SELECT status FROM applications WHERE job_id = ? AND student_id = ?').get(job.id, req.user.id);
      job.my_status = mine ? mine.status : null;
    }
  } else {
    job.contact_locked = true;
  }
  res.json(job);
});

function validateJob(b) {
  if (!b || !b.title || !b.category || b.pay === undefined || b.pay === '' || Number.isNaN(Number(b.pay)) || Number(b.pay) < 0)
    return 'ต้องระบุ title, category และ pay (ตัวเลข >= 0)';
}

router.post('/', auth, requireRole('employer'), (req, res) => {
  const err = validateJob(req.body);
  if (err) return res.status(400).json({ error: err });
  if (!(req.body.contact_phone || req.body.contact_line))
    return res.status(400).json({ error: 'ระบุช่องทางติดต่ออย่างน้อย 1 ช่องทาง (เบอร์โทรหรือ LINE)' });
  const { title, description = '', category, pay, location = '', work_date = '',
    start_time = '09:00', end_time = '17:00', auto_accept = 0, positions = 1,
    requirements = '', benefits = '', contact_phone = '', contact_line = '' } = req.body;
  const info = db.prepare(
    `INSERT INTO jobs (employer_id, title, description, category, pay, location, work_date, start_time, end_time,
      auto_accept, positions, requirements, benefits, contact_phone, contact_line)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.user.id, title, description, category, Number(pay), location, work_date, start_time, end_time,
    auto_accept ? 1 : 0, Math.max(1, Number(positions) || 1), requirements, benefits, contact_phone, contact_line);
  res.status(201).json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(info.lastInsertRowid));
});

function ownJob(req, res) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) { res.status(404).json({ error: 'ไม่พบงาน' }); return null; }
  if (job.employer_id !== req.user.id) { res.status(403).json({ error: 'ไม่ใช่งานของคุณ' }); return null; }
  return job;
}

router.put('/:id', auth, requireRole('employer'), (req, res) => {
  const job = ownJob(req, res); if (!job) return;
  const m = { ...job, ...req.body };
  const err = validateJob(m);
  if (err) return res.status(400).json({ error: err });
  if (!['open', 'closed'].includes(m.status)) return res.status(400).json({ error: 'status ไม่ถูกต้อง' });
  db.prepare('UPDATE jobs SET title=?, description=?, category=?, pay=?, location=?, status=? WHERE id=?')
    .run(m.title, m.description, m.category, Number(m.pay), m.location, m.status, job.id);
  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id));
});

router.delete('/:id', auth, requireRole('employer'), (req, res) => {
  const job = ownJob(req, res); if (!job) return;
  db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
  res.status(204).end();
});

// POST /api/jobs/:id/apply  (นักศึกษาสมัครงาน)
router.post('/:id/apply', auth, requireRole('student'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job || job.status !== 'open') return res.status(404).json({ error: 'ไม่พบงาน หรืองานปิดรับแล้ว' });
  const filled = db.prepare("SELECT COUNT(*) c FROM applications WHERE job_id = ? AND status = 'accepted'").get(job.id).c;
  if (filled >= job.positions) return res.status(409).json({ error: 'ตำแหน่งเต็มแล้ว' });
  const status = job.auto_accept ? 'accepted' : 'pending'; // "สมัครแล้วรับทันที"
  try {
    const info = db.prepare('INSERT INTO applications (job_id, student_id, message, status) VALUES (?,?,?,?)')
      .run(job.id, req.user.id, (req.body && req.body.message) || '', status);
    res.status(201).json({ id: Number(info.lastInsertRowid), status });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'คุณสมัครงานนี้แล้ว' });
    throw e;
  }
});

module.exports = router;
