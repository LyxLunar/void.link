# VOID.LINK 2.0

A polished creator-profile starter with **real handle claiming** and a **proper server-protected Founder dashboard**.

## What is fixed / improved

- Founder is **removed from the public plans**.
- Founder access is now a separate `/founder` login.
- First launch automatically guides you through founder password setup.
- Founder password is stored as a salted `scrypt` hash in `data/founder.json` — never in browser JavaScript.
- HttpOnly, SameSite founder session cookie.
- Protected founder APIs for stats, user listing and handle deletion.
- Dashboard shows total users + Free/Plus/Pro distribution.
- Search claimed handles by username or plan.
- Public handle claiming still persists to `data/users.json`.
- Live handle availability checking still works.
- Short handles (1–2 chars) still work.
- `/api/health` now reports whether founder setup is complete.
- Cleaner public navigation with a real Founder login entry.
- Node 18+ compatibility.

## Start it — easiest way

### Windows

1. Install Node.js 18+.
2. Extract this ZIP.
3. Open the extracted folder.
4. Double-click `start-windows.bat`.
5. Open **http://localhost:3000** in your browser.

If double-clicking the batch file closes immediately, open PowerShell in the project folder and run:

```powershell
npm install
npm start
```

### macOS / Linux

From the project folder:

```bash
chmod +x start.sh
./start.sh
```

Or:

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

## Founder login

On the first run, open:

**http://localhost:3000/founder**

You'll be redirected to first-time setup. Create a strong password of at least 12 characters. After setup, you go straight into the dashboard.

On later launches, use the same `/founder` page to log in.

### Resetting the Founder password

Stop the server, delete:

```text
data/founder.json
```

Start the server again and complete first-time setup again.

**Do not delete `data/users.json` unless you intentionally want to erase all claimed handles.**

## Important production note

This is a strong local/starter implementation, not a finished payment/authentication stack for a public production service. Before taking real payments or opening admin access to the internet, add a production database, HTTPS, rate limiting, CSRF protection, password reset/recovery, audit logs and a real payment provider.

## Project structure

```text
index.html              public landing page
styles.css              public styles
script.js               public interactions
server.js               Express server + auth + APIs
founder-login.html      Founder login
founder-setup.html      First-run founder setup
founder-dashboard.html  Protected Founder dashboard
data/users.json         Claimed handles
data/founder.json       Salted founder password hash
start-windows.bat       One-click Windows launcher
start.sh                macOS/Linux launcher
```
