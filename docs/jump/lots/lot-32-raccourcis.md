# Lot 32 — Course du n° 1 sur l'accueil, aucun raccourci par point de passage (DailyJump)

Versions : `JUMP_SIM_VERSION` **14** · `JUMP_GENERATOR_VERSION` **26** (`…-g26`) · `MODULE_SIM_VERSION` 3 inchangée. Golden v3 à v13 **identiques au bit** (`dailyLevel(jour, thème, 13)` rend encore g25) ; `daily-golden-v14.json` et `replay-golden-v14.json` nouveaux (jour de référence : le 13/12/2026). Aucun jour public ni figé n'est touché (`figes:jump -- --verifier` à jour). Règles : `packages/jump-sim/CLAUDE.md` (« Points de passage sur leur palier (lot 32) ») et `apps/jump/CLAUDE.md`.

## Scénario en 2 clics
`<aperçu>` = le lien d'aperçu commenté sur la PR (en local : `npm run dev:jump`).
1. **Le raccourci ne marche plus** : `<aperçu>/jump/?seed=2026-11-27&accueil=0` — cette date avait, en g25, `chute-pics:3` au départ (le motif du n° 18 : couloir du haut jusqu'au puits du palier) ; en g26 le puits du palier est fermé à 6 rangées. Saute le premier puits, cours sur le haut du premier morceau jusqu'à l'aplomb du fanion 1 : **le fanion ne se lève pas** ; il se lève en se posant sur le palier. Reprise (R) sans fanion = « recommencer à zéro ».
2. **La course du n° 1 sur l'accueil** : `<aperçu>/jump/?api=demo` → en bas du bloc de classement, **« Voir la course du n° 1 »** à côté de « Tout le classement › » ; un clic lance la course (pause, ×2) et « Retour à l'accueil de Jump » ramène à l'accueil.

## Diagnostic du Jump n° 18
- **Date** : le **02/11/2026** (g21, sim v11, glace), niveau figé `apps/jump/public/levels/2026-11-02.json`. Le point 1/10 est celui du palier d'arrivée du premier morceau, **`chute-pics:4`** (un puits à pics sur la gauche, à droite le puits du palier).
- **Comment un point se validait** (lot 4) : le centre du personnage passe sa colonne vers la droite, **à n'importe quelle hauteur**, et le palier est une pièce **ouverte jusqu'en haut du plus haut des deux morceaux voisins** (ici 27 rangées).
- **Par où on l'atteignait** : *saut par le haut*, ni galerie ni cage. Le morceau commence par 4 rangées d'air ; le haut de son mur de droite est 2 rangées sous le départ. On saute le puits à pics (4 tuiles) depuis le départ, on court sur le mur, et on franchit la colonne 14 à 23 rangées de son sol (vérifié par un script de 6 lignes : fanion pris à t = 160 pas) ; puis mort ou reprise volontaire (lot 27) pour se retrouver au pied du puits. Les solutions enregistrées de `chute-pics` (le Diamant) passaient par là : 8 variantes sur 8 montent à la rangée 0–1,4 de la grille.
- **Même motif ailleurs dans ce niveau** : le solveur trouve aussi les points 8 (`cheminee-pics`, qui a une voie lente) et 9 (`iles-friables`) ; 7 des 10 points sont reliés par des cases libres (aucun joint légitime : sortie de la portion fermée).
- **Sur 120 dates de g25** (du 16/10/2026 au 12/02/2027, `npm run raccourcis:jump -- --version=13`, appuis humains, faisceau 250, 700 pas) : **1 114 points de passage, 825 reliés au point d'avant par des cases libres (74 %), 465 atteignables par le solveur (42 %)** sans entrer par la fin de la portion (côté gauche du palier, au ras du sol) ni par la cage de sa voie lente. Toutes ne sont pas des contournements complets : beaucoup traversent la portion puis rejoignent le puits par le haut d'une colonne libre (défaut du même genre, plus bénin). **Sur 120 dates de g26 : 0 relié, donc 0 atteignable** (`test/passages.test.ts`).

## Ce qui change
1. **Validation sur le palier (v14)** : le personnage vivant est dans la zone — centre dans les 2 colonnes du palier, pieds à au plus 3 rangées au-dessus du sol — à la fin d'un pas. Traversé 8 rangées au-dessus : pas de fanion ; posé en tombant du puits : fanion. **Les alternés ne sont plus remis à A en prenant un point** (retour de Nathan sur le seed du 27/11) : la parité ne change que par un saut ; la preuve de l'auteur doit donc arriver en A à chaque morceau à alternés (`Level.altKeep` dans la chaîne des solutions) — les jours de néon demandent plus de tirages.
2. **Règle « aucun raccourci par point de passage » (g26)** : propagation case par case depuis le point d'avant (ou le départ), la fin de la portion (6 rangées au ras du sol) et la cage de la voie lente fermées : la zone ne doit pas être atteinte. Confirmée par le solveur dans `tools/raccourcis.ts` et les tests (le n° 18 : trouvé en 2,4 s).
3. **Corrections d'assemblage** (au lieu de refuser au cas par cas) : le **puits d'un palier de raccord est fermé à 6 rangées** (« plafond trop haut au-dessus d'un palier ») ; la **descente d'une voie lente** (« palier sous une descente ») est creusée jusque-là, murée du côté où le morceau voisin fuit (une seule colonne, le script de la voie prend l'autre) ; refus si les deux côtés fuient. Ces contrôles se font **avant la preuve**.
4. **Sel de g26** `0x6a6f759a` choisi par mesure (voir les décisions).

## Mesures (120 dates, sauf mention ; g25 reconstruit sur la même machine)
| mesure | g25 | g26 |
|---|---|---|
| niveau de secours (365 dates) | 0 | **0** |
| W = 3 · W = 4 retours trop tôt (365 dates) | 0 · 0 | **0 · 0** |
| tirages validés / composés | 24,9 % | 9,8 % |
| tirage retenu : moyenne · max | 5,7 · 51 | 15,0 · 139 |
| génération d'un niveau, tous tirages : moy. · max | 146 · 768 ms | 123 · 1 038 ms |
| génération à froid, 48 dates : moy. · max | 0,34 · 0,94 s | **0,39 · 0,95 s** (< 1,5 s) |
| temps de l'auteur : min · moy. · max | 28,02 · 29,56 · 32,02 s | 28,00 · 29,46 · 31,71 s |
| plus longue course au sol sans saut : moy. · max | 1,24 · 1,98 s | 1,20 · 1,99 s |
| exigence par minute : min · moy. · max | 425 · 488 · 559 | 425 · 488 · 553 |
| morceaux · hauteur (moyennes) | 10,3 · 51,8 | 10,2 · 51,6 |
| voies lentes par niveau : moy. · max | 2,1 · 6 | 2,0 · 5 |
| mural · scie par niveau (jours avec) | 2,59 · 2,61 (120/120) | 2,60 · 2,64 (120/120) |
Budget Jump (`scripts/budgets.mjs`) : **381 841 → 383 230 o** (+1 389 : ≈ +130 le bouton de l'accueil, ≈ +1 260 la v14 et g26). Plafond **382 590 → 383 966 proposé** (`budgets.md`, `poids.spec.ts` : mesure 383 894).

## Décisions à confirmer (Nathan)
- **Budget** : +1 376 o de plafond (ci-dessus) — le générateur est à la demande mais `mesureJump` compte tout le JS.
- **Catalogue** : `chute-pics` v0, v2 et v4 (celle du n° 18), `monte-charge` et `paroi-friable` en partie n'ont plus de solution honnête avec les puits fermés (leur solution enregistrée passait par le haut) ; elles ne sont plus posées en g26. Leur donner une vraie solution (paliers fermés dans `buildModule`, `solve:modules --force`, `phases`, `etats`, `voies`, ≈ 2 h) est un lot de catalogue.
- **Sel** : g26 a un taux de dates sans tirage valide de ≈ 0,5 % avec un sel arbitraire (1 à 3 dates sur 365 ; g25 : 0) — le catalogue effectif s'est réduit. Le sel retenu donne 0 sur 365 dates mais un lot qui touche les règles ou les morceaux devra re-mesurer (et peut changer de sel). Les dates au-delà du 26/10/2027 ne sont pas mesurées : le secours (`FALLBACK_V14`) est valide.
- **Les portes** (scie qui barre un puits, lot 31) et le carnage/fantôme qui datent un point par sa colonne : inchangés.
- Chiffres « avant » : le solveur est heuristique (faisceau 250, 700 pas) ; un « non » n'est pas une preuve (il sous-estime), mais l'« après » est prouvé par la propagation (aucune case libre).

## Vérifié, non vérifié
**Vérifié** : suite sqlite de `jump-sim`, `apps/jump`, `packages/core`, tests d'API de Jump, portail et `packages/ui`, `typecheck`, construction, `budgets`, `traductions` ; e2e `classement` (8 tests, bouton de l'accueil : présent avec classé, absent sans serveur, lance la course, retour à l'accueil) et `poids` en local. **Non vérifié** : libSQL, e2e complets, Firefox et WebKit, manette réelle (la CI).
