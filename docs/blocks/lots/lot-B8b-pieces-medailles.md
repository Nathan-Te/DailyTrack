# Lot B8b — Blocks : une suite variée et des médailles à l'échelle humaine

Branche `claude/blocks-seed-docs-e8rza1`, PR brouillon `jeu:blocks` (le morceau « blocks » du nom de branche). Seed § 4 et 5 (Nathan, 7 nov. 2026, **non modifié ici**). Règles en vigueur : `apps/blocks/CLAUDE.md`.

## Ce qui est fait
- **Tirage v5** : le calibrage des poids du lot B8 (66 % de dominos au début) est **annulé**. Les poids repartent d'un catalogue de 40 pièces à poids proches (domino 15, barres 16 / 12 / 7, carrés 10 / 7, coins 14, L et J 7, grands L et T 7, T 7, S et Z 7, rectangles 8, par orientation) ; rampe **pente 1, rang maximal 80** (80 séries = 240 pièces).
- **Règles de série, dans le tirage** (`poidsDeSerie`) : au plus un domino ; jamais deux fois la même pièce ; au moins une pièce de 4 cases ou plus (la dernière pièce y est forcée) ; au plus une boîte 3 × 3 ; pas de très grosse pièce dans les 2 premières séries.
- **Plus aucune cible de survie** ne pilote les poids : seule la répartition des pièces les règle (`npm run mesure:repartition`, outil nouveau).
- **Médailles = constantes** (`SEUILS_MEDAILLES`) : le score d'un bot de référence **arrêté après un nombre fixe de pièces**, médiane sur 1 000 jours, arrondie (50 près sous 1 000, 100 près jusqu'à 5 000, 500 près au-delà, au plus proche). Les mêmes tous les jours. **Plus aucun bot n'est appelé** par le serveur ni par le jeu pour servir les seuils (`seuilsDuJour` : ceux du fichier de jour s'il y en a un, sinon les constantes).
- **Bot v4** : le Diamant **ne lit plus la série suivante** (il la lisait en fin de recherche, un avantage qu'un joueur n'a pas ; le bot moyen ne la lisait pas). Le test `diamant.test.ts` (« ne voit jamais les séries à venir ») change toutes les pièces d'après la série en cours sur 10 jours × 70 séries : il échoue avec l'ancien code (série 59 du jour 20768) et passe avec le nouveau. `jouerDiamant` et `jouerGlouton` prennent `jusqua` (arrêt après N pièces, `raison` « arret »). `&bot` et la rediffusion du Diamant **s'arrêtent à 210 pièces** (`PIECES_DU_DIAMANT`), comme son seuil ; la partie est alors donnée pour finie, l'écran de fin donne le score du moment.
- Fiche : `medailles.bareme` passe à 43 / 19 / 10 (indication seulement) ; `npm run fiches` régénéré.

## Répartition des pièces, mesurée (1 000 jours à partir du 2026-11-02)
| Famille | Début (séries 0 à 10) | Cible | Plafond (séries 80 à 99) | Cible |
|---|---|---|---|---|
| Dominos | 8,1 % | 6 à 9 | 4,8 % | 3 à 6 |
| Pièces de 3 cases | 24,7 % | 20 à 25 | 14,8 % | 12 à 18 |
| Pièces de 4 cases | 45,3 % | 40 à 50 | 44,5 % | 35 à 45 |
| Pièces de 5 cases ou plus | 21,9 % | 15 à 22 | 35,9 % | 30 à 40 |
Même mesure sur deux autres années (2028-01-01, 2029-05-05) : tout dans les fourchettes (4 cases au plafond 44,6 %). Entorses aux règles de série : **0** sur 1 000 jours. Marges minces (3 cases au début, 4 cases au plafond) : la contrainte « au moins une pièce de 4 cases » pousse les 4 cases vers le haut du début ; les fourchettes se tiennent, sans plus.

