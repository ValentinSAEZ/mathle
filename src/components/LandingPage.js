import React from 'react';

const pillars = [
  {
    icon: '🧩',
    tone: 'coral',
    title: '6 défis chaque jour',
    text: 'Logique, arithmétique, géométrie, finance, culture générale et probabilités.',
  },
  {
    icon: '⚡',
    tone: 'sky',
    title: 'Progresse à ton rythme',
    text: 'Cumule de l’XP, entretiens ta série et retrouve toute ta progression dans ton profil.',
  },
  {
    icon: '🏁',
    tone: 'yellow',
    title: 'Passe en mode course',
    text: 'Enchaîne les calculs en temps limité et mesure-toi à toute la communauté.',
  },
];

const themes = [
  ['01', 'Arithmétique', 'Calcul & nombres', 'mint'],
  ['02', 'Logique', 'Déduction & méthode', 'lavender'],
  ['03', 'Finance', 'Réflexes du quotidien', 'yellow'],
  ['04', 'Géométrie', 'Formes & espace', 'sky'],
];

export default function LandingPage({ onGetStarted }) {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Navigation principale">
        <button className="landing-brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="brand-mark" aria-hidden="true">∑</span>
          <span>BrainteaserDay</span>
        </button>

        <div className="landing-nav-links">
          <a href="#defis">Les défis</a>
          <a href="#programme">Le programme</a>
          <a href="#communaute">La communauté</a>
        </div>

        <button className="btn btn-primary btn-lg" type="button" onClick={onGetStarted}>
          Commencer
        </button>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Nouveau défi chaque jour</div>
          <h1>
            Fais travailler
            <span> ton cerveau,</span>
            un jour à la fois.
          </h1>
          <p className="hero-lead">
            Six énigmes quotidiennes, une course contre la montre et une communauté prête à relever le défi avec toi.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary hero-primary" type="button" onClick={onGetStarted}>
              Jouer gratuitement <span aria-hidden="true">→</span>
            </button>
            <a className="btn btn-sky" href="#defis">Découvrir les défis</a>
          </div>
          <div className="hero-proof" aria-label="Les chiffres clés">
            <div><strong>6</strong><span>thèmes par jour</span></div>
            <div><strong>325+</strong><span>énigmes</span></div>
            <div><strong>100%</strong><span>gratuit</span></div>
          </div>
        </div>

        <div className="hero-visual" aria-label="Aperçu d’un défi BrainteaserDay">
          <div className="hero-orbit orbit-one">🎯</div>
          <div className="hero-orbit orbit-two">⭐</div>
          <div className="hero-orbit orbit-three">📚</div>
          <div className="challenge-card">
            <div className="challenge-topline">
              <span className="challenge-icon">π</span>
              <div>
                <strong>Défi du jour</strong>
                <span>Probabilités · Niveau curieux</span>
              </div>
              <span className="challenge-points">+25 XP</span>
            </div>
            <div className="challenge-question">
              Si tu lances deux dés, combien de combinaisons donnent un total de 7 ?
            </div>
            <div className="challenge-progress"><span /></div>
            <div className="challenge-meta"><span>Progression du jour</span><strong>4 / 6</strong></div>
            <button type="button" className="btn btn-primary" onClick={onGetStarted}>Continuer le défi</button>
          </div>
        </div>
      </section>

      <section className="landing-section" id="defis">
        <div className="section-heading">
          <span className="section-tag">Pourquoi jouer ?</span>
          <h2>Un petit défi. De vrais progrès.</h2>
          <p>Une routine légère, colorée et motivante pour entraîner toutes les facettes de ton raisonnement.</p>
        </div>
        <div className="feature-grid">
          {pillars.map((item) => (
            <article className={'feature-card tone-' + item.tone} key={item.title}>
              <div className="feature-icon" aria-hidden="true">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span className="feature-link">En savoir plus <b>→</b></span>
            </article>
          ))}
        </div>
      </section>

      <section className="program-section" id="programme">
        <div className="program-copy">
          <span className="section-tag">Ton programme</span>
          <h2>Tous les jours, une nouvelle façon de réfléchir.</h2>
          <p>Choisis ton thème, propose ta réponse et compare ta progression. Pas de leçon interminable : seulement le plaisir de trouver.</p>
          <button className="btn btn-dark" type="button" onClick={onGetStarted}>Voir les énigmes <span>→</span></button>
        </div>
        <div className="theme-stack">
          {themes.map(([number, title, subtitle, tone]) => (
            <div className={'theme-row tone-' + tone} key={number}>
              <span className="theme-number">{number}</span>
              <div><strong>{title}</strong><span>{subtitle}</span></div>
              <b aria-hidden="true">↗</b>
            </div>
          ))}
        </div>
      </section>

      <section className="community-section" id="communaute">
        <div className="community-card">
          <div className="community-avatars" aria-hidden="true">
            <span>🦊</span><span>🐼</span><span>🐸</span><span>🦁</span>
          </div>
          <div>
            <span className="section-tag">Prêt à jouer ?</span>
            <h2>Rejoins les cerveaux les plus curieux.</h2>
            <p>Crée ton profil, lance ton premier défi et trouve ta place dans le classement.</p>
          </div>
          <button className="btn btn-primary hero-primary" type="button" onClick={onGetStarted}>Créer mon compte →</button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-brand"><span className="brand-mark">∑</span><span>BrainteaserDay</span></div>
        <p>Un cerveau plus vif, une énigme à la fois.</p>
        <span>© 2026 BrainteaserDay</span>
      </footer>
    </main>
  );
}

