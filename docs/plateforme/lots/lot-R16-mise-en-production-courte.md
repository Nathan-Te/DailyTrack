# Lot R16 — une mise en production plus courte

**Pour les joueurs : rien.** Seuls des workflows, deux scripts de CI, leurs tests et la documentation changent. Aucun code de jeu, aucun golden, aucune dépendance.

## Le constat (runs du 28/10 au 02/11/2026)
Les durées viennent des jobs de « Mettre en production » : n° 26 (vert), n° 30 (le plus avancé depuis Tower), n° 31 (CI reprise), n° 32.

| étape (avant : l'une après l'autre) | durée |
|---|---|
| CI complète (la part Chromium de Track la plus lente) | ≈ 20 min (13,8 au n° 26) |
| `figer` (dont la préparation des jours de Tower : 6 à 9,5 min) | 7 à 10,5 min (1,4 avant Tower) |
| répétition sur la recette | ≈ 4,5 min |
| sauvegarde | 0,5 min |
| production (serveur, site, vérification, étiquette) | ≈ 4,5 min |
| `depot` (PR « Jours figés », sa CI, sa fusion) | 6 à 8,6 min (le résumé l'attendait) |

En tout, environ 34 min avant la production et 40 min de run. Sur les 6 runs terminés des 01 et 02/11 (le n° 33 tournait encore), 3 erreurs étaient connues vers 7–8 min mais dites à 16–17 min. `figer` n'a raté qu'une fois (n° 28), dite à 16,3 min alors que l'étape dure 17 s.

## Ce qui change
- **A — `figer` en même temps que la CI** (`needs: [verifier]`). Il ne fait que **lire** la production : la route publique du classement, l'étiquette `prod-…`, des builds locaux. Il ne touche rien. Une erreur du garde-fou se voit à environ 2 min.
- **B — la répétition en même temps que la CI** (`recette-serveur` suit `figer`, sans attendre le verdict). La recette n'est pas la production, et elle reçoit déjà chaque fusion dans `main` par `recette.yml`. Un verdict rouge arrête quand même tout avant la sauvegarde et le serveur de production.
- **D — la sauvegarde dès le verdict vert et `figer`** (`needs: [verifier, ci-verdict, figer]`), à côté de la répétition. Elle se fait toujours en lecture seule, par le même compte et dans le même environnement.
- **Le serveur de production exige tout, un par un** : `needs: [verifier, ci-verdict, figer, recette-verification, sauvegarde]`, et son `if` demande `success` pour chacun, en plus de `inputs.mode == 'production'`. Avant le lot, ce verrou passait par la chaîne des `needs` ; maintenant que les étapes tournent en parallèle, il est écrit en clair. Testé par `apps/web/test/ciComplete.test.ts`.
- **C — le versement des jours figés est un workflow à part**, « Jours figés dans main » (`.github/workflows/jours-figes.yml`, `workflow_dispatch` seulement, `concurrency: jours-figes` jamais annulé) :
  - le job `depot` de `production.yml` le **lance** (`gh workflow run … -f run= -f nom= -f veille=`) puis s'arrête ;
  - le résumé du bouton dit « versement lancé » ;
  - le script de versement est **celui d'avant, tel quel** (branche robot, démonstration de Jump refaite, PR, CI, fusion par le workflow, trois essais) ;
  - **ses entrées sont vérifiées avant tout** : forme du run, de l'étiquette et de la veille ; le run doit venir de `production.yml` sur `main` et avoir réussi `figer` et `recette-verification`. Sinon il ne prend aucun artefact. Les entrées passent par `env:`, jamais écrites dans un script (règle R7) ;
  - **le bouton suivant refuse de partir tant qu'un versement tourne**. C'est la nouvelle étape « Aucun versement de jours figés n'est en cours » de `verifier`, à côté de celle qui refusait déjà une PR robot ouverte. Le groupe `production` n'a pas été réutilisé : GitHub ne garde qu'un run en attente par groupe, et un versement en attente aurait pu annuler un clic du bouton (ou l'inverse) ;
  - droits : `production.yml` n'a plus `pull-requests: write` (`ECRITURES_PERMISES`) ; `jours-figes.yml` a `contents`, `pull-requests` et `actions` (lancer la CI de sa PR sans `ROBOT_TOKEN`, lire les artefacts d'un autre run).
