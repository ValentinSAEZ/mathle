import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { bigCelebration, burstConfetti, pulseOnce, getLevelInfo, getXpProgress, RIDDLE_THEMES } from "../lib/celebrate";

function getUTCDateKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function msUntilNextUTCMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return next - now;
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

const prefersReducedMotion = () => {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export default function Game({ session }) {
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("");
  const [timeLeft, setTimeLeft] = useState(msUntilNextUTCMidnight());
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [solved, setSolved] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const submitBtnRef = useRef(null);
  const victoryRef = useRef(null);

  const [riddle, setRiddle] = useState(null);
  const [riddleLoading, setRiddleLoading] = useState(false);
  const [riddleError, setRiddleError] = useState('');
  const [shareMsg, setShareMsg] = useState('');
  const [awardsToday, setAwardsToday] = useState([]);
  const [showVictory, setShowVictory] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [userXp, setUserXp] = useState(0);

  const [greetingName, setGreetingName] = useState('');
  const [selfLoading, setSelfLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [avgAttempts, setAvgAttempts] = useState(null);

  const dayKey = getUTCDateKey();
  const days = 42;
  const end = useMemo(() => startOfUTCDay(new Date()), []);
  const start = useMemo(() => addDaysUTC(end, -(days - 1)), [end]);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(msUntilNextUTCMidnight()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeParts = (() => {
    const total = Math.max(0, timeLeft);
    const h = Math.floor(total / 3600000);
    const m = Math.floor((total % 3600000) / 60000);
    const s = Math.floor((total % 60000) / 1000);
    return { h, m, s };
  })();

  const loadHistory = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("created_at, guess, result")
        .eq("user_id", session.user.id)
        .eq("day_key", dayKey)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const arr = (data || []).map((a) => ({ t: a.created_at, guess: String(a.guess), result: a.result }));
      setHistory(arr);
      setSolved(arr.some((x) => x.result === "correct"));
    } catch (e) {
      console.error(e);
      setFeedback("Impossible de charger l'historique.");
      setFeedbackType("error");
    } finally {
      setLoading(false);
    }
  }, [session, dayKey]);

  useEffect(() => {
    loadHistory();
    setFeedback("");
    setFeedbackType("");
    setGuess("");
  }, [loadHistory, dayKey]);

  const loadRiddle = useCallback(async () => {
    setRiddleLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_daily_riddle', { p_day: dayKey });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setRiddle(row || null);
      setRiddleError('');
    } catch (e) {
      console.error(e);
      setRiddle(null);
      setRiddleError(e?.message || '');
    } finally {
      setRiddleLoading(false);
    }
  }, [dayKey]);

  useEffect(() => { loadRiddle(); }, [loadRiddle]);

  // Load user XP
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('xp').eq('id', session.user.id).maybeSingle();
        setUserXp(data?.xp || 0);
      } catch {}
    })();
  }, [session?.user?.id]);

  // Personal stats
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
          const name = (prof?.username && String(prof.username).trim()) || (email.split('@')[0] || 'Utilisateur');
          if (mounted) setGreetingName(name);
        } catch {
          if (mounted) setGreetingName(email.split('@')[0] || 'Utilisateur');
        }

        try {
          const { data: comp } = await supabase.from('user_completions').select('day_key, solved').eq('user_id', uid).gte('day_key', dateKeyUTC(start)).lte('day_key', dateKeyUTC(end));
          const map = new Map();
          for (const row of comp || []) map.set(String(row.day_key), Boolean(row.solved));
          const range = [];
          for (let i = 0; i < days; i++) range.push(dateKeyUTC(addDaysUTC(start, i)));
          let s = 0;
          for (let i = range.length - 1; i >= 0; i--) { if (map.get(range[i]) === true) s++; else break; }
          if (mounted) setStreak(s);
        } catch {
          try {
            const { data: atts } = await supabase.from('attempts').select('day_key, result').eq('user_id', uid).gte('day_key', dateKeyUTC(start)).lte('day_key', dateKeyUTC(end));
            const map = new Map();
            for (const row of atts || []) { const k = String(row.day_key); if (row.result === 'correct') map.set(k, true); else if (!map.has(k)) map.set(k, false); }
            const range = [];
            for (let i = 0; i < days; i++) range.push(dateKeyUTC(addDaysUTC(start, i)));
            let s = 0;
            for (let i = range.length - 1; i >= 0; i--) { if (map.get(range[i]) === true) s++; else break; }
            if (mounted) setStreak(s);
          } catch {}
        }

        try {
          const { data: atts } = await supabase.from('attempts').select('day_key, created_at, result').eq('user_id', uid).gte('day_key', dateKeyUTC(start)).lte('day_key', dateKeyUTC(end)).order('created_at', { ascending: true });
          const byDay = new Map();
          for (const a of atts || []) { const k = String(a.day_key); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(a); }
          const counts = [];
          for (const [, arr] of byDay.entries()) { const idx = arr.findIndex(x => x.result === 'correct'); if (idx >= 0) counts.push(idx + 1); }
          const avg = counts.length ? (counts.reduce((s, n) => s + n, 0) / counts.length) : null;
          if (mounted) setAvgAttempts(avg);
        } catch { if (mounted) setAvgAttempts(null); }
      } finally {
        if (mounted) setSelfLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [session?.user?.id, session?.user?.email, days, start, end]);

  useEffect(() => {
    const handler = (e) => {
      const dk = e?.detail?.dayKey;
      if (dk && dk !== dayKey) return;
      setSolved(false);
      setFeedback("");
      setFeedbackType("");
      setGuess("");
      setHistory([]);
      setShowVictory(false);
      loadRiddle();
      loadHistory();
    };
    window.addEventListener('mathle:override-updated', handler);
    return () => window.removeEventListener('mathle:override-updated', handler);
  }, [dayKey, loadRiddle, loadHistory]);

  const checkBan = useCallback(async () => {
    if (!session?.user?.id) { setIsBanned(false); return false; }
    try {
      const { data } = await supabase.from('bans').select('banned').eq('user_id', session.user.id).maybeSingle();
      const banned = Boolean(data?.banned);
      setIsBanned(banned);
      return banned;
    } catch {
      setIsBanned(false);
      return false;
    }
  }, [session?.user?.id]);

  useEffect(() => { checkBan(); }, [checkBan]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback("");
    setFeedbackType("");

    if (!guess || !session) return;
    if (isBanned) {
      const bannedNow = await checkBan();
      if (bannedNow) {
        setFeedback("Ton compte est banni. Contacte un administrateur.");
        setFeedbackType("error");
        setGuess("");
        return;
      }
    }

    if (solved) {
      setFeedback("Tu as deja resolu l'enigme du jour !");
      setFeedbackType("success");
      setGuess("");
      return;
    }

    try {
      if (!riddle) return;
      if (riddle.type === 'number') {
        const g = Number(guess);
        if (Number.isNaN(g)) { setFeedback('Entre un nombre valide.'); setFeedbackType("error"); return; }
      }

      const { data, error } = await supabase.rpc('submit_guess', { p_day: dayKey, p_guess: String(guess) });
      if (error) throw error;
      const result = typeof data === 'string' ? data : String(data || 'wrong');

      let msg = '';
      let type = '';
      if (result === 'correct') { msg = 'Bravo, bonne reponse !'; type = 'success'; }
      else if (result === 'low') { msg = 'Trop petit !'; type = 'error'; }
      else if (result === 'high') { msg = 'Trop grand !'; type = 'error'; }
      else { msg = "Ce n'est pas ca... reessaie !"; type = 'error'; }

      const newEntry = { t: new Date().toISOString(), guess: String(guess), result };
      setHistory((h) => [newEntry, ...h]);
      if (result === 'correct') {
        setSolved(true);

        // Calculate XP gained
        const attempts = (history?.length || 0) + 1;
        let xp = 10; // base XP
        if (attempts === 1) xp += 15; // first try bonus
        else if (attempts <= 3) xp += 8; // quick solve bonus
        else if (attempts <= 5) xp += 3;
        // streak bonus
        if (streak >= 7) xp += 5;
        if (streak >= 30) xp += 10;

        setXpGained(xp);

        // Award XP in DB
        try {
          const { data: newXp } = await supabase.rpc('award_xp', { p_user: session.user.id, p_amount: xp });
          if (typeof newXp === 'number') setUserXp(newXp);
          else setUserXp(prev => prev + xp);
        } catch {
          setUserXp(prev => prev + xp);
        }

        // Build share message
        try {
          const bar = [...[...history].reverse(), { result: 'correct' }]
            .map(h => h.result === 'correct' ? '\uD83D\uDFE9' : (h.result === 'low' ? '\uD83D\uDD35' : (h.result === 'high' ? '\uD83D\uDD34' : '\u2B1C')))
            .join('');
          const text = `BrainteaserDay ${dayKey} — ${attempts} essai${attempts>1?'s':''}\n${bar}\nhttps://brainteaserday.vercel.app`;
          setShareMsg(text);
        } catch {}

        // Load awards
        try {
          const { data: awd } = await supabase.rpc('get_awards_for_day', { p_day: dayKey });
          if (Array.isArray(awd)) setAwardsToday(awd);
        } catch {}

        // Show victory card with animation
        setShowVictory(true);
        if (!prefersReducedMotion()) {
          setTimeout(() => bigCelebration({ originEl: victoryRef.current || submitBtnRef.current }), 200);
        }
        pulseOnce(submitBtnRef.current);
      }
      setFeedback(msg);
      setFeedbackType(type);
      setGuess('');
    } catch (e) {
      console.error(e);
      const raw = (e?.message || '').toLowerCase();
      if (raw.includes('rate') && raw.includes('limit')) {
        setFeedback("Trop d'essais, reessaie dans quelques secondes.");
      } else if (raw.includes('already') && raw.includes('solv')) {
        setSolved(true);
        setFeedback("Tu as deja resolu l'enigme du jour !");
        setFeedbackType("success");
      } else if (raw.includes('banned')) {
        const bannedNow = await checkBan();
        if (bannedNow) setFeedback('Ton compte est banni.');
        else setFeedback('Erreur momentanee, reessaie.');
      } else {
        setFeedback("Erreur lors de l'enregistrement. Reessaie.");
      }
      setFeedbackType("error");
    }
  };

  const levelInfo = getLevelInfo(userXp);
  const xpProgress = getXpProgress(userXp);
  const theme = RIDDLE_THEMES[riddle?.theme] || RIDDLE_THEMES.general;

  return (
    <div>
      {/* Greeting & countdown */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        {!selfLoading && greetingName && (
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
            Bonjour, {greetingName}
          </div>
        )}
        <div className="countdown">
          <span>Prochaine enigme dans</span>
          <span className="countdown-digit">{String(timeParts.h).padStart(2,'0')}</span>
          <span>:</span>
          <span className="countdown-digit">{String(timeParts.m).padStart(2,'0')}</span>
          <span>:</span>
          <span className="countdown-digit">{String(timeParts.s).padStart(2,'0')}</span>
        </div>
      </div>

      {/* Theme badge */}
      {riddle && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <span className="theme-badge" style={{ '--theme-color': theme.color }}>
            <span>{theme.icon}</span> {theme.label}
          </span>
        </div>
      )}

      {/* Question card */}
      <div className="question-card" style={{ marginBottom: 16 }}>
        {riddleLoading && <span style={{ color: 'var(--muted)' }}>Chargement de l'enigme...</span>}
        {!riddleLoading && riddle && String(riddle.question || '')
          .split(/\n{2,}/)
          .map((para, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0', whiteSpace: 'pre-line' }}>{para}</p>
          ))}
        {!riddleLoading && !riddle && (
          <div>
            <div style={{ color: 'var(--muted)' }}>Enigme indisponible pour le moment.</div>
            {riddleError && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{riddleError}</div>}
          </div>
        )}
      </div>

      {/* Answer form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="Ta reponse"
          disabled={loading || solved || isBanned || riddleLoading || !riddle}
          className="input"
          style={{ flex: 1 }}
        />
        <button
          ref={submitBtnRef}
          type={solved ? "button" : "submit"}
          onClick={solved ? () => { if (!prefersReducedMotion()) burstConfetti({ originEl: submitBtnRef.current }); pulseOnce(submitBtnRef.current); } : undefined}
          disabled={loading || isBanned || riddleLoading || !riddle}
          className={`btn ${solved ? 'btn-finished' : 'btn-primary'}`}
          style={{ padding: '10px 24px' }}
        >
          {isBanned ? "Banni" : (solved ? "OK" : "Valider")}
        </button>
      </form>

      {/* Victory card */}
      {showVictory && (
        <div className="victory-card fade-in" ref={victoryRef}>
          <div className="victory-header">
            <div className="victory-emoji">🎉</div>
            <h3 className="victory-title">Bravo !</h3>
            <p className="victory-subtitle">
              Enigme resolue en {history.length} essai{history.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Attempt bar visualization */}
          <div className="victory-bar">
            {[...[...history].reverse()].map((h, i) => (
              <span key={i} className="victory-dot" style={{
                background: h.result === 'correct' ? 'var(--success)' : h.result === 'low' ? '#2563eb' : h.result === 'high' ? 'var(--danger)' : 'var(--muted)',
                animationDelay: `${i * 100}ms`
              }} title={h.guess} />
            ))}
          </div>

          {/* XP gained */}
          <div className="victory-xp">
            <span className="victory-xp-badge">+{xpGained} XP</span>
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

          {/* Awards */}
          {awardsToday?.length > 0 && (
            <div className="victory-awards">
              {awardsToday.map((a, i) => (
                <span key={`${a.key}-${i}`} className="victory-award-pill">
                  🏅 {a.title || a.key}
                </span>
              ))}
            </div>
          )}

          {/* Share buttons */}
          <div className="victory-actions">
            {shareMsg && (
              <button type="button" className="btn btn-primary" style={{ flex: 1 }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareMsg);
                    setFeedback('Resultat copie !');
                    setFeedbackType('success');
                  } catch {
                    setFeedback('Impossible de copier');
                    setFeedbackType('error');
                  }
                }}
              >
                📋 Partager
              </button>
            )}
            <button type="button" className="btn" onClick={() => setShowVictory(false)} style={{ flex: 1 }}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && !showVictory && (
        <div className={`feedback-msg ${feedbackType}`} style={{ marginBottom: 16 }}>
          {feedback}
        </div>
      )}

      {/* History */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Historique</h3>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {loading ? "Chargement..." : `${history.length} tentative${history.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div style={{ padding: history.length ? '8px' : '16px' }}>
          {history.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>Aucune tentative pour l'instant</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {history.map((h, i) => (
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

      {/* Personal stats with XP */}
      {!selfLoading && (
        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="stat-card">
            <div className="stat-value">{streak}</div>
            <div className="stat-label">Jour{streak > 1 ? 's' : ''} de serie</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{avgAttempts == null ? '—' : Number(avgAttempts).toFixed(1)}</div>
            <div className="stat-label">Moy. essais</div>
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
