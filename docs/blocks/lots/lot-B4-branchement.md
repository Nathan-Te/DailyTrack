# Lot B4 — Blocks : classement Arcade, partage, fantôme et préparation de l'aperçu

Branche `claude/blocks-b4-arcade-sharing-ghost-0uwu0l` (celle que la session impose ; le prompt disait `blocks/b4-branchement`), PR brouillon `jeu:blocks`. Partie de `main` à jour (B3 fusionné, PR #273). Jeu `off` : « Pour les joueurs » de la PR = `rien`. **Aucun changement de sensations, de barème, de rampe ni de médailles.**

## Ce qui est fait
- **Arcade vérifié et couvert** : Blocks est d'arcade dès sa naissance (fiche : `categorie: arcade`, `cumul: false`, pas de `categorieDepuis`). Le serveur le marque `categorie: "arcade"`, `compte: false` ; ni la journée parfaite, ni la série, ni « n fini sur m », ni le cumul ne le comptent, épinglé ou non ; il a sa vue de classement à part (`apps/api/test/blocksArcade.test.ts`, SQLite et libSQL, avec de vraies parties rejouées). Départage score ↓, puis combo maximal ↓, puis premier arrivé : `blocks.test.ts` (B1) et `test/arcade.test.ts` (fiche et variante d'accord). **Aucun défaut de plateforme trouvé sur ces points.**
- **Ligne à partager** : `Du Jour · Blocks #5 — 4 582 pts — combo ×7 — 🥈` par le gabarit du kit (voir « Manques » : l'ordre combo / médaille). Nombre au format de la langue (`formaterNombre` : « 4 582 », « 4,582 »), `pts` et `combo` gardés en anglais, pas de pastille sans médaille, pas de « combo ×0 », `#n` = numéro du jour depuis `premierJour` (date avant le premier jour). Clés `score.valeur` et `partage.combo` en `fr` + `en`. **Effet de bord voulu** : l'écran de fin et le lecteur d'écran écrivent aussi « 4 582 pts » (avant : « 4582 pts » : `ecrireScore` ne formatait pas) ; le grand score de l'écran de fin (`blocks.css`, `min(taille du kit, 11vw)`) tient sur une ligne.
- **Fantôme** (`fantome.ts`, pur, testé) : le bouton du kit (en jeu) montre en transparence, sous les blocs, **la grille de la partie fantôme au même rang de pièce**, une plaque **FANTÔME** (son score à ce rang, l'écart `+240` / `−120` / `=`) à côté du score et du combo (une troisième plaque en portrait, une plaque sous le combo en paysage ; **la grille ne bouge pas**). **Fin du fantôme** : sa dernière grille estompée, plaque estompée « Fin du fantôme ». **Il ne prend jamais les gestes** (dessin dans le même canevas : on pose à travers lui). **Sources** : celles du kit — Aucun → Ma meilleure → **Diamant** (`rediffusionDiamant` implémenté : la partie du bot rejouée, `corps.ts`).
- **Essais** : `?scenario=fantome` (la partie du jour, la partie du bot en fantôme dès la première pose) et `?scenario=partage` (l'écran de fin tout de suite, résultat d'exemple = le début de la partie du bot arrêté dans la bande d'une médaille, `&medaille=aucune|bronze|argent|or|diamant`). Jamais classés, page **pas** en archive, fermés en production. Ceux de B1 à B3 sont intacts.
- **Aperçu** : ce qui s'en teste l'est (voir « Vérifié »). **Le jeu reste `off`** : l'état est l'acte de Nathan.
- **Consignes** : `apps/blocks/CLAUDE.md` (« Partage », « Fantôme », « Publication », scénarios, « Prochaine étape »), `docs/blocks/consignes.md`.

## Vérifié
- **Unitaires** (SQLite) : `fantome.test.ts` (au rang n : grille, score, combo = la simulation ; rang 0 ; score jamais décroissant ; après la fin : dernière grille, `fini` ; rediffusion illisible, d'un autre jour ou inachevée : pas de fantôme ; écart `+` / `−` / `=`, grands nombres fr / en), `partage.test.ts` (ligne fr et en, avec et sans médaille, grands nombres, sans combo, avec rang, avant le premier jour, `formatScore` ; résultat d'exemple par médaille), `arcade.test.ts`, `essai.test.ts`, `miseEnPage.test.ts` (la plaque du fantôme : dans l'écran, ne recouvre rien, la grille ne bouge pas, sur les 7 tailles).
- **E2E** (Chromium, 61 tests, deux fois de suite) : `fantome.spec.ts` (plaque et bouton visibles en jeu, au même rang à chaque pose avec l'écart, cacher / remontrer, **pose à la souris à travers le fantôme**, le chemin du kit : finir le jour débloque « ma meilleure » puis « Diamant », « Fin du fantôme »), `partage.spec.ts` (le texte copié, fr et en, argent, or, sans médaille, Diamant), `arcade.spec.ts` (la journée sur le vrai serveur : arcade, ne compte pas), `apercu.spec.ts` (**serveur d'essai à part, Blocks en `preview`, port 8800** : fermé sans clé, ouvert avec, la clé jamais dans l'adresse, « Bientôt » sans clé, bandeau et clé retirée de l'adresse avec `?apercu=`, on y joue, absent de l'accueil même avec la clé, envoi rangé à part). Déclarés dans la fiche (`e2e.specs`) et `durees.json`.
- **Captures** regardées (5) : fantôme en portrait et en paysage, fantôme fini, partage fr et en (outil `captures-lot-b4.spec.ts`, `CAPTURES=1`, hors CI).
- `npm run fiches` et `npm run traductions` faits. `npm run verifier` : typecheck, unitaires SQLite et libSQL verts ; e2e : voir la fin de l'exécution (résultat final ajouté ci-dessous).

## Non vérifié
- **Aucun essai sur un vrai téléphone** ; le son n'a jamais été écouté (B2).
- **La page `/classement/` et l'accueil du portail ne sont pas ouverts dans un navigateur** : l'onglet « Arcade » et la section « Arcade » sont rangés par la catégorie du serveur et la logique du portail (`classementVues.ts`, `mesJeux.ts`, testées avec Tower et Blocks) ; je teste la donnée qui les pilote, pas le rendu de la page (le portail est une zone de plateforme).
- Le fantôme sur de **grandes parties** (le Diamant, 130 pièces en médiane) n'a été regardé qu'en capture ; la lisibilité de la transparence sur les six thèmes n'a été vue que sur le port (à regarder avec `?scenario=fantome&theme=nuit`, etc.).

## Liste « Prêt pour l'aperçu » (pour Nathan ; copiée dans `apps/blocks/CLAUDE.md`)
- [x] **Maquettes** : validées le 4 nov. 2026 (proposition A) ; le HUD en suit la plaque (le fantôme est la troisième).
- [ ] **`premierJour`** de la fiche : `2026-11-02` (`config/jeux/blocks.json`, une ligne) — à régler, puis `npm run fiches`. Le `#n` en dépend.
- [ ] **Mentions légales** : les deux pages ne décrivent pas les clés `blocks:*` (records, envoi, réglages, aide vue…) ni `cdj:apercu:blocks` : lot de plateforme (règle R5), **avant `on`**.
- [x] **Ligne de budget** `blocks.jsCss` : plafond 47 Ko. Premier chargement : voir « Poids ».
- [ ] **Musique** : aucun morceau de Blocks (les scènes `theme:<id>` sont silencieuses).
- [ ] **Manques de la plateforme** ci-dessous, dont la ligne à partager (combo avant la médaille).
- [ ] **Liens à ouvrir au téléphone** : voir la fin de ce fichier.

## Pour les joueurs — prêtes pour le jour où Blocks passera `on` (pas dans la PR)
- `- [Blocks] Blocks arrive : une grille de 8 × 8, une pièce à la fois, la même suite pour tout le monde chaque jour. // Blocks is here: an 8 × 8 grid, one piece at a time, the same run of pieces for everyone every day.`
- `- [Blocks] Gagne une médaille de bronze, d'argent ou d'or, ou bats le Diamant, le score d'un bot qui joue la même suite. // Win a bronze, silver or gold medal, or beat the Diamond, the score of a bot playing the same run.`
- `- [Blocks] Partage ta partie en une ligne : ton score, ta médaille et ton plus grand combo. // Share your run in one line: your score, your medal and your biggest combo.`
- `- [Blocks] Le bouton fantôme montre la grille de ta meilleure partie, ou celle du Diamant, au même rang de pièce. // The ghost button shows the grid of your best run, or the Diamond's, at the same piece.`
- `- [Du Jour] Une section « Arcade » à l'accueil et un onglet au classement pour Blocks, qui ne compte pas dans ta journée. // A new "Arcade" section on the home page and a ranking tab for Blocks, which doesn't count towards your day.`

## Problèmes de sensations ou de calibrage remarqués (non corrigés)
1. **La transparence du fantôme** (opacité 0,34, contour en pointillés) est discrète sur le gris des cases vides : à juger en main, surtout sur les thèmes clairs ; c'est un réglage de deux constantes dans `scene.ts`.
2. **Le bandeau « Aperçu » du kit recouvre les plaques du HUD** en portrait (capture du serveur d'aperçu) : à voir au téléphone ; zone de plateforme.
3. Les poses jouées d'un coup (essai `partage`, outils) déclenchent beaucoup d'effets : sans objet en partie normale.
4. Rappels de B3, non traités : jours courts du Diamant (décision de Nathan), fractions 60 / 20 / 8.

## Manques de la plateforme (rien codé hors zone)
1. **Le kit n'offre pas d'« extras » à la ligne à partager d'un jeu neuf** : `partagerLigne` n'appelle `ligneParDefaut` qu'avec le titre, le score, la médaille et le rang. Le combo part donc dans `scorePartage` (avant la médaille). **Proposition** : `DefinitionJeu.extrasPartage?(score, langue): string[]`, passé à `extras` (3 lignes dans `packages/kit/src/jeu/partie.ts` et `types.ts`) ; Blocks y met `combo ×7`, et la ligne du seed est exacte.
2. **Le Diamant et « ma meilleure » ne se débloquent qu'en finissant le jour** (règle G1 du kit) et exigent une partie classable : seul `?scenario=fantome` montre le Diamant d'emblée. Le bouton y reste sur « aucun » (aria-label « Fantôme : aucun ») alors que le fantôme d'essai est dessiné : le kit n'a pas d'état pour une source d'essai.
3. Le kit n'a pas de **mise à jour du Diamant par le serveur** (le Diamant est calculé du bot du jeu) : hérité de B3 (le Diamant n'est pas gelé dans les jours figés).
4. Hérités de B1 à B3 : vibration, réglage des effets sonores, dessin propre de l'étiquette, `?theme=` dans le kit, première lecture du portail (≈ 3 s à froid : `classement.spec.ts` la réchauffe ; **un spec de Blocks qui lit le cumul avant les joueurs fige le classement de 45 s** : `arcade.spec.ts` ne lit donc que la journée).
5. **Mentions légales** (lot de plateforme, avant `on`) : décrire `blocks:*` et `cdj:apercu:blocks`.

## Poids et budget
Premier chargement (JS + CSS gzip, `dist/index.html`) : **26 960 → 27 394 o (+ 434 o)** : quatre clés de catalogue français, `formaterNombre`, les options d'essai et une règle CSS. `main-*.js` 32,96 → 33,96 Ko (gzip 11,9 → 12,3). Le fantôme, l'exemple et le bot du fantôme sont **dans le chunk à la demande `corps-`** (35,8 Ko, gzip 14,8 : +3,1 Ko bruts). La mesure de `blocks.jsCss` à 44 574 o (B2, `budgets.md`) donne ≈ 45 000 o pour 47 Ko : **la ligne de `budgets.md` n'est pas modifiée** (`scripts/budgets.mjs` ne mesure toujours pas `blocks.jsCss`, plomberie de la plateforme).

## Un test de B3 retouché (sans l'affaiblir)
`test/fiche.test.ts` attendait `scorePartage([120, 3], "en") === "120 pts"` : la ligne porte maintenant le combo (`"120 pts — combo ×3"`), c'est le but du lot. Deux assertions s'y ajoutent (`classable` rend `false` pour les deux nouveaux essais). Aucun autre test existant n'est modifié ; `e2e/appareil.ts` gagne deux paramètres optionnels (attendre « Jouer », la langue).

## Zones
Dans les zones de Blocks, sa fiche (`e2e.specs`) et ce que `npm run fiches` en tire (`config/jeux/projections/ci.json`), `docs/plateforme/traductions.md` régénéré. **Aucun fichier du kit, du portail ou de la plateforme.**

## Liens de test
Local : `npm run build -w @cdj/blocks`, le serveur d'essai (`cd apps/api && npx esbuild scripts/blocks-serveur-essai.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist/blocks-serveur-essai.mjs "--banner:js=import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" && PORT=8794 node dist/blocks-serveur-essai.mjs`), puis `npm run dev -w @cdj/blocks` : `http://localhost:5173/?api=http://127.0.0.1:8794&scenario=fantome` et `…&scenario=partage` (`&medaille=or`, `&theme=nuit`…). Sur la PR : les mêmes paramètres sur l'aperçu de la PR (`…/blocks/?scenario=fantome`).
