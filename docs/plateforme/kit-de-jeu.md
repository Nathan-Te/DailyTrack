# Le kit de jeu — inventaire et conception (lot K0, étude sans code)

*2 novembre 2026. Aucune ligne de code n'a changé pour écrire ce document ; tout ce qui suit a été lu dans le dépôt (chemins cités). Les chiffres de l'inventaire viennent de `grep` sur les fichiers **hors des zones de jeu** (`apps/<jeu>/**`, `packages/<jeu>-sim/**`, `apps/api/src/<jeu>*.ts`), commentaires seuls exclus quand on dit « avec logique ».*

**En trois phrases.** Tower (le 3ᵉ jeu) est nommé dans **96 fichiers de la plateforme** hors de ses zones (82 avec une vraie ligne de code ou de configuration), plus 40 fichiers de test et 26 documents ; Jump l'est presque autant (21, 25, 30 et 41 fichiers selon la couche). Ces endroits se laissent presque tous dériver d'**une fiche par jeu** (§ 3), et la plomberie de l'API comme du client est déjà écrite trois fois à quelques détails près (§ 2, § 4). Le plan (§ 6) migre **un jeu à la fois**, sans toucher à une table, à une rediffusion ni à un golden.

## 1. L'inventaire du « en dur »

Lecture : « fichiers » = fichiers qui nomment le jeu ; « logique » = ceux qui ont au moins une ligne qui n'est pas un commentaire ; « lignes » = ces lignes. Mesure : un `grep -ci tower` par fichier, puis les lignes qui ne commencent pas par `//`, `*`, `/*`, `#` ou `<!--` (Tower est le plus récent, donc le plus complet : c'est ce qu'un 4ᵉ jeu devra encore toucher).

| Couche | Fichiers | Logique | Lignes |
|---|---|---|---|
| Portail (`apps/portail`, pages et sources) | 18 | 15 | 70 |
| API — sources (`apps/api/src`, hors `tower*.ts`) | 12 | 9 | 30 |
| API — outils et image (`apps/api/scripts`, `Dockerfile`, `package.json`, `tsconfig.json`) | 14 | 14 | 117 |
| Profil (`packages/profile`) + socle (`packages/core`) | 4 | 4 | 7 |
| `@cdj/ui` (composants, jetons, catalogues, contraste) | 16 | 10 | 54 |
| Musique (`packages/musique`, `musique/musiques.json`) | 6 | 4 | 25 |
| `scripts/` | 17 | 17 | 124 |
| `.github/workflows/` | 6 | 6 | 77 |
| Racine : `package.json`, `tsconfig.json`, `e2e/zones.json` (+ `firebase.json` : pas Tower, mais `/track/admin/**` et `/jump/admin/**`) | 3 | 3 | 16 |
| **Total code et configuration** | **96** | **82** | **520** |
| Tests partagés (portail, core, profile, ui, musique, `apps/web/test`, `apps/api/test`) | 40 | 40 | 278 |
| Documents (`docs/` hors `docs/tower`, lots, 5 `CLAUDE.md`) | 26 | 25 | 178 |

**Comparaison** : fichiers hors zones qui citent Jump — API 21, portail 25, core/ui/profile 30, scripts + `.github` + `zones.json` 41. Tower n'est pas un cas à part : chaque jeu s'est branché à la main au même endroit.

### Ce que chaque couche contient, et ce que la fiche fournirait

| Couche | Fichier (ligne) | Ce qu'il fait « en dur » | Fiche (§3) |
|---|---|---|---|
| Portail | `apps/portail/src/jours.ts:25-42` | cartouches `{code, jeu, lien, numero}` typées `"track"\|"jump"\|"tower"` | `id`, `ordre`, `premierJour` |
| Portail | `portail.ts:110,159-161` ; `profil.ts:131-134` ; `classement.ts:50,148-152` ; `partageDuJour.ts:14` | `NOM_JEU`, ternaires `code === "tower"` (accroche, étiquette, titre), `filter(jeu !== "tower")` du cumul | `nom`, `accroche`, `etiquette`, `classement.cumul` |
| Portail | `catalogue.ts:26,69-…` ; `admin.ts:428-429,720` ; `adminDiffusion.ts:574` ; `admin.css:614` ; `portail.css:109-120,663,709` ; `vitrine.ts:278` | accroches et thèmes par jeu, tuiles du tableau de bord, noms et couleurs de zones, étiquette | `themes`, `nom`, `etiquette` |
| Mentions | `mentions-legales/index.html:80,131,168-170` ; `legal/index.html:78,129,166-168` | `data-tables`, `data-piste` par jeu (vérifiés par `apps/portail/test/mentions.test.ts`) | `donnees.tables` |
| API | `apps/api/src/registry.ts:9` ; `games.ts:95,140-205` ; `admin.ts:413-415` | liste `GAMES` ; `ScorePortail`, `classement?: "temps"\|"hauteur"` ; `chiffres: { track, jump, tower? }` | fiche lue par le registre |
| API | `amis.ts:229,339` ; `classementAmis.ts:20,84-90,180-228` | `EXISTS … tower_results`, motif de route par jeu, `FormatClassement` | `classement.colonnes` |
| API | `remiseAZero.ts:27-43` ; `plans.ts:12` ; `db.ts:36-74` ; `codesErreur.ts:62` ; `api.ts:101-103,162` ; `server.ts:11,67-72` | libellé de chaque table, `GRANDES_TABLES`, migrations par table, `not_ranked`, options `towerFrozen` / `towerExecuteur` de `createApi` | `donnees.tables`, `jours`, `rejeu.fil` |
| API outils | `scripts/build-node.mjs:15-19` ; `Dockerfile:18-35` ; `package.json:14,23,38` ; `tsconfig.json:12` ; `smoke.ts:25-…` ; `smokeRead.ts:152-158` ; `recette-seed.ts:35-189` ; `routesChaudes.ts:53` ; `platformBudget.ts:70-76` | dossier des jours (`__TOWER_JOURS__`), `COPY` par jeu, un bloc par jeu de fumée, graine, plafonds de lignes lues, coût d'un joueur | `jours.dossier`, `smoke`, `budget` |
| Profil / core | `core/src/jeux.ts:21` et `profile/src/jeux.ts:13` ; `generation.ts:19` ; `annonce.ts:11,30` ; `core/nouveautes.ts:10,22` ; `zonesNouveautes.ts:9` | **deux copies** de `["track","jump"]` ; préfixes de stockage, destinations du message, zones de nouveautés | `etatDepart`, `stockage`, `message`, `zoneNouveautes` |
| `@cdj/ui` | `composants.ts:14,126,143,173` ; `jetons.ts:38-65` ; `composants.css:162,244` ; `contraste.ts:73-76` ; `amis.css:27` ; `catalogue.ts:15` ; `formats.ts:81` | type `Jeu`, étiquette dessinée, jetons et polices, paires de contraste, couleur du sélecteur d'amis, `jeu.<id>.nom`, `formatHauteur` | `etiquette`, `nom`, `classement.format` |
| Musique | `musique/src/types.ts:5-8` ; `scenes.ts:13-18` ; `description.ts:71` ; `musique/musiques.json` | liste des jeux, scènes (thèmes) par jeu, champ `jeux` de chaque morceau | `musique.scenes` |
| Scripts | `zones-jeu.mjs:13,47-54` ; `ci-scope.mjs:14,28-31,59-62,99` ; `ci-zones.mjs:25-26,119,135,144,175,193,402-411` | `JEUX`, globs de zones, `E2E_DIRS`, `PARTS_COMPLETES` | `zones`, `e2e` |
| Scripts | `site.mjs:25-37,105,233-258,285-315` ; `budgets.mjs:84-86,152` ; `mise-en-production.mjs:232,274,377-455,539-540` (52 occurrences) ; 11 autres (`recette.mjs`, `e2e-*.mjs`, `unit-durees.json`…) | `LAYOUT` du site, preuve interdite, lignes de budget, `NOMS_JEUX`, plan des jours de Tower, constantes de version | `site`, `budget`, `jours.mode`, `versions` |
| CI | `ci.yml` (34 lignes : matrice `suite == 'tower'`, `build -w @cdj/tower`, étapes) ; `production.yml` (28) ; `deploy-api.yml:55,271-279` ; `deploy-site.yml:43,162-170` ; `jours-figes.yml:87-122` ; `recette.yml:29-30` | une étape par jeu ; artefact `jours-tower`, `tower-plan`, `tower-poser` ; chemins du serveur | matrice et étapes générées |
| Racine | `package.json:16` ; `e2e/zones.json` (13) ; `firebase.json:43,52` | `build` enchaîne trois `-w` ; zones et specs ; en-têtes des pages d'outils | `paquets`, `e2e`, `admin.outils` |
| Budgets, tests, docs | `docs/plateforme/budgets.md` (19) ; `ciZones.test.ts`, `dureesE2e.test.ts`, `applications.ts`, 8 tests du portail, 6 de `musique`… ; `CLAUDE.md` racine et 4 autres, `docs/tests.md`, `codes-erreur.md`, `effacement.md`, `couts.md` | une ligne ou un test par jeu ; prose et tableaux par jeu | les tests parcourent les fiches ; la prose reste à la main |

