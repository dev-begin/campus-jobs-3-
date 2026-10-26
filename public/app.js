// สัปดาห์ 6-9: Frontend แบบ Dynamic (fetch + Partial Render ไม่รีโหลดหน้า)
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); // กัน XSS
const STATUS = { pending: 'รอพิจารณา', accepted: 'ผ่านการคัดเลือก', rejected: 'ไม่ผ่าน' };

let token = localStorage.getItem('token');
let me = JSON.parse(localStorage.getItem('me') || 'null');
let isRegister = false;
let selDate = '';
const ymd = (i) => new Date(Date.now() + i * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const fmtD = (d) => d ? new Date(d + 'T00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }) : 'ไม่ระบุวัน';

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (res.status === 401 && token) { logout(); }
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

/* ---------- Auth ---------- */
function setSession(d) {
  token = d.token; me = d.user;
  localStorage.setItem('token', token); localStorage.setItem('me', JSON.stringify(me));
  renderShell(); showView('jobsView'); loadJobs();
}
function logout() {
  token = null; me = null; localStorage.clear(); renderShell(); showView('jobsView'); loadJobs();
}
function setAuthMode(reg) {
  isRegister = reg;
  document.querySelectorAll('.reg').forEach((e) => e.classList.toggle('hidden', !reg));
  $('#authTitle').textContent = reg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
  $('#authBtn').textContent = reg ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
  $('#authSwitch').textContent = reg ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก';
}
$('#authSwitch').onclick = (e) => { e.preventDefault(); setAuthMode(!isRegister); };
$('#authBtn').onclick = async () => {
  try {
    const body = { email: $('#aEmail').value, password: $('#aPass').value };
    if (isRegister) { body.name = $('#aName').value; body.role = $('#aRole').value; body.phone = $('#aPhone').value; body.line_id = $('#aLine').value; }
    setSession(await api(isRegister ? '/auth/register' : '/auth/login', { method: 'POST', body }));
    $('#authMsg').textContent = '';
  } catch (e) { $('#authMsg').textContent = e.message; }
};

/* ---------- Shell / Tabs ---------- */
function renderShell() {
  $('#userbox').innerHTML = me
    ? `${esc(me.name)} (${me.role === 'student' ? 'นักศึกษา' : 'ผู้ประกอบการ'}) <button id="logoutBtn">ออก</button>`
    : '<button id="loginBtn">เข้าสู่ระบบ</button>';
  if (me) $('#logoutBtn').onclick = logout; else $('#loginBtn').onclick = () => showView('authView');
  const tabs = [['jobsView', '🔎 หางาน']];
  if (me?.role === 'student') tabs.push(['myAppsView', '📄 ใบสมัคร'], ['incomeView', '💰 รายได้']);
  if (me?.role === 'employer') tabs.push(['manageView', '🛠 จัดการงาน']);
  $('#tabs').classList.toggle('hidden', !me);
  $('#tabs').innerHTML = tabs.map(([v, t]) => `<button class="alt" data-view="${v}">${t}</button>`).join('');
}
$('#tabs').onclick = (e) => { const v = e.target.dataset.view; if (v) showView(v); };
function showView(id) {
  ['authView', 'jobsView', 'myAppsView', 'incomeView', 'manageView'].forEach((v) => $('#' + v).classList.toggle('hidden', v !== id));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === id));
  if (id === 'myAppsView') loadMyApps();
  if (id === 'incomeView') loadIncome();
  if (id === 'manageView') loadManage();
}

/* ---------- ค้นหา/กรองงานแบบ Dynamic ---------- */
let timer;
['#fQ', '#fPay', '#fFrom', '#fTo'].forEach((s) => $(s).addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadJobs, 300); })); // debounce
$('#fCat').addEventListener('change', loadJobs);

