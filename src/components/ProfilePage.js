import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getLevelInfo, getXpProgress } from '../lib/celebrate';

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
  first_solve: { icon: '🎯', label: 'Premiere resolution', desc: 'Resoudre sa premiere enigme' },
  first_try: { icon: '⚡', label: '1er essai', desc: 'Reussir des le premier essai' },
  streak_7: { icon: '🔥', label: 'Serie de 7 jours', desc: 'Resoudre 7 jours d\'affilee' },
  streak_30: { icon: '🏆', label: 'Serie de 30 jours', desc: 'Resoudre 30 jours d\'affilee' },
  no_hints: { icon: '🧠', label: 'Sans indices', desc: 'Reussir sans indices' },
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
  const [createdAt, setCreatedAt] = useState(selfUser?.created_at || '');
  const [isAdminTarget, setIsAdminTarget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
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
    for (let i = range.length - 1; i >= 0; i--) { if (solvedMap.get(range[i].key) === true) s++; else break; }
    return s;
  }, [range, solvedMap]);

  // Load profile
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      try {
        const { data, error } = await supabase.from('profiles').select('username, created_at, is_admin, bio, avatar_color, xp').eq('id', targetUserId).maybeSingle();
        if (error) throw error;
        if (!mounted) return;
        setUsername(data?.username || '');
        setBio(data?.bio || '');
        setAvatarColor(data?.avatar_color || '#6366f1');
        setCreatedAt(data?.created_at || selfUser?.created_at || '');
        setIsAdminTarget(Boolean(data?.is_admin));
        setUserXp(data?.xp || 0);
      } catch (e) {
        if (mounted) setMessage("Impossible de charger le profil");
      }
    })();
    return () => { mounted = false; };
  }, [targetUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load completions
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      try {
        const { data, error } = await supabase.from('user_completions').select('day_key, solved').eq('user_id', targetUserId).gte('day_key', dateKeyUTC(start)).lte('day_key', dateKeyUTC(end));
        if (error) throw error;
        if (!mounted) return;
        const m = new Map();
        for (const row of data || []) m.set(String(row.day_key), Boolean(row.solved));
        setSolvedMap(m);
      } catch {
        try {
          const { data } = await supabase.from('attempts').select('day_key, result').eq('user_id', targetUserId).gte('day_key', dateKeyUTC(start)).lte('day_key', dateKeyUTC(end));
          if (!mounted) return;
          const m = new Map();
          for (const row of data || []) { const k = String(row.day_key); if (row.result === 'correct') m.set(k, true); else if (!m.has(k)) m.set(k, false); }
          setSolvedMap(m);
        } catch {}
      }
    })();
    return () => { mounted = false; };
  }, [targetUserId, start, end]);

  // Load race runs
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      try {
        const { data } = await supabase.from('race_runs').select('created_at, duration, level, score, attempts').eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(10);
        if (mounted) setRaceRuns(data || []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [targetUserId]);

  // Load achievements
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      try {
        const { data, error } = await supabase.rpc('get_user_achievements', { p_user: targetUserId });
        if (error) throw error;
        if (mounted) setAchievements(Array.isArray(data) ? data : []);
      } catch {
        try {
          const { data } = await supabase.from('user_achievements').select('key, day_key, earned_at').eq('user_id', targetUserId).order('earned_at', { ascending: false }).limit(20);
          if (mounted) setAchievements(data || []);
        } catch {}
      }
    })();
    return () => { mounted = false; };
  }, [targetUserId]);

  const startEditing = useCallback(() => {
    setEditUsername(username);
    setEditBio(bio);
    setEditColor(avatarColor);
    setEditing(true);
    setMessage('');
  }, [username, bio, avatarColor]);

  const save = async (e) => {
    e?.preventDefault?.();
    if (!selfUser?.id || !isSelf) return;
    setSaving(true); setMessage('');
    try {
      const { error } = await supabase.from('profiles')
        .update({
          username: editUsername.trim(),
          bio: editBio.trim(),
          avatar_color: editColor,
        })
        .eq('id', selfUser.id);
      if (error) throw error;
      setUsername(editUsername.trim());
      setBio(editBio.trim());
      setAvatarColor(editColor);
      setMessage('Profil enregistre !');
      setEditing(false);
    } catch {
      setMessage("Echec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e?.preventDefault?.();
    if (!session?.user) return;
    setPwMsg('');
    if (pw1 !== pw2) { setPwMsg('Les mots de passe ne correspondent pas.'); return; }
    if ((pw1 || '').length < 6) { setPwMsg('Au moins 6 caracteres requis.'); return; }
    setPwSaving(true);
    try {
      if (pwCurrent) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: session.user.email, password: pwCurrent });
        if (reauthErr) { setPwMsg('Mot de passe actuel incorrect.'); setPwSaving(false); return; }
      }
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPwMsg('Mot de passe mis a jour !');
      setPwCurrent(''); setPw1(''); setPw2('');
    } catch (err) {
      setPwMsg(err?.message || 'Impossible de mettre a jour.');
    } finally {
      setPwSaving(false);
    }
  };

  const earnedKeys = useMemo(() => new Set(achievements.map(a => a.key)), [achievements]);

  const tabs = [
    { key: 'overview', label: 'Apercu', icon: '📊' },
    { key: 'achievements', label: 'Succes', icon: '🏅' },
    { key: 'race', label: 'Course', icon: '🏁' },
    ...(isSelf ? [{ key: 'settings', label: 'Parametres', icon: '⚙️' }] : []),
  ];

  return (
    <div className="page-container profile-page fade-in">
      {/* Profile Header with gradient banner */}
      <div className="profile-header">
        <div className="profile-banner" style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}88, ${avatarColor}44)` }} />
        <div className="profile-header-content">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-lg" style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}cc)` }}>
              {initials}
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
            <div className="profile-meta">
              <span>Inscrit le {createdAt ? fmtDate(createdAt) : '—'}</span>
              <span className="profile-meta-dot" />
              <span>{userXp} XP</span>
              <span className="profile-meta-dot" />
              <span>{totalSolved} enigmes resolues</span>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="profile-quick-stats">
          <div className="profile-qstat">
            <span className="profile-qstat-value">{currentStreak}</span>
            <span className="profile-qstat-label">Serie</span>
          </div>
          <div className="profile-qstat-divider" />
          <div className="profile-qstat">
            <span className="profile-qstat-value">{bestScore}</span>
            <span className="profile-qstat-label">Meilleur score</span>
          </div>
          <div className="profile-qstat-divider" />
          <div className="profile-qstat">
            <span className="profile-qstat-value">{achievements.length}</span>
            <span className="profile-qstat-label">Succes</span>
          </div>
          <div className="profile-qstat-divider" />
          <div className="profile-qstat">
            <span className="profile-qstat-value">{raceRuns.length}</span>
            <span className="profile-qstat-label">Courses</span>
          </div>
        </div>
      </div>

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
              <h3 className="section-title">Jours de completion</h3>
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
                <h3 className="section-title" style={{ margin: 0 }}>Succes recents</h3>
                <button className="btn-link" onClick={() => setTab('achievements')}>Voir tout →</button>
              </div>
              {achievements.length === 0 ? (
                <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Aucun succes debloque</div>
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
              <h3 className="section-title">Tous les succes</h3>
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
              <h3 className="section-title">Modifier le profil</h3>
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
                  {message && <div style={{ fontSize: 13, marginTop: 8, color: message.includes('!') ? 'var(--success)' : 'var(--danger)' }}>{message}</div>}
                </div>
              ) : (
                <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <div className="field-label">Nom d'utilisateur</div>
                    <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="Nom d'utilisateur" required className="input" />
                  </div>
                  <div>
                    <div className="field-label">Bio</div>
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Parlez de vous..." className="input" rows={3} maxLength={200} style={{ resize: 'vertical' }} />
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
                        />
                      ))}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="profile-avatar-preview" style={{ background: `linear-gradient(135deg, ${editColor}, ${editColor}cc)` }}>
                        {initials}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Apercu</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn" onClick={() => { setEditing(false); setMessage(''); }} style={{ flex: 1 }}>Annuler</button>
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
                  </div>
                  {message && <div style={{ fontSize: 13, color: message.includes('!') ? 'var(--success)' : 'var(--danger)' }}>{message}</div>}
                </form>
              )}
            </section>

            {/* Security */}
            <section className="card section">
              <h3 className="section-title">Securite</h3>
              <form onSubmit={changePassword} style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
                <div>
                  <div className="field-label">Mot de passe actuel</div>
                  <input type="password" className="input" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </div>
                <div>
                  <div className="field-label">Nouveau mot de passe</div>
                  <input type="password" className="input" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Au moins 6 caracteres" required autoComplete="new-password" />
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
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
