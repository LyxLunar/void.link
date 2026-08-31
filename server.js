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
"admin",
"api",
"www",
"void",
"voidlink",
"founder",
"support",
"login",
"signup",
"settings",
"terms",
"privacy",
"dashboard",
"setup"
]);

const PLANS = new Set([
"free",
"plus",
"pro"
]);

const sessions = new Map();

const SESSION_TTL =
1000 * 60 * 60 * 12;

// ========================================
// FILE SYSTEM INITIALIZATION
// ========================================

try {
if (!fs.existsSync(DATA_DIR)) {
fs.mkdirSync(DATA_DIR, {
recursive: true
});
}

if (!fs.existsSync(DB)) {
fs.writeFileSync(
DB,
JSON.stringify(
{
users: []
},
null,
2
)
);
}
} catch (err) {
console.error(
"Storage initialization error:",
err
);
}

// ========================================
// DATABASE HELPERS
// ========================================

const readJSON = (file, fallback) => {
try {
if (fs.existsSync(file)) {
return JSON.parse(
fs.readFileSync(file, "utf8")
);
}
} catch (err) {
console.error(
`Error reading ${file}:`,
err
);
}

return fallback;
};

const writeJSON = (file, value) => {
try {
fs.writeFileSync(
file,
JSON.stringify(value, null, 2)
);
} catch (err) {
console.error(
`Error writing ${file}:`,
err
);
}
};

const readDB = () =>
readJSON(DB, {
users: []
});

const clean = value =>
String(value || "")
.trim()
.toLowerCase();

const valid = username =>
/^[a-z0-9._-]{1,24}$/.test(username);

// ========================================
// HTML ESCAPING
// ========================================