- **F — les parts e2e composées avec les durées mesurées la nuit** (`scripts/durees-e2e.mjs`, testé par `apps/web/test/dureesE2e.test.ts`) :
  - la nuit, le job `e2e` mesure chaque spec dans le rapport fusionné : **le dernier essai seulement**, pour qu'une relance ne compte pas double, et en laissant de côté un fichier qui a un test en échec, puisqu'un délai dépassé gonflerait sa durée. Le résultat devient l'artefact `durees-e2e` (30 jours), et un tableau des écarts au dépôt s'ajoute au résumé ;
  - le job `scope` des runs suivants (main, complet, le bouton) retrouve **le dernier run de nuit de `ci.yml` sur `main`** qui a cet artefact. Il ne prend jamais celui d'une PR, qui pourrait modifier son workflow. Il valide les données (jeux, noms de specs, entiers de 0 à 3 600 s) et les passe à toutes les parts dans `E2E_DUREES`. Comme toutes les parts lisent la même chaîne, elles composent les mêmes parts ;
  - **une durée n'est qu'un poids** : la liste des specs vient toujours des fichiers du dépôt. Aucun spec ne peut être sauté ni lancé deux fois (testé avec des durées absurdes). Si rien n'est lisible, on prend `durees.json` du dépôt, comme avant, sans jamais s'arrêter ;
  - droits : `actions: read` pour `scope`, donc pour le job `ci` de `production.yml`, qui l'appelle.

## Durées visées (estimations, pas encore mesurées sur un vrai run)
| | avant | après A + B + D + C |
|---|---|---|
| production en ligne | ≈ 34 min | ≈ max(CI ≈ 20, `figer` 7–10 + répétition 4,5) + 0,5 + 4,5 ≈ **25 min** |
| fin du run | ≈ 40 min | ≈ 25 min (le versement tourne à part, ≈ 7 min) |
| erreur du garde-fou | ≈ 17 min | ≈ 2 min |
| CI rouge | 16–17 min | inchangé (toutes les parts finissent : la liste complète des échecs reste utile au lot de correction) |

F gagne de 0 à 5 min selon le run : la part la plus longue était à 1 121 s pour 660 s prévues au n° 30. Il ne rattrape pas les écarts dus au bruit de la machine.

## Vérifié / non vérifié
- Vérifié en local :
  - `npm run typecheck` ;
  - `node scripts/securite-workflows.mjs` (12 workflows, 0 écart) ;
  - les tests unitaires des workflows : `ciComplete`, `workflows` (dont la vérification des entrées du nouveau workflow, lancée par bash), `bouton`, `securiteWorkflows`, `e2eParts`, `ciZones`, `ciScope`, `ciE2e` de Jump et de Tower ;
  - le nouveau `dureesE2e.test.ts`, dont les 8 parts réelles de `e2e-parts.mjs` avec `E2E_DUREES`, qui couvrent chaque spec une seule fois.
- **Non vérifié** : un vrai run du bouton. Un agent ne lance pas de workflow, c'est **le prochain clic de Nathan** qui le prouvera. Points à regarder dans ce premier run :
  1. `figer` et la recette démarrent avec la CI ;
  2. `serveur` attend bien le verdict ;
  3. « Jours figés dans main » démarre, prend les artefacts du run et fusionne sa PR ;
  4. le run de nuit suivant publie `durees-e2e`, et la CI de main d'après le cite dans son résumé (« Parts e2e composées avec les durées mesurées la nuit »).
- **Limite à surveiller** : `figer` et les jobs de la CI tournent ensemble (≈ 19 jobs), sous la limite de 20 jobs simultanés de l'offre gratuite. Une part peut attendre quelques secondes, ce qui se voyait déjà au n° 30 (jusqu'à 3 min).

## Ce que le lot ne fait pas (décisions laissées à Nathan)
- **E — deux pages Playwright à la fois** sur les 4 cœurs de la machine de CI (`nproc` = 4, journal du n° 31 ; la retouche 31b avait mesuré 2 cœurs). C'est potentiellement 6 à 9 min de moins sur la CI, mais il faut une mesure, avec `stabilite.yml` sur les specs du Salon et des miniatures.
- **H — la CI complète à chaque fusion dans `main`** : le bouton la reprendrait (≈ 15 à 20 min de moins), et les tests rouges seraient connus avant le clic. Cela change la règle R13 (main = Essentiel, ≤ 15 min).
- **G — préparer les jours de Tower à l'avance** : moins utile une fois `figer` en parallèle, à reprendre si `figer` + répétition dépassent la CI. Tant que Tower est `off`, chaque nouvelle version de Tower recalcule les 15 jours.
