# Lot T0 — Essai technique de la physique

Branche `claude/sweet-lovelace-jbsht5`, PR brouillon. Consignes : `docs/tower/consignes.md` (créé par ce lot). **Pas de jeu** : deux moteurs derrière une même interface, un banc d'essai, des mesures, une page de démonstration. Tower reste `off` (absent de la table `jeux`) ; aucune version, aucun golden de Track ou de Jump touché.

## Les deux moteurs
- **A — maison**, `packages/tower-sim/lab/a/` : **virgule fixe Q16 sur entiers** (comme `jump-sim`), angles en brads (2^20 par tour), sinus **par table** (générée une fois), tétrominos en **boîtes orientées soudées** (pas de polygones convexes quelconques : inutile pour les sept pièces), collisions par axes séparateurs + découpe de l'arête (variante de Box2D-lite), contacts avec frottement de Coulomb, **impulsions séquentielles à 30 itérations fixes** (balayage bas→haut puis haut→bas), démarrage à chaud, mise en sommeil **par îlots**. ≈ 650 lignes. Aucun produit ne dépasse 2^53 (testé : le plus grand reste sous 2^51).
- **B — Rapier 2D**, `@dimforge/rapier2d-deterministic-compat` **0.21.0** (version exacte). Promesse (README npm et rapier.rs, « JavaScript 0.21 ») : *« fully cross-platform deterministic »* **à version, paramètres, ordre d'ajout et de retrait identiques**, et à entrées elles-mêmes déterministes (jamais de `Math.sin`). Nous n'envoyons que des entiers ÷ 8. `-compat` : WebAssembly en base64 dans le JavaScript (même code sur Node et navigateurs).
- Interface : `createWorld · addPiece · step · snapshot` (+ `clone`, `awake`, `dispose`). Unités : mètre, entrées en huitièmes. Même banc, même réglage (60 Hz, g = 9,81, frottement 0,6, rebond 0, 30 itérations).

## Mesures (machine : Xeon 2,1 GHz, 4 cœurs, Node 22 ; deux passages, la variation est de ±15 %)
| | A (entiers) | B (Rapier déterministe) |
|---|---|---|
| **Déterminisme** Node ↔ Chromium ↔ Firefox ↔ WebKit (Linux x64) : banc de 40 pièces + effondrement + tour propre 30 s, empreinte toutes les 5 s | **identique, 4/4** | **identique, 4/4** |
| Empreinte finale du banc / de la tour (Node) | `cdc7da5a6b363f5d` / `d82262defc81f6b9` | `cd5c8fa8c2168963` / `075fc4523976a401` |
| **Rejeu complet** (7 200 pas = 120 s de jeu), médiane de 20 | **2,3 à 2,6 s** (360 µs/pas) | **0,58 à 0,73 s** (100 µs/pas) |
| Cloud Run 1 vCPU (estimé : ×1 à ×1,5 de cette machine) | 2,3 à 3,9 s → **15 à 26 rejeux/min** | 0,6 à 1,1 s → **55 à 100 rejeux/min** |
| **Poids ajouté** (chargé à la demande) | **7,2 Ko gzip / 5,2 Ko brotli** | **1 264 Ko gzip / 933 Ko brotli** (le `.wasm` seul : 902 / 666 Ko) |
| **Stabilité** tour de 40 pièces, 34 m, 30 s | s'effondre à 8–12 itérations ; **30 : dérive 25 cm, tremblement 2,5 mm/pas, endormie à 4,8 s** ; 60 : 10 cm, 3,3 s ; *sans sommeil, ne s'endort jamais* | **dérive 17 cm (tassement), tremblement 0, endormie à 1 s**, quel que soit le nombre d'itérations (8 à 60) ; sans sommeil 0,2 mm/pas |
| **Tour de bot** (160 essais, tour de 10 / 20 / 39 pièces) | 4,4 / 6,7 / **32 s** | 4,6 / 5,5 / **21 s** |
| Extrapolé : une journée (40 pièces) / 8 jours d'un coup, un cœur | ≈ 8 min / **≈ 63 min** | ≈ 6 min / **≈ 48 min** |

*Méthode.* Rejeu : `rejouerBanc` (suite figée dans `lab/bancTable.ts`, calibrée une fois sur A par un bot glouton ; la pièce naît 1,5 m au-dessus du sommet de la tour, 3 m/s ; le coup est un bâton jeté de côté à la pièce 34), 2 passes d'échauffement puis 20 mesurées. Poids : `vite build` de `apps/tower`, gzip -9 et brotli -11 du morceau de chaque moteur. Stabilité : `tourPropre()` (40 pièces posées sans jeu, sans vitesse), plus grand déplacement, plus grand déplacement entre deux pas après 2 s, premier pas où tout dort. Bot : chaque essai sur une **copie** du monde (`clone`), jusqu'à ce que rien ne bouge de plus de 4 mm en 10 pas (≤ 5 s). Tout se relance : `npm run mesures:tower -w @cdj/tower-sim`, `npm run poids:tower -w @cdj/tower-sim`.
*Lire avec prudence.* Le banc a été calibré sur A (B y perd 32 pièces sur 40, A 21 : la table est faite pour A) : **le nombre de pièces perdues ne compare pas les moteurs**, la tour propre, si. À 120 Hz B coûte 1,0 s (×1,6) ; A, réglé pour 60 Hz, s'effondre dès le début : non comparable (voir questions).

