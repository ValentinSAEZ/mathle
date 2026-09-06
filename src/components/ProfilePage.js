import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { getLevelInfo, getXpProgress } from '../lib/celebrate';
import { prepareProfilePhoto } from '../lib/profilePhoto';
import './profile-personalization.css';
const API_URL = 'https://api.brainteaserday.com';



function fmtDate(d) {
  try { return new Date(d).toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' }); } catch { return ''; }
}

function addDaysUTC(date, days) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function startOfUTCDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function dateKeyUTC(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#2563eb', '#475569', '#1e293b',
];

const ACHIEVEMENT_META = {
  // ─── Énigmes du jour ────────────────────────────────────────────
  first_solve:   { icon: '🎯', label: 'Première résolution', desc: 'Résoudre sa toute première énigme' },
  first_try:     { icon: '⚡', label: 'Du premier coup',     desc: 'Réussir une énigme dès le 1er essai' },
  three_of_six:  { icon: '🌟', label: 'Mi-chemin',           desc: 'Résoudre 3 énigmes dans la même journée' },
  all_six:       { icon: '💎', label: 'Journée parfaite',    desc: 'Résoudre les 6 énigmes du jour' },
  comeback:      { icon: '🔄', label: 'Comeback',            desc: 'Résoudre une énigme après 3 erreurs ou plus' },
  perfectionist: { icon: '🎪', label: 'Perfectionniste',     desc: 'Résoudre 5 énigmes du même jour en 1 essai chacune' },
  all_themes:    { icon: '🌈', label: 'Touche-à-tout',       desc: 'Résoudre au moins une énigme de chaque catégorie' },
  // ─── Séries ──────────────────────────────────────────────────────
  streak_7:      { icon: '🔥', label: 'Série de 7 jours',   desc: 'Résoudre au moins une énigme 7 jours d\'affilée' },
  streak_30:     { icon: '🏆', label: 'Série de 30 jours',  desc: 'Résoudre au moins une énigme 30 jours d\'affilée' },
  // ─── Mode Course ─────────────────────────────────────────────────
  race_first:    { icon: '🏁', label: 'Premier départ',     desc: 'Terminer sa première course' },
  race_score_10: { icon: '💨', label: 'Décollage',          desc: 'Marquer 10 points en une course' },
  race_score_25: { icon: '🔥', label: 'En feu',             desc: 'Marquer 25 points en une course' },
  race_hard:     { icon: '💪', label: 'Intrépide',          desc: 'Terminer une course en mode Difficile' },
  race_perfect:  { icon: '🎯', label: 'Parfait !',          desc: 'Terminer une course sans erreur (min. 5 pts)' },
};

const ALL_ACHIEVEMENT_KEYS = Object.keys(ACHIEVEMENT_META);

export default function ProfilePage({ session, userId }) {
  const selfUser = session?.user;
  const targetUserId = userId || selfUser?.id;
  const isSelf = targetUserId === selfUser?.id;

  const [tab, setTab] = useState('overview');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarColor, setAvatarColor] = useState('#6366f1');
  const [isAdminTarget, setIsAdminTarget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [avatarImage, setAvatarImage] = useState('');
  const [editImage, setEditImage] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRequest = useRef({ version: 0 });
  useEffect(() => { const tracker = photoRequest.current; tracker.version++; setEditing(false); setPhotoBusy(false); setMessage(''); return () => { tracker.version++; }; }, [targetUserId]);
  useEffect(() => { if (editing) document.getElementById('profile-studio-heading')?.focus(); }, [editing]);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');

  const [pwCurrent, setPwCurrent] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const [solvedMap, setSolvedMap] = useState(() => new Map());
  const [raceRuns, setRaceRuns] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [userXp, setUserXp] = useState(0);
  const bestScore = useMemo(() => (raceRuns.length ? Math.max(...raceRuns.map(r => r.score || 0)) : 0), [raceRuns]);
  const totalSolved = useMemo(() => [...solvedMap.values()].filter(Boolean).length, [solvedMap]);
  const levelInfo = useMemo(() => getLevelInfo(userXp), [userXp]);
  const xpProgress = useMemo(() => getXpProgress(userXp), [userXp]);

  const days = 42;
  const end = useMemo(() => startOfUTCDay(new Date()), []);
  const start = useMemo(() => addDaysUTC(end, -(days - 1)), [end]);
  const range = useMemo(() => {
    const arr = [];
    for (let i = 0; i < days; i++) { const dt = addDaysUTC(start, i); arr.push({ key: dateKeyUTC(dt), date: dt }); }
    return arr;
  }, [start]);

  const initials = useMemo(() => {
    const src = (username || (isSelf ? (selfUser?.email ?? '') : '')).trim();
    if (!src) return '?';
    const parts = (username?.trim() || '').split(/[\s_-]+/).filter(Boolean);
    if (parts.length === 0) return (src[0] || '?').toUpperCase();
    return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase().trim() || parts[0][0].toUpperCase();
  }, [username, selfUser?.email, isSelf]);

  const currentStreak = useMemo(() => {
    let s = 0;
    const last = solvedMap.get(range.at(-1).key) ? range.length - 1 : range.length - 2;
    for (let i = last; i >= 0; i--) { if (solvedMap.get(range[i].key) === true) s++; else break; }
    return s;
  }, [range, solvedMap]);

  // Load profile
useEffect(() => {
  let mounted = true;

  (async () => {
    if (!targetUserId) return;

    try {
      const response = await fetch(
        `${API_URL}/api/profiles/${targetUserId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Impossible de charger le profil');
      }

      if (!mounted) return;

      const profile = data.profile;

      setUsername(profile?.username || '');
      setBio(profile?.bio || '');
      setAvatarColor(profile?.avatar_color || '#6366f1');
      setAvatarImage(profile?.avatar_image || '');
      setIsAdminTarget(Boolean(profile?.is_admin));
      setUserXp(profile?.xp || 0);
    } catch {
      if (mounted) {
        setMessage("Impossible de charger le profil");
      }
    }
  })();

  return () => {
    mounted = false;
  };
}, [targetUserId, selfUser?.created_at]);

// Load profile activity: completions, race runs and achievements
useEffect(() => {
  let mounted = true;

  (async () => {
    if (!targetUserId) return;

    try {
      const startKey = dateKeyUTC(start);
      const endKey = dateKeyUTC(end);

      const response = await fetch(
        `${API_URL}/api/profiles/${targetUserId}/activity?start=${encodeURIComponent(startKey)}&end=${encodeURIComponent(endKey)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Impossible de charger l'activité du profil"
        );
      }

      if (!mounted) return;

      // Jours résolus
      const completionMap = new Map();

      for (const row of data.completions || []) {
        completionMap.set(
          String(row.day_key),
          Boolean(row.solved)
        );
      }

      setSolvedMap(completionMap);

      // Dernières courses
      setRaceRuns(
        Array.isArray(data.race_runs)
          ? data.race_runs
          : []
      );

      // Succès
      setAchievements(
        Array.isArray(data.achievements)
          ? data.achievements
          : []
      );
    } catch (error) {
      console.error(
        'Unable to load profile activity:',
        error
      );

      if (mounted) {
        setSolvedMap(new Map());
        setRaceRuns([]);
        setAchievements([]);
      }
    }
  })();

  return () => {
    mounted = false;
  };
}, [targetUserId, start, end]);


  const startEditing = useCallback(() => {
    setEditUsername(username);
    setEditBio(bio);
    setEditColor(avatarColor);
    setEditImage(avatarImage);
    setTab('settings');
    setEditing(true);
    setMessage('');
  }, [username, bio, avatarColor, avatarImage]);

  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const request = ++photoRequest.current.version;
    setPhotoBusy(true); setMessage('');
    try { const image = await prepareProfilePhoto(file); if (request === photoRequest.current.version) setEditImage(image); }
    catch (error) { if (request === photoRequest.current.version) setMessage(error.message || 'Impossible de lire cette image.'); }
    finally { if (request === photoRequest.current.version) setPhotoBusy(false); }
  }

const save = async (e) => {
  e?.preventDefault?.();

  if (!selfUser?.id || !isSelf || photoBusy || saving) return;

  setSaving(true);
  setMessage('');

  try {
    const token = localStorage.getItem('auth_token');

    const response = await fetch(
      `${API_URL}/api/me/profile`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: editUsername.trim(),
          bio: editBio.trim(),
          avatar_color: editColor,
          avatar_image: editImage,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Échec de l'enregistrement");
    }

    const profile = data.profile;

    setUsername(profile.username || '');
    setBio(profile.bio || '');
    setAvatarColor(profile.avatar_color || '#6366f1');
    setAvatarImage(profile.avatar_image || '');

    setMessage('Profil enregistré !');
    setEditing(false);
  } catch (err) {
    setMessage(err?.message || "Échec de l'enregistrement");
  } finally {
    setSaving(false);
  }
};


const changePassword = async (e) => {
  e?.preventDefault?.();

  setPwMsg('');

  if (pw1 !== pw2) {
    setPwMsg('Les mots de passe ne correspondent pas.');
    return;
  }

  if ((pw1 || '').length < 8) {
    setPwMsg('Au moins 8 caractères requis.');
    return;
  }

  if (!pwCurrent) {
    setPwMsg('Saisissez votre mot de passe actuel.');
    return;
  }

  setPwSaving(true);

  try {
    const token = localStorage.getItem('auth_token');

    const response = await fetch(
      `${API_URL}/api/me/password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: pwCurrent,
          newPassword: pw1,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || 'Impossible de modifier le mot de passe.'
      );
    }

    setPwMsg('Mot de passe mis à jour !');
    setPwCurrent('');
    setPw1('');
    setPw2('');
  } catch (err) {
    setPwMsg(
      err?.message || 'Impossible de modifier le mot de passe.'
    );
  } finally {
    setPwSaving(false);
  }
};


  const earnedKeys = useMemo(() => new Set(achievements.map(a => a.key)), [achievements]);

  const tabs = [
    { key: 'overview', label: 'Mon parcours', icon: '📊' },
    { key: 'achievements', label: 'Succès', icon: '🏅' },
    { key: 'race', label: 'Course', icon: '🏁' },

  ];

  return (
    <div className="page-container profile-page fade-in">
      {/* Profile Header with gradient banner */}
      <div className="profile-header">
        <div className="profile-banner" style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}88, ${avatarColor}44)` }} />
        <div className="profile-header-content">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-lg" style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}cc)` }}>
              {avatarImage ? <img src={avatarImage} alt={username || 'Avatar'} /> : initials}
            </div>
            {isAdminTarget && <span className="badge-admin-float">Admin</span>}
          </div>
          <div className="profile-identity">
            <h2 className="profile-name">
              {username || (isSelf ? (selfUser?.email || 'Utilisateur') : 'Utilisateur')}
            </h2>
            {bio && <p className="profile-bio">{bio}</p>}
            <div className="profile-level-badge" style={{ '--level-color': levelInfo.color }}>
              <span style={{ fontWeight: 700 }}>Niv. {levelInfo.level}</span> — {levelInfo.title}
              <div className="xp-bar-mini" style={{ marginTop: 4, width: 120 }}>
                <div className="xp-bar-mini-fill" style={{ width: `${xpProgress * 100}%`, background: levelInfo.color }} />
              </div>
            </div>
            <div className="profile-meta"><span>{userXp} XP</span></div>
          </div>
          {isSelf && tab !== 'settings' && <button className="btn btn-primary profile-header-action" onClick={startEditing}>Personnaliser</button>}
        </div>

        {/* Quick stats row */}
        <div className="profile-quick-stats">
          <div className="profile-qstat">
            <span className="profile-qstat-value">{currentStreak}</span>
            <span className="profile-qstat-label">Série</span>
          </div>
          <div className="profile-qstat-divider" />
          <div className="profile-qstat">
            <span className="profile-qstat-value">{totalSolved}</span>
            <span className="profile-qstat-label">Jours actifs · 6 semaines</span>
          </div>
          <div className="profile-qstat-divider" />
          <div className="profile-qstat">
            <span className="profile-qstat-value">{achievements.length}</span>
            <span className="profile-qstat-label">Succès</span>
          </div>

        </div>
      </div>

      {message && tab !== 'settings' && <p role="status">{message}</p>}
      {/* Tabs */}
      <div className="profile-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`profile-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="profile-tab-content fade-in" key={tab}>
        {tab === 'overview' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Completion grid */}
            <section className="card section">
              <h3 className="section-title">Tes 6 dernières semaines</h3>
              <div className="completion-grid-wrapper">
                <div className="completion-grid-labels">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                    <div key={i} className="completion-grid-label">{d}</div>
                  ))}
                </div>
                <div className="completion-grid">
                  {range.map(({ key }) => {
                    const solved = solvedMap.get(key) === true;
                    return <div key={key} className={`completion-square ${solved ? 'solved' : ''}`} title={`${key} — ${solved ? 'Resolu' : 'Non resolu'}`} />;
                  })}
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>Derniers {days} jours (UTC)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="completion-square-mini" /> Non resolu
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="completion-square-mini solved" /> Resolu
                </span>
              </div>
            </section>

            {/* Recent achievements preview */}
            <section className="card section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 className="section-title" style={{ margin: 0 }}>Succès récents</h3>
                <button className="btn-link" onClick={() => setTab('achievements')}>Voir tout →</button>
              </div>
              {achievements.length === 0 ? (
                <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Ta collection commence ici. Résous ta première énigme pour débloquer un succès.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {achievements.slice(0, 3).map((a, i) => {
                    const meta = ACHIEVEMENT_META[a.key] || {};
                    return (
                      <div key={`${a.key}-${i}`} className="achievement-card earned">
                        <span className="achievement-icon">{meta.icon || '🏅'}</span>
                        <div className="achievement-info">
                          <div className="achievement-name">{a.title || meta.label || a.key}</div>
                          <div className="achievement-date">{fmtDate(a.earned_at || a.day_key)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'achievements' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <section className="card section">
              <h3 className="section-title">Tous les succès</h3>
              <div className="achievements-progress">
                <div className="achievements-progress-bar">
                  <div className="achievements-progress-fill" style={{ width: `${ALL_ACHIEVEMENT_KEYS.length > 0 ? (earnedKeys.size / ALL_ACHIEVEMENT_KEYS.length) * 100 : 0}%` }} />
                </div>
                <span className="achievements-progress-text">{earnedKeys.size}/{ALL_ACHIEVEMENT_KEYS.length} debloques</span>
              </div>
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {ALL_ACHIEVEMENT_KEYS.map(key => {
                  const meta = ACHIEVEMENT_META[key] || {};
                  const earned = earnedKeys.has(key);
                  const earnedData = achievements.find(a => a.key === key);
                  return (
                    <div key={key} className={`achievement-card-full ${earned ? 'earned' : 'locked'}`}>
                      <span className="achievement-icon-lg">{meta.icon || '🏅'}</span>
                      <div className="achievement-info">
                        <div className="achievement-name">{meta.label || key}</div>
                        <div className="achievement-desc">{meta.desc || ''}</div>
                        {earned && earnedData && (
                          <div className="achievement-date">Obtenu le {fmtDate(earnedData.earned_at || earnedData.day_key)}</div>
                        )}
                      </div>
                      {earned ? (
                        <span className="achievement-badge-earned">Debloque</span>
                      ) : (
                        <span className="achievement-badge-locked">Verrouille</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Achievement history - earned multiple times */}
            {achievements.length > earnedKeys.size && (
              <section className="card section">
                <h3 className="section-title">Historique des succes</h3>
                <div style={{ display: 'grid', gap: 6 }}>
                  {achievements.map((a, i) => {
                    const meta = ACHIEVEMENT_META[a.key] || {};
                    return (
                      <div key={`${a.key}-${a.day_key}-${i}`} className="achievement-history-row">
                        <span>{meta.icon || '🏅'}</span>
                        <span className="achievement-name">{a.title || meta.label || a.key}</span>
                        <span className="achievement-date" style={{ marginLeft: 'auto' }}>{fmtDate(a.earned_at || a.day_key)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'race' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <section className="card section">
              <h3 className="section-title">Statistiques Course</h3>
              {raceRuns.length === 0 ? (
                <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Aucune course effectuee</div>
              ) : (
                <>
                  <div className="stat-grid" style={{ marginBottom: 16 }}>
                    <div className="stat-card">
                      <div className="stat-value">{bestScore}</div>
                      <div className="stat-label">Meilleur score</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{raceRuns.length}</div>
                      <div className="stat-label">Courses</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{Math.round(raceRuns.reduce((s, r) => s + (r.score || 0), 0) / raceRuns.length)}</div>
                      <div className="stat-label">Score moyen</div>
                    </div>
                  </div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Dernieres courses</h4>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {raceRuns.map((r, i) => (
                      <div key={i} className="history-item" style={{ padding: '10px 14px', fontSize: 13 }}>
                        <span className="history-dot" style={{ background: r.score === bestScore ? 'var(--success)' : 'var(--primary)' }} />
                        <span style={{ color: 'var(--muted)', minWidth: 80 }}>{fmtDate(r.created_at)}</span>
                        <span className="race-level-badge">{r.level === 'easy' ? 'Facile' : r.level === 'med' ? 'Moyen' : 'Difficile'}</span>
                        <span style={{ color: 'var(--muted)' }}>{r.duration}s</span>
                        <span style={{ fontWeight: 600, marginLeft: 'auto' }}>
                          {r.score === bestScore && '⭐ '}{r.score} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'settings' && isSelf && (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Edit Profile */}
            <section className="card section">
              <h3 id="profile-studio-heading" tabIndex={-1} className="section-title">Ton studio de personnalisation</h3>
              {!editing ? (
                <div>
                  <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                    <div>
                      <div className="field-label">Nom d'utilisateur</div>
                      <div style={{ fontSize: 15 }}>{username || '—'}</div>
                    </div>
                    <div>
                      <div className="field-label">Bio</div>
                      <div style={{ fontSize: 15 }}>{bio || '—'}</div>
                    </div>
                    <div>
                      <div className="field-label">Couleur de l'avatar</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor }} />
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{avatarColor}</span>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={startEditing} style={{ width: '100%' }}>Modifier</button>
                  {message && <div role="status" style={{ fontSize: 13, marginTop: 8, color: message.includes('!') ? 'var(--success)' : 'var(--danger)' }}>{message}</div>}
                </div>
              ) : (
                <form onSubmit={save} className="profile-editor" style={{ display: 'grid', gap: 14 }}>
                  <fieldset disabled={saving || photoBusy}><legend>Ton identité publique</legend>
                  <div className="profile-studio-preview">
                    <div className="profile-avatar-preview" style={{ background: editColor }}>{editImage ? <img src={editImage} alt="Ton avatar" /> : (editUsername.trim().slice(0, 2).toUpperCase() || '?')}</div>
                    <div><strong>{editUsername || 'Ton pseudo'}</strong><p>{editBio || 'Ton histoire commence ici.'}</p></div>
                  </div>
                  <label htmlFor="profile-photo" className="field-label">Photo de profil</label>
                  <div className="profile-photo-controls">
                    <input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} aria-describedby="profile-photo-help" />
                    {editImage && <button type="button" className="btn btn-soft" onClick={() => setEditImage('')}>Retirer la photo</button>}
                  </div>
                  <p id="profile-photo-help" style={{ color: 'var(--muted)', margin: 0 }}>JPG, PNG ou WebP · 5 Mo maximum. La photo est centrée et recadrée au carré. Elle sera visible sur ton profil public après enregistrement.</p>
                  <div>
                    <div className="field-label">Nom d'utilisateur</div>
                    <input aria-label="Nom d’utilisateur" maxLength={50} type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="Nom d'utilisateur" required className="input" />
                  </div>
                  <div>
                    <div className="field-label">Bio</div>
                    <textarea aria-label="Bio" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Parlez de vous..." className="input" rows={3} maxLength={200} style={{ resize: 'vertical' }} />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>{editBio.length}/200</div>
                  </div>
                  <div>
                    <div className="field-label">Couleur de l'avatar</div>
                    <div className="color-picker-grid">
                      {AVATAR_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          className={`color-swatch ${editColor === c ? 'selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => setEditColor(c)}
                          title={c}
                          aria-label={`Couleur ${c}`}
                          aria-pressed={editColor === c}
                        />
                      ))}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="profile-avatar-preview" style={{ background: `linear-gradient(135deg, ${editColor}, ${editColor}cc)` }}>
                        {editImage ? <img src={editImage} alt="Aperçu" /> : (editUsername.trim().slice(0, 2).toUpperCase() || '?')}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Aperçu</span>
                    </div>
                  </div>
                  </fieldset>
                  {photoBusy && <p role="status">Préparation de ta photo…</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn" disabled={saving} onClick={() => { photoRequest.current.version++; setPhotoBusy(false); setEditing(false); setMessage(''); setTab('overview'); }} style={{ flex: 1 }}>Annuler</button>
                    <button type="submit" className="btn btn-primary" disabled={saving || photoBusy} style={{ flex: 1 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                  </div>
                  {message && <div role="status" style={{ fontSize: 13, color: message.includes('!') ? 'var(--success)' : 'var(--danger)' }}>{message}</div>}
                </form>
              )}
            </section>

            {/* Security */}
            <details className="card section">
              <summary className="section-title">Mot de passe</summary>
              <form onSubmit={changePassword} style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
                <div>
                  <div className="field-label">Mot de passe actuel</div>
                  <input type="password" className="input" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </div>
                <div>
                  <div className="field-label">Nouveau mot de passe</div>
                  <input type="password" className="input" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Au moins 8 caractères" required autoComplete="new-password" />
                </div>
                <div>
                  <div className="field-label">Confirmer</div>
                  <input type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeter le mot de passe" required autoComplete="new-password" />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                    {pwSaving ? 'Mise a jour...' : 'Changer'}
                  </button>
                  {pwMsg && <span style={{ fontSize: 13, color: pwMsg.includes('!') ? 'var(--success)' : 'var(--danger)' }}>{pwMsg}</span>}
                </div>
              </form>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
