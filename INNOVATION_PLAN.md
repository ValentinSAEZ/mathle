# BrainteaserDay — plan d'évolution

Conserver le rituel gratuit, les six catégories, la DA pastel et l'équité du classement.

## Lot 1 — implémenté dans cette branche

1. Intégrité : jour UTC imposé côté serveur et verrou transactionnel par joueur pour sérialiser les réponses et les XP.
2. Corrections : accès authentifié après résolution, sans divulguer les réponses dans les listes publiques. Une explication absente est signalée, jamais inventée.
3. Carnet : historique privé des 50 dernières énigmes ayant causé une erreur, avec statut de résolution et accès à une pratique de même catégorie.
4. Entraînement : exercices générés distincts du catalogue quotidien, six catégories, trois niveaux, correction serveur et explication. Aucun XP ni score compétitif. Session signée, liée au compte et expirant après 30 minutes.
5. Interface : accès depuis l'accueil sans ajouter un sixième bouton à la navigation mobile. États de chargement, erreur et liste vide ; thèmes jour/nuit existants.
6. Cache : exclure les API et l'authentification du service worker et retirer ses anciennes caches pour protéger les données privées entre connexions.

Validation : tests de génération, isolation des comptes, autorisation des corrections et réponses erronées ; build React ; contrôle responsive. Pas de migration SQL. Déployer le backend avant le frontend. Retour arrière par réversion des commits, sans perte de données.

## Lots suivants — à implémenter après validation du lot 1

- Qualité éditoriale : compléter les explications absentes, indices graduels et signalement des énigmes ambiguës. Décider des règles de classement avec aide avant activation.
- Compte : objectifs hebdomadaires, favoris synchronisés, confidentialité, récupération du compte, vérification email et révocation des sessions. Choisir le prestataire email avant le parcours de récupération.
- Personnalisation : avatars illustrés et vitrines de succès, palettes accessibles et réglages de confort. Aucun bonus compétitif payant.
- Sécurité opérationnelle : audit des autorisations, validation serveur de Course, sauvegarde/restauration, utilisateur Linux dédié et environnement de preview isolé.
- Monétisation : pilote de parcours structurés et révisions espacées, puis offre Plus. Hypothèse à tester : 3,99 €/mois ou 34,99 €/an. Les fonctionnalités gratuites actuelles restent gratuites. Paiement et droits contrôlés côté serveur ; webhooks idempotents avant ouverture des ventes.
- Ensuite seulement : packs d'enquêtes et espaces de groupe, après validation de la demande.

Mesurer d'abord le retour à sept jours, la consultation des corrections et la réutilisation de l'entraînement. Les prix sont des hypothèses ; aucun paiement ni abonnement n'est activé dans le lot 1.
