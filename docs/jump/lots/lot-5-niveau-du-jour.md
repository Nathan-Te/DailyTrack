# Lot 5 — Le niveau du jour (DailyJump)

## À tester
Aperçu de la branche `claude/dailyjump-lot-5-niveau-du-jour` (toutes les dates y sont ouvertes : c'est un aperçu, la ligne du HUD le dit) :
- **Le niveau du jour : [`https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-5-niveau-du-jour/jump/`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-5-niveau-du-jour/jump/)** — « DailyJump #N » en haut, la médaille visée (🥉 tant qu'on n'a pas de temps), la médaille obtenue et le temps de l'auteur à l'arrivée. Au téléphone aussi (paysage conseillé).
- **Trois dates conseillées** (chacune aussi avec `&solution` : la rediffusion de l'auteur, qui finit au temps de l'auteur, médaille 🏆) :
  - courte (28,26 s) : [`?seed=2026-10-30`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-5-niveau-du-jour/jump/?seed=2026-10-30) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-5-niveau-du-jour/jump/?seed=2026-10-30&solution)
  - longue (31,66 s) : [`?seed=2026-11-04`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-5-niveau-du-jour/jump/?seed=2026-11-04) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-5-niveau-du-jour/jump/?seed=2026-11-04&solution)
  - exigeante (45,8 points/min, un morceau à 5/5) : [`?seed=2026-11-12`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-5-niveau-du-jour/jump/?seed=2026-11-12) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-5-niveau-du-jour/jump/?seed=2026-11-12&solution)
- `&debug` en plus : les limites des morceaux (trait jaune, étiquette « id vN · ●●○○○ 2/5 »), le morceau courant dans la surimpression, `__jump.daily`.

