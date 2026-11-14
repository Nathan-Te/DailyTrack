# Lot DA2 — la DA de Jump en module commun (`@cdj/visuels/plateformes`)

**État : livré (parties 1 et 2).** PR en brouillon. Le module ne nomme aucun jeu ; Jump n'a pas changé d'un pixel (preuve : l'empreinte de sa géométrie).

## Ce qui a changé
- **Partie 1 — la description** (`packages/visuels/src/plateformes/`, sans moteur de rendu) : thèmes, couleurs réservées, assemblage des tuiles (`Grille` + `estMatiere`), règles du décor, personnage (`LOOK`, `STEP`, `animateLook`), blocs à mécanique. Jump la relit (mêmes noms de fichiers et d'exports). Maquette de Gravity : `docs/plateforme/maquettes/gravity-maquette-jouable.html`.
- **Partie 2a — le dessinateur Three.js** (`@cdj/visuels/plateformes/three`, dossier `src/plateformesThree/` à côté de la description) : `Art` + `artGeometry`, la parallaxe, `buildTileArt(grille, style, CodesTuiles, degagement)` (extraction **étroite** : le jeu dit ce que sont ses cases et la distance de chaque case au danger ; `keepouts`, `placeDecor`, dangers, blocs animés et `scene.ts` restent dans Jump), `creerPersonnage`. `artKit.ts`, `parallax.ts`, `tileArt.ts` de Jump sont des façades ; `scene.ts` appelle `creerPersonnage`. `@cdj/visuels` dépend de `@cdj/core` (le PRNG de la parallaxe).
- **Partie 2b — la planche `/ui/` › Plateformes** (`vitrinePlateformes.ts`, textes fr + en) : cinq thèmes sur une petite grille (sol, bloc surélevé, tapis, glace), cinq poses du personnage, blocs à mécanique (clignotant plein / absent, alterné A / B, vent) par leurs couleurs réservées. Les chevrons animés du tapis (shader) ne sont pas montrés : la bande seule.
- Consignes : `packages/visuels/CLAUDE.md`, `apps/jump/CLAUDE.md` (`npm run consignes` vert).

## Jump n'a pas bougé
Pas de captures en pixels de référence dans le dépôt : la preuve est **l'empreinte de la géométrie dessinée** (positions, couleurs par sommet, indices) des tuiles, de la parallaxe et des chevrons, 4 niveaux × 5 thèmes — **identique avant / après** (le même hash sur le code d'avant : `apps/jump/test/dessinFige.test.ts`, qui reste en garde), plus 111 empreintes sur 10 niveaux dont 6 niveaux du jour. Couleur des pieds comparée à `mixColor` sur toutes les palettes. Golden de la simulation : non touchés.

## Budgets (`node scripts/budgets.mjs`, `jump.jsCss`)
`main` 384 165 o → partie 1 384 288 → partie 2 385 166 : **+1 001 o au total** (+878 o pour la partie 2), plafond 402 Ko (marge restante ≈ 17 Ko). `budgets.md` n'est **pas** touché : sa « mesure à la pose » (382 856) ne se remesure qu'avec un relèvement du plafond, décision de Nathan (`budgets.test.ts`) ; elle est déjà en retard sur `main` (384 165). La planche et le dessinateur de la vitrine sont à la demande.

## Vérifié / pas vérifié
- Vérifié sur Linux : `npm ci`, `npm run typecheck`, `npx vitest run --project sqlite apps/jump packages/visuels apps/portail` (1 327 verts avant la partie 2) : **les échecs vus sous Windows étaient bien d'environnement** (aucun sur Linux). Planche photographiée dans Chromium (WebGL logiciel) : 5 thèmes, 5 poses, 5 blocs, aucun canvas vide.
- Pas lancé ici : le spec `portail.spec.ts` › Plateformes (`@regression`) dans Playwright (le serveur d'API de la config manque dans ce conteneur) — ses vérifications ont été rejouées à la main sur la page assemblée ; e2e de Jump ; CI : à lire sur la PR.

## À décider
Rien de bloquant. Gravity reprendra `plateformes` et `plateformes/three` ; son héros et ses blocs propres restent hors module.

## Scénario pour Nathan
1. `/jump/` sur l'aperçu : jouer une minute, rien ne doit avoir changé. 2. `/ui/` › Plateformes.

## Pour les joueurs
- rien