function escapeHTML(value) {
return String(value).replace(
/[&<>"']/g,
ch => ({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
}[ch])
);
}

// ========================================
// FOUNDER AUTH
// ========================================

function founderConfig() {
return readJSON(
FOUNDER_DB,
{
passwordHash: null,
salt: null,
createdAt: null
}
);
}

function hashPassword(password, salt) {
return crypto
.scryptSync(password, salt, 64)
.toString("hex");
}

function passwordMatches(password, config) {
if (
!config.passwordHash ||
!config.salt
) {
return false;
}

const derived =
hashPassword(
password,
config.salt
);

return crypto.timingSafeEqual(
Buffer.from(
derived,
"hex"
),
Buffer.from(
config.passwordHash,
"hex"
)
);
}

function founderIsSetup() {
const cfg = founderConfig();

return Boolean(
cfg.passwordHash &&
cfg.salt
);
}

function createSession() {
const token =
crypto.randomBytes(32).toString("hex");

sessions.set(
token,
Date.now() + SESSION_TTL
);

return token;
}

function getSession(req) {
const raw =
req.headers.cookie || "";

const match =
raw.match(
/(?:^|;\s*)void_founder=([^;]+)/
);

if (!match) {
return null;
}

const token =
decodeURIComponent(match[1]);

const expires =
sessions.get(token);

if (
!expires ||
expires < Date.now()
) {
sessions.delete(token);
return null;
}

sessions.set(
token,
Date.now() + SESSION_TTL
);

return token;
}

function requireFounder(
req,
res,
next
) {
if (!getSession(req)) {
return res
.status(401)
.json({
error:
"Founder login required."
});
}

next();
}

function cookie(token) {
return (
`void_founder=${encodeURIComponent(token)}; ` +
`HttpOnly; SameSite=Lax; Path=/; ` +
`Max-Age=${SESSION_TTL / 1000}`
);
}

function clearCookie() {
return (
"void_founder=; " +
"HttpOnly; SameSite=Lax; " +
"Path=/; Max-Age=0"
);
}

// ========================================
// MIDDLEWARE
// ========================================

app.use(
express.json({
limit: "50kb"
})
);

app.use(
express.urlencoded({
extended: false
})
);

app.use(
express.static(ROOT, {
extensions: ["html"]
})
);

// ========================================
// HEALTH API
// ========================================

app.get(
"/api/health",
(req, res) => {
const db = readDB();

```
res.json({
  ok: true,
  version: "2.0.0",
  storage: "JSON",
  claimed: db.users.length,
  founderSetup:
    founderIsSetup()
});
```

}
);

// ========================================
// HANDLE AVAILABILITY API
// ========================================

app.get(
"/api/handles/:username",
(req, res) => {
const username =
clean(req.params.username);

```
if (!valid(username)) {
  return res
    .status(400)
    .json({
      available: false,
      error: "Invalid handle."
    });
}

const db = readDB();

const taken =
  db.users.some(
    user =>
      user.username === username
  );

res.json({
  username,
  available:
    !taken &&
    !RESERVED.has(username)
});
```

}
);

// ========================================
// CREATE HANDLE API
// ========================================

app.post(
"/api/handles",
(req, res) => {
const username =
clean(req.body.username);

```
const plan =
  clean(req.body.plan) ||
  "free";


if (!valid(username)) {
  return res
    .status(400)
    .json({
      error:
        "Handle must be 1–24 characters: a-z, 0-9, dot, underscore or hyphen."
    });
}


if (RESERVED.has(username)) {
  return res
    .status(409)
    .json({
      error:
        "That handle is reserved."
    });
}


if (!PLANS.has(plan)) {
  return res
    .status(400)
    .json({
      error:
        "Choose a valid public plan."
    });
}


const db = readDB();


const existingUser =
  db.users.find(
    user =>
      user.username === username
  );


if (existingUser) {
  return res
    .status(409)
    .json({
      error:
        "That handle is already claimed."
    });
}


const user = {
  id: crypto.randomUUID(),

  username,

  role: "user",

  plan,

  createdAt:
    new Date().toISOString()
};


db.users.push(user);

writeJSON(DB, db);


// IMPORTANT:
// Tell the frontend exactly
// where the new profile lives.
return res
  .status(201)
  .json({
    ok: true,

    user,

    profileUrl:
      `/u/${encodeURIComponent(
        username
      )}`
  });
```

}
);

// ========================================
// FOUNDER FRONT-END ROUTES
// ========================================

app.get(
"/founder",
(req, res) => {
if (getSession(req)) {
return res.redirect(
"/founder/dashboard"
);
}

```
res.sendFile(
  path.join(
    ROOT,
    "founder-login.html"
  )
);
```

}
);

app.get(
"/founder/login",
(req, res) => {
if (getSession(req)) {
return res.redirect(
"/founder/dashboard"
);
}

```
res.sendFile(
  path.join(
    ROOT,
    "founder-login.html"
  )
);
```

}
);

app.get(
"/founder/setup",
(req, res) => {
if (founderIsSetup()) {
return res.redirect(
"/founder/login"
);
}

```
res.sendFile(
  path.join(
    ROOT,
    "founder-setup.html"
  )
);
```

}
);

app.get(
"/founder/dashboard",
(req, res) => {
if (!getSession(req)) {
return res.redirect(
"/founder/login"
);
}

```
res.sendFile(
  path.join(
    ROOT,
    "founder-dashboard.html"
  )
);
```

}
);

// ========================================
// FOUNDER AUTH API
// ========================================

app.post(
"/api/founder/setup",
(req, res) => {
if (founderIsSetup()) {
return res
.status(409)
.json({
error:
"Founder account is already configured."
});
}

```
const password =
  String(
    req.body.password || ""
  );


if (password.length < 12) {
  return res
    .status(400)
    .json({
      error:
        "Use at least 12 characters for the founder password."
    });
}


const salt =
  crypto
    .randomBytes(16)
    .toString("hex");


writeJSON(
  FOUNDER_DB,
  {
    passwordHash:
      hashPassword(
        password,
        salt
      ),

    salt,

    createdAt:
      new Date().toISOString()
  }
);


const token =
  createSession();


res.setHeader(
  "Set-Cookie",
  cookie(token)
);


res
  .status(201)
  .json({
    ok: true
  });
```

}
);

app.post(
"/api/founder/login",
(req, res) => {
if (!founderIsSetup()) {
return res
.status(428)
.json({
error:
"Founder account needs first-time setup.",
setupRequired: true
});
}

```
const password =
  String(
    req.body.password || ""
  );


const cfg =
  founderConfig();


if (
  !passwordMatches(
    password,
    cfg
  )
) {
  return res
    .status(401)
    .json({
      error:
        "Incorrect founder password."
    });
}


const token =
  createSession();


res.setHeader(
  "Set-Cookie",
  cookie(token)
);


res.json({
  ok: true
});
```

}
);

app.post(
"/api/founder/logout",
(req, res) => {
const token =
getSession(req);

```
if (token) {
  sessions.delete(token);
}

res.setHeader(
  "Set-Cookie",
  clearCookie()
);

res.json({
  ok: true
});
```

}
);

app.get(
"/api/founder/me",
requireFounder,
(req, res) => {
res.json({
authenticated: true,
role: "founder"
});
}
);

app.get(
"/api/founder/stats",
requireFounder,
(req, res) => {
const db = readDB();

```
const byPlan =
  db.users.reduce(
    (acc, user) => {
      acc[user.plan] =
        (acc[user.plan] || 0) + 1;

      return acc;
    },
    {}
  );


res.json({
  role: "founder",

  totalUsers:
    db.users.length,

  byPlan: {
    free:
      byPlan.free || 0,

    plus:
      byPlan.plus || 0,

    pro:
      byPlan.pro || 0
  }
});
```

}
);

app.get(
"/api/founder/users",
requireFounder,
(req, res) => {
const db = readDB();

```
const q =
  clean(req.query.q);


const users =
  db.users
    .filter(
      user =>
        !q ||
        user.username.includes(q) ||
        user.plan.includes(q)
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(
          a.createdAt
        )
    )
    .slice(0, 250);


res.json({
  users
});
```

}
);

app.delete(
"/api/founder/users/:id",
requireFounder,
(req, res) => {
const db = readDB();

```
const index =
  db.users.findIndex(
    user =>
      user.id === req.params.id
  );


if (index === -1) {
  return res
    .status(404)
    .json({
      error:
        "User not found."
    });
}


const [removed] =
  db.users.splice(
    index,
    1
  );


writeJSON(DB, db);


res.json({
  ok: true,
  removed:
    removed.username
});
```

}
);

// ========================================
// DYNAMIC PROFILE PAGE
// ========================================

app.get(
"/u/:username",
(req, res) => {
const username =
clean(req.params.username);

```
// Invalid URL username
if (!valid(username)) {
  return res
    .status(404)
    .send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

          <title>
            Handle not found — VOID.LINK
          </title>
        </head>

        <body
          style="
            margin:0;
            min-height:100vh;
            display:grid;
            place-items:center;
            background:#050506;
            color:#fff;
            font-family:system-ui,sans-serif;
          "
        >
          <main
            style="
              text-align:center;
              padding:40px;
            "
          >
            <h1>
              Handle not found
            </h1>

            <p>
              This isn't a valid
              VOID.LINK handle.
            </p>

            <a
              href="/"
              style="color:#a66cff"
            >
              ← Claim a handle
            </a>
          </main>
        </body>
      </html>
    `);
}


const db = readDB();


const user =
  db.users.find(
    user =>
      user.username === username
  );


// Valid username but
// no claimed account
if (!user) {
  return res
    .status(404)
    .send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

          <title>
            Not found — VOID.LINK
          </title>
        </head>

        <body
          style="
            margin:0;
            min-height:100vh;
            display:grid;
            place-items:center;
            background:#050506;
            color:#fff;
            font-family:system-ui,sans-serif;
          "
        >
          <main
            style="
              text-align:center;
              padding:40px;
            "
          >
            <h1>
              @${escapeHTML(username)}
              doesn't exist
            </h1>

            <p>
              This handle hasn't been
              claimed yet.
            </p>

            <a
              href="/"
              style="color:#a66cff"
            >
              ← Claim a handle
            </a>
          </main>
        </body>
      </html>
    `);
}


// User exists:
// render their profile.
return res
  .status(200)
  .send(`
    <!doctype html>

    <html>
      <head>
        <meta charset="utf-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        >

        <meta
          name="theme-color"
          content="#050506"
        >

        <title>
          @${escapeHTML(
            user.username
          )} — VOID.LINK
        </title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;

            min-height: 100vh;

            display: grid;

            place-items: center;

            padding: 24px;

            background: #050506;

            color: #f4f2f7;

            font-family:
              Inter,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .card {
            width:
              min(520px, 100%);

            padding: 36px;

            border:
              1px solid #242329;

            border-radius: 22px;

            background: #0d0d12;

            box-shadow:
              0 30px 100px
              rgba(0, 0, 0, .45);
          }

          .badge {
            display:
              inline-block;

            padding:
              7px 10px;

            border-radius:
              999px;

            background:
              #17131f;

            color:
              #b891ff;

            font-size:
              12px;

            font-weight:
              700;

            letter-spacing:
              .04em;
          }

          h1 {
            margin:
              18px 0 8px;

            font-size:
              clamp(
                36px,
                8vw,
                56px
              );

            line-height:
              1;

            letter-spacing:
              -.06em;
          }

          p {
            margin: 0;

            color:
              #8d8995;

            line-height:
              1.6;
          }

          .back {
            display:
              inline-block;

            margin-top:
              28px;

            color:
              #a66cff;

            text-decoration:
              none;
          }

          .back:hover {
            text-decoration:
              underline;
          }
        </style>
      </head>

      <body>
        <main class="card">

          <span class="badge">
            ${escapeHTML(
              String(
                user.plan ||
                "free"
              ).toUpperCase()
            )}
            · CREATOR
          </span>

          <h1>
            @${escapeHTML(
              user.username
            )}
          </h1>

          <p>
            This handle is live
            on VOID.LINK.

            Your profile can be
            expanded with links,
            socials, media,
            themes and widgets.
          </p>

          <a
            class="back"
            href="/"
          >
            ← Back to VOID
          </a>

        </main>
      </body>
    </html>
  `);
```

}
);

// ========================================
// START SERVER
// ========================================

app.listen(
PORT,
HOST,
() => {
console.log(
`\nVOID.LINK server active on http://${HOST}:${PORT}`
);

```
console.log(
  `Founder entry point: http://${HOST}:${PORT}/founder`
);
```

}
);
