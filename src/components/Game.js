import React, { useEffect, useState, useCallback, useRef } from "react";
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

/** ---------- Utils jeu ---------- **/

function stringHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const normalize = (s) =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

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

  const dayKey = getUTCDateKey();

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

  // Vérifier si l'utilisateur est banni
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!session?.user?.id) { setIsBanned(false); return; }
      try {
        const { data } = await supabase
          .from('bans')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (mounted) setIsBanned(Boolean(data));
      } catch (e) {
        if (mounted) setIsBanned(false);
      }
    })();
    return () => { mounted = false; };
  }, [session?.user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback("");

    if (!guess || !session) return;
    if (isBanned) {
      setFeedback("Ton compte est banni. Contacte un administrateur.");
      return;
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
        burstConfetti({ originEl: submitBtnRef.current });
        pulseOnce(submitBtnRef.current);
      }
      setFeedback(msg);
      setGuess('');
    } catch (e) {
      console.error(e);
      const msgDetail = e?.message || e?.error_description || e?.hint || '';
      setFeedback(`Erreur lors de l’enregistrement de ta réponse.${msgDetail ? ' ' + msgDetail : ''}`);
    }
  };

  const onClickFinished = () => {
    // Allow replay of celebration when clicking "OK"
    burstConfetti({ originEl: submitBtnRef.current });
    pulseOnce(submitBtnRef.current);
  };

  return (
    <div style={{ maxWidth: 760, margin: "80px auto", padding: "0 16px" }}>
      <h1 className="page-title">🧩 BrainteaserDay — L’énigme du jour</h1>

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
            style={{ flex: 1, background: (solved || isBanned) ? "#f3f4f6" : "white" }}
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

        {feedback && (
          <div style={{ marginTop: 16, fontSize: 16 }}>
            {feedback}
          </div>
        )}
      </div>

      {/* Historique du jour (DB) */}
      <div className="card" style={{ marginTop: 18, padding: 16, background: "#f9fafb" }}>
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
                  background: "white",
                  border: "1px solid #eee",
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
    </div>
  );
}
