import test from 'node:test';
import assert from 'node:assert/strict';
import { validProfilePhoto } from './profile-photo.mjs';
import express from 'express';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
test('avatar format accepts removal and JPEG envelope only', () => {
  assert.equal(validProfilePhoto(''), true);
  assert.equal(validProfilePhoto('data:image/jpeg;base64,/9j/2Q=='), true);
  for (const value of [null, {}, 1, 'https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,aGVsbG8=', 'data:image/jpeg;base64,' + 'A'.repeat(24000)]) {
    assert.equal(validProfilePhoto(value), false);
  }
});

test('profile routes authenticate, validate, persist and preserve photos for older clients', async () => {
  let stored = { id: 'alice', username: 'Alice', bio: '', avatar_color: '#6366f1', avatar_image: '' };
  const queries = [];
  const pool = { async query(sql, params) {
    queries.push({ sql, params });
    if (sql.includes('UPDATE profiles')) {
      stored = { ...stored, username: params[0], bio: params[1], avatar_color: params[2], avatar_image: params[4] ?? stored.avatar_image };
    }
    return { rowCount: 1, rows: [{ ...stored }] };
  } };
  const app = express(); app.use(express.json({ limit: '32kb' }));
  const requireAuth = (req, res, next) => { if (req.headers.authorization !== 'Bearer alice') return res.sendStatus(401); req.user = { id: 'alice' }; next(); };
  // Exercise the actual registered production handlers with an isolated database double.
  const source = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
  const start = source.indexOf("app.get('/api/profiles/:id'");
  const end = source.indexOf('app.', source.indexOf("app.patch('/api/me/profile'") + 10);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(source.slice(start, end), { app, pool, requireAuth, validProfilePhoto, console });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const root = `http://127.0.0.1:${server.address().port}`;
  const photo = 'data:image/jpeg;base64,/9j/2Q==';
  const body = { username: 'Alice', bio: 'Curieuse', avatar_color: '#6366f1', avatar_image: photo };
  const patch = (data, auth = true) => fetch(root + '/api/me/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer alice' } : {}) }, body: JSON.stringify(data) });
  try {
    assert.equal((await patch(body, false)).status, 401);
    assert.equal(queries.length, 0);
    assert.equal((await patch({ ...body, avatar_image: 'https://example.com/avatar' })).status, 400);
    assert.equal(queries.length, 0);
    assert.equal((await patch(body)).status, 200);
    assert.equal(queries.at(-1).params[3], 'alice');
    assert.equal(stored.avatar_image, photo);
    const publicProfile = await (await fetch(root + '/api/profiles/alice')).json();
    assert.equal(publicProfile.profile.avatar_image, photo);
    const { avatar_image, ...oldClient } = body;
    assert.equal((await patch(oldClient)).status, 200);
    assert.equal(stored.avatar_image, photo);
    assert.equal((await patch({ ...body, avatar_image: '' })).status, 200);
    assert.equal(stored.avatar_image, '');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
