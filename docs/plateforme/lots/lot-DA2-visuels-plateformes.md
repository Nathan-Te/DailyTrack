# Lot DA2 — la DA de Jump en module commun (`@cdj/visuels/plateformes`)

**État : partie 1 livrée (la description), partie 2 non faite (le dessinateur Three.js et la planche `/ui/`).** PR en brouillon.

## Ce qui a changé
- **Nouveau module `packages/visuels/src/plateformes/`**, sans moteur de rendu ni nom de jeu : `themes.ts` (les cinq thèmes, couleurs réservées, `THEMES`), `tuiles.ts` (assemblage : `tileShape`, `neighbourMask`, `depthMap`, bruit de case, sur une `Grille` générique et un prédicat `estMatiere`), `decor.ts` (règles et géométrie du décor), `personnage.ts` (`LOOK`, `STEP`, `animateLook`, pieds calés sur la distance), `mecaniques.ts` (clignotant, alterné, vent), `couleurs.ts` (`mix`). Le tapis et la glace sont dans les thèmes.
- **Jump relit le module** : `themes.ts`, `palette.ts`, `autotile.ts`, `look.ts`, `blocks.ts`, `wind.ts`, `decor.ts`, `contrast.ts`, `events.ts` gardent leurs noms et leurs exports ; seul ce qui touche la simulation y reste (`themeForDay`, `isMatterTile`, `placeDecor`, `onStep`, `motionOf`). Dépendance `@cdj/visuels` ajoutée à `apps/jump` (`package.json`, `tsconfig.json`, lockfile).
- Maquette de Gravity versée : `docs/plateforme/maquettes/gravity-maquette-jouable.html` (pas de `docs/gravity/`).
- Consignes : `packages/visuels/CLAUDE.md` (module, règles, « Réutiliser un design »), `apps/jump/CLAUDE.md`.

## Jump n'a pas bougé
Avant / après comparés sur le code (ancien HEAD contre nouveau) : `THEMES` complet, couleurs réservées, `LOOK`, `STEP`, `restLook`, 90 images d'`animateLook`, `BLOCK_STYLE`, `WIND_STYLE`, les 256 `tileShape`, `cellHash`, `depthMap`, constantes du décor : **identiques** (JSON égal). Tests : `packages/visuels/test/plateformes.test.ts`, `apps/jump/test/visuelsPlateformes.test.ts` (nouveaux) ; les tests de contraste de Jump (`themes.test.ts`…) passent tels quels et lisent le module.

## Non fait, à décider
- **Partie 2.** Le dessinateur de Jump (`tileArt`, `parallax`, `artKit`, `scene`, `surfaceArt`, `dynamicArt`…) lit le `Level` de `@cdj/jump-sim` : l'extraire « tel quel » dans un module qui ne nomme aucun jeu demande d'abord une grille générique, et un lot à part avec les captures de Jump pour preuve. Sans lui, **la section « Plateformes » de `/ui/` et la mesure `jump.premier` ne sont pas faites** (le premier chargement ne doit pas bouger : les modules sont des données ré-exportées ; à mesurer par `node scripts/budgets.mjs` en CI).
- Golden et captures de Jump : non touchés ; non relancés ici (Windows : voir « Vérifié »).

## Vérifié / pas vérifié
- Vérifié : `tsc -b packages/visuels apps/jump` ; `vitest apps/jump packages/visuels` (898 verts) ; comparaison avant / après ci-dessus.
- Pas vérifié : 4 tests de Jump échouent **sur cette machine Windows** (`spawn npx ENOENT`, `spawn esbuild ENOENT`, chemin `C:\C:\`, regex sur CRLF) : environnement, non lié au lot ; la CI Linux tranche. CI, budgets et e2e non lancés.

## Scénario pour Nathan
1. `/jump/` sur l'aperçu de la PR : jouer une minute, rien ne doit avoir changé.
2. (Partie 2, pas livrée) `/ui/` › Plateformes.

## Pour les joueurs
- rien
