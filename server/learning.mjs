import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { makeExercise, gradeExercise } from './practice.mjs';

export function createLearningRouter({ pool, requireAuth, secret, generate = makeExercise }) {
  const router = Router();
  router.use(requireAuth);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'Un instant ! Réessaie dans une minute.' }) }));

  router.get('/notebook', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT a.riddle_id, a.day_key::text AS day, r.question, r.theme,
          COUNT(*) FILTER (WHERE a.result <> 'correct')::int AS errors,
          BOOL_OR(a.result = 'correct') AS solved
        FROM attempts a JOIN riddles r ON r.id = a.riddle_id
        WHERE a.user_id = $1
        GROUP BY a.riddle_id, a.day_key, r.question, r.theme
        HAVING COUNT(*) FILTER (WHERE a.result <> 'correct') > 0
        ORDER BY a.day_key DESC, a.riddle_id DESC LIMIT 50`, [req.user.id]);
      res.json({ entries: result.rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Le carnet est temporairement indisponible.' });
    }
  });

  router.get('/corrections/:id', async (req, res) => {
    const id = Number(req.params.id);
    const day = String(req.query.day || '');
    if (!Number.isSafeInteger(id) || !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) {
      return res.status(400).json({ error: 'Énigme ou date invalide.' });
    }
    try {
      // Gate the explanation on this user's solve for this exact day.
      const result = await pool.query(`SELECT r.explanation FROM riddles r
        WHERE r.id = $1 AND EXISTS (SELECT 1 FROM attempts a
          WHERE a.riddle_id = r.id AND a.user_id = $2 AND a.day_key = $3::date
          AND a.result = 'correct')`, [id, req.user.id, day]);
      if (!result.rowCount) return res.status(403).json({ error: "Résous d'abord cette énigme pour consulter sa correction." });
      res.json({ explanation: result.rows[0].explanation || null });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Correction temporairement indisponible.' });
    }
  });

  router.post('/practice', (req, res) => {
    try {
      const exercise = generate(req.body?.theme, req.body?.level);
      // JWT payloads are readable: encrypt the exercise before signing it.
      const ticket = sealExercise(exercise, req.user.id, secret);
      res.json({ question: exercise.question, theme: exercise.theme, level: exercise.level, ticket });
    } catch {
      res.status(400).json({ error: 'Choisis une catégorie et un niveau valides.' });
    }
  });

  router.post('/practice/answer', (req, res) => {
    try {
      const exercise = openExercise(req.body?.ticket, req.user.id, secret);
      res.json(gradeExercise(exercise, req.body?.guess));
    } catch {
      res.status(400).json({ error: "Réponse invalide ou exercice expiré. Saisis un nombre ou démarre un nouvel exercice." });
    }
  });
  return router;
}

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
const key = secret => createHash('sha256').update(`mathle-practice-v1:${secret}`).digest();
const signingKey = secret => createHash('sha256').update(`mathle-practice-sign-v1:${secret}`).digest();

export function sealExercise(exercise, userId, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(exercise), 'utf8'), cipher.final()]);
  return jwt.sign({ data: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url') }, signingKey(secret),
    { algorithm: 'HS256', subject: userId, audience: 'mathle-practice', expiresIn: '30m' });
}

export function openExercise(ticket, userId, secret) {
  if (typeof ticket !== 'string' || ticket.length > 8192) throw new Error('Invalid ticket');
  const payload = jwt.verify(ticket, signingKey(secret), { algorithms: ['HS256'], subject: userId, audience: 'mathle-practice' });
  const bytes = Buffer.from(payload.data, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key(secret), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'));
}
