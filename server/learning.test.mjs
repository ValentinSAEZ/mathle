import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { makeExercise, gradeExercise, themes } from './practice.mjs';
import { createLearningRouter, sealExercise, openExercise } from './learning.mjs';

test('all six templates and levels accept their answers and explain them', () => {
  for (const theme of themes) for (const level of [1, 2, 3]) for (let i = 0; i < 50; i++) {
    const exercise = makeExercise(theme, level);
    assert.ok(exercise.question.length > 0);
    assert.ok(exercise.explanation.length > 20);
    assert.equal(gradeExercise(exercise, String(exercise.answer).replace('.', ',')).correct, true);
    assert.equal(gradeExercise(exercise, String(exercise.answer + 1)).correct, false);
  }
  assert.throws(() => makeExercise('unknown', 1));
  assert.throws(() => makeExercise('finance', 4));
  for (const guess of ['', ' ', 'Infinity', '0x10', '1/2', {}, '1'.repeat(65)]) {
    assert.throws(() => gradeExercise({ answer: 1 }, guess));
  }
});

test('known template examples match independently calculated answers', () => {
  const expected = { arithmetique: 6, finance: 36, general: 8, geometrie: 4, logique: 18, probabilites: 10 };
  for (const theme of themes) assert.equal(makeExercise(theme, 2, () => 2).answer, expected[theme]);
});

test('practice tickets are encrypted, bound to a user and cannot be forged or expired', () => {
  const secret = 'local-test-secret';
  const exercise = makeExercise('arithmetique', 1);
  const ticket = sealExercise(exercise, 'alice', secret);
  assert.deepEqual(openExercise(ticket, 'alice', secret), exercise);
  const decoded = jwt.decode(ticket);
  assert.equal(decoded.answer, undefined);
  assert.equal(decoded.question, undefined);
  assert.throws(() => openExercise(ticket, 'bob', secret));
  assert.throws(() => openExercise(ticket, 'alice', 'different'));
  assert.throws(() => jwt.verify(ticket, secret)); // Cannot become an authentication token.
  assert.throws(() => openExercise(ticket.slice(0, -5) + 'ABCDE', 'alice', secret));
  const signingKey = createHash('sha256').update(`mathle-practice-sign-v1:${secret}`).digest();
  const expired = jwt.sign({ data: decoded.data }, signingKey, { subject: 'alice', audience: 'mathle-practice', expiresIn: -1 });
  assert.throws(() => openExercise(expired, 'alice', secret));
});

test('service worker does not intercept private APIs or cross-origin traffic', () => {
  const handlers = {};
  const self = { registration: { scope: 'https://brainteaserday.com/' }, addEventListener: (name, fn) => { handlers[name] = fn; } };
  vm.runInNewContext(readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8'), { self, URL });
  for (const url of ['https://api.brainteaserday.com/api/me', 'https://brainteaserday.com/api/learning/notebook', 'https://thirdparty.test/logo.png']) {
    let intercepted = false;
    handlers.fetch({ request: { url, method: 'GET', headers: new Headers(), destination: '' }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
});

test('learning API authenticates, scopes queries and withholds unsolved corrections', async () => {
  const queries = [];
  const pool = { query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('SELECT r.explanation')) return params[1] === 'alice' ? { rowCount: 1, rows: [{ explanation: 'Une méthode.' }] } : { rowCount: 0, rows: [] };
    return { rows: [] };
  } };
  const app = express(); app.use(express.json());
  app.use('/api/learning', createLearningRouter({ pool, secret: 'test', requireAuth: (req, res, next) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.user = { id: req.headers.authorization }; next();
  } }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const root = `http://127.0.0.1:${server.address().port}/api/learning`;
  const call = (path, user, body) => fetch(root + path, { method: body ? 'POST' : 'GET', headers: { ...(user ? { authorization: user } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await call('/notebook')).status, 401);
    assert.equal((await call('/notebook?user_id=bob', 'alice')).status, 200);
    assert.deepEqual(queries.at(-1).params, ['alice']);
    assert.equal((await call('/corrections/1?day=2026-09-06', 'bob')).status, 403);
    const correction = await call('/corrections/1?day=2026-09-06', 'alice');
    assert.equal(correction.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await correction.json(), { explanation: 'Une méthode.' });
    assert.equal((await call('/corrections/1?day=2026-02-30', 'alice')).status, 400);
    const generated = await (await call('/practice', 'alice', { theme: 'finance', level: 1 })).json();
    assert.equal(generated.answer, undefined); assert.equal(generated.explanation, undefined);
    assert.equal((await call('/practice/answer', 'bob', { ticket: generated.ticket, guess: '10' })).status, 400);
    const exercise = openExercise(generated.ticket, 'alice', 'test');
    const graded = await (await call('/practice/answer', 'alice', { ticket: generated.ticket, guess: String(exercise.answer) })).json();
    assert.equal(graded.correct, true);
    assert.ok(queries.every(({ sql }) => !/INSERT|UPDATE|DELETE/.test(sql)));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
