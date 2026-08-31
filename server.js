const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "users.json");

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
  "u"
]);

const PLANS = new Set([
  "free",
  "plus",
  "pro"
]);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, {
    recursive: true
  });
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      {
        users: []
      },
      null,
      2
    )
  );
}

function readDB() {
  try {
    const db = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );

    if (!Array.isArray(db.users)) {
      return {
        users: []
      };
    }

    return db;
  } catch {
    return {
      users: []
    };
  }
}

function writeDB(db) {
  const temporaryFile = `${DB_FILE}.tmp`;

  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(db, null, 2)
  );

  fs.renameSync(
    temporaryFile,
    DB_FILE
  );
}

function clean(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function valid(username) {
  return /^[a-z0-9._-]{1,24}$/.test(
    username
  );
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character])
  );
}

function profileURL(username) {
  return `/u/${encodeURIComponent(username)}`;
}

app.disable("x-powered-by");

app.set(
  "trust proxy",
  1
);

app.use(
  express.json({
    limit: "32kb"
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


/* ─────────────────────────────
   HEALTH
───────────────────────────── */

app.get(
  "/api/health",
  (req, res) => {
    const db = readDB();

    res.json({
      ok: true,
      users: db.users.length,
      status: "online"
    });
  }
);


/* ─────────────────────────────
   AVAILABILITY
───────────────────────────── */

app.get(
  "/api/handles/:username",
  (req, res) => {
    const username = clean(
      req.params.username
    );

    if (!valid(username)) {
      return res.status(400).json({
        ok: false,
        available: false,
        error:
          "Invalid handle."
      });
    }

    const db = readDB();

    const taken = db.users.some(
      user =>
        user.username === username
    );

    const reserved =
      RESERVED.has(username);

    res.json({
      ok: true,
      username,
      available:
        !taken &&
        !reserved
    });
  }
);


/* ─────────────────────────────
   CLAIM HANDLE
───────────────────────────── */

app.post(
  "/api/handles",
  (req, res) => {
    const username = clean(
      req.body.username
    );

    const plan =
      clean(req.body.plan) ||
      "free";

    if (!valid(username)) {
      return res.status(400).json({
        ok: false,
        error:
          "Handle must be 1–24 characters: a-z, 0-9, dot, underscore or hyphen."
      });
    }

    if (RESERVED.has(username)) {
      return res.status(409).json({
        ok: false,
        error:
          "That handle is reserved."
      });
    }

    if (!PLANS.has(plan)) {
      return res.status(400).json({
        ok: false,
        error:
          "Choose a valid plan."
      });
    }

    const db = readDB();

    const existingUser =
      db.users.find(
        user =>
          user.username === username
      );

    if (existingUser) {
      return res.status(409).json({
        ok: false,
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

    writeDB(db);

    return res.status(201).json({
      ok: true,

      user,

      /*
       * The frontend uses this exact URL
       * after a successful claim.
       */
      profileUrl:
        profileURL(username)
    });
  }
);


/* ─────────────────────────────
   USER PROFILE
───────────────────────────── */

app.get(
  "/u/:username",
  (req, res) => {
    const username = clean(
      req.params.username
    );

    if (!valid(username)) {
      return res
        .status(404)
        .send(
          notFoundPage(
            "Invalid handle",
            "That isn't a valid VOID.LINK handle."
          )
        );
    }

    const db = readDB();

    const user = db.users.find(
      user =>
        user.username === username
    );

    if (!user) {
      return res
        .status(404)
        .send(
          notFoundPage(
            `@${escapeHTML(username)} isn't claimed`,
            "This handle hasn't been claimed yet."
          )
        );
    }

    res.set(
      "Cache-Control",
      "no-store"
    );

    return res
      .status(200)
      .send(
        profilePage(user)
      );
  }
);


/* ─────────────────────────────
   404
───────────────────────────── */

app.use(
  (req, res) => {
    if (req.method === "GET") {
      return res
        .status(404)
        .send(
          notFoundPage(
            "404",
            "That page doesn't exist."
          )
        );
    }

    return res
      .status(404)
      .json({
        ok: false,
        error: "Not found."
      });
  }
);


/* ─────────────────────────────
   PROFILE HTML
───────────────────────────── */

function profilePage(user) {
  const username =
    escapeHTML(user.username);

  const plan =
    escapeHTML(
      String(
        user.plan || "free"
      ).toUpperCase()
    );

  const initial =
    escapeHTML(
      user.username
        .charAt(0)
        .toUpperCase()
    );

  const joined =
    user.createdAt
      ? new Date(
          user.createdAt
        ).toLocaleDateString(
          undefined,
          {
            year: "numeric",
            month: "long"
          }
        )
      : "Recently";

  return `<!doctype html>

<html lang="en">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
/>

<meta
  name="theme-color"
  content="#06050a"
/>

<meta
  name="description"
  content="@${username} — VOID.LINK creator profile"
/>

<title>
@${username} — VOID.LINK
</title>

<style>

:root {
  --accent: #a66cff;
  --accent-rgb: 166,108,255;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;

  color: #f8f6fc;

  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  background:
    #050509;

  overflow-x: hidden;
}

body::before {
  content: "";

  position: fixed;
  inset: -30%;

  z-index: -2;

  background:
    radial-gradient(
      circle at 50% 10%,
      rgba(
        var(--accent-rgb),
        .25
      ),
      transparent 28%
    ),

    radial-gradient(
      circle at 10% 80%,
      rgba(
        90,
        150,
        255,
        .09
      ),
      transparent 25%
    ),

    radial-gradient(
      circle at 90% 70%,
      rgba(
        255,
        80,
        150,
        .08
      ),
      transparent 25%
    );

  filter: blur(25px);

  animation:
    ambient 14s
    ease-in-out
    infinite
    alternate;
}

@keyframes ambient {

  to {
    transform:
      translate3d(
        2%,
        -2%,
        0
      )
      scale(1.04);
  }

}

body::after {
  content: "";

  position: fixed;
  inset: 0;

  z-index: -1;

  opacity: .4;

  background-image:
    linear-gradient(
      rgba(
        255,
        255,
        255,
        .018
      )
      1px,
      transparent 1px
    ),

    linear-gradient(
      90deg,
      rgba(
        255,
        255,
        255,
        .018
      )
      1px,
      transparent 1px
    );

  background-size:
    48px 48px;

  mask-image:
    linear-gradient(
      to bottom,
      black,
      transparent
    );
}

.shell {
  width:
    min(
      960px,
      calc(100% - 28px)
    );

  margin: auto;

  padding:
    22px 0 60px;
}

.nav {
  height: 52px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;
}

.brand {
  color: white;

  text-decoration: none;

  font-size: 21px;

  font-weight: 950;

  letter-spacing:
    -.075em;
}

.brand span {
  color:
    var(--accent);
}

.navlink {
  color: #a39cab;

  text-decoration: none;

  font-size: 12px;

  font-weight: 800;

  padding:
    11px 15px;

  border-radius:
    999px;

  border:
    1px solid
    rgba(
      255,
      255,
      255,
      .09
    );

  background:
    rgba(
      255,
      255,
      255,
      .035
    );

  transition:
    .2s ease;
}

.navlink:hover {
  color: white;

  border-color:
    rgba(
      var(--accent-rgb),
      .45
    );

  transform:
    translateY(-2px);
}

.hero {
  text-align: center;

  width:
    min(
      700px,
      100%
    );

  margin:
    70px auto 0;
}

.avatar {
  width: 112px;
  height: 112px;

  margin:
    0 auto 30px;

  display: grid;

  place-items: center;

  position: relative;

  border-radius: 34px;

  font-size: 45px;

  font-weight: 950;

  letter-spacing:
    -.08em;

  background:
    linear-gradient(
      145deg,
      rgba(
        255,
        255,
        255,
        .12
      ),
      rgba(
        255,
        255,
        255,
        .025
      )
    );

  border:
    1px solid
    rgba(
      255,
      255,
      255,
      .14
    );

  box-shadow:
    0 30px 100px
    rgba(
      var(--accent-rgb),
      .22
    );
}

.avatar::before {
  content: "";

  position: absolute;

  inset: -8px;

  border-radius: 41px;

  border:
    1px solid
    rgba(
      var(--accent-rgb),
      .28
    );
}

.online {
  position: absolute;

  width: 18px;
  height: 18px;

  right: 1px;
  bottom: 1px;

  border-radius: 50%;

  background: #78e56e;

  border:
    4px solid
    #07060b;

  box-shadow:
    0 0 24px
    rgba(
      120,
      229,
      110,
      .55
    );
}

h1 {
  margin: 0;

  font-size:
    clamp(
      48px,
      9vw,
      88px
    );

  line-height: .9;

  letter-spacing:
    -.09em;

  overflow-wrap:
    anywhere;
}

.url {
  margin-top: 17px;

  color: #777181;

  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;

  font-size: 12px;
}

.badges {
  display: flex;

  justify-content: center;

  flex-wrap: wrap;

  gap: 8px;

  margin: 24px 0;
}

.badge {
  padding:
    8px 11px;

  border-radius:
    999px;

  font-family:
    ui-monospace,
    monospace;

  font-size: 9px;

  font-weight: 800;

  letter-spacing:
    .1em;

  color: #c9aaff;

  background:
    rgba(
      var(--accent-rgb),
      .08
    );

  border:
    1px solid
    rgba(
      var(--accent-rgb),
      .28
    );
}

.badge.live {
  color: #9cec93;

  background:
    rgba(
      120,
      229,
      110,
      .06
    );

  border-color:
    rgba(
      120,
      229,
      110,
      .22
    );
}

.bio {
  max-width: 580px;

  margin: auto;

  color: #9b95a5;

  line-height: 1.75;

  font-size: 14px;
}

.actions {
  display: flex;

  justify-content: center;

  flex-wrap: wrap;

  gap: 9px;

  margin-top: 26px;
}

.action {
  color: white;

  text-decoration: none;

  font-size: 12px;

  font-weight: 800;

  padding:
    12px 16px;

  border-radius: 13px;

  border:
    1px solid
    rgba(
      255,
      255,
      255,
      .1
    );

  background:
    rgba(
      255,
      255,
      255,
      .04
    );

  transition:
    .2s ease;
}

.action.primary {
  border-color:
    rgba(
      var(--accent-rgb),
      .35
    );

  background:
    rgba(
      var(--accent-rgb),
      .13
    );
}

.action:hover {
  transform:
    translateY(-2px);

  border-color:
    rgba(
      var(--accent-rgb),
      .5
    );

  box-shadow:
    0 15px 40px
    rgba(
      var(--accent-rgb),
      .12
    );
}

.content {
  display: grid;

  grid-template-columns:
    1fr 1fr;

  gap: 14px;

  margin-top: 52px;
}

.card {
  padding: 21px;

  border-radius: 23px;

  border:
    1px solid
    rgba(
      255,
      255,
      255,
      .085
    );

  background:
    linear-gradient(
      145deg,
      rgba(
        255,
        255,
        255,
        .055
      ),
      rgba(
        255,
        255,
        255,
        .018
      )
    );

  backdrop-filter:
    blur(20px);

  box-shadow:
    0 25px 80px
    rgba(
      0,
      0,
      0,
      .24
    );
}

.wide {
  grid-column:
    1 / -1;
}

.cardtop {
  display: flex;

  justify-content:
    space-between;

  margin-bottom: 14px;

  color: #686272;

  font-family:
    ui-monospace,
    monospace;

  font-size: 9px;

  letter-spacing:
    .11em;
}

.link {
  display: flex;

  align-items: center;

  gap: 13px;

  padding: 15px;

  border-radius: 16px;

  color: white;

  text-decoration: none;

  background:
    rgba(
      255,
      255,
      255,
      .035
    );

  border:
    1px solid
    transparent;

  transition:
    .2s ease;
}

.link + .link {
  margin-top: 9px;
}

.link:hover {
  transform:
    translateY(-2px);

  background:
    rgba(
      var(--accent-rgb),
      .07
    );

  border-color:
    rgba(
      var(--accent-rgb),
      .3
    );
}

.icon {
  width: 40px;
  height: 40px;

  display: grid;

  place-items: center;

  flex-shrink: 0;

  border-radius: 12px;

  color: #c5a5ff;

  background:
    rgba(
      var(--accent-rgb),
      .12
    );

  font-weight: 950;
}

.link b {
  display: block;

  font-size: 13px;
}

.link small {
  display: block;

  margin-top: 3px;

  color: #716b79;

  font-size: 11px;
}

.arrow {
  margin-left: auto;

  color: #716b79;
}

.stats {
  display: grid;

  grid-template-columns:
    repeat(
      3,
      1fr
    );

  gap: 8px;
}

.stat {
  text-align: center;

  padding: 15px 8px;

  border-radius: 15px;

  background:
    rgba(
      255,
      255,
      255,
      .025
    );
}

.stat strong {
  display: block;

  font-size: 20px;

  letter-spacing:
    -.05em;
}

.stat small {
  display: block;

  margin-top: 5px;

  color: #696371;

  font-family:
    ui-monospace,
    monospace;

  font-size: 8px;

  letter-spacing:
    .1em;
}

.footer {
  text-align: center;

  padding-top: 35px;

  color: #56515e;

  font-family:
    ui-monospace,
    monospace;

  font-size: 9px;

  letter-spacing:
    .08em;
}

.footer a {
  color: #787181;

  text-decoration: none;
}

@media (max-width: 650px) {

  .hero {
    margin-top: 48px;
  }

  .avatar {
    width: 94px;
    height: 94px;

    border-radius: 29px;

    font-size: 37px;
  }

  .content {
    grid-template-columns:
      1fr;
  }

  .wide {
    grid-column:
      auto;
  }

  .stats {
    grid-template-columns:
      1fr 1fr;
  }

  .stat:last-child {
    grid-column:
      1 / -1;
  }

}

@media (
  prefers-reduced-motion: reduce
) {

  *,
  *::before,
  *::after {
    animation: none !important;

    transition: none !important;

    scroll-behavior:
      auto !important;
  }

}

</style>

</head>

<body>

<div class="shell">

<nav class="nav">

<a
  class="brand"
  href="/"
>
VOID<span>.LINK</span>
</a>

<a
  class="navlink"
  href="/"
>
Create yours ↗
</a>

</nav>

<main>

<section class="hero">

<div class="avatar">

${initial}

<i
  class="online"
  title="Live"
></i>

</div>

<h1>
@${username}
</h1>

<div class="url">
void.link/${username}
</div>

<div class="badges">

<span class="badge">
${plan} · CREATOR
</span>

<span class="badge live">
● LIVE
</span>

</div>

<p class="bio">

A creator profile powered by
VOID.LINK — links, socials,
media, widgets, themes and
everything you want your page
to be.

</p>

<div class="actions">

<a
  class="action primary"
  href="/"
>
Claim your own ↗
</a>

<a
  class="action"
  href="#links"
>
Explore ↓
</a>

</div>

</section>

<section
  class="content"
  id="links"
>

<article
  class="card wide"
>

<div class="cardtop">

<span>
LINKS
</span>

<span>
VOID.LINK
</span>

</div>

<a
  class="link"
  href="/"
>

<span class="icon">
✦
</span>

<div>

<b>
Build your own profile
</b>

<small>
Claim a unique handle in seconds.
</small>

</div>

<span class="arrow">
↗
</span>

</a>

<a
  class="link"
  href="/"
>

<span class="icon">
◎
</span>

<div>

<b>
VOID.LINK / ${username}
</b>

<small>
Joined ${escapeHTML(joined)}
</small>

</div>

<span class="arrow">
↗
</span>

</a>

</article>

<article
  class="card wide"
>

<div class="cardtop">

<span>
PROFILE
</span>

<span>
PUBLIC
</span>

</div>

<div class="stats">

<div class="stat">
<strong>
LIVE
</strong>
<small>
STATUS
</small>
</div>

<div class="stat">
<strong>
${plan}
</strong>
<small>
PLAN
</small>
</div>

<div class="stat">
<strong>
∞
</strong>
<small>
POSSIBILITIES
</small>
</div>

</div>

</article>

</section>

</main>

<footer class="footer">

VOID.LINK ·

<a href="/">
your profile, your world.
</a>

</footer>

</div>

</body>

</html>`;
}


function notFoundPage(
  title,
  description
) {

  return `<!doctype html>

<html lang="en">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
/>

<meta
  name="theme-color"
  content="#050509"
/>

<title>
${title} — VOID.LINK
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

  color: white;

  background: #050509;

  font-family:
    system-ui,
    sans-serif;
}

main {
  width:
    min(
      560px,
      100%
    );

  padding: 42px;

  border:
    1px solid
    rgba(
      255,
      255,
      255,
      .1
    );

  border-radius: 28px;

  background:
    rgba(
      17,
      15,
      23,
      .85
    );

  box-shadow:
    0 40px 120px
    rgba(
      0,
      0,
      0,
      .6
    );
}

.logo {
  font-weight: 950;

  letter-spacing:
    -.07em;
}

.logo span {
  color:
    #a66cff;
}

h1 {
  margin-top: 50px;

  font-size:
    clamp(
      42px,
      9vw,
      70px
    );

  line-height: .95;

  letter-spacing:
    -.08em;
}

p {
  color: #96909f;

  line-height: 1.7;
}

a {
  display: inline-flex;

  margin-top: 22px;

  color: #bd9aff;

  text-decoration: none;

  font-weight: 800;
}

</style>

</head>

<body>

<main>

<div class="logo">
VOID<span>.LINK</span>
</div>

<h1>
${title}
</h1>

<p>
${description}
</p>

<a href="/">
← Back to VOID
</a>

</main>

</body>

</html>`;
}


app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `VOID.LINK running on ${HOST}:${PORT}`
    );
  }
);
