import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' }); } catch { return ''; }
}

function fmtTime(d) {
  try { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

function fmtRelative(d) {
  const now = new Date();
  const date = new Date(d);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return fmtDate(d);
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getInitials(username) {
  if (!username) return '?';
  const parts = username.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase().trim() || parts[0][0].toUpperCase();
}

export default function ForumPage({ session, onSelectUser }) {
  const userId = session?.user?.id;
  const [dayKey, setDayKey] = useState(todayKey());
  const [posts, setPosts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [replies, setReplies] = useState({});
  const [newReply, setNewReply] = useState('');
  const [replying, setReplying] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('id, day_key, user_id, content, created_at')
        .eq('day_key', dayKey)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setPosts(data || []);

      // Load profiles for post authors
      const userIds = [...new Set((data || []).map(p => p.user_id))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, avatar_color')
          .in('id', userIds);
        const map = {};
        for (const p of profileData || []) map[p.id] = p;
        setProfiles(prev => ({ ...prev, ...map }));
      }
    } catch (e) {
      console.error('Forum load error:', e);
    } finally {
      setLoading(false);
    }
  }, [dayKey]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('forum_posts_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts', filter: `day_key=eq.${dayKey}` }, (payload) => {
        const newP = payload.new;
        setPosts(prev => [newP, ...prev]);
        // Load profile if unknown
        if (newP.user_id && !profiles[newP.user_id]) {
          supabase.from('profiles').select('id, username, avatar_color').eq('id', newP.user_id).maybeSingle().then(({ data }) => {
            if (data) setProfiles(prev => ({ ...prev, [data.id]: data }));
          });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'forum_posts' }, (payload) => {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitPost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() || posting) return;
    setPosting(true);
    try {
      const { error } = await supabase.from('forum_posts').insert({
        day_key: dayKey,
        user_id: userId,
        content: newPost.trim(),
      });
      if (error) throw error;
      setNewPost('');
    } catch (e) {
      console.error('Post error:', e);
    } finally {
      setPosting(false);
    }
  };

  const deletePost = async (postId) => {
    try {
      await supabase.from('forum_posts').delete().eq('id', postId);
    } catch {}
  };

  const loadReplies = async (postId) => {
    try {
      const { data, error } = await supabase
        .from('forum_replies')
        .select('id, post_id, user_id, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      setReplies(prev => ({ ...prev, [postId]: data || [] }));

      // Load profiles
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, avatar_color')
          .in('id', userIds);
        const map = {};
        for (const p of profileData || []) map[p.id] = p;
        setProfiles(prev => ({ ...prev, ...map }));
      }
    } catch {}
  };

  const toggleReplies = (postId) => {
    if (expandedPost === postId) {
      setExpandedPost(null);
    } else {
      setExpandedPost(postId);
      if (!replies[postId]) loadReplies(postId);
    }
  };

  const submitReply = async (e, postId) => {
    e.preventDefault();
    if (!newReply.trim() || replying) return;
    setReplying(true);
    try {
      const { data, error } = await supabase.from('forum_replies').insert({
        post_id: postId,
        user_id: userId,
        content: newReply.trim(),
      }).select().single();
      if (error) throw error;
      setReplies(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data] }));
      setNewReply('');
    } catch (e) {
      console.error('Reply error:', e);
    } finally {
      setReplying(false);
    }
  };

  const deleteReply = async (replyId, postId) => {
    try {
      await supabase.from('forum_replies').delete().eq('id', replyId);
      setReplies(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(r => r.id !== replyId) }));
    } catch {}
  };

  // Day navigation
  const goDay = (offset) => {
    const parts = dayKey.split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + offset));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (key > todayKey()) return;
    setDayKey(key);
    setExpandedPost(null);
  };

  const isToday = dayKey === todayKey();

  return (
    <div className="page-container fade-in">
      <h2 className="page-title">Forum</h2>

      {/* Day navigation */}
      <div className="forum-day-nav">
        <button className="btn forum-day-btn" onClick={() => goDay(-1)}>← Hier</button>
        <div className="forum-day-label">
          <span className="forum-day-icon">💬</span>
          <span>{isToday ? "Énigme du jour" : `Énigme du ${fmtDate(dayKey)}`}</span>
          <span className="forum-post-count">{posts.length} message{posts.length !== 1 ? 's' : ''}</span>
        </div>
        <button className="btn forum-day-btn" onClick={() => goDay(1)} disabled={isToday}>Demain →</button>
      </div>

      {/* New post form */}
      <div className="card section forum-compose">
        <form onSubmit={submitPost} style={{ display: 'flex', gap: 10 }}>
          <div className="forum-compose-avatar" style={{ background: `linear-gradient(135deg, ${profiles[userId]?.avatar_color || '#6366f1'}, ${profiles[userId]?.avatar_color || '#6366f1'}cc)` }}>
            {getInitials(profiles[userId]?.username)}
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              className="input forum-textarea"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Partagez votre avis sur l'énigme du jour..."
              rows={2}
              maxLength={1000}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{newPost.length}/1000</span>
              <button type="submit" className="btn btn-primary" disabled={!newPost.trim() || posting}>
                {posting ? 'Envoi...' : 'Publier'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Posts list */}
      <div className="forum-posts">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Chargement...</div>
        ) : posts.length === 0 ? (
          <div className="card section" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div style={{ color: 'var(--muted)' }}>Aucun message pour cette énigme. Soyez le premier !</div>
          </div>
        ) : (
          posts.map(post => {
            const profile = profiles[post.user_id];
            const isOwn = post.user_id === userId;
            const postReplies = replies[post.id] || [];
            const isExpanded = expandedPost === post.id;

            return (
              <div key={post.id} className="card forum-post">
                <div className="forum-post-header">
                  <button
                    className="forum-post-avatar"
                    style={{ background: `linear-gradient(135deg, ${profile?.avatar_color || '#475569'}, ${profile?.avatar_color || '#475569'}cc)` }}
                    onClick={() => onSelectUser?.(post.user_id)}
                    title="Voir le profil"
                  >
                    {getInitials(profile?.username)}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button className="forum-post-author" onClick={() => onSelectUser?.(post.user_id)}>
                      {profile?.username || 'Utilisateur'}
                    </button>
                    <div className="forum-post-time">{fmtRelative(post.created_at)} {!isToday && `- ${fmtTime(post.created_at)}`}</div>
                  </div>
                  {isOwn && (
                    <button className="forum-delete-btn" onClick={() => deletePost(post.id)} title="Supprimer">
                      ✕
                    </button>
                  )}
                </div>
                <div className="forum-post-content">{post.content}</div>
                <div className="forum-post-actions">
                  <button className="forum-action-btn" onClick={() => toggleReplies(post.id)}>
                    💬 {isExpanded ? 'Masquer' : 'Répondre'} {postReplies.length > 0 && `(${postReplies.length})`}
                  </button>
                </div>

                {/* Replies */}
                {isExpanded && (
                  <div className="forum-replies">
                    {postReplies.map(reply => {
                      const rProfile = profiles[reply.user_id];
                      const isOwnReply = reply.user_id === userId;
                      return (
                        <div key={reply.id} className="forum-reply">
                          <button
                            className="forum-reply-avatar"
                            style={{ background: `linear-gradient(135deg, ${rProfile?.avatar_color || '#475569'}, ${rProfile?.avatar_color || '#475569'}cc)` }}
                            onClick={() => onSelectUser?.(reply.user_id)}
                          >
                            {getInitials(rProfile?.username)}
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button className="forum-post-author" onClick={() => onSelectUser?.(reply.user_id)}>
                                {rProfile?.username || 'Utilisateur'}
                              </button>
                              <span className="forum-post-time">{fmtRelative(reply.created_at)}</span>
                              {isOwnReply && (
                                <button className="forum-delete-btn" onClick={() => deleteReply(reply.id, post.id)} title="Supprimer" style={{ marginLeft: 'auto' }}>✕</button>
                              )}
                            </div>
                            <div className="forum-reply-content">{reply.content}</div>
                          </div>
                        </div>
                      );
                    })}
                    <form onSubmit={(e) => submitReply(e, post.id)} className="forum-reply-form">
                      <input
                        type="text"
                        className="input"
                        value={newReply}
                        onChange={(e) => setNewReply(e.target.value)}
                        placeholder="Écrire une réponse..."
                        maxLength={500}
                      />
                      <button type="submit" className="btn btn-primary" disabled={!newReply.trim() || replying}>
                        {replying ? '...' : '→'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
