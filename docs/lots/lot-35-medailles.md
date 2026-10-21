# Lot 35 — Track : des médailles calibrées sur de vrais joueurs

Retour des amis : tout le monde a la médaille d'auteur facilement. Le temps de l'auteur est celui du pilote automatique (lot 4 : auteur = temps du pilote, or ×1,08, argent ×1,20, bronze ×1,40), qui suit une trajectoire sûre et ne dérape pas : un joueur correct le bat. Objet : **l'auteur pour les meilleurs, l'or pour les bons, le bronze pour presque tous ceux qui finissent.**

Zones : `packages/sim/**`, `apps/web/**`, `apps/api/src/cdj.ts`, `apps/api/test/planning.test.ts`, `docs/lots/**`, la ligne de Track de `docs/plateforme/budgets.md`, l'exemption de `packages/ui/test/applications.ts`.

## État : étape 1 livrée, ⏸ point d'arrêt (export de production demandé à Nathan)

Nathan n'a pas encore collé les chiffres de production dans la session : comme prévu par le lot, **l'outil de calibrage est livré d'abord** (cette PR) ; le calibrage (facteurs, date de bascule, nouveaux seuils dans le HUD et l'arrivée) reprendra avec l'export.

### Ce qu'il faut à la reprise
1. La PR fusionnée, la recette puis la production mises à jour (bouton « Mettre en production ») : la route n'existe pas encore en production.
2. Sur `https://playdujour.com/track/admin/` : se connecter avec le jeton d'admin, section **« Médailles · calibrage »**, « Charger les médailles », puis **« Copier l'export (JSON) »** et coller le résultat dans la session.
3. Confirmer (ou corriger) les cibles : auteur ≈ 5–10 % des joueurs du jour, or ≈ 25–35 %, argent ≈ 50–60 %, bronze ≈ 85–90 % de ceux qui finissent.

## 1. L'outil de calibrage (lecture seule)

