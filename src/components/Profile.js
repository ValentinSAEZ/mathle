import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile({ session, onClose }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  // Changement de mot de passe
  const [pwCurrent, setPwCurrent] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    if (!session?.user?.id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setMessage('');
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (mounted) setUsername(data?.username || '');
      } catch (e) {
        console.error(e);
        if (mounted) setMessage("Impossible de charger le profil (vérifier la table/profil)");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [session]);

  const save = async (e) => {
    e?.preventDefault?.();
    if (!session?.user?.id) return;
    setLoading(true);
    setMessage('');
    try {
      const uname = username.trim();
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, username: uname });
      if (error) throw error;
      setMessage('Profil enregistré ✅');
    } catch (e) {
      console.error(e);
      setMessage("Échec de l’enregistrement du profil.");
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (e) => {
    e?.preventDefault?.();
    if (!session?.user) return;
    setPwMsg('');
    if (pw1 !== pw2) { setPwMsg('Les mots de passe ne correspondent pas.'); return; }
    if ((pw1 || '').length < 6) { setPwMsg('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    setPwSaving(true);
    try {
      const email = session.user.email;
      if (pwCurrent) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: pwCurrent });
        if (reauthErr) { setPwMsg('Mot de passe actuel incorrect.'); setPwSaving(false); return; }
      }
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPwMsg('Mot de passe mis à jour ✅');
      setPwCurrent(''); setPw1(''); setPw2('');
    } catch (err) {
      setPwMsg(err?.message || 'Impossible de mettre à jour le mot de passe.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'grid', placeItems: 'center',
        zIndex: 50,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="card"
        style={{
          width: 'min(92vw, 520px)',
          padding: 20,
          boxShadow: '0 12px 32px rgba(0,0,0,0.15)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Mon profil</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={save} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <label style={{ textAlign: 'left', fontSize: 14 }}>
            Nom d'utilisateur
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: Alice"
              required
              className="input"
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn" style={{ padding: '10px 16px', borderRadius: 12 }}>Annuler</button>
            <button type="submit" disabled={loading} style={{
              padding: '10px 16px', borderRadius: 12, border: 'none', background: '#111', color: 'white', cursor: loading ? 'not-allowed' : 'pointer'
            }}>{loading ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>

        {message && (
          <div style={{ marginTop: 12, fontSize: 14 }}>{message}</div>
        )}

        {/* Sécurité */}
        <div style={{ marginTop: 16 }}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, outline: 'none' }}>🔒 Sécurité (modifier le mot de passe)</summary>
            <form onSubmit={changePassword} style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <label style={{ textAlign: 'left', fontSize: 14 }}>
              Mot de passe actuel (optionnel)
              <input
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                placeholder="••••••••"
                className="input"
                style={{ width: '100%', marginTop: 6 }}
                autoComplete="current-password"
              />
            </label>
            <label style={{ textAlign: 'left', fontSize: 14 }}>
              Nouveau mot de passe
              <input
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                placeholder="Au moins 6 caractères"
                className="input"
                style={{ width: '100%', marginTop: 6 }}
                autoComplete="new-password"
                required
              />
            </label>
            <label style={{ textAlign: 'left', fontSize: 14 }}>
              Confirmer le nouveau mot de passe
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="Répétez le mot de passe"
                className="input"
                style={{ width: '100%', marginTop: 6 }}
                autoComplete="new-password"
                required
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary" disabled={pwSaving}>{pwSaving ? 'Mise à jour…' : 'Changer le mot de passe'}</button>
              {pwMsg && <div style={{ fontSize: 14 }}>{pwMsg}</div>}
            </div>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
