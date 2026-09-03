import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'brainteaserday',
  user: 'brainteaser',
  password: process.env.DB_PASSWORD,
});

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3001;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET manquant dans .env');
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const token = authHeader.slice(7);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({
      ok: true,
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email et mot de passe requis.',
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 8 caractères.',
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rowCount > 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error: 'Un compte existe déjà avec cet email.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, created_at
      `,
      [normalizedEmail, passwordHash]
    );

    const user = userResult.rows[0];

    await client.query(
      `
      INSERT INTO profiles (id, username)
      VALUES ($1, $2)
      `,
      [user.id, username?.trim() || null]
    );

    await client.query('COMMIT');

    const token = createToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: username?.trim() || null,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Email ou nom utilisateur déjà utilisé.',
      });
    }

    console.error(error);

    res.status(500).json({
      error: 'Erreur lors de la création du compte.',
    });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email et mot de passe requis.',
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.email,
        u.password_hash,
        p.username,
        p.is_admin,
        p.bio,
        p.avatar_color,
        p.xp
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      WHERE u.email = $1
      `,
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect.',
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect.',
      });
    }

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        is_admin: user.is_admin,
        bio: user.bio,
        avatar_color: user.avatar_color,
        xp: user.xp,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Erreur lors de la connexion.',
    });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.email,
        u.created_at,
        p.username,
        p.is_admin,
        p.bio,
        p.avatar_color,
        p.xp
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = $1
      `,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Utilisateur introuvable.',
      });
    }

    res.json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Erreur serveur.',
    });
  }
});

// ─────────────────────────────────────────────
// PROFILS
// ─────────────────────────────────────────────

// Profil public d'un utilisateur
app.get('/api/profiles/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        username,
        created_at,
        is_admin,
        bio,
        avatar_color,
        xp
      FROM profiles
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Profil introuvable.',
      });
    }

    res.json({
      profile: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Erreur lors du chargement du profil.',
    });
  }
});


// Modifier son propre profil
app.patch('/api/me/profile', requireAuth, async (req, res) => {
  const { username, bio, avatar_color } = req.body;

  const cleanUsername = String(username || '').trim();
  const cleanBio = String(bio || '').trim();
  const cleanColor = String(avatar_color || '#6366f1').trim();

  if (!cleanUsername) {
    return res.status(400).json({
      error: "Le nom d'utilisateur est requis.",
    });
  }

  if (cleanUsername.length > 50) {
    return res.status(400).json({
      error: "Le nom d'utilisateur est trop long.",
    });
  }

  if (cleanBio.length > 200) {
    return res.status(400).json({
      error: 'La bio ne peut pas dépasser 200 caractères.',
    });
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(cleanColor)) {
    return res.status(400).json({
      error: "Couleur d'avatar invalide.",
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE profiles
      SET
        username = $1,
        bio = $2,
        avatar_color = $3
      WHERE id = $4
      RETURNING
        id,
        username,
        created_at,
        is_admin,
        bio,
        avatar_color,
        xp
      `,
      [
        cleanUsername,
        cleanBio,
        cleanColor,
        req.user.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Profil introuvable.',
      });
    }

    res.json({
      profile: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: "Ce nom d'utilisateur est déjà utilisé.",
      });
    }

    console.error(error);

    res.status(500).json({
      error: "Impossible d'enregistrer le profil.",
    });
  }
});


// Changer son mot de passe
app.post('/api/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: 'Mot de passe actuel et nouveau mot de passe requis.',
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT password_hash
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Utilisateur introuvable.',
      });
    }

    const valid = await bcrypt.compare(
      currentPassword,
      result.rows[0].password_hash
    );

    if (!valid) {
      return res.status(401).json({
        error: 'Mot de passe actuel incorrect.',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      `,
      [newHash, req.user.id]
    );

    res.json({
      ok: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de modifier le mot de passe.',
    });
  }
});

// ─────────────────────────────────────────────
// ÉNIGMES DU JOUR
// ─────────────────────────────────────────────

app.get('/api/riddles/today', async (req, res) => {
  const requestedDay = String(req.query.day || '').trim();

  const day =
    requestedDay ||
    new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return res.status(400).json({
      error: 'Date invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      WITH ranked AS (
        SELECT
          id AS riddle_id,
          type,
          question,
          theme,
          row_number() OVER (
            PARTITION BY theme
            ORDER BY id
          ) AS rn,
          count(*) OVER (
            PARTITION BY theme
          ) AS cnt
        FROM riddles
        WHERE active = true
      )
      SELECT
        riddle_id,
        type,
        question,
        theme
      FROM ranked
      WHERE rn = (
        mod(
          ($1::date - DATE '1970-01-01')::int,
          cnt::int
        ) + 1
      )::bigint
      ORDER BY theme
      `,
      [day]
    );

    res.json({
      day_key: day,
      riddles: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de charger les énigmes du jour.',
    });
  }
});

