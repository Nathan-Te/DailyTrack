# Lot de plateforme — suites des lots 40 à 47 de Track

Branche `claude/plateforme-suites-track-2-2eskpq`, partie de `main` à `3dddd6e` (lots 42 et 47 fusionnés, plus le lot de plateforme « le Garage de Démo » du 24/10/2026). Les lots 40b à 47 de Track ont laissé des points hors de leurs zones ; ce lot les règle **sans toucher au code du jeu** (`apps/web/src/**`, `packages/sim/src/**`, `apps/api/src/cdj.ts` : intouchés). Seuls changent, côté Track, `apps/web/e2e/perf.spec.ts` (le test du Garage) et une phrase périmée de `apps/web/CLAUDE.md`.

## État des six points

| # | Point | État |
|---|---|---|
| 1 | Tableau des budgets (six lignes, test du Garage, marge) | **fait** |
| 2 | Consignes (`apps/api/CLAUDE.md`, index du `CLAUDE.md` racine) | **fait** |
| 3 | Route `/api/garage` (codes d'erreur, coût, zones) | **fait** |
| 4 | Joueur « Démo » : quatre voitures à toute date | **fait** (méthode ci-dessous) |
| 5 | Mentions légales (`cdj:track:garage`, `cdj:qualite`) | **fait**, les deux pages |
| 6 | Charte : le Garage sans voile | **fait** |

## 1. Le tableau des budgets

- **Six lignes de plus au grand tableau** de `docs/plateforme/budgets.md`, lues par `apps/portail/test/budgets.test.ts` (six clés dans `ATTENDUS`, motifs lus dans `perf.spec.ts`) :

| clé | plafond | mesuré | marge | gardé par (texte du `expect`) |
|---|---|---|---|---|
| `track.decor` | 16 000 | 12 583 | 3 417 | « décor 3D à la demande, les huit thèmes (gzip) » |
| `track.palier2` | 7 000 | 6 539 | 461 | « le palier 2, à la demande, compressé » |
| `track.vieCiel` | 8 000 | 7 992 | **8** | « la vie et le ciel, à la demande, compressés » |
| `track.post` | 7 000 | 6 798 | 202 | « le post-traitement, à la demande, compressé » |
| `track.qualiteMesure` | 1 500 | 838 | 662 | « la mesure de la règle de qualité, à la demande » |
| `track.garage` | 10 000 | **8 962** | 1 038 | « le Garage, à la demande (JS), compressé » |

- **Le test du tableau** acceptait seulement des clés sans chiffre (`[a-z.A-Z]+`) : `track.palier2` n'était pas lue. Le motif accepte les chiffres.
- **`track.garage` est maintenant imposée** : nouveau test de `apps/web/e2e/perf.spec.ts` (« le Garage, à la demande : 10 ko au plus, rien dans le premier chargement ») — aucun fichier `garage-*` dans le premier chargement ; `garage-*.js` et ce qu'il tire hors du premier chargement (`aLaDemande`, la même fonction que les autres lignes) sous 10 000 o. **Mesuré 8 962 o, pas 8,3 ko** : le prompt reprenait la mesure du lot 41 (8,1 ko) ; le lot 42 y a ajouté la couleur du motif et les descriptions des six voitures. Le `garage-*.css` (≈ 1,5 ko) et les modèles des voitures (déjà à la demande, chacun ≤ 4 ko) ne sont pas dans cette ligne.
- **`track.vieCiel` n'a plus que 8 o de marge** (7 992 sur 8 000, elle était à 7 966 au lot 45) : le prochain octet de la vie ou du ciel est une décision de Nathan (relever le plafond ou retirer ailleurs).
- Les phrases « pas encore une ligne du tableau » de `budgets.md` (sections des lots 41, 44, 45, 46, 47) disent maintenant le contraire ; section « suites de Track 2 » en bas de `budgets.md`.
- **Marge de Track remesurée** (`npm run build && node scripts/budgets.mjs`, `main` à `3dddd6e`) : JS + CSS **286 356 o** pour un plafond de **291 600 o**, soit **5 244 o de marge** (≈ 5,2 ko ; JS 274 808 o pour 280 200 : 5 392 o ; hors three.js 141 184 o pour 147 500 : 6 316 o). Le `CLAUDE.md` racine, qui disait « ≈ 21,8 ko », dit **5 244 o** et renvoie aux six lignes.

## 2. Les consignes

- **`apps/api/CLAUDE.md`** : nouvelle rubrique « Garage (lot 41) » (texte du README du lot 41, § 10, point 3), avec les six règles du lot 42 **par renvoi à la table `DEBLOCAGES`** (`packages/sim/src/garage.ts`, dix lignes ; non recopiées), la zone `garage*.ts`, le raccourci de la recette (`garageOuvert`) et les renvois aux codes d'erreur et au coût.
- **Index du `CLAUDE.md` racine** : `apps/web/CLAUDE.md` gagne **Décor : règles de pose (lot 37)**, **Vitrine de la scène (lot 38)**, **Scène (lots 39, 43, 44, 45, 46 et 47)**, **Voiture (lots 40, 40b, 40c et 42)**, **Garage (lot 41)** ; `apps/api/CLAUDE.md` gagne « Garage (lot 41) ». Vérifié présent : « Lot 32 » (api), « Freinage après un boost (lot 34) » (sim), « Premier chargement et chargement à la demande (lot 36) » (web).

## 3. La route `/api/garage`

- `apps/api/test/codesErreur.test.ts` : `/api/garage` dans `ROUTES` (toutes les méthodes, avec et sans `X-Player-Id` : `invalid_player`, `code_revoked`, `rate_limited`, `not_found`…) ; `docs/plateforme/codes-erreur.md` : la route dans les lignes `invalid_player`, `code_revoked` et `rate_limited`.
- **Coût** (`apps/api/scripts/platformBudget.ts`) : `TRACK_PLAYER` passe de 14 à **15 requêtes** (une ouverture du Garage par joueur et par jour) et de 1 822 à **1 878 lignes lues** (la requête indexée lit ≈ 2 lignes par jour joué, 14 jours d'historique comptés = 28, **à l'ouverture et à l'envoi** : 56 lignes ; l'envoi garde son nombre de requêtes). Hypothèse, pas une mesure : `npm run measure:budget` (sqld local) ne tourne pas ici.
- **Zones** : `apps/api/src/garage*.ts` et `apps/api/test/garage*.test.ts` dans la zone de Track (`scripts/zones-jeu.mjs`) et dans la portée de la CI (`scripts/ci-scope.mjs`) : des **motifs**, comme `jump*.ts`, parce que le test des zones exige que chaque fichier nommé existe et qu'on ne déplace rien ici. Testés dans `zonesJeu.test.ts` et `ciScope.test.ts`.

## 4. Le joueur de démonstration

- **Déjà fait en partie, vérifié** : `portailDemo.ts` calculait déjà les médailles avec le jour (`medalsFor(circuit.authorMs, day)`, lot « suites de Track »). Et le lot « le Garage de Démo » (même jour) fait ouvrir **les dix voitures** à « Démo » sur un serveur `ENVIRONMENT=recette` (`garageOuvert`, `cdj.ts`). Ce raccourci masque la progression ; ce lot donne à « Démo » **le bon état réel**, qui reste vrai le jour où le raccourci sera retiré.
- **Méthode : de vraies rediffusions, rejouées par le serveur. Aucun résultat posé à la main.** Le pilote n'atteint plus aucune médaille dès le 28/10 (seuils sous son temps). Il reste deux faits : les jours d'avant la bascule gardent leurs seuils (le pilote y a l'or, et ne peut pas faire moins que l'argent), et le serveur compte **tous** les jours rejoués par le joueur. « Démo » rejoue donc, en plus de sa série de cinq jours, des jours d'avant la bascule (`planGarage`, `courseGarage` de `portailDemo.ts`) :
  - les ors qui manquent à la Weasel (3 ors, lus dans `DEBLOCAGES`) : des jours d'avant le 28/10 **en or exactement** (jamais la médaille d'auteur, qui débloquerait la Dragonfly) ;
  - les jours joués qui manquent à la Badger (7 jours) : des jours d'avant la bascule **sans or** (le pilote ralenti jusqu'à l'argent ou le bronze) ;
  - ces jours sont pris en descendant depuis le 27/10, **jamais collés à la série** (un jour sans course : la série reste de cinq jours) et jamais avant le 16/10 (premier niveau de Jump : un jour de Track seul compterait comme « journée parfaite »).
  - Les jours d'avant la bascule de la série elle-même prennent maintenant **l'or exactement** (avant : n'importe quelle médaille, donc parfois l'auteur — 15, 17 et 22/10).
