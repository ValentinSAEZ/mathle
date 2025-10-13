import React, { useEffect, useMemo, useState, useCallback } from "react";
import riddles from "../data/riddles.json";
import { supabase } from "../lib/supabaseClient";

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

  // Permet une énigme override depuis Supabase
  const [overrideRiddle, setOverrideRiddle] = useState(null);
  const [overrideRiddleId, setOverrideRiddleId] = useState(null);

  const dayKey = getUTCDateKey();

  // Choix déterministe de l'énigme du jour (UTC)
  const { riddle: defaultRiddle, riddleIndex: defaultRiddleIndex } = useMemo(() => {
    const idx = stringHash(dayKey) % riddles.length;
    return { riddle: riddles[idx], riddleIndex: idx };
  }, [dayKey]);

  // Riddle effectif (override si présent)
  const riddle = overrideRiddle || defaultRiddle;
  const riddleIndex = overrideRiddleId ?? defaultRiddleIndex;

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

  // Charger une éventuelle override d'énigme (jour courant) + poll périodique
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('riddle_overrides')
          .select('riddle_id, question, answer, type')
          .eq('day_key', dayKey)
          .maybeSingle();
        if (error) throw error;
        if (!mounted) return;
        if (!data) {
          setOverrideRiddle(null);
          setOverrideRiddleId(null);
          return;
        }
        if (data.riddle_id != null) {
          const match = riddles.find((r) => Number(r.id) === Number(data.riddle_id));
          if (match) {
            setOverrideRiddle(match);
            setOverrideRiddleId(match.id);
            return;
          }
        }
        if (data.question && data.type && (data.answer ?? '') !== '') {
          const custom = {
            type: data.type,
            question: data.question,
            answer: data.type === 'number' ? Number(data.answer) : String(data.answer),
          };
          setOverrideRiddle(custom);
          setOverrideRiddleId(-1);
        } else {
          setOverrideRiddle(null);
          setOverrideRiddleId(null);
        }
      } catch (e) {
        // En cas d'erreur (table absente/RLS), ignorer l'override
        setOverrideRiddle(null);
        setOverrideRiddleId(null);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, [dayKey]);

  // Recharger l'historique si override change (p.ex. après reset par admin)
  useEffect(() => {
    loadHistory();
  }, [overrideRiddleId]);

  // Réagit immédiatement à un override déclenché par l'admin (événement local)
  useEffect(() => {
    const handler = (e) => {
      const dk = e?.detail?.dayKey;
      if (dk && dk !== dayKey) return;
      // Débloque immédiatement l'UI localement
      setSolved(false);
      setFeedback("");
      setGuess("");
      setHistory([]);
      // Recharge override et historique depuis la DB
      (async () => {
        try {
          const { data } = await supabase
            .from('riddle_overrides')
            .select('riddle_id, question, answer, type')
            .eq('day_key', dayKey)
            .maybeSingle();
          if (!data) {
            setOverrideRiddle(null);
            setOverrideRiddleId(null);
          } else if (data.riddle_id != null) {
            const match = riddles.find((r) => Number(r.id) === Number(data.riddle_id));
            if (match) { setOverrideRiddle(match); setOverrideRiddleId(match.id); }
          } else if (data.question && data.type && (data.answer ?? '') !== '') {
            setOverrideRiddle({
              type: data.type,
              question: data.question,
              answer: data.type === 'number' ? Number(data.answer) : String(data.answer),
            });
            setOverrideRiddleId(-1);
          } else {
            setOverrideRiddle(null);
            setOverrideRiddleId(null);
          }
        } catch {}
        await loadHistory();
      })();
    };
    window.addEventListener('mathle:override-updated', handler);
    return () => window.removeEventListener('mathle:override-updated', handler);
  }, [dayKey, loadHistory]);

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

    let result = "wrong";
    let msg = "";

    if (riddle.type === "number") {
      const g = Number(guess);
      if (Number.isNaN(g)) {
        setFeedback("Entre un nombre 😉");
        return;
      }
      const ans = Number(riddle.answer);
      if (g === ans) {
        result = "correct";
        msg = "🎉 Bravo, bonne réponse !";
      } else if (g < ans) {
        result = "low";
        msg = "Trop petit !";
      } else {
        result = "high";
        msg = "Trop grand !";
      }
    } else if (riddle.type === "word") {
      const g = normalize(guess);
      const ans = normalize(String(riddle.answer));
      if (g === ans) {
        result = "correct";
        msg = "🎉 Bravo, bonne réponse !";
      } else {
        result = "wrong";
        // indice simple après 3 essais
        const attemptsSoFar = history.length + 1;
        if (attemptsSoFar >= 3 && ans.length > 0) {
          msg = `Ce n’est pas ça… Indice: ça commence par “${ans[0]}”`;
        } else {
          msg = "Ce n’est pas ça… réessaie !";
        }
      }
    } else {
      msg = "Type d’énigme non géré (à ajouter).";
    }

    // Insertion en base (persistée)
    try {
      const payload = {
        day_key: dayKey,                        // stocké en date (UTC) côté DB
        riddle_id: riddle.id ?? riddleIndex,    // garde l'id si présent, sinon index
        // Si la colonne "guess" est numérique côté DB, envoyer un nombre; sinon, envoyer une chaîne
        guess: riddle.type === "number" ? Number(guess) : String(guess),
        result,
      };
      const { error } = await supabase.from("attempts").insert(payload);
      if (error) throw error;

      // Optimistic update local
      const newEntry = {
        t: new Date().toISOString(),
        guess: String(guess),
        result,
      };
      setHistory((h) => [newEntry, ...h]);
      if (result === "correct") setSolved(true);

      setFeedback(msg);
      setGuess("");
    } catch (e) {
      console.error(e);
      const msgDetail = e?.message || e?.error_description || e?.hint || "";
      setFeedback(`Erreur lors de l’enregistrement de ta réponse.${msgDetail ? " " + msgDetail : ""}`);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "80px auto", padding: "0 16px" }}>
      <h1 style={{ textAlign: "center" }}>🧩 BrainteaserDay — L’énigme du jour</h1>

      <div style={{ textAlign: "center", margin: "12px 0", fontSize: 14, opacity: 0.8 }}>
        {`Énigme du ${dayKey} (UTC) • Prochaine dans ${timeParts.h}h ${timeParts.m}m ${timeParts.s}s`}
      </div>

      <div
        style={{
          padding: 20,
          borderRadius: 16,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          background: "white",
        }}
      >
        <div style={{ fontSize: 18, lineHeight: 1.5, marginBottom: 16 }}>
          {String(riddle.question || '')
            .split(/\n{2,}/)
            .map((para, i) => (
              <p key={i} style={{ margin: '0 0 12px 0', whiteSpace: 'pre-line' }}>
                {para}
              </p>
            ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Ta réponse"
            disabled={loading || solved || isBanned}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 16,
              background: (solved || isBanned) ? "#f3f4f6" : "white",
            }}
          />
          <button
            type="submit"
            disabled={loading || solved || isBanned}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "none",
              background: (solved || isBanned) ? "#9ca3af" : "#111",
              color: "white",
              fontSize: 16,
              cursor: (loading || solved || isBanned) ? "not-allowed" : "pointer",
            }}
          >
            {isBanned ? "Banni" : (solved ? "Terminé" : "Valider")}
          </button>
        </form>

        {feedback && (
          <div style={{ marginTop: 16, fontSize: 16 }}>
            {feedback}
          </div>
        )}
      </div>

      {/* Historique du jour (DB) */}
      <div
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: 16,
          background: "#f9fafb",
          border: "1px solid #eee",
        }}
      >
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