## Ce que disent les mesures
- **Déterminisme : aucun écart nulle part, pour les deux.** A l'est par construction (entiers) ; B l'est dans les quatre environnements testés. Le test tourne aussi à chaque `npm test` (Node de la CI = autre machine que celle de ce lot).
- **A a besoin de 30 itérations** (60 pour être serein) pour tenir 34 m et ne cesse de frémir (≈ 0,15 m/s) sans la mise en sommeil : c'est elle qui cache le tremblement. B est calme sans réglage. Le profil de A : 82 % dans le solveur ; `Math.trunc` a déjà donné −20 %, il reste ≈ 1,5× d'optimisation, pas 4×.
- **Coût serveur** : un rejeu bloque la boucle d'événements 0,6–1,1 s (B) ou 2,3–3,9 s (A). Le plafond actuel (600 rejeux/min et par instance, 1 unité = 5 000 pas) suppose ≈ 300 ms par rejeu : celui de Tower exige **un fil de calcul (`worker_threads`)** et une unité à recalibrer (B ≈ 2 unités, A ≈ 8).
- **Le bot de l'auteur n'est pas faisable tel quel** : 8 jours d'un coup = 48 min (B) à 63 min (A) sur un cœur. Pistes à mesurer en T3 : 12 positions au lieu de 40 (÷ 3), arrêt anticipé des mauvais essais, deux fils sur le runner, ou l'estimation géométrique du seed. Le coût est dominé par les **tours hautes** : chaque essai réveille toute la tour.

## Vérifié / non vérifié
- **Vérifié** : `npm run typecheck`, `npx vitest run` sur `packages/tower-sim` (50 tests : pureté, table de sinus, virgule fixe, pièces, banc et empreintes de Node pour A et B, copie du monde, physique élémentaire des deux moteurs) et sur les gardes que le lot touche (workflows, zones, portail, `packages/ui`, `core`) ; `npm run build` ; `npm run e2e -w @cdj/tower` dans **Chromium, Firefox et WebKit** (empreintes de Node retrouvées au bit près, A et B, deux pages) ; l'assemblage du site (`/tower/` hors production seulement) ; `npm audit --omit=dev` : 0.
- **Non vérifié** : **Safari sur Apple silicon / iPhone (ARM)** — WebKit n'a tourné ici que sous Linux x64 ; le déterminisme de B y repose sur la promesse de Rapier. Test pour Nathan : l'empreinte finale affichée par la page sur l'iPhone doit être celle du tableau. Le coût réel sur Cloud Run (estimé). Le **ressenti** : à juger sur la page.
- **Écarts aux zones partagées** (demandés par les livrables, tous additifs — à relire) : `package.json` racine (`build` construit aussi Tower), `tsconfig.json` (deux références), `package-lock.json` (Rapier 0.21.0, exacte, `lab/` seulement), `scripts/site.mjs` (copie `/tower/` hors production et le vérifie), `CLAUDE.md` (la ligne d'import), et **un nouveau workflow `tower-essai.yml`** (Chromium, Firefox, WebKit sur toute PR qui touche l'essai : ni la CI de PR courte ni la matrice « petit ensemble » ne connaissent un troisième jeu). Rien d'autre : `e2e/zones.json`, `ci-zones`, `zones-jeu`, registre des jeux, budgets, catalogues non touchés.

## Recommandation : **B (Rapier déterministe)**, A gardé comme repli
- Il tient la tour sans réglage (A : 30 itérations et le sommeil pour cacher un frémissement), se rejoue 3 à 4 fois plus vite, et fournit gratuitement ce que le seed demande ensuite : joints (*lierre*), corps fixes (*pièce figée*), forces (*vent*), formes quelconques. A devrait les écrire et les maintenir.
- Le déterminisme n'est pas un argument contre B : aucun écart en 4 environnements, version figée, test dans `npm test` et en navigateurs.
- **Le prix : le poids** (≈ 1 Mo compressé, 0,67 Mo avec le `.wasm` servi tel quel — à tenter en T1 avec `rapier2d-deterministic` sans `-compat`) et un rejeu serveur de ≈ 0,7 s. **Si Nathan juge ce poids trop lourd pour le premier lancement sur mobile, ou si Safari ARM s'écarte, A est la voie** : 7 Ko, entiers, mais à fiabiliser (itérations, sommeil, découpe en fils) et à étendre.

## Questions pour Nathan
1. **Moteur** : B, A, ou autre chose après avoir essayé la sensation ? 
2. **Poids** : +1 Mo compressé chargé à la demande au premier départ — acceptable ? (ligne à créer dans `budgets.md` en T1.)
3. **Pas de simulation** : 60 Hz (mesuré) ou 120 Hz comme Track et Jump (B ×1,6, A à refaire) ?
4. **Safari ARM** : peux-tu comparer l'empreinte sur ton iPhone ?
5. **Serveur** : accord pour un fil de calcul (`worker_threads`) et une unité de rejeu propre à Tower (lots T2/T4) ?
6. **Bot** : on vise un bot réduit (48 essais) calculé au gel des jours, ou l'estimation géométrique ?
7. **CI** : garder `tower-essai.yml` jusqu'au T1, ou le fondre dans `ci.yml` et `e2e/zones.json` par un lot de la plateforme ?

## Liens de test (aperçu de la PR : `/tower/…` ; en local `npm run dev -w @cdj/tower`)
- `/tower/?scenario=banc&engine=a` — puis `…&engine=b` : les 40 pièces, l'effondrement, l'empreinte finale (touches + et − : vitesse ×16 ≈ 8 s)
- `/tower/?scenario=banc&engine=a&libre&debug&tune` — puis `b` : ← → déplacer, ↑ ou R tourner, ↓ ou espace lâcher ; panneau : gravité, frottement, rebond, itérations, sommeil.
