# Lot 36 — Track : alléger le premier chargement

Objet : sortir du premier chargement de Track tout ce dont le premier écran n'a pas besoin, **sans rien retirer au joueur et sans le ralentir**. Les relèvements de plafond que Nathan prévoit serviront ainsi à de vraies améliorations du jeu, pas à réabsorber du code que le premier écran n'utilise pas.

Zones : `apps/web/**`, `packages/sim/**` (fichiers déplacés, **aucun résultat de simulation ne change**), `docs/lots/**`, `docs/orchestration.md`, la ligne de Track de `docs/plateforme/budgets.md`, `e2e/durees.json`. Pas d'API, pas de classement, pas de rediffusion, pas de catalogue.

## Résultat en trois lignes

- **Premier chargement de Track : −21,2 ko compressés** (275 489 → 254 268 o de JS, CSS inchangé à 11 412 o ; objectif du lot : 4 ko). Marge JS + CSS : 125 o → **21 720 o** sous le plafond inchangé de 287 400 o.
- **Rien n'est plus lent, la plupart des temps sont meilleurs** (profil téléphone, processeur ×4, 4G lente) : accueil affiché −0,6 s à froid, circuit du jour prêt −0,35 s ; le Salon prêt et la bascule d'une session ne bougent pas. Une exception chiffrée plus bas : l'entrée dans le Salon coûte un aller-retour réseau de plus (+0,2 s à processeur ×1, invisible à ×4).
- **Le circuit est le même au bit près** (golden inchangés ; le jeu compare le circuit rendu par le fil de travail à celui de Node) ; ce qui a changé, c'est où il est calculé : un fil de travail, comme les miniatures. Vérifié ici en Chromium ; Firefox et WebKit : la CI (non installés dans ce conteneur).

## 1. Comment on mesure le premier chargement (changé dans ce lot)

