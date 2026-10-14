# Retouche 29b — Une CI fiable

**Pas de scénario de jeu à tester** : rien ne change dans le jeu ni dans `sim` (versions 14 / 15, golden inchangés). Un simple retour de ce README suffit. PR : [#53](https://github.com/Nathan-Te/DailyTrack/pull/53).

**Objet** : rouge = vrai problème. Avant : un seul job `e2e` de 27 à 47 min (3 navigateurs en série, 2 cœurs, rendu logiciel), rouge sur `main` depuis le 8 octobre, « échec connu » devenu une habitude. Après : **10 à 13 min** du push au verdict.

## Avant / après

| | Avant (runs de `main` du 13/10) | Après (cette branche) |
|---|---|---|
| Durée du push au verdict | 26,8 min (4 échecs) et 46,6 min (12 échecs) | **≈ 10–13 min** (12 jobs en parallèle : Chromium 8 parts, Firefox 2, WebKit 2) |
| Relance | aucune | `retries: 1` **en CI seulement** ; réussite à la relance = test **« instable »**, nommé dans le résumé du run et annoté `::warning` |
| Rapport | un journal de 500 lignes | rapports « blob » fusionnés en un seul (artefact `rapport-e2e`), résumé Markdown en tête du run, **trace de tout essai raté** (artefacts `resultats-*`) |
| Statut à exiger | `e2e` (un job) | `test` et `e2e` (**`e2e` = verdict unique** : `e2e-parts` ne sert qu'à répartir) |

Runs de la branche (le résumé de chacun est dans l'onglet « Summary » du run) :

| Run | Commit | Durée | Résultat |
|---|---|---|---|
| [#244](https://github.com/Nathan-Te/DailyTrack/actions/runs/38534870654) | `91ce80f` | 13 min | 210 réussis, **3 instables, 2 échecs** (premier run complet de la matrice) |
| [#246](https://github.com/Nathan-Te/DailyTrack/actions/runs/38537592182) | `ccb5ce8` | 12 min | 213 réussis, 1 instable, 1 échec |
| [#248](https://github.com/Nathan-Te/DailyTrack/actions/runs/38539728315) (push) | `5efb9a7` | 10 min | **vert** |
| [#249](https://github.com/Nathan-Te/DailyTrack/actions/runs/38539737042) (PR, même commit) | `5efb9a7` | 13 min | 214 réussis, 0 instable, **1 échec** : `thumbnails` (délai, corrigé ci-dessous) |
| [#252](https://github.com/Nathan-Te/DailyTrack/actions/runs/38542158246) (push) | `8793daa` | 13 min | **vert**, 214 réussis, **1 instable** : `figures` admin (WebKit), corrigé ci-dessous |
| [#253](https://github.com/Nathan-Te/DailyTrack/actions/runs/38542166578) (PR, même commit) | `8793daa` | 13 min | **vert** |
| [#254](https://github.com/Nathan-Te/DailyTrack/actions/runs/38543987601) (push) | `f2486ac` | 12 min | **vert**, mais **4 instables** : `salon` ×2, `tactile` ×2 (corrigés ci-dessous) — le résumé les montre, la relance les a fait passer |
| [#255](https://github.com/Nathan-Te/DailyTrack/actions/runs/38543991665) (PR, même commit) | `f2486ac` | 12 min | **vert** (instables : non relevés) |
| [#258](https://github.com/Nathan-Te/DailyTrack/actions/runs/38546323921) (push) | `f72df5c` | 13 min | 214 réussis, **0 instable** (les 4 corrections tiennent), **1 échec** : `watch` « Salon (démo) … session en cours » (corrigé ci-dessous) |

**Critère d'arrêt « trois runs complets verts d'affilée, 0 instable »** : **pas encore atteint, honnêtement**. Dernière série : #252 à #255 verts (12 à 13 min) — mais « vert » ne veut pas dire « sans instable » : #252 avait 1 instable (`figures`), #254 en avait 4 (`salon`, `tactile`), tous corrigés depuis ; #249 était rouge (`thumbnails`). L'agent de session ne peut pas relancer un run (403 : seuls les nouveaux commits en lancent, un par événement `push` et `pull_request`). **À faire par Nathan** : sur la PR, *Re-run all jobs* jusqu'à avoir trois runs verts sans « Tests instables » dans le résumé, puis fusionner ; chaque run se lit en tête de sa page (« Résultats e2e »).

## Familles instables : cause et correction

Aucun test n'a été supprimé, sauté pour être vert ni affaibli. Chaque cause a été trouvée dans les journaux, les traces ou une reproduction locale.

| Famille | Cause | Correction |
|---|---|---|
| **`salon-serveur`** (« session 29865444 attendue, 29865445 reçue ») | Le test visait la « prochaine minute » avec l'heure de la machine ; une CI lente laissait finir la session (1 min) avant la fin des deux courses | Le serveur de test a des sessions de **3 min** (`SALON_MINUTES=3`) et le test lit session et heure **sur le serveur** (`/api/salon/now`), jamais `Date.now()` ; attente du début de session par interrogation |
| **`watch-serveur`** + `salon-serveur` | Les deux specs comptaient les présents sur **le même serveur** (8788) : les joueurs de l'un s'ajoutaient aux comptes de l'autre | **Un serveur par spec** (8789 pour `watch-serveur`, sessions de 2 min) ; le test attend d'être à ≥ 50 s de la fin de session (horloge du serveur) |
| **`watch`** « ralenti » | Rapport de cadence mesuré sur 0,7 s soit 2 ou 3 images en rendu logiciel (0,21 relevé pour > 1,5) | Mesure sur l'horloge **de la page** et sur **3 s** ; même seuil (1,5, le vrai rapport est 4) |
| **`watch`** « caméras » | Touche **C** pressée toutes les 500 ms ; une image dure plus et la suivante arrivait avant la lecture de la précédente | On attend que **la caméra ait changé** avant d'appuyer de nouveau |
| **`watch`** « barre de progression » | À `timescale=6` une image avance la lecture de 360 pas : la fenêtre « pas < 200 » n'était jamais vue (180 s puis échec, à chaque essai) | `timescale=2` (120 pas par image au plus) |
| **`planning`** (Firefox) | Le jeu a besoin de WebGL ; le Firefox de la CI n'en a pas, `__cdj` n'existe jamais : 40 s d'attente puis échec **à chaque run** (reproduit en local) | Test **scindé** : le panneau reste testé dans les 3 navigateurs, « le jeu respecte le remplacement » est sauté **par capacité** (`hasWebGL`) là où WebGL manque (Chromium et WebKit le jouent) |
| **`daily`** (« la voiture roule ») | Distance mesurée après 2,5 s de temps réel : 10,6 m pour 13 attendus sous charge | Pas à pas : `manual(true)` + `advance(300)` ; seuil inchangé (5 m) |
| **`daily`** « trois dates » | Trois chargements de suite dans 90 s (20 à 40 s chacun en CI) | Délai du test 240 s, de chaque attente d'état 60 s (aucune assertion changée) |
| **`salon`** « en cours de session » | Le premier du classement **change** tant que les 10 joueurs fictifs ne sont pas tous calculés : « Démo Sirocco » attendu, « Démo Bouchon » reçu | On attend l'état stable (fantômes = classement courant) avant de comparer |
| **`salon`** « course commencée avant la fin » | `phase = racing` est vrai avant que la course lancée par `autoplay` ait démarré : une fin de session pendant le décompte va droit au podium, jamais « overrun » | On attend `car.tick > 120` avant de déplacer l'horloge |
| **`accueil`** « Copier mon code » | **Bombe à retardement** : un ancien record écrit en dur au 20/10/2026 qui est devenu « aujourd'hui » dès que l'horloge de test a visé ce jour (le test aurait aussi échoué le vrai 20/10) | L'ancien jour se calcule : `TODAY − 5` |
| **`accueil`** « manette » | Bouton tenu 700 ms ; le jeu lit la manette une fois par image, plus longue que cela en rendu logiciel | Le bouton reste enfoncé **jusqu'à ce que l'effet soit visible** |
| **`thumbnails`** « 15 miniatures » | Quinze miniatures en WebGL logiciel : ≈ 52 s en local, plus de 180 s en CI (3 runs sur 4) ; aucune autre cause dans les traces | Délai du test **420 s** (mesure citée dans le fichier) ; aucune assertion changée |
| **`figures`** admin (WebKit, instable) | Le « change » du champ variante part au départ du focus et **redessine la page**, qui remet la case « Miroir » à son état d'avant : un clic juste avant est annulé (« Clicking the checkbox did not change its state »). Course réelle de l'interface d'admin, hors jeu | Le test valide la variante (`blur`, attente de `v=1` dans l'adresse) **avant** de cliquer la case ; mêmes assertions |
| **`salon`** « en cours de session » (instable, 2ᵉ passe) | Les fantômes sont ceux **du départ en cours** (`GhostField.active`) : tant que le classement fictif s'allonge, ils ne sont plus ceux du premier ; mon attente d'« état stable » ne pouvait donc jamais aboutir (120 s) | On redonne un départ (Entrée) après chaque mise à jour du classement jusqu'à ce que les fantômes du départ soient ceux du classement (10 essais au plus, puis assertion) |
| **`salon`** « touche G » (instable) | « aucun fantôme » lu 500 ms après la touche : 2 voitures encore dessinées | On attend `ghosts.shown === 0` |
| **`tactile`** « deux pédales », « ancien défaut » (instables) | `__cdj.input` est lu image par image ; 5 s ne suffisent pas toujours en rendu logiciel (0 relevé pour 64 attendu) | Attente de 30 s (elle s'arrête dès que l'état est atteint) dans tout le fichier |
| **`watch`** « Salon (démo), session en cours » | Le lien de la page d'origine porte `salonAt` : la page de lecture repart de cette heure **fixe**, plus tôt que l'horloge de la page d'origine (avancée pendant l'attente, longue en CI) ; les joueurs fictifs se révèlent avec l'horloge, donc « annoncé ≤ premier lu avant le clic » était faux à chaque essai | Le tour regardé doit être le temps classé de **ce joueur** (nom et temps, à la milliseconde) dans le classement de la session ; l'ancienne comparaison au `first` de la page d'origine est retirée (elle supposait une horloge qui ne recule pas). **Test modifié, avec cette raison** |
| **`api-image`** (`npm run smoke`, hors e2e) | Le contrôle supposait qu'**un seul niveau** de pilote (adhérence 0,9) finit le circuit du Salon **en cours à l'heure réelle** (session de 10 min). Pour la session 2986621 (thème Nuit) 0,9 et 0,85 échouent, 0,8 finit en 38,78 s (reproduit en local) : le générateur valide un circuit avec plusieurs niveaux, pas avec celui-là. Rouge intermittent selon l'heure du run | `localPilot` essaie 0,9 → 0,5 (comme `salon-serveur`) ; aucun contrôle retiré |
| **Minuit UTC** | Plusieurs specs calculaient « aujourd'hui » avec l'heure réelle ; un run qui passait minuit changeait de jour | **Horloge maîtrisée** (voir ci-dessous) |

### Horloge maîtrisée
- `playwright.config.ts` fixe **une fois** un décalage tel que « maintenant » = **20/10/2026 à midi UTC**, puis le temps passe normalement. Les serveurs de test le reçoivent (`TEST_CLOCK_OFFSET_MS`) ; `e2e/fixtures.ts` décale `Date` des pages (`test`, `newClockedContext`, `TODAY`, `clockNow`).
- **Côté API** : `TEST_CLOCK_OFFSET_MS` est **refusée en production et sur Cloud Run** (`config.ts`, test `production.test.ts`), signalée par `/api/health` (`testClock: true`, absent sinon).
- **Écart au cahier des charges** : pas `page.clock.install` de Playwright. Essayé et **mesuré** : il remplace `requestAnimationFrame` par un minuteur de 16 ms qui ignore le rendu (34 images/s simulées contre 3,5 réelles) et affame le fil principal (un test du Salon passait de 15 s à 66 s). On décale donc seulement `Date`.

## Tests modifiés (liste complète)
`watch`, `watch-serveur`, `salon-serveur`, `salon`, `planning` (scindé), `daily`, `accueil`, `thumbnails` : voir le tableau ; `leaderboard`, `mobile`, `juice`, `share`, `conduite`, `surfaces` : seulement l'import de `./fixtures` et `TODAY` à la place de `Date.now()`. Ajouts : `apps/api/test/production.test.ts` (horloge de test), `apps/web/test/e2eSummary.test.ts` (résumé des instables).

## À activer par Nathan : protection de `main` (je ne peux pas le faire)
1. GitHub → dépôt **DailyTrack** → **Settings** → **Branches** → *Add branch ruleset* (ou *Add classic branch protection rule*) → cible `main`.
2. Cocher **Require status checks to pass before merging** (et *Require branches to be up to date*).
3. Chercher et ajouter **`test`** et **`e2e`** (ils n'apparaissent qu'après un run sur la branche : c'est le cas). **Ne pas** ajouter `e2e-parts (…)` : ce sont les 12 parts, `e2e` est leur verdict.
4. Enregistrer. **Ce que tu dois voir** : sur une PR, la liste des vérifications affiche `test` et `e2e` marqués « Required », et le bouton de fusion reste grisé tant que l'un est rouge.

## Garde-fou nocturne
`ci.yml` se lance aussi chaque nuit à **03 h 17 UTC** sur `main` (aussi à la main : *Run workflow*). À ce run, **un test instable fait échouer le job** : une instabilité qui revient se voit (mail GitHub) au lieu de se cacher derrière la relance.

## Suivi des instables
Voir `docs/orchestration.md` § 8. Dernier run observé avec instable : #252 (`figures` WebKit, corrigé). Le run de nuit dira si un autre revient.

## Vérifications
- `npm test` : 848 tests + 118 (projets `sqlite` puis `libsql`) verts ; `npm run typecheck` vert.
- e2e rejoués en local (Chromium, et Firefox pour `planning`) pour chaque test modifié ; CI : voir le tableau des runs.
- **Non vérifié** : la règle de protection de branche (réglage GitHub) ; le run de nuit (il ne se déclenchera qu'à 03 h 17 UTC sur `main`, donc après la fusion).
