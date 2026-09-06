import React, { useEffect, useRef, useState } from 'react';
import { RIDDLE_THEMES } from '../lib/celebrate';
import { learningApi } from '../lib/learningApi';
import Correction from './Correction';
import './learning.css';

const PRACTICE_THEMES = ['general', 'logique', 'probabilites', 'geometrie', 'finance', 'arithmetique'];

export default function LearningPage({ onBack }) {
  const [tab, setTab] = useState('practice');
  const [theme, setTheme] = useState('arithmetique');
  const [level, setLevel] = useState(1);
  const [exercise, setExercise] = useState(null);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState(null);
  const [notebookError, setNotebookError] = useState('');
  const [retry, setRetry] = useState(0);
  const request = useRef(null);
  const questionRef = useRef(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (tab !== 'notebook') return;
    const controller = new AbortController();
    setEntries(null); setNotebookError('');
    learningApi('/notebook', { signal: controller.signal }).then(data => setEntries(data.entries))
      .catch(e => { if (e.name !== 'AbortError') setNotebookError(e.message); });
    return () => controller.abort();
  }, [tab, retry]);

  const reset = () => { request.current?.abort(); setBusy(false); setExercise(null); setGuess(''); setResult(null); setError(''); };
  async function start() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setExercise(null); setResult(null); setGuess('');
    try {
      const data = await learningApi('/practice', { body: { theme, level }, signal: controller.signal });
      setExercise(data);
      requestAnimationFrame(() => questionRef.current?.focus());
    } catch (e) { if (e.name !== 'AbortError') setError(e.message); }
    finally { if (request.current === controller) setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || !exercise || result) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try { setResult(await learningApi('/practice/answer', { body: { ticket: exercise.ticket, guess }, signal: controller.signal })); }
    catch (e) { if (e.name !== 'AbortError') setError(e.message); }
    finally { if (request.current === controller) setBusy(false); }
  }
  const train = category => {
    reset(); setTheme(PRACTICE_THEMES.includes(category) ? category : 'general'); setTab('practice');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return <main className="page-container learning-page">
    <button className="btn-link" onClick={onBack}>← Retour aux énigmes</button>
    <header className="learning-hero">
      <span className="learning-eyebrow">Ton atelier de réflexion</span>
      <h1>Chaque erreur peut devenir un déclic.</h1>
      <p>Pratique à ton rythme, comprends la méthode et retrouve confiance.</p>
      <span className="lb-pill">Entraînement libre · sans XP ni classement</span>
    </header>
    <div className="learning-tabs" role="group" aria-label="Espace de progression">
      <button className={`btn ${tab === 'practice' ? 'btn-primary' : 'btn-soft'}`} aria-pressed={tab === 'practice'} onClick={() => setTab('practice')}>✏️ M'entraîner</button>
      <button className={`btn ${tab === 'notebook' ? 'btn-primary' : 'btn-soft'}`} aria-pressed={tab === 'notebook'} onClick={() => setTab('notebook')}>📒 Mon carnet</button>
    </div>
    {tab === 'practice' ? <section className="card learning-workspace" aria-label="Entraînement ciblé">
      <div className="learning-options">
        <label>Catégorie<select value={theme} disabled={busy} onChange={e => { reset(); setTheme(e.target.value); }}>
          {PRACTICE_THEMES.map(key => <option key={key} value={key}>{RIDDLE_THEMES[key].icon} {RIDDLE_THEMES[key].label}</option>)}
        </select></label>
        <label>Niveau<select value={level} disabled={busy} onChange={e => { reset(); setLevel(Number(e.target.value)); }}>
          <option value={1}>Découverte</option><option value={2}>Pratique</option><option value={3}>Défi</option>
        </select></label>
      </div>
      {!exercise && <div className="learning-empty"><h2>Un petit exercice, un pas de plus.</h2><p>Choisis ta catégorie. Après ta réponse, la méthode te sera expliquée.</p></div>}
      {error && <p role="alert" className="learning-error">{error}</p>}
      {exercise && <>
        <h2 className="question-card learning-question" ref={questionRef} tabIndex={-1}>{exercise.question}</h2>
        {!result && <form className="learning-answer" onSubmit={submit}>
          <label className="learning-answer-label" htmlFor="practice-answer">Ta réponse (sans unité)</label>
          <input className="input" id="practice-answer" inputMode="decimal" autoComplete="off" value={guess} maxLength={64} onChange={e => setGuess(e.target.value)} disabled={busy} required />
          <button className="btn btn-primary" disabled={busy || !guess.trim()}>{busy ? 'Vérification…' : 'Vérifier'}</button>
        </form>}
        {result && <div className="learning-result" role="status">
          <h3>{result.correct ? '✓ Bien joué !' : 'Une méthode à retenir'}</h3>
          <p>La réponse est <strong>{result.answer}</strong>.</p><p>{result.explanation}</p>
        </div>}
      </>}
      {(!exercise || result || error) && <button className="btn btn-primary" disabled={busy} onClick={start}>{busy ? 'Préparation…' : exercise ? 'Nouvel exercice' : 'Commencer'}</button>}
    </section> : <section aria-label="Carnet d'erreurs">
      <p className="learning-muted">Tes 50 dernières énigmes avec au moins une erreur. Une énigme résolue reste ici pour revoir sa méthode.</p>
      {notebookError ? <div className="card learning-workspace" role="alert">{notebookError} <button className="btn-link" onClick={() => setRetry(retry + 1)}>Réessayer</button></div>
        : !entries ? <p role="status">Ouverture du carnet…</p>
          : !entries.length ? <div className="card learning-workspace learning-empty"><h2>Une nouvelle page t'attend.</h2><p>Les énigmes qui te donnent du fil à retordre apparaîtront ici automatiquement.</p><button className="btn btn-primary" onClick={() => train(theme)}>M'entraîner maintenant</button></div>
            : <div className="learning-notebook">{entries.map(entry => {
              const category = RIDDLE_THEMES[entry.theme] || RIDDLE_THEMES.general;
              return <article className="card learning-entry" key={`${entry.day}-${entry.riddle_id}`}>
                <div className="learning-entry-meta"><span>{category.icon} {category.label}</span><time dateTime={entry.day}>{entry.day}</time></div>
                <h2>{entry.question}</h2>
                <p className="learning-muted">{entry.errors} erreur{entry.errors > 1 ? 's' : ''} · {entry.solved ? 'Résolue ✓' : 'À retravailler'}</p>
                <div className="learning-entry-actions"><button className="btn btn-soft" onClick={() => train(entry.theme)}>Pratiquer cette catégorie</button>
                  {entry.solved && <Correction riddleId={entry.riddle_id} day={entry.day} />}</div>
              </article>;
            })}</div>}
    </section>}
  </main>;
}
