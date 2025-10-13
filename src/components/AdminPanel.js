import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import riddles from '../data/riddles.json';

function getUTCDateKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminPanel({ onClose }) {
  const dayKey = useMemo(() => getUTCDateKey(), []);

  // Override form
  const [rid, setRid] = useState('');
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [t, setT] = useState('word');
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState('');

  // Ban form
  const [banUserId, setBanUserId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banMsg, setBanMsg] = useState('');
  const [banning, setBanning] = useState(false);

  // Banner form
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');

  // Race settings (suspension)
  const [raceSuspended, setRaceSuspended] = useState(false);
  const [raceSaving, setRaceSaving] = useState(false);
  const [raceMsg, setRaceMsg] = useState('');
  const [tab, setTab] = useState('riddle'); // 'riddle' | 'bans' | 'banner'

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('riddle_overrides')
          .select('riddle_id, question, answer, type')
          .eq('day_key', dayKey)
          .maybeSingle();
        if (data && mounted) {
          setRid(data.riddle_id ?? '');
          setQ(data.question ?? '');
          setA(data.answer ?? '');
          setT(data.type ?? 'word');
        }
      } catch {}
      // Load banner
      try {
        const { data: b } = await supabase
          .from('site_banner')
          .select('active, message')
          .eq('id', 1)
          .maybeSingle();
        if (mounted) {
          setBannerActive(Boolean(b?.active));
          setBannerMessage(b?.message || '');
        }
      } catch {}
      // Load race settings
      try {
        const { data: r } = await supabase
          .from('race_settings')
          .select('suspended')
          .eq('id', 1)
          .maybeSingle();
        if (mounted) setRaceSuspended(Boolean(r?.suspended));
      } catch {}
    })();
    return () => { mounted = false; };
  }, [dayKey]);

  const saveOverride = async (e) => {
    e?.preventDefault?.();
    setSavingOverride(true);
    setOverrideMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_riddle', {
        p_day: dayKey,
        p_riddle_id: rid !== '' ? Number(rid) : null,
        p_question: q || null,
        p_type: q ? t : null,
        p_answer: q ? a : null,
      });
      if (error) throw error;
      setOverrideMsg('Override enregistré et leaderboard réinitialisé ✅');
      // Notifie l'UI pour rafraîchir instantanément
      window.dispatchEvent(new CustomEvent('mathle:override-updated', { detail: { dayKey } }));
    } catch (e) {
      console.error(e);
      setOverrideMsg("Échec de l'enregistrement de l'override");
    } finally {
      setSavingOverride(false);
    }
  };

  const clearOverride = async () => {
    setSavingOverride(true);
    setOverrideMsg('');
    try {
      const { error } = await supabase.rpc('admin_clear_riddle', { p_day: dayKey });
      if (error) throw error;
      setOverrideMsg('Override supprimé et leaderboard réinitialisé ✅');
      setRid(''); setQ(''); setA(''); setT('word');
      // Notifie l'UI pour rafraîchir instantanément
      window.dispatchEvent(new CustomEvent('mathle:override-updated', { detail: { dayKey } }));
    } catch (e) {
      console.error(e);
      setOverrideMsg("Impossible de supprimer l'override");
    } finally {
      setSavingOverride(false);
    }
  };

  const ban = async (e) => {
    e?.preventDefault?.();
    if (!banUserId) return;
    setBanning(true);
    setBanMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_ban', {
        p_user: banUserId,
        p_reason: banReason || null,
        p_banned: true,
      });
      if (error) throw error;
      setBanMsg('Utilisateur banni ✅');
    } catch (e) {
      console.error(e);
      setBanMsg("Échec du ban");
    } finally {
      setBanning(false);
    }
  };

  const unban = async () => {
    if (!banUserId) return;
    setBanning(true);
    setBanMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_ban', {
        p_user: banUserId,
        p_reason: banReason || null,
        p_banned: false,
      });
      if (error) throw error;
      setBanMsg('Utilisateur débanni ✅');
    } catch (e) {
      console.error(e);
      setBanMsg("Échec du débannissement");
    } finally {
      setBanning(false);
    }
  };

  const saveBanner = async (e) => {
    e?.preventDefault?.();
    setBannerSaving(true);
    setBannerMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_banner', {
        p_active: bannerActive,
        p_message: bannerMessage,
      });
      if (error) throw error;
      setBannerMsg('Bandeau enregistré ✅');
      window.dispatchEvent(new CustomEvent('mathle:banner-updated'));
    } catch (e) {
      console.error(e);
      setBannerMsg("Échec de l'enregistrement du bandeau");
    } finally {
      setBannerSaving(false);
    }
  };

  const saveRace = async (e) => {
    e?.preventDefault?.();
    setRaceSaving(true);
    setRaceMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_race', {
        p_suspended: raceSuspended,
      });
      if (error) throw error;
      setRaceMsg('Paramètres Course enregistrés ✅');
      window.dispatchEvent(new CustomEvent('mathle:race-updated'));
    } catch (e) {
      console.error(e);
      setRaceMsg("Échec de l'enregistrement des paramètres Course");
    } finally {
      setRaceSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', padding: 12, zIndex: 60, display: 'grid' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        style={{
          margin: 'auto',
          width: 'min(96vw, 860px)',
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: 0 }}>Panneau d'administration</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>Fermer</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
          {[
            { id: 'riddle', label: `Énigme du jour (${dayKey})` },
            { id: 'bans', label: 'Bannis' },
            { id: 'banner', label: 'Bandeau' },
            { id: 'race', label: 'Course' },
          ].map(ti => (
            <button
              key={ti.id}
              onClick={() => setTab(ti.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: tab === ti.id ? '1px solid #111' : '1px solid #e5e7eb',
                background: tab === ti.id ? '#111' : '#fff',
                color: tab === ti.id ? '#fff' : '#111',
                cursor: 'pointer'
              }}
            >{ti.label}</button>
          ))}
        </div>

        {/* Content (scrollable) */}
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {tab === 'riddle' && (
            <section>
              <form onSubmit={saveOverride} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr', }}>
                  <label style={{ fontSize: 14 }}>
                    Riddle JSON id (optionnel)
                    <input type="number" value={rid} onChange={(e)=>setRid(e.target.value)} placeholder="ex: 5" style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                  </label>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Laisser vide pour utiliser la question personnalisée ci-dessous, sinon l'id JSON sera prioritaire.
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <label style={{ fontSize: 14 }}>
                    Question personnalisée
                    <textarea value={q} onChange={(e)=>setQ(e.target.value)} rows={4} placeholder="Saisir une question..." style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}/>
                  </label>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '150px 1fr' }}>
                    <label style={{ fontSize: 14 }}>
                      Type
                      <select value={t} onChange={(e)=>setT(e.target.value)} style={{ display: 'block', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                        <option value="word">word</option>
                        <option value="number">number</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 14 }}>
                      Réponse
                      <input type="text" value={a} onChange={(e)=>setA(e.target.value)} placeholder="ex: 36" style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={clearOverride} disabled={savingOverride} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>Supprimer l'override</button>
                  <button type="submit" disabled={savingOverride} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#111', color: 'white', cursor: 'pointer' }}>{savingOverride ? 'Enregistrement…' : 'Enregistrer'}</button>
                </div>
                {overrideMsg && <div style={{ fontSize: 14 }}>{overrideMsg}</div>}
              </form>
            </section>
          )}

          {tab === 'bans' && (
            <section>
              <form onSubmit={ban} style={{ display: 'grid', gap: 12 }}>
                <label style={{ fontSize: 14 }}>
                  User ID (uuid)
                  <input type="text" value={banUserId} onChange={(e)=>setBanUserId(e.target.value)} placeholder="uuid de l'utilisateur" style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                </label>
                <label style={{ fontSize: 14 }}>
                  Raison (optionnel)
                  <input type="text" value={banReason} onChange={(e)=>setBanReason(e.target.value)} placeholder="raison" style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={banning} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>{banning ? 'Bannissement…' : 'Bannir'}</button>
                  <button type="button" onClick={unban} disabled={banning} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>Débannir</button>
                </div>
                {banMsg && <div style={{ fontSize: 14 }}>{banMsg}</div>}
              </form>
            </section>
          )}

          {tab === 'banner' && (
            <section>
              <form onSubmit={saveBanner} style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={bannerActive} onChange={e=>setBannerActive(e.target.checked)} />
                  Activer le bandeau
                </label>
                <label style={{ fontSize: 14 }}>
                  Message
                  <textarea value={bannerMessage} onChange={(e)=>setBannerMessage(e.target.value)} rows={4} placeholder="Saisir un message..." style={{ width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}/>
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={bannerSaving} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#111', color: 'white', cursor: 'pointer' }}>{bannerSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
                </div>
                {bannerMsg && <div style={{ fontSize: 14 }}>{bannerMsg}</div>}
              </form>
            </section>
          )}

          {tab === 'race' && (
            <section>
              <form onSubmit={saveRace} style={{ display: 'grid', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={raceSuspended} onChange={e=>setRaceSuspended(e.target.checked)} />
                  Suspendre l'accès au mode Course (masque le bouton et bloque l'accès)
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={raceSaving} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#111', color: 'white', cursor: 'pointer' }}>{raceSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
                </div>
                {raceMsg && <div style={{ fontSize: 14 }}>{raceMsg}</div>}
              </form>
            </section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
