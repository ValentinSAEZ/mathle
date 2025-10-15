import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

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

export default function StatsToday() {
  // Global day stats
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Personal stats
  const [greetingName, setGreetingName] = useState('');
  const [streak, setStreak] = useState(0);
  const [avgAttempts, setAvgAttempts] = useState(null);
  const [selfLoading, setSelfLoading] = useState(true);

  const days = 42;
  const end = useMemo(() => startOfUTCDay(new Date()), []);
  const start = useMemo(() => addDaysUTC(end, -(days - 1)), [end]);

  // Load global day stats (best effort)
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
        if (mounted) setError(''); // Do not block the card; we'll still show personal stats
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load personal stats (username, streak, average attempts)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setSelfLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        const email = u?.user?.email || '';
        if (!uid) { if (mounted) setSelfLoading(false); return; }

        // Greeting name
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

        // Streak: use user_completions if available; fallback to attempts
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
          for (let i = 0; i < days; i++) {
            const dt = addDaysUTC(start, i);
            range.push(dateKeyUTC(dt));
          }
          let s = 0;
          for (let i = range.length - 1; i >= 0; i--) {
            const k = range[i];
            if (map.get(k) === true) s++;
            else break;
          }
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
            for (const row of atts || []) {
              const k = String(row.day_key);
              if (row.result === 'correct') map.set(k, true);
              else if (!map.has(k)) map.set(k, false);
            }
            const range = [];
            for (let i = 0; i < days; i++) {
              const dt = addDaysUTC(start, i);
              range.push(dateKeyUTC(dt));
            }
            let s = 0;
            for (let i = range.length - 1; i >= 0; i--) {
              const k = range[i];
              if (map.get(k) === true) s++;
              else break;
            }
            if (mounted) setStreak(s);
          } catch {}
        }

        // Average attempts until success (within the same window)
        try {
          const { data: atts } = await supabase
            .from('attempts')
            .select('day_key, created_at, result')
            .eq('user_id', uid)
            .gte('day_key', dateKeyUTC(start))
            .lte('day_key', dateKeyUTC(end))
            .order('created_at', { ascending: true });
          const byDay = new Map();
          for (const a of atts || []) {
            const k = String(a.day_key);
            if (!byDay.has(k)) byDay.set(k, []);
            byDay.get(k).push({ created_at: a.created_at, result: a.result });
          }
          const counts = [];
          for (const [k, arr] of byDay.entries()) {
            let idx = arr.findIndex(x => x.result === 'correct');
            if (idx >= 0) counts.push(idx + 1);
          }
          const avg = counts.length ? (counts.reduce((s, n) => s + n, 0) / counts.length) : null;
          if (mounted) setAvgAttempts(avg);
        } catch {
          if (mounted) setAvgAttempts(null);
        }
      } finally {
        if (mounted) setSelfLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [days, start, end]);

  const rate = data?.total_players > 0 ? Math.round((data.solvers / data.total_players) * 100) : 0;
  const dist = data?.distribution || {};

  return (
    <div className="card" style={{ marginTop: 12, padding: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>📈 Stats</h3>
      <div style={{ marginBottom: 12 }}>
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
      <div>
        <h4 style={{ margin: '10px 0 8px 0' }}>📊 Stats du jour</h4>
        {loading && !data ? (
          <div>Chargement…</div>
        ) : data ? (
          <>
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
          </>
        ) : (
          <div>Stats du jour indisponibles</div>
        )}
      </div>
    </div>
  );
}
