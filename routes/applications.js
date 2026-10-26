// สัปดาห์ 7-9: ดูใบสมัคร + ติดตามสถานะ (pending/accepted/rejected)
const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/applications  -- นักศึกษา: ใบสมัครของตัวเอง / นายจ้าง: ผู้สมัครงานของตัวเอง
router.get('/', auth, (req, res) => {
  const sql = req.user.role === 'student'
    ? `SELECT a.*, j.title AS job_title, j.pay, j.location, j.work_date, j.start_time, j.end_time,
       CASE WHEN a.status = 'accepted' THEN j.contact_phone END AS contact_phone,
       CASE WHEN a.status = 'accepted' THEN j.contact_line END AS contact_line, u.name AS employer_name
       FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = j.employer_id
       WHERE a.student_id = ? ORDER BY a.id DESC`
    : `SELECT a.*, j.title AS job_title, s.name AS student_name, s.email AS student_email, s.phone AS student_phone, s.line_id AS student_line
       FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users s ON s.id = a.student_id
       WHERE j.employer_id = ? ORDER BY a.id DESC`;
  res.json(db.prepare(sql).all(req.user.id));
});

// PUT /api/applications/:id/status  -- เฉพาะเจ้าของประกาศงาน
router.put('/:id/status', auth, requireRole('employer'), (req, res) => {
  const { status } = req.body || {};
  if (!['accepted', 'rejected', 'pending'].includes(status))
    return res.status(400).json({ error: 'status ต้องเป็น pending / accepted / rejected' });
  const a = db.prepare(
    'SELECT a.id, a.job_id, j.employer_id, j.positions FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?'
  ).get(req.params.id);
  if (!a) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  if (a.employer_id !== req.user.id) return res.status(403).json({ error: 'ไม่ใช่งานของคุณ' });
  if (status === 'accepted') {
    const filled = db.prepare("SELECT COUNT(*) c FROM applications WHERE job_id = ? AND status = 'accepted' AND id != ?").get(a.job_id, a.id).c;
    if (filled >= a.positions) return res.status(409).json({ error: 'ตำแหน่งเต็มแล้ว' });
  }
  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, a.id);
  res.json({ id: a.id, status });
});

// GET /api/applications/income -- รายได้ของนักศึกษา (งานที่ได้รับแล้ว)
router.get('/income', auth, requireRole('student'), (req, res) => {
  const jobs = db.prepare(`SELECT a.id, j.title, j.pay, j.work_date FROM applications a
    JOIN jobs j ON j.id = a.job_id WHERE a.student_id = ? AND a.status = 'accepted'
    ORDER BY j.work_date DESC`).all(req.user.id);
  res.json({ total: jobs.reduce((s, r) => s + r.pay, 0), jobs });
});

module.exports = router;
