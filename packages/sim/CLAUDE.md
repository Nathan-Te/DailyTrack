# DailyTrack — `packages/sim` : consignes de la simulation, du générateur et des circuits

Chargé quand on lit un fichier de `packages/sim`. Physique, blocs, rediffusions, générateur, thèmes, figures, déterminisme. Synthèse de DailyTrack : `docs/orchestration.md` (partir de là ; un README de `docs/lots/` seulement pour un détail). Autres consignes du jeu : `apps/web/CLAUDE.md` (rendu, interface, Salon côté jeu), `apps/api/CLAUDE.md` (classement, serveur, production).

> **Renvois « voir <rubrique> »** : une rubrique citée mais absente de ce fichier est dans un autre `CLAUDE.md` ou dans `docs/regles/` : `CLAUDE.md` racine, « Où sont les rubriques ».

## Circuits (lot 2)
- Un circuit = un texte de blocs (`parseTrack`, voir `packages/sim/src/track.ts`) : cellules de 32 m, repère canonique (p = gauche, q = avance) tourné par quarts de tour ; hauteurs enchaînées automatiquement.
- `trackWorld(track)` donne `sample` (hauteur/pente/plaque) et `collide` (rebords) à `stepCar` ; `createRace`/`stepRace` ajoutent portes, chrono et reprises. Les commandes enregistrables sont `{ steer, throttle, brake, respawn }`.
- Tests navigateur : `?debug` expose `window.__cdj`. Scénarios : `?scenario=essai|pilotage|surfaces|largeurs|vitesse|glace|relief|cuves|air|bas-cotes|herbe|figures|plat`, `?scenario=figure-<nom>` (lot 49 : une figure en boucle ; `figures` ouvre d'abord la page des nouvelles figures).
- **Cuves (lot 18)** : `V` cuve droite, `ML` / `MR` mur latéral, `/c` sur un virage (`L2/c` : son mur extérieur) ; voir « Cuves (lot 18) ». **Les boucles restent exclues** (comme les tunnels fermés et les murs au plafond).

## Rediffusions (lot 3)
- Une rediffusion = `Replay` (séries de commandes) ; `encodeReplay`/`decodeReplay` ↔ texte base64url ; `replayRace` rejoue et renvoie le résultat recalculé. **Ne jamais faire confiance à un temps annoncé.**
- **`SIM_VERSION`** (constants.ts) : à incrémenter dès que la physique, un bloc ou un circuit change le résultat d'une course ; puis régénérer la rediffusion de référence : `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden.test.ts`.
- `apps/web/src/session.ts` : `RunSession` avance course + enregistrement + fantôme ; `verify.html` : rejeu sans rendu pour les tests de navigateur (`npm run test:e2e`, Playwright ; `CHROMIUM_PATH` pour un Chromium déjà installé, `E2E_ALL_BROWSERS=1` pour Firefox et WebKit).

## Circuit du jour (lot 4)
- `dailyCircuit(jour)` (`generator.ts`) : graine = numéro de jour de la date (`parseDay`/`formatDay`, calendrier sans `Date` ; « aujourd'hui » = **la date à Paris**, voir « Jour de Paris (lot 31) ») ; `composeSpec` construit le texte, `bestPilotRun` (`autopilot.ts`) valide et donne le temps de l'auteur, d'où `medalsFor`. Id du circuit : `jour-AAAA-MM-JJ-g<G>` (variante 0), **`G` = la version du générateur de ce jour** (`generatorVersionOf(jour)`, lot R11 : celle du **registre des jours** `src/jours-track.json` pour un jour protégé, **la dernière** pour un jour qu'il ne nomme pas — voir « Registre des jours (lot R11) » ci-dessous) ; voir « Admin et planning » et « Freinage après un boost (lot 34) ».
- **`GENERATOR_VERSION`** (constants.ts) : à incrémenter dès que le circuit d'une date change (règles, pilote, fenêtre de durée) ; puis régénérer `fixtures/daily-golden.json` (`UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts`, qui refuse de réécrire un vecteur d'une ancienne version). **Depuis le lot R11, plus aucune date de bascule dans le code** : monter la version suffit ; la version d'un jour déjà servi est celle du registre (voir « Registre des jours (lot R11) »), et c'est la mise en production qui décide du premier jour de la nouvelle version.
- Web : `?mode=salon` (Salon, lot 26), `?seed=AAAA-MM-JJ` (ou `?day=`), `?theme=<nom>`, `?api=demo`, `?scenario=essai|pilotage|surfaces|largeurs|plat`, `?debug&tune` (réglages), touche **C** (caméra : proche, loin, capot ; lot 23). Palettes dans `apps/web/src/trackMesh.ts` (`PALETTE_DEFS`).
- **`npm run measure:generator`** (`apps/api/scripts/measure-generator.ts`) : durées d'auteur, largeurs, virages serrés, temps de génération et de rejeu sur 60 dates, taux de validation par thème (12 dates × 6 tentatives, thème forcé), bas-côtés et moments de choix par thème (lot 21). **Toute règle de générateur se valide par ce script (durées, taux de validation par thème), pas seulement par les tests.** `FAST=1` pour un passage rapide.

