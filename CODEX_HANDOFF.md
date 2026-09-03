# CODEX_HANDOFF.md

## Project handoff — BrainteaserDay + TerraScope

Last updated: 2026-09-03

This document gives Codex the operational and architectural context needed to work safely on the user's VPS and the `ValentinSAEZ/mathle` repository.

**Important:** inspect the repository and current server state before changing anything. This handoff summarizes the migration work already completed, but the codebase is the source of truth.

---

# 1. High-level architecture

The VPS currently hosts two separate projects:

1. **TerraScope**
2. **BrainteaserDay**

They share the same VPS and Caddy instance, but their deployment models are different.

```text
                         INTERNET
                            |
              +-------------+-------------+
              |                           |
        terra-scope.online        brainteaserday.com
              |                           |
              |                      React frontend
              |                         Vercel
              |                           |
              |                           v
              |                api.brainteaserday.com
              |                           |
              +-------------+-------------+
                            |
                     OVH VPS
                    51.255.40.75
                            |
                          Caddy
              +-------------+-------------+
              |                           |
              v                           v
  /var/www/terrascope/public      Node/Express API
                                  127.0.0.1:3001
                                         |
                                         v
                                  PostgreSQL local
                                  DB: brainteaserday
```

---

# 2. VPS

Current known VPS characteristics:

- Ubuntu
- 2 vCore
- 4 GB RAM
- 40 GB NVMe
- Location: Gravelines, France
- Public IP: `51.255.40.75`

Do not expose PostgreSQL port `5432` publicly.

---

# 3. Caddy

Caddy serves both projects.

Current conceptual configuration:

```caddy
terra-scope.online {
    root * /var/www/terrascope/public
    try_files {path} {path}.html
    file_server
}

api.brainteaserday.com {
    reverse_proxy 127.0.0.1:3001
}
```

## Safety rule

**Do not break the existing `terra-scope.online` block when modifying Caddy.**

Validate configuration before reload/restart.

Typical commands:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
```

---

# 4. TerraScope

## Deployment model

TerraScope is currently served directly from the VPS as a static site.

Path:

```text
/var/www/terrascope/public
```

Domain:

```text
https://terra-scope.online
```

Caddy serves HTML/CSS/JS/assets directly.

There is no Node/Express backend in the core TerraScope architecture described here.

## Repo

Known GitHub repo:

```text
ValentinSAEZ/terrascope
```

Before changing TerraScope, inspect the repo and the deployed directory separately.

---

# 5. BrainteaserDay

## GitHub

Repository:

```text
ValentinSAEZ/mathle
```

VPS checkout:

```text
/var/www/mathle
```

SSH Git remote is configured and pushes work.

Do not commit `.env`.

---

# 6. BrainteaserDay architecture

Frontend:

```text
brainteaserday.com
```

- React
- Hosted on Vercel

API:

```text
https://api.brainteaserday.com
```

- DNS points to the VPS
- Caddy reverse-proxies to `127.0.0.1:3001`

Backend:

```text
/var/www/mathle/server/index.js
```

- Node.js
- Express
- PostgreSQL via `pg`
- Authentication via JWT
- Password hashing via bcrypt

Database:

```text
PostgreSQL
database: brainteaserday
role: brainteaser
host: localhost
```

---

# 7. systemd

BrainteaserDay API is managed by systemd.

Service:

```text
brainteaserday.service
```

Known conceptual unit configuration:

```ini
WorkingDirectory=/var/www/mathle
EnvironmentFile=/var/www/mathle/.env
ExecStart=/usr/bin/node /var/www/mathle/server/index.js
Restart=always
```

Current service has historically run as `root`.

This should be hardened later by creating a dedicated Linux user.

Useful commands:

```bash
sudo systemctl status brainteaserday
sudo systemctl restart brainteaserday
sudo journalctl -u brainteaserday -n 100 --no-pager
```

API listens only on:

```text
127.0.0.1:3001
```

That is intentional.

---

# 8. Environment variables

The backend `.env` contains sensitive values.

Expected categories include:

```text
DB_PASSWORD
JWT_SECRET
PORT
```

Do not expose their values.

The `.env` file must stay outside Git.

Review file permissions as part of hardening.

---

# 9. Supabase migration status

BrainteaserDay has been migrated away from Supabase.

The active frontend/backend architecture no longer depends on the Supabase client.

The following cleanup was completed:

- Supabase calls removed from active frontend components
- `src/lib/supabaseClient.js` removed
- old legacy `src/components/Profile.js` removed
- `@supabase/supabase-js` removed from dependencies
- `src/App.js.backup` removed
- `AdminPanel.js` migrated away from Supabase
- user/profile/game/forum/race/banner/archive/admin functionality moved to self-hosted API

A recursive search for `supabase` was expected to return no active code references after cleanup.

Before assuming this is still true, verify:

```bash
grep -Rni \
  --exclude-dir=node_modules \
  --exclude-dir=build \
  "supabase" \
  src package.json package-lock.json
