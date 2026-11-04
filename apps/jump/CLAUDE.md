# DailyJump — `apps/jump` : consignes du jeu (rendu, interface, sensations, tactile)

Chargé quand on lit un fichier de `apps/jump`. Le jeu affiche ce que calcule `packages/jump-sim` : rendu, son, effets = lecture seule de la simulation. **Partir de la synthèse `docs/jump/synthese.md`** (chaque point renvoie au README du lot) ; n'ouvrir un README de `docs/jump/lots/` que pour un détail. Vision : `docs/jump/seed-dailyjump.md` (**ne pas modifier**). Réponses et docs en français. Chaque lot de DailyJump ajoute **sa section** dans le `CLAUDE.md` de la zone qu'il touche, jamais dans le `CLAUDE.md` racine. Règles de la simulation, des morceaux et du générateur : `packages/jump-sim/CLAUDE.md`.

> **Renvois « voir <rubrique> »** : une rubrique citée mais absente de ce fichier est dans un autre `CLAUDE.md` ou dans `docs/regles/` : `CLAUDE.md` racine, « Où sont les rubriques ».

## La fiche de Jump (lot K1b)
`config/jeux/jump.json` est la **fiche** de DailyJump (schéma et règles : `packages/core/CLAUDE.md`). **Le lot de Jump la modifie** (seule exception à la règle des zones, avec ce que `npm run fiches` en tire) ; **`npm run fiches` après tout changement** (un thème de plus : `themes` et `musique.scenes` ensemble). Elle porte ses tables (`jump_results`, `jump_lives`, `jump_deaths` vidées ; `jump_levels` gardée), son préfixe `jump:`, son classement au temps (ticks), ses médailles figées avec le niveau, ses niveaux figés (`jours.dossier`, preuve interdite en production), ses zones de CI, ses specs, sa « Régression » et ses lignes de budget. `apps/api/test/fiches.test.ts` échoue si la fiche dit autre chose que le code.

