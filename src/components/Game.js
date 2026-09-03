import React, { useEffect, useState, useCallback, useRef } from "react";
import { bigCelebration, burstConfetti, pulseOnce, getLevelInfo, getXpProgress, RIDDLE_THEMES } from "../lib/celebrate";
const API_URL = 'https://api.brainteaserday.com';


function getUTCDateKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function msUntilNextUTCMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next - now;
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
    const response = await fetch(
      `${API_URL}/api/riddles/today?day=${encodeURIComponent(dayKey)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Impossible de charger les énigmes');
    }

    const list = Array.isArray(data.riddles) ? data.riddles : [];

    setRiddles(list);

    if (list.length > 0 && !activeTheme) {
      setActiveTheme(list[0].theme);
    }

    setRiddleStates(prev => {
      const next = { ...prev };

      for (const r of list) {
        if (!next[r.riddle_id]) {
          next[r.riddle_id] = initRiddleState();
        }
      }

      return next;
    });
  } catch (error) {
    console.error(error);
  } finally {
    setRiddleLoading(false);
  }
}, [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps


// Charger l'historique du jour
const loadHistory = useCallback(async () => {
  if (!session?.user?.id || riddles.length === 0) return;

  const token = localStorage.getItem('auth_token');

  if (!token) return;

  try {
    const response = await fetch(
      `${API_URL}/api/riddles/today/history?day=${encodeURIComponent(dayKey)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Impossible de charger l'historique");
    }

    const riddleIds = riddles.map(r => r.riddle_id);
    const byRiddle = {};

    for (const a of data.attempts || []) {
      if (!byRiddle[a.riddle_id]) {
        byRiddle[a.riddle_id] = [];
      }

      byRiddle[a.riddle_id].push({
        t: a.created_at,
        guess: String(a.guess),
        result: a.result,
      });
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
  } catch (error) {
    console.error(error);
  }
}, [session?.user?.id, dayKey, riddles]);


useEffect(() => {
  loadRiddles();
}, [loadRiddles]);

useEffect(() => {
  loadHistory();
}, [loadHistory]);


