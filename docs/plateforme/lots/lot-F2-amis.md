# Lot F2 — Les amis, et le filtre « Amis » des classements

Maquette : `maquettes/favoris-et-amis.html` (planches B, C, D) ; charte `docs/plateforme/identite.md`, révision 14, § 9. Lot de la plateforme (touche les classements des jeux). F1 (favoris) peut tourner en même temps : rebaser sur `main` avant de pousser.

## Le modèle (serveur)
- **Table `amities`** (`PLATFORM_SCHEMA`) : `joueur`, `ami` (identifiants **internes** des joueurs), `origine` (`ajout` | `invitation`), `cree_le`. Clé `(joueur, ami)`. Index `amities_by_joueur (joueur)` (couvert par la clé) et `amities_by_ami (ami)`. Une ligne = « `joueur` voit les temps de `ami` ». Une amitié relie deux **joueurs**, pas deux pseudos : elle survit à un changement de pseudo (« Changer mon code » : les deux colonnes suivent, `rotateStatements`).
- **Par pseudo ou depuis un classement : sens unique** (une ligne ; l'autre n'est pas prévenu). **Par invitation : réciproque** (deux lignes, créées ensemble). **100 amis au plus** par joueur ; pas soi-même ; pas de doublon. Retirer = supprimer **sa** ligne seulement.
- **Un joueur masqué** (`players.hidden = 1`) n'apparaît jamais dans les amis des autres (liste, classement filtré, compteur). **Supprimer un profil efface ses amitiés dans les deux sens** (crochet d'effacement de la plateforme, `players.eraseStatements`). Table liée à un joueur : dans `TABLES_VIDEES` (remise à zéro du lancement).

## La référence publique
- **`players.ref`** (12 hexadécimaux, déjà indexée, déjà rendue par le classement de Track depuis le lot 55) : empreinte **à sens unique** (SHA-256) du secret de 128 bits ; elle ne permet pas de retrouver l'identifiant. **Décision à confirmer par Nathan** : le cahier des charges parlait d'une colonne « tirée au hasard » ; l'existante est dérivée du secret mais non réversible, déjà publique, et son changement à « Changer mon code » n'a aucune conséquence (les amitiés sont rangées par identifiant interne).
- Toute ligne de classement (portail, Track, Jump, Tower) porte `ref`. **L'identifiant secret ne sort jamais** (ni réponse, ni page, ni adresse, ni journal).

## Les routes (`apps/api/src/amis.ts`, `/api/amis/…`, identifiant en `X-Player-Id`, réponses `no-store`)
| Route | Corps / paramètres | Réponse |
|---|---|---|
| `GET /api/amis` | — | `{ amis: [{ ref, pseudo, reciproque, origine }], total, max: 100, invitation: { active } }` (masqués écartés ; tri par pseudo) |
| `POST /api/amis` | `{ ref }` **ou** `{ pseudo }` (exacte, sans casse ni accents : `nameKey`) | `{ ami: {ref, pseudo, reciproque, origine}, total }` |
| `DELETE /api/amis/<ref>` | — | `{ total }` (idempotent) |
| `GET /api/amis/suggestions?q=` | début de pseudo, 3 lettres au moins | `{ suggestions: [{ ref, pseudo }] }` (5 au plus ; joueurs non masqués qui ont **un résultat classé dans les 30 derniers jours** ; ni soi-même ni un ami déjà ajouté ; moins de 3 lettres : liste vide) |
| `POST /api/amis/invitation` | — | `{ jeton }` — crée **ou renouvelle** (l'ancien devient inutilisable) ; **le jeton n'est rendu qu'ici**, le serveur n'en garde que l'**empreinte** |
| `POST /api/amis/invitation/voir` | `{ jeton }` | `{ pseudo }` de l'invitant (pour « Nathan t'invite ») |
| `POST /api/amis/invitation/accepter` | `{ jeton, pseudo? }` | `{ ami: {…}, total }` ; **sans profil serveur** : `pseudo` obligatoire, le profil est créé (mêmes règles de pseudo que partout : `name_required`, `invalid_name`, `name_taken` + suggestions) puis l'amitié |
| `GET /api/amis/fiche/<ref>?date=` | jour de Paris (défaut aujourd'hui) | `{ ref, pseudo, ami, reciproque, rang, classes, jeux: [{ jeu, site, nom, unite: "temps"\|"hauteur", valeur, medaille, rang }] }` — la feuille de la planche C ; **rien d'autre** sur le joueur ; `404 unknown_friend` si inconnu ou masqué |
- **Le lien d'invitation** vaut jusqu'à son renouvellement (un seul actif par joueur) ; il peut servir à plusieurs personnes. Le rouvrir une seconde fois par la même personne : `409 friend_exists`. Les deux listes sont vérifiées **avant** d'écrire : si l'une est pleine, rien n'est créé.
- **Codes d'erreur nouveaux** (`codesErreur.ts`, `docs/plateforme/codes-erreur.md`, `erreur.<code>` fr + en dans `packages/ui`) : `invalid_friend` 400, `friend_self` 400, `unknown_friend` 404, `friend_exists` 409, `friends_full` 409 (ta liste), `their_friends_full` 409 (la liste de l'autre), `invalid_invitation` 404 (jeton inconnu ou révoqué : un seul visage), `invalid_filter` 400. Existants réutilisés : `invalid_player`, `unknown_player`, `code_revoked`, `rate_limited`, `name_*`.
- **Limites de débit** : ajout et retrait, suggestions, acceptation, création du lien — par adresse (`hitAddress` / `readHitAddress`) et par joueur.

