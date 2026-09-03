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





app.listen(PORT, '127.0.0.1', () => {
  console.log(`API Brainteaserday sur http://127.0.0.1:${PORT}`);
});
