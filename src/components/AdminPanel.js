import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RIDDLE_THEMES } from '../lib/celebrate';

/* ─── helpers ─────────────────────────────────────────────────── */
function getUTCDateKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  const ok = msg.includes('✅');
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      color: ok ? '#10b981' : '#ef4444',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
    }}>{msg}</div>
  );
}

function SectionTitle({ children }) {
  return (
    <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {children}
    </h4>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{children}</div>;
}

const TABS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'riddle',    icon: '🧩', label: 'Énigme du jour' },
  { id: 'riddles',   icon: '📚', label: 'Bibliothèque' },
  { id: 'users',     icon: '👥', label: 'Utilisateurs' },
  { id: 'banner',    icon: '📢', label: 'Bandeau' },
  { id: 'race',      icon: '🏁', label: 'Course' },
  { id: 'schedule',  icon: '📅', label: 'Calendrier' },
];

/* ─── Dashboard tab ────────────────────────────────────────────── */
function DashboardTab({ dayKey }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [
          { count: totalUsers },
          { count: totalRiddles },
          { count: solvesToday },
          { count: totalBans },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('riddles').select('*', { count: 'exact', head: true }),
          supabase.from('attempts').select('*', { count: 'exact', head: true }).eq('day_key', dayKey).eq('result', 'correct'),
          supabase.from('bans').select('*', { count: 'exact', head: true }).eq('banned', true),
        ]);
        if (mounted) setStats({ totalUsers, totalRiddles, solvesToday, totalBans });
      } catch {}
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [dayKey]);

  const cards = stats ? [
    { icon: '👥', label: 'Utilisateurs inscrits', value: stats.totalUsers ?? '—', color: '#6366f1' },
    { icon: '📚', label: 'Énigmes en banque', value: stats.totalRiddles ?? '—', color: '#10b981' },
    { icon: '✅', label: `Résolues aujourd'hui`, value: stats.solvesToday ?? '—', color: '#f59e0b' },
    { icon: '🚫', label: 'Comptes bannis', value: stats.totalBans ?? '—', color: '#ef4444' },
  ] : [];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, gridColumn: '1/-1' }}>Chargement des stats...</div>
        ) : cards.map((c, i) => (
          <div key={i} className="card" style={{ padding: '20px 16px', textAlign: 'center', borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Énigme active — {dayKey}</SectionTitle>
        <DailyRiddlePreview dayKey={dayKey} />
      </div>
    </div>
  );
}

function DailyRiddlePreview({ dayKey }) {
  const [riddle, setRiddle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc('get_daily_riddle', { p_day: dayKey });
        setRiddle(Array.isArray(data) ? data[0] : data);
      } catch {}
      setLoading(false);
    })();
  }, [dayKey]);

  if (loading) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement...</div>;
  if (!riddle) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune énigme active pour aujourd'hui.</div>;

  const theme = RIDDLE_THEMES[riddle.theme] || RIDDLE_THEMES.general;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ background: theme.color + '22', color: theme.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
          {theme.icon} {theme.label}
        </span>
        <span style={{ background: 'var(--surface-subtle)', padding: '3px 10px', borderRadius: 20, fontSize: 12, color: 'var(--muted)' }}>
          {riddle.type}
        </span>
        {riddle.id && <span style={{ fontSize: 12, color: 'var(--muted)' }}>ID #{riddle.id}</span>}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, background: 'var(--surface-subtle)', borderRadius: 8, padding: '12px 14px', whiteSpace: 'pre-line' }}>
        {riddle.question}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        Réponse : <strong style={{ color: 'var(--text)' }}>{riddle.answer}</strong>
      </div>
    </div>
  );
}

