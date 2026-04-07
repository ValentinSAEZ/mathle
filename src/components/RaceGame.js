import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { burstConfetti, bigCelebration } from '../lib/celebrate';

function initialsOf(name) {
  try {
    const parts = String(name || '').trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  } catch { return '?'; }
}

/* ── helpers ─────────────────────────────────────────────────── */
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genEquation(level) {
  if (level === 'easy') {
    const a = randInt(0, 20), b = randInt(0, 20);
    const op = Math.random() < 0.5 ? '+' : '-';
    return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b };
  }
  if (level === 'med') {
    const choice = Math.random();
    if (choice < 0.4) {
      const a = randInt(0, 50), b = randInt(0, 50);
      const op = Math.random() < 0.5 ? '+' : '-';
      return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b };
    } else if (choice < 0.8) {
      const a = randInt(2, 12), b = randInt(2, 12);
      return { text: `${a} × ${b}`, answer: a * b };
    } else {
      const b = randInt(2, 12), ans = randInt(2, 12);
      return { text: `${b * ans} ÷ ${b}`, answer: ans };
    }
  }
  // hard
  const choice = Math.random();
  if (choice < 0.33) {
    const a = randInt(2, 20), b = randInt(2, 20), c = randInt(2, 20);
    return Math.random() < 0.5
      ? { text: `${a} + ${b} × ${c}`, answer: a + b * c }
      : { text: `${a} × ${b} - ${c}`, answer: a * b - c };
  } else if (choice < 0.66) {
    const a = randInt(2, 15), b = randInt(2, 15), c = randInt(2, 10);
    return Math.random() < 0.5
      ? { text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c }
      : { text: `${a} × (${b} - ${c})`, answer: a * (b - c) };
  } else {
    const b = randInt(2, 12), ans = randInt(2, 20), c = randInt(1, 20);
    return { text: `${b * ans} ÷ ${b} + ${c}`, answer: ans + c };
  }
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const LEVEL_LABELS = { easy: 'Facile', med: 'Moyen', hard: 'Difficile' };
const LEVEL_COLORS = { easy: '#10b981', med: '#f59e0b', hard: '#ef4444' };

const RACE_ACHIEVEMENT_META = {
  race_first:    { icon: '🏁', title: 'Premier départ' },
  race_score_10: { icon: '⚡', title: 'Décollage' },
  race_score_25: { icon: '🔥', title: 'En feu' },
  race_hard:     { icon: '💪', title: 'Intrépide' },
  race_perfect:  { icon: '🎯', title: 'Parfait !' },
};

const prefersReduced = () => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/* ── Leaderboard Course ───────────────────────────────────────── */
function RaceLeaderboard({ level, duration, currentUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.rpc('get_race_leaderboard', { p_level: level, p_duration: duration });
        if (mounted) setRows(Array.isArray(data) ? data : []);
      } catch {}
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [level, duration]);

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 12 }}>Chargement…</div>;
  if (rows.length === 0) return <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 12 }}>Aucun score pour cette configuration</div>;

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {rows.map((r, idx) => {
        const isMe = r.user_id === currentUserId;
        return (
          <div key={r.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
            background: isMe ? 'var(--primary-soft)' : idx % 2 === 0 ? 'var(--surface-subtle)' : 'transparent',
            border: isMe ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, flexShrink: 0,
              background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--surface-subtle)',
              color: idx < 3 ? '#fff' : 'var(--muted)',
            }}>{idx + 1}</span>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              {initialsOf(r.username)}
            </span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? 'var(--primary)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.username || '—'}{isMe ? ' (moi)' : ''}
            </span>
            <span style={{ fontWeight: 800, fontSize: 15, color: idx === 0 ? '#f59e0b' : 'var(--text)' }}>{r.score}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 32, textAlign: 'right' }}>{r.accuracy}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── End Screen ──────────────────────────────────────────────── */
