# Lot R9 (plateforme) — Avant le partage : fermer les copies de temps

Branche `claude/practical-darwin-q4glms`, PR en brouillon. **Aucune règle de jeu, physique ni générateur touchés ; `JUMP_SIM_VERSION`, `JUMP_GENERATOR_VERSION`, `SIM_VERSION`, `GENERATOR_VERSION` et tous les golden inchangés ; aucune dépendance ajoutée.** Trois façons de prendre la première place sans jouer, le jour du lancement (lot R8), sont fermées : la preuve de l'auteur de Jump servie à tous, le fantôme du premier renvoyé tel quel, `?semaine=`. Audit : S-08, S-16, S-17 (`audit-securite-2026-10.md`).

## 1. La preuve de l'auteur ne quitte plus le serveur (Jump)
- **Où elle vivait** : le champ `preuve` (la rediffusion de l'auteur, 223 caractères) de chaque `apps/jump/public/levels/AAAA-MM-JJ.json`, publié tel quel sous `playdujour.com/jump/levels/` (et lu par le jeu : `thawLevel` la rejouait pour vérifier le fichier). `&solution` la jouait, `?carnage=demo` en faisait le héros, `?debug` l'exposait (`__jump.daily.code`, `__jump.autoplay()`). La renvoyer à `POST /api/jump/submit` donnait le temps de l'auteur.
- **Ce qui a changé** : la **construction de production** de Jump (`VITE_PRODUCTION=1`, plugin `productionSansPreuve` de `apps/jump/vite.config.ts`) retire `preuve` de chaque fichier figé publié, et ne publie ni `outils/` ni `demo/`. Le dépôt et **l'image du serveur gardent les fichiers entiers** (le serveur rejoue la preuve : `thawLevel` strict, inchangé). `scripts/site.mjs --production` **revérifie** le site assemblé (fichier publié = fichier du dépôt moins `preuve`, et aucun fichier ne contient le texte d'une preuve) : sinon l'assemblage échoue.
- **Ce que le jeu en faisait, et par quoi c'est remplacé** : (1) vérifier le fichier → `thawPublicLevel` (`@cdj/jump-sim`) : avec preuve, vérification entière (recette, aperçus, local) ; sans (production) : forme, date, versions, identifiant, empreinte du texte, médailles, **pas de rejeu** (le serveur rejoue chaque essai ; le fichier est le nôtre, l'empreinte détecte une corruption) ; (2) `&solution`, `?carnage=demo`, trajets de `?debug` : fermés en production (`readUrlOptions(…, restricted)`) et muets sans preuve ; (3) `__jump.daily.code`, `__jump.autoplay()` sans argument : absents en production.
- **Limite** : un niveau **généré** par le navigateur (jour pas encore figé) a sa preuve en mémoire, comme tout le générateur ; la fermer demande la graine secrète du jour (**L-GRN**, hors périmètre). La **grille** de demain reste servie la veille (**L-FUT**).

