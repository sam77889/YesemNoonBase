/**
 * NOON Base - Cloudflare Tunnel auth proxy
 *
 * Express 5.x authentication proxy that sits between Cloudflare Tunnel
 * and the NOON Base FastAPI backend + React frontend.
 *
 * Architecture:
 *   Browser → Cloudflare Edge → cloudflared → localhost:3000 (this)
 *                                                  ├── static files from noon_dashboard/dist
 *                                                  └── /api/* → localhost:8001 (FastAPI)
 */

'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const http = require('http');
const httpProxy = require('http-proxy');
const path = require('path');
const cookie = require('cookie');
const cookieSignature = require('cookie-signature');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT, 10) || 3000;
const API_URL = process.env.API_URL || 'http://127.0.0.1:8001';
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', 'noon_dashboard', 'dist');
const USERNAME = process.env.NOON_USER || 'admin';
const PASSWORD = process.env.NOON_PASS || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-insecure-secret';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE, 10) || (30 * 60 * 1000);
const SECURE_COOKIE = process.env.SECURE_COOKIE ? process.env.SECURE_COOKIE === 'true' : true;

if (!process.env.SESSION_SECRET) {
  console.warn('[WARN] SESSION_SECRET not set in .env, using insecure fallback');
}
if (!PASSWORD) {
  console.error('[ERROR] NOON_PASS not set. Please configure .env file.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Express application setup
// ---------------------------------------------------------------------------
const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);

// Long-connection settings
server.timeout = 0;
server.keepAliveTimeout = 0;
server.headersTimeout = 0;

// Track sockets for graceful shutdown
const sockets = new Set();
server.on('connection', function(socket) {
  sockets.add(socket);
  socket.on('close', function() {
    sockets.delete(socket);
  });
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(morgan('combined'));
app.use(compression());

const sessionStore = new session.MemoryStore();

app.use(session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    maxAge: SESSION_MAX_AGE,
    sameSite: 'lax',
    secure: SECURE_COOKIE
  },
  rolling: true
}));

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ detail: 'Unauthorized' });
  }
  res.redirect('/login');
}

// ---------------------------------------------------------------------------
// Rate limiting for login
// ---------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: function(req, res) {
    console.log('[AUTH] rate limited: ' + req.ip);
    res.status(429).send(
      '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/login?error=rate">' +
      '</head><body>Too many attempts</body></html>'
    );
  }
});

// ---------------------------------------------------------------------------
// Reverse proxy to FastAPI
// ---------------------------------------------------------------------------
const proxy = httpProxy.createProxyServer({
  target: API_URL,
  ws: true,
  proxyTimeout: 0,
  timeout: 0,
  changeOrigin: true
});

proxy.on('error', function(err, req, res) {
  console.error('[PROXY] error:', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502);
    res.end('Bad Gateway');
  }
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Login page
app.get('/login', function(req, res) {
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Login handler (rate-limited)
app.post('/login', loginLimiter, express.urlencoded({ extended: true }), function(req, res) {
  if (req.body.username === USERNAME && req.body.password === PASSWORD) {
    req.session.authenticated = true;
    console.log('[AUTH] login success: ' + req.ip + ' user=' + req.body.username);
    return res.redirect('/');
  }
  console.log('[AUTH] login failed: ' + req.ip + ' user=' + req.body.username);
  res.status(401).send(
    '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/login?error=1">' +
    '</head><body>Redirecting...</body></html>'
  );
});

// Logout
app.get('/logout', function(req, res) {
  console.log('[AUTH] logout: ' + req.ip);
  req.session.destroy();
  res.redirect('/login');
});

// API routes: require auth then proxy
// Express strips the '/api' mount prefix from req.url, so we restore it
// before forwarding to FastAPI which expects full paths like /api/v1/...
app.use('/api', requireAuth, function(req, res) {
  req.url = '/api' + req.url;
  proxy.web(req, res);
});

// Static files and SPA fallback
app.use(requireAuth);
app.use(express.static(STATIC_DIR, { maxAge: '1h' }));
app.use(function(req, res) {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// ---------------------------------------------------------------------------
// WebSocket upgrade handler
// ---------------------------------------------------------------------------
server.on('upgrade', function(req, socket, head) {
  var rawSid;

  try {
    var cookies = cookie.parse(req.headers.cookie || '');
    rawSid = cookies['connect.sid'];
  } catch (e) {
    console.log('[WS] rejected: cookie parse error for ' + req.url);
    socket.destroy();
    return;
  }

  if (!rawSid || rawSid.substring(0, 2) !== 's:') {
    console.log('[WS] rejected: no valid session cookie for ' + req.url);
    socket.destroy();
    return;
  }

  var sid = cookieSignature.unsign(rawSid.slice(2), SESSION_SECRET);
  if (!sid || sid === false) {
    console.log('[WS] rejected: invalid session signature for ' + req.url);
    socket.destroy();
    return;
  }

  sessionStore.get(sid, function(err, sess) {
    if (err || !sess || !sess.authenticated) {
      console.log('[WS] rejected: no authenticated session for ' + req.url);
      socket.destroy();
      return;
    }

    socket.setTimeout(0);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 30);
    console.log('[WS] connect: ' + req.url);

    proxy.ws(req, socket, head, { timeout: 0 }, function(err) {
      if (err) console.error('[WS] proxy error:', err.message);
    });

    socket.on('close', function() {
      console.log('[WS] disconnect: ' + req.url);
    });
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function gracefulShutdown(signal) {
  console.log('[SERVER] ' + signal + ' received, shutting down gracefully...');

  server.close(function() {
    console.log('[SERVER] All connections closed, exiting');
    process.exit(0);
  });

  setTimeout(function() {
    console.log('[SERVER] Force closing ' + sockets.size + ' remaining connections');
    sockets.forEach(function(s) {
      s.destroy();
    });
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', function() { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', function() { gracefulShutdown('SIGINT'); });

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
server.listen(PORT, '127.0.0.1', function() {
  console.log('[SERVER] NOON Base proxy on 127.0.0.1:' + PORT + ' -> API ' + API_URL);
  console.log('[SERVER] Serving static files from ' + STATIC_DIR);
});
