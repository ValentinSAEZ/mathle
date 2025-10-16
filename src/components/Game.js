import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { burstConfetti, pulseOnce } from "../lib/celebrate";

/** ---------- Utils dates (UTC) ---------- **/

function getUTCDateKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // ex: 2025-10-13
}

function msUntilNextUTCMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1, // jour suivant
    0, 0, 0, 0
  ));
  return next - now;
}

// Helpers pour stats personnelles (UTC)
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

/** ---------- Prefers reduced motion ---------- **/
const prefersReducedMotion = () => {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** ---------- Composant principal ---------- **/

export default function Game({ session }) {
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(msUntilNextUTCMidnight());
  const [history, setHistory] = useState([]); // [{t, guess, result}]
  const [loading, setLoading] = useState(false);
  const [solved, setSolved] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const submitBtnRef = useRef(null);

  // Énigme chargée depuis le serveur (intègre les overrides côté DB)
  // { riddle_id, type, question }
  const [riddle, setRiddle] = useState(null);
  const [riddleLoading, setRiddleLoading] = useState(false);
  const [riddleError, setRiddleError] = useState('');
  const [shareMsg, setShareMsg] = useState('');
  const [awardsToday, setAwardsToday] = useState([]);

  // Stats personnelles (fallback local)
  const [greetingName, setGreetingName] = useState('');
  const [selfLoading, setSelfLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [avgAttempts, setAvgAttempts] = useState(null);

  const dayKey = getUTCDateKey();
  const days = 42;
  const end = useMemo(() => startOfUTCDay(new Date()), []);
  const start = useMemo(() => addDaysUTC(end, -(days - 1)), [end]);

  // Compte à rebours vers minuit UTC
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

  // Charger l'historique du jour depuis Supabase
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

      const arr = (data || []).map((a) => ({
        t: a.created_at,
        guess: String(a.guess),
        result: a.result,
    }));

      setHistory(arr);
      setSolved(arr.some((x) => x.result === "correct"));
    } catch (e) {
      console.error(e);
      setFeedback("Impossible de charger l'historique pour le moment.");
    } finally {
      setLoading(false);
    }
  }, [session, dayKey]);

  useEffect(() => {
    loadHistory();
    // réinitialiser les messages/champs au changement de jour
    setFeedback("");
    setGuess("");
  }, [loadHistory, dayKey]);

  // Charger l'énigme du jour depuis Supabase (inclut override serveur)
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
      const detail = e?.message || e?.error?.message || e?.hint || e?.details || '';
      setRiddleError(detail || 'Échec de chargement de l’énigme');
    } finally {
      setRiddleLoading(false);
    }
  }, [dayKey]);

  useEffect(() => {
    loadRiddle();
  }, [loadRiddle]);

  // Charger stats personnelles (nom, streak, moyenne d’essais)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setSelfLoading(true);
        const uid = session?.user?.id;
        const email = session?.user?.email || '';
        if (!uid) { if (mounted) setSelfLoading(false); return; }

        // Nom d’accueil
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', uid)
            .maybeSingle();
          const name = (prof?.username && String(prof.username).trim()) || (email.split('@')[0] || 'Utilisateur');
          if (mounted) setGreetingName(name);
        } catch {
          if (mounted) setGreetingName(email.split('@')[0] || 'Utilisateur');
        }

        // Streak (vue user_completions si dispo)
        try {
          const { data: comp } = await supabase
            .from('user_completions')
            .select('day_key, solved')
            .eq('user_id', uid)
            .gte('day_key', dateKeyUTC(start))
            .lte('day_key', dateKeyUTC(end));
          const map = new Map();
          for (const row of comp || []) map.set(String(row.day_key), Boolean(row.solved));
          const range = [];
          for (let i = 0; i < days; i++) { const dt = addDaysUTC(start, i); range.push(dateKeyUTC(dt)); }
          let s = 0; for (let i = range.length - 1; i >= 0; i--) { const k = range[i]; if (map.get(k) === true) s++; else break; }
          if (mounted) setStreak(s);
        } catch {
          try {
            const { data: atts } = await supabase
              .from('attempts')
              .select('day_key, result')
              .eq('user_id', uid)
              .gte('day_key', dateKeyUTC(start))
              .lte('day_key', dateKeyUTC(end));
            const map = new Map();
            for (const row of atts || []) { const k = String(row.day_key); if (row.result === 'correct') map.set(k, true); else if (!map.has(k)) map.set(k, false); }
            const range = [];
            for (let i = 0; i < days; i++) { const dt = addDaysUTC(start, i); range.push(dateKeyUTC(dt)); }
            let s = 0; for (let i = range.length - 1; i >= 0; i--) { const k = range[i]; if (map.get(k) === true) s++; else break; }
            if (mounted) setStreak(s);
          } catch {}
        }

        // Moyenne d’essais jusqu’à réussite
        try {
          const { data: atts } = await supabase
            .from('attempts')
            .select('day_key, created_at, result')
            .eq('user_id', uid)
            .gte('day_key', dateKeyUTC(start))
            .lte('day_key', dateKeyUTC(end))
            .order('created_at', { ascending: true });
          const byDay = new Map();
          for (const a of atts || []) { const k = String(a.day_key); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push({ created_at: a.created_at, result: a.result }); }
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

  // Se mettre à jour immédiatement lors d'un override (événement local depuis AdminPanel)
  useEffect(() => {
    const handler = (e) => {
      const dk = e?.detail?.dayKey;
      if (dk && dk !== dayKey) return;
      setSolved(false);
      setFeedback("");
      setGuess("");
      setHistory([]);
      loadRiddle();
      loadHistory();
    };
    window.addEventListener('mathle:override-updated', handler);
    return () => window.removeEventListener('mathle:override-updated', handler);
  }, [dayKey, loadRiddle, loadHistory]);

  // Vérifier si l'utilisateur est banni (helper réutilisable)
  const checkBan = useCallback(async () => {
    if (!session?.user?.id) { setIsBanned(false); return false; }
    try {
      const { data } = await supabase
        .from('bans')
        .select('banned')
        .eq('user_id', session.user.id)
        .maybeSingle();
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

    if (!guess || !session) return;
    if (isBanned) {
      const bannedNow = await checkBan();
      if (bannedNow) {
        setFeedback("Ton compte est banni. Contacte un administrateur.");
        setGuess("");
        return;
      }
      // si l'état était obsolète, on continue
    }

    // déjà résolu → on n'autorise plus d'essais
    if (solved) {
      setFeedback("Tu as déjà résolu l’énigme du jour 🎉");
      setGuess("");
      return;
    }

    // Validation côté serveur via RPC (qui enregistre aussi l'essai)
    try {
      if (!riddle) return;
      if (riddle.type === 'number') {
        const g = Number(guess);
        if (Number.isNaN(g)) { setFeedback('Entre un nombre 😉'); return; }
      }

      const { data, error } = await supabase.rpc('submit_guess', {
        p_day: dayKey,
        p_guess: String(guess),
      });
      if (error) throw error;
      const result = typeof data === 'string' ? data : String(data || 'wrong');

      let msg = '';
      if (result === 'correct') msg = '🎉 Bravo, bonne réponse !';
      else if (result === 'low') msg = 'Trop petit !';
      else if (result === 'high') msg = 'Trop grand !';
      else msg = 'Ce n’est pas ça… réessaie !';

      // Optimistic update local (le serveur a déjà inséré la tentative)
      const newEntry = { t: new Date().toISOString(), guess: String(guess), result };
      setHistory((h) => [newEntry, ...h]);
      if (result === 'correct') {
        setSolved(true);
        if (!prefersReducedMotion()) burstConfetti({ originEl: submitBtnRef.current });
        pulseOnce(submitBtnRef.current);
        // Compose share message
        try {
          const attempts = (history?.length || 0) + 1;
          const day = dayKey;
          const bar = [...[...history].reverse(), { result: 'correct' }]
            .map(h => h.result === 'correct' ? '🟩' : (h.result === 'low' ? '🔵' : (h.result === 'high' ? '🔴' : '⬜')))
            .join('');
          const url = `${window.location.origin}/archive?day=${day}`;
          const text = `BrainteaserDay ${day} — ${attempts} essai${attempts>1?'s':''}\n${bar}\n${url}`;
          setShareMsg(text);
        } catch {}

        // Fetch achievements awarded today
        try {
          const { data: awd } = await supabase.rpc('get_awards_for_day', { p_day: dayKey });
          if (Array.isArray(awd)) setAwardsToday(awd);
        } catch {}
      }
      setFeedback(msg);
      setGuess('');
    } catch (e) {
      console.error(e);
      const raw = (e?.message || e?.error?.message || e?.error_description || e?.hint || e?.details || '').toLowerCase();
      if (raw.includes('rate') && raw.includes('limit')) {
        setFeedback('Trop d’essais, réessaie dans quelques secondes.');
      } else if (raw.includes('already') && raw.includes('solv')) {
        setSolved(true);
        setFeedback('Tu as déjà résolu l’énigme du jour 🎉');
      } else if (raw.includes('banned')) {
        // Vérifie l'état réel côté serveur avant d'afficher le ban
        const bannedNow = await checkBan();
        if (bannedNow) setFeedback('Ton compte est banni. Contacte un administrateur.');
        else setFeedback('Erreur momentanée, réessaie.');
      } else if (raw.includes('guess') && raw.includes('required')) {
        setFeedback('Entre une réponse 😉');
      } else {
        setFeedback('Erreur lors de l’enregistrement de ta réponse. Réessaie.');
      }
    }
  };

  const onClickFinished = () => {
    // Allow replay of celebration when clicking "OK"
    if (!prefersReducedMotion()) burstConfetti({ originEl: submitBtnRef.current });
    pulseOnce(submitBtnRef.current);
  };

  return (
    <div style={{ maxWidth: 760, margin: "80px auto", padding: "0 16px" }}>
      <h1 className="page-title">
        <img
          className="brand-inline"
          src="/brand/logo.png"
          alt="Logo"
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.insertAdjacentText('afterbegin', '🧩 '); }}
        />
        BrainteaserDay — L’énigme du jour
      </h1>

      <div style={{ textAlign: "center", margin: "12px 0", fontSize: 14, opacity: 0.8 }}>
        {`Énigme du ${dayKey} (UTC) • Prochaine dans ${timeParts.h}h ${timeParts.m}m ${timeParts.s}s`}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 18, lineHeight: 1.5, marginBottom: 16 }}>
          {riddleLoading && <span>Chargement de l’énigme…</span>}
          {!riddleLoading && riddle && String(riddle.question || '')
            .split(/\n{2,}/)
            .map((para, i) => (
              <p key={i} style={{ margin: '0 0 12px 0', whiteSpace: 'pre-line' }}>
                {para}
              </p>
            ))}
          {!riddleLoading && !riddle && (
            <div>
              <div>Énigme indisponible pour le moment.</div>
              {riddleError && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>Détail: {riddleError}</div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Ta réponse"
            disabled={loading || solved || isBanned || riddleLoading || !riddle}
            className="input"
            style={{ flex: 1, background: (solved || isBanned) ? "var(--input-disabled-bg)" : "var(--input-bg)" }}
          />
          <button
            ref={submitBtnRef}
            type={solved ? "button" : "submit"}
            onClick={solved ? onClickFinished : undefined}
            disabled={loading || isBanned || riddleLoading || !riddle}
            className={`btn ${solved ? 'btn-finished' : 'btn-primary'}`}
          >
            {isBanned ? "Banni" : (solved ? "OK" : "Valider")}
          </button>
        </form>

        {solved && shareMsg && (
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              onClick={async ()=>{ try { await navigator.clipboard.writeText(shareMsg); setFeedback('Résultat copié 📋'); } catch { setFeedback('Impossible de copier'); } }}
            >
              Partager le résultat
            </button>
            <a className="btn" href={`/archive?day=${dayKey}`}>
              Voir l’archive du jour
            </a>
          </div>
        )}

        {solved && awardsToday && awardsToday.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {awardsToday.map((a, i) => (
              <span key={`${a.key}-${i}`} className="lb-pill" title={a.title || a.key}>
                🏅 {a.title || a.key}
              </span>
            ))}
          </div>
        )}

        {feedback && (
          <div style={{ marginTop: 16, fontSize: 16 }}>
            {feedback}
          </div>
        )}
      </div>

      {/* Historique du jour (DB) */}
      <div className="card" style={{ marginTop: 18, padding: 16, background: "var(--surface-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Historique des réponses (aujourd’hui)</h3>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            {loading ? "Chargement…" : `${history.length} tentative(s)`}
          </div>
        </div>

        {history.length === 0 ? (
          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.7 }}>
            (Aucune tentative pour l’instant)
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
            {history.map((h, i) => (
              <li
                key={`${h.t}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  marginBottom: 8,
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 12,
                }}
              >
                <span
                  title={h.result}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background:
                      h.result === "correct"
                        ? "#16a34a"
                        : h.result === "low"
                        ? "#2563eb"
                        : h.result === "high"
                        ? "#dc2626"
                        : "#6b7280",
                    flexShrink: 0,
                  }}
                />
                <code style={{ fontSize: 14 }}>{h.guess}</code>
                <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                  {new Date(h.t).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stats personnelles (fallback local) */}
      <div className="card" style={{ marginTop: 18, padding: 16 }}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>📈 Stats</h3>
        {selfLoading ? (
          <div>Chargement…</div>
        ) : (
          <div>
            <div style={{ fontSize: 16, marginBottom: 6 }}>Bonjour{greetingName ? `, ${greetingName}` : ''} 👋</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span className="lb-pill">Série actuelle: {streak} jour{streak > 1 ? 's' : ''}</span>
              <span className="lb-pill">Moyenne d’essais: {avgAttempts == null ? '—' : Number(avgAttempts).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
