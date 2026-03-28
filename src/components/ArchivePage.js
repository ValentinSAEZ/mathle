import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function getUTCDateKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export default function ArchivePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const todayKey = useMemo(() => getUTCDateKey(), []);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.rpc('get_riddle_archive', { p_limit: limit, p_offset: offset });
      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Impossible de charger les archives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [offset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const day = p.get('day');
    if (!day) return;
    const el = document.getElementById(`archive-${day}`);
    if (el && 'open' in el) {
      el.open = true;
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [rows]);

  return (
    <div className="page-container fade-in">
      <h2 className="page-title">
        <img className="brand-inline" src={`${process.env.PUBLIC_URL || ''}/brand/logo.png`} alt="Logo"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        Archives
      </h2>

      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, textAlign: 'center' }}>
        Jour courant (UTC): {todayKey}
      </div>

      {loading && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>Chargement…</div>}
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center', padding: 20 }}>{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Aucune énigme archivée.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((r) => (
            <details key={r.day_key} id={`archive-${r.day_key}`} className="card">
              <summary>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.day_key}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>({r.source})</span>
              </summary>
              <div>
                <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 12 }}>{r.question}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span className="lb-pill">Type: {r.type}</span>
                  <span className="lb-pill">Solution: <b>{r.answer}</b></span>
                </div>
                {r.explanation ? (
                  <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', padding: 14, fontSize: 14, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 6 }}>Explication</div>
                    <div style={{ whiteSpace: 'pre-line' }}>{r.explanation}</div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Pas d'explication renseignée.</div>
                )}
              </div>
            </details>
          ))}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            <button className="btn" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>
              Précédent
            </button>
            <button className="btn" onClick={() => setOffset(offset + limit)} disabled={rows.length < limit}>
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
