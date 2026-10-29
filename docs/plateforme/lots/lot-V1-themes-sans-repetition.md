# Lot V1 — jamais deux jours de suite le même thème (plateforme, les deux générateurs)

PR brouillon [#191](https://github.com/Nathan-Te/DailyTrack/pull/191). **Pour les joueurs** : `[Du Jour] Le thème change chaque jour, dans les deux jeux. // The theme changes every day, in both games.`

## La règle (écrite une fois : `packages/core/src/sacThemes.ts`, testée dans `packages/core/test/sacThemes.test.ts`)
- **Sac mélangé** : cycles de n jours alignés sur le numéro de jour (Track n = 8, Jump n = 5 ; aucune date), chaque thème une fois par cycle, ordre tiré de la graine ; **jonction de cycles** : le dernier thème ne revient pas avant le 3ᵉ jour, l'avant-dernier pas le 1ᵉʳ (0 répétition, 0 A B A) ; écart ≤ 2n − 1. Calcul direct (3 cycles).
- **Jonction avec le dernier jour figé** : un jour est « ancien » si le registre (Track, `jours-track.json`) ou le fichier de niveau figé (Jump, `generatorVersion` < 23) le dit ; le **premier jour du sac** évite le thème de la veille et de l'avant-veille, le deuxième celui de l'avant-veille (seuls ces deux jours sont remplacés). Les jours anciens gardent l'ancienne règle (`themeAncien`, `jumpThemeAncien`).
- Jump : la simulation est pure, chaque lieu déclare les jours figés d'avant (`declareOldFrozenDays` : le jeu, le serveur) ; liste écrite à la construction, qui ne grossit plus. Un nouveau thème s'ajoute au sac, la règle ne change pas (`docs/orchestration.md` § 4).

## Versions
Track `GENERATOR_VERSION` 19 → **20** (`SIM_VERSION` 14), budget de tentatives 120 pour la v20 (40 avant : un jour, Banquise le 02/12/2026, épuisait 40 tentatives ; il aboutit à la 51ᵉ). Jump `JUMP_GENERATOR_VERSION` 22 → **23** (`JUMP_SIM_VERSION` 12 : niveaux g22 rejoués tels quels). Anciennes versions gardées. Démonstrations régénérées (`history:seed`, `jump:seed`).

## Mesures (`npm run mesure:themes`, `-- --niveaux` pour la validité) — répétitions / A B A / écart max
| | Track | Jump |
|---|---|---|
| avant, 60 prochains jours (dès 30/10) | 6 / 4 / 21 | 0 / 17 / 15 |
| avant, jours déjà servis (Track 58, Jump 13) | 11 / 6 / 28 | 0 / 2 / 7 |
| avant, 365 jours | 43 / 40 / 35 | 0 / 97 / 23 |
| **après**, 365 jours depuis une bascule fictive (10/11) | **0 / 0 / 15** | **0 / 0 / 9** |
| après, pire cas des 3n positions de la bascule | 0 / 0 / 15 | 0 / 0 / 9 |
| après, jours déjà servis | inchangés | inchangés |
Validité des 365 niveaux : Track 365/365 circuits validés par le pilote, Jump 365/365 preuves de l'auteur qui arrivent, 0 secours, 0 règle enfreinte.
## Les 30 prochains jours (avant → après, code en vigueur : registre / niveaux figés ; bascule en 10-29 sur l'aperçu)
| date | Track avant | Track après | Jump avant | Jump après |
|---|---|---|---|---|
| 10-30 | campagne | banquise | neon | usine |
| 10-31 | canyon | rallye | nuit | glace |
| 11-01 | campagne | canyon | foret | nuit |
| 11-02 | banquise | ville | glace | neon |
| 11-03 | ville | stade | foret | foret |
| 11-04 | campagne | rallye | neon | nuit |
| 11-05 | banquise | ville | glace | neon |
| 11-06 | col | col | usine | usine |
| 11-07 | col | banquise | neon | glace |
| 11-08 | ville | campagne | foret | foret |
| 11-09 | ville | canyon | nuit | nuit |
| 11-10 | stade | nuit | neon | usine |
| 11-11 | stade | stade | foret | glace |
| 11-12 | ville | canyon | glace | neon |
| 11-13 | rallye | nuit | foret | nuit |
| 11-14 | banquise | rallye | neon | usine |
| 11-15 | campagne | banquise | foret | neon |
| 11-16 | canyon | col | glace | foret |
| 11-17 | banquise | ville | usine | glace |
| 11-18 | stade | campagne | neon | usine |
| 11-19 | canyon | stade | foret | nuit |
| 11-20 | canyon | banquise | glace | glace |
| 11-21 | campagne | canyon | foret | foret |
| 11-22 | banquise | ville | glace | neon |
| 11-23 | rallye | nuit | usine | usine |
| 11-24 | campagne | rallye | nuit | glace |
| 11-25 | canyon | campagne | foret | foret |
| 11-26 | stade | col | neon | nuit |
| 11-27 | col | nuit | nuit | neon |
| 11-28 | stade | ville | foret | glace |

## Vérifié / non vérifié
- **Jours servis inchangés** : 58 jours de Track (01/09→28/10) et 13 niveaux figés de Jump comparés à `main` (6791d73) : **0 différence** (id, thème, empreinte, temps, médailles) ; `jours-passes.test.ts` vert ; golden des anciennes versions inchangés (seuls les vecteurs de la dernière version, 17/12/2026 ajouté pour avoir les 8 thèmes, et `*-v12` de Jump sont régénérés). Le garde-fou de R6 lui-même (workflow) **n'a pas été lancé** (réservé à Nathan) ; simulation d'une mise en production : registre à g19 jusqu'au 03/11 → 04/11 change de thème sans répéter la veille.
- **CI de PR verte** ([run 40904646237](https://github.com/Nathan-Te/DailyTrack/actions/runs/40904646237), après deux rouges réparés : smoke et e2e de Jump qui lisaient l'ancien thème). Tests unitaires complets en local verts ; en CI un test de coût (`api.test.ts`, 195 ms pour 150) a expiré sous charge une fois (34 ms en local, avant comme après). Les 2 specs `@regression` et Firefox / WebKit **non lancés** (CI complète de `main`).
- **À décider (Nathan)** : budget Track **+392 o** (marge 497 → 105 o), fil du Salon **marge 9 o**, plafonds non relevés ; limite du pire jour de génération 3 500 → **4 500 ms** (la Banquise du 02/12/2026 demande 51 tentatives : 1 496 → 2 206 ms en local, 3 605 en CI).
