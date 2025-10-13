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
      const dy = Math.sin(angle) * spread * 0.8; // slightly biased up
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

    // Clean up
    setTimeout(() => {
      container.remove();
    }, 1700);
  } catch {}
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

