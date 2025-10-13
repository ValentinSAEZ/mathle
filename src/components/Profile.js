import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile({ session, onClose }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
        style={{
          width: 'min(92vw, 520px)',
          background: 'white',
          borderRadius: 16,
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
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid #ddd',
                fontSize: 16,
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 16px', borderRadius: 12, border: '1px solid #ddd', background: 'white', cursor: 'pointer'
            }}>Annuler</button>
            <button type="submit" disabled={loading} style={{
              padding: '10px 16px', borderRadius: 12, border: 'none', background: '#111', color: 'white', cursor: loading ? 'not-allowed' : 'pointer'
            }}>{loading ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>

        {message && (
          <div style={{ marginTop: 12, fontSize: 14 }}>{message}</div>
        )}
      </div>
    </div>
  );
}