async function loadJobs() {
  const qs = new URLSearchParams();
  if ($('#fQ').value) qs.set('q', $('#fQ').value);
  if ($('#fCat').value) qs.set('category', $('#fCat').value);
  if ($('#fPay').value) qs.set('pay_min', $('#fPay').value);
  if (selDate) qs.set('date', selDate);
  if ($('#fFrom').value) qs.set('time_from', $('#fFrom').value);
  if ($('#fTo').value) qs.set('time_to', $('#fTo').value);
  const t0 = performance.now();
  const jobs = await api('/jobs?' + qs);
  const ms = Math.round(performance.now() - t0);
  $('#count').textContent = `พบ ${jobs.length} งาน (ตอบสนอง ${ms} ms)`; // ใช้เป็น KPI ตอนพรีเซนต์
  $('#jobList').innerHTML = jobs.map((j) => `
    <li><div class="row"><b>${esc(j.title)}</b><span class="pay">${j.pay} บาท/วัน</span></div>
      <div class="muted">${esc(j.employer_name)} · ${esc(j.location)} · <span class="tag">${esc(j.category)}</span></div>
      <div class="muted">📅 ${fmtD(j.work_date)} · ⏰ ${esc(j.start_time)}–${esc(j.end_time)}${j.auto_accept ? ' · <span class="tag accepted">รับทันที</span>' : ''}</div>
      <p>${esc(j.description)}</p>
      <div class="row"><span class="muted">รับแล้ว ${j.filled}/${j.positions} ตำแหน่ง · <a href="#" data-detail="${j.id}">ดูรายละเอียด / ติดต่อ</a></span>
      ${me?.role === 'student' ? (j.filled >= j.positions ? '<span class="tag">เต็มแล้ว</span>' : `<button data-apply="${j.id}">${j.auto_accept ? 'สมัครแล้วรับทันที' : 'สมัครงาน'}</button>`) : ''}</div></li>`).join('')
    || '<li>ไม่พบงานที่ตรงเงื่อนไข</li>';
  fillCategories();
}
let catsLoaded = false;
async function fillCategories() {
  if (catsLoaded) return;
  const all = await api('/jobs');
  const cats = [...new Set(all.map((j) => j.category))];
  $('#fCat').innerHTML = '<option value="">ทุกหมวดหมู่</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  $('#cats').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
  catsLoaded = true;
}
async function applyTo(id) {
  if (!me) { alert('กรุณาเข้าสู่ระบบก่อนสมัครงาน'); return showView('authView'); }
  const message = prompt('ข้อความถึงผู้ว่าจ้าง (ไม่บังคับ)') ?? '';
  try {
    const r = await api(`/jobs/${id}/apply`, { method: 'POST', body: { message } });
    alert(r.status === 'accepted' ? 'ได้รับงานทันที ✅' : 'ส่งใบสมัครแล้ว ✅');
    loadJobs();
  } catch (err) { alert(err.message); }
}
$('#jobList').onclick = (e) => {
  const d = e.target.dataset;
  if (d.detail) { e.preventDefault(); openDetail(d.detail); }
  else if (d.apply) applyTo(d.apply);
};

/* ---------- นักศึกษา: ติดตามสถานะ ---------- */
async function loadMyApps() {
  const apps = await api('/applications');
  $('#myApps').innerHTML = apps.map((a) => `
    <li><div class="row"><b>${esc(a.job_title)}</b><span class="tag ${a.status}">${STATUS[a.status]}</span></div>
    <div class="muted">${esc(a.employer_name)} · ${esc(a.location)} · ${a.pay} บาท</div>
    <div class="muted">📅 ${fmtD(a.work_date)} · ⏰ ${esc(a.start_time)}–${esc(a.end_time)}</div>
    ${a.status === 'accepted' ? `<div class="contact"><b>ติดต่อผู้ว่าจ้าง</b> ${a.contact_phone ? '📞 ' + esc(a.contact_phone) : ''} ${a.contact_line ? '💬 LINE ' + esc(a.contact_line) : ''}</div>` : ''}</li>`).join('')
    || '<li>ยังไม่เคยสมัครงาน</li>';
}

/* ---------- ผู้ประกอบการ: CRUD งาน + จัดการผู้สมัคร ---------- */
$('#jobForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('/jobs', { method: 'POST', body: {
      title: $('#jTitle').value, category: $('#jCat').value, pay: $('#jPay').value,
      location: $('#jLoc').value, description: $('#jDesc').value, work_date: $('#jDate').value,
      start_time: $('#jStart').value, end_time: $('#jEnd').value, positions: $('#jPos').value, auto_accept: $('#jAuto').checked,
      requirements: $('#jReq').value, benefits: $('#jBen').value, contact_phone: $('#jPhone').value, contact_line: $('#jLine').value } });
    e.target.reset(); $('#jDate').value = ymd(0); $('#jobMsg').textContent = ''; catsLoaded = false; loadManage(); loadJobs();
  } catch (err) { $('#jobMsg').textContent = err.message; }
};
async function loadManage() {
  const [jobs, apps] = await Promise.all([api('/jobs/mine'), api('/applications')]);
  $('#myJobs').innerHTML = jobs.map((j) => `
    <li><div class="row"><b>${esc(j.title)}</b><span class="tag">${j.status === 'open' ? 'เปิดรับ' : 'ปิดรับ'}</span></div>
    <div class="muted">${esc(j.category)} · ${j.pay} บาท/วัน</div>
    <div class="row"><button class="alt" data-toggle="${j.id}" data-st="${j.status}">${j.status === 'open' ? 'ปิดรับ' : 'เปิดรับ'}</button>
    <button class="no" data-del="${j.id}">ลบ</button></div></li>`).join('') || '<li>ยังไม่มีประกาศ</li>';
  $('#applicants').innerHTML = apps.map((a) => `
    <li><div class="row"><b>${esc(a.student_name)}</b><span class="tag ${a.status}">${STATUS[a.status]}</span></div>
    <div class="muted">สมัคร: ${esc(a.job_title)} · ${esc(a.student_email)}${a.student_phone ? ' · 📞 ' + esc(a.student_phone) : ''}${a.student_line ? ' · LINE ' + esc(a.student_line) : ''}</div><p>${esc(a.message)}</p>
    <div class="row"><button class="ok" data-st="accepted" data-app="${a.id}">รับ</button>
    <button class="no" data-st="rejected" data-app="${a.id}">ไม่รับ</button></div></li>`).join('') || '<li>ยังไม่มีผู้สมัคร</li>';
}
$('#manageView').onclick = async (e) => {
  const d = e.target.dataset;
  try {
    if (d.app) await api(`/applications/${d.app}/status`, { method: 'PUT', body: { status: d.st } });
    else if (d.toggle) await api(`/jobs/${d.toggle}`, { method: 'PUT', body: { status: d.st === 'open' ? 'closed' : 'open' } });
    else if (d.del) { if (!confirm('ลบประกาศนี้?')) return; await api(`/jobs/${d.del}`, { method: 'DELETE' }); }
    else return;
    loadManage(); loadJobs();
  } catch (err) { alert(err.message); }
};

