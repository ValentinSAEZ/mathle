import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function addDaysUTC(date, days) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function startOfUTCDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}


export default function StatsToday() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [raceBestScore, setRaceBestScore] = useState(null);
  const [raceBestToday, setRaceBestToday] = useState(null);
  const [raceRunsCount, setRaceRunsCount] = useState(null);

  const days = 42;
  const end = useMemo(() => startOfUTCDay(new Date()), []);
  const start = useMemo(() => addDaysUTC(end, -(days - 1)), [end]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_day_stats');
        if (error) throw error;
        if (mounted) setData(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        if (!uid) return;

        try {
          const { data: bestRows } = await supabase.from('race_runs').select('score').eq('user_id', uid).order('score', { ascending: false }).limit(1);
          if (mounted) setRaceBestScore(bestRows?.[0]?.score ?? 0);
        } catch { if (mounted) setRaceBestScore(null); }

        try {
          const dayStart = startOfUTCDay(new Date());
          const dayEnd = addDaysUTC(dayStart, 1);
          const { data: bestTodayRows } = await supabase.from('race_runs').select('score').eq('user_id', uid).gte('created_at', dayStart.toISOString()).lt('created_at', dayEnd.toISOString()).order('score', { ascending: false }).limit(1);
          if (mounted) setRaceBestToday(bestTodayRows?.[0]?.score ?? 0);
        } catch { if (mounted) setRaceBestToday(null); }

        try {
          const { count } = await supabase.from('race_runs').select('id', { count: 'exact', head: true }).eq('user_id', uid);
          if (mounted) setRaceRunsCount(typeof count === 'number' ? count : null);
        } catch { if (mounted) setRaceRunsCount(null); }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [start, end]);

  const rate = data?.total_players > 0 ? Math.round((data.solvers / data.total_players) * 100) : 0;
  const dist = data?.distribution || {};

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Global stats header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Stats du jour</h3>
      </div>

      <div style={{ padding: 18 }}>
        {loading && !data ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>Chargement...</div>
        ) : (
          <>
            {data && (
              <>
                <div className="stat-grid" style={{ marginBottom: 16 }}>
                  <div className="stat-card">
                    <div className="stat-value">{data.total_players}</div>
                    <div className="stat-label">Joueurs</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{data.solvers}</div>
                    <div className="stat-label">Résolus ({rate}%)</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{Number(data.avg_attempts || 0).toFixed(1)}</div>
                    <div className="stat-label">Moy. essais</div>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Distribution
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Array.from({ length: 6 }).map((_, i) => {
                      const k = String(i + 1);
                      const v = dist[k] || 0;
                      return <span key={k} className="lb-pill">{k}: {v}</span>;
                    })}
                    <span className="lb-pill">&gt;6: {dist['>6'] || 0}</span>
                  </div>
                </div>
              </>
            )}

            {/* Race stats */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                Mode Course
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="lb-pill">Meilleur: {raceBestScore == null ? '—' : raceBestScore}</span>
                <span className="lb-pill">Aujourd'hui: {raceBestToday == null ? '—' : raceBestToday}</span>
                <span className="lb-pill">Runs: {raceRunsCount == null ? '—' : raceRunsCount}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
