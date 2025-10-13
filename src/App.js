import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Game from "./components/Game";
import Leaderboard from "./components/Leaderboard";
import Auth from "./components/Auth";
import AdminPanel from "./components/AdminPanel";
import Banner from "./components/Banner";
import ProfilePage from "./components/ProfilePage";
import RaceGame from "./components/RaceGame";

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'profile' | 'race'
  const [profileUserId, setProfileUserId] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [raceSuspended, setRaceSuspended] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error(error);
      setSession(data?.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Si un username a été saisi lors de l'inscription mais qu'il n'y avait pas de session
  // (email confirmation), on le pousse dans `profiles` au premier login.
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

  // Charger le rôle admin depuis profiles
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

  // Charger l'état du mode Course (suspension)
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

  if (!session) return (
    <div>
      <Banner />
      <Auth onSignedIn={setSession} />
    </div>
  );

  return (
    <div>
      <Banner />
      <header className="topbar">
        <div className="nav-container">
          <div className="brand" onClick={() => setView('home')} title="Aller à l’accueil">
            <img
              className="brand-logo"
              src="/brand/logo.png"
              alt="BrainteaserDay"
              onError={(e) => { e.currentTarget.src = '/logo192.png'; }}
            />
            <div className="brand-title">BrainteaserDay</div>
          </div>
          <div className="nav-actions">
            {isAdmin && (
              <button className="btn btn-soft btn-lg" onClick={() => setShowAdmin(true)}>Admin</button>
            )}
            {!raceSuspended ? (
              view !== 'race' ? (
                <button className="btn btn-soft btn-lg" onClick={() => setView('race')}>Mode Course</button>
              ) : (
                <button className="btn btn-soft btn-lg" onClick={() => setView('home')}>Accueil</button>
              )
            ) : null}
            {view !== 'profile' ? (
              <button className="btn btn-soft btn-lg" onClick={() => { setProfileUserId(session.user.id); setView('profile'); }}>Profil</button>
            ) : (
              <button className="btn btn-soft btn-lg" onClick={() => setView('home')}>Accueil</button>
            )}
            <button className="btn btn-primary btn-lg" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
          </div>
        </div>
      </header>
      {view === 'home' ? (
        <div className="home-grid">
          <div>
            <Game session={session} />
          </div>
          <div>
            <Leaderboard onSelectUser={(uid) => { setProfileUserId(uid); setView('profile'); }} />
          </div>
        </div>
      ) : view === 'profile' ? (
        <ProfilePage session={session} userId={profileUserId || session.user.id} />
      ) : (
        !raceSuspended ? (
          <RaceGame session={session} />
        ) : (
          <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px' }}>
            <h2 style={{ marginTop: 12 }}>🏁 Mode Course</h2>
            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, padding: 16 }}>
              Le mode Course est actuellement suspendu par un administrateur.
            </div>
          </div>
        )
      )}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}
