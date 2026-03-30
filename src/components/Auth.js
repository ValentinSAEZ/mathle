import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auth({ onSignedIn }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      let resp;
      if (mode === 'signup') {
        resp = await supabase.auth.signUp({ email, password });
      } else {
        resp = await supabase.auth.signInWithPassword({ email, password });
      }
      const { data, error } = resp;
      if (error) { setErrorMsg(error.message); return; }

      // Si inscription: tenter d'enregistrer le username
      if (mode === 'signup' && username.trim()) {
        const userId = data?.user?.id;
        if (data?.session?.access_token) {
          const { error: errProfile } = await supabase
            .from('profiles')
            .upsert({ id: userId, username: username.trim() });
          if (errProfile) console.error(errProfile);
        } else if (userId) {
          // pas de session (email de confirmation requis): sauvegarder localement
          localStorage.setItem('pending_username', JSON.stringify({ userId, username: username.trim() }));
          setConfirmedEmail(email);
          setConfirmSent(true);
          return;
        }
      }
      onSignedIn?.(data?.session ?? null);
    } catch (err) {
      setErrorMsg(err?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const mail = String(email || '').trim();
    if (!mail) { setErrorMsg('Saisissez votre email puis réessayez.'); return; }
    setLoading(true);
    try {
      const redirectTo = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo });
      if (error) throw error;
      setInfoMsg('Email de réinitialisation envoyé. Vérifiez votre boîte mail.');
    } catch (err) {
      setErrorMsg(err?.message || "Impossible d’envoyer l’email de réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setErrorMsg('');
    setInfoMsg('');
  };

  if (confirmSent) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📬</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Vérifie ta boîte mail !</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 6, fontSize: 15 }}>
            Un email de confirmation a été envoyé à
          </p>
          <p style={{
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--primary)',
            marginBottom: 20,
            wordBreak: 'break-all',
          }}>
            {confirmedEmail}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
            Clique sur le lien dans l'email pour activer ton compte et commencer à résoudre les énigmes du jour. 🧠
          </p>
          <div style={{
            background: 'var(--surface-subtle)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            fontSize: 13,
            color: 'var(--muted)',
            marginBottom: 24,
            textAlign: 'left',
          }}>
            💡 Tu ne vois pas l'email ? Vérifie ton dossier <strong>Spam</strong> ou <strong>Indésirables</strong>.
          </div>
          <button
            className="btn"
            onClick={() => { setConfirmSent(false); setMode('signin'); }}
            style={{ width: '100%' }}
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" aria-hidden="true">
            <picture>
              <source srcSet={`${process.env.PUBLIC_URL || ''}/brand/logo.svg`} type="image/svg+xml" />
              <img
                className="auth-logo-img"
                src={`${process.env.PUBLIC_URL || ''}/brand/logo.png`}
                alt="BrainteaserDay"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.insertAdjacentText('beforeend', '🧠'); }}
              />
            </picture>
          </div>
          <h1 className="auth-title">BrainteaserDay</h1>
          <p className="auth-subtitle">Connectez-vous pour jouer et grimper au classement</p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Modes d'authentification">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Se connecter
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={submit} className="auth-form" noValidate>
          {mode === 'signup' && (
            <div className="auth-field">
              <label htmlFor="username" className="auth-label">Nom d'utilisateur</label>
              <input
                id="username"
                type="text"
                className="auth-input"
                placeholder="Ex: Sherlock"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="nickname"
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email" className="auth-label">Email</label>
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password" className="auth-label">Mot de passe</label>
            <input
              id="password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {mode === 'signin' && (
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="auth-link"
                  onClick={forgotPassword}
                  disabled={loading}
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}
          </div>

          {errorMsg ? (
            <div className="auth-message error" role="alert">{errorMsg}</div>
          ) : null}
          {infoMsg ? (
            <div className="auth-message info">{infoMsg}</div>
          ) : null}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Veuillez patienter…' : (mode === 'signup' ? "S'inscrire" : 'Connexion')}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'signup' ? (
            <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
              Déjà inscrit ? Se connecter
            </button>
          ) : (
            <button type="button" className="auth-link" onClick={() => switchMode('signup')}>
              Nouveau ici ? Créer un compte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