// ─────────────────────────────────────────────
// ÉTAT DU JOUEUR
// ─────────────────────────────────────────────

app.get('/api/me/game-status', requireAuth, async (req, res) => {
  try {
    const profileResult = await pool.query(
      `
      SELECT username, xp
      FROM profiles
      WHERE id = $1
      `,
      [req.user.id]
    );

    const banResult = await pool.query(
      `
      SELECT banned
      FROM bans
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    const attemptsResult = await pool.query(
      `
      SELECT DISTINCT day_key
      FROM attempts
      WHERE user_id = $1
        AND result = 'correct'
        AND day_key >= (CURRENT_DATE - INTERVAL '60 days')::date
      ORDER BY day_key DESC
      `,
      [req.user.id]
    );

    const solvedDays = new Set(
      attemptsResult.rows.map(row => String(row.day_key).slice(0, 10))
    );

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - i
      ));

      const key = d.toISOString().slice(0, 10);

      if (solvedDays.has(key)) {
        streak += 1;
      } else {
        break;
      }
    }

    res.json({
      username: profileResult.rows[0]?.username || null,
      xp: profileResult.rows[0]?.xp || 0,
      banned: Boolean(banResult.rows[0]?.banned),
      streak,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de charger les informations du joueur.',
    });
  }
});


// ─────────────────────────────────────────────
// HISTORIQUE DES TENTATIVES DU JOUR
// ─────────────────────────────────────────────

app.get('/api/riddles/today/history', requireAuth, async (req, res) => {
  const day = String(
    req.query.day || new Date().toISOString().slice(0, 10)
  );

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return res.status(400).json({
      error: 'Date invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        riddle_id,
        created_at,
        guess,
        result
      FROM attempts
      WHERE user_id = $1
        AND day_key = $2::date
      ORDER BY created_at DESC
      `,
      [req.user.id, day]
    );

    res.json({
      attempts: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Impossible de charger l'historique.",
    });
  }
});


// ─────────────────────────────────────────────
// SOUMETTRE UNE RÉPONSE
// ─────────────────────────────────────────────

