const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const { setup, passport } = require('./auth');
const apiRouter = require('./api');
const { mountPaymentPortal } = require('./payment');
const { mountDockerLogs }    = require('./dockerLogs');
const webhooksRouter         = require('./webhooks');
const { emitter: logEmitter, getBuffer } = require('../utils/logBroadcaster');

const PUBLIC = path.join(__dirname, 'public');

function mountDashboard(app, io, clientId) {
  setup(clientId);

  // ── Session + Passport ────────────────────────────────────────────────────
  app.use(session({
    secret:            process.env.SESSION_SECRET || 'skyhigh-dev-secret-change-me',
    resave:            false,
    saveUninitialized: false,
    cookie: { sameSite: 'lax', secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  // ── OAuth Routes ──────────────────────────────────────────────────────────
  app.get('/auth/discord', passport.authenticate('discord'));

  app.get('/auth/callback', passport.authenticate('discord', {
    failureRedirect: '/dashboard/login?error=unauthorized',
    successRedirect: '/dashboard/',
  }));

  app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/dashboard/login'));
  });

  // ── Login page (no auth needed) ───────────────────────────────────────────
  app.get('/dashboard/login', (req, res) => {
    res.sendFile(path.join(PUBLIC, 'login.html'));
  });

  // ── Static files (CSS/JS — no auth needed) ────────────────────────────────
  // Serve everything EXCEPT index.html without auth
  app.use('/dashboard', (req, res, next) => {
    const p = req.path.toLowerCase();
    if (p === '/' || p === '' || p === '/index.html') return next();
    express.static(PUBLIC)(req, res, next);
  });

  // ── Dashboard SPA (auth-gated) ────────────────────────────────────────────
  app.get(['/dashboard', '/dashboard/'], (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/dashboard/login');
    res.sendFile(path.join(PUBLIC, 'index.html'));
  });

  // ── API ───────────────────────────────────────────────────────────────────
  app.use('/api', express.json(), apiRouter);

  // ── Payment Portal ────────────────────────────────────────────────────────
  mountPaymentPortal(app, clientId);

  // ── Paymenter billing webhooks ────────────────────────────────────────────
  // POST /webhooks/paymenter  — receives billing events from the DiscordNotifier extension
  app.use('/webhooks', webhooksRouter);

  // ── Socket.io: live log streaming ─────────────────────────────────────────
  io.on('connection', (socket) => {
    socket.emit('history', getBuffer());
    const handler = (entry) => socket.emit('log', entry);
    logEmitter.on('log', handler);
    socket.on('disconnect', () => logEmitter.off('log', handler));
  });

  // ── Socket.io: Docker container log streaming ─────────────────────────────
  mountDockerLogs(io);
}

module.exports = { mountDashboard };
