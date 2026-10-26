// สัปดาห์ 4-5: JWT authentication + role check
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role, name: u.name }, SECRET, { expiresIn: '2h' });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' });
  }
}

// ถ้ามี token ที่ถูกต้องจะใส่ req.user ให้ ถ้าไม่มีก็ผ่านไปเป็นผู้ใช้ทั่วไป
function optionalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try { req.user = jwt.verify(h.slice(7), SECRET); } catch { /* token เสีย = ถือว่าไม่ได้ล็อกอิน */ }
  }
  next();
}

const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: 'ไม่มีสิทธิ์ทำรายการนี้' });

module.exports = { sign, auth, optionalAuth, requireRole };
