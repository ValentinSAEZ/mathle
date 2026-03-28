// Lightweight confetti burst with CSS animations (no deps)
export function burstConfetti({ originEl, count = 80 } = {}) {
  try {
    const rect = originEl?.getBoundingClientRect();
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    const container = document.createElement('div');
    container.className = 'confetti-layer';
    document.body.appendChild(container);

    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#a855f7', '#ec4899'];
    const n = Math.max(20, Math.min(160, count));
    for (let i = 0; i < n; i++) {
      const piece = document.createElement('i');
      piece.className = 'confetti-piece';
      const size = 6 + Math.random() * 8;
      const spread = 80 + Math.random() * 160;
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.cos(angle) * spread;
      const dy = Math.sin(angle) * spread * 0.8;
      const rz = Math.floor(Math.random() * 360);
      const dur = 600 + Math.random() * 900;
      const delay = Math.random() * 60;
      piece.style.left = `${originX}px`;
      piece.style.top = `${originY}px`;
      piece.style.width = `${size}px`;
      piece.style.height = `${4 + Math.random() * 8}px`;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--dx', `${dx}px`);
      piece.style.setProperty('--dy', `${dy}px`);
      piece.style.setProperty('--rz', `${rz}deg`);
      piece.style.setProperty('--dur', `${Math.round(dur)}ms`);
      piece.style.setProperty('--delay', `${Math.round(delay)}ms`);
      container.appendChild(piece);
    }

    setTimeout(() => { container.remove(); }, 1700);
  } catch {}
}

// Multi-wave confetti for big victories
export function bigCelebration({ originEl } = {}) {
  burstConfetti({ originEl, count: 120 });
  setTimeout(() => burstConfetti({ originEl, count: 60 }), 400);
  setTimeout(() => burstConfetti({ originEl, count: 40 }), 800);
}

export function pulseOnce(el) {
  try {
    if (!el) return;
    el.classList.remove('pulse-pop');
    // reflow
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;
    el.classList.add('pulse-pop');
    setTimeout(() => el.classList.remove('pulse-pop'), 600);
  } catch {}
}

// XP level definitions (must match DB function get_user_level)
export const XP_LEVELS = [
  { level: 1, title: 'Débutant', minXp: 0, maxXp: 50, color: '#94a3b8' },
  { level: 2, title: 'Initié', minXp: 50, maxXp: 200, color: '#22c55e' },
  { level: 3, title: 'Apprenti', minXp: 200, maxXp: 400, color: '#3b82f6' },
  { level: 4, title: 'Intermédiaire', minXp: 400, maxXp: 750, color: '#8b5cf6' },
  { level: 5, title: 'Confirmé', minXp: 750, maxXp: 1200, color: '#a855f7' },
  { level: 6, title: 'Avancé', minXp: 1200, maxXp: 1800, color: '#d946ef' },
  { level: 7, title: 'Expert', minXp: 1800, maxXp: 2500, color: '#ec4899' },
  { level: 8, title: 'Maître', minXp: 2500, maxXp: 3500, color: '#f43f5e' },
  { level: 9, title: 'Mythique', minXp: 3500, maxXp: 5000, color: '#f59e0b' },
  { level: 10, title: 'Légendaire', minXp: 5000, maxXp: 999999, color: '#eab308' },
];

export function getLevelInfo(xp) {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].minXp) return XP_LEVELS[i];
  }
  return XP_LEVELS[0];
}

export function getXpProgress(xp) {
  const info = getLevelInfo(xp);
  const range = info.maxXp - info.minXp;
  const progress = xp - info.minXp;
  return Math.min(1, progress / range);
}

// Theme metadata
export const RIDDLE_THEMES = {
  general: { icon: '🧠', label: 'Général', color: '#6366f1' },
  logique: { icon: '🔮', label: 'Logique', color: '#8b5cf6' },
  probabilites: { icon: '🎲', label: 'Probabilités', color: '#ec4899' },
  geometrie: { icon: '📐', label: 'Géométrie', color: '#06b6d4' },
  finance: { icon: '💰', label: 'Finance', color: '#10b981' },
  arithmetique: { icon: '🔢', label: 'Arithmétique', color: '#f59e0b' },
  culture: { icon: '📚', label: 'Culture', color: '#ef4444' },
  estimation: { icon: '📊', label: 'Estimation', color: '#3b82f6' },
};
