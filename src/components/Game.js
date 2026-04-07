import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { bigCelebration, burstConfetti, pulseOnce, getLevelInfo, getXpProgress, RIDDLE_THEMES } from "../lib/celebrate";

function getUTCDateKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function msUntilNextUTCMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next - now;
}

function addDaysUTC(date, days) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function startOfUTCDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKeyUTC(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

const prefersReducedMotion = () => {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// État initial par énigme
function initRiddleState() {
  return { guess: '', feedback: '', feedbackType: '', history: [], solved: false, showVictory: false, xpGained: 0, awardsToday: [], shareMsg: '' };
}

export default function Game({ session }) {
  const [riddles, setRiddles] = useState([]); // liste des énigmes du jour (une par thème)
  const [activeTheme, setActiveTheme] = useState(null);
  const [riddleStates, setRiddleStates] = useState({}); // riddle_id -> state
  const [riddleLoading, setRiddleLoading] = useState(true);

  const [timeLeft, setTimeLeft] = useState(msUntilNextUTCMidnight());
  const [isBanned, setIsBanned] = useState(false);
  const [userXp, setUserXp] = useState(0);
  const [greetingName, setGreetingName] = useState('');
  const [streak, setStreak] = useState(0);
  const [selfLoading, setSelfLoading] = useState(true);

  const submitBtnRef = useRef(null);
  const victoryRef = useRef(null);
  const dayKey = getUTCDateKey();
  const days = 42;
  const end = useMemo(() => startOfUTCDay(new Date()), []);
  const start = useMemo(() => addDaysUTC(end, -(days - 1)), [end]);

  // Countdown
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(msUntilNextUTCMidnight()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeParts = (() => {
    const total = Math.max(0, timeLeft);
    return {
      h: Math.floor(total / 3600000),
      m: Math.floor((total % 3600000) / 60000),
      s: Math.floor((total % 60000) / 1000),
    };
  })();

  // Charger les énigmes du jour
  const loadRiddles = useCallback(async () => {
    setRiddleLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_daily_riddles_all', { p_day: dayKey });
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      setRiddles(list);
      if (list.length > 0 && !activeTheme) {
        setActiveTheme(list[0].theme);
      }
      // Initialiser les états si nécessaire
      setRiddleStates(prev => {
        const next = { ...prev };
        for (const r of list) {
          if (!next[r.riddle_id]) next[r.riddle_id] = initRiddleState();
        }
        return next;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setRiddleLoading(false);
    }
  }, [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger l'historique de toutes les énigmes du jour
  const loadHistory = useCallback(async () => {
    if (!session?.user?.id || riddles.length === 0) return;
    try {
      const riddleIds = riddles.map(r => r.riddle_id);
      const { data, error } = await supabase
        .from('attempts')
        .select('riddle_id, created_at, guess, result')
        .eq('user_id', session.user.id)
        .eq('day_key', dayKey)
        .in('riddle_id', riddleIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Regrouper par riddle_id
      const byRiddle = {};
      for (const a of data || []) {
        if (!byRiddle[a.riddle_id]) byRiddle[a.riddle_id] = [];
        byRiddle[a.riddle_id].push({ t: a.created_at, guess: String(a.guess), result: a.result });
      }

      setRiddleStates(prev => {
        const next = { ...prev };
        for (const rid of riddleIds) {
          const history = byRiddle[rid] || [];
          next[rid] = {
            ...(next[rid] || initRiddleState()),
            history,
            solved: history.some(x => x.result === 'correct'),
          };
        }
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  }, [session?.user?.id, dayKey, riddles]);

  useEffect(() => { loadRiddles(); }, [loadRiddles]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // XP utilisateur
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('xp').eq('id', session.user.id).maybeSingle();
        setUserXp(data?.xp || 0);
      } catch {}
    })();
  }, [session?.user?.id]);

  // Stats personnelles
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setSelfLoading(true);
        const uid = session?.user?.id;
        const email = session?.user?.email || '';
        if (!uid) { if (mounted) setSelfLoading(false); return; }

        try {
          const { data: prof } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle();
          const name = (prof?.username && String(prof.username).trim()) || email.split('@')[0] || 'Utilisateur';
          if (mounted) setGreetingName(name);
        } catch {
          if (mounted) setGreetingName(email.split('@')[0] || 'Utilisateur');
        }

        try {
          const { data: atts } = await supabase.from('attempts').select('day_key, result').eq('user_id', uid).gte('day_key', dateKeyUTC(start)).lte('day_key', dateKeyUTC(end));
          const map = new Map();
          for (const row of atts || []) {
            const k = String(row.day_key);
            if (row.result === 'correct') map.set(k, true);
            else if (!map.has(k)) map.set(k, false);
          }
          const range = [];
          for (let i = 0; i < days; i++) range.push(dateKeyUTC(addDaysUTC(start, i)));
          let s = 0;
          for (let i = range.length - 1; i >= 0; i--) { if (map.get(range[i]) === true) s++; else break; }
          if (mounted) setStreak(s);
        } catch {}
      } finally {
        if (mounted) setSelfLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [session?.user?.id, session?.user?.email, days, start, end]);

  // Ban check
  const checkBan = useCallback(async () => {
    if (!session?.user?.id) { setIsBanned(false); return false; }
    try {
      const { data } = await supabase.from('bans').select('banned').eq('user_id', session.user.id).maybeSingle();
      const banned = Boolean(data?.banned);
      setIsBanned(banned);
      return banned;
    } catch { setIsBanned(false); return false; }
  }, [session?.user?.id]);

  useEffect(() => { checkBan(); }, [checkBan]);

  // Mettre à jour l'état d'une énigme
  const updateRiddleState = (riddleId, patch) => {
    setRiddleStates(prev => ({
      ...prev,
      [riddleId]: { ...(prev[riddleId] || initRiddleState()), ...patch },
    }));
  };

  // Soumission d'une réponse
  const handleSubmit = async (e, riddle) => {
    e.preventDefault();
    const rs = riddleStates[riddle.riddle_id] || initRiddleState();
    if (!rs.guess || !session) return;

    if (isBanned) {
      const bannedNow = await checkBan();
      if (bannedNow) {
        updateRiddleState(riddle.riddle_id, { feedback: "Ton compte est banni.", feedbackType: "error", guess: '' });
        return;
      }
    }

    if (rs.solved) {
      updateRiddleState(riddle.riddle_id, { feedback: "Tu as déjà résolu cette énigme !", feedbackType: "success", guess: '' });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('submit_guess_riddle', {
        p_day: dayKey,
        p_riddle_id: riddle.riddle_id,
        p_guess: String(rs.guess),
      });
      if (error) throw error;
      const result = typeof data === 'string' ? data : String(data || 'wrong');

      let msg = '';
      let type = '';
      if (result === 'correct') { msg = 'Bravo, bonne réponse !'; type = 'success'; }
      else if (result === 'low') { msg = 'Trop petit !'; type = 'error'; }
      else if (result === 'high') { msg = 'Trop grand !'; type = 'error'; }
      else { msg = "Ce n'est pas ça... réessaie !"; type = 'error'; }

      const newEntry = { t: new Date().toISOString(), guess: String(rs.guess), result };
      const newHistory = [newEntry, ...(rs.history || [])];

      if (result === 'correct') {
        const attempts = newHistory.length;
        let xp = 10;
        if (attempts === 1) xp += 15;
        else if (attempts <= 3) xp += 8;
        else if (attempts <= 5) xp += 3;
        if (streak >= 7) xp += 5;
        if (streak >= 30) xp += 10;

        try {
          const { data: newXp } = await supabase.rpc('award_xp', { p_user: session.user.id, p_amount: xp });
          if (typeof newXp === 'number') setUserXp(newXp);
          else setUserXp(prev => prev + xp);
        } catch { setUserXp(prev => prev + xp); }

        // Share message
        let shareMsg = '';
        try {
          const bar = [...newHistory].reverse()
            .map(h => h.result === 'correct' ? '🟩' : h.result === 'low' ? '🔵' : h.result === 'high' ? '🔴' : '⬜')
            .join('');
          const theme = RIDDLE_THEMES[riddle.theme] || RIDDLE_THEMES.general;
          shareMsg = `BrainteaserDay ${dayKey} — ${theme.label} — ${attempts} essai${attempts > 1 ? 's' : ''}\n${bar}\nhttps://brainteaserday.vercel.app`;
        } catch {}

        // Succès
        let awards = [];
        try {
          const { data: awd } = await supabase.rpc('get_awards_for_day', { p_day: dayKey });
          if (Array.isArray(awd)) awards = awd;
        } catch {}

        updateRiddleState(riddle.riddle_id, {
          history: newHistory, solved: true, feedback: msg, feedbackType: type,
          guess: '', xpGained: xp, showVictory: true, awardsToday: awards, shareMsg,
        });

        if (!prefersReducedMotion()) {
          setTimeout(() => bigCelebration({ originEl: victoryRef.current || submitBtnRef.current }), 200);
        }
        pulseOnce(submitBtnRef.current);
      } else {
        updateRiddleState(riddle.riddle_id, { history: newHistory, feedback: msg, feedbackType: type, guess: '' });
      }
    } catch (e) {
      console.error(e);
      const raw = (e?.message || '').toLowerCase();
      let msg = "Erreur lors de l'enregistrement. Réessaie.";
      if (raw.includes('rate') && raw.includes('limit')) msg = "Trop d'essais, réessaie dans quelques secondes.";
      else if (raw.includes('already') && raw.includes('solv')) {
        updateRiddleState(riddle.riddle_id, { solved: true, feedback: "Tu as déjà résolu cette énigme !", feedbackType: "success", guess: '' });
        return;
      }
      updateRiddleState(riddle.riddle_id, { feedback: msg, feedbackType: "error" });
    }
  };

  const levelInfo = getLevelInfo(userXp);
  const xpProgress = getXpProgress(userXp);
  const activeRiddle = riddles.find(r => r.theme === activeTheme) || null;
  const rs = activeRiddle ? (riddleStates[activeRiddle.riddle_id] || initRiddleState()) : null;
  const theme = activeRiddle ? (RIDDLE_THEMES[activeRiddle.theme] || RIDDLE_THEMES.general) : null;
  const totalSolved = riddles.filter(r => (riddleStates[r.riddle_id] || initRiddleState()).solved).length;

  return (
    <div>
      {/* Greeting & countdown */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        {!selfLoading && greetingName && (
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Bonjour, {greetingName}</div>
        )}
        <div className="countdown">
          <span>Prochaines énigmes dans</span>
          <span className="countdown-digit">{String(timeParts.h).padStart(2, '0')}</span>
          <span>:</span>
          <span className="countdown-digit">{String(timeParts.m).padStart(2, '0')}</span>
          <span>:</span>
          <span className="countdown-digit">{String(timeParts.s).padStart(2, '0')}</span>
        </div>
        {riddles.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
            {totalSolved}/{riddles.length} énigme{riddles.length > 1 ? 's' : ''} résolue{totalSolved > 1 ? 's' : ''} aujourd'hui
          </div>
        )}
      </div>

      {/* Onglets par catégorie */}
      {riddleLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Chargement des énigmes...</div>
      ) : riddles.length === 0 ? (
        <div className="question-card" style={{ textAlign: 'center', color: 'var(--muted)' }}>Aucune énigme disponible pour le moment.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {riddles.map(r => {
              const t = RIDDLE_THEMES[r.theme] || RIDDLE_THEMES.general;
              const rsSt = riddleStates[r.riddle_id] || initRiddleState();
              const isActive = r.theme === activeTheme;
              return (
                <button
                  key={r.riddle_id}
                  onClick={() => setActiveTheme(r.theme)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '10px 6px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', border: '2px solid', position: 'relative',
                    borderColor: isActive ? t.color : rsSt.solved ? t.color + '55' : 'var(--card-border)',
                    background: isActive ? t.color + '18' : rsSt.solved ? t.color + '0a' : 'var(--card-bg)',
                    color: isActive ? t.color : rsSt.solved ? t.color + 'cc' : 'var(--muted)',
                    transition: 'all 160ms ease',
                    boxShadow: isActive ? `0 0 0 3px ${t.color}22` : 'none',
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
                  <span style={{ lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-word', fontSize: 10 }}>{t.label}</span>
                  {rsSt.solved && (
                    <span style={{
                      position: 'absolute', top: 4, right: 5,
                      fontSize: 9, fontWeight: 800,
                      color: t.color,
                    }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {activeRiddle && rs && theme && (
            <div key={activeRiddle.riddle_id}>
              {/* Theme badge */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <span className="theme-badge" style={{ '--theme-color': theme.color }}>
                  <span>{theme.icon}</span> {theme.label}
                </span>
              </div>

              {/* Question */}
              <div className="question-card" style={{ marginBottom: 16 }}>
                {String(activeRiddle.question || '').split(/\n{2,}/).map((para, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0', whiteSpace: 'pre-line' }}>{para}</p>
                ))}
              </div>

              {/* Formulaire */}
              <form onSubmit={e => handleSubmit(e, activeRiddle)} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  value={rs.guess}
                  onChange={e => updateRiddleState(activeRiddle.riddle_id, { guess: e.target.value })}
                  placeholder="Ta réponse"
                  disabled={rs.solved || isBanned}
                  className="input"
                  style={{ flex: 1 }}
                />
                <button
                  ref={submitBtnRef}
                  type={rs.solved ? "button" : "submit"}
                  onClick={rs.solved ? () => { if (!prefersReducedMotion()) burstConfetti({ originEl: submitBtnRef.current }); pulseOnce(submitBtnRef.current); } : undefined}
                  disabled={isBanned}
                  className={`btn ${rs.solved ? 'btn-finished' : 'btn-primary'}`}
                  style={{ padding: '10px 24px' }}
                >
                  {isBanned ? "Banni" : (rs.solved ? "✓" : "Valider")}
                </button>
              </form>

              {/* Victory card */}
              {rs.showVictory && (
                <div className="victory-card fade-in" ref={victoryRef}>
                  <div className="victory-header">
                    <div className="victory-emoji">🎉</div>
                    <h3 className="victory-title">Bravo !</h3>
                    <p className="victory-subtitle">
                      {theme.icon} {theme.label} — {rs.history.length} essai{rs.history.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="victory-bar">
                    {[...rs.history].reverse().map((h, i) => (
                      <span key={i} className="victory-dot" style={{
                        background: h.result === 'correct' ? 'var(--success)' : h.result === 'low' ? '#2563eb' : h.result === 'high' ? 'var(--danger)' : 'var(--muted)',
                        animationDelay: `${i * 100}ms`,
                      }} title={h.guess} />
                    ))}
                  </div>

                  <div className="victory-xp">
                    <span className="victory-xp-badge">+{rs.xpGained} XP</span>
                    <div className="victory-level-info">
                      <span style={{ color: levelInfo.color, fontWeight: 700 }}>Niv. {levelInfo.level}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>{levelInfo.title}</span>
                    </div>
                    <div className="xp-bar-mini">
                      <div className="xp-bar-mini-fill" style={{ width: `${xpProgress * 100}%`, background: levelInfo.color }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                      {userXp} / {levelInfo.maxXp < 999999 ? levelInfo.maxXp : '∞'} XP
                    </div>
                  </div>

                  {rs.awardsToday?.length > 0 && (
                    <div className="victory-awards">
                      {rs.awardsToday.map((a, i) => (
                        <span key={`${a.key}-${i}`} className="victory-award-pill">🏅 {a.title || a.key}</span>
                      ))}
                    </div>
                  )}

                  {/* Progresser vers la prochaine catégorie */}
                  {totalSolved < riddles.length && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface-subtle)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                      {riddles.length - totalSolved} autre{riddles.length - totalSolved > 1 ? 's' : ''} énigme{riddles.length - totalSolved > 1 ? 's' : ''} à résoudre aujourd'hui !
                    </div>
                  )}

                  <div className="victory-actions">
                    {rs.shareMsg && (
                      <button type="button" className="btn btn-primary" style={{ flex: 1 }}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(rs.shareMsg);
                            updateRiddleState(activeRiddle.riddle_id, { feedback: 'Résultat copié !', feedbackType: 'success' });
                          } catch {
                            updateRiddleState(activeRiddle.riddle_id, { feedback: 'Impossible de copier', feedbackType: 'error' });
                          }
                        }}
                      >
                        📋 Partager
                      </button>
                    )}
                    <button type="button" className="btn" onClick={() => updateRiddleState(activeRiddle.riddle_id, { showVictory: false })} style={{ flex: 1 }}>
                      Fermer
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {rs.feedback && !rs.showVictory && (
                <div className={`feedback-msg ${rs.feedbackType}`} style={{ marginBottom: 16 }}>{rs.feedback}</div>
              )}

              {/* Historique */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)' }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Historique</h3>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{rs.history.length} tentative{rs.history.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ padding: rs.history.length ? '8px' : '16px' }}>
                  {rs.history.length === 0 ? (
                    <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>Aucune tentative pour l'instant</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {rs.history.map((h, i) => (
                        <div key={`${h.t}-${i}`} className="history-item">
                          <span className="history-dot" style={{
                            background: h.result === "correct" ? "var(--success)" : h.result === "low" ? "#2563eb" : h.result === "high" ? "var(--danger)" : "var(--muted)"
                          }} />
                          <code style={{ fontSize: 14, fontWeight: 500 }}>{h.guess}</code>
                          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                            {new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Stats personnelles */}
      {!selfLoading && (
        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="stat-card">
            <div className="stat-value">{streak}</div>
            <div className="stat-label">Jour{streak > 1 ? 's' : ''} de série</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalSolved}/{riddles.length}</div>
            <div className="stat-label">Aujourd'hui</div>
          </div>
          <div className="stat-card" style={{ position: 'relative' }}>
            <div className="stat-value" style={{ color: levelInfo.color }}>Niv. {levelInfo.level}</div>
            <div className="stat-label">{levelInfo.title}</div>
            <div className="xp-bar-mini" style={{ marginTop: 6 }}>
              <div className="xp-bar-mini-fill" style={{ width: `${xpProgress * 100}%`, background: levelInfo.color }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
