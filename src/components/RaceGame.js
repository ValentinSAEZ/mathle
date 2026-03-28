import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { burstConfetti } from '../lib/celebrate';

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genEquation(level) {
  if (level === 'easy') {
    const a = randInt(0, 20);
    const b = randInt(0, 20);
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
    const b = randInt(2, 12), ans = randInt(2, 20);
    const c = randInt(1, 20);
    return { text: `${b * ans} ÷ ${b} + ${c}`, answer: ans + c };
  }
}

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
  const tickRef = useRef(null);
  const inputRef = useRef(null);
  const savedRef = useRef(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => { if (t <= 1) { clearInterval(tickRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  useEffect(() => { if (running) inputRef.current?.focus(); }, [running]);

  const start = () => {
    setScore(0); setAttempts(0); setHistory([]);
    setEq(genEquation(level)); setInput('');
    setTimeLeft(duration); setRunning(true);
    savedRef.current = false; setSaveMsg('');
  };

  const saveRun = async () => {
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      const { error } = await supabase.rpc('save_race_run', { p_duration: duration, p_level: level, p_score: score, p_attempts: attempts });
      if (error) throw error;
      setSaveMsg('Run sauvegardé !');
    } catch (e) {
      console.error(e);
      setSaveMsg('Échec de la sauvegarde');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!running || timeLeft <= 0) return;
    const g = Number(input);
    const ok = !Number.isNaN(g) && g === Number(eq.answer);
    setHistory((h) => [{ q: eq.text, a: eq.answer, g: input, ok, t: new Date().toISOString() }, ...h.slice(0, 9)]);
    setAttempts((n) => n + 1);
    if (ok) { setScore((s) => s + 1); setEq(genEquation(level)); }
    setInput('');
  };

  useEffect(() => {
    if (timeLeft <= 0 && running) {
      saveRun();
      setRunning(false);
      const prefersReduced = (() => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
      if (!prefersReduced) setTimeout(() => burstConfetti({}), 50);
    }
  }, [timeLeft, running]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running && (score > 0 || attempts > 0) && timeLeft > 0 && !savedRef.current) saveRun();
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeFmt = useMemo(() => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [timeLeft]);

  const pct = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const timerClass = pct <= 15 ? 'critical' : pct <= 33 ? 'low' : '';
  const disabled = !running || timeLeft <= 0;

  return (
    <div className="page-container fade-in">
      <h2 className="page-title">
        <img className="brand-inline" src={`${process.env.PUBLIC_URL || ''}/brand/logo.png`} alt="Logo"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        Mode Course
      </h2>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Controls */}
        <div className="card section">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
              Durée
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={running}>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>120s</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
              Difficulté
              <select value={level} onChange={(e) => setLevel(e.target.value)} disabled={running}>
                <option value="easy">Facile</option>
                <option value="med">Moyen</option>
                <option value="hard">Difficile</option>
              </select>
            </label>
            <div style={{ marginLeft: 'auto' }}>
              {!running ? (
                <button className="btn btn-primary" onClick={start}>Démarrer</button>
              ) : (
                <button className="btn btn-danger" onClick={() => setRunning(false)}>Stop</button>
              )}
            </div>
          </div>

          {/* Timer bar */}
          <div className="timer-bar">
            <div className={`timer-bar-fill ${timerClass}`} style={{ width: `${pct}%` }} />
          </div>

          {/* Score display */}
          <div className="stat-grid" style={{ marginTop: 14 }}>
            <div className="stat-card">
              <div className="stat-value">{timeFmt}</div>
              <div className="stat-label">Temps</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{score}</div>
              <div className="stat-label">Score</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{attempts}</div>
              <div className="stat-label">Essais</div>
            </div>
          </div>
        </div>

        {/* Equation */}
        <div className="card section">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, textAlign: 'center' }}>
            Résous
          </div>
          <div className="race-equation">{eq.text}</div>

          <form onSubmit={submit} style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, maxWidth: 320, margin: '16px auto 0' }}>
            <input ref={inputRef} type="number" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="?" disabled={disabled} className="input" style={{ fontSize: 18, textAlign: 'center' }} />
            <button type="submit" className="btn btn-primary" disabled={disabled} style={{ padding: '10px 24px' }}>OK</button>
          </form>

          {timeLeft <= 0 && (
            <div className="feedback-msg success" style={{ marginTop: 14 }}>
              Terminé ! Score: <b>{score}</b> ({attempts} essais)
            </div>
          )}
          {saveMsg && (
            <div style={{ marginTop: 8, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>{saveMsg}</div>
          )}
        </div>

        {/* History */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Historique récent</h3>
          </div>
          <div style={{ padding: history.length ? '8px' : '16px' }}>
            {history.length === 0 ? (
              <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>Aucune tentative</div>
            ) : (
              <div style={{ display: 'grid', gap: 4 }}>
                {history.map((h, i) => (
                  <div key={i} className="history-item" style={{ padding: '6px 12px' }}>
                    <span className="history-dot" style={{ background: h.ok ? 'var(--success)' : 'var(--danger)' }} />
                    <code style={{ fontSize: 13, flex: 1 }}>{h.q}</code>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>= {h.a}</span>
                    <span style={{ fontSize: 12, marginLeft: 'auto', fontWeight: 500 }}>{h.g}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