## La règle d'assemblage en bref
`dailyLevel(jour)` (`packages/jump-sim/src/daily.ts`, pur, la date en argument) : **colonne de départ `S` · morceau 1 · colonne de raccord · morceau 2 · … · colonne d'arrivée `F`**. Les paliers sont **alignés par leur rangée** (sortie d'un morceau = entrée du suivant) ; la colonne de raccord porte ce sol et le vide de ses deux voisines au-dessus, et le **point de passage** du morceau suivant (y reprendre = le départ « à l'arrêt » du morceau seul). Premier morceau **à l'arrêt**, tous les suivants **en élan**. Hors des morceaux **tout est plein** (une rangée de blocs en haut ; sous un morceau, le vide continue jusqu'en bas là où sa dernière rangée n'est pas un bloc : on y meurt en tombant comme dans le morceau seul). Chaque morceau est **une section** (ses scies démarrent quand on y entre).
**Tirage** (`compose`) : on ajoute des morceaux non reposés jusqu'à ce que l'estimation entre dans la cible ; à chaque place, la variante la plus proche du profil d'exigence visé (1,3 au début → 3,3 à la fin), le morceau tiré au poids (proche du profil, quota manquant) parmi ceux qui tiennent : hauteur ≤ 48, pas trois `precision` d'affilée, le `respiration` seulement au milieu (imposé quand on y arrive), `mural` et `scie` imposés à partir de 55 % s'ils manquent, la pointe d'exigence ≥ 4 au dernier tiers, et le dernier morceau doit fermer tous les quotas.
**Preuve** : les solutions bout à bout, chacune démarrée au pas où le personnage franchit le bord d'entrée de son morceau (le pas le plus proche du départ du morceau seul, à ±187 unités près ; si la solution n'aboutit pas de là, l'autre pas qui l'encadre) ; on court vers la droite entre deux (9 pas). La rediffusion complète est **rejouée par `replayAttempt`** sur le niveau assemblé : arrivée sans mort, puis toutes les règles (`dailyProblems`). 6 tirages par jour, on garde le meilleur valide (score = écart au centre de la durée + écart au centre de l'exigence) ; sans tirage valide, jusqu'à 40, puis le secours.

## Constantes
| constante | valeur | rôle |
|---|---|---|
| `PREMIER_JOUR_JUMP` | 16/10/2026 | niveau n° 1 (`levelNumber`) |
| `AUTHOR_MIN_TICKS` / `AUTHOR_MAX_TICKS` / `AUTHOR_TARGET_TICKS` | 25 s / 40 s / 30 s | temps de l'auteur permis, centre du score |
| `ESTIMATE_MIN_TICKS` / `ESTIMATE_MAX_TICKS` | 28 s / 32 s | on ajoute des morceaux sous 28 s ; le dernier ne passe pas 32 s |
| `JOINT_TICKS` | 9 pas | course d'un raccord (mesuré : écart estimation − auteur de −2 à +37 pas) |
| `MIN_PIECES` / `MAX_PIECES` | 6 / 10 | morceaux par niveau |
| `MAX_DAILY_HEIGHT` | 48 rangées | hauteur totale, rangée du haut comprise |
| `EXIGENCE_RATE_MIN` / `_MAX` / `_CENTER` | 380 / 460 / 420 | exigence en dixièmes de point par minute (Σ exigences × 600 ÷ durée en s) |
| `EXIGENCE_PEAK` | 4 | au moins un morceau d'exigence ≥ 4 |
| `PROFILE_START` / `PROFILE_END` | 1,3 → 3,3 | profil visé pour choisir les variantes ; règle : dernier tiers ≥ premier tiers |
| `MAX_PRECISION_RUN` | 2 | `precision` d'affilée au plus |
| `RESPIRATION_FROM` / `_TO` | 35 % / 65 % | milieu du seul morceau `respiration` |
| `FORCE_QUOTA_AT` / `FORCE_PEAK_AT` | 55 % / 66,7 % | quotas imposés s'ils manquent encore |
| `DAILY_DRAWS` / `DAILY_MAX_ATTEMPTS` | 6 / 40 | tirages par jour / avant le secours |
| `REST_GROUPS` / `REST_SALT` | 3 / `repos4310:` | repos : le groupe `jour mod 3` se repose |
| `MEDAL_PERCENT` | or 110 · argent 130 · bronze 160 | médailles en pas entiers, arrondies au pas supérieur (`idiv`) |
| `JUMP_GENERATOR_VERSION` | 1 | identifiant `jour-AAAA-MM-JJ-g1` |

## Mesures (`npm run measure:jump -w @cdj/jump-sim`, Node 22, 2,8 GHz)
### Niveau du jour — 120 dates (du 2026-10-16 au 2027-02-12)

#### Tirages
| mesure | valeur |
|---|---|
| tirages essayés (6 par jour, jusqu'à 40 sans tirage valide) | 720 |
| composés (sans impasse) | 587 (81,5 %) |
| **validés** (rejeu sans mort, toutes les règles) | **405** (56,3 % des tirages, 69,0 % des composés) |
| tirage retenu (indice) : moyenne · maximum | 2,41 · 5 |
| jours sans tirage valide parmi les 6 premiers | 0 |
| **niveau de secours utilisé** | **0** |

Refus et impasses :

- 149 × exigence n hors de [n, n]
- 118 × impasse (impasse au morceau n)
- 25 × le dernier tiers (n) est moins exigeant que le premier (n)
- 15 × impasse (trop de morceaux)
- 8 × exigence n hors de [n, n] ; le dernier tiers (n) est moins exigeant que le premier (n)

#### Temps de l'auteur
min **28,02 s** · moyenne **29,91 s** · max **31,68 s** (permis : 25,00–40,00 s, centre 30 s)

| tranche | niveaux |
|---|---|
| 26–28 s | 0  |
| 28–30 s | 60 ████████████████████████████████████████████████████████████ |
| 30–32 s | 60 ████████████████████████████████████████████████████████████ |
| 32–34 s | 0  |
| 34–36 s | 0  |
| 36–38 s | 0  |
| 38–40 s | 0  |

Écart temps de l'auteur − estimation (somme des solutions + 9 pas par raccord) : min -2 · moyenne 2,6 · max 37 pas.

#### Forme
| mesure | min | moyenne | max |
|---|---|---|---|
| morceaux par niveau | 9 | 9,9 | 10 |
| hauteur (rangées, ≤ 48) | 32 | 43,3 | 48 |
| largeur (colonnes) | 284 | 309,8 | 333 |

#### Exigence
| mesure | min | moyenne | max |
|---|---|---|---|
| somme des exigences | 18 | 20,8 | 23 |
| par minute (dixièmes de point ; fenêtre 380–460) | 380 | 417,2 | 458 |
| exigence du morceau le plus exigeant | 4 | 4,3 | 5 |
| premier tiers (moyenne pondérée, dixièmes) | 10 | 15,2 | 23 |
| deuxième tiers (moyenne pondérée, dixièmes) | 10 | 19,2 | 29 |
| dernier tiers (moyenne pondérée, dixièmes) | 17 | 28,6 | 41 |

Par jour de la semaine (exigence par minute, moyenne) : lundi 417 · mardi 416 · mercredi 418 · jeudi 419 · vendredi 419 · samedi 416 · dimanche 415.

#### Étiquettes (morceaux par niveau, moyenne ; niveaux qui en ont)
| étiquette | par niveau | niveaux |
|---|---|---|
| mural | 2,67 | 120/120 |
| precision | 4,04 | 120/120 |
| vertical | 2,96 | 120/120 |
| scie | 2,87 | 120/120 |
| friable | 1,54 | 105/120 |
| ressort | 0,88 | 85/120 |
| respiration | 1,00 | 120/120 |

#### Emploi des morceaux (niveaux qui le contiennent ; jours où il est disponible ; variantes)
| morceau | niveaux | disponible | variantes (emplois) |
|---|---|---|---|
| demi-tour | 68 | 80 | 0:43 1:22 2:3 |
| grande-scie | 65 | 80 | 0:32 1:27 2:6 |
| scie-ronde | 64 | 80 | 0:21 1:27 2:16 |
| ascenseur | 63 | 80 | 0:47 1:11 2:5 |
| mur-friable | 63 | 80 | 0:45 1:12 2:6 |
| plafond-pics | 63 | 80 | 0:14 1:14 2:35 |
| quinconce | 59 | 80 | 0:19 1:40 |
| lucarne | 57 | 80 | 0:7 1:50 |
| scie-sol | 55 | 80 | 0:44 1:6 2:5 |
| puits | 54 | 80 | 0:16 1:22 2:16 |
| piliers | 50 | 80 | 0:11 1:39 |
| saut-long | 46 | 80 | 0:2 1:5 2:39 |
| ressort-plafond | 44 | 80 | 0:2 1:6 2:36 |
| cheminee | 43 | 80 | 0:0 1:27 2:16 |
| iles-friables | 43 | 80 | 0:24 1:19 |
| escalier-friable | 42 | 80 | 0:21 1:21 |
| petits-trous | 40 | 80 | 0:19 1:0 2:21 |
| ressorts-trous | 39 | 80 | 0:17 1:22 |
| cheminee-scie | 38 | 80 | 0:0 1:8 2:16 3:14 |
| escalier | 38 | 80 | 0:0 1:19 2:19 |
| pont-friable | 37 | 80 | 0:13 1:13 2:11 |
| mur-seul | 35 | 80 | 0:13 1:15 2:7 |
| ressort-mur | 23 | 80 | 0:15 1:8 |
| cheminee-pics | 19 | 80 | 0:10 1:9 |
| descente | 15 | 80 | 0:4 1:4 2:7 |
| plaine | 14 | 80 | 0:3 1:4 2:7 |
| tunnel | 13 | 80 | 0:5 1:6 2:2 |

Morceaux qui ne sortent jamais : aucun.
Variantes qui ne sortent jamais : cheminee-scie:0, cheminee:0, escalier:0, petits-trous:1.

#### D'un jour au suivant
Morceaux en commun entre deux jours consécutifs : min 1 · moyenne 3,07 · max 6 (répartition : 0→0 1→5 2→28 3→47 4→33 5→5 6→1).

#### Coûts (Node, une date à la fois)
| mesure | valeur |
|---|---|
| génération d'un niveau (tous ses tirages, rejeux compris) : moyenne · max | 37,9 ms · 92,3 ms |
| rejeu de la preuve (`replayAttempt`) : moyenne · max | 2,55 ms · 4,71 ms (709 ns par pas) |
| taille de la preuve (base64url) : moyenne | 167 caractères |

## Les morceaux et variantes qui ne sortent pas (ou peu)
- **Tous les morceaux sortent** (de 13 à 68 niveaux sur 120, chacun disponible 80 jours sur 120 à cause du repos).
- **Quatre variantes ne sortent jamais** : `cheminee:0` et `cheminee-scie:0` (exigence 5 : la pointe d'exigence est prise par leurs variantes à 4, plus proches du profil visé, et un seul morceau de 5 dépasse vite le budget), `escalier:0` (exigence 3 alors que le `respiration` du milieu vise ≈ 2,1 : ses variantes à 2 l'emportent toujours), `petits-trous:1` (exigence 1 : ses deux autres variantes, à 2, sont plus proches du profil au milieu).
- **Les `respiration` sortent peu** (`tunnel` 13, `plaine` 14, `descente` 15 niveaux) : un seul par niveau, cinq candidats. `cheminee-pics` (19) et `ressort-mur` (23) sont rares : la première monte de 11 à 13 rangées (la hauteur bornée à 48 la refuse souvent), le second n'a que des variantes à 1.

## `package-lock.json`
**Aucune modification.** `apps/jump` dépendait déjà de `@cdj/clock` (ajouté au lot 1 pour le jour de Paris : `package.json` et le lien dans `package-lock.json` y étaient). Aucune zone partagée touchée, aucune dépendance ajoutée.

## Vérifié / non vérifié / décisions
**Vérifié** : typecheck ; Vitest (`npm test` complet : 1 294 tests SQLite + 158 libSQL ; DailyJump et socle : 359) — dont 60 dates (pureté et déterminisme, quotas, aucun doublon, hauteur, entrées, temps de l'auteur dans [25 ; 40] s, budget et profil d'exigence, exigence identique par jour de la semaine, un point de passage par morceau, médailles entières et ordonnées, identifiant, preuve rejouée, raccord à moins d'un pas, secours jamais utilisé et lui-même valide), golden du générateur (6 dates), fuzz d'intégrité étendu à trois niveaux du jour, `isPreview` et la porte (hier, aujourd'hui, demain, minuit d'été et d'hiver), médaille visée, textes ; **golden de DailyTrack, du personnage, des morceaux et de l'essai inchangés, `JUMP_SIM_VERSION` toujours 3** ; e2e **Chromium** en local (DailyJump : 59 tests, dont les 6 du lot 5 : page par défaut au jour décalé, trois `?seed=` différents, `&solution` qui finit au temps de l'auteur en pas à pas avec 🏆, site publié simulé (date future refusée même avec `?debug&solution`, archive), passage de minuit, un niveau du jour au doigt en paysage) ; captures relues à l'œil (ordinateur, téléphone en paysage et en portrait, `?debug`).
**Non vérifié** : Firefox et WebKit (la CI tranche) ; vrai téléphone ; **le ressenti** : 10 morceaux de ≈ 3 s, c'est dense ; l'exigence reste une mesure de la marge des solutions, pas de la difficulté humaine.

**Décisions pour Nathan**
1. **Branche** : la session imposait `main`, mais le lot demande une PR brouillon : le travail est sur `claude/dailyjump-lot-5-niveau-du-jour`.
2. **Colonne de raccord** entre deux morceaux (comme les colonnes d'appel et de sortie de `buildModule`) : elle porte le point de passage, et y reprendre redonne exactement le départ « à l'arrêt » du morceau seul.
3. **Raccord des solutions** : le pas le plus proche du départ du morceau seul, et **l'autre pas** si la solution n'aboutit pas de là. Sans ce repli (et sans la course après la dernière solution), près d'un quart des tirages composés échouaient au rejeu (135 sur 572, mesuré sur 120 dates) (`cheminee:1` échoue pour tout départ un peu en arrière, `mur-friable:1` un peu en avant) : la note de raccord du lot 4 (≥ 50 %) laisse passer ces variantes. Avec lui, plus aucun échec de rejeu.
4. **Un seul morceau `respiration`** par niveau, au milieu (le prompt n'en demandait qu'au milieu ; ailleurs ils remplaçaient des passages exigeants).
5. **Exigence par minute** (dixièmes de point) : fenêtre 380–460 réglée sur la distribution des tirages composés (médiane ≈ 403) ; avec 6 tirages, chaque jour en a un valide. Le catalogue a peu de variantes à 3 : le profil 1,3 → 3,3 donne en pratique ≈ 1,5 → 2,9 par tiers.
6. **Repos** : sel `repos4310:` cherché parmi 5 000 pour que les trois groupes fassent 9 morceaux avec les étiquettes réparties (sinon un jour sur trois n'avait que `cheminee-scie` comme scie). Deux jours consécutifs ont en moyenne 3 morceaux en commun.
7. **Secours** : une suite fixe tirée des tirages valides (au centre exact de la cible : 29,975 s, exigence 420), qui tient toutes les règles ; il ignore le repos ; jamais utilisé sur 120 dates.
8. **Porte des dates futures** : « serveur local » = `localhost`, `127.*`, `::1`, les adresses du réseau local (`192.168.*`, `10.*`, `172.16–31.*`) et `*.local` (pour essayer sur un téléphone branché sur le serveur de développement). **C'est une porte, pas une protection** : le générateur est dans le code publié, n'importe qui peut calculer le niveau de demain ; la vraie garantie viendra du serveur en phase 2, qui n'acceptera que les temps du jour.
9. **Passage de minuit** : vérifié une fois par seconde ; « Nouveau niveau disponible : R (ou ↻) pour l'ouvrir » reste affiché ; « recommencer » **recharge la page** sur le niveau du jour (adresse sans `seed` ni `solution`, avec `debug`, `touch`, `fx`, `ghost` gardés). Seulement quand le niveau ouvert est celui d'aujourd'hui (pas une archive).
10. **Médaille visée** dans le HUD : la première que le meilleur temps du jour ne tient pas encore (🥉 sans temps) ; « 🏆 auteur battu » ensuite. Avant le premier jour, « DailyJump » sans numéro.
