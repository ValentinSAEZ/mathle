import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { burstConfetti } from '../lib/celebrate';

// Génère une équation simple selon la difficulté
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genEquation(level) {
  // level: 'easy' | 'med' | 'hard'
  if (level === 'easy') {
    const a = randInt(0, 20);
    const b = randInt(0, 20);
    const op = Math.random() < 0.5 ? '+' : '-';
    const ans = op === '+' ? a + b : a - b;
    return { text: `${a} ${op} ${b}`, answer: ans };
  }
  if (level === 'med') {
    const choice = Math.random();
    if (choice < 0.4) {
      const a = randInt(0, 50), b = randInt(0, 50); const op = Math.random() < 0.5 ? '+' : '-';
      return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b };
    } else if (choice < 0.8) {
      const a = randInt(2, 12), b = randInt(2, 12);
      return { text: `${a} × ${b}`, answer: a * b };
    } else {
      // division entière
      const b = randInt(2, 12), ans = randInt(2, 12); const a = b * ans;
      return { text: `${a} ÷ ${b}`, answer: ans };
    }
  }
  // hard
  const choice = Math.random();
  if (choice < 0.33) {
    // mix add/sub/mul
    const a = randInt(2, 20), b = randInt(2, 20), c = randInt(2, 20);
    const t = Math.random() < 0.5
      ? { text: `${a} + ${b} × ${c}`, answer: a + b * c }
      : { text: `${a} × ${b} - ${c}`, answer: a * b - c };
    return t;
  } else if (choice < 0.66) {
    // parenthèses
    const a = randInt(2, 15), b = randInt(2, 15), c = randInt(2, 10);
    const t = Math.random() < 0.5
      ? { text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c }
      : { text: `${a} × (${b} - ${c})`, answer: a * (b - c) };
    return t;
  } else {
    // division entière avec addition
    const b = randInt(2, 12), ans = randInt(2, 20); const a = b * ans; const c = randInt(1, 20);
    return { text: `${a} ÷ ${b} + ${c}`, answer: ans + c };
  }
}

export default function RaceGame({ session }) {
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(60); // secondes
  const [timeLeft, setTimeLeft] = useState(60);
  const [level, setLevel] = useState('med');
  const [eq, setEq] = useState(() => genEquation('med'));
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [history, setHistory] = useState([]); // {q,a,g,ok,t}
  const tickRef = useRef(null);
  const inputRef = useRef(null);
  const savedRef = useRef(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(tickRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  useEffect(() => {
    if (running) inputRef.current?.focus();
  }, [running]);

  const start = () => {
    setScore(0); setAttempts(0); setHistory([]);
    setEq(genEquation(level)); setInput('');
    setTimeLeft(duration); setRunning(true);
    savedRef.current = false; setSaveMsg('');
  };

  const stop = () => { setRunning(false); };

  const saveRun = async () => {
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      const { error } = await supabase.rpc('save_race_run', {
        p_duration: duration,
        p_level: level,
        p_score: score,
        p_attempts: attempts,
      });
      if (error) throw error;
      setSaveMsg('Run sauvegardé ✅');
    } catch (e) {
      console.error(e);
      setSaveMsg("Échec de la sauvegarde du run");
    }
  };

  const submit = (e) => {
    e.preventDefault(); if (!running || timeLeft <= 0) return;
    const g = Number(input);
    const ok = !Number.isNaN(g) && g === Number(eq.answer);
    const entry = { q: eq.text, a: eq.answer, g: input, ok, t: new Date().toISOString() };
    setHistory((h) => [entry, ...h.slice(0, 9)]);
    setAttempts((n) => n + 1);
    if (ok) {
      setScore((s) => s + 1);
      setEq(genEquation(level));
      setInput('');
    } else {
      setInput('');
    }
  };

  // Sauvegarde auto à la fin ou à l'arrêt
  useEffect(() => {
    if (timeLeft <= 0 && running) {
      // timer fini
      saveRun();
      setRunning(false);
      // Celebrate the end of a run (respect reduced motion)
      const prefersReduced = (() => { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
      if (!prefersReduced) setTimeout(() => burstConfetti({}), 50);
    }
  }, [timeLeft, running]);

  useEffect(() => {
    // Si on arrête manuellement avant la fin, on sauvegarde aussi
    if (!running && (score > 0 || attempts > 0) && timeLeft > 0 && !savedRef.current) {
      saveRun();
    }
  }, [running]);

  const timeFmt = useMemo(() => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [timeLeft]);

  const disabled = !running || timeLeft <= 0;

  return (
    <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px' }}>
      <h2 className="page-title" style={{ marginTop: 12 }}>🏁 Mode Course — Résous un max d’équations</h2>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr' }}>
        <section className="card section">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <label>Durée
              <select value={duration} onChange={(e)=>setDuration(Number(e.target.value))} style={{ marginLeft: 8 }} disabled={running}>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>120s</option>
              </select>
            </label>
            <label>Difficulté
              <select value={level} onChange={(e)=>setLevel(e.target.value)} style={{ marginLeft: 8 }} disabled={running}>
                <option value="easy">Facile</option>
                <option value="med">Moyen</option>
                <option value="hard">Difficile</option>
              </select>
            </label>
            {!running ? (
              <button className="btn btn-primary" onClick={start} style={{ marginLeft: 'auto' }}>Démarrer</button>
            ) : (
              <button className="btn" onClick={stop} style={{ marginLeft: 'auto' }}>Stop</button>
            )}
            <div style={{ marginLeft: 'auto', fontWeight: 600 }}>Temps: {timeFmt}</div>
            <div style={{ fontWeight: 600 }}>Score: {score}</div>
            <div style={{ opacity: 0.7 }}>Essais: {attempts}</div>
          </div>

          <div style={{ marginTop: 16, fontSize: 22, textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}>Résous:</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{eq.text}</div>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <input
              ref={inputRef}
              type="number"
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              placeholder="Ta réponse"
              disabled={disabled}
              className="input"
              style={{ fontSize: 18, width: 200 }}
            />
            <button type="submit" className="btn btn-primary" disabled={disabled}>Valider</button>
          </form>

          {timeLeft <= 0 && (
            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 16 }}>
              OK ⏱️ — Score: <b>{score}</b> (Essais: {attempts})
            </div>
          )}
          {saveMsg && (
            <div style={{ marginTop: 8, textAlign: 'center', fontSize: 14 }}>{saveMsg}</div>
          )}
        </section>

        <section className="card section">
          <h3 style={{ marginTop: 0 }}>Historique récent</h3>
          {history.length === 0 ? (
            <div style={{ fontSize: 14, opacity: 0.7 }}>(Aucune tentative)</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {history.map((h, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: h.ok ? '#16a34a' : '#dc2626' }} />
                  <code style={{ fontSize: 14, flex: 1 }}>{h.q}</code>
                  <span style={{ opacity: 0.7 }}>= {h.a}</span>
                  <span style={{ marginLeft: 'auto' }}>Ta: {h.g}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