## Le filtre `filtre=amis`
- Accepté (avec `X-Player-Id`) par `GET /api/portail/classement?date=&vue=` (les trois vues), `GET /api/day/<date>/leaderboard` (Track), `GET /api/jump/day/<date>/board`, `GET /api/tower/day/<date>/board`. Autre valeur : `400 invalid_filter` ; sans identifiant valide : `400 invalid_player` ; joueur inconnu : `404 unknown_player`. Réponse **`Cache-Control: private, no-cache`**, `Vary: X-Player-Id`.
- **Toi et tes amis, tous, sans la limite des 50.** Mêmes lignes qu'en « Tous », mais : `rang` = le rang **entre amis** ; `rangGeneral` = le rang dans le classement « Tous » de la vue ; `ref` ; ta ligne marquée `moi: true`. Les amis qui n'ont rien fini ce jour-là (dans la vue) : `absents: [{ ref, pseudo }]` (en bas, sans temps). `amis: <nombre d'amis>` et `classes` = lignes classées. Masqués écartés.
- **Calcul par fenêtre** : les rangs viennent du classement du jour que la plateforme garde déjà (fenêtre de 45 s, `classes(day)` des crochets `portail` des jeux), partagé par les jeux : **aucune requête par ami**. Seuls la liste des amis (une requête indexée) et les pseudos manquants sont lus.
- **`GET /api/portail/jour`** avec joueur : `joueur.rangEntreAmis: { rang, sur } | null` (`null` sans ami ou tant que le joueur n'a rien fini ; sert « 3e entre amis » sous le rang de la tuile).
- Lignes lues mesurées pour 0, 10 et 100 amis (R14) : voir le tableau en bas.

## Les écrans
- **Client commun** : `packages/profile/src/amis.ts` (appels, jeton d'invitation rangé en `sessionStorage` `cdj:invitation` puis retiré de l'adresse par `history.replaceState`, comme la clé d'aperçu), `packages/ui` : `selecteurAmis` (Tous · N / Amis · N, `role="tablist"`, 44 px), `feuilleJoueur` (dialogue en bas : temps et médaille par jeu, rang général, « Ajouter en ami » / « Retirer », « {pseudo} n'est pas prévenu »), catalogue commun `amis.*` fr + en.
- **Portail** : `/classement/` (sélecteur sous les onglets, `?filtre=amis`, feuille au toucher d'une ligne), `/amis/` (planche D : ajouter par pseudo + suggestions, « Inviter un ami (lien) » par `navigator.share` ou copie, liste « vous deux » / « ajouté par toi » + Retirer, compteur sur 100, « Nouveau lien » ; `?invitation=` : carte « {pseudo} t'invite sur Du Jour » + Accepter, avec création du profil sans profil), lien depuis `/profil/`, tuile de l'accueil « 3e entre amis ».
- **Track, Jump, Tower** : le même sélecteur dans leur classement, la feuille au toucher d'une ligne, `?filtre=amis` dans l'adresse. Manette (lot M1) et catalogues fr + en partout.

## Réalisé (écarts au contrat)
- **Serveur** : `amities` + `invitations_amis` (jeton en empreinte), `/api/amis/…`, `filtre=amis` sur le portail (3 vues), Track, Jump, Tower via le classement du jour partagé par fenêtre (`classementAmis.ts`) : **aucune requête par ami**. Les classements filtrés émettent `rang` (contrat) **et** `rank` (nom historique des jeux), plus `rangGeneral`, `ref`, `absents`, `amis`. `rangEntreAmis` est `null` aussi si aucun ami n'a rien fini. Plafond de 100 vérifié à l'écriture (`INSERT … WHERE COUNT < 100`), masqués comptés dans le plafond mais pas dans `total`. Le lien rouvert par la même personne : `friend_exists` ; il complète la réciprocité si une seule ligne existait. Profils créés par une acceptation : 5 par adresse et fenêtre.
- **Client** : `@cdj/profile` `clientAmis`, jeton en `sessionStorage` (`cdj:invitation`, retiré de l'adresse) ; `@cdj/ui` `selecteurAmis` (**radiogroup**, pas tablist : LB/RB changent d'onglet), `feuilleJoueur`, page Mes amis ; tout est **à la demande**, `CATALOGUE_AMIS` à part (les 8 `erreur.*` y sont : +321 o au premier chargement du portail sinon).
- **Écrans** : portail `/classement/` (sélecteur, `?filtre=amis`, feuille), `/amis/` (planche D, invitation, sans profil), lien du profil, « 3e entre amis » ; Track (page du classement du jour), Jump (écran du classement ; ta ligne en encre), Tower (dialogue « Tout le classement »). Le top 5/10 de l'accueil et de l'arrivée reste « Tous ». Le rang général est dans la feuille (« 8e sur 412 »), pas dans la ligne. Manette : `ECRAN_MANETTE_FEUILLE` recopié (testé égal) dans chaque `manette` pour ne pas charger les composants.

## Décisions pour Nathan
1. **Référence publique** = `players.ref` existante (SHA-256 tronqué, à sens unique), pas une colonne tirée au hasard : voir plus haut.
2. **Mesure du budget de Jump** : `scripts/budgets.mjs` et `poids.spec.ts` divergeaient de 684 o ; les deux excluent désormais `course-` et `interrupteur-` (fichiers déjà documentés « à la demande ») et `classementAmis-`. `jump.jsCss` : 381 075 o (+563 o contre `main`, plafond 382 590). **L'ancienne mesure baisse d'environ 1,3 ko** : à confirmer. Aucun plafond relevé.
3. **Marges minces** : `tower.jsCss` 39 916/40 000 (marge 84), `tower.jeu` 169 141/169 200 (59), `track.jsCss` 296 653/296 736 (83). Le portail passe de 33 000 (atteint à l'octet) à 31 103 o : les clés des autres pages sont sorties de `catalogue.ts` (`cataloguePages.ts`).
4. Accepter une invitation **sans profil crée un profil sans résultat** (limité à 5 par adresse).
5. Suggestions : au plus 300 candidats lus ; un début très courant ne renvoie que le début de l'ordre alphabétique.

## Vérifié / non vérifié
- **Vérifié** : serveur — `vitest apps/api` + mentions : 738 tests (SQLite), 698 (libSQL) ; `tsc -b` ; unitaires du socle (683), de Tower (316), de Jump (882 avec `ciZones`), de Track (88 ciblés), du portail ; `npm run traductions` (1507 clés) ; **un e2e** (`apps/web/e2e/amis.spec.ts`, Chromium, vrai serveur : ajouter depuis le classement › filtre Amis) ; e2e du portail (`portail`, `portail-jour`, `portail-journee`) ; captures du portail regardées par l'agent (classement Amis, feuille, `/amis/`, invitation).
- **Non vérifié** : le sélecteur et la feuille de **Track, Jump et Tower** n'ont jamais tourné dans un navigateur (tests unitaires seulement, pas de jsdom) ; pas d'axe sur `/amis/` ni sur « Amis » (passé une fois à la main sur `/amis/`) ; pas de captures de Track, Jump, Tower ; aucun essai sur Turso (règle R14).
- **CI de PR** : verte sur `122ed63` (12,1 min) : https://github.com/Nathan-Te/DailyTrack/actions/runs/41422588919 ; `npm run verifier` en local vert (unitaires SQLite et libSQL, e2e Track 24, Jump 13, Tower 4 specs). Golden inchangés.

## Lignes lues (R14, base de référence 300 joueurs × 14 jours, `file:` local, estimation basse ; froid / chaud)
| Route | 0 ami | 10 amis | 100 amis |
|---|---|---|---|
| `GET /api/amis` | 2 / 1 | 12 / 11 | 102 / 101 |
| `GET /api/portail/jour` (joueur) | 636 / 27 | 646 / 37 | 736 / 127 |
| classement filtré (portail, Track, Tower) | 612 / 4 | 622 / 14 | 712 / 104 |
| classement filtré Jump | 613 / 5 | 629 / 21 | 779 / 171 |
| fiche d'un joueur | 610 / 2 | 612 / 4 | 612 / 4 |
Le « froid » est le calcul du classement du jour, le même que pour « Tous » ; le nombre d'instructions ne dépend pas du nombre d'amis (testé). Ajout d'un ami : 7 lignes, une écriture. Détail : `couts.md` § 11.