app.post('/api/riddles/:id/guess', requireAuth, async (req, res) => {
  const riddleId = Number(req.params.id);
  const day = String(
    req.body.day || new Date().toISOString().slice(0, 10)
  );
  const guess = String(req.body.guess || '').trim();

  if (!Number.isInteger(riddleId) || riddleId <= 0) {
    return res.status(400).json({
      error: 'Énigme invalide.',
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return res.status(400).json({
      error: 'Date invalide.',
    });
  }

  if (!guess) {
    return res.status(400).json({
      error: 'Réponse requise.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Bannissement
    const banResult = await client.query(
      `
      SELECT banned
      FROM bans
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    if (banResult.rows[0]?.banned) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        error: 'Ton compte est banni.',
      });
    }

    // Vérifier que l'énigme est réellement celle sélectionnée
    // pour ce thème et ce jour.
    const riddleResult = await client.query(
      `
      WITH ranked AS (
        SELECT
          id,
          type,
          answer_text,
          answer_number,
          theme,
          row_number() OVER (
            PARTITION BY theme
            ORDER BY id
          ) AS rn,
          count(*) OVER (
            PARTITION BY theme
          ) AS cnt
        FROM riddles
        WHERE active = true
      )
      SELECT
        id,
        type,
        answer_text,
        answer_number,
        theme
      FROM ranked
      WHERE id = $1
        AND rn = (
          mod(
            ($2::date - DATE '1970-01-01')::int,
            cnt::int
          ) + 1
        )::bigint
      `,
      [riddleId, day]
    );

    if (riddleResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: "Cette énigme n'est pas celle du jour.",
      });
    }

    // Déjà résolue ?
    const solvedResult = await client.query(
      `
      SELECT 1
      FROM attempts
      WHERE user_id = $1
        AND day_key = $2::date
        AND riddle_id = $3
        AND result = 'correct'
      LIMIT 1
      `,
      [req.user.id, day, riddleId]
    );

    if (solvedResult.rowCount > 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error: 'already solved',
      });
    }

    // Rate limiting identique à l'ancien système
    const rateResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM attempts
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '10 seconds'
      `,
      [req.user.id]
    );

    if (rateResult.rows[0].count > 5) {
      await client.query('ROLLBACK');

      return res.status(429).json({
        error: 'rate limited',
      });
    }

    const riddle = riddleResult.rows[0];

    let result;

    if (riddle.type === 'number') {
      const numericGuess = Number(guess);

      if (!Number.isFinite(numericGuess)) {
        result = 'wrong';
      } else {
        const answer = Number(riddle.answer_number);

        if (numericGuess === answer) {
          result = 'correct';
        } else if (numericGuess < answer) {
          result = 'low';
        } else {
          result = 'high';
        }
      }
    } else {
      const normalize = (value) =>
        String(value || '')
          .replace(/\s+/g, '')
          .toLowerCase();

      result =
        normalize(guess) === normalize(riddle.answer_text)
          ? 'correct'
          : 'wrong';
    }

    await client.query(
      `
      INSERT INTO attempts (
        user_id,
        day_key,
        riddle_id,
        guess,
        result
      )
      VALUES ($1, $2::date, $3, $4, $5)
      `,
      [
        req.user.id,
        day,
        riddleId,
        guess.slice(0, 128),
        result,
      ]
    );

    let xpGained = 0;
    let newXp = null;

    if (result === 'correct') {
      const attemptsCount = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM attempts
        WHERE user_id = $1
          AND day_key = $2::date
          AND riddle_id = $3
        `,
        [req.user.id, day, riddleId]
      );

      const count = attemptsCount.rows[0].count;

      xpGained = 10;

      if (count === 1) {
        xpGained += 15;
      } else if (count <= 3) {
        xpGained += 8;
      } else if (count <= 5) {
        xpGained += 3;
      }

      const xpResult = await client.query(
        `
        UPDATE profiles
        SET xp = xp + $1
        WHERE id = $2
        RETURNING xp
        `,
        [xpGained, req.user.id]
      );

      newXp = xpResult.rows[0]?.xp ?? null;
    }

    await client.query('COMMIT');

    res.json({
      result,
      xp_gained: xpGained,
      xp: newXp,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error(error);

    res.status(500).json({
      error: "Erreur lors de l'enregistrement.",
    });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// CLASSEMENTS
// ─────────────────────────────────────────────

function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}


// Classement général du jour
app.get('/api/leaderboard/general', async (req, res) => {
  const day = String(
    req.query.day || new Date().toISOString().slice(0, 10)
  );

  if (!validDay(day)) {
    return res.status(400).json({ error: 'Date invalide.' });
  }

  try {
    const result = await pool.query(
      `
      WITH ranked AS (
        SELECT
          id AS riddle_id,
          theme,
          row_number() OVER (
            PARTITION BY theme
            ORDER BY id
          ) AS rn,
          count(*) OVER (
            PARTITION BY theme
          ) AS cnt
        FROM riddles
        WHERE active = true
      ),
      daily_riddle_ids AS (
        SELECT riddle_id
        FROM ranked
        WHERE rn = (
          mod(
            ($1::date - DATE '1970-01-01')::int,
            cnt::int
          ) + 1
        )::bigint
      ),
      agg AS (
        SELECT
          a.user_id,
          COUNT(
            DISTINCT CASE
              WHEN a.result = 'correct'
              THEN a.riddle_id
            END
          )::int AS riddles_solved,
          COUNT(*)::int AS total_attempts
        FROM attempts a
        WHERE a.day_key = $1::date
          AND a.riddle_id IN (
            SELECT riddle_id
            FROM daily_riddle_ids
          )
        GROUP BY a.user_id
      )
      SELECT
        agg.user_id,
        COALESCE(p.username, '') AS username,
        agg.riddles_solved,
        agg.total_attempts
      FROM agg
      LEFT JOIN profiles p
        ON p.id = agg.user_id
      ORDER BY
        agg.riddles_solved DESC,
        agg.total_attempts ASC,
        COALESCE(p.username, '') ASC
      LIMIT 15
      `,
      [day]
    );

    res.json({ rows: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Classement indisponible.',
    });
  }
});


// Classement d'une catégorie
app.get('/api/leaderboard/category', async (req, res) => {
  const day = String(
    req.query.day || new Date().toISOString().slice(0, 10)
  );

  const theme = String(req.query.theme || '').trim();

  if (!validDay(day)) {
    return res.status(400).json({ error: 'Date invalide.' });
  }

  if (!theme) {
    return res.status(400).json({ error: 'Thème requis.' });
  }

  try {
    const result = await pool.query(
      `
      WITH ranked AS (
        SELECT
          id AS riddle_id,
          theme,
          row_number() OVER (
            PARTITION BY theme
            ORDER BY id
          ) AS rn,
          count(*) OVER (
            PARTITION BY theme
          ) AS cnt
        FROM riddles
        WHERE active = true
      ),
      daily_riddle AS (
        SELECT riddle_id
        FROM ranked
        WHERE theme = $2
          AND rn = (
            mod(
              ($1::date - DATE '1970-01-01')::int,
              cnt::int
            ) + 1
          )::bigint
        LIMIT 1
      ),
      agg AS (
        SELECT
          a.user_id,
          COUNT(*)::int AS attempts,
          bool_or(a.result = 'correct') AS solved,
          MIN(a.created_at) AS first_attempt,
          MIN(
            CASE
              WHEN a.result = 'correct'
              THEN a.created_at
            END
          ) AS solved_at
        FROM attempts a
        WHERE a.day_key = $1::date
          AND a.riddle_id = (
            SELECT riddle_id
            FROM daily_riddle
          )
        GROUP BY a.user_id
      )
      SELECT
        agg.user_id,
        COALESCE(p.username, '') AS username,
        agg.attempts,

        CASE
          WHEN agg.solved
            AND agg.solved_at IS NOT NULL
            AND agg.first_attempt IS NOT NULL
          THEN EXTRACT(
            EPOCH FROM (
              agg.solved_at - agg.first_attempt
            )
          )::int
          ELSE NULL
        END AS time_to_solve_seconds,

        agg.solved

      FROM agg

      LEFT JOIN profiles p
        ON p.id = agg.user_id

      ORDER BY
        agg.solved DESC,
        agg.attempts ASC,
        CASE
          WHEN agg.solved
            AND agg.solved_at IS NOT NULL
          THEN EXTRACT(
            EPOCH FROM (
              agg.solved_at - agg.first_attempt
            )
          )::int
          ELSE 999999
        END ASC,
        COALESCE(p.username, '') ASC

      LIMIT 15
      `,
      [day, theme]
    );

    res.json({ rows: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Classement indisponible.',
    });
  }
});


// Classement Course
app.get('/api/leaderboard/race', async (req, res) => {
  const level = String(req.query.level || 'med');
  const duration = Number(req.query.duration || 60);

  if (!['easy', 'med', 'hard'].includes(level)) {
    return res.status(400).json({
      error: 'Niveau invalide.',
    });
  }

  if (![30, 60, 120].includes(duration)) {
    return res.status(400).json({
      error: 'Durée invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      WITH best_runs AS (
        SELECT DISTINCT ON (rr.user_id)
          rr.user_id,
          rr.score,

          CASE
            WHEN rr.attempts > 0
            THEN ROUND(
              (rr.score::numeric / rr.attempts) * 100
            )::int
            ELSE 0
          END AS accuracy,

          (rr.created_at AT TIME ZONE 'UTC')::date AS run_date

        FROM race_runs rr

        WHERE rr.level = $1
          AND rr.duration = $2

        ORDER BY
          rr.user_id,
          rr.score DESC,
          rr.created_at DESC
      )

      SELECT
        br.user_id,
        COALESCE(p.username, '') AS username,
        br.score,
        br.accuracy,
        br.run_date

      FROM best_runs br

      LEFT JOIN profiles p
        ON p.id = br.user_id

      ORDER BY br.score DESC

      LIMIT 15
      `,
      [level, duration]
    );

    res.json({ rows: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Classement course indisponible.',
    });
  }
});


// ─────────────────────────────────────────────
// STATS DU JOUR
// ─────────────────────────────────────────────

app.get('/api/stats/today', async (req, res) => {
  try {
    const result = await pool.query(
      `
      WITH params AS (
        SELECT
          (NOW() AT TIME ZONE 'UTC')::date AS d
      ),

      players AS (
        SELECT DISTINCT a.user_id
        FROM attempts a, params
        WHERE a.day_key = params.d
      ),

      solvers AS (
        SELECT DISTINCT a.user_id
        FROM attempts a, params
        WHERE a.day_key = params.d
          AND a.result = 'correct'
      ),

      attempts_to_success AS (
        SELECT
          s.user_id,

          (
            SELECT COUNT(*)::int
            FROM attempts x, params
            WHERE x.user_id = s.user_id
              AND x.day_key = params.d
              AND x.created_at <= (
                SELECT MIN(y.created_at)
                FROM attempts y, params
                WHERE y.user_id = s.user_id
                  AND y.day_key = params.d
                  AND y.result = 'correct'
              )
          ) AS attempts

        FROM solvers s
      ),

      distribution AS (
        SELECT jsonb_build_object(
          '1', COUNT(*) FILTER (WHERE attempts = 1),
          '2', COUNT(*) FILTER (WHERE attempts = 2),
          '3', COUNT(*) FILTER (WHERE attempts = 3),
          '4', COUNT(*) FILTER (WHERE attempts = 4),
          '5', COUNT(*) FILTER (WHERE attempts = 5),
          '6', COUNT(*) FILTER (WHERE attempts = 6),
          '>6', COUNT(*) FILTER (WHERE attempts > 6)
        ) AS value

        FROM attempts_to_success
      )

      SELECT
        (SELECT COUNT(*)::int FROM players)
          AS total_players,

        (SELECT COUNT(*)::int FROM solvers)
          AS solvers,

        COALESCE(
          (
            SELECT AVG(attempts)
            FROM attempts_to_success
          ),
          0
        ) AS avg_attempts,

        COALESCE(
          (
            SELECT value
            FROM distribution
          ),
          '{}'::jsonb
        ) AS distribution
      `
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Stats indisponibles.',
    });
  }
});


// Stats personnelles du mode Course
app.get('/api/me/race-stats', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        COALESCE(MAX(score), 0)::int
          AS best_score,

        COALESCE(
          MAX(score) FILTER (
            WHERE
              (created_at AT TIME ZONE 'UTC')::date =
              (NOW() AT TIME ZONE 'UTC')::date
          ),
          0
        )::int AS best_today,

        COUNT(*)::int AS runs_count

      FROM race_runs

      WHERE user_id = $1
      `,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Stats course indisponibles.',
    });
  }
});


// ─────────────────────────────────────────────
// MODE COURSE
// ─────────────────────────────────────────────

// Record personnel pour une configuration
app.get('/api/me/race-best', requireAuth, async (req, res) => {
  const level = String(req.query.level || 'med');
  const duration = Number(req.query.duration || 60);

  if (!['easy', 'med', 'hard'].includes(level)) {
    return res.status(400).json({
      error: 'Niveau invalide.',
    });
  }

  if (![30, 60, 120].includes(duration)) {
    return res.status(400).json({
      error: 'Durée invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT MAX(score)::int AS best_score
      FROM race_runs
      WHERE user_id = $1
        AND level = $2
        AND duration = $3
      `,
      [req.user.id, level, duration]
    );

    res.json({
      best_score: result.rows[0]?.best_score ?? null,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de charger le record.',
    });
  }
});


