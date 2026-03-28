import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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

export default function ProfilePage({ session, userId }) {
  const selfUser = session?.user;
  const targetUserId = userId || selfUser?.id;
  const isSelf = targetUserId === selfUser?.id;
  const [username, setUsername] = useState('');
  const [createdAt, setCreatedAt] = useState(selfUser?.created_at || '');
  const [isAdminTarget, setIsAdminTarget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const [solvedMap, setSolvedMap] = useState(() => new Map());
  const [raceRuns, setRaceRuns] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const bestScore = useMemo(() => (raceRuns.length ? Math.max(...raceRuns.map(r => r.score || 0)) : 0), [raceRuns]);
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      try {
        const { data, error } = await supabase.from('profiles').select('username, created_at, is_admin').eq('id', targetUserId).maybeSingle();
        if (error) throw error;
        if (!mounted) return;
        setUsername(data?.username || '');
        setCreatedAt(data?.created_at || selfUser?.created_at || '');
        setIsAdminTarget(Boolean(data?.is_admin));
      } catch (e) {
        if (mounted) setMessage("Impossible de charger le profil");
      }
    })();
    return () => { mounted = false; };
  }, [targetUserId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const save = async (e) => {
    e?.preventDefault?.();
    if (!selfUser?.id || !isSelf) return;
    setSaving(true); setMessage('');
    try {
      const { error } = await supabase.from('profiles').upsert({ id: selfUser.id, username: username.trim() });
      if (error) throw error;
      setMessage('Profil enregistré !');
      setEditing(false);
    } catch {
      setMessage("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e?.preventDefault?.();
    if (!session?.user) return;
    setPwMsg('');
    if (pw1 !== pw2) { setPwMsg('Les mots de passe ne correspondent pas.'); return; }
    if ((pw1 || '').length < 6) { setPwMsg('Au moins 6 caractères requis.'); return; }
    setPwSaving(true);
    try {
      if (pwCurrent) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: session.user.email, password: pwCurrent });
        if (reauthErr) { setPwMsg('Mot de passe actuel incorrect.'); setPwSaving(false); return; }
      }
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPwMsg('Mot de passe mis à jour !');
      setPwCurrent(''); setPw1(''); setPw2('');
    } catch (err) {
      setPwMsg(err?.message || 'Impossible de mettre à jour.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="page-container profile-page fade-in">
      <h2 className="page-title">Profil</h2>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Identity card */}
        <section className="card section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div className="avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {username || (isSelf ? (selfUser?.email || 'Utilisateur') : 'Utilisateur')}
                </div>
                {isAdminTarget && <span className="badge-admin">Admin</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Inscrit le {createdAt ? fmtDate(createdAt) : '—'}
              </div>
            </div>
          </div>

          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-value">{currentStreak}</div>
              <div className="stat-label">Série</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{bestScore}</div>
              <div className="stat-label">Meilleur score</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{achievements.length}</div>
              <div className="stat-label">Succès</div>
            </div>
          </div>

          {isSelf && (
            <div>
              {!editing ? (
                <button className="btn btn-primary" onClick={() => setEditing(true)} style={{ width: '100%' }}>Modifier le profil</button>
              ) : (
                <form onSubmit={save} style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nom d'utilisateur" required className="input" style={{ flex: 1 }} />
                  <button type="button" className="btn" onClick={() => setEditing(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : 'OK'}</button>
                </form>
              )}
              {message && <div style={{ fontSize: 13, marginTop: 8, color: 'var(--muted)' }}>{message}</div>}
            </div>
          )}
        </section>

        {/* Completion grid */}
        <section className="card section">
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Jours de complétion</h3>
          <div className="completion-grid">
            {range.map(({ key }) => {
              const solved = solvedMap.get(key) === true;
              return <div key={key} className={`completion-square ${solved ? 'solved' : ''}`} title={`${key} — ${solved ? 'Résolu' : 'Non résolu'}`} />;
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            Derniers {days} jours (UTC). Série actuelle: {currentStreak}.
          </div>
        </section>

        {/* Achievements */}
        <section className="card section">
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Succès</h3>
          {achievements.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Aucun succès débloqué</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {achievements.map((a, i) => (
                <span key={`${a.key}-${i}`} className="lb-pill" title={a.key}>
                  🏅 {a.title || labelOf(a.key)} — {fmtDate(a.earned_at || a.day_key)}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Race runs */}
        <section className="card section">
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Mode Course</h3>
          {raceRuns.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Aucun run</div>
          ) : (
            <div>
              <div className="stat-grid" style={{ marginBottom: 12 }}>
                <div className="stat-card">
                  <div className="stat-value">{bestScore}</div>
                  <div className="stat-label">Meilleur score</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{raceRuns.length}</div>
                  <div className="stat-label">Runs</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {raceRuns.map((r, i) => (
                  <div key={i} className="history-item" style={{ padding: '8px 12px', fontSize: 13 }}>
                    <span className="history-dot" style={{ background: 'var(--primary)' }} />
                    <span style={{ color: 'var(--muted)', minWidth: 80 }}>{fmtDate(r.created_at)}</span>
                    <span style={{ color: 'var(--muted)' }}>{r.duration}s · {r.level}</span>
                    <span style={{ fontWeight: 600, marginLeft: 'auto' }}>Score: {r.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Security */}
        {isSelf && (
          <section className="card section">
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15, padding: 0, border: 'none', background: 'none', outline: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                Sécurité
              </summary>
              <form onSubmit={changePassword} style={{ display: 'grid', gap: 12, maxWidth: 400, marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mot de passe actuel</div>
                  <input type="password" className="input" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nouveau mot de passe</div>
                  <input type="password" className="input" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Au moins 6 caractères" required autoComplete="new-password" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confirmer</div>
                  <input type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Répéter le mot de passe" required autoComplete="new-password" />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                    {pwSaving ? 'Mise à jour…' : 'Changer'}
                  </button>
                  {pwMsg && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{pwMsg}</span>}
                </div>
              </form>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}

function labelOf(key) {
  switch (String(key || '')) {
    case 'first_solve': return 'Première résolution';
    case 'first_try': return '1er essai';
    case 'streak_7': return 'Série de 7 jours';
    case 'streak_30': return 'Série de 30 jours';
    case 'no_hints': return 'Sans indices';
    default: return key;
  }
}