## Conduite (lot 7)
`packages/sim/src/car.ts` : modèle **bicyclette** (deux essieux, force latérale saturée par `tireCurve`) + **4 ressorts** posés sur `world` (hauteur, tangage, roulis en pentes ; charge → […] **→ Détail : [docs/regles/sim/conduite-lot-7.md](../../docs/regles/sim/conduite-lot-7.md)**

## Air et atterrissages (lot 19)
**Réception** (`land`, `car.ts`) : au premier contact après un vol (≥ `LANDING_MIN_AIR` sous-pas), la vitesse **normale** au sol est absorbée (`landAbsorb` 0,95 : aucun rebond) et la […] **→ Détail : [docs/regles/sim/air-et-atterrissages-lot-19.md](../../docs/regles/sim/air-et-atterrissages-lot-19.md)**

## Surfaces et blocs à effet (lot 8)
**Revêtement = attribut d'un bloc** (`Block.surface`, notation `S/t` terre, `S/g` glace, `S/h` herbe, `S/s` sable (lot 22) ; `/b` = virage relevé : `L2/b`, `R/tb`) ; `parseToken` (`track.ts`) lit la notation. **→ Détail : [docs/regles/sim/surfaces-et-blocs-a-effet-lot-8.md](../../docs/regles/sim/surfaces-et-blocs-a-effet-lot-8.md)**

## Herbe de course (lot 48)
**Règle : une surface nouvelle plutôt qu'un ancien paramètre changé.** L'herbe d'avant (`grass` : zones des anciens circuits et bas-côtés `~h`) garde ses valeurs au bit près ; le nouveau […] **→ Détail : [docs/regles/sim/herbe-de-course-lot-48.md](../../docs/regles/sim/herbe-de-course-lot-48.md)**

## Générateur : identité des thèmes, nouvelles figures, variété (lot 49)
**Générateur v18** (lot R11 : plus de date de bascule ; `GENERATOR_BEFORE_49` = 17 est la version d'avant ; la v17 n'a servi aucun jour). **→ Détail : [docs/regles/sim/generateur-identite-des-themes-nouvelles-figures-variete.md](../../docs/regles/sim/generateur-identite-des-themes-nouvelles-figures-variete.md)**

## Variété des circuits : rythmes, motif plafonné, fiches de biomes (lot V2)
**La mesure** (`variete.ts`, pure, importée par le générateur et la galerie) : les **éléments** d'un circuit (`elementsOf` : boost, droite, longue = 3 blocs droits ou plus, serré, large, […] **→ Détail : [docs/regles/sim/variete-des-circuits-rythmes-motif-plafonne-fiches-de-bi.md](../../docs/regles/sim/variete-des-circuits-rythmes-motif-plafonne-fiches-de-bi.md)**

## Glace (lot 16)
- La glace réagit au pied (`car.ts`, `SurfaceParams.slick` = 1 ; valeurs = clés `ice*` de `CarParams`, dans `?debug&tune`) : **accélérateur appuyé** = adhérence latérale très faible (`SURFACES.ice.grip` 0,3), sous-virage, motricité 0,4 (patinage) ; **roue libre** (ni gaz ni frein) = adhérence rendue (`iceCoastGrip` 0,38), décélération × `iceCoast` 0,3, et `iceRealign` 0,8 /s éteint la vitesse latérale (le vecteur vitesse se réaligne sur le cap, sans freiner) : gauche-droite en roue libre rattrape la trajectoire ; **frein** = adhérence × `iceBrakeGrip` 0,5, freinage 16 m/s², glisse. Pointe sur glace = pointe du plat × `iceTop` 1,2 (la traînée au-delà de la pointe suit). Aucun roulement sur glace.
- Pilote : vitesse de passage sur glace = roue libre (`racingLine(…, iceCoastGrip)`), il lâche l'accélérateur en braquant (> 0,12) et le rend en ligne droite. Générateur : aucune règle ajoutée ; *Banquise* mesurée comme les autres thèmes. `?scenario=glace` (`GLACE_TRACK_SPEC`), tests `packages/sim/test/glace.test.ts`, e2e `glace.spec.ts`. `SIM_VERSION` et `GENERATOR_VERSION` valent **7**. **Un test qui compare des revêtements fixe le pied** (gaz appuyé).

## Thèmes (lot 8)
`themes.ts` : `THEMES` (stade, rallye, banquise, nuit, campagne, **canyon, col, ville** depuis le lot 22). **→ Détail : [docs/regles/sim/themes-lot-8.md](../../docs/regles/sim/themes-lot-8.md)**

## Sac de thèmes : jamais deux jours de suite le même thème (lot V1)
**Générateur 20** (`GENERATOR_VERSION`, `GENERATOR_SAC_THEMES` de `dailyId.ts`) ; `SIM_VERSION` inchangée (14) ; les circuits ne changent que par leur thème (et `MAX_ATTEMPTS_SAC`, plus bas). **→ Détail : [docs/regles/sim/sac-de-themes-jamais-deux-jours-de-suite-le-meme-theme-l.md](../../docs/regles/sim/sac-de-themes-jamais-deux-jours-de-suite-le-meme-theme-l.md)**

## Nouveaux thèmes : Canyon, Col alpin, Ville (lot 22)
**Sable** (`SURFACES.sand` `0,8 / 0,7 / 6` : adhérence, motricité, roulement ; pointe à plat ≈ 35 m/s) : **revêtement de bloc** (`S/s`, `SURFACE_LETTERS`, `surfaceMod`) **et bas-côté** (`~s`, `ShoulderKind`). **→ Détail : [docs/regles/sim/nouveaux-themes-canyon-col-alpin-ville-lot-22.md](../../docs/regles/sim/nouveaux-themes-canyon-col-alpin-ville-lot-22.md)**

## Largeurs de route et courbes amples (lot 12)
**Largeur = attribut de bloc** (`Block.w0` entrée, `Block.w1` sortie, en m) : `e` étroite 14 m, `n` normale 20 m, `l` large 26 m (`ROAD_WIDTHS`, track.ts), dans une cellule de 32 m. **→ Détail : [docs/regles/sim/largeurs-de-route-et-courbes-amples-lot-12.md](../../docs/regles/sim/largeurs-de-route-et-courbes-amples-lot-12.md)**

## Portions rapides (lot 15)
- **Générateur** (`generator.ts`) : un à deux créneaux calmes de portion rapide par circuit (`Fast` : `chain` = deux super turbos à trois blocs d'écart, `drop` = plaque en haut de six blocs de descente, `bank` = super turbo puis grande courbe relevée `L3/b`), loin du tremplin et de la signature, avec les droites obligatoires derrière (`TURBO_RUNOUT`, `PAD_RUNOUT`). Les circuits ont ≈ 38 blocs (34 avant) ; **4 à 6 créneaux calme + virage** (5 à 7 au lot 12 : sinon la durée moyenne montait à 38 s). **Règle : un circuit dont le pilote ne dépasse pas `FAST_PEAK` (30 % au-dessus de la pointe du plat, 62,4 m/s) est refusé**, graine voisine ; `PilotRun` donne `maxSpeed` et `fastTicks`. Fenêtre du temps de l'auteur inchangée (30–40 s).
- **Règle de méthode : toute règle de générateur se valide par `npm run measure:generator`** (durées, taux de validation par thème, vitesse maximale du pilote, part du temps au-delà de la pointe, coût d'un rejeu), pas seulement par les tests — le test de la largeur dominante par thème l'a montré (écart Stade / Rallye passé de 3 à 2,5 m en retirant un créneau).
- **Scénario** `?scenario=vitesse` (`VITESSE_TRACK_SPEC`, circuits.ts : plaque et longue descente, deux super turbos enchaînés, `R3/b` à fond, freinage avant un virage serré) ; raccourci « Vitesse » de `/admin/`.

## Freinage après un boost (lot 34)
**Version du générateur d'un jour** (lot 34, **refait au lot R11** — voir « Registre des jours (lot R11) ») : `generatorVersionOf(jour)` lit le registre ; `dailyTrackId`, `dailyCircuit`, […] **→ Détail : [docs/regles/sim/freinage-apres-un-boost-lot-34.md](../../docs/regles/sim/freinage-apres-un-boost-lot-34.md)**

## Registre des jours (lot R11)
**Track fige ses circuits comme Jump** : plus aucune date de bascule écrite à la main.
- **`src/jours-track.json`** : `{ format: 1, jusqua, plages: [{ du, au, g, sim }] }` — pour chaque **jour protégé** (d'avant le lancement public, déjà figé, ou avec au moins un résultat en production : `CLAUDE.md` racine, « Règle de bascule »), la version du générateur (`g`) et de la simulation (`sim`) qui ont fait son circuit, en plages de jours consécutifs de même version ; `jusqua` = la veille du jour de bascule de la dernière mise en production. **Écrit par « Mettre en production »** (jamais à la main, jamais par un lot), versé dans `main` par la PR « Jours figés » ; le fichier initial reprend ce que la production sert (v15, du 01/09/2026 au 27/10/2026 : tous les jours d'essai d'avant le premier circuit gardent la v15 qu'ils ont toujours eue). Poids : ≈ 100 o par plage (une plage par changement de version ; `docs/plateforme/budgets.md`).
- **Lecture** : `generatorVersionOf(jour)` (`dailyId.ts`, fichier léger, premier chargement) renvoie la version de la plage du jour, sinon **`GENERATOR_VERSION`** (un jour sans résultat, le jour de bascule et les suivants, le Salon). Le jeu (fil de travail et miniatures) et le serveur (`cdj.ts`) l'appellent : **la même fonction, le même fichier** dans la même construction.
- **Changer le générateur** : monter `GENERATOR_VERSION`, ajouter ce que la nouvelle version change (`themeOfVersion`, `since`, `generator >= N`), **garder l'ancienne version dans le code tant qu'un jour du registre s'en sert** (`OLDEST_GENERATOR` = 15 ; `registreJours.test.ts` : chaque version du registre est connue et la plus ancienne se génère), régénérer le golden (`UPDATE_GOLDEN=1`). **Jamais une date, jamais un jour du registre modifié** : `apps/api/test/jours-passes.test.ts` (les empreintes des jours protégés) échoue sinon. Un test d'une ancienne version impose sa version (`dailyCircuit(jour, 0, null, g)`) ; `test/helpers/versions.ts` garde les jours de référence des anciens golden (28/10 et 04/11/2026 : des données de test, pas des règles).
- **`ANCRE_V18`** : voir « Générateur : identité des thèmes… (lot 49) ». **Lot G1 : les médailles suivent aussi la version du registre** (v19 : seuils assouplis ; voir « Médailles calibrées (lot 35) ») ; `BASCULE_LOT_35` ne sert plus qu'aux versions d'avant la v19.

## Mesures : moments de choix (lot 21)
- **Critère de richesse d'un circuit** : les moments de choix (`choiceMoments`, `packages/sim/src/choices.ts`) remplacent la « part du temps à plein gaz » (lot 20, toujours affichée) : **freinages** du pilote d'auteur (coups de frein à moins de 0,5 s comptés pour un), **roue libre** (≥ 0,1 s sans gaz ni frein), **paroi ou fond** (une par cuve), **virages coupables** (bordés d'un bas-côté), **sauts figés** (vols ≥ 0,25 s où le frein a figé la caisse) ; `PilotRun.brakeEvents / coastEvents / freezeEvents`. Par thème dans `npm run measure:generator` ; au lot 21 : ensemble 14,7, Banquise 20,7, Rallye 15,5, Campagne 14,8, Stade 12,5, **Nuit 10,5 (la plus pauvre : le vide ne se coupe pas)**.
- **Coupe** (`AutopilotOptions.cut`, `PILOT_CUT` 0,5 m) : le pilote d'auteur refait sa meilleure course en mordant de 0,5 m sur le bas-côté intérieur des virages bordés et ne la garde que si elle est plus rapide (14 circuits sur 46) ; le script compare 0,5 / 1 / 3 m. **Le générateur ne l'essaie que sur la tentative retenue** (`bestPilotRun(track, { cut: false })` puis `withCut`) : une course de plus par tentative faisait dépasser le budget de génération de la CI. Sur une route bordée, la marge du pilote est `SHOULDER_MARGIN` (1,1 m : roues sur le vibreur) au lieu de 3,6 m.

## Relief, sauts et chute (lot 17)
**Niveaux** : `LEVEL` = 4 m. `U` / `D` = 1 niveau sur une cellule (pente 0,125) ; **`U2` `U3` `D2` `D3`** = 2 ou 3 niveaux (pente 0,25 / 0,375, `RISE_LETTERS`, `track.ts`). **→ Détail : [docs/regles/sim/relief-sauts-et-chute-lot-17.md](../../docs/regles/sim/relief-sauts-et-chute-lot-17.md)**

## Cuves (lot 18)
**Notation** (`track.ts`) : `V` cuve droite (deux parois, demi-tube), `ML` / `MR` mur latéral (une paroi, à gauche / à droite), `/c` sur un virage (`L2/c`, `R3/c`, `L/c` : sa paroi est du côté **extérieur**). **→ Détail : [docs/regles/sim/cuves-lot-18.md](../../docs/regles/sim/cuves-lot-18.md)**

## Figures (lot 20)
**Un circuit du jour = 5 à 7 figures** (`packages/sim/src/figures.ts`, `FIGURES`, 40 figures) posées à la suite par `composeFigures` (`generator.ts`) ; `composeSpec` n'en rend que le texte, […] **→ Détail : [docs/regles/sim/figures-lot-20.md](../../docs/regles/sim/figures-lot-20.md)**

## Médailles calibrées (lot 35)
**`medalsFor(tempsDuPilote, jour)`** (`medals.ts` depuis le lot 36, réexportée par `generator.ts`) : **toujours passer le jour** (sans lui : les seuils d'avant). **→ Détail : [docs/regles/sim/medailles-calibrees-lot-35.md](../../docs/regles/sim/medailles-calibrees-lot-35.md)**

## Fichiers légers et fichiers lourds (lot 36)
Le jeu (`apps/web`) ne charge pas le générateur au premier écran : le circuit du jour se calcule dans un fil de travail (`apps/web/CLAUDE.md`, « Premier chargement et chargement à la demande »). Pour que l'empaqueteur puisse l'écarter, **`sim` se lit en deux familles** — **légers** (physique, monde, rediffusion, thèmes, `medals.ts`, `dailyId.ts`, `fictionalNames.ts`, `salon.ts`) et **lourds** (`generator`, `figures`, `braking`, `autopilot`, `fictional`, `circuits`, `salonCircuit`, `traps`, `choices`, `medalStats`) ; **un fichier léger n'importe jamais, même de loin, un fichier lourd** (`test/legerete.test.ts`). Le lot 36 a déplacé, sans changer un résultat, `medalsFor` / `medalFor` / les facteurs et la bascule des médailles (`medals.ts`), `generatorVersionOf` / `dailyTrackId` / `isVariant` (`dailyId.ts`, qui lit le registre `jours-track.json` depuis le lot R11), `FICTIONAL_NAMES` (`fictionalNames.ts`) et `salonCircuit` (`salonCircuit.ts`) ; `generator.ts`, `fictional.ts` et `index.ts` les réexportent, rien ne change pour les importeurs. `package.json` déclare `"sideEffects": false` (sans cela l'empaqueteur garde tout module qui lit une propriété d'un objet importé au niveau du module). **Une fonction dont le premier écran a besoin va dans un fichier léger.**

## Règles de la simulation (déterminisme)
- Pas fixe (`TICK_RATE` = 120 Hz), jamais de `dt` variable ; interpolation à l'affichage seulement.
- Pas de moteur physique externe. Pas de `Math.sin/cos/exp/pow/tanh/atan2/…` dans `sim` : implémentations maison ou tables (`sin`/`cos` de `math.ts` ; saturation rationnelle `tireCurve` = t / ⁴√(1 + t⁴) ; angles de glissement, tangage et roulis gardés en **pentes** (rapports), jamais convertis en angles ; amortissements en `x * (1 − k·dt)`).
- Modifier une valeur par défaut de `CarParams` (ou la géométrie de `car.ts`) = incrémenter `SIM_VERSION` + régénérer les références (et `GENERATOR_VERSION` si le temps du pilote change, ce qui est presque toujours le cas).
- Commandes de la voiture = entiers (`makeInput`) ; l'état de référence de `car.test.ts` ne change que si la physique change volontairement.
- Pas de `Math.random` ni `Date` dans `sim` : PRNG à graine explicite.
- Une course = la suite des commandes du joueur ; le même code la rejoue côté serveur.