```

Expected result:

```text
(no output)
```

---

# 10. Historical data migration

Historical Supabase data was migrated successfully to the VPS PostgreSQL database.

Imported totals:

```text
users               23
profiles             23
attempts            560
user_achievements    91
race_runs            12
forum_posts           2
forum_replies         1
daily_riddles        52
```

The original Supabase UUIDs were preserved.

All 23 password hashes were bcrypt-compatible (`$2a$`, 60 chars), allowing users to retain their old passwords.

The historical administrator account was preserved:

```text
username: Valouzee
is_admin: true
```

Do not alter account UUIDs casually because historical rows depend on them.

---

# 11. Database schema overview

Important tables:

```text
users
profiles
riddles
daily_riddles
riddle_overrides
riddle_schedule
attempts
bans
site_banner
race_settings
race_runs
achievements_catalog
user_achievements
forum_posts
forum_replies
```

`users.id` is UUID.

`profiles.id` references `users(id)`.

Historical foreign key relationships should be preserved.

---

# 12. Daily riddle model

The current game uses **six daily themes**:

```text
arithmetique
finance
general
geometrie
logique
probabilites
```

The normal daily selection is deterministic per theme.

Conceptually:

```text
For each theme:
    active riddles ordered by id
    -> deterministic index based on UTC day
    -> one riddle selected
```

The active daily system is no longer the original Supabase single-riddle-per-day design.

---

# 13. Daily selection precedence

A shared backend daily-selection mechanism was introduced.

For each theme:

```text
Override
   ↓ if absent
Scheduled riddle
   ↓ if absent
Normal deterministic rotation
```

Public endpoints must never expose answers.

Admin endpoints may expose answers.

---

# 14. Override / schedule schema

The old Supabase model had one row per day.

The new self-hosted model is intended to use:

```text
PRIMARY KEY (day_key, theme)
```

for both:

```text
riddle_overrides
riddle_schedule
```

This lets the admin control one theme without affecting all six riddles.

`schema.sql` should reflect this architecture.

Verify before modifying:

```bash
psql -h localhost -U brainteaser -d brainteaserday
```

Then:

```sql
\d riddle_overrides
\d riddle_schedule
```

Expected conceptual primary keys:

```text
(day_key, theme)
```

---

# 15. Important historical archive edge case

One old custom daily riddle existed for:

```text
2025-10-16
```

It was a custom numeric Catalan-path/grid question.

Historical Supabase representation used:

```text
riddle_id = -1
source = override_custom
theme = general
```

The migration preserved this historical item by creating a non-active legacy riddle so it cannot enter normal rotation.

Do not accidentally activate negative-ID historical riddles.

---

# 16. Authentication

Current backend authentication model:

- email/password
- bcrypt hashes
- JWT
- JWT stored client-side in `localStorage`
- JWT is sent in `Authorization: Bearer <token>`

Admin authorization is server-side.

The backend checks `profiles.is_admin`.

A client-visible JWT must never be treated as proof of admin status by itself.

---

# 17. Current auth security debt

The current auth design works, but needs hardening.

Priority improvements:

1. Move JWT from `localStorage` to `HttpOnly`, `Secure`, `SameSite` cookie
2. Add session revocation / logout invalidation
3. Add login/register rate limiting
4. Tighten CORS
5. Add security headers (e.g. Helmet)
6. Add password reset flow
7. Decide whether/how to enforce email verification
8. Consider shorter-lived access sessions

Do not change auth and multiple unrelated systems in one giant commit.

---

# 18. Known backend security issues / TODO

These are important.

## Guess endpoint trusts client-provided day

Current guess route historically accepted:

```text
req.body.day
```

This allows a malicious client to try historical/future submissions.

Recommended fix:

- derive the playable day server-side in UTC
- only allow current UTC day for normal game submissions
- separate any future archive/practice mode from XP-bearing gameplay

## XP parity

The original Supabase XP logic included:

```text
base correct: +10
first attempt: +15
<=3 attempts: +8
<=5 attempts: +3
streak >=7: +5
streak >=30: +10
```

The self-hosted route was known to omit the streak bonuses during an earlier migration step.

Verify the current code before changing.

Do not claim exact behavioral parity until confirmed.

## Duplicate correct submissions

Concurrent requests may potentially create duplicate correct submissions.

Consider a database constraint/unique partial index to enforce one correct solve per:

```text
user_id + day_key + riddle_id
```

## Numeric equality

The Node code historically compared numeric answers using JavaScript `Number`.

PostgreSQL answers use `numeric`.

Be careful with exact decimal behavior if future riddles require precision.

---

# 19. Race mode

Race mode is self-hosted.

Relevant areas include:

- public race settings
- race run submission
- personal race stats
- race leaderboard
- race achievements

Important known weakness:

**Race score is still substantially client-calculated / forgeable unless this has since been hardened.**

Recommended future architecture:

```text
server creates race session
server sends challenge IDs
client submits answers/timing
server calculates score
server persists verified result
```

Do not trust score/duration/attempt counts directly from the browser for competitive ranking.

---

# 20. Forum

Forum was migrated from Supabase to VPS API.

Features include:

- list posts by day
- create posts
- delete own posts
- list replies
- create replies
- delete own replies

Supabase realtime was replaced by polling (historically ~15 seconds).

Deletion logic explicitly handles replies when deleting a post.

Do not reintroduce Supabase realtime.

---

# 21. Profile activity

Profile activity is served through the backend.

It aggregates:

- daily completion history
- recent race runs
- recent achievements

Relevant conceptual route:

```text
GET /api/profiles/:id/activity
```

Inspect current implementation before changing UI assumptions.

---

# 22. Banner

Site banner is self-hosted.

Public read:

```text
GET /api/banner
```

Admin write:

```text
PUT /api/admin/banner
```

Frontend historically polls periodically and listens for a local event such as:

```text
mathle:banner-updated
```

---

# 23. Admin panel

Admin panel is self-hosted.

Main functional areas:

```text
Dashboard
Daily riddles / override
Riddle library
Users / bans
Banner
Race mode
Schedule
```

Admin routes use:

```text
requireAuth
requireAdmin
```

Do not rely on frontend visibility to protect admin actions.

---

# 24. Important API routes

Inspect `server/index.js` for the exact current route list.

Known routes include:

```text
GET  /api/health