// Sauvegarder une course
app.post('/api/race-runs', requireAuth, async (req, res) => {
  const duration = Number(req.body.duration);
  const level = String(req.body.level || '');
  const score = Math.max(0, Number(req.body.score) || 0);
  const attempts = Math.max(0, Number(req.body.attempts) || 0);

  if (![30, 60, 120].includes(duration)) {
    return res.status(400).json({
      error: 'Durée invalide.',
    });
  }

  if (!['easy', 'med', 'hard'].includes(level)) {
    return res.status(400).json({
      error: 'Niveau invalide.',
    });
  }

  if (!Number.isInteger(score) || !Number.isInteger(attempts)) {
    return res.status(400).json({
      error: 'Score ou nombre de tentatives invalide.',
    });
  }

  if (score > attempts) {
    return res.status(400).json({
      error: 'Score incohérent.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO race_runs (
        user_id,
        duration,
        level,
        score,
        attempts
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        req.user.id,
        duration,
        level,
        score,
        attempts,
      ]
    );

    const achievementChecks = [
      {
        key: 'race_first',
        condition: true,
      },
      {
        key: 'race_score_10',
        condition: score >= 10,
      },
      {
        key: 'race_score_25',
        condition: score >= 25,
      },
      {
        key: 'race_hard',
        condition: level === 'hard',
      },
      {
        key: 'race_perfect',
        condition: score >= 5 && score === attempts,
      },
    ];

    const newKeys = [];

    for (const achievement of achievementChecks) {
      if (!achievement.condition) continue;

      const existing = await client.query(
        `
        SELECT 1
        FROM user_achievements
        WHERE user_id = $1
          AND key = $2
        LIMIT 1
        `,
        [req.user.id, achievement.key]
      );

      if (existing.rowCount > 0) continue;

      await client.query(
        `
        INSERT INTO user_achievements (
          user_id,
          key,
          day_key,
          earned_at
        )
        VALUES (
          $1,
          $2,
          (NOW() AT TIME ZONE 'UTC')::date,
          NOW()
        )
        `,
        [req.user.id, achievement.key]
      );

      newKeys.push(achievement.key);
    }

    let achievements = [];

    if (newKeys.length > 0) {
      const result = await client.query(
        `
        SELECT
          key AS achievement_key,
          title AS achievement_title
        FROM achievements_catalog
        WHERE key = ANY($1::text[])
        `,
        [newKeys]
      );

      achievements = result.rows;
    }

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      achievements,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error(error);

    res.status(500).json({
      error: 'Impossible de sauvegarder la course.',
    });
  } finally {
    client.release();
  }
});


