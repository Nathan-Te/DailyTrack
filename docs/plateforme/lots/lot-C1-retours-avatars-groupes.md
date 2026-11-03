# Lot C1 — Retours des joueurs, avatars et groupes (plateforme, lot de nuit)

Trois parties dans l'ordre, chacune dans ses commits et verte à elle seule : **A** les retours, **B** les avatars, **C** les groupes. Arrêt propre : voir « Où j'en suis ».
Charte : `docs/plateforme/identite.md`, **révision 17** (le fichier fourni partait d'une base plus ancienne que ce dépôt : seules ses trois puces du § 9 — avatar rond, emblème carré, « Un bug ? Une idée ? » — ont été reprises, sans toucher aux révisions 11 à 16).

## Où j'en suis
- **A (retours) : faite**, verte en local (tests unitaires SQLite et libSQL, budgets, un e2e).
- B (avatars) : à faire. C (groupes) : à faire.

## Partie A — « Un bug ? Une idée ? »
- **Tables** `retours`, `retours_messages` (migration réversible, `DROP TABLE` des deux) ; effacées avec le profil, suivent « Changer mon code », vidées par la remise à zéro, **gardées 12 mois après la dernière activité du fil**.
- **Routes** joueur : `GET /api/retours/contexte`, `POST /api/retours`, `GET /api/retours`, `GET /api/retours/<id>`, `POST …/messages`, `POST …/lu` ; administration : `GET /api/admin/retours[?type&jeu&statut&page]`, `…/compte`, `…/<id>`, `POST …/<id>/repondre|statut|lu`. Détail et limites : `apps/api/CLAUDE.md`, « Retours (lot C1) ».
- **Limites** : 5 nouveaux fils par joueur et par jour de Paris, 10 envois par adresse et fenêtre (3 sans profil), 100 messages par fil, 1 000 caractères, texte seul jamais interprété.
- **Écrans** : dialogue commun (`packages/ui/src/retours.ts`, à la demande) avec le contexte joint montré avant l'envoi ; lien dans le pied de toutes les pages du portail ; entrée dans la pause et les Réglages de Track, Jump et Tower ; `/messages/` (« Mes messages », depuis le profil) ; pastille sur l'avatar (`messagesNonLus` dans `GET /api/portail/jour`, toujours une seule requête) ; rubrique « Retours » du panneau (liste filtrée, non lus dans le menu, détail, réponse, statut).
- **Budgets tenus, sans relèvement** : le code du dialogue est à la demande ; pour garder la marge des jeux (Track et Tower sont à moins de 100 o de leur plafond) le **polyfill du préchargement des modules est retiré des trois jeux** (`build.modulePreload.polyfill: false`, ≈ 390 o : un navigateur très ancien ne précharge plus, rien ne casse). Nouvelle ligne `retours.dialogue` (6 554 o, plafond 7 500) ; `retoursJeu-` est exclu de la mesure de Jump comme `manette-`. **À confirmer par Nathan** (exclusion et polyfill).
