import { randomInt } from 'node:crypto';

export const themes = ['arithmetique', 'finance', 'general', 'geometrie', 'logique', 'probabilites'];

// Only independent practice templates: never use the competitive riddle bank.
export function makeExercise(theme, level, pick = randomInt) {
  if (!themes.includes(theme) || ![1, 2, 3].includes(level)) throw new Error('Invalid practice options');
  const a = pick(2, 6 + level * 5);
  const b = pick(2, 6 + level * 3);
  let question, answer, explanation;
  switch (theme) {
    case 'arithmetique':
      question = `Calcule ${a} × ${b} + ${level}.`;
      answer = a * b + level;
      explanation = `On effectue la multiplication avant l'addition : ${a} × ${b} = ${a * b}, puis on ajoute ${level}.`;
      break;
    case 'finance': {
      const price = a * 20, discount = level * 5;
      answer = price * (100 - discount) / 100;
      question = `Un article coûte ${price} €. Après une réduction de ${discount} %, quel est son prix en euros ?`;
      explanation = `La réduction vaut ${price} × ${discount} / 100 = ${price * discount / 100} €. On la soustrait au prix initial : ${answer} €.`;
      break;
    }
    case 'general':
      question = `Un cycliste roule à ${a * level} km/h pendant ${b} heures. Quelle distance parcourt-il en km ?`;
      answer = a * level * b;
      explanation = `Distance = vitesse × durée : ${a * level} × ${b} = ${answer} km.`;
      break;
    case 'geometrie':
      answer = level === 1 ? 2 * (a + b) : a * b;
      question = `Un rectangle mesure ${a} cm sur ${b} cm. Quel est ${level === 1 ? 'son périmètre en cm' : 'son aire en cm²'} ?`;
      explanation = level === 1 ? `Le périmètre est 2 × (longueur + largeur) : 2 × (${a} + ${b}) = ${answer} cm.` : `L'aire est longueur × largeur : ${a} × ${b} = ${answer} cm².`;
      break;
    case 'logique': {
      const step = b * level;
      answer = a + step * 4;
      question = `Cette suite ajoute toujours le même nombre : ${a}, ${a + step}, ${a + step * 2}, ${a + step * 3}. Quel nombre vient ensuite ?`;
      explanation = `L'écart entre deux termes est ${step}. On ajoute donc ${step} à ${a + step * 3}, ce qui donne ${answer}.`;
      break;
    }
    case 'probabilites': {
      const total = level * 10, red = pick(1, total);
      answer = red * 100 / total;
      question = `Un sac contient ${red} billes rouges et ${total - red} bleues. Toutes ont la même chance d'être tirées. Quelle est la probabilité en pourcentage de tirer une rouge ? Arrondis à deux décimales si nécessaire.`;
      answer = Math.round(answer * 100) / 100;
      explanation = `On divise les cas favorables par le total : ${red} / ${total}, puis on multiplie par 100. On obtient ${answer} % après arrondi à deux décimales.`;
      break;
    }
    default: throw new Error('Unknown theme');
  }
  return { theme, level, question, answer, explanation };
}

export function gradeExercise(exercise, guess) {
  if (typeof guess !== 'string' || !guess.trim() || guess.length > 64) throw new Error('Réponse numérique requise.');
  const normalized = guess.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) throw new Error('Saisis un nombre, sans unité.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error('Nombre invalide.');
  return { correct: Math.abs(value - exercise.answer) < 1e-8, answer: exercise.answer, explanation: exercise.explanation };
}