// Statut public du mode Course
app.get('/api/race-settings', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT suspended
      FROM race_settings
      WHERE id = 1
      `
    );

    res.json({
      suspended: Boolean(result.rows[0]?.suspended),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de charger les paramètres Course.',
    });
  }
});

// ─────────────────────────────────────────────
// ARCHIVES
// ─────────────────────────────────────────────

app.get('/api/archive', async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 30);
  const offsetRaw = Number(req.query.offset ?? 0);

  const limit = Number.isInteger(limitRaw)
    ? Math.max(0, Math.min(limitRaw, 100))
    : 30;

  const offset = Number.isInteger(offsetRaw)
    ? Math.max(0, offsetRaw)
    : 0;

  try {
    const result = await pool.query(
      `
      SELECT
        to_char(dr.day_key, 'YYYY-MM-DD') AS day_key,
        dr.type,
        dr.question,
        COALESCE(
          dr.answer_text,
          dr.answer_number::text
        ) AS answer,
        dr.explanation,
        dr.source

      FROM daily_riddles dr

      WHERE dr.day_key <
        (NOW() AT TIME ZONE 'UTC')::date

      ORDER BY dr.day_key DESC

      LIMIT $1
      OFFSET $2
      `,
      [limit, offset]
    );

    res.json({
      rows: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de charger les archives.',
    });
  }
});

// ─────────────────────────────────────────────
// FORUM
// ─────────────────────────────────────────────

app.get('/api/forum/posts', async (req, res) => {
  const day = String(
    req.query.day || new Date().toISOString().slice(0, 10)
  );

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return res.status(400).json({ error: 'Date invalide.' });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        fp.id,
        to_char(fp.day_key, 'YYYY-MM-DD') AS day_key,
        fp.user_id,
        fp.content,
        fp.created_at,
        p.username,
        p.avatar_color
      FROM forum_posts fp
      LEFT JOIN profiles p
        ON p.id = fp.user_id
      WHERE fp.day_key = $1::date
      ORDER BY fp.created_at DESC
      LIMIT 50
      `,
      [day]
    );

    res.json({ rows: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Impossible de charger le forum.',
    });
  }
});


