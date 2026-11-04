# Lot K4g — `npm run nouveau-jeu`, le test de bout en bout du kit et « Créer un jeu » (dernier lot du kit)

*4 novembre 2026. Plateforme. Pour les joueurs : rien. Conception : `docs/plateforme/kit-de-jeu.md` (« Le kit est terminé »).*

**Résultat.** `npm run nouveau-jeu -- --id <id> [--nom "<Nom>"] [--classement score|temps] [--a-blanc]` crée un jeu neuf à partir de « Cibles » qui compile, passe ses tests et tourne en local **sans retouche à la main**. Le job « Kit de bout en bout » le prouve à chaque changement du kit, du module serveur, de `core`, des fiches, de « Cibles » ou du générateur, et chaque nuit.

## Le générateur (`scripts/nouveau-jeu.mjs`)
- **Copie et renomme « Cibles »** (53 fichiers : `apps/<id>`, `packages/<id>-sim`, ses fichiers de `apps/api`) ; il ne contient aucun fichier de jeu (le modèle fait foi). Renommage : `cibles`/`Cibles`/`CIBLES`, le nom affiché, les thèmes (`clair`, `sombre`), le sel du générateur du jour (haché de l'id), les ports d'essai (les plus petits que personne ne cite).
- **Textes visibles** : nom, accroche, phrases de thème, aide, plateau = « À remplacer » (fr et en) ; rien de « Cibles » (testé).
- **Fiche** : `off`, `temoin: false`, étiquette générique, `ordre` suivant, teinte = la première de `TEINTES` qu'aucun jeu n'utilise (**à choisir par Nathan**, dit dans la sortie, la consigne et la passation).
- **Lignes ajoutées** (jamais retirées ; testé par le job) : `Dockerfile`, `apps/api/{package,tsconfig}.json`, `tsconfig.json`, `package-lock.json`, `jeu.<id>.nom`, accroche et thèmes du portail, ligne `<id>.jsCss` de `budgets.md` (celle de « Cibles » : 45 Ko, **à fixer avec la mesure du jeu**), liens `node_modules/@cdj/*`. Puis `npm run fiches`, le golden du jeu, `npm run traductions`.
- **Prudent** : refuse un `id` qui existe (jeu, dossier, fiche, `docs/<id>`), un nom réservé, un tiret ; `--a-blanc` (+ `--detail`) liste sans écrire ; `--passation` réécrit seulement `docs/<id>/passation.md`. Affiche les 5 étapes.
- **`docs/<id>/`** : `seed.md` vide (titres du seed de Tower, « à écrire par Nathan »), `consignes.md`, `passation.md` **générée des `CLAUDE.md`** (résumé des règles communes, de la fiche, de la publication, des tests, de la discipline ; zones du jeu ; charte ; méthode) — pas de `passation-tower.md` dans le dépôt : le modèle est donc celui-ci.

## Les deux variantes
« Cibles » les produit : **`packages/cibles-sim/src/variante.ts` est le seul endroit qui les distingue** (règle de la partie, score, colonnes/unité/barème de la fiche, bot, seuils, joueur scripté, textes du score). `score` : inchangé (golden, bancs et tests de Cibles identiques). `temps` : « toucher les 20 cibles le plus vite possible », temps ↑, Diamant = le bot (260 ticks, 8,67 s), médailles à 130/160/200 %, partie inachevée = 30,00 s. Le générateur ne change que `VARIANTE_NOM` et la fiche (lue de `variante.ts`). Le reste du code ne lit que `VARIANTE` ; `variante.test.ts` passe les deux. Surcoût du premier chargement de « Cibles » : +0,7 Ko (43,4 Ko pour 45).

## Le job « Kit de bout en bout » (`scripts/kit-bout-en-bout.mjs`, `ci.yml`)
Dans une copie du dépôt : génère `essai` (score) et `essaitemps` (temps) ; vérifie qu'un `id` existant est refusé, la passation ; typage ; traductions à jour ; unitaires des deux jeux (simulation, application, serveur : copies, aperçu, effacement, « Mon groupe », jour figé) et 11 tests de la plateforme qui lisent les fiches, SQLite puis libSQL `file:` ; construction ; budgets (toutes les lignes) ; Essentiel e2e des deux jeux en Chromium (partie scriptée, envoi rejoué et classé, copie refusée, Amis) ; **aucun fichier créé ou modifié hors des zones, de la fiche, des fichiers générés et des entrées mécaniques**. **`jeu-fictif` reste** (toute la suite unitaire, fiche minimale : preuve que la plateforme ne nomme aucun jeu). Durée : local ≈ 1 min ; CI : voir plus bas.

## « Créer un jeu » (`CLAUDE.md` racine, `docs/orchestration.md` § 12 bis)
1. Nathan écrit le seed. 2. Un lot de la plateforme lance la commande et verse le seed. 3. Nathan ouvre la conversation du jeu avec `passation.md`. 4. Lots du jeu, dans ses zones, maquettes d'abord. 5. Nathan publie : `off` → `preview` → `on` (classement cumulé : réglage à part).

## Limites restantes
`id` sans tiret ; teinte, plafond de budget et premier jour à fixer par Nathan ; mentions légales à décrire avant `on` ; seuils de médailles d'un jeu au temps affichés en ticks à l'arrivée (brique du kit) ; Track, Jump, Tower pas sur `brancherJeu` et serveur de Track hors du module (hors périmètre) ; vocabulaire du jeu de départ (`<id>` pour « cibles ») à remplacer avec la simulation.

## Vérifié / non vérifié
*(à compléter)*
