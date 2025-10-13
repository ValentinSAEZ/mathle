import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function getUTCDateKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
        const { data, error } = await supabase
          .from('attempts')
          .select('user_id')
          .eq('day_key', dayKey);

        if (error) throw error;

        const counts = new Map();
        for (const r of data || []) {
          counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
        }

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
    <aside
      style={{
        position: 'sticky',
        top: 24,
        alignSelf: 'start',
        background: 'white',
        border: '1px solid #eee',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>🏆 Leaderboard</h3>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
        {`Jour: ${dayKey}`}
      </div>
      {loading && <div>Chargement…</div>}
      {error && (
        <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div style={{ fontSize: 14, opacity: 0.7 }}>(Aucune donnée pour aujourd’hui)</div>
      )}
      {!loading && !error && rows.length > 0 && (
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          {rows.map((r) => (
            <li key={r.userId} style={{ margin: '6px 0' }}>
              <button
                onClick={() => onSelectUser?.(r.userId)}
                title={`Voir le profil de ${r.name}`}
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: '#111',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                {r.name}
              </button>
              <span style={{ opacity: 0.7 }}> — {r.attempts} tentative{r.attempts > 1 ? 's' : ''}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
