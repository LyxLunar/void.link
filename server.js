const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB = path.join(DATA_DIR, "users.json");
const FOUNDER_DB = path.join(DATA_DIR, "founder.json");

const RESERVED = new Set([
  "admin", "api", "www", "void", "voidlink", "founder", "support", "login", "signup",
  "settings", "terms", "privacy", "dashboard", "setup"
]);
const PLANS = new Set(["free", "plus", "pro"]);
const sessions = new Map();
const SESSION_TTL = 1000 * 60 * 60 * 12;

// File system initialization
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB)) {
    fs.writeFileSync(DB, JSON.stringify({ users: [] }, null, 2));
  }
} catch (err) {
  console.error("Storage initialization error:", err);
}

const readJSON = (file, fallback) => {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return fallback;
};

const writeJSON = (file, value) => {
  try {
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
};

const readDB = () => readJSON(DB, { users: [] });
const clean = value => String(value || "").trim().toLowerCase();
const valid = username => /^[a-z0-9._-]{1,24}$/.test(username);

function founderConfig() {
  return readJSON(FOUNDER_DB, { passwordHash: null, salt: null, createdAt: null });
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function passwordMatches(password, config) {
  if (!config.passwordHash || !config.salt) return false;
  const derived = hashPassword(password, config.salt);
  return crypto.timingSafeEqual(
    Buffer.from(derived, "hex"),
    Buffer.from(config.passwordHash, "hex")
  );
}

function founderIsSetup() {
  const cfg = founderConfig();
  return Boolean(cfg.passwordHash && cfg.salt);
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function getSession(req) {
  const raw = req.headers.cookie || "";
  const match = raw.match(/(?:^|;\s*)void_founder=([^;]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const expires = sessions.get(token);
  if (!expires || expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function requireFounder(req, res, next) {
  if (!getSession(req)) return res.status(401).json({ error: "Founder login required." });
  next();
}

function cookie(token) {
  return `void_founder=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}`;
}

function clearCookie() {
  return "void_founder=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

// Middleware
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(ROOT, { extensions: ["html"] }));

// System Health API
app.get("/api/health", (req, res) => {
  const db = readDB();
  res.json({
    ok: true,
    version: "2.0.0",
    storage: "JSON",
    claimed: db.users.length,
    founderSetup: founderIsSetup()
  });
});

// Handle Availability Check API
app.get("/api/handles/:username", (req, res) => {
  const username = clean(req.params.username);
  if (!valid(username))
    return res.status(400).json({ available: false, error: "Invalid handle." });
  const db = readDB();
  const taken = db.users.some(user => user.username === username);
  res.json({ username, available: !taken && !RESERVED.has(username) });
});

// Create Handle API
app.post("/api/handles", (req, res) => {
  const username = clean(req.body.username);
  const plan = clean(req.body.plan) || "free";
  if (!valid(username))
    return res.status(400).json({ error: "Handle must be 1–24 characters: a-z, 0-9, dot, underscore or hyphen." });
  if (RESERVED.has(username))
    return res.status(409).json({ error: "That handle is reserved." });
  if (!PLANS.has(plan))
    return res.status(400).json({ error: "Choose a valid public plan." });

  const db = readDB();
  if (db.users.some(user => user.username === username))
    return res.status(409).json({ error: "That handle is already claimed." });

  const user = {
    id: crypto.randomUUID(),
    username,
    role: "user",
    plan,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  writeJSON(DB, db);
  res.status(201).json(user);
});

// Founder Front-End Web Page Routes
app.get("/founder", (req, res) => {
  if (getSession(req)) return res.redirect("/founder/dashboard");
  res.sendFile(path.join(ROOT, "founder-login.html"));
});

app.get("/founder/login", (req, res) => {
  if (getSession(req)) return res.redirect("/founder/dashboard");
  res.sendFile(path.join(ROOT, "founder-login.html"));
});

app.get("/founder/setup", (req, res) => {
  if (founderIsSetup()) return res.redirect("/founder/login");
  res.sendFile(path.join(ROOT, "founder-setup.html"));
});

app.get("/founder/dashboard", (req, res) => {
  if (!getSession(req)) return res.redirect("/founder/login");
  res.sendFile(path.join(ROOT, "founder-dashboard.html"));
});

// Founder Authentication API Endpoints
app.post("/api/founder/setup", (req, res) => {
  if (founderIsSetup())
    return res.status(409).json({ error: "Founder account is already configured." });

  const password = String(req.body.password || "");
  if (password.length < 12)
    return res.status(400).json({ error: "Use at least 12 characters for the founder password." });

  const salt = crypto.randomBytes(16).toString("hex");
  writeJSON(FOUNDER_DB, {
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString()
  });
  const token = createSession();
  res.setHeader("Set-Cookie", cookie(token));
  res.status(201).json({ ok: true });
});

app.post("/api/founder/login", (req, res) => {
  if (!founderIsSetup())
    return res.status(428).json({ error: "Founder account needs first-time setup.", setupRequired: true });

  const password = String(req.body.password || "");
  const cfg = founderConfig();
  if (!passwordMatches(password, cfg))
    return res.status(401).json({ error: "Incorrect founder password." });

  const token = createSession();
  res.setHeader("Set-Cookie", cookie(token));
  res.json({ ok: true });
});

app.post("/api/founder/logout", (req, res) => {
  const token = getSession(req);
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", clearCookie());
  res.json({ ok: true });
});

app.get("/api/founder/me", requireFounder, (req, res) => {
  res.json({ authenticated: true, role: "founder" });
});

app.get("/api/founder/stats", requireFounder, (req, res) => {
  const db = readDB();
  const byPlan = db.users.reduce((acc, user) => {
    acc[user.plan] = (acc[user.plan] || 0) + 1;
    return acc;
  }, {});
  res.json({
    role: "founder",
    totalUsers: db.users.length,
    byPlan: { free: byPlan.free || 0, plus: byPlan.plus || 0, pro: byPlan.pro || 0 }
  });
});

app.get("/api/founder/users", requireFounder, (req, res) => {
  const db = readDB();
  const q = clean(req.query.q);
  const users = db.users
    .filter(user => !q || user.username.includes(q) || user.plan.includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 250);
  res.json({ users });
});

app.delete("/api/founder/users/:id", requireFounder, (req, res) => {
  const db = readDB();
  const index = db.users.findIndex(user => user.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "User not found." });
  const [removed] = db.users.splice(index, 1);
  writeJSON(DB, db);
  res.json({ ok: true, removed: removed.username });
});

// Dynamic Profile Page Route
app.get("/u/:username", (req, res) => {
  const username = clean(req.params.username);
  const user = readDB().users.find(x => x.username === username);
  if (!user) {
    return res.status(404).send(`<!doctype html><title>Not found</title>
    <body style="font-family:system-ui;background:#050506;color:#fff;padding:40px">
    <h1>404</h1><p>That handle is not claimed.</p><a href="/" style="color:#a66cff">Claim one →</a></body>`);
  }
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHTML(user.username)} — VOID.LINK</title>
  <style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050506;color:#f4f2f7;font-family:Inter,system-ui,sans-serif}
  .card{width:min(520px,calc(100% - 32px));padding:36px;border:1px solid #242329;border-radius:22px;background:#0d0d12;box-shadow:0 30px 100px #000}
  h1{margin:0 0 8px;font-size:44px;letter-spacing:-.06em}p{color:#8d8995}
  .badge{display:inline-block;margin-top:12px;padding:7px 10px;border-radius:999px;background:#17131f;color:#b891ff;font-size:12px}
  .back{display:inline-block;margin-top:26px;color:#a66cff}
  </style></head><body><main class="card">
  <span class="badge">${escapeHTML(user.plan.toUpperCase())} · CREATOR</span>
  <h1>@${escapeHTML(user.username)}</h1>
  <p>This handle is live on VOID.LINK. Your profile can be expanded with links, socials, media, themes and widgets.</p>
  <a class="back" href="/">← Back to VOID</a></main></body></html>`);
});

// Start Express Server for Railway
app.listen(PORT, HOST, () => {
  console.log(`\nVOID.LINK server active on http://${HOST}:${PORT}`);
  console.log(`Founder entry point: http://${HOST}:${PORT}/founder`);
});
