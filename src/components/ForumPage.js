import React, { useEffect, useState, useCallback } from 'react';

const API_URL = 'https://api.brainteaserday.com';

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return '';
  }
}

function fmtTime(d) {
  try {
    return new Date(d).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function fmtRelative(d) {
  const now = new Date();
  const date = new Date(d);
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "à l'instant";
  if (diff < 3600) {
    return `il y a ${Math.floor(diff / 60)}min`;
  }
  if (diff < 86400) {
    return `il y a ${Math.floor(diff / 3600)}h`;
  }

  return fmtDate(d);
}

function todayKey() {
  const d = new Date();

  return `${d.getUTCFullYear()}-${String(
    d.getUTCMonth() + 1
  ).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

function getInitials(username) {
  if (!username) return '?';

  const parts = username
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';

  return (
    (
      (parts[0][0] || '') +
      (parts[1]?.[0] || '')
    )
      .toUpperCase()
      .trim() ||
    parts[0][0].toUpperCase()
  );
}

export default function ForumPage({
  session,
  onSelectUser,
}) {
  const userId = session?.user?.id;

  const [dayKey, setDayKey] = useState(todayKey());
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [replies, setReplies] = useState({});
  const [newReply, setNewReply] = useState('');
  const [replying, setReplying] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/forum/posts?day=${encodeURIComponent(
          dayKey
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger le forum'
        );
      }

      setPosts(
        Array.isArray(data.rows)
          ? data.rows
          : []
      );
    } catch (error) {
      console.error('Forum load error:', error);
    } finally {
      setLoading(false);
    }
  }, [dayKey]);

  useEffect(() => {
    setLoading(true);
    loadPosts();

    const timer = setInterval(
      loadPosts,
      15000
    );

    return () => {
      clearInterval(timer);
    };
  }, [loadPosts]);

  const submitPost = async (e) => {
    e.preventDefault();

    if (!newPost.trim() || posting) return;

    const token =
      localStorage.getItem('auth_token');

    if (!token) return;

    setPosting(true);

    try {
      const response = await fetch(
        `${API_URL}/api/forum/posts`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            day_key: dayKey,
            content: newPost.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de publier'
        );
      }

      setPosts((prev) => [
        data,
        ...prev.filter(
          (p) => p.id !== data.id
        ),
      ]);

      setNewPost('');
    } catch (error) {
      console.error(
        'Post error:',
        error
      );
    } finally {
      setPosting(false);
    }
  };

  const deletePost = async (postId) => {
    const token =
      localStorage.getItem('auth_token');

    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/forum/posts/${postId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de supprimer'
        );
      }

      setPosts((prev) =>
        prev.filter(
          (post) => post.id !== postId
        )
      );

      setReplies((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });

      if (expandedPost === postId) {
        setExpandedPost(null);
      }
    } catch (error) {
      console.error(
        'Delete post error:',
        error
      );
    }
  };

  const loadReplies = async (postId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/forum/posts/${postId}/replies`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de charger les réponses'
        );
      }

      setReplies((prev) => ({
        ...prev,
        [postId]: Array.isArray(data.rows)
          ? data.rows
          : [],
      }));
    } catch (error) {
      console.error(
        'Replies load error:',
        error
      );
    }
  };

  const toggleReplies = (postId) => {
    if (expandedPost === postId) {
      setExpandedPost(null);
      return;
    }

    setExpandedPost(postId);
    loadReplies(postId);
  };

  const submitReply = async (
    e,
    postId
  ) => {
    e.preventDefault();

    if (
      !newReply.trim() ||
      replying
    ) {
      return;
    }

    const token =
      localStorage.getItem('auth_token');

    if (!token) return;

    setReplying(true);

    try {
      const response = await fetch(
        `${API_URL}/api/forum/posts/${postId}/replies`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: newReply.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de publier la réponse'
        );
      }

      setReplies((prev) => ({
        ...prev,
        [postId]: [
          ...(prev[postId] || []),
          data,
        ],
      }));

      setNewReply('');
    } catch (error) {
      console.error(
        'Reply error:',
        error
      );
    } finally {
      setReplying(false);
    }
  };

  const deleteReply = async (
    replyId,
    postId
  ) => {
    const token =
      localStorage.getItem('auth_token');

    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/forum/replies/${replyId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Impossible de supprimer la réponse'
        );
      }

      setReplies((prev) => ({
        ...prev,
        [postId]: (
          prev[postId] || []
        ).filter(
          (reply) =>
            reply.id !== replyId
        ),
      }));
    } catch (error) {
      console.error(
        'Delete reply error:',
        error
      );
    }
  };

  const goDay = (offset) => {
    const parts = dayKey
      .split('-')
      .map(Number);

    const d = new Date(
      Date.UTC(
        parts[0],
        parts[1] - 1,
        parts[2] + offset
      )
    );

    const key = `${
      d.getUTCFullYear()
    }-${String(
      d.getUTCMonth() + 1
    ).padStart(2, '0')}-${String(
      d.getUTCDate()
    ).padStart(2, '0')}`;

    if (key > todayKey()) return;

    setDayKey(key);
    setExpandedPost(null);
    setReplies({});
  };

  const isToday =
    dayKey === todayKey();

  const currentUsername =
    session?.user?.username || '';

  const currentAvatarColor =
    session?.user?.avatar_color ||
    '#6366f1';

  return (
    <div className="page-container fade-in">
      <h2 className="page-title">
        Forum
      </h2>

      <div className="forum-day-nav">
        <button
          className="btn forum-day-btn"
          onClick={() => goDay(-1)}
        >
          ← Hier
        </button>

        <div className="forum-day-label">
          <span className="forum-day-icon">
            💬
          </span>

          <span>
            {isToday
              ? "Énigme du jour"
              : `Énigme du ${fmtDate(
                  dayKey
                )}`}
          </span>

          <span className="forum-post-count">
            {posts.length} message
            {posts.length !== 1
              ? 's'
              : ''}
          </span>
        </div>

        <button
          className="btn forum-day-btn"
          onClick={() => goDay(1)}
          disabled={isToday}
        >
          Demain →
        </button>
      </div>

      <div className="card section forum-compose">
        <form
          onSubmit={submitPost}
          style={{
            display: 'flex',
            gap: 10,
          }}
        >
          <div
            className="forum-compose-avatar"
            style={{
              background:
                `linear-gradient(135deg, ${currentAvatarColor}, ${currentAvatarColor}cc)`,
            }}
          >
            {getInitials(
              currentUsername
            )}
          </div>

          <div style={{ flex: 1 }}>
            <textarea
              className="input forum-textarea"
              value={newPost}
              onChange={(e) =>
                setNewPost(
                  e.target.value
                )
              }
              placeholder="Partagez votre avis sur l'énigme du jour..."
              rows={2}
              maxLength={1000}
            />

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                }}
              >
                {newPost.length}/1000
              </span>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  !newPost.trim() ||
                  posting
                }
              >
                {posting
                  ? 'Envoi...'
                  : 'Publier'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="forum-posts">
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: 'var(--muted)',
            }}
          >
            Chargement...
          </div>
        ) : posts.length === 0 ? (
          <div
            className="card section"
            style={{
              textAlign: 'center',
              padding: 40,
            }}
          >
            <div
              style={{
                fontSize: 32,
                marginBottom: 8,
              }}
            >
              💬
            </div>

            <div
              style={{
                color: 'var(--muted)',
              }}
            >
              Aucun message pour cette
              énigme. Soyez le premier !
            </div>
          </div>
        ) : (
          posts.map((post) => {
            const isOwn =
              post.user_id === userId;

            const postReplies =
              replies[post.id] || [];

            const isExpanded =
              expandedPost === post.id;

            const username =
              post.username ||
              'Utilisateur';

            const avatarColor =
              post.avatar_color ||
              '#475569';

            return (
              <div
                key={post.id}
                className="card forum-post"
              >
                <div className="forum-post-header">
                  <button
                    className="forum-post-avatar"
                    style={{
                      background:
                        `linear-gradient(135deg, ${avatarColor}, ${avatarColor}cc)`,
                    }}
                    onClick={() =>
                      onSelectUser?.(
                        post.user_id
                      )
                    }
                    title="Voir le profil"
                  >
                    {getInitials(
                      username
                    )}
                  </button>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <button
                      className="forum-post-author"
                      onClick={() =>
                        onSelectUser?.(
                          post.user_id
                        )
                      }
                    >
                      {username}
                    </button>

                    <div className="forum-post-time">
                      {fmtRelative(
                        post.created_at
                      )}
                      {!isToday &&
                        ` - ${fmtTime(
                          post.created_at
                        )}`}
                    </div>
                  </div>

                  {isOwn && (
                    <button
                      className="forum-delete-btn"
                      onClick={() =>
                        deletePost(
                          post.id
                        )
                      }
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="forum-post-content">
                  {post.content}
                </div>

                <div className="forum-post-actions">
                  <button
                    className="forum-action-btn"
                    onClick={() =>
                      toggleReplies(
                        post.id
                      )
                    }
                  >
                    💬{' '}
                    {isExpanded
                      ? 'Masquer'
                      : 'Répondre'}
                    {postReplies.length >
                      0 &&
                      ` (${postReplies.length})`}
                  </button>
                </div>

                {isExpanded && (
                  <div className="forum-replies">
                    {postReplies.map(
                      (reply) => {
                        const isOwnReply =
                          reply.user_id ===
                          userId;

                        const replyUsername =
                          reply.username ||
                          'Utilisateur';

                        const replyColor =
                          reply.avatar_color ||
                          '#475569';

                        return (
                          <div
                            key={reply.id}
                            className="forum-reply"
                          >
                            <button
                              className="forum-reply-avatar"
                              style={{
                                background:
                                  `linear-gradient(135deg, ${replyColor}, ${replyColor}cc)`,
                              }}
                              onClick={() =>
                                onSelectUser?.(
                                  reply.user_id
                                )
                              }
                            >
                              {getInitials(
                                replyUsername
                              )}
                            </button>

                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  gap: 6,
                                }}
                              >
                                <button
                                  className="forum-post-author"
                                  onClick={() =>
                                    onSelectUser?.(
                                      reply.user_id
                                    )
                                  }
                                >
                                  {
                                    replyUsername
                                  }
                                </button>

                                <span className="forum-post-time">
                                  {fmtRelative(
                                    reply.created_at
                                  )}
                                </span>

                                {isOwnReply && (
                                  <button
                                    className="forum-delete-btn"
                                    onClick={() =>
                                      deleteReply(
                                        reply.id,
                                        post.id
                                      )
                                    }
                                    title="Supprimer"
                                    style={{
                                      marginLeft:
                                        'auto',
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              <div className="forum-reply-content">
                                {
                                  reply.content
                                }
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}

                    <form
                      onSubmit={(e) =>
                        submitReply(
                          e,
                          post.id
                        )
                      }
                      className="forum-reply-form"
                    >
                      <input
                        type="text"
                        className="input"
                        value={newReply}
                        onChange={(e) =>
                          setNewReply(
                            e.target.value
                          )
                        }
                        placeholder="Écrire une réponse..."
                        maxLength={500}
                      />

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                          !newReply.trim() ||
                          replying
                        }
                      >
                        {replying
                          ? '...'
                          : '→'}
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
