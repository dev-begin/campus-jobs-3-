// ทดสอบ API แบบอัตโนมัติ: npm test
process.env.DB_FILE = ':memory:';
const assert = require('assert');
const app = require('./server');
const srv = app.listen(0, async () => {
  const base = `http://localhost:${srv.address().port}/api`;
  const call = async (p, m = 'GET', body, tok) => {
    const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { s: r.status, d: r.status === 204 ? {} : await r.json() };
  };
  try {
    const emp = (await call('/auth/register', 'POST', { name: 'ร้าน A', email: 'e@x.com', password: '123456', role: 'employer' })).d.token;
    const stu = (await call('/auth/register', 'POST', { name: 'นศ. B', email: 's@x.com', password: '123456', role: 'student' })).d.token;
    assert.equal((await call('/auth/login', 'POST', { email: 'e@x.com', password: 'wrong' })).s, 401);
    assert.equal((await call('/jobs', 'POST', { title: 'x', category: 'c', pay: 100 }, stu)).s, 403); // นศ.ลงประกาศไม่ได้
    const job = (await call('/jobs', 'POST', { title: 'เสิร์ฟ', category: 'ร้านอาหาร', pay: 400, work_date: '2026-10-20', start_time: '17:00', end_time: '21:00', auto_accept: true, positions: 1, requirements: 'อายุ 18+', benefits: 'อาหารฟรี', contact_phone: '081-000-0000' }, emp)).d;
    await call('/jobs', 'POST', { title: 'ติวเตอร์', category: 'สอนพิเศษ', pay: 200, contact_line: '@tutor' }, emp);
    assert.equal((await call('/jobs', 'POST', { title: 't', category: 'c', pay: 1 }, emp)).s, 400); // ไม่ใส่ช่องทางติดต่อ
    assert.ok(!('contact_phone' in (await call('/jobs')).d[0]));              // รายการสาธารณะไม่เปิดเผยเบอร์
    const anon = (await call(`/jobs/${job.id}`)).d;
    assert.ok(anon.contact_locked && !anon.contact_phone);                    // ยังไม่ล็อกอิน = ไม่เห็นช่องทางติดต่อ
    assert.equal((await call(`/jobs/${job.id}`, 'GET', null, stu)).d.contact_phone, '081-000-0000');
    assert.equal((await call(`/jobs/${job.id}`)).d.requirements, 'อายุ 18+');
    assert.equal((await call('/jobs?category=ร้านอาหาร')).d.length, 1);
    assert.equal((await call('/jobs?pay_min=300')).d.length, 1);
    assert.equal((await call('/jobs?q=ติว')).d.length, 1);
    assert.equal((await call('/jobs?date=2026-10-20')).d.length, 1);          // กรองตามวัน
    assert.equal((await call('/jobs?time_from=16:00&time_to=22:00')).d.length, 1); // กรองตามช่วงเวลา
    assert.equal((await call("/jobs?q=' OR 1=1 --")).d.length, 0); // SQL injection ไม่ได้ผล
    const ap = (await call(`/jobs/${job.id}/apply`, 'POST', { message: 'สนใจครับ' }, stu)).d;
    assert.equal(ap.status, 'accepted');                                          // สมัครแล้วรับทันที
    assert.equal((await call(`/jobs/${job.id}/apply`, 'POST', {}, stu)).s, 409); // สมัครซ้ำไม่ได้
    const stu2 = (await call('/auth/register', 'POST', { name: 'นศ. C', email: 's2@x.com', password: '123456', role: 'student' })).d.token;
    assert.equal((await call(`/jobs/${job.id}/apply`, 'POST', {}, stu2)).s, 409); // ตำแหน่งเต็ม
    assert.equal((await call('/applications/income', 'GET', null, stu)).d.total, 400);
    assert.equal((await call(`/applications/${ap.id}/status`, 'PUT', { status: 'accepted' }, stu)).s, 403);
    assert.equal((await call(`/applications/${ap.id}/status`, 'PUT', { status: 'accepted' }, emp)).s, 200);
    assert.equal((await call('/applications', 'GET', null, stu)).d[0].status, 'accepted');
    assert.equal((await call(`/jobs/${job.id}`, 'DELETE', null, emp)).s, 204);
    console.log('✅ ทุกเทสต์ผ่าน');
  } catch (e) { console.error('❌', e); process.exitCode = 1; }
  srv.close();
});
