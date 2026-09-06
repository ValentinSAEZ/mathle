# Photo de profil

Avant de déployer le backend de cette branche, sauvegarder la base puis appliquer
`20260906_profile_photo.sql` avec le compte PostgreSQL habituel. La migration ajoute
uniquement la colonne `profiles.avatar_image`, vide pour les profils existants.
Elle peut être rejouée. Aucun script ne l'exécute automatiquement.

Déployer ensuite le backend, puis le frontend. Le workflow de production bloque
volontairement le déploiement automatique lorsque `schema.sql` change : après la
migration manuelle, lancer le workflow avec `workflow_dispatch` depuis `main`.

Vérifier avec un compte de test : importer une photo, enregistrer, recharger le
profil, consulter le profil depuis un autre compte, retirer la photo et recharger.
Un ancien client qui n'envoie pas `avatar_image` conserve la photo existante.

Les images sont recadrées au centre, redimensionnées à 192 × 192, et réencodées
en JPEG dans le navigateur (sans métadonnées du fichier original). La valeur
stockée est limitée à 24 000 caractères pour rester sous les 32 Ko de l'API.
L'API refuse les URL distantes et les autres formats. Les photos sont publiques
sur la page profil ; aucune modification de l'avatar du forum n'est incluse.