Avant : `e2e/perf.spec.ts` additionnait **tout** le JS de `dist/assets` moins une liste de noms de fichiers (`circuitWorker-`, `salonWorker-`, `catalogue.en-`, `tune-`). Tout nouveau morceau chargé à la demande y comptait donc **en plus** : c'est ce qui rendait l'essai du lot 34 (« sortir les scénarios d'essai ») sans gain (+100 o) — le morceau à part était compté, avec sa compression perdue.

Maintenant : `premierChargement()` (`perf.spec.ts`) suit ce que **`index.html` demande** — le script d'entrée, les `modulepreload` et, de proche en proche, leurs imports statiques — comme un navigateur. Un morceau chargé par `import()` ou un fil de travail n'y compte jamais, **quel que soit son nom**. La page d'admin (`admin-*.js`, jamais chargée par un joueur) y reste comptée à part, comme depuis le lot 35 : l'exclure est une décision de plateforme (voir § 8). Les plafonds ne bougent pas.

Conséquence : `main` (`826ba25`) mesuré par la nouvelle méthode donne **275 489 o** de JS (au lieu de 275 863 o : la page `verify` du test de rejeu, 374 o, n'est plus comptée). C'est le « avant » de ce lot.

## 2. État des lieux : les 20 plus gros postes du premier chargement (avant le lot)

Outil : un plugin Vite jetable (hors dépôt) qui lit la taille rendue de chaque module par morceau (`chunk.modules[…].renderedLength`) ; la taille compressée d'un module est **estimée** au prorata de son morceau (la compression se fait par fichier). Total estimé : 264,5 ko (mesuré : 264,7 ko). Sans dépendance ajoutée au dépôt.

| # | Poste | ≈ ko gz | Premier écran ? | Ce que le lot en fait |
|---|---|---|---|---|
| 1 | three.js (`three.core` + `three.module`) | 132,8 | oui : la scène 3D derrière l'accueil | reste (50 % du total) |
| 2 | `main.ts` (boucle, HUD, orchestration) | 16,8 | oui | reste (il ne tire plus le Salon, les scénarios ni la démo) |
| 3 | `trackMesh.ts` (le circuit 3D) | 12,6 | oui | reste |
| 4 | catalogues français + catalogue commun | 7,4 | oui (l'anglais est déjà à part) | reste |
| 5 | `sim/car.ts` (physique) | 5,2 | oui | reste |
| 6 | `sim/figures.ts` (bibliothèque de figures) | 5,0 | **non** : seul le générateur s'en sert | **quitte** → fil de travail / morceau de génération |
| 7 | `sim/generator.ts` | 4,6 | **non** | **quitte** |
| 8 | `sim/autopilot.ts` (pilote de validation, démo) | 3,3 | **non** | **quitte** |
| 9 | `fx.ts` (particules, traces) | 3,3 | oui (créé au démarrage) | reste |
| 10 | `sim/track.ts` | 3,1 | oui (`parseTrack`) | reste |
| 11 | `carMesh.ts` | 2,9 | oui | reste |
| 12 | `salonMode.ts` | 2,8 | **non** : Salon seulement | **quitte** → `salonBundle` |
| 13 | `homeUi.ts` (accueil) | 2,6 | oui | reste |
| 14 | `audio.ts` | 2,4 | oui (premier geste) | reste |
| 15 | `trackProps.ts` | 2,0 | oui (scène) | reste |
| 16 | `settingsUi.ts` | 1,9 | non, mais… | **essai abandonné** (§ 6) |
| 17 | `touchUi.ts` | 1,9 | oui sur téléphone | reste |
| 18 | `thumbnail.ts` | 1,7 | oui (miniature de l'accueil) | reste |
| 19 | `@cdj/ui` `composants.ts` | 1,7 | oui | reste |
| 20 | `touch.ts` | 1,7 | oui sur téléphone | reste |

Suivants, tous **non** nécessaires au premier écran et partis avec le Salon : `salonArrivee.ts` 1,5 ko, `salonGhosts.ts` 1,4, `salonDemo.ts` 1,3, `salonUi.ts` 1,1, `watchUi.ts` 0,8, `salonEngine.ts` 0,5, `salonPlan.ts` 0,5 ; et `circuits.ts` 0,7 (scénarios d'essai), `braking.ts` 0,8, `fictional.ts` 0,5. `archive.ts` (1,6) : **essai abandonné** (§ 6).

## 3. Ce qui a quitté le premier chargement, et où il est chargé

| Quoi | Où il est maintenant | Quand |
|---|---|---|
| Générateur, figures, règles de freinage, pilote de validation, thèmes tirés au sort, médailles du générateur (`sim`) | **`circuitWorker.ts`** (fil de travail partagé avec les miniatures), via `circuitEngine.ts` | à la première demande de circuit, **pendant que le planning est demandé** |
| Le même calcul sur le fil principal | morceau `circuitCalc` (`import()`) | seulement si le navigateur n'a pas de fil de travail, ou s'il tombe |
| Circuits des scénarios d'essai (`?scenario=…`), circuit de secours | `scenarios.ts` (`import()`), avec la bibliothèque de figures | seulement si l'adresse demande un scénario |
| Pilote automatique de la démo (`?demo`) | `demoPilot.ts` (`import()`) | seulement avec `?demo` |
| Le Salon (contrôleur, démo, fantômes, arrivée, classement) et le spectateur (`?watch=`) | **`salonBundle.ts`** (`import()` en tête de `main.ts`) | seulement avec `?mode=salon` ou `?watch=` |
| Calcul de la session du Salon sur le fil principal | `salonJobs.ts` (`import()`) | seulement sans fil de travail |

Ce que le fil principal garde : la physique (`car`, `track`, `world`, `race`), la rediffusion, le rendu, les thèmes, **les médailles** (`medalFor`), **les identifiants de jour** (`dailyTrackId`, `generatorVersionOf`), les noms des pilotes fictifs, les adresses du Salon. Pour cela `sim` a été **découpé sans changer un résultat** :

- `medals.ts` (`medalsFor`, `medalFor`, les facteurs et la bascule du lot 35) et `dailyId.ts` (`dailyTrackId`, `generatorVersionOf`, `isVariant`, la bascule du lot 34) sortent de `generator.ts` ; `fictionalNames.ts` sort de `fictional.ts` ; `salonCircuit.ts` sort de `salon.ts`. `generator.ts` réexporte les deux premiers : aucun importeur ne change.
- `packages/sim/package.json` : **`"sideEffects": false`**. Sans cela, l'empaqueteur gardait tout module qui lit une propriété d'un objet importé au niveau du module (`DEFAULT_CAR_PARAMS.maxSpeed * 1.3` dans le générateur) et tirait donc le générateur dès qu'un fichier du jeu importait `@cdj/sim`. C'était la cause racine de l'échec de l'essai du lot 34.
- `apps/web` : `salonLien.ts` (`modeHref`, `sessionMsFromParams`) sort de `salon.ts` ; la bascule `salonMod` de `main.ts` ; `circuitCalc.ts` / `circuitEngine.ts` / `scenarios.ts` / `demoPilot.ts` / `salonBundle.ts` sont nouveaux.

### Le fil de travail, de bout en bout

1. Au démarrage, `main.ts` demande le circuit d'origine du jour (variante 0, sans thème imposé) au fil de travail **avant** d'interroger le planning (`fetchDayPlan`, jusqu'à 2,5 s). Si le planning confirme le circuit d'origine (presque tous les jours) il est déjà prêt ; sinon c'est le circuit du planning qu'on demande, et le premier calcul est jeté (le résultat ne dépend que de la date, de la variante et du thème : rien n'est perdu).
2. Le fil rend `CircuitData` : texte du circuit, identifiant, tentative, temps de l'auteur, **médailles**, thème, palette, noms des figures. Le jeu fait `parseTrack(id, texte)` (`dailyFromData`).
3. Les miniatures (archives, carte du jour, variantes de l'admin) demandent au **même** moteur : un seul fil pour tout. Le Salon garde son fil (`salonWorker.ts`), inchangé.
4. Sans fil de travail : même calcul, dans un morceau chargé à la demande, déclaré (`engine.onMainThread`, compteur `mainThreadGenerations` des miniatures, toujours 0 dans les tests).

### Preuve que le résultat est identique

- **Golden** (`packages/sim/test/golden-daily.test.ts`) : inchangés, aucune régénération, `SIM_VERSION` 14 et `GENERATOR_VERSION` 16 inchangées.
- **`apps/web/test/circuitEngine.test.ts`** (nouveau, 8 tests) : `computeDaily` = `dailyCircuit` (texte, tentative, auteur, médailles, thème, palette, figures, identifiant) pour 4 combinaisons variante / thème ; les données survivent à la copie du fil (JSON) et redonnent les mêmes blocs ; sans fil de travail le même circuit ; avec un faux fil (réponse, chargement en échec, réponse « échec ») le même circuit ; circuit de secours.
- **`apps/web/e2e/daily.spec.ts`** : le test d'origine (page `verify.html`, **Chromium, Firefox, WebKit**) est inchangé et vert ; un test nouveau ouvre **le jeu** (le circuit vient donc du fil de travail) sur quatre dates du golden (06/10, 21/10, 28/10 = jour de la bascule, 25/12) et compare, via `__cdj.circuit`, le texte, la tentative, le temps de l'auteur, la palette, le thème, le numéro et l'identifiant à ceux de Node. (Rendu 3D : Chromium seulement, comme le reste de ce bloc.)
- **`packages/sim/test/legerete.test.ts`** (nouveau) : aucun fichier « léger » de `sim` n'importe, même de loin, le générateur, les figures, le freinage, le pilote ou les circuits d'essai — l'architecture est gardée à la source.

## 4. Poids : avant / après

Octets compressés (gzip), méthode de `perf.spec.ts` (§ 1) ; « avant » = `main` (`826ba25`) reconstruit à part et mesuré par la même méthode.

| | Avant | Après | Δ | Plafond | Marge |
|---|---|---|---|---|---|
| JS du premier chargement (admin compris) | 275 489 | **254 268** | **−21 221** | 276 000 | 21 732 |
| CSS | 11 412 | 11 412 | 0 | | |
| **JS + CSS** | 286 901 | **265 680** | **−21 221** | 287 400 | **21 720** |
| dont hors three.js (admin compris) | 142 723 | **121 502** | −21 221 | 143 300 | 21 798 |
| fil de travail des circuits (miniatures, jeu) | 26 542 | 26 524 | −18 | 26 600 | **76** |
| fil de travail du Salon | 28 513 | 28 502 | −11 | 30 000 | 1 498 |
| catalogue anglais | 7 297 | 7 297 | 0 | 8 000 | 703 |
| polices | 139 604 | 139 604 | 0 | 153 600 | 13 996 |
| morceaux à la demande, ne comptent pas (gz) | — | génération sur le fil principal (repli) 17,4 ko : générateur 5,6, figures 5,0, pilote 4,1, circuits 0,9, calcul du Salon 1,2, scénarios 0,4, moteur 0,2, démo 0,1 ; Salon et spectateur 11,3 ko | | | |

(Les chiffres « avant » des deux fils de travail sont ceux de ce poste ; le tableau du lot 35 de `budgets.md` donnait 26 486 et 28 446 pour `main` : l'écart, d'environ 60 o, est constant et se retrouve dans les deux colonnes. Les marges de `budgets.md` sont recalculées avec les chiffres de ce poste, les plus hauts : le test passe avec elles.)

**Ce que cela change pour un joueur qui vient pour la première fois (honnêteté)** : le fil de travail est une **copie** de la simulation (physique, pilote, générateur). Un nouveau joueur télécharge donc, au total, **+5,2 ko** de JS (le premier chargement −21,2 ko, plus le fil des circuits, 26,4 ko, téléchargé en parallèle). Ce qui baisse, c'est ce qui **bloque** le premier écran (code à télécharger, analyser et exécuter avant l'accueil) et le plafond mesuré ; la visite suivante ne retélécharge rien (le fil est en cache). Le gain de poids à la première visite n'est donc pas un gain d'octets transférés mais de travail sur le chemin critique — les temps du § 5 le disent.

## 5. Temps : avant / après

Profil téléphone d'`e2e/perf.spec.ts` (390 × 844 ×2, **processeur ×4**, 4G lente : 150 ms, 1,6 Mbit/s), Chromium en rendu logiciel, 5 essais, médiane ; `?api=demo` (sans serveur). « Froid » = cache vide, « chaud » = deuxième visite. Outil : un script Playwright jetable (hors dépôt).

| Mesure | Avant | Après | Δ |
|---|---|---|---|
| Accueil affiché (froid) | 4 797 ms | 4 177 ms | **−620 ms** |
| Accueil affiché (chaud) | 3 362 ms | 2 801 ms | **−561 ms** |
| Circuit du jour prêt (froid) | 5 521 ms | 5 165 ms | **−356 ms** |
| Circuit du jour prêt (chaud) | 4 092 ms | 3 775 ms | **−317 ms** |
| Circuit du jour prêt, planning à 150 ms (serveur local) | 5 509 ms | 5 169 ms | −340 ms |
| Salon prêt (froid) | 5 254 ms | 5 250 ms | −4 ms |
| Bascule d'une session du Salon (fin de session → nouveau circuit en jeu, dont 8 s de classement final), 3 essais | 12,4 à 13,2 s ; échange de scène 4 à 17 ms | 12,5 à 13,4 s ; échange de scène 12 à 20 ms | inchangé |

Et à **processeur ×1** (3 essais) : accueil −186 ms (froid) / −72 ms (chaud), circuit du jour prêt −173 ms (froid) / +5 ms (chaud), **Salon prêt +203 ms** (froid). C'est le seul recul mesuré : `?mode=salon` charge maintenant le morceau du Salon (`salonBundle`, 10,8 ko) avant de s'amorcer, soit **un aller-retour réseau de plus** (150 ms émulés) ; à ×4 il disparaît dans le bruit. La bascule d'une session ne change pas : tout est déjà chargé dans la page, et le circuit suivant vient du même fil (`mainThreadGenerations` reste 0).

Pourquoi c'est plus rapide : la génération (≈ 0,2 s à ×1, ≈ 0,8 s à ×4) n'est plus sur le fil principal, **et** elle commence pendant l'attente du planning au lieu de la suivre ; le fil principal analyse 21 ko de JS de moins avant le premier écran.

**Non mesuré** : un vrai téléphone, une vraie carte graphique (le rendu 3D est logiciel ici, ce qui n'influe pas sur ces mesures de JavaScript mais borne leur lecture absolue), le serveur de production (le planning y répond en ≈ 50 à 150 ms, ce qui laisse encore plus de temps au calcul spéculatif).

## 6. Essais abandonnés, chiffrés

- **Archives en chargement à la première ouverture** (`archive.ts`, `archiveExtras.ts` en `import()`) : **−787 o** seulement sur le premier chargement (243 395 contre 244 182 o), et 7 fichiers de plus à la requête. L'empaqueteur garde dans les morceaux communs ce que l'accueil partage avec les archives, et chaque fichier compressé seul perd sa redondance. En échange, un aller-retour réseau à l'ouverture des archives. Abandonné.
- **Réglages en chargement à la première ouverture** (`settingsUi.ts`) : **−576 o** de plus (les deux essais ensemble : −1 363 o, 9 fichiers de plus). Abandonné pour les mêmes raisons.
- **Regrouper ce qui est à la demande par `manualChunks`** (deux morceaux préfixés `demande-`) : l'empaqueteur a avalé three.js dans le morceau du Salon (643 ko), le contraire de l'effet voulu. Abandonné ; les morceaux gardent les noms que l'empaqueteur leur donne, et la mesure suit le graphe, pas les noms.
- **Non essayés, faute de gain net attendu** : le son (`audio.ts`, 2,4 ko : démarre au premier geste, risque de retard du premier bruit), l'aide « Comment jouer » (840 o, ouverte d'office à la première visite : les nouveaux joueurs, justement), les commandes tactiles (3,6 ko : le jeu se joue au doigt).

## 7. Ce qui empêche d'aller plus loin

three.js pèse **132,8 ko, soit 52 % du premier chargement** ; le rendu de la scène (`trackMesh.ts` 12,6 ko, `trackProps`, `carMesh`, `fx`, `thumbnail` : ≈ 25 ko) et la boucle du jeu (`main.ts`, 17 ko) servent le premier écran (la scène tourne derrière l'accueil) ; le catalogue français (7,4 ko) est dans le HTML pré-rempli et les textes de l'accueil. Ce qui reste de « non nécessaire au premier écran » (archives, réglages, aide) se découpe mal : chaque coupe rend moins de 1 ko. Les deux pistes qui rendraient davantage : (1) **tailler three.js** (importer les seules classes utilisées, désactiver les matériaux et chargeurs inutilisés : décision de rendu, hors périmètre de ce lot), (2) **scinder le catalogue français par écran** (le Salon, les réglages : ≈ 3 ko), au prix d'un chargement de langue par écran.

## 8. Pour un lot de plateforme (signalé, non fait)

`scripts/budgets.mjs` (`mesureTrack`) suit la même méthode que l'ancien test : tout le JS de `dist/assets` moins quatre préfixes. **Il compte donc maintenant les morceaux à la demande de ce lot** (générateur, Salon, scénarios, démo) et affiche ≈ 294,9 ko de JS + CSS au lieu de 265,7 ; il compte aussi `admin-*.js` (10,9 ko, jamais chargé par un joueur) et `verify-*.js`. Proposition : remplacer la liste de préfixes par le **graphe statique de `index.html`** — exactement `premierChargement()` de `apps/web/e2e/perf.spec.ts` (dix lignes) — et exclure `admin-*.js`, ce qui rendrait ≈ 10,9 ko de marge de plus (à décider avec Nathan : les plafonds de `budgets.md` ont été relevés en comptant l'admin). `docs/plateforme/budgets.md` donne les chiffres de la méthode du test, qui fait foi.

## 9. Vérifié, non vérifié

**Vérifié (ce conteneur)** : `npm run typecheck` ; `npm test` (SQLite et libSQL : 186 + 27 fichiers, 2 448 + 390 tests, dont les golden, la pureté, `legerete.test.ts`, `circuitEngine.test.ts`, `budgets.test.ts`) ; `npm run build` ; la suite e2e Chromium en entier (deux travailleurs, 333 tests : **274 réussis, 56 sautés (outils de captures et de mesure), 3 échoués**, détaillés ci-dessous) ; `perf.spec.ts`, `daily.spec.ts` (avec le nouveau test), `thumbnails.spec.ts` repassés sur le dernier build ; les temps du § 5 et la bascule du Salon.

**Les 3 échecs de la suite locale** — la machine tournait à une charge de 8 sur 4 cœurs, des tests de cadence en rendu logiciel :
- `accueil.spec.ts:116` (« Salon live » ouvre le Salon) : le classement final d'une session d'**une minute** recouvrait le bouton de la pause au moment du clic ; repassé seul : réussi à chaque fois.
- `watch.spec.ts:52` (pause, ralenti, accéléré) : délai de 180 s dépassé. **Échoue aussi sur `main`** dans ce conteneur (2 essais sur 4) ; réussi seul sur le build du lot.
- `salon.spec.ts:285` (le classement final reste 8 s, deux navigateurs) : « aucune image pendant le classement final » (une image a duré plus de 7 s). **Dépend de la charge de la machine, pas du lot** : seul, il réussit presque toujours sur les deux builds (3 échecs sur ≈ 35 essais sur le build du lot, tous juste après un autre test ou machine encore chargée, 0 sur 14 sur `main`) ; **avec trois boucles occupant les cœurs, il échoue à chaque fois sur les deux** (8 essais sur 8 sur le build du lot, 6 sur 6 sur `main`). Les tâches de 3 à 4 s autour de la fin de session (construction de la scène suivante en rendu logiciel) sont les mêmes des deux côtés. Rien de ce lot ne touche à ce déroulé.
- Un quatrième échec, une fois, dans une exécution mêlée : `thumbnails.spec.ts:126` (« rien de fabriqué course rouvrante », 2 images au lieu d'1 : la fabrication en cours dépasse 500 ms en rendu logiciel chargé) ; réussi 4 fois sur 4 seul.

**Non vérifié** : Firefox et WebKit (non installés ici : `daily.spec.ts` y tourne en CI, c'est le test qui garde le déterminisme entre navigateurs) ; un vrai téléphone et une vraie carte graphique ; le serveur de production ; la CI de la PR (`test`, `e2e`).

## 10. Pour Nathan

- **Décisions** : (1) valider que le plafond de 287 400 o n'est pas baissé et que la place devient de la marge (21,7 ko) — c'est la règle du lot ; (2) l'exclusion de `admin-*.js` et l'alignement de `budgets.mjs` (lot de plateforme, § 8) ; (3) le coût d'entrée du Salon (+1 aller-retour) est accepté ; une précharge dans `index.html` l'éviterait mais demande de connaître le nom du morceau (lot de plateforme / construction).
- **Fil des circuits** : sa marge est de **76 o** seulement (plafond 26 600 o, inchangé, miniatures et circuit du jour) ; tout ajout au générateur ou au pilote la dépasse (il est dans le fil du Salon aussi, 1,5 ko de marge). C'est la prochaine contrainte, avant le premier chargement.
- **Non fait** : l'index des rubriques de `CLAUDE.md` racine (zone partagée) devrait citer la nouvelle rubrique « Premier chargement et chargement à la demande (lot 36) » de `apps/web/CLAUDE.md`.

## 11. Liens à essayer sur téléphone

Le lien de l'aperçu de la PR est commenté sur la PR (CI) ; sur cette adresse, les chemins à ouvrir : `/track/` (accueil), `/track/?home=0` (une course du jour directement), `/track/?mode=salon` (le Salon : la démonstration se lance avec `&api=demo`), les archives (menu ⏸ puis « Archives », ou touche **H**), `/track/?watch=best&api=demo` (revoir le meilleur tour). À regarder : l'accueil apparaît avec son circuit sans à-coup ; le décompte démarre ; un lien partagé `?seed=AAAA-MM-JJ` donne le même circuit qu'avant.
