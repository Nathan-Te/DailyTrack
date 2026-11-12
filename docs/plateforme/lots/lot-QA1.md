# Lot QA1 — photographier tout le site, puis proposer un portail amélioré en maquettes

Relecture, sans correction : aucun fichier de `apps/*/src` ni de `packages/*/src` n'est modifié. Les deux parties sont livrées.

## Ce qui est livré
- **`npm run relecture`** (`scripts/relecture/`, Playwright, hors de la CI) : le site assemblé comme la recette, le vrai serveur sur une base locale remplie par `recette:seed`, Tower, Blocks et Rush passés `on` sur cette base. 118 passages : 32 sujets du portail (pages et états, images de partage, `/admin/` par la session factice) et 6 écrans pour chacun des 5 jeux, à 7 tailles, en français et en anglais. Sortie : `relecture/index.html` (planches, tableau des contrôles), hors du dépôt.
- **Dix contrôles** par page : contraste AA (axe-core), cibles de moins de 44 px, défilement horizontal, texte coupé, textes qui se chevauchent, texte sous 12 px, textes interdits, focus au clavier, images sans `alt`, console.
- **Le constat** `docs/relectures/2026-11-constat.md` (portail et jeux, gravités, miniatures dans `docs/relectures/captures/`, produites par `node scripts/relecture/miniatures.mjs`).
- **Six maquettes « avant / après »** dans `docs/relectures/maquettes/` (accueil, classements, amis et groupes, profil, page secondaire, états vides) et leur index, avec une proposition de cinq lots. Elles sont assemblées par `node scripts/relecture/maquettes.mjs` depuis `maquettes/src/` (polices du socle et captures incluses : aucun fichier externe).
- `CLAUDE.md` racine, « Commandes » : `npm run relecture`.

## Scénario de test pour Nathan (2 clics)
1. Ouvrir `docs/relectures/maquettes/index.html` (fichier téléchargé depuis la PR).
2. Ouvrir « Accueil » : comparer l'avant et l'après, dire ce qui est gardé, numéro par numéro.

## Vérifié
- Le passage complet du 12 novembre : 118 passages photographiés, aucun manque (environ 25 min sur cette machine en rendu logiciel ; portail seul : 3 min ; 3 à 5 écrans de jeu ne s'ouvrent pas au premier essai et sont repris par le rattrapage).
- Les maquettes s'ouvrent seules (rendu vérifié dans Chromium, ordinateur et téléphone).
- `npm run consignes`, typecheck et tests unitaires : voir la PR.

## Non vérifié, limites
- **Pages demandées et non photographiées** : aucune. `/partage/` est photographié par ses trois images (`portail.png`, `track.png`, `jump.png`) : `partage/images.html` n'est pas dans le site assemblé.
- **États non photographiés** : serveur injoignable, passage de minuit, message en direct, dialogues ouverts (cloche, « Un bug ? Une idée ? », recadrage de la photo). La maquette des états vides propose un bandeau « serveur injoignable » sans capture en face.
- **Arrivée de Blocks et de Rush** : l'écran d'essai du jeu (`?scenario=partage`, `?scenario=fin`), pas une partie classée (il faudrait jouer une partie entière).
- **Portrait de Track** : la course et la pause sont sous « Tourne ton téléphone » (comportement du jeu, photographié tel quel).
- Les marges de l'iPhone sont simulées dans Chromium ; Safari n'est pas lancé. Les contrôles sont des signaux, pas des verdicts : aucun ne fait échouer la commande.
- Sur une machine chargée, un écran de jeu peut ne pas s'ouvrir : il est retenté, puis refait seul en fin de passage ; s'il manque encore il est listé, et `--seulement <sujet>` le refait.
- Le contrôle « Textes qui se chevauchent » est bruyant dans les jeux (faux signaux listés au constat).

## Écarts d'outil assumés (base locale seulement)
- Les jeux passés `on` sont ouverts « depuis toujours » par une écriture directe dans la base SQLite locale (un jeu passé `on` ne compte que le lendemain).
- Un serveur par passage en parallèle, relancé avant chaque sujet : sans cela le limiteur de débit (30 lectures par joueur) renvoyait des 429 à « Démo ».

## Échec hors de la zone du lot (à trancher par Nathan)
- Workflow de la recette, job `deploy / deploy` (run 43134819648) : l'essai `smoke` de la révision de recette échoue sur « Vertige : jour (médailles croissantes) » — `/api/vertige/day/2026-11-12` répond `"medals": null`. Ce lot ne modifie ni `apps/api` ni Vertige : non corrigé ici. La CI de tests de la PR (workflow `test`) est verte.

## Décisions laissées à Nathan
- Les deux **évolutions de charte** proposées : « Tes amis aujourd'hui » sous la salle d'arcade sur ordinateur ; un fronton court, sans compte à rebours, sur les pages de lecture.
- Ce qui est gardé dans chaque maquette, et l'ordre des lots Q1 à Q5 (index des maquettes).
- Le dossier `relecture/` reste hors du dépôt (120 Mo) : à garder ainsi, ou à publier en artefact.

## Pour les joueurs
rien
