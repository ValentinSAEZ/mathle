import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function ScheduleForm() {
  const [date, setDate] = useState('');
  const [rid, setRid] = useState('');
  const [q, setQ] = useState('');
  const [t, setT] = useState('word');
  const [a, setA] = useState('');
  const [exp, setExp] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    setMsg(''); setSaving(true);
    try {
      if (!date) { setMsg('Date requise'); setSaving(false); return; }
      const payload = {
        p_day: date,
        p_riddle_id: rid ? Number(rid) : null,
        p_question: q || null,
        p_type: q ? t : null,
        p_answer: q ? a : null,
        p_explanation: exp || null,
      };
      const { error } = await supabase.rpc('admin_set_schedule', payload);
      if (error) throw error;
      setMsg('Calendrier enregistré ✅');
    } catch (e) {
      console.error(e);
      const d = e?.message || e?.error?.message || e?.details || '';
      setMsg(`Échec — ${d}`);
    } finally { setSaving(false); }
  };

  const clear = async () => {
    setMsg(''); setSaving(true);
    try {
      if (!date) { setMsg('Date requise'); setSaving(false); return; }
      const { error } = await supabase.rpc('admin_clear_schedule', { p_day: date });
      if (error) throw error;
      setMsg('Planification supprimée ✅');
      setRid(''); setQ(''); setA(''); setT('word'); setExp('');
    } catch (e) {
      console.error(e);
      const d = e?.message || e?.error?.message || e?.details || '';
      setMsg(`Échec — ${d}`);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <label style={{ fontSize: 14 }}>
        Date (UTC)
        <input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
      </label>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr' }}>
        <label style={{ fontSize: 14 }}>
          ID d’énigme (optionnel)
          <input className="input" type="number" value={rid} onChange={(e)=>setRid(e.target.value)} placeholder="ex: 5" style={{ width: '100%', marginTop: 4 }} />
        </label>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Laisser vide pour une question personnalisée, sinon l’ID serveur sera prioritaire.
        </div>
      </div>
      <label style={{ fontSize: 14 }}>
        Question personnalisée (optionnel)
        <textarea className="input" value={q} onChange={(e)=>setQ(e.target.value)} rows={4} placeholder="Saisir une question..." style={{ width: '100%', marginTop: 4 }}/>
      </label>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '150px 1fr' }}>
        <label style={{ fontSize: 14 }}>
          Type
          <select className="input" value={t} onChange={(e)=>setT(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
            <option value="word">word</option>
            <option value="number">number</option>
          </select>
        </label>
        <label style={{ fontSize: 14 }}>
          Réponse
          <input className="input" type="text" value={a} onChange={(e)=>setA(e.target.value)} placeholder="ex: 36" style={{ width: '100%', marginTop: 4 }} />
        </label>
      </div>
      <label style={{ fontSize: 14 }}>
        Explication (optionnel)
        <textarea className="input" value={exp} onChange={(e)=>setExp(e.target.value)} rows={4} placeholder="Ajoutez une explication..." style={{ width: '100%', marginTop: 4 }}/>
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={clear} disabled={saving}>Supprimer</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
      {msg && <div style={{ fontSize: 14 }}>{msg}</div>}
    </form>
  );
}

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
  const [exp, setExp] = useState('');
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
  const [tab, setTab] = useState('riddle'); // 'riddle' | 'bans' | 'banner' | 'race' | 'riddles' | 'schedule'

  // Add riddle form
  const [addType, setAddType] = useState('word');
  const [addQ, setAddQ] = useState('');
  const [addA, setAddA] = useState('');
  const [addExp, setAddExp] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState('');

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
        p_explanation: exp || null,
      });
      if (error) throw error;
      setOverrideMsg('Override enregistré et leaderboard réinitialisé ✅');
      // Notifie l'UI pour rafraîchir instantanément
      window.dispatchEvent(new CustomEvent('mathle:override-updated', { detail: { dayKey } }));
    } catch (e) {
      console.error(e);
      const detail = e?.message || e?.error?.message || e?.hint || e?.details || '';
      setOverrideMsg(`Échec de l'enregistrement de l'override${detail ? ' — ' + detail : ''}`);
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
      setRid(''); setQ(''); setA(''); setT('word'); setExp('');
      // Notifie l'UI pour rafraîchir instantanément
      window.dispatchEvent(new CustomEvent('mathle:override-updated', { detail: { dayKey } }));
    } catch (e) {
      console.error(e);
      const detail = e?.message || e?.error?.message || e?.hint || e?.details || '';
      setOverrideMsg(`Impossible de supprimer l'override${detail ? ' — ' + detail : ''}`);
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

  const addRiddle = async (e) => {
    e?.preventDefault?.();
    setAddSaving(true);
    setAddMsg('');
    try {
      if (addType === 'number') {
        const normalized = (addA ?? '').toString().replace(',', '.').trim();
        if (!normalized || Number.isNaN(Number(normalized))) {
          setAddMsg("Réponse numérique invalide (ex: 36 ou 12.5)");
          setAddSaving(false);
          return;
        }
      } else {
        if (!addA || !addA.toString().trim()) {
          setAddMsg("Réponse requise pour le type 'word'");
          setAddSaving(false);
          return;
        }
      }
      const { data, error } = await supabase.rpc('admin_add_riddle', {
        p_type: addType,
        p_question: addQ,
        p_answer: addType === 'number' ? (addA ?? '').toString().replace(',', '.') : addA,
        p_explanation: addExp || null,
      });
      if (error) throw error;
      const newId = Array.isArray(data) ? data[0] : data;
      setAddMsg(`Énigme créée avec l'ID ${newId} ✅`);
      // Reset form lightly
      setAddQ(''); setAddA(''); setAddExp('');
    } catch (e) {
      console.error(e);
      const detail = e?.message || e?.error?.message || e?.hint || e?.details || '';
      setAddMsg(`Échec de la création de l'énigme${detail ? ' — ' + detail : ''}`);
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', padding: 12, zIndex: 60, display: 'grid' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="card" style={{ margin: 'auto', width: 'min(96vw, 860px)', display: 'grid', gridTemplateRows: 'auto 1fr auto', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: 0 }}>Panneau d'administration</h3>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { id: 'riddle', label: `Énigme du jour (${dayKey})` },
            { id: 'riddles', label: 'Énigmes' },
            { id: 'bans', label: 'Bannis' },
            { id: 'banner', label: 'Bandeau' },
            { id: 'race', label: 'Course' },
            { id: 'schedule', label: 'Calendrier' },
          ].map(ti => (
            <button key={ti.id} className={`tab ${tab === ti.id ? 'active' : ''}`} onClick={() => setTab(ti.id)}>{ti.label}</button>
          ))}
        </div>

        {/* Content (scrollable) */}
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {tab === 'riddle' && (
            <section>
              <form onSubmit={saveOverride} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr', }}>
                  <label style={{ fontSize: 14 }}>
                    ID d’énigme (optionnel)
                    <input className="input" type="number" value={rid} onChange={(e)=>setRid(e.target.value)} placeholder="ex: 5" style={{ width: '100%', marginTop: 4 }} />
                  </label>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Laisser vide pour utiliser la question personnalisée ci-dessous, sinon l'ID d’énigme serveur sera prioritaire.
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <label style={{ fontSize: 14 }}>
                    Question personnalisée
                    <textarea className="input" value={q} onChange={(e)=>setQ(e.target.value)} rows={4} placeholder="Saisir une question..." style={{ width: '100%', marginTop: 4 }}/>
                  </label>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '150px 1fr' }}>
                    <label style={{ fontSize: 14 }}>
                      Type
                      <select className="input" value={t} onChange={(e)=>setT(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
                        <option value="word">word</option>
                        <option value="number">number</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 14 }}>
                      Réponse
                      <input className="input" type="text" value={a} onChange={(e)=>setA(e.target.value)} placeholder="ex: 36" style={{ width: '100%', marginTop: 4 }} />
                    </label>
                  </div>
                  <label style={{ fontSize: 14 }}>
                    Explication (optionnel)
                    <textarea className="input" value={exp} onChange={(e)=>setExp(e.target.value)} rows={4} placeholder="Ajoutez une explication..." style={{ width: '100%', marginTop: 4 }}/>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={clearOverride} disabled={savingOverride}>Supprimer l'override</button>
                  <button type="submit" className="btn btn-primary" disabled={savingOverride}>{savingOverride ? 'Enregistrement…' : 'Enregistrer'}</button>
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
                  <input className="input" type="text" value={banUserId} onChange={(e)=>setBanUserId(e.target.value)} placeholder="uuid de l'utilisateur" style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 14 }}>
                  Raison (optionnel)
                  <input className="input" type="text" value={banReason} onChange={(e)=>setBanReason(e.target.value)} placeholder="raison" style={{ width: '100%', marginTop: 4 }} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-danger" disabled={banning}>{banning ? 'Bannissement…' : 'Bannir'}</button>
                  <button type="button" className="btn" onClick={unban} disabled={banning}>Débannir</button>
                </div>
                {banMsg && <div style={{ fontSize: 14 }}>{banMsg}</div>}
              </form>
            </section>
          )}

          {tab === 'riddles' && (
            <section>
              <form onSubmit={addRiddle} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <label style={{ fontSize: 14 }}>
                    Question
                    <textarea className="input" value={addQ} onChange={(e)=>setAddQ(e.target.value)} rows={4} placeholder="Saisir une question..." style={{ width: '100%', marginTop: 4 }}/>
                  </label>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '150px 1fr' }}>
                    <label style={{ fontSize: 14 }}>
                      Type
                      <select className="input" value={addType} onChange={(e)=>setAddType(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
                        <option value="word">word</option>
                        <option value="number">number</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 14 }}>
                      Réponse
                      <input className="input" type="text" value={addA} onChange={(e)=>setAddA(e.target.value)} placeholder="ex: 36 ou 'octogone'" style={{ width: '100%', marginTop: 4 }} />
                    </label>
                  </div>
                  <label style={{ fontSize: 14 }}>
                    Explication (optionnel)
                    <textarea className="input" value={addExp} onChange={(e)=>setAddExp(e.target.value)} rows={4} placeholder="Ajoutez une explication pour l’archive..." style={{ width: '100%', marginTop: 4 }}/>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={addSaving}>{addSaving ? 'Création…' : 'Ajouter l’énigme'}</button>
                </div>
                {addMsg && <div style={{ fontSize: 14 }}>{addMsg}</div>}
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
                  <textarea className="input" value={bannerMessage} onChange={(e)=>setBannerMessage(e.target.value)} rows={4} placeholder="Saisir un message..." style={{ width: '100%', marginTop: 4 }}/>
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={bannerSaving}>{bannerSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
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
                  <button type="submit" className="btn btn-primary" disabled={raceSaving}>{raceSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
                </div>
                {raceMsg && <div style={{ fontSize: 14 }}>{raceMsg}</div>}
              </form>
            </section>
          )}

          {tab === 'schedule' && (
            <section>
              <ScheduleForm />
            </section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
