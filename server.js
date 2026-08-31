app.post("/api/handles", (req, res) => {
const username = clean(req.body.username);
const plan = clean(req.body.plan) || "free";

if (!valid(username)) {
return res.status(400).json({
error:
"Handle must be 1–24 characters: a-z, 0-9, dot, underscore or hyphen."
});
}

if (RESERVED.has(username)) {
return res.status(409).json({
error: "That handle is reserved."
});
}

if (!PLANS.has(plan)) {
return res.status(400).json({
error: "Choose a valid public plan."
});
}

const db = readDB();

const existingUser = db.users.find(
(user) => user.username === username
);

if (existingUser) {
return res.status(409).json({
error: "That handle is already claimed."
});
}

const user = {
id: crypto.randomUUID(),
username,
role: "user",
plan,
createdAt: new Date().toISOString()
};

db.users.push(user);

writeJSON(DB, db);

return res.status(201).json({
ok: true,
user,
profileUrl: `/u/${encodeURIComponent(username)}`
});
});