### Constats (la preuve que la copie dérive)
- **Tower est absent du tableau de bord** : `apps/portail/src/admin.ts:428-429` n'a que les tuiles « Track finis » et « Jump finis », alors que l'API envoie `chiffres.tower` (`apps/api/src/admin.ts:415`) ; et `admin.ts:720` écrit `x.jeu === "jump" ? "Jump" : "Track"` : un résultat retiré à Tower s'afficherait « Track ».
- Deux copies des jeux publics : `packages/core/src/jeux.ts:21` et `packages/profile/src/jeux.ts:13`.
- **Les marges de budget ne sont pas à jour dans les consignes** : le `CLAUDE.md` racine annonce 710 o de marge pour Track et le lot TP 5 o pour le portail ; `docs/plateforme/budgets.md` (colonne Mesure) donne 42 o pour Track (296 694 / 296 736), 21 o pour l'accueil de Tower (39 979 / 40 000), 1 206 o pour Jump (382 760 / 383 966) et 1 558 o pour le portail (33 642 / 35 200).
- Les thèmes d'un jeu sont écrits à **quatre endroits** : la simulation (`packages/tower-sim/src/themes.ts:7`), les scènes musicales (`packages/musique/src/scenes.ts:17`), le catalogue du portail (`apps/portail/src/catalogue.ts:69-…`) et la palette du jeu — chacun gardé par un test, aucun dérivé des autres.

## 2. Les trois jeux côte à côte

**C** commun (même code ou presque) · **P** commun à paramétrer (même idée, autres réglages) · **J** propre au jeu.

