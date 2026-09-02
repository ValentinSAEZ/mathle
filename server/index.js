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


app.listen(PORT, '127.0.0.1', () => {
  console.log(`API Brainteaserday sur http://127.0.0.1:${PORT}`);
});
