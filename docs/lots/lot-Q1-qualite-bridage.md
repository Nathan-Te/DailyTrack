# Lot Q1 (plateforme, Track et Jump) — le choix « Qualité graphique » respecté, les appareils bridés à 30 images/s

**Cause** (code de `main`, 05/11) : `QualityGovernor` descendait d'un niveau au-delà de 26 ms d'intervalle, ne remontait que sous 19 ms et ne tenait pas compte du réglage du joueur. Un appareil bridé à 30 images/s (iPhone en économie d'énergie, Chrome « Économiseur d'énergie ») fait 33 ms par image : le niveau 0 en 2 s (décor, ombres, halos cachés), sans retour, quelle que soit la puissance ni « Maximale ». À l'accueil sur tactile, la scène était aussi plafonnée à 0.

## Livré
1. **Track, le choix fait foi** : « Économie », « Équilibrée », « Maximale » → le régulateur ne touche plus à la scène (`niveauDeScene`, `qualite.ts`) ; il n'allège que particules, traces, vibration. Auto : inchangé dans son rôle. « Maximale » à l'accueil tactile : le décor est là (`niveauALAccueil`).
2. **Track, un appareil bridé n'est pas lent** : le régulateur décide sur le **travail de rendu par image** (`travailImage`, mesuré autour de `renderer.render`), comme `CarnageGovernor` : descend au-dessus de 12 ms, remonte sous 8 ms (4 s de suite) ; descend aussi sous 20 images/s quel que soit le travail (le processeur graphique ne suit pas).
3. **Détection commune** `@cdj/core/bridage` : 2 s de rendu, intervalle médian 31–36 ms **et** travail moyen < 10 ms. Pure, testée sous Node.
4. **Le dire au joueur** (Track et Jump) : ligne `note` à l'accueil, une fois par session ; même phrase dans Réglages (Track : sous « Qualité graphique » ; Jump, qui n'a pas de réglage de qualité : sous les effets visuels). Clé `reglages.bridage` (fr + en) dans le catalogue de chaque jeu. Pas de bandeau en partie.
5. Tests unitaires seulement : `packages/core/test/bridage.test.ts`, `apps/web/test/juice.test.ts` (16 ms, 33 ms bridé, 33 ms chargé…), `apps/web/test/qualite.test.ts`. Golden inchangés (rendu seul).

## Mesure avant / après (régulateur, série simulée de 30 s, 3 ms de rendu par image)
| série | ancien (intervalle) | nouveau (travail) |
|---|---|---|
| bridée 33,3 ms | niveau 1 à 1 s, **niveau 0 à 2 s, définitif** | **niveau 2 tout du long** |
| chargée 33,3 ms, 25 ms de rendu | niveau 0 à 2 s | niveau 0 à 2 s (inchangé) |
| 60 images/s, 4 ms de rendu | niveau 2 | niveau 2 |

## Poids (premier chargement, `node scripts/budgets.mjs`, plafonds de `budgets.md` intacts)
Track `jsCss` 297 844 o (+887 o, plafond 312 Ko) ; Jump `jsCss` 383 522 o (+666 o, plafond 402 Ko) ; catalogues anglais +88 o et +93 o.

## Décisions et limites
- **Limite assumée** : un appareil réellement lent mais stable à 33 ms avec moins de 10 ms de travail serait lu comme bridé (aucune descente). L'intervalle sous 20 images/s fait toujours descendre.
- Le palier 1/2/3 de la règle de qualité du lot 45 (`qualite.ts`, mesure de l'accueil) ne change pas : sur un iPhone bridé en Auto, sa mesure (médiane ≥ 22 ms) peut encore choisir un palier plus bas ; hors périmètre, à voir avec Nathan.
- Tower, Blocks, Rush : hors périmètre (ils reprendront `@cdj/core/bridage`).
- Non vérifié ici : un vrai iPhone en économie d'énergie. Scénario pour Nathan sur l'aperçu de la PR : voir le texte du prompt (2 clics).

## Pour les joueurs
- [Track] Track respecte ton choix de qualité graphique, même quand ton appareil économise sa batterie. // Track now keeps your graphics quality choice, even when your device is saving battery.
- [Jump] Jump te prévient quand ton appareil limite l'affichage à 30 images par seconde (économie d'énergie). // Jump now tells you when your device is limiting the display to 30 frames per second (power saving).