function EndScreen({ score, attempts, maxCombo, duration, level, personalBest, newAchievements, onRestart, userId }) {
  const accuracy = attempts > 0 ? Math.round((score / attempts) * 100) : 0;
  const isNewRecord = personalBest === null || score > personalBest;
  const levelColor = LEVEL_COLORS[level];

  return (
    <div className="race-end-screen fade-in">
      {/* Score header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>
          {isNewRecord ? '🏆' : score >= 20 ? '🔥' : score >= 10 ? '⚡' : '🏁'}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: isNewRecord ? '#f59e0b' : 'var(--text)' }}>
          {score}
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>points</div>
        {isNewRecord && (
          <div style={{
            display: 'inline-block', marginTop: 10,
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            color: '#fff', fontWeight: 800, fontSize: 13,
            padding: '4px 14px', borderRadius: 20,
            animation: 'race-record-shine 1.5s ease infinite',
          }}>
            ⭐ NOUVEAU RECORD !
          </div>
        )}
        {!isNewRecord && personalBest !== null && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
            Record personnel : {personalBest} pts
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Précision', value: `${accuracy}%`, icon: '🎯' },
          { label: 'Meilleure série', value: `×${maxCombo}`, icon: '🔥' },
          { label: `Durée`, value: fmtTime(duration), icon: '⏱' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Achievements earned */}
      {newAchievements.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
            Succès débloqués 🏅
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {newAchievements.map((a, i) => {
              const meta = RACE_ACHIEVEMENT_META[a.achievement_key] || {};
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--primary-soft)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 10, padding: '10px 14px',
                  animation: `achievement-slide-in 400ms ease ${i * 150}ms both`,
                }}>
                  <span style={{ fontSize: 22 }}>{meta.icon || '🏅'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{a.achievement_title || meta.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--primary)' }}>Nouveau succès débloqué !</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Level badge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <span style={{
          background: levelColor + '22', color: levelColor,
          border: `1px solid ${levelColor}44`,
          fontWeight: 700, fontSize: 13, padding: '4px 14px', borderRadius: 20,
        }}>
          {LEVEL_LABELS[level]} · {fmtTime(duration)}
        </span>
      </div>

      <button className="btn btn-primary" onClick={onRestart} style={{ width: '100%', fontSize: 16, padding: '14px', marginBottom: 24 }}>
        🔄 Rejouer
      </button>

      {/* Classement Course */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 14, fontWeight: 700 }}>
          🏆 Classement — {LEVEL_LABELS[level]} · {fmtTime(duration)}
        </div>
        <div style={{ padding: 10 }}>
          <RaceLeaderboard level={level} duration={duration} currentUserId={userId} />
        </div>
      </div>
    </div>
  );
}

