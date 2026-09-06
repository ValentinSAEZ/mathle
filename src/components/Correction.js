import React, { useEffect, useState } from 'react';
import { learningApi } from '../lib/learningApi';

export default function Correction({ riddleId, day }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setData(null); setError('');
    learningApi(`/corrections/${riddleId}?day=${encodeURIComponent(day)}`, { signal: controller.signal })
      .then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [open, riddleId, day, retry]);
  return <div className="learning-correction">
    <button type="button" className="btn btn-soft" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Fermer la correction' : '💡 Comprendre la solution'}
    </button>
    {open && <div className="learning-explanation">
      {error ? <div role="alert">{error} <button className="btn-link" onClick={() => setRetry(retry + 1)}>Réessayer</button></div>
        : data ? <p>{data.explanation || "Cette énigme n'a pas encore de correction rédigée. Elle sera disponible ici lorsqu'elle aura été ajoutée."}</p>
          : <p role="status">Chargement de la correction…</p>}
    </div>}
  </div>;
}