- **Route d'admin** `GET /api/admin/medailles` (`apps/api/src/cdj.ts`, `adminMedals`), sous le jeton d'admin comme le planning (mêmes refus : 401, 404 sans `ADMIN_TOKEN`, 429 après trop d'échecs ; 405 pour une autre méthode). Elle lit les tables `planning`, `circuits` et `results` (jointes à `players` pour exclure les pilotes fictifs, `players.demo = 1`, sauf `?demo=1` : la recette n'a qu'eux), du premier jour à aujourd'hui (au plus `MEDAILLES_JOURS` = 120 jours). Par jour : date, numéro, thème (celui du planning ou de la date), variante, identifiant du circuit, **temps du pilote** (la ligne de `circuits`, seulement si son identifiant est celui attendu), seuils en vigueur, **nombre de joueurs**, **percentiles 10/25/50/75/90 des meilleurs temps** (en ms et rapportés au pilote), **part cumulée des joueurs ayant chaque médaille** et comptes exacts, et `ratios` (les temps ÷ pilote, triés, sans identité : de quoi simuler n'importe quels facteurs sur les jours passés). Puis **par thème** et **tous jours réunis** (jours fermés seulement : aujourd'hui est encore ouvert) : percentiles des rapports au pilote, parts sur tous les joueurs et moyenne des parts journée par journée.
- **Aucune écriture** : la route ne génère ni ne garde aucun circuit (elle lit `circuits` ; un jour sans circuit gardé n'a pas de pilote), ne calcule aucune place, ne touche à rien ; la garde du jeton n'écrit qu'en cas d'échec (compteur de débit, comme les autres routes d'admin) et compte en mémoire l'adresse de connexion. Test : la base entière (toutes les tables) est identique avant et après l'appel (`apps/api/test/planning.test.ts`, SQLite et libSQL).
- **Statistiques pures** dans `packages/sim/src/medalStats.ts` (`percentileOf` au rang le plus proche, `medalDayStats`, `ratiosOf`, `medalPoolStats`, `thresholdsOf`), testées (`packages/sim/test/medalStats.test.ts`) ; elles serviront aussi à la simulation des nouveaux facteurs.
- **Page d'admin** : section « Médailles · calibrage (lot 35) » de `/admin/` (`apps/web/src/adminMedailles.ts`), même jeton que le planning ; deux tableaux (par thème, par jour), parts colorées selon les cibles (dans / au-dessus / en dessous), case « Compter les pilotes fictifs (recette) », bouton « Copier l'export (JSON) ». Refusée en démo (`?api=demo`). Outil interne en français (exempté du test des chaînes en dur comme le reste de l'admin). Tests : `apps/web/test/adminMedailles.test.ts`, e2e `apps/web/e2e/planning.spec.ts` (dernier test : démo refusée ; vrai serveur : tableaux remplis, une ligne par jour, planning et joueurs inchangés côté serveur).

## 2. Budget

La mesure de Track (`apps/web/e2e/perf.spec.ts`, `scripts/budgets.mjs`) compte **tout** le JS de `dist/assets`, donc aussi la page d'admin, que les joueurs ne chargent jamais. La section ajoute **+933 o** compressés (286 281 → 287 214 o ; le jeu ne change pas d'un octet) pour 131 o de marge. Premier jet ≈ 1,5 ko ; resserré en mettant en-têtes, légende et cibles dans le HTML (non compté). **Nathan a autorisé un relèvement de 1 000 o** (21/10/2026) : JS 275 000 → 276 000, hors three.js 142 300 → 143 300, JS + CSS 286 400 → 287 400 (`docs/plateforme/budgets.md`). Proposition de lot de plateforme : ne plus compter `admin-*.js` dans la mesure du premier chargement.

## 3. Calibrage — à faire avec l'export

Prévu : un temps de l'auteur plus exigeant que le temps brut du pilote (facteur global, et une correction par thème si les données la montrent), puis or / argent / bronze en facteurs de l'auteur, tous choisis sur les données (`medalPoolStats` sur les `ratios` de l'export) et écrits ici avec la répartition qu'ils auraient donnée sur chaque jour passé, comparée aux cibles ; un pilote plus rapide seulement si le gain est net et le coût de génération tenable. **Date de bascule** : le premier jour non figé à la mise en production ; les jours d'avant (et le jour en cours) gardent leurs médailles, points et journées parfaites. Les seuils deviendront une fonction du jour (et du thème) : `medalsFor` est appelé à une douzaine d'endroits (serveur, portail, profil, archives, admin) avec le seul temps de l'auteur, tous à passer par le jour.

## Vérifié / non vérifié

- Vérifié en local : `npm run typecheck` ; tests unitaires (`npm test`, voir la PR) ; `apps/api/test/planning.test.ts` (SQLite et libSQL) ; e2e `planning.spec.ts` sur Chromium (10/10) ; budgets remesurés (`node scripts/budgets.mjs`).
- CI de la PR verte (unitaires, e2e Chromium / Firefox / WebKit, zones, aperçu déployé).
- Non vérifié : la page sur l'aperçu à la main (il faut le jeton d'admin de la recette) ; aucun chiffre de production (c'est l'objet de l'export).
- Golden et classements des jours antérieurs : inchangés (aucun changement de `sim` hors du nouveau module, aucun changement des seuils).

## Liens

- PR : https://github.com/Nathan-Te/DailyTrack/pull/106 (CI verte au commit `593a227`).
- Aperçu (canal Firebase de la recette, 7 jours) : page d'admin https://playdujour-recette--pr-106-fkp6afxm.web.app/track/admin/ (section « Médailles », jeton d'admin de la recette, cocher « Compter les pilotes fictifs » : la recette n'a qu'eux) ; il parle à la révision étiquetée `b-claude-epic-cer-0q76up` du serveur de recette, qui porte la route.
- Un circuit d'après la bascule avec ses nouveaux seuils : à la reprise (étape 3).