- **Résultat** (testé, `portailDemo.test.ts`, bloc « Garage », six dates : 24/10, 27/10, 28/10, 30/10, 1/11 et 15/11/2026) : **Sparrow, Pelican, Weasel, Badger débloquées** ; Moray (7/10 jours), Roadster (7/14), pick-up (3 à 5/6 ors), muscle car (7/30), Dragonfly (0/1), monoplace (0/3) **en progression** ; série de 5 jours, médaille d'or du jour avant la bascule. Le test **échoue sur l'ancien code** (« expected ['civile','fourgon'] to deeply equal ['civile','fourgon','evolution','rallye'] » à la date du 30/10) ; les deux tests anciens du fichier sont inchangés et verts. Il tourne sur un serveur ordinaire : sur la recette (`garageOuvert`), l'écran montre les dix voitures ouvertes tant que le raccourci existe.
- **La recette et les aperçus seulement** : garde inchangée (`recetteSeedTarget`, joueur marqué `demo`, jamais créé par un serveur de production — test existant, vert). Aucun outil de test n'écrit dans la base de production.
- `seedPortailDemo` prend une option `sansJump` (les tests du Garage, bien plus rapides) ; `recette-seed.ts` imprime aussi les jours du Garage.

## 5. Les mentions légales

- Les deux pages (`apps/portail/mentions-legales/` qui fait foi, `legal/`) nomment : `cdj:track:garage` (la voiture, sa couleur, son motif, la couleur du motif, les voitures débloquées et vues) et `cdj:qualite` (le palier graphique choisi pour l'appareil, la date de la dernière mesure et son résultat). Date de mise à jour : 24 octobre 2026 dans les deux.
- Vérifié contre le code : `CLE_GARAGE` (`voiture/choix.ts` : `id`, `couleur`, `motif`, `teinteMotif`, `debloquees`, `vues`) et `QUALITE_KEY` (`qualite.ts` : palier, date, médiane, pixels, échecs, plafond). Le serveur ne garde rien de plus (README du lot 41 § 5) : aucune table, aucune durée ne change.
- `apps/portail/test/mentions.test.ts` : nouveau test (les deux clés lues dans le source du jeu, nommées en français et en anglais) ; parité des deux pages, constantes et tables : verts.
- **La phrase sur l'identifiant dans les journaux n'est pas touchée** (elle attend la retouche 32b).

## 6. La charte

`docs/plateforme/identite.md` : révision 10 en tête et, au § 9, le bloc **« Écart accepté : le Garage de Track n'a pas de voile à rayures »** (décision de Nathan du 23/10/2026, README du lot 41, § 2, point 4) : on voit la voiture ; l'étiquette, la barre et la fiche sont des plaques opaques posées sur la scène ; l'écart ne vaut que pour le Garage.

## Le job `zones` de la CI (rouge au premier push, corrigé)

Le nom de branche imposé à ce lot (`claude/plateforme-suites-track-2-…`) contient `track` : `scripts/zones-jeu.mjs` l'a pris pour une **PR de jeu Track** et a refusé les 18 fichiers de la plateforme (verdict `test` rouge, tout le reste vert). Correction, dans `scripts/zones-jeu.mjs` (zone de la plateforme) : **un morceau `plateforme` dans le nom de branche fait une PR de la plateforme**, même avec un nom de jeu ; l'étiquette `jeu:…` l'emporte toujours sur les deux. Testé (`zonesJeu.test.ts`) ; ce n'est pas un test affaibli : une branche de jeu sans le mot est gardée comme avant. À toi de dire si tu préfères une autre règle (renommer la branche, ou une étiquette `plateforme`).

## Deuxième rouge de la CI : le smoke juste après minuit (pas de ce lot)

Au deuxième push, `zones` était vert mais `api-image` et `deploy / deploy` (recette) échouaient sur **une seule vérification** de `npm run smoke` : « DailyJump : un autre jour est refusé » (`apps/api/scripts/smoke.ts`, ligne 189), les deux runs à **00 h 04 heure de Paris**. Cause : pendant la grâce de 10 minutes après minuit de Paris (`GRACE_MS`), le serveur accepte encore **hier** ; le smoke prend hier pour « un autre jour » et attend un 409. Le reste du smoke (Track, Salon, Garage non couvert, portail) était vert, et `e2e` n'a échoué que parce que les parts ont été annulées. Ce n'est ni le Garage ni la démo : le smoke est hors de ce lot (règle d'arrêt, cas 1) ; **je ne le corrige pas**, je relance une fois par ce commit. Si le rouge revient hors de cette fenêtre, il est à signaler. **Dette à proposer à Nathan** : un smoke qui évite ou attend la grâce (par exemple tester « avant-hier » au lieu d'hier).

## Vérifié / non vérifié

- **Vérifié en local** : `npm run typecheck` ; `npx vitest run --project sqlite` (tout : 207 fichiers, 3 012 tests verts avant la correction de `zones`) ; `apps/web/e2e/perf.spec.ts` sur Chromium (tests de poids, dont le nouveau test du Garage) après `npm run build` et `npm run build:node -w @cdj/api` ; `node scripts/budgets.mjs` ; le test du Garage de « Démo » rouge sur l'ancien code (voir § 4).
- **Non vérifié** : la CI complète de la PR (elle fait foi) ; libSQL (pas de `sqld` local) ; `npm run measure:budget` (le coût du Garage est une hypothèse chiffrée, § 3) ; l'aperçu à la main (ci-dessous) ; les 10 voitures de la recette, que `garageOuvert` ouvre de toute façon.
- **Décisions pour Nathan** : (1) `track.vieCiel` n'a plus que 8 o de marge ; (2) quand retirer le raccourci `garageOuvert` (les dix voitures pour « Démo »), puisque le vrai état est maintenant bon ; (3) rien d'autre : aucune donnée gardée de plus côté serveur.

## Aperçu de la PR

À remplir avec le lien commenté sur la PR. À tester : `/?demo=joueur`, puis Track, puis le Garage — sur la recette et les aperçus qui touchent le serveur, `garageOuvert` ouvre les dix voitures (raccourci du 24/10) ; la progression réelle (quatre débloquées, six en progression) se voit sur un serveur ordinaire et dans le test. `/mentions-legales/` et `/legal/` : les deux clés y sont nommées.
