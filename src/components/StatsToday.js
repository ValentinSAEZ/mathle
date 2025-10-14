import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function StatsToday() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const { data, error } = await supabase.rpc('get_day_stats');
        if (error) throw error;
        if (mounted) setData(data);
      } catch (e) {
        console.error(e);
        if (mounted) setError('Stats indisponibles');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="card" style={{ marginTop: 12, padding: 16 }}>Chargement des stats…</div>;
  if (error) return <div className="card" style={{ marginTop: 12, padding: 16 }}>{error}</div>;
  if (!data) return null;

  const rate = data.total_players > 0 ? Math.round((data.solvers / data.total_players) * 100) : 0;
  const dist = data.distribution || {};

  return (
    <div className="card" style={{ marginTop: 12, padding: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>📊 Stats du jour</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span className="lb-pill">Joueurs: {data.total_players}</span>
        <span className="lb-pill">Résolus: {data.solvers} ({rate}%)</span>
        <span className="lb-pill">Moy. essais (réussite): {Number(data.avg_attempts || 0).toFixed(2)}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Distribution jusqu’à réussite</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const k = String(i + 1);
            const v = dist[k] || 0;
            return <span key={k} className="lb-pill">{k}: {v}</span>;
          })}
          <span className="lb-pill">&gt;6: {dist['>6'] || 0}</span>
        </div>
      </div>
    </div>
  );
}