## Emplacements
- `docs/jump/seed-dailyjump.md` — vision, piliers, plan en lots (le prompt de lot 0 le nomme `seed.md` : le fichier déposé s'appelle `seed-dailyjump.md`).
- `docs/jump/lots/` — un README d'une page par lot (`lot-0-socle.md`…).
- `packages/jump-sim` (`@cdj/jump-sim`) — simulation pure du saut.
- `apps/jump` (`@cdj/jump`) — le jeu (Vite + Three.js, caméra orthographique) ; affiche ce que calcule `jump-sim`.
- `packages/core` (`@cdj/core`) — socle partagé avec DailyTrack : PRNG (`Rng`, `mixSeed`), calendrier (`daysFromCivil`, `civilFromDays`, `formatDay`, `parseDay`), codage d'octets (`toBase64Url`, `fromBase64Url`, `pushVarint`, `readVarint`), et le test de pureté générique (`@cdj/core/testing`). Le jour de Paris (changement de jour) est dans `packages/clock` (`parisDay`), qui lit l'heure et n'est donc pas pur : jamais importé par une simulation.

## Conventions de `apps/jump`
- **Interface et socle commun** : **fait au lot I5** — toute l'interface passe par le socle `@cdj/ui` et les catalogues `fr` + `en` (aucune chaîne ni couleur en dur) : voir « Interface Du Jour (lot I5) ». Rendu, son, effets : lecture seule de la simulation.
- **`?debug`** expose `window.__jump` (même esprit que `__cdj` de DailyTrack) : `phase` (`loading` → `ready`, ou `no-webgl`), `day`, `simVersion`, `palette`, `probe()` (relit les pixels). Sans `?debug`, rien n'est exposé.
- **Stockage local préfixé `jump:`** (`storageKey()`, `storage.ts`) ; DailyTrack garde `cdj:`. Toujours sous `try/catch`.
- **Publication sous `/jump/`** du même site GitHub Pages : `pages.yml` construit `apps/web` à la racine et `apps/jump` dans `jump/` (aperçu de branche : `…/b/<branche>/jump/`). Chemins **relatifs** (`base: "./"`) pour que les aperçus de branche marchent.
- **Tout nouveau paramètre d'adresse rejoint la page d'outils `/jump/admin/`** (`adminLogic.ts` ; voir « Page d'outils `/jump/admin/` » plus bas).
- Rendu, son, effets : lecture seule de la simulation ; jamais l'inverse. Texte par les catalogues, en français et en anglais (lot I5).
- **Tests e2e et CI de PR courte (lot R10 de la plateforme)** : une PR ne lance que l'Essentiel des specs liés à ses fichiers (la fiche du jeu, `config/jeux/jump.json` : `e2e.zones`, `e2e.specs`, `e2e.fumee`, `e2e.regression` — lot K1b ; `e2e/zones.json` ne garde que les zones partagées), sur Chromium. **Familles (lot R13, `docs/tests.md`)** : **Essentiel** (PR de sa zone, chaque fusion dans `main`) ou **Régression** (`{ tag: "@regression" }`, ou le spec entier dans `e2e.regression` de sa fiche : la nuit et « Run workflow » seulement) ; un doublon d'un unitaire est supprimé ; les outils (`captures-*`, `mesure-*`) ne sont jamais en CI ; Firefox et WebKit ne lancent que le petit ensemble `@navigateurs` (rediffusion, chargement, une partie). **Un lot n'ajoute un e2e que pour un parcours de joueur nouveau** ; mises en page en 844 × 390 et sur ordinateur, en 390 × 844 pour l'accueil et l'arrivée (la partie se joue en paysage). **Tout nouveau spec déclare ses zones dans `e2e/zones.json`** (`apps/web/test/ciZones.test.ts` l'exige) **et sa durée dans `e2e/durees.json`** ; **préférer un test unitaire** quand le navigateur n'est pas nécessaire ; **jamais d'attente en temps réel longue**. Avant de pousser : `npm run verifier`. Règles de CI, quarantaine et règle d'arrêt : `CLAUDE.md` racine, « Tests et CI ».

## Commandes
- `npm run dev:jump` — serveur de développement de `apps/jump`.
- `npm run build` — construit DailyTrack **et** DailyJump (`npm run build -w @cdj/jump` pour DailyJump seul).
- `npx vitest run packages/core packages/jump-sim apps/jump` — tests de DailyJump et du socle ; `npm test` lance tout (deux projets, `sqlite` puis `libsql`).
- `npm run typecheck` — `tsc -b` sur tous les espaces de travail.
- `npm run e2e:jump` — construit puis lance les tests e2e Playwright de DailyJump (`E2E_ALL_BROWSERS=1` pour Firefox et WebKit, `CHROMIUM_PATH` pour un Chromium déjà installé ; arguments Playwright après `--` : `npm run e2e:jump -- smoke --project=chromium`).
- Alias racine (lot 3c, sans autre changement) : `npm run solve:modules` (`-w @cdj/jump-sim`), `npm run measure:jump` (`-w @cdj/jump-sim`), `npm run freeze:days -- <date | demain>` (`-w @cdj/jump`). Arguments après `--`.
- **CI : les e2e de DailyJump suivent exactement les règles de CI de DailyTrack** (lot 3c, retouche 29b de DailyTrack) : leurs specs sont des parts de la même matrice `e2e-parts` (`suite: jump`, projets Playwright `jump-chromium|firefox|webkit` en CI ; Chromium en parts composées par durée, `apps/jump/e2e/durees.json`, un test à la fois ; Firefox et WebKit en `--shard` ; **lot R10 : une PR n'a que ses specs liés, sur Chromium, dans la matrice `e2e-pr`**), leurs rapports « blob » entrent dans la fusion et le verdict unique `e2e`, **une relance** en CI (`retries: 1`) et un test qui réussit à la relance est **« instable »** : nommé dans le résumé du run, annoté, jamais caché (au run de nuit il fait échouer le job). Un rouge désigne un vrai problème, nommé. **Un nouveau spec e2e s'ajoute à `apps/jump/e2e/durees.json`** (le test `apps/jump/test/ciE2e.test.ts` l'exige ; les durées Chromium par fichier, préfixées « jump/ », sont dans le résumé du run `e2e`). Les outils `MESURE` et `CAPTURES` se sautent d'eux-mêmes avec leur motif (« outil de mesure : MESURE=1 ») : ni l'un ni l'autre n'est défini en CI. Le site publié contient `apps/jump/public/levels/` (étape « Vérifier les niveaux figés publiés » de `pages.yml`).

## Lot 1 — personnage
**Une session aux réglages modifiés (`tuned`) n'est jamais enregistrée** (`JumpSession.tuned`, vrai dès qu'un pas a été joué avec d'autres réglages que les défauts ; « recommencer » aux défauts l'efface). **→ Détail : [docs/regles/jump/lot-1-personnage.md](../../docs/regles/jump/lot-1-personnage.md)**

## Lot 1b — mobile
**Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace la bande haute de boutons (recommencer, ⚙, plein écran : dans la pause) et la place des […] **→ Détail : [docs/regles/jump/lot-1b-mobile.md](../../docs/regles/jump/lot-1b-mobile.md)**

## Lot 2 — dangers et mort
> **Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace le HUD décrit ici (chrono, meilleur, morts : la bande compacte et l'autocollant des morts).
- **Recommencer n'est pas une mort** : c'est un événement de la session (`JumpSession.restart`), qui repart de `initialAttempt`.
- **Jeu** : `?scenario=essai` (page par défaut) · `dangers` · `bac-a-sable` ; `?debug&hitbox` (boîtes justes et sections) ; `?fx=off` (ni éclats ni tremblement : `fx.ts`, pool recyclé, jamais d'objet créé en jeu). `__jump.attempt` (statut, chrono, morts, meilleur, dernière mort, scies, friables, sections), `__jump.fx`, `__jump.banner`. HUD (`hud.ts`) : chrono, meilleur temps, morts, sous la bande haute sur téléphone ; bandeau d'arrivée au-dessus de la couche tactile, bouton ≥ 44 px. Meilleur temps et morts : **session seulement** (lot 3 pour l'enregistrement) ; un essai aux réglages modifiés ne devient jamais le meilleur.

## Lot 3 — rediffusion
**Rien n'est enregistré en `tuned`** : ni meilleur essai, ni vies, ni taches (le badge le dit : « réglages modifiés : rien n'est enregistré ») ; ni en lecture (`?watch=best`) ni pendant le carnage. **→ Détail : [docs/regles/jump/lot-3-rediffusion.md](../../docs/regles/jump/lot-3-rediffusion.md)**

## Lot 4 — morceaux
- **Jeu** : `?modules` (galerie), `?module=<id>&variante=<n>&entree=arret|elan` (en élan, couloir de lancement de `LAUNCH_TILES` = 5 tuiles), `&solution` (la solution stockée, rejouée) ; bandeau d'arrivée avec le temps de la solution et « Morceau suivant ». Mémoire, fantôme, carnage et taches par morceau (clés `jump:*:module:<id>:<n>:<entrée>`). Logique pure : `apps/jump/src/modulesInfo.ts` ; galerie : `gallery.ts` (chargée par `boot.ts`, sans Three.js).

## Lot 5 — niveau du jour
- **Jeu** : la page par défaut (`/jump/`, sans `scenario` ni `module`) est le niveau du jour. `?seed=AAAA-MM-JJ` : une date ; **`isPreview(location)`** (`apps/jump/src/dailyInfo.ts`, pur) = aperçu de branche (`/b/<branche>/`) ou serveur local ; **sur le site publié, une date future est refusée** (niveau du jour, « Ce niveau n'est pas encore sorti »), `?debug` et `&solution` ne lèvent jamais ce refus ; une date passée = archive. C'est **une porte, pas une protection** : le générateur est dans le code publié ; la garantie viendra du serveur (phase 2). HUD : `#dayline` (« DailyJump #N », archive / à venir / aperçu, médaille visée) ; bandeau : médaille obtenue et temps de l'auteur ; palette = `paletteForDay(date du niveau)`. **Passage de minuit** : la partie continue, « Nouveau niveau disponible », le prochain « recommencer » recharge la page sur le nouveau jour. `&solution` : la rediffusion de l'auteur (**lot R9 : absent de la production**, comme `?carnage=demo`). `?debug` : limites des morceaux (identifiant, variante, exigence) et `__jump.daily`.

## Lot 8 — sensations
**Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace le menu ⏸ décrit ici : la pause porte les actions, les réglages sont un écran à part […] **→ Détail : [docs/regles/jump/lot-8-sensations.md](../../docs/regles/jump/lot-8-sensations.md)**

## Lot 7b — chargement rapide, respirations, tension
**La génération du niveau du jour se fait dans un worker de module** (`apps/jump/src/dailyWorker.ts`, Vite) et **`dailyLoader.ts` est le seul point d'appel** (`loadDaily`, attendu en tête de `main.ts`). **→ Détail : [docs/regles/jump/lot-7b-chargement-rapide-respirations-tension.md](../../docs/regles/jump/lot-7b-chargement-rapide-respirations-tension.md)**

## Lot 8b — animation du personnage, essai d'élan progressif
- **L'animation du personnage est de l'affichage seul, calée sur la distance** (`apps/jump/src/look.ts`) : le cycle des pieds avance avec la distance parcourue au sol (`Look.stride`, un cycle = deux `STRIDE_TILES`, un pied se pose à chaque bruit de pas), jamais avec le temps. Pieds et yeux font partie du personnage (toujours animés) ; rebond, penché, respiration et inclinaison du dérapage suivent `FeelLevels.body` (0 avec le mouvement réduit ou « effets : aucun »). Au repos, corps + pieds remplissent exactement la boîte de collision (`?debug&hitbox`). Événement `derapage` (demi-tour au sol au-dessus de `SKID_SPEED` × la course) : le seul qui lit les commandes (`EventInputs`, celle du pas et celle d'avant). `__jump.look` avec `?debug`.

## Lot 9 — thèmes
**(Remplacé au lot 11 : le thème est maintenant une donnée du générateur, voir « Lot 11 — thèmes jouables ».) Le thème est cosmétique et hors de l'identifiant du niveau** : […] **→ Détail : [docs/regles/jump/lot-9-themes.md](../../docs/regles/jump/lot-9-themes.md)**

## Les jours passés de Jump (lot R6 de la plateforme)
Guide : `docs/plateforme/mise-en-production.md`. Les jours passés sont protégés par les **jours figés** (`public/levels/`, une seule règle : `thawLevel`, voir `packages/jump-sim/CLAUDE.md`, « Lot 10 » et « Plateforme (lot P1) »). **Lot R6** : « Mettre en production » fige **jusqu'à la veille du jour de bascule** (le premier jour de Paris qui commence après le déploiement) avec le code en production, après avoir remis les jours que la production sert déjà (`jours-servis`) ; le jour de bascule est régénéré par le nouveau code et figé à la mise en production suivante. Le garde-fou compare, pour chaque jour avant la bascule, ce que sert la production et ce que servira la construction (fichier figé qui se rejoue, sinon niveau généré) : **un fichier figé qui ne se rejoue plus avec le nouveau code arrête la mise en production**. **Un lot qui change `JUMP_SIM_VERSION` ou `JUMP_GENERATOR_VERSION` ne fige plus à la main « jusqu'à demain »** (le jour de bascule se décide au clic) : il garde les fichiers existants intacts ; la mise en production fige. **Onglet resté ouvert** : le jeu envoie `simVersion` / `generatorVersion` de son code ; le serveur accepte ceux du niveau du jour conservé (`apps/api/CLAUDE.md`, « Le garde-fou des jours ») ; sinon `409 version` : `rang.version` « recharge la page » (`ranking.ts`, `livesSender.ts`).

## Lot 10 — arrivée, partage, archives
**Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace la forme de l'accueil, de « Comment jouer », de l'arrivée, des archives et la ligne à partager […] **→ Détail : [docs/regles/jump/lot-10-arrivee-partage-archives.md](../../docs/regles/jump/lot-10-arrivee-partage-archives.md)**

## Lot 11 — thèmes jouables
- **Toute mécanique arrive avec son événement, son son, ses particules et ses contrastes** (règle du lot 8 prolongée) : événements `tapisDebut` / `tapisFin`, `glaceDebut` / `glaceFin` (`events.ts`), ronronnement spatialisé des tapis, crissement de la glace, éclats de givre ; chevrons qui défilent et reflet de la glace dans le style du thème ; seuils de contraste dans `themes.test.ts`. `?debug&hitbox` montre les surfaces.

## Lot 12 — nuit et néon
**Jeu** : `apps/jump/src/blocks.ts` (pur : couleurs réservées `BLOCK_STYLE`, aspect `blockLooks`, vacillement `VACILLE_TICKS` = 30 pas, événements `blockEvents`, tempo `metronomeTick`), […] **→ Détail : [docs/regles/jump/lot-12-nuit-et-neon.md](../../docs/regles/jump/lot-12-nuit-et-neon.md)**

## Plateforme (lot P0) — profil commun
**DailyJump importe le module de profil commun** (`@cdj/profile`, `packages/profile/CLAUDE.md`) **sans rien afficher** : avec `?debug`, `__jump.profile` = `{ exists, name }` (une identité […] **→ Détail : [docs/regles/jump/plateforme-lot-p0-profil-commun.md](../../docs/regles/jump/plateforme-lot-p0-profil-commun.md)**

## Plateforme (lot P1) — le classement du jour
**Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace la forme de l'écran d'arrivée (`.arank`) et l'écriture des rangs (« 3e sur 128 », `formatRang` […] **→ Détail : [docs/regles/jump/plateforme-lot-p1-le-classement-du-jour.md](../../docs/regles/jump/plateforme-lot-p1-le-classement-du-jour.md)**

## Plateforme (lot P2) — fantôme du premier et profil commun
**Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace Réglages › Profil, la carte `#home-profile` et `profileUi.ts` (retirés : le profil commun est […] **→ Détail : [docs/regles/jump/plateforme-lot-p2-fantome-du-premier-et-profil-commun.md](../../docs/regles/jump/plateforme-lot-p2-fantome-du-premier-et-profil-commun.md)**

## Plateforme (lot P3) — les morts de tout le monde
**Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace le réglage `#menu-others-stains` (dans Réglages : `#reglages-taches`, « Montrer / Cacher »). **→ Détail : [docs/regles/jump/plateforme-lot-p3-les-morts-de-tout-le-monde.md](../../docs/regles/jump/plateforme-lot-p3-les-morts-de-tout-le-monde.md)**

## Plateforme (lot P4) — lecture regroupée, carnage adaptatif
Serveur : `apps/api/CLAUDE.md`, « Moins de requêtes, coûts et vérification de la production (lot P4) ». **→ Détail : [docs/regles/jump/plateforme-lot-p4-lecture-regroupee-carnage-adaptatif.md](../../docs/regles/jump/plateforme-lot-p4-lecture-regroupee-carnage-adaptatif.md)**

## Lot 13 — forêt
**Une zone de vent se voit toujours** (`apps/jump/src/wind.ts`, `windArt.ts`) : contour très discret ; avec les effets, **feuilles et pollen** qui circulent dans le sens du vent (un seul […] **→ Détail : [docs/regles/jump/lot-13-foret.md](../../docs/regles/jump/lot-13-foret.md)**

## Plateforme (lot R4) — playdujour.com
**Chemins** : DailyJump est servi sous **`/jump/`** de playdujour.com, de la recette et de chaque aperçu de PR (canal Firebase). **→ Détail : [docs/regles/jump/plateforme-lot-r4-playdujour-com.md](../../docs/regles/jump/plateforme-lot-r4-playdujour-com.md)**

## Plateforme (lot I2) — retour au portail
> **Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace le lien « ‹ Du Jour » : c'est la barre des jeux du socle (« ‹ DU JOUR », `#home-portail` gardé), et `#menu-portail` dans la pause.
- Un lien discret **« ‹ Du Jour »** vers `../` (le portail, racine du site) : en haut à gauche de l'**accueil** (`#home-portail`, `home.ts`) et dans les actions du **menu ⏸** (`#menu-portail`, `pauseMenu.ts`), cibles de 44 px. Texte en français tant que le jeu l'est ; clés prêtes à traduire : `barre.retour` (attribut `data-t`) et `barre.retour.aria` du catalogue commun de `@cdj/ui`. **À garder quand l'interface passera au socle (lot I5)** : la barre `barreJeu` de `@cdj/ui` porte ce retour. Côté serveur, DailyJump déclare au portail son état `en_cours` (des vies envoyées ce jour-là) : `apps/api/CLAUDE.md`, « Portail (lot I2) ». e2e : `apps/web/e2e/domaine.spec.ts` (portail → jeu → « ‹ Du Jour » → portail, au doigt en portrait).

## Plateforme (lot I3) — « Jeu suivant du jour » à l'arrivée
**Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace la forme du lien : boutons de marque du socle sous l'étiquette (`#arrival-next-game`, `#arrival-perfect`, `#arrival-portail` gardés). **→ Détail : [docs/regles/jump/plateforme-lot-i3-jeu-suivant-du-jour-a-l-arrivee.md](../../docs/regles/jump/plateforme-lot-i3-jeu-suivant-du-jour-a-l-arrivee.md)**

## Le thème du jour (lot V1 de la plateforme)
règle : `packages/jump-sim/CLAUDE.md`, « Sac de thèmes ». Depuis le générateur 23, **jamais deux jours de suite le même thème**. Le jeu ne fait que **déclarer les niveaux figés d'avant le sac** à la simulation : `apps/jump/src/frozen.ts` (`declareOldFrozenDays(FROZEN_OLD_DAYS)` dès son chargement, la liste est écrite à la construction par `vite.config.ts` d'après `generatorVersion` de `public/levels/*.json`), importé par `main.ts`, par le fil du générateur (`dailyGen.ts`) et par la page d'outils (`admin.ts`) — **tout nouveau point d'entrée qui calcule un thème (`jumpThemeForDay`, `themeForDay`, `dailyLevel`) importe `./frozen`**. Palette, archives et accueil appellent `themeForDay(jour)` comme avant ; un jour figé garde son ancien thème (`thawLevel` le lit dans le fichier), le premier jour du sac lit celui de la veille.

## Interface Du Jour (lot I5)
**Socle et feuilles** : `boot.ts` importe `@cdj/ui/src/styles.css` et **six faces de polices** (Lilita One 400 ; Archivo Black 400 ; Archivo 400, 600 et 700 ; JetBrains Mono 700), puis les […] **→ Détail : [docs/regles/jump/interface-du-jour-lot-i5.md](../../docs/regles/jump/interface-du-jour-lot-i5.md)**

## Discord et Ko-fi sur l'accueil (lot S1)
`home.ts` pose, à la demande, les deux plaques de `@cdj/ui` (lot S1b : 44 px, l'icône seule, hors du flux — rien n'est réservé à l'étiquette ; elles passent à la fin du défilement de `.accueil__defile` si elles la toucheraient) **dans `#home`**, jamais en partie. Aucune adresse ici : `packages/ui/CLAUDE.md`. **L'accueil ne coupe jamais l'étiquette, il défile** (`.accueil__defile` : toute la coque défile, rien n'est écrasé) ; vérifié en portrait **390 × 844 et 360 × 640** (et 844 × 390), thème Glace, **Essentiel**, dans `e2e/plein-ecran.spec.ts` (`verifierAccueilTelephone` de `e2e/accueilTelephone.ts` : étiquette non coupée, plaques de 44 × 44 sans chevauchement, aucun anneau de focus au toucher ; JOUER : absentes). Budget : `liensCommunaute-*` est exclu de `mesureJump` et de `poids.spec.ts` (à la demande, comme `manette-*` ; à confirmer par Nathan).

## Finitions (lot I6 de la plateforme)
**Balises de partage** (`index.html`) : titre, description, Open Graph (`og:image` = `/partage/jump.png`, l'étiquette jaune, JUMP, le personnage et une scie, 1200 × 630, produite à la […] **→ Détail : [docs/regles/jump/finitions-lot-i6-de-la-plateforme.md](../../docs/regles/jump/finitions-lot-i6-de-la-plateforme.md)**

## Caméra (lot 14)
**Les secousses sont réservées à la mort** (`SHAKES.mortAmp` 0,1 tuile, `mortDur` 0,12 s) et **jamais déclenchées par une action ordinaire** : saut, saut mural, atterrissage (même une […] **→ Détail : [docs/regles/jump/camera-lot-14.md](../../docs/regles/jump/camera-lot-14.md)**

## Plateforme (lot I7) — le plein écran en vue
**Règle (Nathan) : le plein écran est important sur mobile (la barre du navigateur mange la hauteur en paysage) : il est toujours en vue, jamais seulement dans la pause.** Le rendu, la […] **→ Détail : [docs/regles/jump/plateforme-lot-i7-le-plein-ecran-en-vue.md](../../docs/regles/jump/plateforme-lot-i7-le-plein-ecran-en-vue.md)**

## Plateforme (lot G1) — le bouton fantôme en vue
**Un seul fantôme choisi à la fois, qui tourne** (`ghostChoice.ts`, pur) : **le tien → le premier → aucun → le tien**, en **sautant** le premier s'il n'existe pas (pas lu, ou c'est toi ; « le tien » et « aucun » existent toujours). **→ Détail : [docs/regles/jump/plateforme-lot-g1-le-bouton-fantome-en-vue.md](../../docs/regles/jump/plateforme-lot-g1-le-bouton-fantome-en-vue.md)**

## iPhone et application ajoutée à l'écran d'accueil (lot 53)
Jump hérite du socle (`CLAUDE.md` racine, `apps/web/CLAUDE.md`, « iPhone : le plein écran par l'écran d'accueil ») : sur iPhone le bouton plein écran (accueil, pause, plaque de la partie) ouvre l'aide « Sur l'écran d'accueil » (en partie la **pause** s'ouvre d'abord : `avantAide: () => setMenu(true)`) ; en mode application, sans profil, au premier lancement, « Retrouver mon profil » (`retrouverJeu.ts`, à la demande, ne reçoit que ce que `main.ts` lui passe). Les marges de sécurité de Jump étaient déjà celles de la charte (`hud.css`, `interface.css`, `ecrans.css` : `max(<marge>, env(safe-area-inset-*))`). Test : `apps/web/e2e/iphone.spec.ts` (l'accueil de Jump en mode application, portrait et paysage).

## Horloge unique (lot 15)
**(Lot 27 : le « Prêt… » est devenu le décompte « 3, 2, 1, Partez ! **→ Détail : [docs/regles/jump/horloge-unique-lot-15.md](../../docs/regles/jump/horloge-unique-lot-15.md)**

## Seconde voie (lot 16)
règles du générateur : `packages/jump-sim/CLAUDE.md`, « Seconde voie (lot 16) ».
- **Repère d'entrée de la voie lente** (`src/slowRoute.ts`, dessiné par `scene.ts`, toujours, sur un niveau du jour) : l'ouverture du mur gauche de la cage est cernée d'un cadre et porte deux chevrons qui montent, en **`--dj-papier` cerné de `--dj-encre`** (`SLOW_MARK`, couleurs neutres de la charte « Cartouches »). **Jamais rouge** (réservé aux dangers), jamais le jaune du personnage, **pas de texte**. Test `test/voieLente.test.ts` : couleur neutre, lisible à 3:1 (face ou cerne) sur le ciel et chaque plan de chaque thème, dessiné dans l'ouverture. Un nouveau repère passe par ce test.
- **`?debug`** : les deux trajets de chaque portion dure (preuve en cyan, voie lente en crème, `slowDebugPaths`) et l'étiquette « rapide · lente (+surcoût) » ; ligne « voie lente » de la surimpression (dès le palier d'entrée) ; `__jump.daily.slowRoutes`, `__jump.daily.slowTicks`. e2e : `voie-lente.spec.ts` (la voie enregistrée jouée pas à pas dans la page).
- La charge du worker et du cache porte les voies (`PAYLOAD_FORMAT` 3) : les médailles en dépendent (`medalsWithSlow`).

## Lancement public (lot R8)
- **Archives à partir de la journée n° 1** : `archiveDays(today, first = PREMIER_JOUR_ARCHIVES)` (`homeLogic.ts`, `lancement.ts`) : du plus récent (hier) à la journée n° 1 de Du Jour (`config/lancement.json`, jamais avant `PREMIER_JOUR_JUMP`) ; vide le jour du lancement et avant. `VITE_LANCEMENT_PREMIER_JOUR` la déplace à la construction (recette, aperçus, e2e : la CI construit avec `2026-10-13`), jamais en production.
- **« Nouveau départ »** : `generationInit.ts` (importé en premier par `main.ts`), `appliquerGeneration` sur chaque lecture regroupée (`reads.onLoad` ; `DayBundle.generation`), le message sur l'accueil (`home.ts`, une fois) : `packages/profile/CLAUDE.md`, « Nouveau départ (lot R8) ». Une identité inconnue du serveur (`unknown_player`) n'est pas une erreur : le jeu s'ouvre sans message (`e2e/nouveau-depart.spec.ts` de `apps/web`, aussi pour Jump).

## Carnage (lot 17)
Le monde du carnage est celui du héros seul ; les autres vies le traversent à une autre phase de l'horloge unique. **→ Détail : [docs/regles/jump/carnage-lot-17.md](../../docs/regles/jump/carnage-lot-17.md)**

## Tests e2e et CI (lots 15b et 17)
Deux erreurs de CI se sont répétées (lot I7 : plein écran sur WebKit ; lot 15 : « Prêt… » et secousse de la mort) : un test qui échoue sur Firefox ou WebKit n'apparaît qu'à la CI complète (`main`, nuit, lot de mise en production). **→ Détail : [docs/regles/jump/tests-e2e-et-ci-lots-15b-et-17.md](../../docs/regles/jump/tests-e2e-et-ci-lots-15b-et-17.md)**

## Annonce des éléments à horloge (lot 18)
**Principe (valable pour tout élément à horloge, présent et à venir)** : il **annonce chacun de ses changements d'état**, assez tôt, par **un signe continu et simple** (une jauge qui descend ou monte, une vitesse qui décroît). **→ Détail : [docs/regles/jump/annonce-des-elements-a-horloge-lot-18.md](../../docs/regles/jump/annonce-des-elements-a-horloge-lot-18.md)**

## Outil de la variété `?semaine` (lot 19)
**Lot R9 : réservé aux constructions hors production** (recette, aperçus, local) : `?semaine=` et `&generateur=` sont fermés quand `VITE_PRODUCTION=1` et `outils/` (dont `semaine-g13.json`) […] **→ Détail : [docs/regles/jump/outil-de-la-variete-semaine-lot-19.md](../../docs/regles/jump/outil-de-la-variete-semaine-lot-19.md)**

## Sécurité (lot R7 de la plateforme)
Rapport : `docs/plateforme/audit-securite-2026-10.md`. **`?api=` sur la production** (`BUILD_RESTRICTED` = `VITE_PRODUCTION=1`, `storage.ts`) ne vise que `/`, `demo`, l'origine de la page ou la machine locale (`rankApiBase` → `apiFromAddress` de `@cdj/profile`) : un lien piégé ne fait plus envoyer l'identifiant secret à un autre serveur. `jump/demo/` n'est **pas publié en production** (`scripts/site.mjs`, `retirerDemos` : chaque fichier d'un jour à venir porte `first.replay`, la preuve de l'auteur du niveau). Reste à décider (lot L-FUT de l'audit) : le fichier figé de demain (`levels/<demain>.json`) est servi la veille par Hosting (depuis le lot R9 **sans sa `preuve`**, mais avec la grille). **Lot R9 : `?semaine=` et `outils/` sont fermés en production** (voir « Lot R9 — la preuve de l'auteur ne quitte pas le serveur »). Tests : `test/classement.test.ts` (`rankApiBase`).

## Plateformes mobiles (lot 20)
**Aspect** (`src/platformArt.ts`, pur côté tampons, un groupe par plateforme, rien de créé en jeu) : une **dalle crème cernée d'encre** (`PLATFORM_LOOK` : `--dj-papier`, `--dj-encre`, […] **→ Détail : [docs/regles/jump/plateformes-mobiles-lot-20.md](../../docs/regles/jump/plateformes-mobiles-lot-20.md)**

## Économie des lots (lot 21)
Nathan veut des CI de PR courtes et moins de jetons par lot : un lot Jump s'y tient.
- **Mesures sur 120 dates** (`measure:jump`, `variete:jump`) ; **365 seulement si le lot porte sur la variété**.
- **La référence avant / après se lit dans le README du lot précédent** : on ne relance pas l'ancien générateur (sauf `--generateur=<n>` quand un lot garde une référence).
- **Outils de morceaux avec `--only=<id>`** sur les morceaux touchés (sauf `solve:modules`, voir `packages/jump-sim/CLAUDE.md`, « Rythme de la nuit »).
- **Sorties de commandes courtes** (`| tail`, `| grep`) ; **pas de relecture complète des gros fichiers de données** (`catalog.ts`, `phases.json`, `solutions.json`, golden) : on les cherche, on ne les lit pas.
- **README de lot court** : ce qui a changé, ce qui reste à décider, le scénario en 2 clics. Des tableaux seulement quand ils portent une décision.

## Catalogue et générateur à la demande (lot 21)
**Le catalogue des morceaux, le générateur et le solveur de la preuve ne sont pas dans le premier chargement.** **→ Détail : [docs/regles/jump/catalogue-et-generateur-a-la-demande-lot-21.md](../../docs/regles/jump/catalogue-et-generateur-a-la-demande-lot-21.md)**

## Presses (lot 22)
**Aspect** (`src/pressArt.ts`, un groupe par presse, rien de créé en jeu) : un **corps sombre** (`PRESS_LOOK.body`, dans le style de l'usine), dont **la face basse porte le rouge des […] **→ Détail : [docs/regles/jump/presses-lot-22.md](../../docs/regles/jump/presses-lot-22.md)**

## Lot R9 — la preuve de l'auteur ne quitte pas le serveur
**Aucun fichier servi ne contient la preuve.** La construction de production (`VITE_PRODUCTION=1`) retire le champ `preuve` de chaque `levels/*.json`, et ne publie ni `outils/` (`?semaine=` […] **→ Détail : [docs/regles/jump/lot-r9-la-preuve-de-l-auteur-ne-quitte-pas-le-serveur.md](../../docs/regles/jump/lot-r9-la-preuve-de-l-auteur-ne-quitte-pas-le-serveur.md)**

## Champignons (lot 23)
**Aspect** (`src/mushroom.ts`, logique pure ; `src/mushroomArt.ts`, objets Three.js — un groupe par champignon, une géométrie partagée, rien de créé en jeu) : un **chapeau violet** […] **→ Détail : [docs/regles/jump/champignons-lot-23.md](../../docs/regles/jump/champignons-lot-23.md)**

## Stalactites (lot 24)
**Aspect** (`src/stalactite.ts`, logique pure ; `src/stalactiteArt.ts`, objets Three.js — un groupe par stalactite, une géométrie partagée, rien de créé en jeu) : un **pic de glace** bleu […] **→ Détail : [docs/regles/jump/stalactites-lot-24.md](../../docs/regles/jump/stalactites-lot-24.md)**

## Lasers (lot 25)
**Aspect** (`src/laser.ts`, logique pure ; `src/laserArt.ts`, objets Three.js — un groupe par laser, une géométrie par longueur, rien de créé en jeu) : **le rayon allumé porte le rouge des […] **→ Détail : [docs/regles/jump/lasers-lot-25.md](../../docs/regles/jump/lasers-lot-25.md)**

## Ponts à interrupteur (lot 26)
**Aspect** (`src/bridge.ts`, logique pure ; `src/bridgeArt.ts`, objets Three.js — un groupe par tuile, des géométries partagées, rien de créé en jeu) : **éteint, un pont n'est qu'un contour […] **→ Détail : [docs/regles/jump/ponts-a-interrupteur-lot-26.md](../../docs/regles/jump/ponts-a-interrupteur-lot-26.md)**

## Ajustements (lot 27)
**Les commandes de reprise sont celles de DailyTrack** (`apps/web/src/input.ts`, lues, pas modifiées ; un test lit ce fichier et compare, `test/rediffusion.test.ts`, bloc « lot 27 ») — **R […] **→ Détail : [docs/regles/jump/ajustements-lot-27.md](../../docs/regles/jump/ajustements-lot-27.md)**

## Commandes tactiles fiables (lot 29)
**Règle : aucune touche ne reste tenue sans un doigt posé dessus.** La simulation, les rediffusions, les versions et la disposition des commandes ne changent pas ; Track a son propre code (`apps/web/src/touchUi.ts`), non modifié.
- **L'état se déduit des doigts posés et de leur position** (`TouchPad`, `touch.ts`, pur) : chaque doigt suivi porte ce qu'il touche **maintenant** (`left`, `right`, `jump`, `band` ou `out`), recalculé à chaque déplacement et à chaque nouvel écran (`layout` est un accesseur). Un doigt qui sort d'une zone la relâche (bande haute et dehors de l'écran ne commandent rien, mais le doigt reste suivi) ; celui qui entre dans une autre l'enfonce ; parmi plusieurs doigts de direction, le **dernier entré** dans sa zone décide. Plus de rôle figé à la pose, plus de compteur « appuyé / relâché » par bouton : pour qu'une commande s'arrête, il suffit qu'un doigt quitte la liste. Le toucher se décide toujours par la **zone**, jamais par le bouton dessiné.
- **Ce qui fait quitter la liste** (`touchUi.ts`) : `pointerup` et `pointercancel` écoutés **sur la fenêtre, en capture** (un doigt qui finit sur un bouton du haut n'y arrivait pas à la couche) ; `lostpointercapture` (seulement si la couche ne tient plus ce pointeur : l'événement peut arriver après la pose du doigt suivant qui réutilise l'identifiant, DailyTrack l'a mesuré) ; **la liste des touchers du système** (`touchstart`/`touchmove`/`touchend`/`touchcancel`, `TouchPad.reconcile` : moins de touchers que de doigts suivis = un lever s'est perdu, on garde pour chaque toucher le doigt le plus proche ; autant ou plus : rien n'est conclu) ; une souris dont le bouton est lâché hors de la page (`buttons === 0` au déplacement). **Tout est lâché** au focus perdu (`blur`), à chaque `visibilitychange`, à `pagehide`, `pageshow`, `freeze`, `orientationchange`, `resize`, à l'ouverture d'un panneau (`suspend`).
- **Événements de souris émulés** : un événement de souris qui suit un toucher de moins d'une seconde (`isMouseEcho`, `MOUSE_ECHO_MS`) est ignoré ; la souris seule simule toujours le doigt (`?touch=1`). **`touch-action: none`** est sur `#touch` (et sur `html`/`body`), inchangé, vérifié par `mobile.spec.ts`.
- **`?debug` : la ligne `#touchdebug`** (bas de l'écran, au centre, entre les flèches et le saut ; `touchDebug.ts`, outil en français exempté des catalogues) : « doigts 1 · ← tenue », « doigts 2 · → et SAUT tenues », « doigts 0 · aucune touche tenue » ; elle ajoute « · dernier relâchement : <cause> » (annulation, perte de capture, toucher perdu, focus, visibilité, pagehide, rotation, panneau, souris ignorée) pour dire **quel garde-fou a rattrapé un doigt**. Sur un téléphone, la ligne doit revenir à « aucune touche tenue » dès que le dernier doigt est levé, quoi qu'on ait fait avant. `__jump.touch.fingers` donne `{ id, zone, x, y }`.
- **Tests** : `test/touch.test.ts` (glisser entre zones, sortie, deux doigts dans les deux ordres, identifiant réutilisé, `reconcile`, écho de souris, ligne de debug) ; e2e `mobile.spec.ts`, bloc « commandes tactiles fiables (lot 29) » (**`@regression`** : le budget de 900 s de la CI de PR n'a plus de marge, ils tournent la nuit et dans la CI complète ; la garde de chaque PR est `test/touch.test.ts` ; doigts émulés : glisser ← → saut, sortie par la bande, `pointercancel` + `touchcancel`, lever perdu, perte de capture, focus / visibilité / pagehide / rotation, deux doigts, souris émulée). `Fingers.cancel()` (`e2e/phone.ts`) annule les doigts posés.

## Message en direct (lot N2)
Le message de l'administration (`GET /api/annonce`, `ou: "jump"`) : `surveillerAnnonce` de `@cdj/profile`, `bandeauAnnonce` de `@cdj/ui` (`apps/portail/CLAUDE.md` et `packages/profile/CLAUDE.md` pour le reste). **→ Détail : [docs/regles/jump/message-en-direct-lot-n2.md](../../docs/regles/jump/message-en-direct-lot-n2.md)**

## Blocs alternés lisibles (lot 28)
**Un repère de l'état suivant, sur les blocs** (`dynamicArt.ts`, `createDynamicBlocks`) : le jeu qui n'est pas plein est le jeu qui apparaîtra **au prochain saut**. **→ Détail : [docs/regles/jump/blocs-alternes-lisibles-lot-28.md](../../docs/regles/jump/blocs-alternes-lisibles-lot-28.md)**

## Saut moins sensible (lot 30)
**Micro-saut** (`JUMP_MICRO_MAX` = 4 pas) : un appui de 4 pas ou moins donne le saut bas d'avant (0,98 à 1,55 tuile) ; les 5ᵉ et 6ᵉ pas c'est le petit saut (1,89 tuile) ; aucune commande ni écran ne change. **→ Détail : [docs/regles/jump/saut-moins-sensible-lot-30.md](../../docs/regles/jump/saut-moins-sensible-lot-30.md)**

## Course du n° 1 (lot 31)
**Le jeu ne fait que jouer une rediffusion déjà servie** : aucune route de l'API ne change. **→ Détail : [docs/regles/jump/course-du-n-1-lot-31.md](../../docs/regles/jump/course-du-n-1-lot-31.md)**

## Rappel des touches en partie (retouche d'après le lot 53)
- **`#astuces`** (`index.html`, `hud.css`, clé `hud.astuces`) : une ligne de `plaque--petite` en bas à gauche, **sur ordinateur seulement** (`body.touch` la cache : les boutons sont dessinés), qui dit « R : point de passage · Entrée : recommencer · G : fantôme · P : pause » ; sans toucher (`pointer-events: none`), cachée à l'accueil, en pause, pendant le carnage et sous l'arrivée. Un nouveau raccourci de partie s'y ajoute (catalogues fr et en).

## Page d'outils `/jump/admin/`
Sœur de `/track/admin/` (`apps/web/CLAUDE.md`, « La porte de la page d'outils »), reliée au panneau `/admin/` de la plateforme (entrée « Jump » du menu, retour `?retour=/jump/admin/` : `RETOURS_PERMIS`, `apps/portail/CLAUDE.md`). **→ Détail : [docs/regles/jump/page-d-outils-jump-admin.md](../../docs/regles/jump/page-d-outils-jump-admin.md)**

## Musique commune (lot « musique »)
Procédure : `docs/plateforme/musique.md` ; règles : `packages/musique/CLAUDE.md`. **Jump se branche en une ligne** : `const musique = brancherMusique("jump", gameStorage)` (`main.ts`, après `new JumpAudio`) — `@cdj/musique/branche`, **+362 o** au premier chargement, le lecteur se charge au premier geste. Trois appels seulement : **la baisse pendant un niveau** (`syncPause` : `musique.baisser(blocked || panelOpen ? 1 : MUSIQUE_EN_NIVEAU)`, 0,6 — pleine à l'accueil, en pause et dans les écrans ; **à décider par Nathan**), **« Son : non » coupe aussi la musique** (`applySettings` et le démarrage : `musique.sourdine(settings.sound === false)`, sans toucher au volume de la musique) et **le bloc de réglages** (`settingsUi.ts` : `panneauMusique` de `@cdj/ui` dans la section « Son », monté à la première ouverture des Réglages avec le lecteur ; `SettingsUiOptions.musique`). **Les réglages sont ceux de la plateforme** (`cdj:musique`, communs à Track et Tower) : pas de volume de musique dans `jump:settings` ; les trois curseurs de Jump (général, effets, ambiance) restent ceux du jeu. Aucun autre changement du jeu ; la musique ne touche ni à la simulation ni aux rediffusions. Budget : `docs/plateforme/budgets.md` (`jump.jsCss`, ligne `musique.lecteur` pour ce qui est à la demande ; la mesure de Jump exclut `demarrage-` et `panneauMusique-`).

## Les menus à la manette (lot M1)
moteur : `packages/ui/CLAUDE.md`, « La manette dans les menus ». **Tout écran de Jump se pilote à la manette ; il déclare son action principale ; un appui ne sert jamais deux fois.** `src/manette.ts` (chargé à la première manette par `main.ts`) : `ECRANS_MANETTE`, **une ligne par écran** (`#home` → `#home-play`, la pause `#menu` → `#menu-resume`, `#arrival` → `#arrival-replay` et B → `#arrival-home`, le carnage `#carnage` → `#carnage-pause` et B → `#carnage-close`…) ; un nouvel écran s'y ajoute (`test/manette.test.ts`). En partie la manette est celle du jeu (`Controls.pollPad` lit `padPourLeJeu(pad)`) : un menu ouvert la lui cache, sauf Start. Le moteur (`manette-*.js` et sa feuille) est exclu de la mesure du premier chargement comme `catalogue.en-` (`mesureJump`, `e2e/poids.spec.ts`) : à la demande, à la première manette ; voir `docs/plateforme/budgets.md`.

## Commandes réglables (lot M2)
Module et règles : `packages/ui/CLAUDE.md`, « Les commandes réglables (lot M2) ». **Jump déclare ses actions dans `src/commandes.ts` (`ACTIONS_JUMP`) et ne lit jamais une touche en dur** : `input.ts` (`Controls`) et `main.ts` (G) passent par `commandes` **avant** les bits de commande — la simulation reçoit les mêmes bits, aucune rediffusion ne change (`test/commandes.test.ts` : mêmes bits, même rediffusion, même résultat avec d'autres touches).
- **Actions et origine** — clavier / manette : `gauche` ← A / stick et croix (fixes) ; `droite` → D / idem ; `sauter` Espace ↑ W / A ; `reprendre` R / Y ; `recommencer` Entrée / X ; `pause` P / Start (fixe) ; `fantome` G. Fixes : Échap, Start, stick et croix. **B ne saute plus par défaut** (il reste « retour » dans les menus : une action n'a qu'un bouton) ; on le choisit dans Réglages › Commandes.
- **Les aides sont des paramètres** : `commandes.clavier.*`, `commandes.manette.*`, `hud.astuces` (`#astuces`), `bandeau.aide`, `arrivee.aideClavier` écrivent `{sauter}`, `{m_sauter}`… ; `i18n.ts` les fournit et redessine les textes liés (`data-t`) au changement. `input.ts` : Entrée sur un bouton, un lien ou un champ reste l'affaire de cet élément (`onControl`), quelle que soit la touche choisie pour « recommencer ».
- Réglages › Commandes (`settingsUi.ts`, `#settings-commandes`) charge l'écran du socle à la première ouverture ; l'onglet Tactile reprend la taille des boutons (inchangé). **Budget** : `commandesEcran-*` et `commandes-*.css` sont à la demande et exclus de `mesureJump` (`scripts/budgets.mjs`, `e2e/poids.spec.ts`), comme `manette-` ; un spec de plus : le test de `e2e/smoke.spec.ts` (changer Sauter sur Z, puis Z saute).

## Points de passage sur leur palier (lot 32)
règles de la simulation et du générateur : `packages/jump-sim/CLAUDE.md`, « Points de passage sur leur palier (lot 32) ». **Le jeu ne fait que jouer la simulation** : `JUMP_SIM_VERSION` 14, `JUMP_GENERATOR_VERSION` 26 ; le fanion se lève quand `AttemptState.checkpoint` change (le personnage est dans la zone du palier : centre dans ses deux colonnes, pieds à moins de 3 rangées du sol), rien d'autre ne change à l'écran, aux commandes ni aux rediffusions (golden et rediffusions v3 à v13 intacts ; les jours figés g21 à g25 se rejouent avec leurs règles). `carnage.ts` (`departures`) et `ghost.ts` datent encore le passage d'un point par la colonne du fanion : un affichage, à ±quelques pas près d'une pose en tombant, sans effet sur un résultat. **Le bouton « Voir la course du n° 1 » de l'accueil** : voir « Course du n° 1 (lot 31) » plus haut.

## Les amis dans le classement (lot F2)
**Où** : l'écran du classement du jour (`#leaderboard`, `screensUi.ts`, depuis l'accueil, l'arrivée et le résultat ; une archive a le même) reçoit le sélecteur « Tous · N / Amis · N » (`role="radiogroup"`, 44 px, jaune de Jump). **→ Détail : [docs/regles/jump/les-amis-dans-le-classement-lot-f2.md](../../docs/regles/jump/les-amis-dans-le-classement-lot-f2.md)**

## « Un bug ? Une idée ? » (lot C1)
L'entrée est **dans la pause** (`#menu-retours`, `pause.retours`) **et dans Réglages** (`#settings-retours`, `reglages.retours`) ; `ouvrirRetours` de `main.ts` charge `src/retoursJeu.ts` (à la demande, n'importe rien du jeu) → le dialogue commun. Le dialogue est dans `ECRANS_MANETTE`. **Budget** : `mesureJump` compte tous les fichiers hors liste : `retoursJeu-` est exclu de `jump.jsCss` (comme `manette-`) et mesuré par la ligne `retours.dialogue`.

## « Mon groupe » dans le classement (lot C1, partie C)
Règle commune aux trois jeux : `packages/kit/CLAUDE.md`, « « Mon groupe » dans le classement ».

## Le kit de jeu (lot K3)
Jump se branche par `@cdj/kit` (`packages/kit/CLAUDE.md`) et **ne recopie plus** : le stockage préfixé (`storage.ts` ne garde que `jump:` et `storageKey`), l'interrupteur (`interrupteurInit.ts`), la génération de données (`generationInit.ts`), le message en direct (`messageEnDirect.ts` : **chargé à la demande** au premier écran qui peut l'afficher ; `messageEnDirectLogic.ts` garde la règle propre à Jump, quel écran), le DOM de « jeu suivant du jour » (`jeuSuivant.ts`, à la demande), le gabarit de la ligne à partager (`share.ts`), le cycle du fantôme (`ghostChoice.ts`) et la lecture du fichier figé (`browserFrozen`). **`scripts/budgets.mjs` (`mesureJump`) exclut les morceaux `message-*` et `suite-*`** (chargés par `import()`, comme `classementAmis-*`) : un lot qui ajoute une brique à la demande du kit dans Jump ajoute son préfixe à cette liste. Le cadre des écrans reste `creerCadre` de `@cdj/ui`.

## Des envois sans faux « serveur indisponible » (lot D2)
**Délai commun** : l'envoi d'une partie a **20 s** pour répondre (`DELAI_ENVOI_MS` de `@cdj/profile`, une seule constante pour les trois jeux), pas 8 s. **→ Détail : [docs/regles/jump/des-envois-sans-faux-serveur-indisponible-lot-d2.md](../../docs/regles/jump/des-envois-sans-faux-serveur-indisponible-lot-d2.md)**
