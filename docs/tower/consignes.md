# Tower — consignes (lot T0)

Chargé par le `CLAUDE.md` racine (comme les consignes de Jump). **Vision : `docs/tower/seed.md`** (**ne pas modifier**, c'est Nathan qui le fait) ; cadrage : `docs/tower/cadrage.md` ; rapports de lots : `docs/tower/lots/`. Réponses et docs en français.

## Emplacements
- `packages/tower-sim` (`@cdj/tower-sim`) : la simulation de Tower. **Au lot T0, seul `lab/` est rempli** ; `src/` est vide jusqu'au lot T1 (le moteur n'est pas choisi).
  - `lab/interface.ts` (les 4 fonctions communes `createWorld` · `addPiece` · `step` · `snapshot`, plus `clone`, `awake`, `dispose`), `lab/pieces.ts` (sept tétrominos en boîtes), `lab/banc.ts` + `lab/bancTable.ts` (le banc d'essai et la tour propre), `lab/empreinte.ts`.
  - `lab/a/` : **moteur A**, maison, en entiers (`fixe.ts` Q16, `trig.ts` + `trigTable.ts` générée, `collision.ts`, `monde.ts`, `moteurA.ts`).
  - `lab/b/moteurB.ts` : **moteur B**, Rapier 2D déterministe (WebAssembly).
  - `lab/mesures/` : outils de lecture (stabilité, bot), **hors simulation**.
  - `tools/` : générateur de la table de sinus, calibration du banc, mesures, poids. `test/` : Vitest ; `test/fixtures/banc-golden.json` : les empreintes de Node.
- `apps/tower` (`@cdj/tower`) : la page de démonstration `/tower/` (Canvas 2D, pas Three.js : le jeu viendra avec T1), la page `verify.html` (sans rendu) et `e2e/` (Playwright, port 4175).
- `docs/tower/` : cette page, le seed, le cadrage, `lots/`.

## Règles de déterminisme de `tower-sim`
- **Ce qui entre dans l'état d'un moteur est interdit de flottant, de transcendante et de hasard non semé** : mêmes interdits que `sim` et `jump-sim` (`Math.sin/cos/…/random`, `**`, `Date.`, `performance.`, import extérieur), vérifiés par `test/purete.test.ts` sur `lab/` et `lab/a/`. Seul `@cdj/core` s'importe. `lab/b/` (Rapier) et `lab/mesures/` ne sont pas scannés : le premier est une dépendance externe, le second ne fait que **lire** des sorties.
- **Moteur A = entiers Q16** (65 536 = 1,0 ; un angle = 2^20 « brads » par tour). `mul`, `div`, `mulDiv`, `idiv` (tronque vers zéro, jamais `-0`) dans `fixe.ts` : **toute multiplication passe par elles**, jamais `a * b / c`. **Aucun produit ne dépasse 2^53** (positions < 256 m, vitesses < 128 m/s) : `setCheck(true)` l'impose pendant le banc (testé, marge mesurée).
- **Trigonométrie par table** : `lab/a/trigTable.ts` est GÉNÉRÉ (`npm run trig:tower -w @cdj/tower-sim`, qui seul appelle `Math.sin`) ; un test vérifie qu'il est à jour.
- **Entrées entières** : les positions et vitesses d'un `PieceSpec` sont en huitièmes de mètre ; un quart de tour (0 à 3) est appliqué à la création (aucun angle d'entrée). Les sorties (`snapshot`) sont en mètres et en radians, des flottants **dérivés** d'entiers (A) ou rendus par Rapier (B) ; l'empreinte hache leurs octets exacts.
- **Même ordre, même résultat** : l'ordre d'ajout des pièces et des contacts est déterministe (tri par clé) ; aucune itération d'un `Set`/`Map` n'en dépend sans qu'on sache pourquoi.
- **La hauteur d'apparition d'une pièce se déduit de l'état** (`sommetTour` : sans sinus ni cosinus) : c'est le comportement du jeu (la pièce naît en haut, au-dessus de la tour), pas une consigne fixe.

## Rapier (règle provisoire, lot T0)
**Dépendance externe autorisée dans `packages/tower-sim/lab/` seulement, version figée** : `@dimforge/rapier2d-deterministic-compat` **0.21.0** (exacte, sans `^`), la variante « deterministic » (calculs flottants reproductibles d'une plateforme à l'autre, un peu moins rapide) dont le WebAssembly est inclus en base64 (`-compat` : même code sur Node et dans les navigateurs). Passer au jeu (T1) sur ce moteur la rend définitive ; sinon elle disparaît avec le lab.

## Tower naît `off`
Comme tout nouveau jeu (`CLAUDE.md` racine, « Publication des jeux ») : **Tower est absent de la table `jeux`, donc `off`**, et **la page de démonstration n'est pas publiée en production** (`scripts/site.mjs` ne copie `apps/tower/dist` que hors production et le vérifie ; sur une construction de production, `VITE_PRODUCTION=1`, la page se tait). Tower n'est ni dans le registre des jeux, ni dans `JEUX_PUBLICS`, ni dans la journée, la série ou le partage : ces branchements sont le lot T4. Aucune version de Track ou de Jump, aucun golden de ces jeux n'est touché.

## Commandes du banc d'essai
- `npm test` (ou `npx vitest run --project sqlite packages/tower-sim`) : pureté, trigonométrie, virgule fixe, pièces, **banc d'essai et empreintes de Node pour A et B**, copie du monde, physique élémentaire.
- `UPDATE_GOLDEN=1 npx vitest run --project sqlite packages/tower-sim/test/banc.test.ts` : régénère `banc-golden.json` (seulement en comprenant pourquoi : un changement de moteur, de réglage ou de banc).
- `npm run build -w @cdj/tower && npm run e2e -w @cdj/tower` : le déterminisme dans Chromium ; `E2E_ALL_BROWSERS=1` ajoute Firefox et WebKit (petit ensemble `@navigateurs`). En CI : `.github/workflows/tower-essai.yml`.
- `npm run mesures:tower -w @cdj/tower-sim` (≈ 5 min) : coût d'un rejeu, stabilité, coût d'un tour de bot. `npm run poids:tower -w @cdj/tower-sim` (après la construction) : poids compressé par moteur.
- `npm run calibrer:tower -w @cdj/tower-sim` (≈ 7 min, **à ne relancer que si la table doit changer**) : un bot glouton joue la suite sur A et fige `lab/bancTable.ts`.
- La page : `npm run dev -w @cdj/tower`, puis `/?scenario=banc&engine=a|b`, `…&libre`, `…&debug&tune`.

## Zones d'un lot de Tower (même principe que Track et Jump, `docs/orchestration.md` § 10)
Un lot de Tower reste dans : `packages/tower-sim/**`, `apps/tower/**`, `docs/tower/**` et, à partir du lot T4, `apps/api/src/tower*.ts` avec leurs tests et outils. Tout le reste est partagé et réservé aux lots de la plateforme ; un lot de Tower qui en a besoin **s'arrête et le propose** dans son rapport. Exceptions tolérées, comme pour les autres jeux : sa ligne de `budgets.md`, ses entrées de `durees.json` et de `packages/ui/test/applications.ts`, ses clés de catalogue (et `traductions.md` régénéré).
**À brancher par un lot de la plateforme** (non fait au T0, voir le rapport) : `scripts/zones-jeu.mjs` (zones et étiquette `jeu:tower`), `e2e/zones.json` et `scripts/ci-zones.mjs` (le spec de Tower dans la CI de PR), la matrice « petit ensemble » de `ci.yml` (remplace `tower-essai.yml`).