| Système | Track | Jump | Tower | Classe |
|---|---|---|---|---|
| Jour et graine | `dailyCircuit(jour, variante, thème)` (`packages/sim/src/generator.ts`) ; planning de Nathan | `dailyLevel(jour)` (`jump-sim/src/daily.ts`) | `dailyTower(jour, version, tirage)` (`tower-sim/src/generateur/index.ts`) | **C** : `Rng`, `mixSeed` (`core/rng.ts`), jour de Paris (`@cdj/clock`), `core/calendar.ts`. **P** : sel, variante / tirage |
| Thèmes, mécaniques, sac | 8 thèmes (`sim/src/themes.ts`) | 5 thèmes à mécanique : tapis, glace, clignotant, alterné, vent (`jump-sim/src/themes.ts:25`) | 6 thèmes sans mécanique (`tower-sim/src/themes.ts:7`) | **C** : `ReglesSac {n, sel, ancien, estAncien}` (`core/sacThemes.ts`). **J** : le contenu |
| Générateur et version | `GENERATOR_VERSION` 21 ; `generatorVersionOf(jour)` | `JUMP_GENERATOR_VERSION` 26, version portée par le niveau figé | `TOWER_GENERATOR_VERSION` 3 ; `GENERATEURS` | **J** : l'algorithme. **P** : une version par jour, jamais réécrite |
| Registre des jours figés | un fichier de plages `{du, au, g, sim}` (`packages/sim/src/jours-track.json`) | un fichier par jour, preuve comprise (`apps/jump/public/levels/`, 18 fichiers) | un fichier par jour (`apps/tower/public/jours/`) ; pas de registre de versions | **P** : trois mécanismes pour la règle R11 ; `scripts/mise-en-production.mjs` les traite à part |
| Simulation | 120 Hz, sans moteur externe (`sim/CLAUDE.md`, « Règles de la simulation ») | 120 Hz, état entier (`idiv`) | 60 Hz, Rapier 2D déterministe, entrées entières ÷ 8 | **J**. Contrat commun : pure, sans DOM ni horloge ni hasard non semé (`purete.test.ts`) |
| Format de rediffusion | `core/codec.ts` ; séries `{count, steer, throttle, brake, respawn}`, `FORMAT = 1` (`sim/src/replay.ts`) | 3 bits par pas, en-tête de « vie » (`jump-sim/src/replay.ts`) | un octet de masque par plage, en-tête `[format][sim][g][genre]` (`tower-sim/src/rediffusion.ts`) | **C** : codec, version en en-tête, refus codés, plafond de ticks. **J** : les commandes |
| Vérification par le serveur | `replayRace` (`apps/api/src/cdj.ts`, 1 187 lignes) | `replayAttempt` (`jump.ts` 1 013 + `jumpLives.ts` 592) | `rejouerPourServeur` + fil (`tower.ts` 709, `towerRejeu.ts`, `towerFil.ts`) | **C** : l'ordre de validation est identique. **J** : la fonction de rejeu |
| Fantômes | trajectoire d'une voiture : premier, devant toi, choisis (`/ghost`, `/run/<ref>`) | rediffusion du premier (`ghost/first`) | **silhouette** de la tour (`/diamant`, `fantomeLocal.ts`) | **C** : règle G1 (débloqué en finissant), bouton à trois états (`ui/src/fantome.ts`). **J** : la forme |
| Critère de classement | `ms` ↑, envoi ↑, id ↑ (`results_by_time`) | `ticks` ↑, mêmes départages | `hauteur_mm` ↓, `vies` ↓, `ticks` ↑, envoi ↑, id (`tower.ts:244`) | **P** : une liste de colonnes et de sens |
| Médailles et Diamant | `medalsFor` : 0,92 · 1,045 · 1,07 · 1,13 du temps du pilote automatique (`sim/src/medals.ts:32`) | seuils figés avec le niveau (temps de la preuve de l'auteur) | Diamant = hauteur du bot plafonnée à 60 m, tirage par essais (25–60 m) ; 50 · 30 · 15 % (`tower-sim/src/medailles.ts`, `tirage.ts`) | **C** : `author·gold·silver·bronze`, la pastille. **P** : le barème. **J** : l'auteur (pilote, solveur, bot) |
| Ligne de partage | `Du Jour · Track #142 — 47,312 s — 🥇 — 23e/812` (`apps/web/src/share.ts:23`) | idem + `47 💀` (`apps/jump/src/share.ts:34`) | `Du Jour · Tower #12 — 42,7 m — 🥇 — ❤️❤️🖤` (`apps/tower/src/partage.ts:45`) | **P** : gabarit `Du Jour · {nom} #{n} — {score} — {médaille} — {extras} — {rang}` |
| HUD | plaques en haut (`apps/web/src/hud.css`) | bande de 30 px (`apps/jump/src/hud.ts`, 331 l.) | bande + plaque « Suivante » (`apps/tower/src/hud.ts`, 293 l.) | **J**, sur jetons et polices communs. Pas de composant de HUD commun |
| Écrans | `home*`, `arriveeUi`, `salon*`, `garage*` | `home.ts`, `arrival.ts`, `pauseMenu.ts`, `settingsUi.ts` | `accueil.ts`, `fin.ts`, `pause.ts`, `reglages.ts`, `archives.ts`, `ecrans.ts` (reprend les écrans de Jump : lot T7) | **P** : mêmes écrans et composants du socle. **J** : contenu ; Salon et Garage |
| Routes de l'API | `/api/day`, `submit`, `leaderboard`, `me`, `ghost`, `run/<ref>`, `garage`, `salon` | `/api/jump/` `info`, `day`, `submit`, `board`, `ghost/first`, `me`, `lives`, `deaths`, `carnage`, `bundle` | `/api/tower/` `info`, `day`, `submit`, `board`, `diamant`, `me` | **C** : `info`, `day`, `submit`, `board` (+ amis), fantôme, `me`. **J** : `lives`, `carnage`, `salon`, `garage` |
| Tests, CI, budget | zones `track-*`, `apps/web/e2e/durees.json`, 296 736 o | zones `jump-*`, 383 966 o | `tower-sim` / `tower-jeu` / `tower-banc`, fumée de 3 specs, 40 000 o | **P** : `e2e/zones.json`, `scripts/ci-*.mjs`, `budgets.md` |
| Plomberie client | `interrupteurInit` 15 l., `generationInit` 12, `jeuSuivant` 22, `storage` 94, `annonceTrack` 47, `amisClassement` 271 | 16, 14, 23, 115, `messageEnDirect` 87, `classementAmis` | 25, 12, 42, `stockage` 87, `messageDirect` 64, `amisClassement` 215 | **C** : copies qui ne diffèrent que par le préfixe et le nom (diff de 20 à 56 lignes pour 12 à 42) |

**Lecture.** Les cinq systèmes les plus communs : (1) graine, jour de Paris, sac de thèmes ; (2) enveloppe de rediffusion et validation serveur dans le même ordre ; (3) classement du jour, filtre Amis et noms de médailles ; (4) toute la plomberie client ; (5) le branchement à la plateforme (registre, remise à zéro, mentions, effacement, zones de CI, budgets). Les plus propres : **Track** — la voiture et ses circuits à blocs, le Salon et le Garage, la scène 3D ; **Jump** — le solveur et les morceaux, les vies et le carnage, les mécaniques de thème ; **Tower** — Rapier et les paliers, le bot qui fixe le Diamant, les sensations (yeux, panique, taquet).

## 3. La fiche d'un jeu

### Où elle vit, qui la lit

- **Un fichier JSON par jeu : `config/jeux/<id>.json`**, avec son type et son contrôle dans `@cdj/core` (`fiche.ts`). JSON, parce que tous les lecteurs le lisent sans compilation (scripts `.mjs`, shell des workflows, Vite, esbuild de l'image) et que le dépôt le fait déjà (`config/lancement.json`, `e2e/zones.json`, `jours-track.json`, `musique/musiques.json`). Un fichier par jeu : un lot de jeu n'écrit que **sa** fiche, sans conflit avec un autre lot.
- **Aucune requête de plus au chargement** : la fiche est lue **à la construction**. `npm run fiches` en tire de petits fichiers générés, un par lecteur, **versés au dépôt** et vérifiés « à jour » par un test (comme `jetons.css`) : `portail` (nom, ordre, lien, étiquette, thèmes, unité : seulement ce que l'accueil dessine), `serveur` (registre et image), `ci` (zones, specs, budget, matrices), `jeu` (nom, préfixe, scènes). Le portail n'embarque que sa projection, qui remplace les ternaires et tableaux supprimés (marge actuelle : 1 558 o, `portail.premier` de `budgets.md`) ; K1 le mesure.
- Les textes restent dans les catalogues `fr` + `en` ; la fiche porte les **clés** (`jeu.<id>.nom`, `portail.theme.<id>.<code>`).

### Le schéma proposé

```ts
interface FicheJeu {
  id: string;                       // dossier du site, préfixe de route et de stockage
  code: string;                     // code du registre serveur ("cdj" pour Track, sinon = id)
  ordre: number;
  nom: { fr: string; en: string };
  accroche: string;                 // clé de catalogue
  etiquette: { fond: string; coque: string; police: string; dessin?: "propre" | "generique" };
  etatDepart: "off" | "on";         // un nouveau jeu : "off" ; Track et Jump : "on" (hérité)
  premierJour: string;              // AAAA-MM-JJ ou "lancement"
  classement: {
    colonnes: { nom: string; sens: "asc" | "desc" }[];   // départages compris
    cumul: boolean;                 // seulement un jeu au temps
    unite: "ms" | "ticks" | "mm" | "points";
    format: "temps" | "hauteur" | "entier";              // une fonction de @cdj/ui
  };
  medailles: { methode: "facteurs-auteur" | "figees-niveau" | "pourcentage-diamant"; bareme: number[]; plafondDiamant?: number };
  partage: { extras: ("morts" | "vies" | "rang")[] };
  themes: string[];                 // codes ; mécaniques et palettes restent au jeu
  versions: { sim: string; generateur: string; medailles?: string };   // fichier:constante
  jours: { mode: "registre" | "fichier-par-jour"; dossier?: string; preuveInterditeEnProd: boolean };
  rejeu: { unitesServeur: number; fil?: boolean; maxTicks: number };
  donnees: { tables: { nom: string; sort: "videe" | "gardee" }[]; stockage: { prefixe: string; reglagesGardes: string[] } };
  message: { ou: string };  zoneNouveautes: string;  musique: { scenes: string[] };
  admin?: { outils: boolean };      // page /<id>/admin/
  e2e: { dossier: string; fumee: string[]; zones: Record<string, string[]>; navigateurs: string[] };
  budget: { lignes: Record<string, number> };          // ligne de budgets.md → plafond
}
```

### Remplie pour les trois jeux (extraits vérifiés)

| Champ | Track | Jump | Tower |
|---|---|---|---|
| `id` / `code` / `ordre` | `track` / `cdj` / 1 | `jump` / `jump` / 2 | `tower` / `tower` / 3 |
| `etiquette` | asphalte `#1E1B19`, coque `#4A4440`, Barlow Condensed (`jetons.ts:38,63`) | jaune `#FFD23F`, Lilita One (`:48,64`) | menthe `#9ED9BE`, coque `#2F7D62`, Rubik Mono One (`:53,65`) |
| `etatDepart` | `on` (`JEUX_PUBLICS`) | `on` | `off` |
| `premierJour` | 2026-10-13 (`sim/src/calendar.ts:11`), affichage depuis `lancement` | 2026-10-16 (`jump-sim/src/jours.ts:11`) | 2026-11-02 provisoire (`tower-sim/src/calendrier.ts`) |
| `classement` | `ms` ↑, envoi ↑, id ↑ · `cumul: true` · format `temps` | `ticks` ↑, envoi ↑, id ↑ · `cumul: true` · `temps` (pas de 1/120 s → ms) | `hauteur_mm` ↓, `vies` ↓, `ticks` ↑, envoi ↑, id ↑ · `cumul: false` · `hauteur` (`mm`, `formats.ts:81`) |
| `medailles` | `facteurs-auteur` 0,92 · 1,045 · 1,07 · 1,13 | `figees-niveau` | `pourcentage-diamant` 50 · 30 · 15, plafond 60 000 mm |
| `themes` | stade, rallye, banquise, nuit, campagne, canyon, col, ville | foret, usine, glace, nuit, neon | port, chantier, canyon, banquise, jungle, nuit |
| `jours` | `registre`, `packages/sim/src/jours-track.json` | `fichier-par-jour`, `apps/jump/public/levels`, preuve interdite | `fichier-par-jour`, `apps/tower/public/jours`, preuve interdite |
| `rejeu` | 1 unité par 5 000 pas (`replayCost.ts`) | idem, vies : 1 par 10 | 30 unités, fil de calcul, 20 300 ticks |
| `donnees.tables` | `results` (vidée), `circuits` (gardée), `planning`, `salon_*`, `garage_choices` | `jump_results`, `jump_lives` (vidées), `jump_levels` (gardée) | `tower_results` (vidée), `tower_levels` (gardée) |
| `stockage.prefixe` · `message.ou` · `zoneNouveautes` | `cdj:` · `track` · `track` | `jump:` · `jump` · `jump` | `tower:` · `tower` · `tower` |
| `partage.extras` · `admin.outils` | rang · oui | morts, rang · oui | vies · non |
| `budget` · `e2e.fumee` | `track.jsCss` 296 736 + 12 lignes à la demande · `zones.json` | `jump.jsCss` 383 966 · `zones.json` | `tower.jsCss` 40 000, `tower.jeu` 169 200, `tower.physique` 1 000 000 · `determinisme`, `partie`, `poids` |

**Ce que la fiche ne porte pas** : le générateur, la simulation, le rendu, les sensations, les fonctions de rejeu — tout ce qui est du jeu.

## 4. Les briques communes

### Côté serveur — un module `apps/api/src/jeux/` qui remplace trois copies

Le contrat qu'un jeu implémente (cinq fonctions, plus des crochets facultatifs) :

```ts
interface ContratJeu<Niveau, Rejeu> {
  versions(): Record<string, number>;
  genererJour(jour: number, version?: number): Niveau;                       // pure
  niveauDuJour(jour: number, figes: FichiersJours): Promise<NiveauDuJour>;   // fichier vérifié sinon généré
  decoder(texte: string): Rejeu;                                             // refus codés, jamais d'exception brute
  rejouer(rejeu: Rejeu, niveau: Niveau): Promise<{ score: number; departage: number[]; ticks: number; mesures: Record<string, number> }>;
  scoreDiamant(jour: number): Promise<number>;
  empreinteEntrees(rejeu: Rejeu): string;                                    // copies
  fantome?(jour: number): Promise<unknown>;                                  // silhouette ou rediffusion
  routesPropres?: Route[];                                                   // lives, carnage, salon, garage…
}
```

**Ce que le module générique fait autour** (écrit aujourd'hui trois fois dans `cdj.ts`, `jump.ts`, `tower.ts`) : les routes `info`, `day/<date>`, `submit`, `board`, `me`, fantôme ; l'**ordre de validation** (débit en base → taille → texte → jour de Paris et grâce de 10 min → versions → pseudo → copies → `spendReplays` → rejeu → écriture) ; le classement par les colonnes de la fiche, le rang par l'index, `filtre=amis`, `hidden = 0` partout ; `replay_copy` ; le fantôme réservé aux classés (`not_ranked`) ; les limites de lecture ; les jours figés ; l'interrupteur et l'aperçu (`ecrituresApercu`, `viderApercu`) ; les crochets `portail`, `admin`, `erase`, `rotateStatements`, `onRename`, **dérivés de la fiche et d'un adaptateur de table**.

**Les tables ne bougent pas** (règle des migrations en avant seulement, `apps/api/test/migrations.test.ts`) : pour Track, Jump et Tower, un **adaptateur** dit au module quelle table, quelles colonnes et quel index lire (`results(ms)`, `jump_results(ticks)`, `tower_results(hauteur_mm…)`). **Un 4ᵉ jeu** reçoit une table commune `resultats_jeu` avec des clés de tri **normalisées en croissant** (`cle1 = -hauteur` pour un score décroissant) : un seul index `(jeu, day, hidden, cle1, cle2, cle3, submitted_at, player_id)` sert tous les sens, sans table à générer par jeu (voir question 6). Toute requête nouvelle passe le plan `EXPLAIN` de `openTestDb` (R14).

### Côté jeu — les modules et leurs points d'extension

| Brique | Existe déjà dans `@cdj/…` | À extraire (de quel jeu) | Point d'extension |
|---|---|---|---|
| Graine, jour, sac de thèmes | **oui** : `core/rng.ts`, `calendar.ts`, `sacThemes.ts`, `@cdj/clock` | — | `ReglesSac` du jeu |
| Lecture du jour « fichier figé sinon généré » | non (`apps/tower/src/jour.ts`, `apps/jump/src/frozen.ts`, `dailyLoader.ts`) | de **Tower** (la plus petite) | `genererJour`, `lireJourFige` |
| Rediffusion : enveloppe (format, version, refus, plafond) | codec seul : `core/codec.ts` | de **Tower** (`rediffusion.ts`) et de Jump | le contenu des commandes |
| Fantôme (bouton 3 états, règle G1) | bouton : `ui/src/fantome.ts` | l'état Aucun / Ma meilleure / Diamant : de **Tower** (`fantomeEtat.ts`) | forme : trajectoire ou silhouette |
| HUD compact | jetons et polices : `ui` | « bande » et « plaque » : de **Jump** (`hud.ts`), reprises par Tower | le contenu des plaques |
| Écrans sur la scène (cadre, barre, étiquette sur le voile) | `ui/src/cadre.ts`, `dialogue.ts` | `ecrans.ts` + `ecrans.css` de **Tower** (reprend les écrans de Jump) | contenu de chaque écran |
| Manette et commandes | **oui** : `ui/src/manette*.ts`, `commandes*.ts` | les 3 `manette.ts` (22 à 24 lignes) | `ECRANS_MANETTE`, `ACTIONS` |
| Message en direct | composant `bandeauAnnonce` (profil + ui) | glue de `annonceTrack.ts`, `messageEnDirect.ts`, `messageDirect.ts` | destination = `id` |
| Interrupteur, génération, « jeu suivant », stockage, session | module « à la demande » : `ui/src/interrupteur.ts` ; client : `@cdj/profile` | les trois `interrupteurInit.ts`, `generationInit.ts`, `jeuSuivant.ts`, `storage.ts`, `session.ts` | `brancherJeu(fiche, ...)` en une ligne, comme `brancherMusique` |
| Envoi, file hors ligne, record local | non | `envoi.ts` + `records.ts` de **Tower**, `rankQueue.ts` de Jump, `online.ts` de Track | `envoyer(rejeu)` ; forme du record |
| Amis dans le classement | **oui** : `ui/src/amis.ts`, `profile/src/amis.ts` | la glue `amisClassement.ts` (271 / 215 lignes) | colonnes de la fiche |
| Ligne de partage | non | gabarit de `share.ts` / `partage.ts` | `extras` |
| Plein écran, aide iPhone, « Retrouver mon profil », liens communauté, musique, catalogue commun | **oui** : `ui/src/pleinEcran.ts`, `aideIphone.ts`, `retrouver.ts`, `liensCommunaute*.ts`, `brancherMusique`, `catalogue.ts` | — | scènes de la fiche, catalogues du jeu |

Où vit le code client extrait : **un nouveau paquet `@cdj/kit`** (voir question 8), chargé à la demande comme `@cdj/musique/branche`, parce que les budgets sont serrés (marges lues dans `budgets.md` au 2 novembre : accueil de Tower 21 o, Track 42 o, Jump 1 206 o, portail 1 558 o) — une brique générale ne doit jamais grossir le premier chargement d'un jeu qui ne s'en sert pas.

### Ce qui reste propre au jeu, et doit le rester
La simulation et son déterminisme ; le générateur et sa version ; le bot, le pilote ou le solveur qui fixent le Diamant ; le rendu (Three.js, scène, décor) ; les sensations ; les sons ; les routes que seul ce jeu a (`salon`, `garage`, `lives`, `carnage`) ; le contenu des écrans. Un jeu « trop particulier » déclare des `routesPropres` au lieu de forcer le module (voir question 5).

## 5. Le générateur et le jeu témoin

`npm run nouveau-jeu -- --id <id> [--classement temps|score]` crée, sans qu'on édite un fichier à la main :

| Créé | Contenu |
|---|---|
| `config/jeux/<id>.json` | la fiche, état `off`, une colonne de classement, médailles par défaut |
| `packages/<id>-sim/` | package, versions, générateur v1, partie, rediffusion (format, refus), test de pureté, golden à produire |
| `apps/<id>/` | page Vite branchée par `brancherJeu(fiche)` (interrupteur, génération, stockage, musique, manette, amis), catalogues `fr`/`en`, `e2e/` (déterminisme, partie, poids), `durees.json` |
| `apps/api/src/<id>.ts` + tests | le contrat de § 4 (cinq fonctions), tests SQLite **et** libSQL, « serveur = jeu » |
| `docs/<id>/` | `seed.md` **vide : « à écrire par Nathan »** (le générateur n'invente pas la vision), `consignes.md` squelette, `lots/` |
| Entrées mécaniques | `e2e/zones.json`, `durees.json`, une ligne de `budgets.md`, `packages/ui/test/applications.ts`, `traductions.md` — par un script idempotent |

Le reste (portail, registre, CI, mentions, effacement, remise à zéro, `smoke`, `recette:seed`, site, interrupteur, message en direct) se branche seul : les consommateurs lisent la fiche (K1, K2).

**Le jeu témoin, « Cibles »** : 30 s, grille de 8 × 6, 20 cibles tirées de la graine du jour qui apparaissent une à une ; on touche la case. Rediffusion = la suite (tick, case) ; score = cibles touchées (décroissant), départage = tick de la dernière touche ; état entier, 30 Hz, Canvas 2D ou DOM (pas de Three.js), rejeu en quelques millisecondes (pas de fil de calcul) ; Diamant = un bot qui touche chaque cible avec 12 ticks de délai. Il sert (1) de **modèle** que le générateur copie et renomme, (2) de **test de bout en bout du kit** : une partie jouée, envoyée, rejouée, classée sur une base de test, avec Amis, aperçu, remise à zéro, effacement et fiche lue partout, (3) de preuve des **deux sens** de classement : ses tests parcourent une fiche `score ↓` et une fiche `temps ↑`. Il n'est **jamais publié en production** (`site.mjs --production` l'exclut comme la vitrine `/ui/` ; le serveur ne le monte pas hors recette et local) : question 3.

## 6. Le plan de migration

**Règles** : un jeu migré par lot, jamais deux ; aucune table, aucun golden, aucune version, aucun fichier de jour ne change ; aucune rediffusion déjà acceptée ne devient invalide (les fonctions de rejeu et les `*_VERSION` ne sont pas touchées) ; chaque lot remesure les budgets.

| Lot | Contenu | Premier jeu migré, et pourquoi | Risques | Preuve que rien n'a changé pour les joueurs | Taille |
|---|---|---|---|---|---|
| **K1** la fiche, lue par la plateforme | schéma, validation, `npm run fiches` ; les consommateurs de présentation lisent la fiche (portail, `ui`, listes de jeux, musique, scripts de zones, CI, site, mentions). **K1b** fiche de Jump, **K1c** fiche de Track | **Tower** : le plus récent, `off` (personne ne le voit), le plus complètement branché ; on répare au passage le tableau de bord (constat § 1) | budgets du portail et des jeux ; matrices lues par les workflows ; ordre des cartouches | `node scripts/budgets.mjs` égal ou plus bas ; **comparaison avant / après** des sorties de `site.mjs`, `ci-zones.mjs --liste`, `zones-jeu.mjs` ; tests de portail et de zones inchangés ; aucun golden dans le diff | moyenne (K1b, K1c : petites) |
| **K2** le module serveur | `apps/api/src/jeux/` : routes, validation, classement par colonnes, amis, fantôme, copies, aperçu, effacement ; adaptateurs de table. **K2b** Jump, **K2c** Track (Salon, Garage : `routesPropres`) | **Tower** : une seule table de résultats, la plus petite surface, `off` ; son tri décroissant force le module à gérer les deux sens | le plus gros (trois fichiers de 700 à 1 200 lignes) ; lignes lues (R14) ; ordre de validation | **banc de réponses** : un scénario scripté (envoi, classement, amis, fantôme, effacement, aperçu, copie refusée) joué avant et après sur SQLite et libSQL, réponses identiques hors horodatages ; `routesChaudes`, plans `EXPLAIN`, `codesErreur`, `jours-passes.json` inchangés ; `smoke` sur la recette | grosse (K2b, K2c : moyennes) |
| **K3** les briques côté jeu | `@cdj/kit` : lecture du jour, enveloppe de rediffusion, état du fantôme, file d'envoi, cadre des écrans, interrupteur / génération / « jeu suivant » / stockage / message en direct, gabarit de partage. **K3a Jump, K3b Tower, K3c Track** | **Jump** : le plus de marge (1 206 o contre 42 o pour Track et 21 o pour l'accueil de Tower), ses fichiers sont l'origine des copies de Tower, risque faible (copies de 12 à 40 lignes) ; **Track en dernier** | budgets (le plus serré) : une brique qui grossit un premier chargement est refusée ; boucles de rendu | `budgets.mjs` ligne par ligne ; e2e Essentiel du jeu ; rediffusion de référence rejouée au bit près (`@navigateurs`) ; 5 captures au plus | grosse |
| **K4** générateur et jeu témoin | `npm run nouveau-jeu`, « Cibles », test de bout en bout du kit, procédure dans `CLAUDE.md` et `docs/orchestration.md` | aucun (le témoin est neuf) | le générateur édite des fichiers partagés (idempotence) ; le témoin ne doit pas fuir en production | la CI génère un jeu dans un dossier de test et lance `typecheck`, la fiche, les zones, le bout en bout ; `site.mjs --production` sans `/temoin/` ; budgets inchangés | moyenne |

**Fait : K1 (Tower), puis K1b + K1c faits** (lot K1bc, deux commits : Jump, puis Track — rapport `docs/plateforme/lots/lot-K1bc-fiches-jump-et-track.md`) : les trois jeux ont leur fiche, `JEUX_SANS_FICHE` est supprimé, la fiche gagne `dossiers` (Track : `web` et `sim`) et quelques champs facultatifs. **Reste pour K2** (serveur et tout ce qui nomme encore un jeu hors de la fiche) : `apps/api/src/**` (registre, `games.ts`, `admin.ts`, `amis.ts`, `classementAmis.ts`, `remiseAZero.ts`, `plans.ts`, `server.ts`, `build-node.mjs`, `Dockerfile`), `scripts/mise-en-production.mjs`, les workflows (`ci.yml`, `production.yml`, `deploy-api.yml`, `deploy-site.yml`, `jours-figes.yml`, `recette.yml`), `scripts/recette.mjs` et `e2e-*.mjs`, `scripts/verifier.mjs` (une commande e2e par jeu), `scripts/site.mjs` (`partagerPolices`, dossiers de démonstration et d'outils), `scripts/budgets.mjs` (une fonction de mesure par jeu) et le menu et les retours du panneau `/admin/`.

**Fait : K2 (Tower)** — rapport `docs/plateforme/lots/lot-K2-module-serveur-des-jeux.md` : le module `apps/api/src/jeux/` (contrat, adaptateur de table, routes, ordre de validation, classement, copies, aperçu, effacement, crochets, fil de calcul) et Tower dessus ; **le banc de réponses** (`apps/api/scripts/banc.ts`, `banc-tower.ts`) prouve que rien ne change. La fiche est lue par le serveur (`apps/api/src/fiches.generated.ts`, écrit par `npm run fiches`). Le contrat réel s'écarte un peu de § 4 (le détail est au rapport : `regle` / `calculer` / `restaurer` pour le niveau, des formateurs de réponses, `RefusJeu` plutôt qu'une exception HTTP). **Reste** : **K2b** Jump (`jump.ts`, `jumpLives.ts`, `routesPropres` : vies, carnage, `bundle`), **K2c** Track (`cdj.ts`, `routesPropres` : Salon, Garage, planning, fantômes choisis ; préfixe `/api`), chacun avec **son banc écrit sur le code d'avant**, puis **K2d** : ce qui lit encore les jeux en dur hors du module — `scripts/mise-en-production.mjs`, `scripts/recette.mjs`, `e2e-*.mjs`, `scripts/verifier.mjs`, `scripts/budgets.mjs`, les workflows (`ci.yml`, `production.yml`, `deploy-api.yml`, `deploy-site.yml`, `jours-figes.yml`, `recette.yml`), `apps/api/src/{registry,api,amis,admin,remiseAZero,plans,server}.ts` (`towerFrozen` / `towerExecuteur` de `createApi`, `MOTIFS_JEUX`, `GRANDES_TABLES`), `build-node.mjs` et le `Dockerfile`.

**Fait : K2b (Jump)** — rapport `docs/plateforme/lots/lot-K2bc-jump-et-track-sur-le-module.md` : `contratJump`, `ADAPTATEUR_JUMP`, les routes propres (vies, carte, carnage, fantôme du premier, lecture regroupée) ; le module gagne des **points d'extension facultatifs** (`valider`, `tableau`, `surcharges`, `recevoirOutils`…, `apps/api/CLAUDE.md`) ; les bancs de Jump **et de Track** sont versés (écrits sur le code d'avant), le banc de Jump est identique avant / après. **K2c (Track) n'est pas fait** : le lot s'est arrêté proprement après Jump ; l'inventaire de ce que Track demande au module (le niveau du jour sans colonne `rule` dans `circuits`, un classement sans départage par identifiant, des routes aux noms historiques, la validation dans un ordre propre, un débit après la lecture du corps…) est au README. **Reste pour K2d** : `scripts/mise-en-production.mjs`, `scripts/recette.mjs`, `e2e-*.mjs`, `scripts/verifier.mjs`, `scripts/budgets.mjs`, les workflows, et `apps/api/src/{registry,api,amis,admin,remiseAZero,plans,server}.ts` (`MOTIFS_JEUX`, `GRANDES_TABLES`…).

**Fait : K3** (les trois jeux, un commit chacun : Jump, Tower, Track) — rapport `docs/plateforme/lots/lot-K3-briques-cote-jeu.md`, paquet `packages/kit` (`@cdj/kit`). **Constat de mesure** : extraire une copie d'un jeu qui n'en avait qu'une n'allège pas son premier chargement (chaque couche coûte 20 à 100 o) ; le gain vient de ce qui devient **à la demande** (message en direct, DOM de « jeu suivant ») et du stockage partagé entre le kit et le jeu. **Ce que K4 trouve prêt** : stockage, génération de données, interrupteur, message en direct, « jeu suivant », cadre des écrans, ligne à partager par défaut (`ligneParDefaut`), cycle du fantôme, lecture d'un jour figé. **Ce que K4 ne trouve pas** : l'enveloppe de rediffusion (dans `@cdj/core`, zone du golden), la file d'envoi et les records locaux (trois logiques différentes), la colle des amis du classement ; ils restent à écrire pour le jeu témoin ou à unifier dans un lot à part.

**Fait : K4, partie 1** — rapport `docs/plateforme/lots/lot-K4-nouveau-jeu-et-temoin.md` : les scripts de CI, le site et les fonctions pures de « Mettre en production » lisent les fiches ; `ci.yml` et `stabilite.yml` n'ont plus d'étape par jeu. **Lot K4b** (`docs/plateforme/lots/lot-K4b-chaine-de-production-lit-les-fiches.md`) : **la chaîne qui fige, prépare et déploie les jours d'un jeu lit la fiche** (`jours.fabrication` ; `production.yml`, `jours-figes.yml`, `deploy-*.yml` et `mise-en-production.mjs` n'écrivent plus aucun jeu). **Restent nommés** : `smoke`, `smokeRead`, `recette:seed`, `routesChaudes`, `platformBudget`, `build-node.mjs` et le `Dockerfile` (image du serveur), `budgets.mjs`, le contrôle `api-image` de `ci.yml` (lot suivant) ; les parties 2 et 3 (réglages par défaut d'un jeu neuf, `npm run nouveau-jeu`, jeu témoin « Cibles ») ne sont pas commencées.

**Fait : K4c, partie A (les réglages par défaut d'un jeu neuf)** — rapport `docs/plateforme/lots/lot-K4c-jeu-neuf-generateur-et-temoin.md`. **Ce qu'un jeu neuf obtient sans l'écrire** : la table commune `resultats_jeu` (aucune table à lui), les routes `info`, `day`, `submit`, `board`, fantôme, `me`, l'ordre de validation, les copies, l'aperçu, l'effacement, la remise à zéro, la forme de ses réponses (tirée de sa fiche), l'enveloppe de rediffusion (`@cdj/core/enveloppe`), et côté client les records locaux, la file d'envoi hors ligne et la colle des amis (`@cdj/kit/{records,envoi,amis,amisDom}`). **Ce qu'il écrit** : sa simulation, son générateur, son rejeu, ses seuils de médailles, son rendu, ses sensations, ses sons. **Le kit n'est pas encore « terminé »** : le générateur `npm run nouveau-jeu`, le jeu témoin « Cibles » et le test de bout en bout (partie B) restent à faire, ainsi que la chaîne de production (K4b).

**Fait : K4e** — rapport `docs/plateforme/lots/lot-K4e-quatrieme-jeu-sans-retouche.md`. **La plateforme accepte un jeu neuf sans une ligne à son nom hors de sa zone** : étiquette générique et feuilles de style tirées de la fiche, clés de catalogue listées par la fiche (un test pour toutes), tests écrits sur « les jeux des fiches », champ `temoin` (jamais en production : site, registre du serveur, mise en production), registre du serveur, jours figés de l'image, mesure de budget, catalogues et traductions lus des fiches. **Preuve** : `scripts/jeu-fictif.mjs` (un jeu `essai` posé dans une copie du dépôt : typage et toute la suite, 18 tests en échec et une erreur de typage avant, zéro après). **Reste (lot K4f)** : l'assemblage côté jeu (`brancherJeu`), le générateur `npm run nouveau-jeu` (qui écrit aussi le bloc du `Dockerfile` et les clés de catalogue), « Cibles », le job « Kit de bout en bout », et ce que le rapport nomme encore (écritures du smoke et de `recette:seed`, routes chaudes, contrôle `api-image`).

**Ordre** : K1 → K2 → K3 → K4 ; K3 peut commencer dès K1 (client et serveur sont indépendants) ; K4 exige K1 à K3 pour Tower au moins (le modèle). Chaque lot : une PR brouillon, `Pour les joueurs : rien`, CI verte.

**Fait : K4d, partie 1** — rapport `docs/plateforme/lots/lot-K4d-generateur-et-temoin.md`. Amis, « Mon groupe », suggestions et classement des groupes d'un jeu neuf sont lus dans ses crochets (`amis.ts` ne nomme plus que l'héritage des trois jeux) ; le portail affiche un score en `points` (format de la fiche) ; la file d'envoi du kit suit l'enquête D1. **Le kit n'est toujours pas « terminé »** : une 4ᵉ fiche posée à l'essai casse 17 tests dans 11 fichiers et le typage (étiquette générique absente, feuilles écrites à la main, tests qui écrivent « trois jeux », entrées mécaniques) ; le rapport en donne la liste et propose **K4e** (la plateforme lit la fiche pour un 4ᵉ jeu) avant le générateur, « Cibles » et le job « Kit de bout en bout » (K4d bis).

## 7. Les questions pour Nathan

1. **Fiche en JSON ou en TypeScript ?** Recommandation : **JSON** (`config/jeux/<id>.json`), type et validation dans `@cdj/core` : lisible par les `.mjs`, le shell de la CI et l'image du serveur sans compilation.
2. **Qui écrit la fiche ?** Recommandation : le lot du jeu, dans sa zone (exception à la règle des zones : `config/jeux/<id>.json`) ; sinon chaque nouveau jeu reste un lot de plateforme.
3. **Jusqu'où va le jeu témoin ?** Recommandation : « Cibles », jouable, classé, rejoué par le serveur, **jamais en production** ; alternative : `preview` sur la recette pour y jouer. Un témoin par sens de classement ou un jeu et deux fiches de test ?
4. **Ordre de migration** : Tower d'abord pour la fiche et le serveur, Jump d'abord pour le client, Track toujours en dernier. Acceptes-tu « un jeu par lot » (K1b, K1c, K2b, K2c, K3a-c : **neuf lots** au lieu de quatre) ?
5. **Ce qui reste en dur** pour un jeu trop particulier : Salon et Garage de Track, vies / carnage de Jump, paliers de Tower, pages d'outils `/track/admin/` et `/jump/admin/`. Recommandation : des `routesPropres` branchées au module, qui ne contient aucune logique d'un jeu. D'accord pour qu'elles ne migrent jamais ?
6. **Tables de résultats** : garder les trois tables derrière un adaptateur (recommandation : aucune migration, aucun coût Turso) ; pour un 4ᵉ jeu, une table commune `resultats_jeu` à clés normalisées en croissant, ou une table `<id>_results` par jeu comme Tower ?
7. **Budgets** : la projection de fiche peut faire monter ou descendre le portail (1 558 o de marge) ; Track (42 o) et l'accueil de Tower (21 o) n'ont pas de place pour une brique plus générale. Relever un plafond si K1 ou K3 le justifie par la mesure ? (Le `CLAUDE.md` racine dit encore 710 o pour Track.)
8. **Où mettre les briques client** : un paquet `@cdj/kit` (recommandation : chargé à la demande, comme `@cdj/musique/branche`) ou dans `@cdj/ui` et `@cdj/profile` ?
9. **Registre des versions de Tower** : laissé ouvert par le lot TP (un jour protégé sans fichier survit-il à un changement de générateur ?). Dans K1 (champ `jours.mode`) ou à part ?

## 8. Ce qui n'est pas vérifié
Chiffres : dépôt au 2 novembre 2026 (`1c2ec57`), aucune CI lancée (aucun code changé). Les tailles de lots sont des ordres de grandeur ; le poids de `@cdj/kit` face aux budgets se mesure au lot K3, ligne par ligne, avant toute migration de Track.


## État du plan (mis à jour au lot K4f)
- **K4f fait** (4 novembre 2026) : `brancherJeu` (`@cdj/kit/jeu`) et « Cibles », le premier jeu assemblé par le kit (`apps/cibles`, `packages/cibles-sim`, `apps/api/src/cibles.ts`, `docs/cibles/`), **écrit seulement dans ses zones** (plus sa fiche) ; les trois fichiers qui restaient nommés dans les scripts (`smoke`, `recette:seed`, `routesChaudes`, le contrôle des jours figés de `api-image`) bouclent maintenant sur les fiches. Rapport : `docs/plateforme/lots/lot-K4f-cibles-assemblage-cote-jeu.md`.
- **K4g fait** (le dernier lot du kit) : voir « Le kit est terminé » ci-dessous.

## Le kit est terminé (lot K4g, 4 novembre 2026)
Rapport : `docs/plateforme/lots/lot-K4g-generateur-et-bout-en-bout.md`. **`npm run nouveau-jeu -- --id <id> [--nom "<Nom>"] --classement score|temps` crée un jeu neuf à partir de « Cibles » qui compile, passe ses tests et tourne en local sans retouche à la main** ; le job « Kit de bout en bout » le prouve à chaque changement du kit, du module serveur, de `core`, des fiches, de « Cibles » ou du générateur, et chaque nuit. La marche à suivre est dans le `CLAUDE.md` racine (« Créer un jeu », 5 étapes) et `docs/orchestration.md` (§ 12 bis).

**Ce qu'un jeu neuf obtient sans rien écrire**
- *Côté plateforme* : sa place au portail (cartouche, étiquette générique, accroche, thèmes), au registre du serveur, à la journée (série, journée parfaite, « Jeu suivant du jour »), au classement du jour, à l'interrupteur (`off` → `preview` → `on`), à la remise à zéro du lancement, à l'effacement d'un joueur, aux amis et à « Mon groupe », au message en direct, à la musique, aux zones et aux specs de la CI, aux budgets, au `Dockerfile`, au `smoke`, à `recette:seed` et aux routes chaudes, à « Mettre en production » (jours figés par sa fiche) — tout cela par sa seule fiche.
- *Côté jeu (`brancherJeu`)* : tous les écrans (accueil avec record, série, classement du jour, décompte et message en direct ; partie avec HUD, pause, fantôme Aucun → Ma meilleure → Diamant ; arrivée avec médailles, envoi, file hors ligne, partage ; classement Tous / Amis / Mon groupe et feuille d'un joueur ; Réglages, commandes réglables, manette, « Un bug ? », version périmée), le français et l'anglais, les briques du kit à la demande.
- *Côté serveur* : les routes, l'ordre de validation, le classement par les colonnes de la fiche, les copies, l'aperçu, l'effacement, la table commune `resultats_jeu`, la forme des réponses.

**Ce qu'un jeu écrit** (mesure de « Cibles », lots K4f et K4g) : sa simulation (≈ 270 lignes), son rendu et ses entrées (≈ 150), sa glue `definition.ts` (≈ 45), ses catalogues, son contrat serveur (≈ 90) et son module d'essais (≈ 20) ; **aucun écran**. Le générateur lui donne un squelette complet de tout cela (un jeu de départ jouable, classé au score ou au temps) et un seed vide, des consignes et une passation ; **le vrai jeu remplace le squelette lot après lot**.

**Les limites connues**
- **Track, Jump et Tower ne sont pas sur `brancherJeu`** : ils gardent leurs écrans et leurs briques propres (le kit leur donne ses briques isolées : stockage, interrupteur, message en direct, cadre des écrans, fantôme, lecture du jour). Ils n'en ont pas besoin ; migrer l'un d'eux est un lot qui n'est pas prévu.
- **Le serveur de Track reste hors du module des jeux** (`cdj.ts`, K2c n'a pas été fait : routes historiques, Salon, Garage, validation dans un ordre propre). Jump et Tower y sont.
- **Ce qui reste nommé hors des fiches** (lot K4f, inchangé) : l'écriture des parties du `smoke` et de `recette:seed` (le module d'essais du jeu les porte, sans nom de jeu dans les scripts), `routesChaudes` et `baseDeReference` (des données de référence), l'assemblage côté jeu (`brancherJeu`), le générateur lui-même. Les exceptions restantes de « aucun jeu en dur » sont nommées, avec leur raison, dans `apps/portail/test/jeuxFiches.test.ts`.
- **Le générateur ne sait pas** : écrire un identifiant avec un tiret (l'`id` sert de nom dans le code ; la plateforme, elle, accepte les tirets), choisir la teinte de l'étiquette (il prend la première qu'aucun jeu n'utilise : Nathan choisit), fixer le plafond de budget (celui de « Cibles », à fixer avec la mesure du jeu), décrire le jeu dans les deux pages de mentions légales (avant `on`, un lot de la plateforme le fait : règle de fidélité du lot R5), ni écrire le seed.
- **Un jeu au temps** : l'arrivée écrit les seuils des médailles en ticks tels quels (une brique du kit à polir) ; le temps rejoué, lui, est affiché en secondes (`variante.ts`).
- **`jeu-fictif` reste** à côté du job de bout en bout : il lance TOUTE la suite unitaire (trois parts) sur une fiche minimale, pour prouver que la plateforme ne nomme aucun jeu ; le bout en bout prouve qu'un jeu complet, généré, tient debout (typage, construction, budgets, e2e, zones) mais ne relance pas toute la suite.


## Écrans et peau d'un jeu (lot « écrans du kit », novembre 2026)
*Pour l'auteur d'un jeu branché par `brancherJeu`. La règle entière est dans `packages/kit/CLAUDE.md`, « Écrans et peau du jeu ».*

**Ce que le kit fait pour vous.** Tous les écrans (accueil, « Comment jouer », Réglages, pause, fin, classement) sont écrits par le kit **sur le modèle de ceux de Tower**, déjà validés : une coque de la couleur de coque de la fiche, des stries, un panneau de la teinte de l'étiquette, un titre dans la police du jeu, des tuiles papier, un bouton principal en plaque d'encre, le tout sur le décor du thème du jour et sous le voile à rayures du socle. Sur PC l'accueil est la carte de Tower (900 px) : titre, réplique, record et série à gauche, classement du jour à droite, JOUER et les boutons sur toute la largeur ; sur téléphone une seule colonne. Au grand écran (2 560 × 1 440) les écrans sont agrandis d'un quart pour garder la même proportion de l'écran. **Un jeu qui ne fournit rien a déjà des écrans soignés.**

**Ce qui vient de la fiche** (`config/jeux/<id>.json`, `etiquette`) : `fond` (la teinte du panneau, du décor et du texte des boutons), `coque` (la coque, l'épaisseur du bouton, la bande de sol du décor), `police` (titres, valeurs, boutons). Choisir ces trois valeurs, c'est choisir la peau du jeu ; `npm run fiches` les écrit (`--jeu-fond`, `--jeu-coque`, `--jeu-police`).

**Ce que la définition peut fournir en plus** (`DefinitionJeu.peau`, tout facultatif, couleurs en `#RRGGBB` seulement) :
- `dessin(): SVGElement` — l'illustration du jeu, à droite du titre de l'accueil (Tower y met sa petite tour) ; un dessin décoratif aux traits de la charte, de l'ordre de 90 × 70 px, jamais une image externe ;
- `fond(theme): { ciel, sol }` — le décor du thème du jour derrière les écrans de l'accueil (deux aplats, comme le fait Tower) ; sans lui, la teinte et la coque de la fiche ;
- `accent` — la couleur du texte des boutons principaux, des pastilles actives et de la tuile inversée ; sans lui, la teinte de la fiche.

**Ce qu'un jeu ne fait pas.** Il n'écrit aucune règle d'écran dans ses feuilles (ni largeur, ni zoom, ni couleur de bouton) et ne cache aucun élément du kit par CSS : un manque se corrige dans le kit (`packages/kit`), pour tous les jeux. Pour ne pas montrer un élément, une option de la définition existe (`sansFantome`, `sansMedaille`…).

**L'échelle d'espacement** (jetons `--dj-espace-*` de `@cdj/ui`, variables `--jeu-esp-*` de la feuille du kit) : 12 px entre deux blocs, **8 px entre deux boutons (jamais collés)**, 6 px entre une légende et sa liste, 16 px le retrait d'une carte, 24 px entre deux colonnes ; des cibles de 44 px au moins ; des marges de sécurité sur tout ce qui touche un bord. Ces règles sont gardées par `apps/cibles/e2e/ecrans-kit.spec.ts` (six tailles, du 2 560 × 1 440 au 360 × 640).