/* ─── Énigme du jour (override) ───────────────────────────────── */
function RiddleOverrideTab({ dayKey }) {
  const [rid, setRid] = useState('');
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [t, setT] = useState('number');
  const [exp, setExp] = useState('');
  const [theme, setTheme] = useState('general');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('riddle_overrides')
          .select('riddle_id, question, answer, type, explanation')
          .eq('day_key', dayKey).maybeSingle();
        if (data) {
          setRid(data.riddle_id ?? '');
          setQ(data.question ?? '');
          setA(data.answer ?? '');
          setT(data.type ?? 'number');
          setExp(data.explanation ?? '');
        }
      } catch {}
    })();
  }, [dayKey]);

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true); setMsg('');
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
      setMsg('Override enregistré ✅');
      window.dispatchEvent(new CustomEvent('mathle:override-updated', { detail: { dayKey } }));
    } catch (e) {
      setMsg(`Échec — ${e?.message || ''}`);
    } finally { setSaving(false); }
  };

  const clear = async () => {
    setSaving(true); setMsg('');
    try {
      const { error } = await supabase.rpc('admin_clear_riddle', { p_day: dayKey });
      if (error) throw error;
      setMsg('Override supprimé ✅');
      setRid(''); setQ(''); setA(''); setT('number'); setExp(''); setTheme('general');
      window.dispatchEvent(new CustomEvent('mathle:override-updated', { detail: { dayKey } }));
    } catch (e) {
      setMsg(`Échec — ${e?.message || ''}`);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <SectionTitle>Utiliser une énigme existante</SectionTitle>
        <FieldLabel>ID d'énigme</FieldLabel>
        <input className="input" type="number" value={rid} onChange={e => setRid(e.target.value)}
          placeholder="ex: 5 — laisser vide pour question personnalisée" style={{ width: '100%' }} />
      </div>

      <div className="card" style={{ padding: 16 }}>
        <SectionTitle>Ou créer une question personnalisée</SectionTitle>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <FieldLabel>Thème</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(RIDDLE_THEMES).map(([key, th]) => (
                <button key={key} type="button" onClick={() => setTheme(key)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '2px solid',
                  background: theme === key ? th.color + '22' : 'transparent',
                  borderColor: theme === key ? th.color : 'var(--card-border)',
                  color: theme === key ? th.color : 'var(--muted)',
                }}>
                  {th.icon} {th.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Question</FieldLabel>
            <textarea className="input" value={q} onChange={e => setQ(e.target.value)}
              rows={4} placeholder="Saisir la question..." style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Type</FieldLabel>
              <select className="input" value={t} onChange={e => setT(e.target.value)} style={{ width: '100%' }}>
                <option value="number">Nombre</option>
                <option value="word">Mot</option>
              </select>
            </div>
            <div>
              <FieldLabel>Réponse</FieldLabel>
              <input className="input" type="text" value={a} onChange={e => setA(e.target.value)}
                placeholder="ex: 42" style={{ width: '100%' }} />
            </div>
          </div>
          <div>
            <FieldLabel>Explication (optionnel)</FieldLabel>
            <textarea className="input" value={exp} onChange={e => setExp(e.target.value)}
              rows={3} placeholder="Explication affichée après résolution..." style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn" onClick={clear} disabled={saving}>Supprimer l'override</button>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginLeft: 'auto' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      <StatusMsg msg={msg} />
    </form>
  );
}

/* ─── Bibliothèque d'énigmes ──────────────────────────────────── */
function RiddlesTab() {
  const [riddles, setRiddles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTheme, setFilterTheme] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [addType, setAddType] = useState('number');
  const [addQ, setAddQ] = useState('');
  const [addA, setAddA] = useState('');
  const [addExp, setAddExp] = useState('');
  const [addTheme, setAddTheme] = useState('general');
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('riddles')
        .select('id, question, answer, type, theme, explanation')
        .order('id', { ascending: false })
        .limit(100);
      setRiddles(data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return riddles.filter(r => {
      if (filterTheme !== 'all' && r.theme !== filterTheme) return false;
      if (search && !r.question?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [riddles, search, filterTheme]);

  const addRiddle = async (e) => {
    e?.preventDefault?.();
    setAddSaving(true); setAddMsg('');
    try {
      if (!addQ.trim() || !addA.trim()) { setAddMsg('Question et réponse requises'); setAddSaving(false); return; }
      const { data, error } = await supabase.rpc('admin_add_riddle', {
        p_type: addType,
        p_question: addQ,
        p_answer: addType === 'number' ? addA.replace(',', '.') : addA,
        p_explanation: addExp || null,
      });
      if (error) throw error;
      // Set theme separately if column exists
      const newId = Array.isArray(data) ? data[0] : data;
      if (newId) {
        await supabase.from('riddles').update({ theme: addTheme }).eq('id', newId);
      }
      setAddMsg(`Énigme #${newId} créée ✅`);
      setAddQ(''); setAddA(''); setAddExp(''); setAddTheme('general');
      setShowForm(false);
      load();
    } catch (e) {
      setAddMsg(`Échec — ${e?.message || ''}`);
    } finally { setAddSaving(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher..." style={{ flex: 1, minWidth: 180 }} />
        <select className="input" value={filterTheme} onChange={e => setFilterTheme(e.target.value)} style={{ width: 150 }}>
          <option value="all">Tous les thèmes</option>
          {Object.entries(RIDDLE_THEMES).map(([k, th]) => (
            <option key={k} value={k}>{th.icon} {th.label}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Annuler' : '+ Nouvelle énigme'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>Nouvelle énigme</SectionTitle>
          <form onSubmit={addRiddle} style={{ display: 'grid', gap: 12 }}>
            <div>
              <FieldLabel>Thème</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(RIDDLE_THEMES).map(([key, th]) => (
                  <button key={key} type="button" onClick={() => setAddTheme(key)} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '2px solid',
                    background: addTheme === key ? th.color + '22' : 'transparent',
                    borderColor: addTheme === key ? th.color : 'var(--card-border)',
                    color: addTheme === key ? th.color : 'var(--muted)',
                  }}>{th.icon} {th.label}</button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Question</FieldLabel>
              <textarea className="input" value={addQ} onChange={e => setAddQ(e.target.value)}
                rows={4} placeholder="Énoncé de l'énigme..." style={{ width: '100%' }} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
              <div>
                <FieldLabel>Type</FieldLabel>
                <select className="input" value={addType} onChange={e => setAddType(e.target.value)} style={{ width: '100%' }}>
                  <option value="number">Nombre</option>
                  <option value="word">Mot</option>
                </select>
              </div>
              <div>
                <FieldLabel>Réponse</FieldLabel>
                <input className="input" type="text" value={addA} onChange={e => setAddA(e.target.value)}
                  placeholder="ex: 42" style={{ width: '100%' }} required />
              </div>
            </div>
            <div>
              <FieldLabel>Explication (optionnel)</FieldLabel>
              <textarea className="input" value={addExp} onChange={e => setAddExp(e.target.value)}
                rows={3} placeholder="Correction affichée après résolution..." style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary" disabled={addSaving}>
                {addSaving ? 'Création…' : 'Créer l\'énigme'}
              </button>
              <StatusMsg msg={addMsg} />
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length} énigme{filtered.length !== 1 ? 's' : ''}</div>
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(r => {
            const th = RIDDLE_THEMES[r.theme] || RIDDLE_THEMES.general;
            return (
              <div key={r.id} className="card" style={{ padding: '12px 16px', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>#{r.id}</span>
                  <span style={{ background: th.color + '22', color: th.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {th.icon} {th.label}
                  </span>
                  <span style={{ background: 'var(--surface-subtle)', padding: '2px 8px', borderRadius: 20, fontSize: 11, color: 'var(--muted)' }}>
                    {r.type}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                    Rép : <strong style={{ color: 'var(--text)' }}>{r.answer}</strong>
                  </span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
                  {r.question?.length > 150 ? r.question.slice(0, 150) + '…' : r.question}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20, fontSize: 14 }}>Aucune énigme trouvée</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Utilisateurs & bans ─────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [bans, setBans] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'banned'
  const [actionMsg, setActionMsg] = useState({});
  const [actioning, setActioning] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, created_at, xp, is_admin')
        .order('created_at', { ascending: false })
        .limit(100);
      const { data: banData } = await supabase
        .from('bans')
        .select('user_id')
        .eq('banned', true);
      setUsers(profiles || []);
      setBans(new Set((banData || []).map(b => b.user_id)));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleBan = async (userId, currentlyBanned) => {
    setActioning(prev => ({ ...prev, [userId]: true }));
    setActionMsg(prev => ({ ...prev, [userId]: '' }));
    try {
      const { error } = await supabase.rpc('admin_set_ban', {
        p_user: userId,
        p_reason: null,
        p_banned: !currentlyBanned,
      });
      if (error) throw error;
      setBans(prev => {
        const next = new Set(prev);
        if (currentlyBanned) next.delete(userId); else next.add(userId);
        return next;
      });
      setActionMsg(prev => ({ ...prev, [userId]: currentlyBanned ? 'Débanni ✅' : 'Banni ✅' }));
    } catch (e) {
      setActionMsg(prev => ({ ...prev, [userId]: `Échec` }));
    } finally {
      setActioning(prev => ({ ...prev, [userId]: false }));
    }
  };

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filter === 'banned' && !bans.has(u.id)) return false;
      if (search && !u.username?.toLowerCase().includes(search.toLowerCase()) && !u.id.includes(search)) return false;
      return true;
    });
  }, [users, bans, search, filter]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher par nom ou ID..." style={{ flex: 1, minWidth: 180 }} />
        <select className="input" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 140 }}>
          <option value="all">Tous</option>
          <option value="banned">Bannis seulement</option>
        </select>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''} · {bans.size} banni{bans.size !== 1 ? 's' : ''}</div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {filtered.map(u => {
            const banned = bans.has(u.id);
            const msg = actionMsg[u.id];
            return (
              <div key={u.id} className="card" style={{
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: banned ? 0.7 : 1,
                borderLeft: banned ? '3px solid #ef4444' : '3px solid transparent',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                }}>
                  {(u.username || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{u.username || 'Sans nom'}</span>
                    {u.is_admin && <span style={{ background: '#6366f122', color: '#6366f1', fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>Admin</span>}
                    {banned && <span style={{ background: '#ef444422', color: '#ef4444', fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>Banni</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                    {u.xp || 0} XP · {u.id.slice(0, 8)}…
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {msg && <StatusMsg msg={msg} />}
                  {!u.is_admin && (
                    <button
                      className="btn"
                      style={{ fontSize: 12, padding: '5px 12px', color: banned ? 'var(--text)' : '#ef4444', borderColor: banned ? 'var(--card-border)' : '#ef444444' }}
                      onClick={() => toggleBan(u.id, banned)}
                      disabled={actioning[u.id]}
                    >
                      {actioning[u.id] ? '...' : (banned ? 'Débannir' : 'Bannir')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20, fontSize: 14 }}>Aucun utilisateur trouvé</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Bandeau ─────────────────────────────────────────────────── */
function BannerTab() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('site_banner').select('active, message').eq('id', 1).maybeSingle();
        if (data) { setActive(Boolean(data.active)); setMessage(data.message || ''); }
      } catch {}
    })();
  }, []);

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true); setMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_banner', { p_active: active, p_message: message });
      if (error) throw error;
      setMsg('Bandeau enregistré ✅');
      window.dispatchEvent(new CustomEvent('mathle:banner-updated'));
    } catch (e) {
      setMsg(`Échec — ${e?.message || ''}`);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Bandeau d'annonce</SectionTitle>
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{
              width: 40, height: 22, borderRadius: 11, background: active ? '#6366f1' : 'var(--card-border)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }} onClick={() => setActive(v => !v)}>
              <div style={{
                position: 'absolute', top: 3, left: active ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {active ? 'Bandeau activé' : 'Bandeau désactivé'}
            </span>
          </label>
          <div>
            <FieldLabel>Message</FieldLabel>
            <textarea className="input" value={message} onChange={e => setMessage(e.target.value)}
              rows={4} placeholder="Ex: 🔧 Maintenance prévue ce soir à 22h..." style={{ width: '100%' }} />
          </div>
          {message && (
            <div style={{ background: '#6366f122', border: '1px solid #6366f144', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#6366f1' }}>Aperçu : </span>{message}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <StatusMsg msg={msg} />
      </div>
    </form>
  );
}

/* ─── Course ──────────────────────────────────────────────────── */
function RaceTab() {
  const [suspended, setSuspended] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('race_settings').select('suspended').eq('id', 1).maybeSingle();
        if (data) setSuspended(Boolean(data.suspended));
      } catch {}
    })();
  }, []);

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true); setMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_race', { p_suspended: suspended });
      if (error) throw error;
      setMsg('Paramètres enregistrés ✅');
      window.dispatchEvent(new CustomEvent('mathle:race-updated'));
    } catch (e) {
      setMsg(`Échec — ${e?.message || ''}`);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Mode Course</SectionTitle>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{
            width: 40, height: 22, borderRadius: 11, background: suspended ? '#ef4444' : 'var(--card-border)',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
          }} onClick={() => setSuspended(v => !v)}>
            <div style={{
              position: 'absolute', top: 3, left: suspended ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{suspended ? '🚫 Mode Course suspendu' : '✅ Mode Course actif'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Masque le bouton et bloque l'accès pour tous les utilisateurs</div>
          </div>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <StatusMsg msg={msg} />
      </div>
    </form>
  );
}

/* ─── Calendrier ──────────────────────────────────────────────── */
function ScheduleTab() {
  const [date, setDate] = useState('');
  const [rid, setRid] = useState('');
  const [q, setQ] = useState('');
  const [t, setT] = useState('number');
  const [a, setA] = useState('');
  const [exp, setExp] = useState('');
  const [theme, setTheme] = useState('general');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async (e) => {
    e?.preventDefault?.();
    if (!date) { setMsg('Date requise'); return; }
    setSaving(true); setMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_schedule', {
        p_day: date,
        p_riddle_id: rid ? Number(rid) : null,
        p_question: q || null,
        p_type: q ? t : null,
        p_answer: q ? a : null,
        p_explanation: exp || null,
      });
      if (error) throw error;
      setMsg('Calendrier enregistré ✅');
    } catch (e) {
      setMsg(`Échec — ${e?.message || ''}`);
    } finally { setSaving(false); }
  };

  const clear = async () => {
    if (!date) { setMsg('Date requise'); return; }
    setSaving(true); setMsg('');
    try {
      const { error } = await supabase.rpc('admin_clear_schedule', { p_day: date });
      if (error) throw error;
      setMsg('Planification supprimée ✅');
      setRid(''); setQ(''); setA(''); setT('number'); setExp(''); setTheme('general');
    } catch (e) {
      setMsg(`Échec — ${e?.message || ''}`);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>Planifier une énigme</SectionTitle>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <FieldLabel>Date (UTC)</FieldLabel>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <FieldLabel>ID d'énigme (optionnel)</FieldLabel>
            <input className="input" type="number" value={rid} onChange={e => setRid(e.target.value)}
              placeholder="Laisser vide pour question personnalisée" style={{ width: '100%' }} />
          </div>
          <div>
            <FieldLabel>Thème</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(RIDDLE_THEMES).map(([key, th]) => (
                <button key={key} type="button" onClick={() => setTheme(key)} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '2px solid',
                  background: theme === key ? th.color + '22' : 'transparent',
                  borderColor: theme === key ? th.color : 'var(--card-border)',
                  color: theme === key ? th.color : 'var(--muted)',
                }}>{th.icon} {th.label}</button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Question personnalisée</FieldLabel>
            <textarea className="input" value={q} onChange={e => setQ(e.target.value)}
              rows={4} placeholder="Saisir une question..." style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Type</FieldLabel>
              <select className="input" value={t} onChange={e => setT(e.target.value)} style={{ width: '100%' }}>
                <option value="number">Nombre</option>
                <option value="word">Mot</option>
              </select>
            </div>
            <div>
              <FieldLabel>Réponse</FieldLabel>
              <input className="input" type="text" value={a} onChange={e => setA(e.target.value)}
                placeholder="ex: 42" style={{ width: '100%' }} />
            </div>
          </div>
          <div>
            <FieldLabel>Explication (optionnel)</FieldLabel>
            <textarea className="input" value={exp} onChange={e => setExp(e.target.value)}
              rows={3} style={{ width: '100%' }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn" onClick={clear} disabled={saving}>Supprimer</button>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginLeft: 'auto' }}>
          {saving ? 'Enregistrement…' : 'Planifier'}
        </button>
      </div>
      <StatusMsg msg={msg} />
    </form>
  );
}

/* ─── Main AdminPanel ─────────────────────────────────────────── */
export default function AdminPanel({ onClose }) {
  const dayKey = useMemo(() => getUTCDateKey(), []);
  const [tab, setTab] = useState('dashboard');

  return (
    <div
      role="dialog"
      aria-modal
      className="admin-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="admin-panel" style={{ maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--card-border)',
          background: 'linear-gradient(135deg, #6366f108, #a78bfa08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚙️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Panneau d'administration</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{dayKey} · BrainteaserDay</div>
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ fontSize: 18, padding: '4px 12px', lineHeight: 1 }}>✕</button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Sidebar */}
          <div style={{
            width: 170, flexShrink: 0,
            borderRight: '1px solid var(--card-border)',
            padding: '12px 8px',
            display: 'flex', flexDirection: 'column', gap: 2,
            overflowY: 'auto',
          }}>
            {TABS.map(ti => (
              <button
                key={ti.id}
                onClick={() => setTab(ti.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: tab === ti.id ? 700 : 500,
                  background: tab === ti.id ? 'var(--primary-soft)' : 'transparent',
                  color: tab === ti.id ? 'var(--primary)' : 'var(--text)',
                  border: 'none', textAlign: 'left', width: '100%',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 16 }}>{ti.icon}</span>
                {ti.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }} className="fade-in" key={tab}>
            {tab === 'dashboard' && <DashboardTab dayKey={dayKey} />}
            {tab === 'riddle'    && <RiddleOverrideTab dayKey={dayKey} />}
            {tab === 'riddles'   && <RiddlesTab />}
            {tab === 'users'     && <UsersTab />}
            {tab === 'banner'    && <BannerTab />}
            {tab === 'race'      && <RaceTab />}
            {tab === 'schedule'  && <ScheduleTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