POST /api/auth/register
POST /api/auth/login
GET  /api/me

GET   /api/profile
PATCH /api/profile
PUT/PATCH password endpoint (inspect exact route)

GET  /api/riddles/today
GET  /api/riddles/today/history
POST /api/riddles/:id/guess

GET /api/me/game-status

GET /api/leaderboard/general
GET /api/leaderboard/category
GET /api/leaderboard/race

GET /api/stats/today

GET  /api/me/race-stats
GET  /api/me/race-best
POST /api/race-runs
GET  /api/race-settings

GET /api/archive

GET    /api/forum/posts
POST   /api/forum/posts
DELETE /api/forum/posts/:id

GET    /api/forum/posts/:id/replies
POST   /api/forum/posts/:id/replies
DELETE /api/forum/replies/:id

GET /api/profiles/:id/activity

GET /api/banner
PUT /api/admin/banner

GET  /api/admin/dashboard
GET  /api/admin/riddles/today
GET  /api/admin/riddles
POST /api/admin/riddles

GET /api/admin/users
PUT /api/admin/users/:id/ban

PUT /api/admin/race-settings

GET    /api/admin/overrides
PUT    /api/admin/overrides/:theme
DELETE /api/admin/overrides/:theme

GET    /api/admin/schedule
PUT    /api/admin/schedule/:theme
DELETE /api/admin/schedule/:theme
```

Do not assume method/path names are exact without checking the current file.

---

# 25. CORS

Historically the API used permissive:

```js
cors()
```

This should be restricted.

Recommended allowlist should include only required production/dev origins, for example:

```text
https://brainteaserday.com
https://www.brainteaserday.com
localhost development origin if needed
```

Check actual Vercel domain usage before enforcing.

---

# 26. PostgreSQL exposure

PostgreSQL should stay bound locally / firewalled.

Expected application connection:

```text
Node -> localhost:5432
```

Do not open PostgreSQL to the public internet just to simplify development.

Use SSH tunneling if remote DB administration becomes necessary.

---

# 27. Linux/service hardening TODO

BrainteaserDay systemd service historically ran as root.

Recommended:

1. create dedicated service user, e.g. `brainteaser`
2. make `/var/www/mathle` ownership/permissions appropriate
3. restrict `.env` permissions
4. run Node as dedicated user
5. add systemd sandboxing options where reasonable
6. ensure write access exists only where needed

Do this carefully; don't change ownership recursively without first checking Git/deployment requirements.

---

# 28. Backups

A PostgreSQL backup was created during migration.

Historical backup location used:

```text
/root/brainteaser-backups/
```

Before schema/auth/security changes, create a new backup.

Example:

```bash
sudo -u postgres pg_dump brainteaserday \
  | sudo tee /root/brainteaser-backups/pre-change.sql >/dev/null