// Profil / XP / série / bannissement
const loadGameStatus = useCallback(async () => {
  const token = localStorage.getItem('auth_token');
  const email = session?.user?.email || '';

  if (!session?.user?.id || !token) {
    setSelfLoading(false);
    return;
  }

  setSelfLoading(true);

  try {
    const response = await fetch(
      `${API_URL}/api/me/game-status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || 'Impossible de charger les informations utilisateur'
      );
    }

    const name =
      (data.username && String(data.username).trim()) ||
      email.split('@')[0] ||
      'Utilisateur';

    setGreetingName(name);
    setUserXp(Number(data.xp) || 0);
    setStreak(Number(data.streak) || 0);
    setIsBanned(Boolean(data.banned));
  } catch (error) {
    console.error(error);
  } finally {
    setSelfLoading(false);
  }
}, [session?.user?.id, session?.user?.email]);


useEffect(() => {
  loadGameStatus();
}, [loadGameStatus]);



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

  const rs =
    riddleStates[riddle.riddle_id] || initRiddleState();

  if (!rs.guess || !session) return;

  if (isBanned) {
    updateRiddleState(riddle.riddle_id, {
      feedback: "Ton compte est banni.",
      feedbackType: "error",
      guess: '',
    });
    return;
  }

  if (rs.solved) {
    updateRiddleState(riddle.riddle_id, {
      feedback: "Tu as déjà résolu cette énigme !",
      feedbackType: "success",
      guess: '',
    });
    return;
  }

  try {
    const token = localStorage.getItem('auth_token');

    const response = await fetch(
      `${API_URL}/api/riddles/${riddle.riddle_id}/guess`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          day: dayKey,
          guess: String(rs.guess),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(
        data?.error || "Erreur lors de l'enregistrement."
      );

      error.status = response.status;
      throw error;
    }

    const result = data.result;

    let msg = '';
    let type = '';

    if (result === 'correct') {
      msg = 'Bravo, bonne réponse !';
      type = 'success';
    } else if (result === 'low') {
      msg = 'Trop petit !';
      type = 'error';
    } else if (result === 'high') {
      msg = 'Trop grand !';
      type = 'error';
    } else {
      msg = "Ce n'est pas ça... réessaie !";
      type = 'error';
    }

    const newEntry = {
      t: new Date().toISOString(),
      guess: String(rs.guess),
      result,
    };

    const newHistory = [
      newEntry,
      ...(rs.history || []),
    ];

    if (result === 'correct') {
      const xp = Number(data.xp_gained) || 0;

      if (typeof data.xp === 'number') {
        setUserXp(data.xp);
      } else {
        setUserXp(prev => prev + xp);
      }

      const attempts = newHistory.length;

      let shareMsg = '';

      try {
        const bar = [...newHistory]
          .reverse()
          .map(h =>
            h.result === 'correct'
              ? '🟩'
              : h.result === 'low'
              ? '🔵'
              : h.result === 'high'
              ? '🔴'
              : '⬜'
          )
          .join('');

        const theme =
          RIDDLE_THEMES[riddle.theme] ||
          RIDDLE_THEMES.general;

        shareMsg =
          `BrainteaserDay ${dayKey} — ${theme.label} — ` +
          `${attempts} essai${attempts > 1 ? 's' : ''}\n` +
          `${bar}\nhttps://brainteaserday.com`;
      } catch {}

      updateRiddleState(riddle.riddle_id, {
        history: newHistory,
        solved: true,
        feedback: msg,
        feedbackType: type,
        guess: '',
        xpGained: xp,
        showVictory: true,
        awardsToday: [],
        shareMsg,
      });

      loadGameStatus();

      if (!prefersReducedMotion()) {
        setTimeout(
          () =>
            bigCelebration({
              originEl:
                victoryRef.current ||
                submitBtnRef.current,
            }),
          200
        );
      }

      pulseOnce(submitBtnRef.current);
    } else {
      updateRiddleState(riddle.riddle_id, {
        history: newHistory,
        feedback: msg,
        feedbackType: type,
        guess: '',
      });
    }
  } catch (error) {
    console.error(error);

    if (error.status === 403) {
      setIsBanned(true);

      updateRiddleState(riddle.riddle_id, {
        feedback: "Ton compte est banni.",
        feedbackType: "error",
        guess: '',
      });

      return;
    }

    if (error.status === 429) {
      updateRiddleState(riddle.riddle_id, {
        feedback:
          "Trop d'essais, réessaie dans quelques secondes.",
        feedbackType: "error",
      });

      return;
    }

    if (error.status === 409) {
      updateRiddleState(riddle.riddle_id, {
        solved: true,
        feedback:
          "Tu as déjà résolu cette énigme !",
        feedbackType: "success",
        guess: '',
      });

      return;
    }

    updateRiddleState(riddle.riddle_id, {
      feedback:
        error?.message ||
        "Erreur lors de l'enregistrement. Réessaie.",
      feedbackType: "error",
    });
  }
};



  const levelInfo = getLevelInfo(userXp);
  const xpProgress = getXpProgress(userXp);
  const activeRiddle = riddles.find(r => r.theme === activeTheme) || null;
  const rs = activeRiddle ? (riddleStates[activeRiddle.riddle_id] || initRiddleState()) : null;
  const theme = activeRiddle ? (RIDDLE_THEMES[activeRiddle.theme] || RIDDLE_THEMES.general) : null;
  const totalSolved = riddles.filter(r => (riddleStates[r.riddle_id] || initRiddleState()).solved).length;

  return (
    <div className="game-shell">
      {/* Greeting & countdown */}
      <div className="game-intro">
        {!selfLoading && greetingName && (
          <div className="game-greeting">Bonjour, {greetingName}</div>
        )}
        <div className="countdown">
          <span className="countdown-label">Prochaines énigmes dans</span>
          <span className="countdown-clock" aria-label={`${timeParts.h} heures, ${timeParts.m} minutes et ${timeParts.s} secondes`}>
            <span className="countdown-digit">{String(timeParts.h).padStart(2, '0')}</span>
            <span aria-hidden>:</span>
            <span className="countdown-digit">{String(timeParts.m).padStart(2, '0')}</span>
            <span aria-hidden>:</span>
            <span className="countdown-digit">{String(timeParts.s).padStart(2, '0')}</span>
          </span>
        </div>
        {riddles.length > 0 && (
          <div className="game-daily-progress">
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
          <div className="riddle-theme-tabs" role="tablist" aria-label="Catégories d'énigmes">
            {riddles.map(r => {
              const t = RIDDLE_THEMES[r.theme] || RIDDLE_THEMES.general;
              const rsSt = riddleStates[r.riddle_id] || initRiddleState();
              const isActive = r.theme === activeTheme;
              return (
                <button
                  key={r.riddle_id}
                  onClick={() => setActiveTheme(r.theme)}
                  className={`riddle-theme-tab${isActive ? ' is-active' : ''}${rsSt.solved ? ' is-solved' : ''}`}
                  role="tab"
                  aria-selected={isActive}
                  style={{
                    '--theme-color': t.color,
                  }}
                >
                  <span className="riddle-theme-icon">{t.icon}</span>
                  <span className="riddle-theme-label">{t.label}</span>
                  {rsSt.solved && (
                    <span className="riddle-theme-check" aria-label="Résolue">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {activeRiddle && rs && theme && (
            <div key={activeRiddle.riddle_id} className="riddle-panel">
              {/* Theme badge */}
              <div className="active-theme-heading">
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
              <form onSubmit={e => handleSubmit(e, activeRiddle)} className="answer-form" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rs.guess}
                  onChange={e => updateRiddleState(activeRiddle.riddle_id, { guess: e.target.value })}
                  placeholder="Ta réponse"
                  disabled={rs.solved || isBanned}
                  className="input"
                  style={{ flex: 1, fontSize: 16 }}
                />
                <button
                  ref={submitBtnRef}
                  type={rs.solved ? "button" : "submit"}
                  onClick={rs.solved ? () => { if (!prefersReducedMotion()) burstConfetti({ originEl: submitBtnRef.current }); pulseOnce(submitBtnRef.current); } : undefined}
                  disabled={isBanned}
                  className={`btn ${rs.solved ? 'btn-finished' : 'btn-primary'}`}
                  style={{ padding: '10px 20px', minHeight: 44, flexShrink: 0 }}
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
              <div className="card game-history-card">
                <div className="game-history-header">
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Historique</h3>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{rs.history.length} tentative{rs.history.length !== 1 ? 's' : ''}</span>
                </div>
                <div className={`game-history-body${rs.history.length ? ' has-items' : ''}`}>
                  {rs.history.length === 0 ? (
                    <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>Aucune tentative pour l'instant</div>
                  ) : (
                    <div className="game-history-list">
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
        <div className="stat-grid game-progress-grid" style={{ marginTop: 16 }}>
          <div className="stat-card progress-stat">
            <span className="progress-stat-icon" aria-hidden>🔥</span>
            <div className="progress-stat-copy">
              <div className="stat-value">{streak}</div>
              <div className="stat-label">Jour{streak > 1 ? 's' : ''} de série</div>
            </div>
          </div>
          <div className="stat-card progress-stat">
            <span className="progress-stat-icon" aria-hidden>✓</span>
            <div className="progress-stat-copy">
              <div className="stat-value">{totalSolved}/{riddles.length}</div>
              <div className="stat-label">Résolues aujourd'hui</div>
            </div>
          </div>
          <div className="stat-card progress-stat progress-level">
            <span className="progress-stat-icon" aria-hidden>↗</span>
            <div className="progress-stat-copy">
              <div className="stat-value" style={{ color: levelInfo.color }}>Niveau {levelInfo.level}</div>
              <div className="stat-label">{levelInfo.title}</div>
            </div>
            <div className="progress-level-meter">
              <div className="xp-bar-mini">
                <div className="xp-bar-mini-fill" style={{ width: `${xpProgress * 100}%`, background: levelInfo.color }} />
              </div>
              <span>{userXp} XP</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