app.post('/api/forum/posts', requireAuth, async (req, res) => {
  const day = String(req.body.day_key || '').trim();
  const content = String(req.body.content || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return res.status(400).json({ error: 'Date invalide.' });
  }

  if (!content || content.length > 1000) {
    return res.status(400).json({
      error: 'Le message doit contenir entre 1 et 1000 caractères.',
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  if (day > today) {
    return res.status(400).json({
      error: 'Impossible de publier dans le futur.',
    });
  }

  try {
    const result = await pool.query(
      `
      WITH inserted AS (
        INSERT INTO forum_posts (
          day_key,
          user_id,
          content
        )
        VALUES ($1::date, $2, $3)
        RETURNING *
      )
      SELECT
        i.id,
        to_char(i.day_key, 'YYYY-MM-DD') AS day_key,
        i.user_id,
        i.content,
        i.created_at,
        p.username,
        p.avatar_color
      FROM inserted i
      LEFT JOIN profiles p
        ON p.id = i.user_id
      `,
      [day, req.user.id, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Impossible de publier le message.',
    });
  }
});


app.delete('/api/forum/posts/:id', requireAuth, async (req, res) => {
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({
      error: 'Message invalide.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const owned = await client.query(
      `
      SELECT id
      FROM forum_posts
      WHERE id = $1
        AND user_id = $2
      `,
      [postId, req.user.id]
    );

    if (owned.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Message introuvable.',
      });
    }

    await client.query(
      `DELETE FROM forum_replies WHERE post_id = $1`,
      [postId]
    );

    await client.query(
      `
      DELETE FROM forum_posts
      WHERE id = $1
        AND user_id = $2
      `,
      [postId, req.user.id]
    );

    await client.query('COMMIT');

    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);

    res.status(500).json({
      error: 'Impossible de supprimer le message.',
    });
  } finally {
    client.release();
  }
});


