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

## Vérifié / non vérifié, runs
(à remplir en fin de lot)

## Lignes lues (R14)
(à remplir en fin de lot)
