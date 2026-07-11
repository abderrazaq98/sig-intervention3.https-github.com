require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const pointsRouter = require('./routes/points');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || process.env.IP || '0.0.0.0';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-key';

app.use(cors());
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8, // 8h
    httpOnly: true,
  },
}));

// ---- Auth admin ----
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Mot de passe incorrect' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---- API points ----
app.use('/api', pointsRouter);

// ---- Fichiers statiques (frontend) ----
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, HOST, () => {
  console.log(`Serveur démarré sur http://${HOST}:${PORT}`);
  console.log(`Interface admin : http://${HOST}:${PORT}/admin.html`);
});
