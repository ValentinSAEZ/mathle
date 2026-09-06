import React, { useEffect, useState } from "react";
import Game from "./components/Game";
import Leaderboard from "./components/Leaderboard";
import Auth from "./components/Auth";
import AdminPanel from "./components/AdminPanel";
import Banner from "./components/Banner";
import ProfilePage from "./components/ProfilePage";
import RaceGame from "./components/RaceGame";
import ArchivePage from "./components/ArchivePage";
import ForumPage from "./components/ForumPage";
import LandingPage from "./components/LandingPage";
import StatsToday from "./components/StatsToday";
import LearningPage from './components/LearningPage';
const API_URL = 'https://api.brainteaserday.com';



export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('home');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [raceSuspended, setRaceSuspended] = useState(false);
  const [theme, setTheme] = useState(() => {
    const t = localStorage.getItem('theme');
    return t === 'dark' ? 'dark' : 'light';
  });

  const handleSignOut = () => {
  	localStorage.removeItem('auth_token');
  	setSession(null);
  	setShowAdmin(false);
  	setView('home');
  };

  useEffect(() => {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    setSession(null);
    return;
  }

  fetch(`${API_URL}/api/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Session invalide');
      }

      return response.json();
    })
    .then((data) => {
      setSession({
        access_token: token,
        user: data.user,
      });
    })
    .catch(() => {
      localStorage.removeItem('auth_token');
      setSession(null);
    });
}, []);

  useEffect(() => {
    const cls = document.body.classList;
    cls.remove('theme-dark');
    if (theme === 'dark') cls.add('theme-dark');
    localStorage.setItem('theme', theme);
  }, [theme]);


  useEffect(() => {
  setIsAdmin(Boolean(session?.user?.is_admin));
}, [session]);

useEffect(() => {
  const load = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/race-settings`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Paramètres Course indisponibles'
        );
      }

      setRaceSuspended(Boolean(data.suspended));
    } catch (error) {
      console.error(error);
      setRaceSuspended(false);
    }
  };

  load();

  const onRace = () => load();

  window.addEventListener(
    'mathle:race-updated',
    onRace
  );

  return () => {
    window.removeEventListener(
      'mathle:race-updated',
      onRace
    );
  };
}, []);


  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const [showAuth, setShowAuth] = useState(false);

  if (!session) return (
    <div className="public-shell">
      <Banner />
      {showAuth ? (
        <div>
          <Auth onSignedIn={setSession} />
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <button className="btn-link" onClick={() => setShowAuth(false)} style={{ appearance: 'none', border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              ← Retour à l'accueil
            </button>
          </div>
        </div>
      ) : (
        <LandingPage onGetStarted={() => setShowAuth(true)} />
      )}
      <button className="theme-fab" onClick={toggleTheme}
        title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
        aria-label={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  );

  const navItems = [
    { key: 'home', label: 'Accueil', icon: '🏠' },
    ...((!raceSuspended) ? [{ key: 'race', label: 'Course', icon: '🏁' }] : []),
    { key: 'forum', label: 'Forum', icon: '💬' },
    { key: 'archive', label: 'Archives', icon: '📚' },
    { key: 'profile', label: 'Profil', icon: '👤' },
  ];

  return (
    <div className="app-shell" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
      <Banner />

      {/* Top navigation bar */}
      <header className="topbar">
        <div className="nav-container">
          <div className="brand" onClick={() => setView('home')} title="Accueil">
            <span className="brand-mark" aria-hidden="true">∑</span>
            <div>
              <div className="brand-title">BrainteaserDay</div>
              <div className="brand-kicker">Le défi qui réveille</div>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="nav-actions">
            {isAdmin && (
              <button className="btn btn-soft btn-lg" onClick={() => setShowAdmin(true)}>Admin</button>
            )}
            {navItems.map(item => (
              <button key={item.key}
                className={`btn btn-soft btn-lg ${view === item.key ? 'active' : ''}`}
                onClick={() => {
                  if (item.key === 'profile') { setProfileUserId(session.user.id); }
                  setView(item.key);
                }}
              >
                {item.label}
              </button>
            ))}
            <button className="btn btn-primary btn-lg" onClick={handleSignOut}>
              Quitter
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav">
        <div className="mobile-nav-items">
          {navItems.map(item => (
            <button key={item.key}
              className={`mobile-nav-btn ${view === item.key ? 'active' : ''}`}
              onClick={() => {
                if (item.key === 'profile') { setProfileUserId(session.user.id); }
                setView(item.key);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          {isAdmin && (
            <button className="mobile-nav-btn" onClick={() => setShowAdmin(true)}>
              <span className="nav-icon">{'⚙️'}</span>
              <span>Admin</span>
            </button>
          )}
        </div>
      </nav>

      {/* Page content */}
      <div className="fade-in">
        {view === 'home' ? (
          <div className="home-grid">
            <div style={{ display: 'grid', gap: 16 }}>
              <Game session={session} />
              <StatsToday />
            </div>
            <div className="leaderboard-col">
              <button
                className="leaderboard-toggle-btn"
                onClick={() => setShowLeaderboard(v => !v)}
              >
                🏆 {showLeaderboard ? 'Masquer le classement ▲' : 'Voir le classement ▼'}
              </button>
              <div className={showLeaderboard ? 'leaderboard-visible' : 'leaderboard-hidden'}>
                <Leaderboard onSelectUser={(uid) => { setProfileUserId(uid); setView('profile'); }} />
              </div>
              <section className="card learning-invite">
                <h2>📒 Ton atelier de réflexion</h2>
                <p>Retrouve les énigmes qui t'ont fait hésiter et entraîne-toi à ton rythme.</p>
                <button className="btn btn-primary" onClick={() => setView('learning')}>M'entraîner et ouvrir mon carnet</button>
              </section>
            </div>
          </div>
        ) : view === 'learning' ? (
          <LearningPage key={session.user.id} onBack={() => setView('home')} />
        ) : view === 'profile' ? (
          <ProfilePage session={session} userId={profileUserId || session.user.id} />
        ) : view === 'forum' ? (
          <ForumPage session={session} onSelectUser={(uid) => { setProfileUserId(uid); setView('profile'); }} />
        ) : view === 'archive' ? (
          <ArchivePage />
        ) : view === 'race' ? (
          !raceSuspended ? (
            <RaceGame session={session} />
          ) : (
            <div className="page-container">
              <div className="card section" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, color: 'var(--muted)' }}>Le mode Course est actuellement suspendu par un administrateur.</p>
              </div>
            </div>
          )
        ) : null}
      </div>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}


      <button className="theme-fab" onClick={toggleTheme}
        title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
        aria-label={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  );
}

