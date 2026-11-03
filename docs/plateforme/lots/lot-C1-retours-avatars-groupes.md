# Lot C1 — Retours des joueurs, avatars et groupes (plateforme, lot de nuit)

Trois parties dans l'ordre, chacune dans ses commits et verte à elle seule : **A** les retours, **B** les avatars, **C** les groupes. Arrêt propre : voir « Où j'en suis ».
Charte : `docs/plateforme/identite.md`, **révision 17** (le fichier fourni partait d'une base plus ancienne que ce dépôt : seules ses trois puces du § 9 — avatar rond, emblème carré, « Un bug ? Une idée ? » — ont été reprises, sans toucher aux révisions 11 à 16).

## Où j'en suis
- **A (retours) : faite**, verte en local (tests unitaires SQLite et libSQL, budgets, un e2e).
- **B (avatars) : faite**, verte en local (suite complète SQLite : 6 157 tests ; avatars et amis en libSQL ; budgets ; un e2e `avatars.spec.ts`). C (groupes) : en cours.

## Partie A — « Un bug ? Une idée ? »
- **Tables** `retours`, `retours_messages` (migration réversible, `DROP TABLE` des deux) ; effacées avec le profil, suivent « Changer mon code », vidées par la remise à zéro, **gardées 12 mois après la dernière activité du fil**.
- **Routes** joueur : `GET /api/retours/contexte`, `POST /api/retours`, `GET /api/retours`, `GET /api/retours/<id>`, `POST …/messages`, `POST …/lu` ; administration : `GET /api/admin/retours[?type&jeu&statut&page]`, `…/compte`, `…/<id>`, `POST …/<id>/repondre|statut|lu`. Détail et limites : `apps/api/CLAUDE.md`, « Retours (lot C1) ».
- **Limites** : 5 nouveaux fils par joueur et par jour de Paris, 10 envois par adresse et fenêtre (3 sans profil), 100 messages par fil, 1 000 caractères, texte seul jamais interprété.
- **Écrans** : dialogue commun (`packages/ui/src/retours.ts`, à la demande) avec le contexte joint montré avant l'envoi ; lien dans le pied de toutes les pages du portail ; entrée dans la pause et les Réglages de Track, Jump et Tower ; `/messages/` (« Mes messages », depuis le profil) ; pastille sur l'avatar (`messagesNonLus` dans `GET /api/portail/jour`, toujours une seule requête) ; rubrique « Retours » du panneau (liste filtrée, non lus dans le menu, détail, réponse, statut).
- **Budgets tenus, sans relèvement** : le code du dialogue est à la demande ; pour garder la marge des jeux (Track et Tower sont à moins de 100 o de leur plafond) le **polyfill du préchargement des modules est retiré des trois jeux** (`build.modulePreload.polyfill: false`, ≈ 390 o : un navigateur très ancien ne précharge plus, rien ne casse). Nouvelle ligne `retours.dialogue` (6 554 o, plafond 7 500) ; `retoursJeu-` est exclu de la mesure de Jump comme `manette-`. **À confirmer par Nathan** (exclusion et polyfill).

## Partie B — Avatars
- **Contrôle d'une image sans dépendance** (`apps/api/src/imagesAvatar.ts`) : WebP nu (`VP8 ` ou `VP8L`) ou JPEG ; refus de tout le reste, du WebP étendu (`VP8X`, `EXIF`, `XMP `, `ICCP`, animation, alpha), des segments JPEG `APP1`…`APP15` et commentaires, d'une image non carrée, hors de 16 à 128 px, au-dessus de 20 Ko. **Constaté en essayant** : le WebP de Chromium porte un profil ICC (`VP8X` + `ICCP`) ; le navigateur **assainit** donc avant l'envoi (`assainirImage`, testé sur un vrai WebP de Chromium).
- **Tables** `avatars`, `avatar_signalements`, `avatar_interdits` + colonne `players.avatar` (l'empreinte visible : un classement n'a aucune lecture de plus) ; migration réversible ; vidées par la remise à zéro, effacées avec le profil, suivent « Changer mon code ».
- **Routes** : `POST/DELETE /api/avatar`, `POST /api/avatar/signaler`, `GET /api/avatars/<empreinte>` (adresse immuable : `max-age` d'un an, `s-maxage` d'une heure) ; administration `GET /api/admin/images`, octets, `garder | retirer | interdire | autoriser`.
- **Limites** : un changement d'image par jour et par joueur, 20 envois par adresse, 3 signalants différents masquent l'image aussitôt, un signalement par signalant et par image.
- **Stockage** : base64 en base (la couche SQL n'a que des textes) : ≈ 27 Ko au plus par joueur, ≈ 8 Ko pour une vraie image de 128 × 128 ; aucune lecture d'image pendant une partie (voir `couts.md` § 13).
- **Écrans** : profil › Photo de profil (recadrage carré dans le navigateur) ; avatar de la barre, lignes de `/classement/` (Tous et Amis), feuille d'un joueur (avec « Signaler l'image »), « Mes amis » ; administration › Images (galerie). **Pas encore** : l'avatar dans les classements *à l'intérieur* des trois jeux (ils n'ont que le pseudo ; décision à prendre avec Nathan, car chaque jeu est près de son plafond de poids).
- **Budgets** : l'avatar a été sorti de `composants.ts` (`avatar.ts`) et ses feuilles scindées (`avatar.css` / `avatar-liste.css`) : sans cela `amis.ts` faisait entrer +370 o dans le premier chargement des trois jeux. `portail.premier` : 35 182 pour 35 200 (**18 o de marge**).
- **Mentions** FR et EN : rubrique « Ta photo de profil » (tables, constantes, modération, contact `mzc.studios.gamedev@gmail.com`, retrait sans délai). **Seed** : 4 joueurs avec une image.

