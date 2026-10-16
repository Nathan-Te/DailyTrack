# Lot 13 — La forêt : les courants d'air (DailyJump)

## À tester
Aperçu de la branche (toutes les dates y sont ouvertes), **avec le son** (un premier geste le déverrouille) : `https://nathan-te.github.io/DailyTrack/b/claude-foret-courants-air-g0ojsc/jump/` (adresse à confirmer après la première construction de la PR).
- **Un niveau forêt avec `&solution`** (rediffusion de l'auteur) : `?seed=2026-10-20&accueil=0&solution` (aussi le 24/10 ou le 27/10). Le 16 et le 17 octobre sont figés (g4, sans vent).
- **Trois morceaux de vent dans la galerie** `?modules` (filtre « Thème » : forêt (courants d'air) ; chaque morceau s'ouvre dans son thème) : `vent-colonne` (planer sur une colonne montante au-dessus d'un gouffre), `vent-rafale` (attendre la rafale au bord, puis s'y lancer entre deux scies), `vent-piliers` (piliers d'une tuile contre le vent). Aussi `vent-relais` (l'enchaînement long), `vent-planeur` (une respiration) et les variantes mutées `cheminee` v3 (+vent:haut), `lucarne` v3 (+vent:gauche).
- **Le panneau `?debug&tune`** → section « Courants d'air » : `windAccel` (poussée), `windRise` (montée maximale), `windDrift` (dérive) ; la partie devient « réglages modifiés », rien n'est enregistré. La galerie du vent : `?scenario=vent&debug&tune`.
- **Lisibilité** : `?debug&hitbox` (rectangle de chaque zone, clair quand elle souffle, et son sens) ; **mouvement réduit** (menu ⏸ ou système) ou « effets : aucun » : des flèches fixes remplacent les feuilles et le pollen.

## La syntaxe et la physique du vent
`vent <col0>-<col1> <rang0>-<rang1> <haut|gauche|droite> <force> [rafale <cycle> <actif> <décalage>]` dans le bloc annexe (`level.ts`) : un rectangle de tuiles **traversable**, `force` en % des réglages (25 à 200), deux zones ne se chevauchent pas, une zone en rafale est dans une section. Dans un morceau, la même ligne en coordonnées du gabarit (de la première copie de `c0`/`r0` à la dernière de `c1`/`r1`), section implicite, `{param}` permis.

| | réglage (absent des défauts) | défaut | effet mesuré |
|---|---|---|---|
| vers le haut | `windRise`, `windAccel` | 205 u/pas (6 tuiles/s), 20 u/pas² | **remplace la gravité** : montée plafonnée à 6 tuiles/s ; une chute à 12 tuiles/s est retournée en < 0,33 s ; un saut dans la zone est freiné par la gravité jusqu'à la montée, puis on plane |
| sur le côté | `windDrift`, `windAccel` | 171 u/pas (5 tuiles/s) | vitesse visée = commande + dérive : **16 tuiles/s avec le vent, 6 contre**, emporté à 5 tuiles/s sans commande ; saut complet : 11,5 tuiles avec, **4,3 contre** (7,9 sans vent) |
| rafale | — | — | souffle `actif` pas sur `cycle` : `q = (phase + décalage) mod cycle < actif` ; phase = pas depuis l'entrée dans la section (comme les scies), remise à zéro par la mort et la reprise |

- Le vent agit tant que **le centre** du personnage est dans la zone au début du pas (`windPush`, `attempt.ts`), au sol comme en l'air ; **rien n'est ajouté à l'état** (la phase se lit dans `sections`, la vitesse dans `player`) : en sortant, la vitesse acquise reste et la physique ordinaire reprend (testé : gravité dès le pas suivant en haut, freinage ordinaire sur le côté).
- **Ajout pur** : `stepPlayer` passe `null` (aucun vent) et fait exactement les calculs d'avant ; `JUMP_SIM_VERSION` **3** ; golden du personnage, de l'essai, des rediffusions inchangés ; les deux jours figés se rejouent. Tests : `packages/jump-sim/test/vent.test.ts` (lecture, montée plafonnée, dérive avec et contre la commande, vitesse gardée à la sortie, rafale au pas près depuis l'entrée de la section, remise à zéro à la mort et à la reprise, zone traversable, fuzz d'intégrité de 75 000 pas + réglages au hasard : entiers, sans −0, ≤ `MAX_SPEED`, jamais dans un bloc), et la galerie du vent jouée au hasard dans « rejeu = ce qui a été vécu » (`replay.test.ts`).

## Lisible avant tout, ressenti
- **Feuilles et pollen** (un seul `Points`, au plus 160, tampons préalloués, position fonction pure du temps), **contour très discret**, **annonce d'une rafale 0,25 s avant** (les particules s'agitent et brillent). **Sans particules** (mouvement réduit, effets « aucun », `?fx=off`) : **flèches fixes** dans le sens du vent, allumées quand la zone souffle, plus claires pendant l'annonce, jamais clignotantes. Couleurs `WIND_STYLE` (verts, menthe, pollen presque blanc) : teinte à ≥ 30° du rouge des dangers et du jaune du personnage, ≥ 3:1 avec le ciel et chaque plan des cinq thèmes.
- **Jamais poussé vers un danger invisible** (`windSafety.ts`) : à l'entrée dans une zone, tout pic ou scie dans le sens du vent (la zone et 3 tuiles au-delà, sur sa bande élargie d'une tuile) est à l'écran — vraie caméra du jeu suivie pas à pas, téléphone en paysage (13 tuiles de haut, 16:9). **Vérifié sur les deux solutions de chaque variante à vent du catalogue** (aucun danger caché) ; le test voit bien un danger caché quand on en fabrique un.
- Événements `ventDebut` / `ventFin` / `rafale` (jamais gardés pour les autres vies du carnage) ; **souffle spatialisé, 3 voix**, plus fort au centre d'une zone, un murmure quand une rafale ne souffle pas, le filtre s'ouvre avec la force, sur le bus des effets ; sons de `ventDebut` et `rafale` sous le saut ; quelques feuilles à l'entrée et au départ d'une rafale (pool plafonné, coupées par `?fx=off` et le mouvement réduit). `__jump.wind` avec `?debug`.

