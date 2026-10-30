# Lot 55 — Track : choisir ses fantômes dans le classement, et refondre le son

Branche `claude/practical-gauss-20xfi4` (nom imposé par la session ; le lot prévoyait `lot-55-fantomes-son`), partie de `main` à `e9436a9` (lot 51 fusionné). Zones : `apps/web/**`, `packages/sim/**`,
`cdj.ts` et `salon.ts`, leurs tests, `docs/lots/**`, la ligne de Track de `budgets.md`, `durees.json`, `applications.ts`, les clés de catalogue. Le nom de la branche ne porte ni `track` ni `jump` :
la PR est une PR « plateforme » pour le job `zones`. Golden, rediffusions, classements et identifiants de circuit **inchangés** (le son et le choix des fantômes ne touchent jamais la simulation).

## État

| Étape | État |
|---|---|
| **A1 — maquettes des fantômes** (`lot-55/maquettes-fantomes.html`) | **validées par Nathan** (30/10/2026), ses cinq propositions acceptées |
| **A2 à A5 — choix, course, serveur, chargement** | **faits** (voir ci-dessous) ; reste la CI verte de la PR |
| **B1 — planche sonore** (`/track/vitrine/?planche=son`) | à faire (arrêt : Nathan écoute et choisit l'approche) |
| B2 à B7 — boîte de vitesses, voix par voiture, le reste des sons, Salon, réglages, téléphone | après le choix de l'approche |

## Partie A — choisir ses fantômes (faite)

**Ce qui est livré** (règles : `apps/web/CLAUDE.md`, « Fantômes choisis dans le classement (lot 55) » ; serveur : `apps/api/CLAUDE.md`, « Les fantômes choisis dans le classement (lot 55) »).
- **Le choix** : une case de 44 px par ligne du classement (accueil, page « Classement », coin de la course **en pause**), compteur « 3 fantômes sur 5 », « Tout décocher », 5 au plus (les autres cases grisées et la raison dite), le premier et celui devant toi **proposés cochés** tant que rien n'est choisi, le lien « Choisir mes fantômes (3) » à l'arrivée, les pastilles de teinte dans la rangée de l'accueil. Ta ligne n'a pas de case. Cocher passe en « Ma sélection ».
- **Le bouton** (touche G, `#btn-ghost`, pause, accueil) : **Rien → Le mien → Le premier → Ma sélection → Rien** ; saute ce qui n'existe pas et le dit (« Pas encore de record · Fantôme : … ») ; badge « 3 » / « 1 » et barre quand il est coupé ; mode gardé d'une course à l'autre (`cdj:track:fantomes`) ; défaut inchangé (« Le mien »).
- **En course** : le champ de fantômes du Salon (`GhostField`) : chaque fantôme a **la voiture de sa course** (version simple), **la teinte de son rang dans le choix**, son pseudo au-dessus, aucune collision ni son ; ils partent avec toi et se recalent à « Recommencer » ; l'écart avec le plus proche s'écrit 3 s après un point de contrôle (« Mika −0,41 »).
- **Serveur** : `ref` sur les lignes du classement (la référence publique `players.ref`) et `GET /api/day/<date>/run/<ref>` (lecture publique, `X-Player-Id` ignoré, 404 pour une course masquée), limite de lecture comme le classement. **Aucune donnée gardée de plus.**
- **Écart avec la proposition validée** : la référence de course est **la référence publique du joueur** (`players.ref`, déjà gardée et indexée par le lot N1), **pas** un SHA-256 « jour + joueur » calculé à la lecture : même garantie (jamais l'identifiant secret), mais la ligne se retrouve par un index existant au lieu d'une recherche. Le jour est dans l'adresse de la route.
- **Écart avec la proposition validée (2)** : un fantôme en retard rejoint la course **à sa place sans fondu de 0,3 s** (il apparaît directement : `GhostField` n'a pas de fondu, le Salon non plus) ; il attend la course suivante au-delà de la moitié de son tour.
- **Le coin de la course en course** reste en lecture seule (pas de case en conduisant) ; les cases n'y sont qu'en pause.

**Poids et temps de chargement** — poids : `runPilot` sur quatre jours et trois adhérences (38 à 40 s de course) : une rediffusion pèse **3,6 à 7,4 ko** en JSON (la route : rediffusion, temps intermédiaires, voiture), **≈ 2 à 3 ko compressés** ; cinq au plus **38 ko** (≈ 15 ko compressés). Temps : **mesuré** (`MESURE=1 npx playwright test mesure-lot55`, Chrome avec réseau émulé par DevTools, serveur d'essai **sans compression** : le pire cas ; **cinq rediffusions** de 3,8 à 4,1 ko, 20 ko en tout, demandées **en parallèle**) : **≈ 120 ms** en 4G courante (9 Mbit/s, 80 ms d'aller-retour) et **≈ 440 ms** en 4G lente (1,6 Mbit/s, 300 ms). Très sous les 3 s du décompte ; un retardataire rejoint la course à sa place (voir plus haut). Une page ne les télécharge qu'**une fois** (recommencer ne relit rien). Limite de la mesure : un réseau émulé sur la machine, pas un téléphone réel ; le serveur du test est local (≈ 20 ms par requête), celui de Cloud Run + Turso ajoute sa propre latence (une lecture indexée, mesurée au lot 5).

**Budget** : premier chargement **+290 o** (293 733 → 294 023 contre `main` après le lot T1 ; **aucun plafond relevé** : marges de 689 o pour `track.jsCss`, 714 o pour `track.js`, 771 o pour `track.horsThree`) ; **le choix des fantômes à la demande** : `fantomesJeu-*.js` ≈ 4,1 ko compressés + 0,9 ko de feuille (garde : `e2e/perf.spec.ts`, 6 ko ; **une ligne du tableau de `budgets.md` est à ajouter par un lot de plateforme** : le test qui la garde est dans `apps/portail`). Ce qui coûte au premier chargement : le cycle du bouton et le chargeur (`main.ts`), `data-ref` des lignes, le badge du bouton, l'écart au point de contrôle. L'ancien cycle (`ghostModes`, `nextGhostMode`, la branche « devant toi ») en est sorti. *(Avant la fusion de T1 la marge était de 52 o et le lot demandait 300 o de plafond : devenu inutile.)*

**Tests** : `apps/api/test/fantomesChoisis.test.ts` (6, SQLite **et** libSQL : `ref` publique sans identifiant secret, rediffusion, 400/404, masqué, aucune écriture) ; `apps/web/test/fantomesChoix.test.ts` (de 1 à 5, gardé pour le jour et oublié le lendemain, mémoire abîmée ou piégée, teintes = celles du Salon, le bouton fait défiler et saute un mode vide) ; `apps/web/test/fantomesJour.test.ts` (cinq fantômes en course, chacun avec sa voiture et sa teinte, recommencer recale tout le monde, le retardataire) ; e2e `fantomes.spec.ts` (serveur 8802 ; 2 tests : cocher trois fantômes en pause, les voir courir avec leur pseudo, recommencer, faire défiler le bouton et sauter « Le mien », garder le choix pour le jour puis l'oublier le lendemain ; tout décocher) ; outils hors CI `captures-lot55` (`docs/lots/lot-55/img/`) et `mesure-lot55` ; `leaderboard.spec.ts` et `adresses-joueur.spec.ts` suivent le nouveau cycle.

## Fichiers hors zone (exceptions, listées pour Nathan)

- `apps/api/scripts/platformBudget.ts` et `apps/api/test/platformBudget.test.ts` : le coût d'un fantôme choisi (`TRACK_FANTOMES_CHOISIS`).
- `apps/portail/mentions-legales/index.html` et `apps/portail/legal/index.html` : la clé `cdj:track:fantomes` est nommée (règle de fidélité du lot R5 : toute nouvelle donnée gardée). **Pas de test ajouté** dans `apps/portail/test/mentions.test.ts`.
- `docs/plateforme/budgets.md` (les trois lignes de Track : la mesure, plafonds inchangés), `docs/plateforme/traductions.md` (régénéré), `e2e/zones.json` (le spec et `fantomes*.ts` dans la zone `track-hud`).
- À proposer à un lot de plateforme : l'index du `CLAUDE.md` racine (« Fantômes choisis dans le classement (lot 55) » dans la liste de `apps/web/CLAUDE.md`), la ligne « choix des fantômes à la demande » de `budgets.md`, la route `run/<ref>` dans la colonne « routes » de `docs/plateforme/codes-erreur.md` (`invalid_ref`, `no_ghost`).

