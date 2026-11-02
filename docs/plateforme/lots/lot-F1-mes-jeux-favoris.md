# Lot F1 (plateforme) — Mes jeux : les favoris sur l'accueil

Branche `claude/mes-jeux-favoris-jstxwy`, PR en brouillon. Charte : `identite.md` § 9 (révision 15) ; maquette : `docs/plateforme/maquettes/favoris-et-amis.html` (planche A). Règles : `apps/portail/CLAUDE.md`, `apps/api/CLAUDE.md` et `packages/profile/CLAUDE.md`, rubriques « Mes jeux (lot F1) ».

## Ce qui est livré
- **Accueil** : une étoile de 44 px par cartouche (`aria-pressed`, « Ajouter Track à mes jeux » / « Retirer Track de mes jeux », fr + en, textes dans le catalogue du portail (le commun pèse dans Jump), joignable à la manette après « Jouer »). « Mes jeux » en cartouches pleines, « Les autres jeux » dessous en **cartouches compactes** (variante `compacte` du composant, mêmes coque, étiquette et police). Sans favori : l'accueil d'avant + « Touche l'étoile pour garder tes jeux en haut. ». Pastille « Nouveau » 7 jours sur un jeu ouvert, tant qu'il n'est pas épinglé. Un favori dont le jeu repasse à `off` disparaît sans message et revient avec lui.
- **Stockage** : table `favoris_jeux (player_id, du, jeux)`, **une ligne par changement** (migration réversible : `DROP TABLE`), vidée par la remise à zéro, effacée avec le joueur, suit « Changer mon code », décrite dans les deux pages de mentions. La liste arrive dans `GET /api/portail/jour` (`joueur.favoris`, `joueur.jeuxDuJour`) : **toujours une seule requête au chargement**. Écriture : `PUT /api/portail/favoris` (liste entière, débit 20 par joueur / 40 par adresse, refus `400 invalid_json`). Un visiteur garde sa liste dans `cdj:favoris` (`try/catch`), reprise une fois dans son profil à sa création ; sinon le serveur fait foi.
- **La règle de la journée** : journée parfaite, « n fini sur m », série, ligne de partage et « Jeu suivant du jour » portent sur mes jeux, ou sur tous les jeux sans favori (favoris tous éteints : tous). **Un changement compte à partir du lendemain** : il écrit la ligne `du = demain`, l'ensemble d'une journée est celui de son début. **Chaque jour est jugé avec la liste qui était la sienne** (historique) : une série à cheval sur un changement ne se casse pas. Exception : un profil créé aujourd'hui (première visite) compte son premier choix tout de suite. Basculer une étoile puis la remettre ne laisse aucune ligne. Le classement du jour **ne change pas**.
- **Série et partage** : la série compte les jours où j'ai fini au moins un de mes jeux de ce jour-là ; `Du Jour #7 — Track 🥇 · Tower ⬜ — 🔥 6` ne cite que mes jeux (⭐ si mes jeux sont finis) ; le bouton « Partager ma journée » demande qu'un de mes jeux soit fini.
- **Recette** : le joueur Démo a Track en favori, pas Jump (choisi et compté dès aujourd'hui : série de 5 jours et 2 journées d'avant inchangées, aujourd'hui parfaite : 3 journées parfaites).

## Scénario pour Nathan (aperçu de la PR)
`<aperçu>/?demo=joueur` : Track sous « Mes jeux », Jump dessous en ligne compacte jaune. Toucher l'étoile de Jump : il monte (« Ton choix compte pour ta journée à partir de demain. »). Recharger : l'ordre est gardé ; le partage ne cite que mes jeux.

## Décisions à prendre / écarts
1. **Budget du portail** : +2 036 o mesurés contre `main` (33 000 → 35 036). L'étoile et la cartouche compacte sont dans le premier dessin de l'accueil : pas de « à la demande » possible (l'écriture au serveur l'est déjà). **Plafond relevé de 2 100 o à 35 100, à valider par Nathan** (`budgets.md`). Piste si refusé : charger le catalogue anglais du portail à la demande, dans un lot à part.
2. **Charte** : le fichier fourni numérotait ce texte « révision 14 » sur une base plus ancienne que le dépôt (qui a déjà les révisions 13 Tower et 14 manette) : je n'ai **pas écrasé** `identite.md`, j'y ai repris le seul passage « Mes jeux » (révision 15). Le sélecteur Tous / Amis du même fichier est celui du lot F2.
3. **« Première visite »** (le prompt dit « début du jour, ou première visite du jour ») : interprété comme « profil créé aujourd'hui » (`players.created_at`).
4. **Cache « invalidé pour ce joueur »** : rien à vider côté serveur (sa réponse du jour est `private, no-cache`, recalculée à chaque requête ; le classement gardé ne dépend pas des favoris) ; côté page, la réponse du `PUT` redessine sans relire le jour.

## Captures (`docs/plateforme/lots/img/lot-F1-*.png`, outil `captures-lot-f1.spec.ts`)
Accueil avec et sans favoris × portrait et paysage × FR et EN (8 images).

## Vérifié
Typecheck (`tsc -b`, portail) ; unitaires : noyau (`favoris.test.ts`), serveur (`portailFavoris.test.ts` : épingler en cours de journée, retirer à 23 h 59, série à cheval, favori qui passe à `off`, première visite, effacement, « Changer mon code », débit ; SQLite et libSQL, plans vérifiés par `openTestDb`), profil, portail ; e2e Chromium locaux : `portail-jour` (dont le **seul** nouveau test, épingler › l'ordre change › recharger), `portail-journee` (axe compris), `portail`.
## Non vérifié
Firefox et WebKit ; la mesure de coût sur un `sqld` (pas de Docker ici : le plan et les lignes lues sont vérifiés sur `file:`) ; l'aperçu déployé. **CI de PR verte** (run 41420307733, `ebf0cfc` : unitaires, e2e Chromium, image du serveur) ; une première poussée avait échoué sur deux points, corrigés : le budget de Jump (la feuille de l'étoile est maintenant à part) et un e2e qui rechargeait avant la fin de l'écriture.