## Les nouveaux morceaux (9) et les variantes mutées (8 morceaux, 1 variante chacun)
| morceau | étiquettes (+ vent) | variantes | exigence | solution | intention |
|---|---|---|---|---|---|
| `vent-brise` | respiration | 3 | 1–1 | 1.4–2.0 s | Se laisser porter par une brise douce le long d'un escalier de grandes marches : il suffit de sauter à temps. |
| `vent-colonne` | precision | 5 | 1–2 | 2.1–2.5 s | Planer au-dessus d'un gouffre porté par une colonne d'air montante : s'y laisser monter, puis filer jusqu'à l'autre bord. |
| `vent-derive` | mural vertical | 4 | 1–1 | 1.8–2.7 s | Se laisser emporter par la dérive au-dessus des pics jusqu'au pied d'un grand mur, puis le remonter : le vent y ramène après chaque saut mural. |
| `vent-piliers` | precision | 4 | 1–5 | 1.8–2.4 s | Sauter de pilier en pilier, chacun large d'une tuile, contre un vent qui repousse vers les pics. |
| `vent-planeur` | respiration | 3 | 1–1 | 2.1–2.3 s | Franchir trois bosses en se laissant porter par de petits courants d'air montants. |
| `vent-pont` | precision | 6 | 1–2 | 2.4–3.2 s | Traverser un pont d'îlots contre un vent latéral qui repousse vers les pics. |
| `vent-puits` | vertical | 3 | 1–1 | 2.0–2.6 s | Remonter un puits sans prise grâce au courant d'air qui monte, puis se poser sur la corniche du haut. |
| `vent-rafale` | scie precision | 6 | 1–4 | 2.3–4.6 s | Attendre la rafale au bord du gouffre, puis s'y lancer entre les deux scies. |
| `vent-relais` | precision scie · **long** | 2 | 2–5 | 6.4–6.7 s | Planer sur la colonne, traverser le pont contre le vent, puis attendre la rafale. |

