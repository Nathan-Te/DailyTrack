# Lot TP — Tower sur la plateforme

*Lot de plateforme demandé par la conversation de Tower. Numéro « TP » : à confirmer par la conversation de la plateforme.* Branche `ccr-8fb43d3d-vzkzli`. **Tower reste `off`.**

## Ce qui a été branché (points 1 à 14 du cahier du T4)
1. **Registre** : `TOWER_GAME` dans `registry.ts`. **Remise à zéro** : `tower_results` vidée, `tower_levels` gardée. **Mentions** (FR et EN) : tables, ce que Tower garde, clés `tower:records` et `tower:aide:vu`. **Effacement** : `partiesDailyTower` (`docs/plateforme/effacement.md`).
2. **« Nouveau départ »** : le préfixe `tower:` rejoint `PREFIXES_DE_JEU`.
3. **`api.ts` / `server.ts`** : `towerFrozen`, `towerExecuteur` ; `server.ts` lit `tower-fil.mjs` s'il est là.
4. **Image** : `build-node.mjs` (jours de Tower, preuve comprise, + seconde entrée `tower-fil.mjs`), `Dockerfile`, `@cdj/tower-sim` et `measure:tower` dans `apps/api`, `plans.ts` (`tower_results`), `routesChaudes.ts` (classement, profil, envoi), `platformBudget.ts` (`TOWER_PLAYER`).
5. **Crochets `portail` et `admin`** avec un score en hauteur (forme ci-dessous) ; cumul au temps inchangé ; vue `?vue=tower` ; série et journée parfaite.
6. **Portail** (agent dédié) : cartouche, onglet « Tower », ligne de partage, `formatHauteur` (« 42,7 m »).
7. **Jeu** : `interrupteurInit` (« Bientôt » si `off`, bandeau d'aperçu, `cdj:apercu:tower`, `X-Preview-Key`), génération, destination `tower` du message en direct (+ case dans le panneau), « Jeu suivant du jour » (arrivée et accueil).
8. **« Mettre en production »** : jours de Tower préparés (détail ci-dessous), `scripts/mise-en-production.mjs` (`tower-plan`, `-nettoyer`, `-resume`, `-poser`), `lireResultats` (un jour joué seulement à Tower est protégé), empreintes (`empreintes-tower.ts`, clé `tower` de `jours-passes.json`), résumé du bouton.
9. **Site** : `scripts/site.mjs` publie `/tower/` partout ; en production, `fichiersAvecPreuveTower` vérifie qu'aucun fichier publié ne contient une `preuve`. **Recette** : `SERVER_PATHS` et `recette.yml`. **`smoke`**, **`smokeRead`**, **`recette:seed`**, **budgets** (`mesureTower` = l'accueil seul ; `tower.jeu` au grand tableau), **catalogue d'erreurs** reformulé et `codes-erreur.md`.

## Le score en hauteur
`ScorePortail = { unite: "mm", valeur, vies }`, **facultatif à côté des champs existants** (`EtatPortail.fini`, `ClasseDuJour`, `ResultatAdmin`), plus `JourPortail.unite?: "mm"` et `PortailDuJeu.classement?: "temps" | "hauteur"`. Un jeu au temps ne pose rien de neuf : ses réponses sont identiques (testé). `tempsMs` d'un jeu à la hauteur = la durée de la partie (dernier départage). Choisi parce qu'un client qui ignore `score` retombe sur un temps, et qu'aucun contrat existant ne bouge.

## Les jours de Tower dans « Mettre en production »
Étape `figer`, avec le code **déployé**. Protégé (avant le lancement, déjà figé, ou avec un résultat) : inchangé. Sans résultat : préparé, refait (autre `g`/`sim`, ancien fichier retiré avant) ou gardé. Fenêtre : veille de la bascule → J+14 (16 jours) ; le résumé donne les jours couverts et « prochaine mise en production au plus tard le … ». Les fichiers vont dans l'image, le site (sans preuve) et `main` (PR « Jours figés »).
- **Temps mesuré** : 15 jours en **192 s (3 min 12 s)** sur 4 cœurs (machine du lot, 15 jours à la suite, d'autres tâches en parallèle). Le job `figer` a 60 min : pas besoin d'un job à part ; le runner réel est à mesurer au premier passage (le résumé écrit le temps).
- Limite : sans registre des versions (non fait), un jour **protégé sans fichier** (servi « provisoire » après plus de 15 jours sans mise en production) qui aurait des résultats **bloque** la mise en production si le générateur change (comparaison des empreintes) : voir questions.

## Coût
Mesuré sur la base de référence (300 joueurs, 14 jours, libSQL **locale** comptée, estimation basse) : classement 59 lignes lues / 7 instr. ; profil 16 / 6 ; envoi 69 / 23 (2 écrites) ; portail jour (joueur) 434 à froid (classement du jour calculé une fois par fenêtre). `TOWER_PLAYER` : 10 requêtes, ≈ 720 lignes lues, ≈ 1,6 s facturée. **Pas de `sqld` : Docker n'a pas de démon dans cet environnement** — non mesuré sur `sqld`, à refaire par `npm run measure:tower -w @cdj/api`.

## Vérifié / non vérifié
- **Vérifié** : `tsc -b` ; tests unitaires et d'API sur SQLite et libSQL ; test de l'**image construite** (`towerImage.test.ts` : `server.mjs` lancé, partie rejouée, journal « executeur: fil ») ; `smoke` complet contre un serveur local (Tower joué en aperçu) ; `recette:seed` (8 joueurs, idempotent) ; `securite-workflows` : 0 écart ; e2e de Tower (voir le compte rendu : un test « hors ligne » adapté, sans affaiblir l'assertion).
- **Non vérifié** : un vrai run de `production.yml` / `recette.yml` (un agent ne lance pas de workflow : **la répétition sur la recette reste à Nathan**) ; rendu visuel et axe de la cartouche et de l'onglet ; Firefox et WebKit ; `sqld`.

## Écarts à décider
- **Budget du portail : 5 o de marge** (32 763 / 32 768) ; Track a 1 077 o de marge, `track.anglais` 37 o. À relever ou à alléger.
- Cartouche : pas de rotation des pièces à yeux (octets), « Record 27,406 m · Argent » remplacé par le statut standard, accroche et textes de l'onglet de l'agent à relire. Pas de maquette de l'onglet.
- Zones de nouveautés (`Du Jour`, `Track`, `Jump`) : pas de `Tower` (touche l'affichage du portail).

## Ce que Nathan doit faire
1. Relire la PR, fusionner, laisser la recette se déployer.
2. « Mettre en production » (mode `essai` d'abord si tu veux) : le résumé montre la ligne **Jours de Tower**.
3. `/admin/` › Jeux : Tower en **`preview`**, générer la clé, ouvrir le lien sur le téléphone, jouer. Il reste `off` pour les autres.
4. Régler `PREMIER_JOUR_TOWER` (provisoire : 2 novembre 2026) au passage à `on`.

## Questions
1. Faut-il un **registre des versions de Tower** (comme `jours-track.json`) pour qu'un jour protégé sans fichier survive à un changement de générateur ? Non fait : la fenêtre de J+14 le rend rare.
2. Ajouter `Tower` aux zones de nouveautés ?
3. Relever le plafond du portail ?

## Liens de test
Aperçu de la PR (lien dans le commentaire « Aperçu » de la PR) : `/` (cartouche et onglet « Tower » avec le badge « Brouillon »), `/classement/?vue=tower`, `/tower/?seed=<aujourd'hui>`, `/tower/?scenario=essai`.
