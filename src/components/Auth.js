import React, { useState } from 'react';
const API_URL = 'https://api.brainteaserday.com';

export default function Auth({ onSignedIn }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const endpoint =
        mode === 'signup'
          ? `${API_URL}/api/auth/register`
          : `${API_URL}/api/auth/login`;

      const body =
        mode === 'signup'
          ? { email, password, username }
          : { email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Une erreur est survenue.');
      }

      localStorage.setItem('auth_token', data.token);

      const session = {
        access_token: data.token,
        user: data.user,
      };

      onSignedIn?.(session);
    } catch (err) {
      setErrorMsg(err?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setErrorMsg('');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" aria-hidden="true">
            <picture>
              <source
                srcSet={`${process.env.PUBLIC_URL || ''}/brand/logo.svg`}
                type="image/svg+xml"
              />
              <img
                className="auth-logo-img"
                src={`${process.env.PUBLIC_URL || ''}/brand/logo.png`}
                alt="BrainteaserDay"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.insertAdjacentText(
                    'beforeend',
                    '🧠'
                  );
                }}
              />
            </picture>
          </div>

          <h1 className="auth-title">BrainteaserDay</h1>

          <p className="auth-subtitle">
            Connectez-vous pour jouer et grimper au classement
          </p>
        </div>

        <div
          className="auth-tabs"
          role="tablist"
          aria-label="Modes d'authentification"
        >
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
              <label htmlFor="username" className="auth-label">
                Nom d'utilisateur
              </label>

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
            <label htmlFor="email" className="auth-label">
              Email
            </label>

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
            <label htmlFor="password" className="auth-label">
              Mot de passe
            </label>

            <input
              id="password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={
                mode === 'signup'
                  ? 'new-password'
                  : 'current-password'
              }
            />
          </div>

          {errorMsg ? (
            <div className="auth-message error" role="alert">
              {errorMsg}
            </div>
          ) : null}

          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >
            {loading
              ? 'Veuillez patienter…'
              : mode === 'signup'
              ? "S'inscrire"
              : 'Connexion'}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'signup' ? (
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode('signin')}
            >
              Déjà inscrit ? Se connecter
            </button>
          ) : (
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode('signup')}
            >
              Nouveau ici ? Créer un compte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