Mutateur `+vent:<sens>[:rafale]` (`zone vent <colonnes> <rangées>`, force 100, jamais hors de la forêt) : `cheminee` v3 (+vent:haut, exigence 3), `lucarne` v3 (+vent:gauche), `tremplin` v3 (+vent:haut), `ressorts-trous` v4 (+vent:haut), et quatre **respirations** (exigence 1 : ≤ 2) : `corniches` v4 (+vent:gauche), `descente` v4, `rebonds-doux` v4, `tunnel` v4 (+vent:droite). Règles inchangées : appui humain, ±3 pas ≥ 50 %, raccord ≥ 90 %, plats, familles, 6 variantes au plus. Variantes écartées ou adoucies en route : `vent-pont` (vent contraire à 100 et îlots de 2 : gigue 0 % → force 40–70, îlots de 3), `vent-rafale` (fenêtres de 90–110 pas : au pas près → 115–170), `vent-relais` (pont + rafale au mauvais moment : au pas près ou 8,5–9,8 s → deux variantes), `vent-derive` +garde (aucune solution), `ressorts-trous` +vent:gauche:rafale puis +vent:droite (au pas près → +vent:haut), `lucarne` +vent:droite (47,5 % à ±3 → +vent:gauche).

**Le solveur attend les rafales** : la seconde passe du lot 12 (moitié du faisceau réservée aux branches au sol) couvre les rafales (`isDynamicLevel`), et la clé de déduplication connaît les horloges des sections (`sectionClocks`) ; `vent-rafale` v0 : 4,1 s à l'arrêt (le solveur attend la rafale au bord) contre 2,4 s en élan (on arrive pendant qu'elle souffle). Les morceaux sans horloge gardent leurs solutions bit pour bit (aucune autre solution n'a changé dans `solutions.json`). **Temps du solveur complet** (`--force --dry`, 4 fils, 84 morceaux, 374 variantes, 748 solutions) : **1 492 s = 24,9 min** (5 965 s de calcul), sous le plafond de 30 min ; il retrouve exactement les 748 durées stockées (déterministe). Les nouveautés seules, en incrémental : quelques minutes par passe.

## `measure:jump` (120 dates)
Forêt **49,5 %** de tirages validés (65,1 % au lot 12 sans mécanique ; 32,3 % au premier essai, voir plus bas), **secours 0**. Usine, glace, nuit et néon redonnent **exactement** les lignes du lot 12, et `foret.test.ts` vérifie **date par date sur 120 dates** (89 hors forêt) : mêmes morceaux, même empreinte de niveau, même temps de l'auteur qu'avec le code d'avant.

| thème (mécanique) | jours | tirages validés | secours | temps de l'auteur (min · moy · max) | exigence/min | part de la mécanique | en commun avec la veille |
|---|---|---|---|---|---|---|---|
| **foret (vent)** | 31 | **49,5 %** | 0 | 28,26 · 29,51 · 30,53 s | 437 · 503 · 538 | 20 · 29 · 40 % | 0,60 (max 2) |
| usine (tapis) | 16 | 35,5 % | 0 | 28,32 · 29,52 · 31,70 s | 450 · 502 · 542 | 21 · 30 · 36 % | 0,81 (max 3) |
| glace (glace) | 23 | 58,0 % | 0 | 28,48 · 29,61 · 31,56 s | 449 · 503 · 543 | 20 · 29 · 40 % | 0,52 (max 2) |
| nuit (clignotant) | 27 | 48,2 % | 0 | 27,99 · 29,52 · 31,80 s | 464 · 510 · 548 | 21 · 31 · 39 % | 0,59 (max 3) |
| neon (alterne) | 23 | 57,2 % | 0 | 28,09 · 29,42 · 30,93 s | 474 · 515 · 549 | 22 · 28 · 38 % | 0,52 (max 2) |

**Thème forcé** (12 dates × 5 thèmes, du 2027-08-12 au 2027-08-23) :

| thème forcé | niveaux | tirages validés | des composés | secours | temps de l'auteur (min · moy · max) | exigence/min | part de la mécanique | génération (moy · max) |
|---|---|---|---|---|---|---|---|---|
| **foret** | 12 | **50,0 %** | 60,0 % | 0 | 28,13 · 29,73 · 31,94 s | 507 | 27 % | 108 · 139 ms |
| usine | 12 | 44,2 % | 79,1 % | 0 | 28,08 · 29,40 · 30,66 s | 510 | 27 % | 90 · 150 ms |
| glace | 12 | 54,2 % | 72,2 % | 0 | 28,46 · 29,60 · 30,41 s | 500 | 29 % | 91 · 139 ms |
| nuit | 12 | 47,2 % | 61,8 % | 0 | 28,01 · 29,04 · 30,16 s | 501 | 28 % | 194 · 276 ms |
| neon | 12 | 54,8 % | 72,7 % | 0 | 28,43 · 29,57 · 30,38 s | 515 | 26 % | 169 · 233 ms |

**Composition ajustée** (la forêt était à 32,3 % avec les sept premiers morceaux) : deux causes, mesurées sur les refus des 60 jours de forêt de 240 dates. (1) **135 impasses « respiration imposée »** : le quota de vent et la respiration étaient imposés ensemble et `vent-brise` était souvent au repos → une deuxième respiration de vent (`vent-planeur`, autre groupe) et quatre respirations ordinaires mutées `+vent` : 19 impasses. (2) **Exigence sous 445** : les morceaux de vent sont presque tous notés 1 (le vent pardonne) → `vent-piliers` (2 à 5) et deux rafales plus serrées (3 et 4). Résultat : 50,7 % sur ces 60 jours, 49,5 % sur les 31 des 120 dates. Rien n'a été changé aux seuils ni aux autres thèmes. Rejeu de la preuve 6,7 ms en moyenne.

## Versions, golden, jours figés
- `JUMP_GENERATOR_VERSION` **9** (le niveau des dates en forêt change) ; `JUMP_SIM_VERSION` **3**. Golden du niveau du jour régénérés : **deux des six dates changent** (16/10 et 03/11, en forêt) ; les quatre autres (nuit, néon, usine ×2) ne changent que d'identifiant et de preuve. Golden de DailyTrack : aucun fichier touché.
- **Jours figés** : `main` n'a pas bougé depuis le début du lot ; `npm run freeze:days -- demain` lancé **dans un worktree sur `main`** (6ea5246) : **0 fichier écrit**, le 16 et le 17 octobre sont déjà figés (g4) et se relisent ; `apps/jump/test/figes.test.ts` les rejoue avec le nouveau code.

## Vérifié / non vérifié / décisions pour Nathan
**Vérifié** : `tsc -b` propre ; Vitest `core`, `jump-sim`, `apps/jump` (44 fichiers, 785 tests, dont `vent.test.ts` et `foret.test.ts` côté simulation, `vent.test.ts` côté jeu) ; e2e Chromium de `apps/jump` : **112 verts, 4 outils sautés**, dont `foret.spec.ts` (5 tests : niveau forêt en `&solution` au temps de l'auteur, `vent-pont` au doigt en paysage, mouvement réduit : flèches fixes sans clignoter / effets : particules, hitbox et `?scenario=vent` sans erreur de shader, section « Courants d'air » de `?debug&tune`) ; `smoke.spec.ts` compte 29 curseurs au lieu de 26 (les trois du vent) ; captures du jeu relues (feuilles et pollen, flèches, hitbox) ; la règle « danger visible » sur tout le catalogue.
**Non vérifié** : Firefox et WebKit en local (la CI tranche) ; l'écoute réelle du souffle (logique et niveaux testés, pas l'oreille) ; un vrai téléphone ; la perf sur vrai GPU (un `Points` de 160 au plus, un maillage de flèches par zone) ; la CI après rebase (à confirmer sur la PR).

**Décisions pour Nathan**
1. **Vent vers le haut = la gravité remplacée** (pas ajoutée à une poussée) : sous la zone, on monte toujours vers 6 tuiles/s, même posé au sol (on se fait soulever). Un vent vers le bas n'existe pas (le prompt ne le demandait pas).
2. **`force` en pourcentage** des trois réglages à la fois (montée, dérive, poussée) : un morceau règle sa zone sans toucher aux défauts.
3. **Le vent pardonne** : la plupart des morceaux de vent sont notés 1 (la gigue ne les dérange pas) ; la difficulté est dans l'attente d'une rafale et le contrôle contre le vent, que l'exigence mesure mal (comme la nuit au lot 12).
4. **La règle « danger visible »** est mesurée sur le téléphone en paysage 16:9 (le plus étroit des cadrages de jeu) ; en portrait (10 tuiles de large) elle ne tiendrait pas toujours.
5. **`?scenario=vent`** : une galerie neuve (colonne, dérive, vent contraire, rafale, trois points de passage), ouverte en forêt ; les niveaux d'essai et des dangers n'ont pas bougé.
