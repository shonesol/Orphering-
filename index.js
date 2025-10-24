require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== Multer Setup =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

// ===== JWT Middleware =====
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if(!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if(err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ===== Donations =====
const donationsFile = 'data/donations.json';
app.post('/donate', (req, res) => {
  const { name, amount } = req.body;
  if(!name || !amount) return res.status(400).json({ error: 'Name and amount are required.' });

  const donation = { name, amount, date: new Date().toISOString() };
  let donations = [];
  if(fs.existsSync(donationsFile)) donations = JSON.parse(fs.readFileSync(donationsFile));
  donations.push(donation);
  fs.writeFileSync(donationsFile, JSON.stringify(donations, null, 2));

  res.json({ success: true, donation });
});

app.get('/donations', authenticateToken, (req, res) => {
  if(fs.existsSync(donationsFile)) {
    const donations = JSON.parse(fs.readFileSync(donationsFile));
    res.json(donations);
  } else res.json([]);
});

// ===== Media Uploads =====
const mediaFile = 'data/media.json';
app.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  const description = req.body.description || '';
  const file = req.file;
  if(!file) return res.status(400).json({ error: 'File is required' });

  const media = {
    filename: file.filename,
    originalName: file.originalname,
    type: file.mimetype.startsWith('image') ? 'image' : 'video',
    description,
    url: `http://localhost:${PORT}/uploads/${file.filename}`,
    date: new Date().toISOString()
  };

  let mediaList = [];
  if(fs.existsSync(mediaFile)) mediaList = JSON.parse(fs.readFileSync(mediaFile));
  mediaList.push(media);
  fs.writeFileSync(mediaFile, JSON.stringify(mediaList, null, 2));

  res.json({ success: true, media });
});

app.get('/media', (req, res) => {
  if(fs.existsSync(mediaFile)) {
    const mediaList = JSON.parse(fs.readFileSync(mediaFile));
    res.json(mediaList);
  } else res.json([]);
});

// ===== Admin Login with JWT =====
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_HASH = '$2b$10$Qe/1Jr1z9SvQ2ZzY7aNsReGE6f/1M.1Z/BpTz5y.7cYqgEXAMPLE'; // hashed '1234'

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if(username !== ADMIN_USERNAME) return res.status(401).json({ error: 'Invalid username' });

  const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if(!match) return res.status(401).json({ error: 'Invalid password' });

  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));