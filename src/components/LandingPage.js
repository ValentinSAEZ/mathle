import React, { useState, useEffect } from 'react';

export default function LandingPage({ onGetStarted }) {
  const [stats] = useState({
    enigmes: '40+',
    joueurs: '15',
    succes: '5',
  });

  /* Animate stat numbers on scroll into view */
  const [statsVisible, setStatsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    const el = document.getElementById('landing-stats');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const logoSrc = `${process.env.PUBLIC_URL || ''}/brand/logo.png`;

  return (
    <div className="landing-page" style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', overflow: 'hidden' }}>

      {/* ===================== HERO ===================== */}
      <section style={{
        textAlign: 'center',
        padding: '80px 20px 60px',
        maxWidth: 800,
        margin: '0 auto',
      }}>
        <img
          src={logoSrc}
          alt="BrainteaserDay"
          style={{ width: 72, height: 72, borderRadius: 'var(--radius-lg)', marginBottom: 20, objectFit: 'contain' }}
        />
        <h1 style={{
          fontSize: 'clamp(2.2rem, 6vw, 3.6rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          margin: '0 0 16px',
          background: 'linear-gradient(135deg, var(--primary), #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          BrainteaserDay
        </h1>
        <p style={{
          fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
          color: 'var(--muted)',
          maxWidth: 520,
          margin: '0 auto 32px',
          lineHeight: 1.6,
        }}>
          Une énigme par jour pour muscler ton cerveau
        </p>
        <button
          className="btn btn-primary btn-lg"
          onClick={onGetStarted}
          style={{ fontSize: 16, padding: '14px 32px', borderRadius: 'var(--radius-lg)' }}
        >
          🧠 Commencer gratuitement
        </button>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 12 }}>
          Gratuit, sans carte bancaire
        </p>
      </section>

      {/* ===================== FEATURES GRID ===================== */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '40px 20px 60px',
      }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 700, marginBottom: 8 }}>
          Pourquoi BrainteaserDay ?
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>
          Trois piliers pour progresser chaque jour
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {[
            { emoji: '🧠', title: 'Énigme quotidienne', desc: 'Chaque jour, une nouvelle énigme de logique, maths ou finance. Reviens demain pour la suivante !' },
            { emoji: '🏁', title: 'Mode Course', desc: 'Calcul mental en temps limité. Enchaîne les opérations le plus vite possible et bats ton record.' },
            { emoji: '🏆', title: 'Classement & Succès', desc: 'Compare-toi aux autres joueurs sur le leaderboard et débloque des succès au fil de ta progression.' },
          ].map((f, i) => (
            <div
              key={i}
              className="card"
              style={{
                padding: 28,
                textAlign: 'center',
                transition: 'transform var(--transition), box-shadow var(--transition)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            >
              <div style={{
                fontSize: 40,
                marginBottom: 12,
                width: 72,
                height: 72,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--primary-soft)',
              }}>
                {f.emoji}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section style={{
        background: 'var(--surface-subtle)',
        padding: '60px 20px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 700, marginBottom: 8 }}>
            Comment ça marche ?
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: 48, fontSize: 15 }}>
            Trois étapes, c'est tout.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 32,
          }}>
            {[
              { step: '1', emoji: '⚡', title: 'Inscris-toi', desc: 'Crée ton compte en quelques secondes.' },
              { step: '2', emoji: '🔥', title: "Résous l'énigme du jour", desc: 'Logique, maths, finance... un nouveau défi chaque jour.' },
              { step: '3', emoji: '📊', title: 'Grimpe au classement', desc: 'Gagne des points, débloque des succès et deviens le meilleur.' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                }}>
                  {s.step}
                </div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{s.emoji}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== STATS ===================== */}
      <section id="landing-stats" style={{
        padding: '60px 20px',
        maxWidth: 800,
        margin: '0 auto',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 700, marginBottom: 8 }}>
          Déjà en marche
        </h2>
        <p style={{ color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>
          Notre communauté grandit chaque jour
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 20,
        }}>
          {[
            { value: stats.enigmes, label: 'énigmes', emoji: '🧠' },
            { value: stats.joueurs, label: 'joueurs actifs', emoji: '👥' },
            { value: stats.succes, label: 'succès à débloquer', emoji: '🏅' },
          ].map((s, i) => (
            <div
              key={i}
              className="card"
              style={{
                padding: 28,
                opacity: statsVisible ? 1 : 0,
                transform: statsVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 500ms ease ${i * 150}ms, transform 500ms ease ${i * 150}ms`,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{s.emoji}</div>
              <div style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
                fontWeight: 800,
                color: 'var(--primary)',
                lineHeight: 1,
                marginBottom: 4,
              }}>
                {s.value}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section style={{
        padding: '60px 20px 80px',
        textAlign: 'center',
      }}>
        <div className="card" style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: '48px 32px',
          background: 'var(--primary-soft)',
          borderColor: 'var(--primary)',
        }}>
          <h2 style={{
            fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
            fontWeight: 700,
            marginBottom: 12,
          }}>
            Prêt à relever le défi ?
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: 28, fontSize: 15 }}>
            Rejoins la communauté et teste tes limites chaque jour.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={onGetStarted}
            style={{ fontSize: 16, padding: '14px 32px', borderRadius: 'var(--radius-lg)' }}
          >
            S'inscrire maintenant
          </button>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer style={{
        textAlign: 'center',
        padding: '24px 20px',
        borderTop: '1px solid var(--card-border)',
        color: 'var(--muted)',
        fontSize: 13,
      }}>
        BrainteaserDay &mdash; Entraîne ton cerveau, un jour à la fois.
      </footer>
    </div>
  );
}