```

Verify it is non-zero before proceeding.

Prefer timestamped filenames for future backups.

---

# 29. Git workflow

Repository is public.

Rules:

- never commit `.env`
- never commit DB passwords
- never commit JWT secrets
- never commit user password hashes
- never commit private migration exports
- never commit import CSVs if they contain riddle answers or private data

Recommended flow:

```bash
cd /var/www/mathle
git status
git pull --ff-only
# make change
npm run build
git diff
git add <specific files>
git commit -m "..."
git push origin main
```

Avoid broad destructive resets.

---

# 30. Riddle source data

The migrated riddle library contains approximately 325 active riddles.

Historical counts by theme were:

```text
arithmetique     48
finance          70
general          80
geometrie        44
logique          42
probabilites     41
TOTAL           325
```

IDs historically spanned roughly 2–327 with one missing ID.

Do not assume IDs are contiguous.

The public API must never return answer fields.

---

# 31. Archive caveat

`daily_riddles` represents the old single-riddle-per-day archive model.

The current live game uses six riddles/day.

Do not silently reinterpret old archive rows as six-theme historical days.

Preserve old data faithfully unless a deliberate archive migration is designed.

---

# 32. Things Codex should NOT do automatically

Do not:

- expose PostgreSQL publicly
- rewrite Caddy without preserving TerraScope
- delete historical rows
- regenerate user UUIDs
- reset user passwords
- commit secrets
- trust frontend admin flags
- trust race scores from the client
- convert all auth/security architecture in one unreviewed change
- run destructive Git commands (`reset --hard`, reclone, etc.) without explicit need
- blindly replace schema without backing up PostgreSQL
- delete old archive semantics just because the live game now has six riddles/day

---

# 33. Recommended next work order

Codex should first inspect the repo and confirm which TODOs are still present.

## Phase 1 — Safe security wins

1. Verify `.env` is ignored and permissions are restrictive
2. Restrict CORS
3. Add Helmet
4. Add rate limiting to login/register
5. Validate request payload limits
6. Confirm API is bound only to localhost

## Phase 2 — Gameplay integrity

1. Fix guess endpoint so playable day is server-derived
2. Confirm exact XP formula parity
3. Add DB protection against duplicate correct submissions
4. Review numeric answer comparison

## Phase 3 — Authentication hardening

1. Design HttpOnly cookie auth
2. Add logout/session invalidation
3. Add password reset
4. Decide email verification policy

## Phase 4 — Race integrity

Move race scoring to server-verified sessions.

## Phase 5 — Service hardening

Run Node as a dedicated Linux user and tighten systemd permissions.

---

# 34. Suggested first Codex prompt

Use this after placing this file in the repo:

```text
Read CODEX_HANDOFF.md completely.

Then inspect the repository, especially:
- server/index.js
- schema.sql
- package.json
- src/App.js
- src/components/AdminPanel.js
- src/components/Game.js
- src/components/Auth.js
- src/components/RaceGame.js
- src/components/ProfilePage.js
- src/components/ForumPage.js

Do not modify anything yet.

First produce:
1. a concise architecture summary,
2. a list of which handoff statements are confirmed by the current code,
3. any discrepancies between the handoff and the repository,
4. the top 5 remaining security/integrity risks,
5. a proposed sequence of small, reversible commits.

Do not expose secrets and do not propose destructive commands unless necessary.
```

---

# 35. Operational philosophy

The user is not a professional developer and has built the project with AI assistance.

Therefore:

- prefer exact, ordered commands
- explain what a command changes before using it
- prefer small reversible changes
- validate before restart
- build before push
- back up before DB/schema changes
- avoid unnecessary reclones/resets
- avoid changing several infrastructure layers simultaneously
- when uncertain, inspect first instead of guessing

The project is functioning in production, so reliability is more important than aggressive refactoring.
