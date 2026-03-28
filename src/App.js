import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Game from "./components/Game";
import Leaderboard from "./components/Leaderboard";
import Auth from "./components/Auth";
import AdminPanel from "./components/AdminPanel";
import Banner from "./components/Banner";
import ProfilePage from "./components/ProfilePage";
import RaceGame from "./components/RaceGame";
import ArchivePage from "./components/ArchivePage";
import StatsToday from "./components/StatsToday";

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('home');
  const [profileUserId, setProfileUserId] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [raceSuspended, setRaceSuspended] = useState(false);
  const [theme, setTheme] = useState(() => {
    const t = localStorage.getItem('theme');
    return t === 'dark' ? 'dark' : 'light';
  });

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOut error:', e);
    } finally {
      setSession(null);
      setShowAdmin(false);
      setView('home');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error(error);
      setSession(data?.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const cls = document.body.classList;
    cls.remove('theme-dark');
    if (theme === 'dark') cls.add('theme-dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!session) return;
    const raw = localStorage.getItem('pending_username');
    if (!raw) return;
    try {
      const pending = JSON.parse(raw);
      const username = pending?.username;
      const userId = pending?.userId;
      if (!username) { localStorage.removeItem('pending_username'); return; }
      if (userId && userId !== session.user?.id) { localStorage.removeItem('pending_username'); return; }
      (async () => {
        const { error } = await supabase.from('profiles').upsert({ id: session.user.id, username });
        if (error) console.error(error);
        localStorage.removeItem('pending_username');
      })();
    } catch {
      localStorage.removeItem('pending_username');
    }
  }, [session]);

  useEffect(() => {
    (async () => {
      if (!session?.user?.id) { setIsAdmin(false); return; }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .maybeSingle();
        setIsAdmin(Boolean(data?.is_admin));
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [session?.user?.id]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('race_settings')
          .select('suspended')
          .eq('id', 1)
          .maybeSingle();
        setRaceSuspended(Boolean(data?.suspended));
      } catch {
        setRaceSuspended(false);
      }
    };
    load();
    const onRace = () => load();
    window.addEventListener('mathle:race-updated', onRace);
    return () => window.removeEventListener('mathle:race-updated', onRace);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  if (!session) return (
    <div>
      <Banner />
      <Auth onSignedIn={setSession} />
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
    { key: 'archive', label: 'Archives', icon: '📚' },
    { key: 'profile', label: 'Profil', icon: '👤' },
  ];

  return (
    <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 60px)' }}>
      <Banner />

      {/* Top navigation bar */}
      <header className="topbar">
        <div className="nav-container">
          <div className="brand" onClick={() => setView('home')} title="Accueil">
            <img className="brand-logo"
              src={`${process.env.PUBLIC_URL || ''}/brand/logo.png`}
              alt="BrainteaserDay"
              onError={(e) => { e.currentTarget.src = `${process.env.PUBLIC_URL || ''}/logo192.png`; }}
            />
            <div className="brand-title">BrainteaserDay</div>
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
            <div>
              <Leaderboard onSelectUser={(uid) => { setProfileUserId(uid); setView('profile'); }} />
            </div>
          </div>
        ) : view === 'profile' ? (
          <ProfilePage session={session} userId={profileUserId || session.user.id} />
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
