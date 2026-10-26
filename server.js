const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));

app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ endpoint' }));
app.use((err, req, res, next) => { // error handler กลาง
  console.error(err);
  res.status(500).json({ error: 'เซิร์ฟเวอร์ผิดพลาด' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
module.exports = app;