/* ── Main RaceGame ───────────────────────────────────────────── */
export default function RaceGame({ session }) {
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [level, setLevel] = useState('med');
  const [eq, setEq] = useState(() => genEquation('med'));
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [history, setHistory] = useState([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [flash, setFlash] = useState(null); // 'correct' | 'wrong'
  const [personalBest, setPersonalBest] = useState(null);
  const [showEnd, setShowEnd] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);
  const [saving, setSaving] = useState(false);

  const tickRef = useRef(null);
  const inputRef = useRef(null);
  const savedRef = useRef(false);
  const comboRef = useRef(0); // ref to access latest combo in async context
  const maxComboRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { maxComboRef.current = maxCombo; }, [maxCombo]);

  // Load personal best
  const loadPB = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase.from('race_runs')
        .select('score')
        .eq('user_id', session.user.id)
        .eq('level', level)
        .eq('duration', duration)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPersonalBest(data?.score ?? null);
    } catch {}
  }, [session?.user?.id, level, duration]);

  useEffect(() => { loadPB(); }, [loadPB]);

  // Timer tick
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(tickRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  useEffect(() => { if (running) inputRef.current?.focus(); }, [running]);

  const start = () => {
    setScore(0); setAttempts(0); setHistory([]);
    setCombo(0); setMaxCombo(0);
    comboRef.current = 0; maxComboRef.current = 0;
    setEq(genEquation(level)); setInput('');
    setTimeLeft(duration); setRunning(true);
    setShowEnd(false); setNewAchievements([]);
    savedRef.current = false;
  };

  const saveRun = useCallback(async (finalScore, finalAttempts) => {
    if (savedRef.current) return;
    savedRef.current = true;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('save_race_run', {
        p_duration: duration,
        p_level: level,
        p_score: finalScore,
        p_attempts: finalAttempts,
      });
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) setNewAchievements(data);
    } catch (e) {
      console.error('save_race_run error:', e);
    } finally {
      setSaving(false);
      setShowEnd(true);
      await loadPB();
    }
  }, [duration, level, loadPB]);

  // End of time
  useEffect(() => {
    if (timeLeft <= 0 && running) {
      setRunning(false);
      clearInterval(tickRef.current);
      // capture latest values from state setters
      setScore(s => { setAttempts(a => { saveRun(s, a); return a; }); return s; });
      if (!prefersReduced()) setTimeout(() => bigCelebration({}), 200);
    }
  }, [timeLeft, running]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerFlash = (type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), 350);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!running || timeLeft <= 0 || !input.trim()) return;
    const g = Number(input);
    const ok = !Number.isNaN(g) && g === Number(eq.answer);

    setHistory(h => [{ q: eq.text, a: eq.answer, g: input, ok }, ...h.slice(0, 6)]);
    setAttempts(n => n + 1);

    if (ok) {
      setScore(s => s + 1);
      setCombo(c => {
        const next = c + 1;
        setMaxCombo(m => Math.max(m, next));
        return next;
      });
      setEq(genEquation(level));
      triggerFlash('correct');
      if (!prefersReduced()) burstConfetti({ count: 20 });
    } else {
      setCombo(0);
      triggerFlash('wrong');
    }
    setInput('');
  };

  const pct = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const isUrgent = pct <= 16; // last ~10s for 60s
  const levelColor = LEVEL_COLORS[level];

  if (showEnd) {
    return (
      <div className="page-container fade-in">
        <EndScreen
          score={score}
          attempts={attempts}
          maxCombo={maxCombo}
          duration={duration}
          level={level}
          personalBest={personalBest}
          newAchievements={newAchievements}
          onRestart={() => { setShowEnd(false); start(); }}
          userId={session?.user?.id}
        />
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <h2 className="page-title">🏁 Mode Course</h2>

      {/* Config bar (hidden when running) */}
      {!running && (
        <div className="card section" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            {/* Difficulty */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Difficulté</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['easy', 'med', 'hard'].map(l => (
                  <button key={l} onClick={() => setLevel(l)} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px solid',
                    background: level === l ? LEVEL_COLORS[l] + '22' : 'transparent',
                    borderColor: level === l ? LEVEL_COLORS[l] : 'var(--card-border)',
                    color: level === l ? LEVEL_COLORS[l] : 'var(--muted)',
                  }}>
                    {LEVEL_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
            {/* Duration */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Durée</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[30, 60, 120].map(d => (
                  <button key={d} onClick={() => setDuration(d)} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px solid',
                    background: duration === d ? '#6366f122' : 'transparent',
                    borderColor: duration === d ? '#6366f1' : 'var(--card-border)',
                    color: duration === d ? '#6366f1' : 'var(--muted)',
                  }}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            {/* Start */}
            <div style={{ marginLeft: 'auto' }}>
              {personalBest !== null && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, textAlign: 'right' }}>
                  Record : <strong style={{ color: 'var(--text)' }}>{personalBest} pts</strong>
                </div>
              )}
              <button className="btn btn-primary" onClick={start} style={{ fontSize: 16, padding: '10px 28px' }}>
                Démarrer 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {running && (
        <>
          {/* Timer bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              height: 8, borderRadius: 4, background: 'var(--surface-subtle)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${pct}%`,
                background: isUrgent
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : `linear-gradient(90deg, ${levelColor}, ${levelColor}cc)`,
                transition: 'width 1s linear, background 0.5s ease',
                animation: isUrgent ? 'race-urgency-pulse 0.6s ease infinite' : 'none',
              }} />
            </div>
          </div>

          {/* HUD */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            {/* Timer */}
            <div style={{
              fontVariantNumeric: 'tabular-nums',
              fontSize: 32, fontWeight: 900, lineHeight: 1,
              color: isUrgent ? '#ef4444' : 'var(--text)',
              animation: isUrgent ? 'race-urgency-pulse 0.6s ease infinite' : 'none',
              minWidth: 70,
            }}>
              {fmtTime(timeLeft)}
            </div>

            <div style={{ flex: 1 }} />

            {/* Score */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: levelColor }}>{score}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Score</div>
            </div>

            {/* Combo badge */}
            {combo >= 3 && (
              <div style={{
                background: combo >= 10 ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                  : combo >= 5 ? 'linear-gradient(135deg, #6366f1, #a78bfa)'
                  : 'linear-gradient(135deg, #10b981, #06b6d4)',
                color: '#fff', borderRadius: 12,
                padding: '6px 12px', textAlign: 'center',
                animation: 'combo-pop 0.2s ease',
                minWidth: 60,
              }}>
                <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>×{combo}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', opacity: 0.9 }}>COMBO</div>
              </div>
            )}

            {/* Stop */}
            <button className="btn" onClick={() => { setRunning(false); clearInterval(tickRef.current); setShowEnd(true); }} style={{ fontSize: 12 }}>
              ✕ Stop
            </button>
          </div>

          {/* Personal best tracker */}
          {personalBest !== null && (
            <div style={{ textAlign: 'center', marginBottom: 10, fontSize: 12, color: 'var(--muted)' }}>
              Record : <strong style={{ color: score >= personalBest ? '#f59e0b' : 'var(--text)' }}>{personalBest}</strong>
              {score >= personalBest && score > 0 && (
                <span style={{ color: '#10b981', fontWeight: 700, marginLeft: 6 }}>↑ Battu !</span>
              )}
            </div>
          )}
        </>
      )}

      {/* Equation card */}
      <div
        className={`card section race-equation-card ${flash === 'correct' ? 'race-flash-correct' : flash === 'wrong' ? 'race-flash-wrong' : ''}`}
        style={{ marginBottom: 16, position: 'relative', overflow: 'hidden' }}
      >
        {/* Level badge top-right */}
        <div style={{ position: 'absolute', top: 12, right: 12, background: levelColor + '22', color: levelColor, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
          {LEVEL_LABELS[level]}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>
          Résous
        </div>
        <div className="race-equation" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', marginBottom: 0 }}>
          {eq.text} = ?
        </div>

        <form onSubmit={submit} style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, maxWidth: 280, margin: '20px auto 0' }}>
          <input
            ref={inputRef}
            type="number"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="?"
            disabled={!running || timeLeft <= 0}
            className="input"
            style={{ fontSize: 22, textAlign: 'center', fontWeight: 700, flex: 1 }}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" disabled={!running || timeLeft <= 0} style={{ padding: '10px 20px', fontSize: 16 }}>
            ✓
          </button>
        </form>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Sauvegarde en cours...
        </div>
      )}

      {/* Recent history feed */}
      {history.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 600 }}>
            Historique récent
          </div>
          <div style={{ padding: 8, display: 'grid', gap: 3 }}>
            {history.map((h, i) => (
              <div key={i} className="history-item" style={{ padding: '5px 10px', opacity: 1 - i * 0.12 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 11,
                  background: h.ok ? '#10b98122' : '#ef444422',
                  color: h.ok ? '#10b981' : '#ef4444', flexShrink: 0,
                }}>
                  {h.ok ? '✓' : '✗'}
                </span>
                <code style={{ fontSize: 13, flex: 1 }}>{h.q}</code>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>= {h.a}</span>
                {!h.ok && <span style={{ fontSize: 12, color: '#ef4444', marginLeft: 6 }}>({h.g})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-start placeholder */}
      {!running && history.length === 0 && !showEnd && (
        <div className="card section" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Prêt à jouer ?</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
            Choisis ta difficulté et ta durée, puis clique sur Démarrer.<br />
            Résous un maximum d'opérations avant la fin du temps !
          </div>
        </div>
      )}
    </div>
  );
}
