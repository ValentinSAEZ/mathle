import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function getUTCDateKey(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ArchivePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(30);
  const [offset, setOffset] = useState(0);

  const todayKey = useMemo(() => getUTCDateKey(), []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.rpc('get_riddle_archive', {
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      setRows(Array.isArray(data) ? data : (data ? [data] : []));
    } catch (e) {
      console.error(e);
      setError(e?.message || e?.error?.message || 'Impossible de charger les archives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, offset]);

  // Auto ouvrir une journée si ?day=YYYY-MM-DD
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
    <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px' }}>
      <h2 className="page-title" style={{ marginTop: 12 }}>📚 Archives des énigmes</h2>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>Jour courant (UTC): {todayKey}. Les archives affichent uniquement les jours passés.</div>

      {loading && (<div>Chargement…</div>)}
      {error && (<div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>)}

      {!loading && !error && rows.length === 0 && (
        <div style={{ opacity: 0.7 }}>Aucune énigme archivée pour l’instant.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => (
            <details key={r.day_key} id={`archive-${r.day_key}`} className="card" style={{ padding: 16 }}>
              <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{r.day_key}</span>
                <span style={{ opacity: 0.7, fontSize: 12 }}>({r.source})</span>
              </summary>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{r.question}</div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="lb-pill">Type: {r.type}</span>
                  <span className="lb-pill">Solution: <b>{r.answer}</b></span>
                </div>
                {r.explanation ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 600 }}>Explication</div>
                    <div style={{ whiteSpace: 'pre-line' }}>{r.explanation}</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, opacity: 0.7, fontSize: 13 }}>
                    (Pas d’explication renseignée pour ce jour)
                  </div>
                )}
              </div>
            </details>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>Précédent</button>
            <button className="btn" onClick={() => setOffset(offset + limit)} disabled={rows.length < limit}>Suivant</button>
          </div>
        </div>
      )}
    </div>
  );
}
