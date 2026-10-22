# Lot 35 — Track : des médailles calibrées sur de vrais joueurs

Retour des amis : tout le monde a la médaille d'auteur facilement. Le temps de l'auteur est celui du pilote automatique (lot 4 : auteur = temps du pilote, or ×1,08, argent ×1,20, bronze ×1,40), qui suit une trajectoire sûre et ne dérape pas : un joueur correct le bat. Objet : **l'auteur pour les meilleurs, l'or pour les bons, le bronze pour presque tous ceux qui finissent.**

Zones : `packages/sim/**`, `apps/web/**`, `apps/api/src/cdj.ts`, `apps/api/test/planning.test.ts`, `docs/lots/**`, la ligne de Track de `docs/plateforme/budgets.md`, l'exemption de `packages/ui/test/applications.ts`.

## État : étape 1 (outil, PR #106, en production le 22/10/2026) et étape 2 (calibrage, cette PR)

L'outil a été livré d'abord (point d'arrêt du lot), mis en production, et Nathan a collé l'export de production du **22/10/2026** dans la session. Le calibrage s'appuie sur ces chiffres.

## 1. L'outil de calibrage (lecture seule)

- **Route d'admin** `GET /api/admin/medailles` (`apps/api/src/cdj.ts`, `adminMedals`), sous le jeton d'admin comme le planning (mêmes refus : 401, 404 sans `ADMIN_TOKEN`, 429 après trop d'échecs ; 405 pour une autre méthode). Elle lit les tables `planning`, `circuits` et `results` (jointes à `players` pour exclure les pilotes fictifs, `players.demo = 1`, sauf `?demo=1` : la recette n'a qu'eux), du premier jour à aujourd'hui (au plus `MEDAILLES_JOURS` = 120 jours). Par jour : date, numéro, thème (celui du planning ou de la date), variante, identifiant du circuit, **temps du pilote** (la ligne de `circuits`, seulement si son identifiant est celui attendu), seuils en vigueur, **nombre de joueurs**, **percentiles 10/25/50/75/90 des meilleurs temps** (en ms et rapportés au pilote), **part cumulée des joueurs ayant chaque médaille** et comptes exacts, et `ratios` (les temps ÷ pilote, triés, sans identité : de quoi simuler n'importe quels facteurs sur les jours passés). Puis **par thème** et **tous jours réunis** (jours fermés seulement : aujourd'hui est encore ouvert) : percentiles des rapports au pilote, parts sur tous les joueurs et moyenne des parts journée par journée.
- **Aucune écriture** : la route ne génère ni ne garde aucun circuit (elle lit `circuits` ; un jour sans circuit gardé n'a pas de pilote), ne calcule aucune place, ne touche à rien ; la garde du jeton n'écrit qu'en cas d'échec (compteur de débit, comme les autres routes d'admin) et compte en mémoire l'adresse de connexion. Test : la base entière (toutes les tables) est identique avant et après l'appel (`apps/api/test/planning.test.ts`, SQLite et libSQL).
- **Statistiques pures** dans `packages/sim/src/medalStats.ts` (`percentileOf` au rang le plus proche, `medalDayStats`, `ratiosOf`, `medalPoolStats`, `thresholdsOf`), testées (`packages/sim/test/medalStats.test.ts`) ; elles serviront aussi à la simulation des nouveaux facteurs.
- **Page d'admin** : section « Médailles · calibrage (lot 35) » de `/admin/` (`apps/web/src/adminMedailles.ts`), même jeton que le planning ; deux tableaux (par thème, par jour), parts colorées selon les cibles (dans / au-dessus / en dessous), case « Compter les pilotes fictifs (recette) », bouton « Copier l'export (JSON) ». Refusée en démo (`?api=demo`). Outil interne en français (exempté du test des chaînes en dur comme le reste de l'admin). Tests : `apps/web/test/adminMedailles.test.ts`, e2e `apps/web/e2e/planning.spec.ts` (dernier test : démo refusée ; vrai serveur : tableaux remplis, une ligne par jour, planning et joueurs inchangés côté serveur).

## 2. Budget

La mesure de Track (`apps/web/e2e/perf.spec.ts`, `scripts/budgets.mjs`) compte **tout** le JS de `dist/assets`, donc aussi la page d'admin, que les joueurs ne chargent jamais. La section ajoute **+933 o** compressés (286 281 → 287 214 o ; le jeu ne change pas d'un octet) pour 131 o de marge. Premier jet ≈ 1,5 ko ; resserré en mettant en-têtes, légende et cibles dans le HTML (non compté). **Nathan a autorisé un relèvement de 1 000 o** (21/10/2026) : JS 275 000 → 276 000, hors three.js 142 300 → 143 300, JS + CSS 286 400 → 287 400 (`docs/plateforme/budgets.md`). Proposition de lot de plateforme : ne plus compter `admin-*.js` dans la mesure du premier chargement. **Étape 2** : les seuils datés entrent dans le générateur du premier chargement : **+61 o** (287 214 → 287 275 o, marge 125 o).

## 3. Données utilisées

Export de `GET /api/admin/medailles` en production, 22/10/2026 (pilotes fictifs exclus ; il n'y en a pas en production) : **9 jours fermés (13/10 au 21/10), 38 meilleurs temps** (2 à 7 joueurs par jour), aujourd'hui (22/10) sans joueur. Thèmes : Rallye 3 jours, Nuit 3, Col alpin 2, Ville 1.

- **Avec les seuils du lot 4, 37 temps sur 38 ont l'auteur (97 %)**, le 38ᵉ l'or : le retour des amis est confirmé.
- Temps des joueurs ÷ temps du pilote, tous jours réunis : **P10 0,844 · P25 0,875 · P50 0,897 · P75 0,919 · P90 0,961** ; le plus lent 1,041. Un joueur bat le pilote d'environ 10 % en médiane.
- Le meilleur de chaque jour, rapporté au pilote : de **0,838** (16/10, Ville) à **0,958** (14/10, Nuit). L'écart d'un jour à l'autre (le pilote est plus ou moins bon selon le circuit) domine l'écart entre thèmes.

## 4. Facteurs retenus

- **Temps de l'auteur = 0,84 × le temps du pilote** (`MEDAL_FACTORS_35.author`), puis **or ×1,045, argent ×1,07, bronze ×1,13 du temps de l'auteur** (`MEDAL_FACTORS_35`, `packages/sim/src/generator.ts`). En multiples du pilote : auteur 0,840, or 0,878, argent 0,899, bronze 0,949.
- **Choix** : grille de facteurs (auteur 0,83 à 0,90 ; or, argent, bronze en multiples de l'auteur), simulée sur les `ratios` de l'export (`medalPoolStats`, `packages/sim/src/medalStats.ts`), en minimisant l'écart au milieu des cibles sur deux mesures : tous joueurs réunis, et moyenne journée par journée. Bronze : 1,12 à 1,14 donnent la même répartition sur ces données ; 1,13 est au milieu.
- **Pas de correction par thème** : 1 à 3 jours par thème, et les trois jours de Nuit vont de 0,875 à 0,958. Une correction serait de l'ajustement au bruit. À revoir quand l'outil aura quelques semaines de données (il reste en place, en lecture seule).
- **Pas de pilote plus rapide** : le pilote ne dérape pas et suit une trajectoire sûre ; un pilote qui dérape changerait le générateur (validation, durées, golden) pour un gain non mesuré. Le temps de l'auteur plus exigeant obtient l'effet voulu sans toucher au générateur (lot 34 hors périmètre). Piste ouverte, voir § 6.
- **Le temps du pilote ne change pas** : `authorMs` des circuits, le golden, la table `circuits`, les identifiants, les classements, rien ne bouge. Seuls les **seuils** se calculent autrement, à partir de la date.

### Répartition simulée sur les jours passés (parts cumulées : « or » compte aussi l'auteur)

| | Auteur | Or | Argent | Bronze |
|---|---|---|---|---|
| Cibles | 5–10 % | 25–35 % | 50–60 % | 85–90 % |
| **Tous joueurs réunis (38)** | **5 %** | **32 %** | **61 %** | **87 %** |
| **Moyenne des 9 journées** | **7 %** | **30 %** | **56 %** | **86 %** |
| Seuils du lot 4 (rappel) | 97 % | 100 % | 100 % | 100 % |

| Jour | Thème | Joueurs | Meilleur ÷ pilote | Auteur | Or | Argent | Bronze |
|---|---|---|---|---|---|---|---|
| 2026-10-21 | Rallye | 6 | 0,909 | 0 % | 0 % | 0 % | 100 % |
| 2026-10-20 | Nuit | 4 | 0,875 | 0 % | 25 % | 100 % | 100 % |
| 2026-10-19 | Nuit | 7 | 0,892 | 0 % | 0 % | 71 % | 86 % |
| 2026-10-18 | Rallye | 2 | 0,897 | 0 % | 0 % | 50 % | 100 % |
| 2026-10-17 | Col alpin | 2 | 0,932 | 0 % | 0 % | 0 % | 100 % |
| 2026-10-16 | Ville | 3 | 0,838 | 67 % | 100 % | 100 % | 100 % |
| 2026-10-15 | Col alpin | 4 | 0,866 | 0 % | 75 % | 100 % | 100 % |
| 2026-10-14 | Nuit | 3 | 0,958 | 0 % | 0 % | 0 % | 0 % |
| 2026-10-13 | Rallye | 7 | 0,844 | 0 % | 71 % | 86 % | 86 % |

**Ce que montre ce tableau** : en moyenne les cibles sont tenues, mais **d'un jour à l'autre la répartition varie beaucoup**. Deux jours n'ont personne en or ou au-dessus. Le 14/10, personne n'aurait eu le bronze, parce que le pilote y était particulièrement bon. Un facteur unique ne peut pas corriger un pilote inégal selon les circuits ; seul un pilote plus régulier, ou des seuils tirés des joueurs du jour, le ferait. Décision pour Nathan (§ 6).

## 5. Date de bascule et application

- **`BASCULE_LOT_35` = 28/10/2026** (`generator.ts`) : le premier jour qui ne sera ni joué ni en cours à la mise en production de ce lot, et la même date que la bascule du lot 34 (une seule date à retenir). **Les jours d'avant, aujourd'hui compris, gardent leurs médailles** : classements, profils, archives, points du portail et journées parfaites ne changent pas. **Si la mise en production arrive après le 27/10**, déplacer cette constante au lendemain du jour de la mise en production (rien n'est figé : les seuils se recalculent depuis le temps du pilote).
- **`medalsFor(tempsDuPilote, jour)`** : avant la bascule (ou sans jour), les seuils du lot 4 ; à partir de la bascule, ceux du lot 35. Tous les appels de Track passent le jour : circuit du jour et variantes (`generateCircuit`, `dailyCircuit` : le jeu en tire `daily.medals`, donc **l'objectif de médaille du HUD et l'autocollant de l'arrivée affichent les nouveaux seuils sans autre changement**), Salon (graine de la session, au-delà de tous les jours : nouveaux seuils), serveur (`cdj.ts` : envoi, classement, `/api/me`, crochet du portail `jour` / `etat` / `classes`, outil de calibrage), archives (`archive.ts`), planning de l'admin, `history:seed`.
- **Hors zone, signalé** : `apps/api/src/portailDemo.ts` (joueur de démonstration du portail, **recette seulement**) appelle encore `medalsFor(authorMs)` sans jour : après le 28/10, la médaille de ce joueur fictif suivra les anciens seuils. Correction d'une ligne (`medalsFor(circuit.authorMs, day)`), à faire dans un lot de plateforme.
- Admin : la ligne « Temps de l'auteur » des cartes du planning devient **« Temps du pilote »** (c'est le temps brut ; la ligne « 🏅 auteur … » donne les seuils du jour) ; la légende de la section « Médailles » donne les deux jeux de facteurs ; la route rend `factors35` et `bascule`.

## 6. Décisions laissées à Nathan

1. **Confirmer les cibles et les facteurs.** Ils sont choisis sur 38 temps, sans doute de joueurs assidus (les amis). Avec plus de joueurs occasionnels, le bronze (0,949 du pilote) sera plus dur à tenir : **rouler aussi vite que le pilote ne rapporte plus aucune médaille**. Si c'est trop dur, relever le bronze (×1,19 ≈ le temps du pilote) ne change que la dernière colonne.
2. **L'inégalité d'un jour à l'autre** (§ 4) : l'accepter, ou ouvrir un lot « pilote plus régulier » (mesure : `npm run measure:generator`), ou des seuils tirés des joueurs de la veille (ce qui change la nature des médailles).
3. **Recalibrer dans 3 à 4 semaines** avec l'outil (export de la section « Médailles »), quand chaque thème aura au moins 5 jours.

## Vérifié / non vérifié

- Vérifié en local : `npm run typecheck`, `npm test` en entier ; tests ajoutés : `packages/sim/test/medaillesLot35.test.ts` (seuils d'avant inchangés jusqu'au 27/10 compris, nouveaux à partir du 28/10, circuit du jour et Salon), `apps/api/test/planning.test.ts` (le temps du pilote : auteur le 27/10, aucune médaille le 28/10 ; envoi, classement, `/api/me`, portail, outil — SQLite et libSQL) ; e2e `planning.spec.ts` et `perf.spec.ts` (Chromium) ; golden inchangé (`golden-daily.test.ts` vert sans régénération) ; budgets remesurés.
- e2e Chromium passés en local : `planning`, `perf`, `share`, `leaderboard`, `demo`, `daily` (39/39).
- **Échec hors zone, signalé (règle d'arrêt)** : `apps/api/test/jumpHistory.test.ts` (3 tests, « relancer npm run jump:seed » : `expected 'jour-2026-10-23-g10' to be 'jour-2026-10-23-g9'`) échoue **aussi sur `main` sans ce lot** (run 39735541285 du 22/10) : le jeu de données de démonstration de DailyJump n'a pas été régénéré après son générateur g10. Zone Jump : non corrigé ici.
- Non vérifié : un circuit d'après la bascule sur l'aperçu (lien ci-dessous ; ouvrir `?seed=2026-10-28` : l'objectif de médaille du HUD donne l'auteur à 0,84 du pilote) ; la répartition réelle après le 28/10 (à relire avec l'outil).

## Liens

- PR : https://github.com/Nathan-Te/DailyTrack/pull/106 (CI verte au commit `593a227`).
- Aperçu (canal Firebase de la recette, 7 jours) : page d'admin https://playdujour-recette--pr-106-fkp6afxm.web.app/track/admin/ (section « Médailles », jeton d'admin de la recette, cocher « Compter les pilotes fictifs » : la recette n'a qu'eux) ; il parle à la révision étiquetée `b-claude-epic-cer-0q76up` du serveur de recette, qui porte la route.
- Un circuit d'après la bascule avec ses nouveaux seuils : à la reprise (étape 3).
