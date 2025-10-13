import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function getUTCDateKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function initialsOf(name) {
  try {
    const parts = String(name || '').trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const a = (parts[0][0] || '').toUpperCase();
    const b = (parts[1]?.[0] || '').toUpperCase();
    return (a + b) || a || '?';
  } catch { return '?'; }
}

export default function Leaderboard({ onSelectUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dayKey = useMemo(() => getUTCDateKey(), []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Use RPC aggregated on server for today's leaderboard
        const { data, error } = await supabase
          .rpc('get_leaderboard_today');

        if (error) throw error;

        const counts = new Map((data || []).map(r => [r.user_id, r.attempts]));

        const userIds = Array.from(counts.keys());
        let namesById = new Map();
        if (userIds.length > 0) {
          try {
            const { data: profs, error: errProfiles } = await supabase
              .from('profiles')
              .select('id, username')
              .in('id', userIds);
            if (!errProfiles && Array.isArray(profs)) {
              namesById = new Map(profs.map(p => [p.id, p.username || '']));
            }
          } catch {}
        }

        const items = userIds
          .map((uid) => ({
            userId: uid,
            name: namesById.get(uid) || `Utilisateur ${String(uid).slice(0, 8)}…`,
            attempts: counts.get(uid) || 0,
          }))
          .sort((a, b) => a.attempts - b.attempts || a.name.localeCompare(b.name))
          .slice(0, 10);

        if (mounted) setRows(items);
      } catch (e) {
        console.error(e);
        if (mounted) setError('Leaderboard indisponible. (RLS/politiques à ajuster)');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const onOverride = () => load();
    window.addEventListener('mathle:override-updated', onOverride);
    const t = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(t); window.removeEventListener('mathle:override-updated', onOverride); };
  }, [dayKey]);

  return (
    <aside className="leaderboard-aside card section leaderboard">
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>🏆 Leaderboard</h3>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{`Jour: ${dayKey}`}</div>
      {loading && <div>Chargement…</div>}
      {error && <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div style={{ fontSize: 14, opacity: 0.7 }}>(Aucune donnée pour aujourd’hui)</div>
      )}
      {!loading && !error && rows.length > 0 && (
        <div className="lb-list">
          {rows.map((r, idx) => (
            <button
              key={r.userId}
              type="button"
              className="lb-row"
              title={`Voir le profil de ${r.name}`}
              onClick={() => onSelectUser?.(r.userId)}
            >
              <span className={`lb-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>{idx + 1}</span>
              <span className="lb-avatar" aria-hidden>{initialsOf(r.name)}</span>
              <span className="lb-name">{r.name}</span>
              <span className="lb-pill">{r.attempts} tentative{r.attempts > 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
