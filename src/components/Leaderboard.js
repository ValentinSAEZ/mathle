import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function getUTCDateKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function initialsOf(name) {
  try {
    const parts = String(name || '').trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
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
      setLoading(true); setError('');
      try {
        const { data, error } = await supabase.rpc('get_leaderboard_today_full');
        if (error) throw error;
        const items = (Array.isArray(data) ? data : [])
          .map((r) => ({
            userId: r.user_id,
            name: (r.username && String(r.username).trim()) || `Utilisateur ${String(r.user_id || '').slice(0, 8)}…`,
            attempts: r.attempts || 0,
            tts: r.time_to_solve_seconds ?? null,
          }))
          .sort((a, b) => a.attempts - b.attempts || a.name.localeCompare(b.name))
          .slice(0, 10);
        if (mounted) setRows(items);
      } catch (e) {
        console.error(e);
        if (mounted) setError('Leaderboard indisponible.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    window.addEventListener('mathle:override-updated', load);
    const t = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(t); window.removeEventListener('mathle:override-updated', load); };
  }, [dayKey]);

  return (
    <aside className="leaderboard-aside card leaderboard" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Classement</h3>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{dayKey}</span>
      </div>

      <div style={{ padding: '8px' }}>
        {loading && rows.length === 0 && <div style={{ padding: 12, color: 'var(--muted)', fontSize: 14, textAlign: 'center' }}>Chargement…</div>}
        {error && <div style={{ padding: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: 12, fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>Aucune donnée aujourd'hui</div>
        )}
        {rows.length > 0 && (
          <div className="lb-list">
            {rows.map((r, idx) => (
              <button key={r.userId} type="button" className="lb-row"
                title={`Voir le profil de ${r.name}`}
                onClick={() => onSelectUser?.(r.userId)}
              >
                <span className={`lb-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>{idx + 1}</span>
                <span className="lb-avatar" aria-hidden>{initialsOf(r.name)}</span>
                <span className="lb-name">{r.name}</span>
                <span className="lb-pill">{r.attempts} essai{r.attempts > 1 ? 's' : ''}</span>
                {r.tts != null && (
                  <span className="lb-pill" title="Temps">
                    {Math.floor(r.tts/60)}:{String(Math.floor(r.tts%60)).padStart(2,'0')}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
