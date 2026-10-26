// ข้อมูลตัวอย่าง (สมมติ ไม่ใช่งานจริง) สำหรับเดโม: npm run seed
const bcrypt = require('bcryptjs');
const db = require('./db');
const h = bcrypt.hashSync('123456', 10);
const u = db.prepare('INSERT OR IGNORE INTO users (name,email,password_hash,role,phone,line_id) VALUES (?,?,?,?,?,?)');
u.run('ร้านกาแฟหน้ามอ (ตัวอย่าง)', 'cafe@demo.com', h, 'employer', '081-000-0001', '@cafe_demo');
u.run('ศูนย์คอมพิวเตอร์ (ตัวอย่าง)', 'it@demo.com', h, 'employer', '081-000-0002', '@itcenter_demo');
u.run('KK นักศึกษา', 'kk@demo.com', h, 'student', '081-000-0003', 'kk_demo');
const emp = (e) => db.prepare('SELECT id FROM users WHERE email=?').get(e).id;
const day = (n) => new Date(Date.now() + n * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const j = db.prepare(`INSERT INTO jobs (employer_id,title,description,category,pay,location,work_date,start_time,end_time,
  auto_accept,positions,requirements,benefits,contact_phone,contact_line) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
if (db.prepare('SELECT COUNT(*) c FROM jobs').get().c === 0) {
  const c = emp('cafe@demo.com'), t = emp('it@demo.com');
  j.run(c, 'พนักงานเสิร์ฟช่วงเย็น', 'เสิร์ฟอาหาร เก็บโต๊ะ ช่วยแคชเชียร์เวลาลูกค้าเยอะ', 'ร้านอาหาร', 400, 'หน้ามหาวิทยาลัย (ร้านตัวอย่าง)', day(0), '17:00', '21:00', 1, 2, 'อายุ 18 ปีขึ้นไป\nตรงต่อเวลา ยิ้มแย้ม', 'อาหารฟรี 1 มื้อ\nชุดฟอร์มทางร้านจัดให้', '081-000-0001', '@cafe_demo');
  j.run(c, 'บาริสต้าเสาร์-อาทิตย์', 'ชงกาแฟ ทำความสะอาดเคาน์เตอร์ ไม่ต้องมีประสบการณ์ มีคนสอนงาน', 'ร้านอาหาร', 450, 'หน้ามหาวิทยาลัย (ร้านตัวอย่าง)', day(1), '09:00', '15:00', 0, 1, 'ชอบงานบริการ\nทำงานได้ทั้งวัน', 'เครื่องดื่มฟรีระหว่างทำงาน', '081-000-0001', '@cafe_demo');
  j.run(c, 'พนักงานล้างจาน', 'ล้างจานและเตรียมวัตถุดิบช่วงเที่ยง', 'ร้านอาหาร', 350, 'หน้ามหาวิทยาลัย (ร้านตัวอย่าง)', day(2), '11:00', '15:00', 1, 3, 'ขยัน อดทน', 'อาหารกลางวันฟรี', '081-000-0001', '@cafe_demo');
  j.run(t, 'ผู้ช่วยดูแลห้องแล็บ', 'ดูแลคอมพิวเตอร์ ตอบคำถามนักศึกษาที่มาใช้ห้อง', 'ในมหาวิทยาลัย', 350, 'อาคาร 5 (ตัวอย่าง)', day(1), '13:00', '17:00', 0, 2, 'นักศึกษาสาขาคอมพิวเตอร์ ปี 2 ขึ้นไป', 'ได้ชั่วโมงกิจกรรม', '081-000-0002', '@itcenter_demo');
  j.run(t, 'ทำสื่อโซเชียลกิจกรรมคณะ', 'ตัดต่อวิดีโอสั้นและออกแบบโปสเตอร์ด้วย Canva/CapCut', 'สื่อ/ออกแบบ', 500, 'ออนไลน์', day(3), '10:00', '16:00', 0, 1, 'มีผลงานตัวอย่างแนบมา', 'ใช้เป็นผลงาน Portfolio ได้', '081-000-0002', '@itcenter_demo');
  j.run(t, 'ติวเตอร์คณิตศาสตร์ปี 1', 'สอนกลุ่มเล็กไม่เกิน 5 คน', 'สอนพิเศษ', 300, 'ห้องสมุด (ตัวอย่าง)', day(2), '16:00', '18:00', 0, 1, 'เกรดคณิตศาสตร์ A/B+', '-', '081-000-0002', '@itcenter_demo');
}
console.log('seed เสร็จ (ข้อมูลสมมติ) | student: kk@demo.com / 123456 | employer: cafe@demo.com / 123456');