## Médailles, mesurées (`npm run calibrer:medailles`, 1 000 jours ; **bot sans regard sur la série suivante**)
Le point de départ du prompt (moyen 45 et 90, fort 150 et 240) **a été ajusté par la mesure**, comme il le permettait : avec lui, bronze 900 / argent 1 600 / or 8 000 / Diamant 13 000, soit **or / argent = 5**. Cause : le bot moyen meurt vers 100 pièces (sa médiane plafonne à 1 613), il ne peut pas porter l'argent à 90 pièces. Retenu :
| Médaille | Bot, arrêté après | Score : Q1 · médiane · Q3 | Mort avant | Seuil retenu |
|---|---|---|---|---|
| Bronze | moyen, 54 pièces | 771 · 1 133 · 1 480 | 41 % | **1 100** |
| Argent | fort, 60 pièces | 1 666 · 2 168 · 2 883 | 4,8 % | **2 200** |
| Or | fort, 105 pièces | 3 816 · 4 887 · 6 641 | 15,5 % | **4 900** |
| Diamant | fort, 210 pièces | 7 266 · 11 433 · 15 654 | 48 % |
Avec le regard sur la série suivante (bot v3, retiré), les médianes étaient 2 168 · 4 921 · 11 573 : **les quatre seuils arrondis ne changent pas** (1 100 · 2 200 · 4 900 · 11 500), le coup d'œil valait peu. **11 500** |
- **Rapports** : argent / bronze **2,0**, or / argent **2,23**, Diamant / or **2,35** (cible 1,5 à 2,5 : tenue). Le Diamant à 240 pièces (12 921) donnait 2,64 sur l'or retenu : c'est pourquoi il s'arrête à 210.
- **Variation d'un jour à l'autre : forte** (dite, sans changer de méthode) : la part des jours **hors de ±25 % de la médiane** est de 57 % (bronze), 53 % (argent), 53 % (or), 64 % (Diamant) ; Q1 et Q3 valent 0,64 à 0,78 et 1,31 à 1,37 fois la médiane. D'où des seuils constants plutôt que par jour.
- **Bot moyen à 30 pièces** (une première partie hésitante) : médiane **505**, sous le bronze (0,46 ×) ; 0,9 % des jours au-dessus.
- **Le bot fort joué sans arrêt dépasse le Diamant 60,2 % des jours — la cible « presque toujours » n'est pas tenue.** Il meurt avant 210 pièces un jour sur deux (médiane 215 pièces, 72 séries) : la suite variée est nettement plus dure que celle du lot B8 (324 séries). Le Diamant étant une médiane, il ne peut être « presque toujours » dépassé que si le tirage est plus doux ou le Diamant plus bas (un quantile bas plutôt que la médiane) : **décision de Nathan**, rien n'est forcé.
- **Partie attentive de Nathan (2 230 points, anciennes règles de tirage)** : elle tombe **sur l'argent (2 200)** ; indicatif seulement, la suite a changé.
- Pour information (`mesure:rampe`, ce ne sont plus des cibles) : médiane de survie en séries, bot faible 9, moyen 21, Diamant 72 ; plafond de pièces atteint 0 jour sur 1 000. Diamant arrêté à 210 pièces : une vingtaine de ms par jour.

## Tests
- **Remplacés** (le prompt le demandait) : les cibles de survie du lot B8 de `calibrage.test.ts` (faible ≥ 40 séries, moyen 80 à 150, Diamant au plafond < 5 %, score médian = références), la mesure des seuils par jour de `medailles.test.ts` et d'`apps/api/test/blocks.test.ts` (« calcule les seuils vite »), `seuilsDepuis` et `REFERENCES_MEDAILLES` (supprimés). Ni désactivés ni relâchés : ils testaient ce qui n'existe plus ; les nouveaux contrôlent la répartition, les règles de série, les constantes, les rapports et la proximité de chaque seuil avec sa mesure.
- **Ajustés (non affaiblis)** : `regles.test.ts` (poids du grand T 2 → 7, c'est une donnée du tirage) ; `partie.spec.ts` (la pose « encore l'emplacement vide » visait l'emplacement 0 ; elle vise celui de la première pose du bot, qui change avec la suite) ; `bot-themes.spec.ts` et `partage.spec.ts` (le bot s'arrête à 210 pièces ; le seuil est une constante).
- **Nouveaux** : `suite.test.ts` (règles de série sur 1 000 graines × 120 séries ; répartition au début et au plafond dans les fourchettes ; la rampe fait monter les 5 cases et plus), `medailles.test.ts` (constantes, arrondis, rapports 1,5 à 2,5, chaque seuil à 20 % de sa mesure sur 60 jours, nombres de pièces = séries entières, un bot arrêté joue le même début), `calibrage.test.ts`, golden (scores des bots arrêtés sur 10 jours).
- Golden régénéré (`golden:blocks`) avec les versions montées : tirage 5, bot 4.

## Vérifié, non vérifié
- **Vérifié** : typecheck ; tests de `packages/blocks-sim`, `apps/blocks`, `apps/api/test/blocks.test.ts` (SQLite) ; e2e Blocks sous Chromium (85 tests, après correction de `partie.spec.ts`) ; `npm run consignes`.
- **CI de la PR (1ʳᵉ poussée)** : tout vert sauf `e2e-pr (4/4)` : `apps/web/e2e/leaderboard.spec.ts:39` (Track, « deux appareils, deux temps, un classement ») attendait `vs ma sélection · 1` et a reçu `vs premier : Alice · 39,331 s → ma sélection · 1` ; zone non touchée par ce lot. Relancé par la poussée de ce commit ; s'il échoue encore, Nathan tranche.
- **Non vérifié** : vrai téléphone et vraie partie humaine (les seuils sont à recaler sur les vrais scores) ; Firefox et WebKit ; le projet libSQL de l'API (pas de `sqld` ici) ; les captures.
- **Aucun jour figé** (Blocks est `off`, `apps/blocks/public/jours/` vide) : les tirage v5 et bot v4 valent pour tous les jours, sans date de bascule. Le v4 n'est pas gardé.

## Manques de plateforme et décisions de Nathan
1. Méthode de médailles « bots de référence » dans `@cdj/core` (la fiche garde `pourcentage-diamant` avec une indication).
2. Le Diamant « presque toujours dépassé » : voir plus haut (tirage plus doux, ou Diamant en quantile bas).
3. Les seuils (1 100 / 2 200 / 4 900 / 11 500) à recaler sur de vraies parties ; changer une constante monte `BLOCKS_BOT_VERSION`.
4. Marges minces de la répartition : une retouche des poids refait `mesure:repartition` et `calibrer:medailles`.