app.get('/api/forum/posts/:id/replies', async (req, res) => {
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({
      error: 'Message invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        fr.id,
        fr.post_id,
        fr.user_id,
        fr.content,
        fr.created_at,
        p.username,
        p.avatar_color
      FROM forum_replies fr
      LEFT JOIN profiles p
        ON p.id = fr.user_id
      WHERE fr.post_id = $1
      ORDER BY fr.created_at ASC
      LIMIT 50
      `,
      [postId]
    );

    res.json({ rows: result.rows });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de charger les réponses.',
    });
  }
});


app.post('/api/forum/posts/:id/replies', requireAuth, async (req, res) => {
  const postId = Number(req.params.id);
  const content = String(req.body.content || '').trim();

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({
      error: 'Message invalide.',
    });
  }

  if (!content || content.length > 500) {
    return res.status(400).json({
      error: 'La réponse doit contenir entre 1 et 500 caractères.',
    });
  }

  try {
    const post = await pool.query(
      `SELECT id FROM forum_posts WHERE id = $1`,
      [postId]
    );

    if (post.rowCount === 0) {
      return res.status(404).json({
        error: 'Message introuvable.',
      });
    }

    const result = await pool.query(
      `
      WITH inserted AS (
        INSERT INTO forum_replies (
          post_id,
          user_id,
          content
        )
        VALUES ($1, $2, $3)
        RETURNING *
      )
      SELECT
        i.id,
        i.post_id,
        i.user_id,
        i.content,
        i.created_at,
        p.username,
        p.avatar_color
      FROM inserted i
      LEFT JOIN profiles p
        ON p.id = i.user_id
      `,
      [postId, req.user.id, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de publier la réponse.',
    });
  }
});


app.delete('/api/forum/replies/:id', requireAuth, async (req, res) => {
  const replyId = Number(req.params.id);

  if (!Number.isInteger(replyId) || replyId <= 0) {
    return res.status(400).json({
      error: 'Réponse invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM forum_replies
      WHERE id = $1
        AND user_id = $2
      RETURNING id
      `,
      [replyId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Réponse introuvable.',
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Impossible de supprimer la réponse.',
    });
  }
});


app.listen(PORT, '127.0.0.1', () => {
  console.log(`API Brainteaserday sur http://127.0.0.1:${PORT}`);
});
