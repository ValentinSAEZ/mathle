import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return '';
  }
}

function addDaysUTC(date, days) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function startOfUTCDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function dateKeyUTC(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
  const [loading, setLoading] = useState(true);

  const [solvedMap, setSolvedMap] = useState(() => new Map()); // key: yyyy-mm-dd -> true/false
  const [raceRuns, setRaceRuns] = useState([]); // [{created_at,duration,level,score,attempts}]
  const [achievements, setAchievements] = useState([]);
  const bestScore = useMemo(() => (raceRuns.length ? Math.max(...raceRuns.map(r=>r.score||0)) : 0), [raceRuns]);
  const days = 42; // 6 semaines (~42 jours)
  const end = useMemo(() => startOfUTCDay(new Date()), []);
  const start = useMemo(() => addDaysUTC(end, -(days - 1)), [end]);
  const range = useMemo(() => {
    const arr = [];
    for (let i = 0; i < days; i++) {
      const dt = addDaysUTC(start, i);
      arr.push({ key: dateKeyUTC(dt), date: dt });
    }
    return arr;
  }, [start]);

  const initials = useMemo(() => {
    const src = (username || (isSelf ? (selfUser?.email ?? '') : '')).trim();
    if (!src) return '?';
    const fromUsername = username?.trim();
    let parts = (fromUsername && fromUsername.length > 0)
      ? fromUsername.split(/[\s_-]+/).filter(Boolean)
      : (isSelf ? ((selfUser?.email?.split('@')[0] || '')) : '').split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return (src[0] || '?').toUpperCase();
    const first = (parts[0][0] || '').toUpperCase();
    const second = (parts[1]?.[0] || '').toUpperCase();
    return (first + second).trim() || first || '?';
  }, [username, selfUser?.email, isSelf]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let i = range.length - 1; i >= 0; i--) {
      const k = range[i].key;
      if (solvedMap.get(k) === true) streak++;
      else break;
    }
    return streak;
  }, [range, solvedMap]);

  // Charger profil
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      setLoading(true);
      setMessage('');
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, created_at, is_admin')
          .eq('id', targetUserId)
          .maybeSingle();
        if (error) throw error;
        if (!mounted) return;
        setUsername(data?.username || '');
        setCreatedAt(data?.created_at || selfUser?.created_at || '');
        setIsAdminTarget(Boolean(data?.is_admin));
      } catch (e) {
        console.error(e);
        if (mounted) setMessage("Impossible de charger le profil");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [targetUserId]);

  // Charger tentatives (résolutions) sur la plage
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      try {
        // Try via view (recommended for privacy)
        const { data, error } = await supabase
          .from('user_completions')
          .select('day_key, solved')
          .eq('user_id', targetUserId)
          .gte('day_key', dateKeyUTC(start))
          .lte('day_key', dateKeyUTC(end));
        if (error) throw error;
        if (!mounted) return;
        const m = new Map();
        for (const row of data || []) {
          m.set(String(row.day_key), Boolean(row.solved));
        }
        setSolvedMap(m);
        return;
      } catch (e1) {
        // Fallback: direct attempts (requires permissive RLS)
        try {
          const { data, error } = await supabase
            .from('attempts')
            .select('day_key, result')
            .eq('user_id', targetUserId)
            .gte('day_key', dateKeyUTC(start))
            .lte('day_key', dateKeyUTC(end));
          if (error) throw error;
          if (!mounted) return;
          const m = new Map();
          for (const row of data || []) {
            const k = String(row.day_key);
            if (row.result === 'correct') m.set(k, true);
            else if (!m.has(k)) m.set(k, false);
          }
          setSolvedMap(m);
        } catch (e2) {
          console.error(e2);
        }
      }
    })();
    return () => { mounted = false; };
  }, [targetUserId, start, end]);

  // Charger derniers runs "Course"
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      try {
        const { data, error } = await supabase
          .from('race_runs')
          .select('created_at, duration, level, score, attempts')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) throw error;
        if (mounted) setRaceRuns(data || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false; };
  }, [targetUserId]);

  // Charger succès/badges
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetUserId) return;
      try {
        const { data, error } = await supabase.rpc('get_user_achievements', { p_user: targetUserId });
        if (error) throw error;
        if (mounted) setAchievements(Array.isArray(data) ? data : []);
      } catch (e) {
        try {
          const { data } = await supabase
            .from('user_achievements')
            .select('key, day_key, earned_at')
            .eq('user_id', targetUserId)
            .order('earned_at', { ascending: false })
            .limit(20);
          if (mounted) setAchievements(data || []);
        } catch {}
      }
    })();
    return () => { mounted = false; };
  }, [targetUserId]);

  const save = async (e) => {
    e?.preventDefault?.();
    if (!selfUser?.id || !isSelf) return;
    setSaving(true);
    setMessage('');
    try {
      const uname = username.trim();
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: selfUser.id, username: uname });
      if (error) throw error;
      setMessage('Profil enregistré ✅');
      setEditing(false);
    } catch (e) {
      console.error(e);
      setMessage("Échec de l’enregistrement du profil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page" style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px' }}>
      <h2 className="page-title" style={{ marginTop: 12 }}>Mon profil</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 16,
      }}>
        <section className="card section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div aria-label="Avatar" title={username || 'Utilisateur'} className="avatar">
              {initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{username || (isSelf ? (selfUser?.email || 'Utilisateur') : 'Utilisateur')}</div>
                {isAdminTarget && (<span className="badge-admin">Administrateur</span>)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Série actuelle: {currentStreak} jour{currentStreak > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {isSelf && (
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Email</div>
                <div>{selfUser?.email}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Date d’inscription</div>
              <div>{createdAt ? fmtDate(createdAt) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Nom d’utilisateur</div>
              {!editing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div>{username || '—'}</div>
                  {isSelf && <button className="btn btn-primary" onClick={() => setEditing(true)}>Modifier le profil</button>}
                </div>
              ) : (
                <form onSubmit={save} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={username}
                    onChange={(e)=>setUsername(e.target.value)}
                    placeholder="Votre nom d’utilisateur"
                    required
                    className="input"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn" onClick={()=>{ setEditing(false); }}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
                </form>
              )}
            </div>
            {message && <div style={{ fontSize: 14 }}>{message}</div>}
          </div>
        </section>

        <section className="card section">
          <h3 style={{ marginTop: 0 }}>Succès</h3>
          {achievements.length === 0 ? (
            <div style={{ fontSize: 14, opacity: 0.7 }}>(Aucun succès débloqué pour l’instant)</div>
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

        <section className="card section">
          <h3 style={{ marginTop: 0 }}>Jours de complétion</h3>
          <div className="completion-grid">
            {range.map(({ key }, i) => {
              const solved = solvedMap.get(key) === true;
              return <div key={key} className={`completion-square ${solved ? 'solved' : 'unsolved'}`} title={`${key} — ${solved ? 'Résolu' : 'Non résolu'}`} />
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Derniers {days} jours (UTC). Carré rempli = jour résolu. Série actuelle: {currentStreak}.
          </div>
        </section>

        <section className="card section">
          <h3 style={{ marginTop: 0 }}>Mode Course — Derniers runs</h3>
          {raceRuns.length === 0 ? (
            <div style={{ fontSize: 14, opacity: 0.7 }}>(Aucun run)</div>
          ) : (
            <div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Meilleur score: <b>{bestScore}</b></div>
              <ul className="list">
                {raceRuns.map((r, i) => (
                  <li key={i} className="list-item">
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: '#111' }} />
                    <span style={{ width: 110, opacity: 0.8 }}>{fmtDate(r.created_at)}</span>
                    <span style={{ width: 90, opacity: 0.8 }}>{r.duration}s • {r.level}</span>
                    <span style={{ fontWeight: 600 }}>Score: {r.score}</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.7 }}>Essais: {r.attempts}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
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
