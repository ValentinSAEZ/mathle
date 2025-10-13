import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auth({ onSignedIn }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    let resp;
    if (mode === 'signup') {
      resp = await supabase.auth.signUp({ email, password });
    } else {
      resp = await supabase.auth.signInWithPassword({ email, password });
    }
    const { data, error } = resp;
    if (error) { alert(error.message); return; }

    // Si inscription: tenter d'enregistrer le username
    if (mode === 'signup' && username.trim()) {
      const userId = data?.user?.id;
      if (data?.session?.access_token) {
        const { error: errProfile } = await supabase
          .from('profiles')
          .upsert({ id: userId, username: username.trim() });
        if (errProfile) console.error(errProfile);
      } else if (userId) {
        // pas de session (email de confirmation requis): sauvegarder localement pour mise à jour au prochain login
        localStorage.setItem('pending_username', JSON.stringify({ userId, username: username.trim() }));
      }
    }
    onSignedIn?.(data?.session ?? null);
  };

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', textAlign: 'center' }}>
      <h2>{mode === 'signup' ? 'Créer un compte' : 'Se connecter'}</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Nom d'utilisateur (affiché)"
            value={username}
            onChange={e=>setUsername(e.target.value)}
            required
          />
        )}
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <input type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required/>
        <button type="submit">{mode === 'signup' ? "S'inscrire" : 'Connexion'}</button>
      </form>
      <div style={{ marginTop: 10 }}>
        {mode === 'signup' ? (
          <button onClick={()=>setMode('signin')}>Déjà inscrit ? Se connecter</button>
        ) : (
          <button onClick={()=>setMode('signup')}>Créer un compte</button>
        )}
      </div>
    </div>
  );
}