## 2. Refus des copies (Track et Jump)
- **Règle** : un envoi au classement du jour dont les **entrées** sont identiques à celles de l'auteur du niveau (le pilote de Track, la preuve de Jump) **ou** à celles d'une rediffusion **déjà classée d'un autre joueur ce jour-là** est refusé **`409 replay_copy`**, avant toute écriture (pas même le joueur). Le même joueur qui renvoie sa propre course n'est pas concerné ; l'ordre d'arrivée ne change rien (la première course classée garde sa place).
- **Empreinte** (`apps/api/src/copies.ts`) : SHA-256 des entrées **effectivement jouées** — séries voisines de même commande recollées, et pour Track les pas après la ligne d'arrivée ignorés (le rejeu s'y arrête) : couper une série ou ajouter des pas inutiles ne fait pas passer une copie.
- **Colonnes** (migration en avant, `MIGRATIONS` de `db.ts`, index créés après les colonnes) : `results.inputs_hash`, `jump_results.inputs_hash` (index `(day, inputs_hash)`), `circuits.author_hash`, `jump_levels.author_hash`. `NULL` pour une ligne d'avant : elle ne bloque personne ; un circuit ou un niveau sans empreinte d'auteur est recalculé tant que son jour est ouvert. Pour Track, `packages/sim` expose la rediffusion du pilote (`DailyCircuit.authorReplay`, ajout pur, jamais servie).
- **Code** : `replay_copy` (409) dans `codesErreur.ts`, `docs/plateforme/codes-erreur.md`, catalogue commun fr « Cette course est la copie d'une autre. » / en “This run is a copy of another one.” (`npm run traductions` relancé).
- **`allowCopies`** : option de `createApi`, **fausse par défaut** (le serveur de production ne la règle jamais, `readConfig` ne la connaît pas : testé). Vraie pour les outils de données fictives (`history:seed`, `jump:seed`, `recette:seed`, démos), les scripts de mesure et le `makeApi` des tests (beaucoup rejouent la même course pour plusieurs joueurs) ; `copies.test.ts` passe `allowCopies: false` et prouve la règle.
- **Limites assumées** : une rediffusion **modifiée** (une commande changée sans effet) a une autre empreinte — la plausibilité des entrées est **L-ROB** ; deux copies simultanées (à la milliseconde) peuvent passer toutes deux (lecture puis écriture : une contrainte unique aurait contredit la clé `(day, player_id)` d'un meilleur temps remplacé) ; un résultat d'avant le lot n'a pas d'empreinte.
- **Coût** : une instruction indexée de plus par envoi (0 ou 1 ligne lue), non mesurée sur Turso (pas de `sqld` ici) ; les « requêtes » du modèle de `platformBudget.ts` sont des requêtes HTTP : inchangées.

## 3. `?semaine=` et `outils/` (Jump)
Fermés en production : `?semaine=`, `&generateur=` (`readUrlOptions`), et `outils/` (`semaine-g13.json`, `intentions.json` de la galerie) n'est pas publié. Hors production (local, recette, aperçus) ils fonctionnent comme avant. Test sur la vraie construction : `apps/jump/test/productionSite.test.ts`.

## 4. Inventaire des options d'adresse en production
Question posée à chacune : peut-elle **faire classer un temps** (le serveur rejoue tout envoi ; le jeu n'envoie jamais un essai, une archive, une lecture, un morceau, une partie aux réglages modifiés : `mayRank`, `submitAllowed`) ou **révéler une carte à venir** ?
| jeu | option | verdict |
|---|---|---|
| Jump | `?semaine=`, `&generateur=` | **fermées** (niveaux à venir calculés) |
| Jump | `&solution` (jour et morceau), `?carnage=demo` | **fermées** (preuve de l'auteur jouée) |
| Jump | `?seed=` d'un jour à venir | déjà refusé en production (`isPreview`), `?debug` ne le lève pas |
| Jump | `debug`, `tune`, `hitbox`, `pieces`, `fx`, `touch`, `zones`, `ghost`, `watch`, `theme`, `metronome`, `accueil`, `archives`, `scenario`, `modules`/`module`/`variante`/`entree`, `api` | **gardées** : courses non classées (`api` déjà restreinte au lot R7) |
| Track | `?salonAt=` et `__cdj.salon.setNow` (`?debug`) | **fermés** (une session du Salon à une autre heure montre un circuit à venir) |
| Track | `?seed=`/`?day=` à venir, `?variant=`, `?theme=` (aujourd'hui ou à venir), `?today=`, touches N et T, `?palier=`, `?reglages=` | déjà fermées (lot 31, lot 46) ; `?debug` ne les lève pas |
| Track | `?debug`, `?tune`, `?spec=` (circuit écrit à la main), `?scenario=`, `?timescale=`, `?fps`, `?camera`, `?quality`, `?demo`, `?api=` (restreinte), `?touch`… | **gardées** : courses non classées ou réglages d'affichage |
Reste hors périmètre : `__jump.autoplay(code)` / `__cdj.autoplay(code)` jouent une rediffusion donnée (un robot ou un TAS) ; la validation serveur l'accepte si elle est valide — **L-ROB**.

## 5. Scénario de test pour Nathan
1. **Preuve absente** — l'aperçu et la recette ne sont **pas** des constructions de production (ils gardent `preuve` pour les tests) : le test `productionSite.test.ts` fait foi. Pour le voir à la main : `VITE_PRODUCTION=1 npm run build -w @cdj/jump && grep -c preuve apps/jump/dist/levels/*.json` (0 partout) ; `…/jump/?semaine=2026-11-01` ne calcule rien dans cette construction (`npx vite preview` dans `apps/jump`).
2. **Copie refusée** — sur la recette ou l'aperçu (adresse de l'API de l'aperçu donnée dans le commentaire de la PR), quand quelqu'un est classé aujourd'hui dans Jump (`recette:seed`) :
```bash
API=https://recette.playdujour.com   # ou l'adresse directe de l'API de l'aperçu
D=$(TZ=Europe/Paris date +%F)
curl -s "$API/api/jump/day/$D/ghost/first" | jq '{levelId, simVersion, generatorVersion, replay, name: "Copieur"}' \
 | curl -s -w '\nHTTP %{http_code}\n' -X POST "$API/api/jump/submit" -H 'Content-Type: application/json' -H "X-Player-Id: $(openssl rand -hex 16)" -d @-
# → {"error":"replay_copy"} puis HTTP 409
```
Même chose pour Track : `GET $API/api/day/$D/ghost?kind=first`, puis `POST $API/api/submit` avec `{"date":"$D","replay":…,"name":"Copieur"}`.

## 6. Vérifié / non vérifié
**Vérifié en local** : `npx tsc -b` ; `apps/api` en entier sur SQLite (431 tests + `copies.test.ts`) et `copies.test.ts` sur libSQL ; `productionSite.test.ts` (vraie construction de production : preuves absentes de tous les fichiers, fichiers lisibles par `thawPublicLevel`, `outils/` et `demo/` absents, options fermées) ; `profil-commun.spec.ts` (Jump, vrai serveur) ; RÉSULTATS_E2E.
**Non vérifié** : le coût sur Turso (pas de `sqld`) ; l'aperçu déployé et son adresse (la PR vient d'être ouverte) ; `smoke` contre un serveur réel et l'image Docker (`api-image` de la CI) ; WebKit et Firefox (CI complète de `main`).
**Décisions pour Nathan** : (a) la recette et les aperçus gardent la preuve (ils ne sont pas construits comme la production) ; (b) `allowCopies` levé pour les données fictives (un « Démo » a la preuve de l'auteur) ; (c) la recette garde les courses des passages d'avant : `smoke` tire désormais sa course au hasard (adhérence, graine) pour ne pas se heurter à lui-même.

## 7. CI
RUNS_CI
