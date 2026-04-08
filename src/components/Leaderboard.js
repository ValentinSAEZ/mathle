import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RIDDLE_THEMES } from '../lib/celebrate';

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

function fmtTime(s) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

const RACE_LEVELS = [
  { key: 'easy', label: 'Facile', color: '#10b981' },
  { key: 'med', label: 'Moyen', color: '#f59e0b' },
  { key: 'hard', label: 'Difficile', color: '#ef4444' },
];

const RACE_DURATIONS = [30, 60, 120];

export default function Leaderboard({ onSelectUser }) {
  const dayKey = useMemo(() => getUTCDateKey(), []);

  // Onglet actif : 'general' | theme key | 'race'
  const [activeTab, setActiveTab] = useState('general');
  const [themes, setThemes] = useState([]); // thèmes du jour

  // Données par onglet
  const [generalRows, setGeneralRows] = useState([]);
  const [categoryRows, setCategoryRows] = useState({});
  const [raceRows, setRaceRows] = useState([]);
  const [raceLevel, setRaceLevel] = useState('med');
  const [raceDuration, setRaceDuration] = useState(60);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Charger les thèmes du jour
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc('get_daily_riddles_all', { p_day: dayKey });
        const list = (Array.isArray(data) ? data : []).map(r => r.theme);
        setThemes(list);
      } catch {}
    })();
  }, [dayKey]);

  // Charger classement général
  const loadGeneral = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.rpc('get_general_leaderboard', { p_day: dayKey });
      if (error) throw error;
      setGeneralRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('Classement indisponible.');
    } finally {
      setLoading(false);
    }
  }, [dayKey]);

  // Charger classement par catégorie
  const loadCategory = useCallback(async (theme) => {
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.rpc('get_category_leaderboard', { p_day: dayKey, p_theme: theme });
      if (error) throw error;
      setCategoryRows(prev => ({ ...prev, [theme]: Array.isArray(data) ? data : [] }));
    } catch (e) {
      console.error(e);
      setError('Classement indisponible.');
    } finally {
      setLoading(false);
    }
  }, [dayKey]);

  // Charger classement course
  const loadRace = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.rpc('get_race_leaderboard', { p_level: raceLevel, p_duration: raceDuration });
      if (error) throw error;
      setRaceRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('Classement course indisponible.');
    } finally {
      setLoading(false);
    }
  }, [raceLevel, raceDuration]);

  // Charger selon l'onglet actif
  useEffect(() => {
    if (activeTab === 'general') loadGeneral();
    else if (activeTab === 'race') loadRace();
    else loadCategory(activeTab);
  }, [activeTab, loadGeneral, loadCategory, loadRace]);

  // Recharger la course si paramètres changent
  useEffect(() => {
    if (activeTab === 'race') loadRace();
  }, [raceLevel, raceDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh automatique toutes les 20s sur l'onglet actif
  useEffect(() => {
    const t = setInterval(() => {
      if (activeTab === 'general') loadGeneral();
      else if (activeTab === 'race') loadRace();
      else loadCategory(activeTab);
    }, 20000);
    return () => clearInterval(t);
  }, [activeTab, loadGeneral, loadCategory, loadRace]);

  // Écouter les overrides admin
  useEffect(() => {
    const h = () => { if (activeTab === 'general') loadGeneral(); else if (activeTab !== 'race') loadCategory(activeTab); };
    window.addEventListener('mathle:override-updated', h);
    return () => window.removeEventListener('mathle:override-updated', h);
  }, [activeTab, loadGeneral, loadCategory]);

  // Tabs à afficher
  const tabs = [
    { key: 'general', label: '🏆 Global' },
    ...themes.map(t => {
      const meta = RIDDLE_THEMES[t] || RIDDLE_THEMES.general;
      return { key: t, label: `${meta.icon} ${meta.label}` };
    }),
    { key: 'race', label: '🏁 Course' },
  ];

  // Données à afficher
  let rows = [];
  if (activeTab === 'general') {
    rows = generalRows;
  } else if (activeTab === 'race') {
    rows = raceRows;
  } else {
    rows = categoryRows[activeTab] || [];
  }

  const activeTabMeta = activeTab === 'general'
    ? null
    : activeTab === 'race'
    ? null
    : (RIDDLE_THEMES[activeTab] || RIDDLE_THEMES.general);

  return (
    <aside className="leaderboard-aside card leaderboard" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Classement</h3>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{dayKey}</span>
      </div>

      {/* Onglets — scroll horizontal sur mobile */}
      <div style={{ overflowX: 'auto', borderBottom: '1px solid var(--card-border)', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', padding: '6px 8px', gap: 4, minWidth: 'max-content' }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            const meta = tab.key !== 'general' && tab.key !== 'race'
              ? (RIDDLE_THEMES[tab.key] || RIDDLE_THEMES.general)
              : null;
            const accentColor = meta ? meta.color : tab.key === 'race' ? '#f59e0b' : 'var(--primary)';
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', borderRadius: 20,
                  background: isActive ? accentColor + '1a' : 'transparent',
                  color: isActive ? accentColor : 'var(--muted)',
                  whiteSpace: 'nowrap', transition: 'all 150ms ease',
                  outline: isActive ? `1.5px solid ${accentColor}44` : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtres course */}
      {activeTab === 'race' && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginRight: 2 }}>Niveau</span>
          {RACE_LEVELS.map(l => (
            <button key={l.key} onClick={() => setRaceLevel(l.key)} style={{
              padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: '1.5px solid', borderColor: raceLevel === l.key ? l.color : 'var(--card-border)',
              background: raceLevel === l.key ? l.color + '1a' : 'transparent',
              color: raceLevel === l.key ? l.color : 'var(--muted)', transition: 'all 150ms',
            }}>
              {l.label}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: 'var(--card-border)', margin: '0 2px' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginRight: 2 }}>Durée</span>
          {RACE_DURATIONS.map(d => (
            <button key={d} onClick={() => setRaceDuration(d)} style={{
              padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: '1.5px solid', borderColor: raceDuration === d ? 'var(--primary)' : 'var(--card-border)',
              background: raceDuration === d ? 'var(--primary-soft)' : 'transparent',
              color: raceDuration === d ? 'var(--primary)' : 'var(--muted)', transition: 'all 150ms',
            }}>
              {d}s
            </button>
          ))}
        </div>
      )}

      {/* Catégorie active indicator */}
      {activeTabMeta && (
        <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px 2px 6px',
            borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: activeTabMeta.color + '18', color: activeTabMeta.color,
          }}>
            <span style={{ fontSize: 14 }}>{activeTabMeta.icon}</span> {activeTabMeta.label}
          </span>
          {rows.length > 0 && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{rows.filter(r => r.solved).length}/{rows.length} résolus</span>}
        </div>
      )}

      {/* Corps */}
      <div style={{ padding: '6px' }}>
        {loading && rows.length === 0 && (
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>Chargement…</div>
        )}
        {error && <div style={{ padding: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Aucune donnée aujourd'hui</div>
        )}

        {/* Classement Général */}
        {activeTab === 'general' && rows.length > 0 && (
          <div className="lb-list">
            {rows.map((r, idx) => (
              <button key={r.user_id} type="button" className="lb-row"
                title={`Voir le profil de ${r.username}`}
                onClick={() => onSelectUser?.(r.user_id)}
              >
                <span className={`lb-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>{idx + 1}</span>
                <span className="lb-avatar" aria-hidden>{initialsOf(r.username)}</span>
                <span className="lb-name">{r.username || '—'}</span>
                <span className="lb-pill" title="Énigmes résolues" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ color: 'var(--success)', fontWeight: 800 }}>{r.riddles_solved}</span>
                  <span style={{ fontSize: 10 }}>✓</span>
                </span>
                <span className="lb-pill" title="Total tentatives" style={{ color: 'var(--muted)', fontSize: 11 }}>{r.total_attempts} essais</span>
              </button>
            ))}
          </div>
        )}

        {/* Classement par catégorie */}
        {activeTab !== 'general' && activeTab !== 'race' && rows.length > 0 && (
          <div className="lb-list">
            {rows.map((r, idx) => (
              <button key={r.user_id} type="button" className="lb-row"
                style={{ opacity: r.solved ? 1 : 0.5 }}
                title={`Voir le profil de ${r.username}`}
                onClick={() => onSelectUser?.(r.user_id)}
              >
                <span className={`lb-rank ${r.solved ? (idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '') : ''}`}>
                  {r.solved ? idx + 1 : '—'}
                </span>
                <span className="lb-avatar" aria-hidden>{initialsOf(r.username)}</span>
                <span className="lb-name">{r.username || '—'}</span>
                {r.solved ? (
                  <>
                    <span className="lb-pill" style={{ fontSize: 11 }}>{r.attempts} essai{r.attempts > 1 ? 's' : ''}</span>
                    {r.time_to_solve_seconds != null && (
                      <span className="lb-pill" title="Temps" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(r.time_to_solve_seconds)}</span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto', fontStyle: 'italic' }}>En cours…</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Classement Course */}
        {activeTab === 'race' && rows.length > 0 && (
          <div className="lb-list">
            {rows.map((r, idx) => (
              <button key={r.user_id} type="button" className="lb-row"
                title={`Voir le profil de ${r.username}`}
                onClick={() => onSelectUser?.(r.user_id)}
              >
                <span className={`lb-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>{idx + 1}</span>
                <span className="lb-avatar" aria-hidden>{initialsOf(r.username)}</span>
                <span className="lb-name">{r.username || '—'}</span>
                <span className="lb-pill" title="Score" style={{ fontWeight: 800, color: '#f59e0b' }}>{r.score} pts</span>
                <span className="lb-pill" title="Précision" style={{ fontSize: 11 }}>{r.accuracy}%</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