/* ---------- วันที่ (แถบ 7 วัน) + รายได้ ---------- */
function renderStrip() {
  const days = [''].concat([...Array(7)].map((_, i) => ymd(i)));
  $('#dateStrip').innerHTML = days.map((d) =>
    `<button class="alt ${d === selDate ? 'active' : ''}" data-d="${d}">${d ? fmtD(d) : 'ทุกวัน'}</button>`).join('');
}
$('#dateStrip').onclick = (e) => { if (e.target.dataset.d === undefined) return; selDate = e.target.dataset.d; renderStrip(); loadJobs(); };
async function loadIncome() {
  const d = await api('/applications/income');
  $('#incTotal').textContent = ` ${d.total} บาท`;
  $('#incList').innerHTML = d.jobs.map((r) => `<li><div class="row"><b>${esc(r.title)}</b><span class="pay">${r.pay} บาท</span></div>
    <div class="muted">${fmtD(r.work_date)}</div></li>`).join('') || '<li>ยังไม่มีงานที่ได้รับ</li>';
}

/* ---------- หน้ารายละเอียดงาน (dialog) ---------- */
async function openDetail(id) {
  const j = await api('/jobs/' + id);
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  const tel = (j.contact_phone || '').replace(/[^\d+]/g, '');
  const contact = j.contact_locked
    ? '<div class="contact">🔒 เข้าสู่ระบบเพื่อดูช่องทางติดต่อ</div>'
    : `<div class="contact"><b>ช่องทางติดต่อ</b><br>${j.contact_phone ? `📞 <a href="tel:${tel}">${esc(j.contact_phone)}</a><br>` : ''}${j.contact_line ? `💬 LINE: ${esc(j.contact_line)}` : ''}${!j.contact_phone && !j.contact_line ? 'ผู้ประกอบการยังไม่ได้ระบุ' : ''}</div>`;
  const action = me?.role === 'student'
    ? (j.my_status ? `<span class="tag ${j.my_status}">${STATUS[j.my_status]}</span>`
      : j.filled >= j.positions ? '<span class="tag">เต็มแล้ว</span>'
      : `<button data-apply="${j.id}">${j.auto_accept ? 'สมัครแล้วรับทันที' : 'สมัครงาน'}</button>`)
    : (me ? '' : '<span class="muted">เข้าสู่ระบบเพื่อสมัครงาน</span>');
  $('#jobDetail').innerHTML = `<h3>${esc(j.title)}</h3><div class="pay">${j.pay} บาท</div>
    <dl class="kv">${row('ผู้ว่าจ้าง', j.employer_name)}${row('หมวดหมู่', j.category)}${row('วันที่', j.work_date ? fmtD(j.work_date) : '')}${row('เวลา', j.start_time + '–' + j.end_time)}${row('สถานที่', j.location)}${row('จำนวนที่รับ', 'รับแล้ว ' + j.filled + ' จาก ' + j.positions)}${row('รายละเอียด', j.description)}${row('คุณสมบัติ', j.requirements)}${row('สวัสดิการ', j.benefits)}</dl>
    ${contact}<div class="row" style="margin-top:12px">${action}<button class="alt" data-close="1">ปิด</button></div>`;
  $('#jobDialog').showModal();
}
$('#jobDialog').onclick = (e) => {
  if (e.target.dataset.close || e.target === $('#jobDialog')) $('#jobDialog').close();
  else if (e.target.dataset.apply) { const id = e.target.dataset.apply; $('#jobDialog').close(); applyTo(id); }
};

/* ---------- start ---------- */
setAuthMode(false); renderStrip(); renderShell(); showView('jobsView'); loadJobs();
