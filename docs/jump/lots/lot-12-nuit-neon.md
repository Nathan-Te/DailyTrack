# Lot 12 — Nuit et néon : blocs clignotants et blocs alternés (DailyJump)

## À tester
Aperçu de la branche (toutes les dates y sont ouvertes), **avec le son** (un premier geste le déverrouille) : `https://nathan-te.github.io/DailyTrack/b/lot-12-nuit-neon/jump/` (adresse à confirmer après la première construction de la PR).
- **Un niveau nuit et un niveau néon**, avec `&solution` (rediffusion de l'auteur) : `?seed=2026-10-18&accueil=0&solution` (nuit) et `?seed=2026-10-28&accueil=0&solution` (néon). Les 16 et 17 octobre sont figés (g4).
- **Trois morceaux de chaque dans la galerie** `?modules` (filtre « Thème » : nuit / néon ; chaque morceau s'ouvre dans son thème) : nuit — `nuit-opposition` (îlots en opposition de phase), `nuit-portes`, `nuit-cheminee` ; néon — `neon-couloir` (sauter pour faire apparaître le sol suivant), `neon-cheminee` (chaque saut mural change le mur solide), `neon-silence` (un pont qu'il ne faut pas sauter). Aussi les variantes mutées : `marelle` v5 (nuit), `piliers` v5 (nuit), `saut-plafond` v5 et `petits-trous` v5 (néon).
- **Outils** : `?debug&hitbox` (cadre vert = bloc plein, croix rose = absent, « JEU A / B ACTIF » en haut à droite), `?debug` → `__jump.blocks`, `?metronome=off`. **Mouvement réduit** (réglage du menu ⏸ ou du système) : le vacillement reste lisible sans clignoter.

## Les deux mécaniques
| | **Clignotants (nuit)** | **Alternés (néon)** |
|---|---|---|
| caractères | `b` (solide pendant la fenêtre), `d` (en opposition de phase) | `A` (solide au départ), `B` |
| déclaration | `clignote <section> <cycle> <solide> <décalage>` (annexe) ; morceau : `clignote <cycle> <solide> <décalage>` | aucune |
| horloge | phase = pas depuis l'**entrée** du personnage dans la section (comme les scies) ; `q = (phase + décalage) mod cycle` : `b` plein si `q < solide`, `d` si `q ≥ solide` | parité `AttemptState.alt` : **chaque saut qui part** l'inverse (sol, coyote, mural, tampon **au pas où il part**) ; **ressort : rien** |
| remise à zéro | la mort et la reprise remettent la phase à 0 (sections du point et d'après) | A plein au départ, **à chaque point de passage franchi** (l'emporte sur un saut parti au même pas) et à la mort |
| juste | **un bloc qui devrait devenir plein pendant que le personnage le chevauche reste traversable jusqu'à ce qu'il en sorte** (`settleDynamic`) : jamais écrasé ni coincé, déterministe et testé | idem |
| état | seul le champ `tiles` change (codes `TILE_BLINK_*`, `TILE_ALT_*` = état actuel) | `alt` **absent** des niveaux sans blocs alternés (comme `carry`) |
| lisible | absent = contour discret ; **vacille 0,25 s** avant de s'éteindre ; métronome (4 temps par cycle, accent sur les bascules) | jeu inactif = contour ; repères (**barre A, losange B**) ; clic + éclat à chaque bascule, éclat au fanion à la remise à A |
| couleurs | bleu 226° | turquoise 175° / violet 269° — **teinte à ≥ 30° du rouge des dangers (0°) et du jaune du personnage (44°)**, contrastes ≥ 3:1 avec chaque ciel et chaque plan, ≥ 1,5:1 avec le personnage (`blocks.test.ts`) |

**Physique** : ajout pur. `JUMP_SIM_VERSION` reste **3** ; golden du personnage, de l'essai et des rediffusions **inchangés** ; `stepPlayerJump` rend les mêmes états au bit près que `stepPlayer`. Fuzz d'intégrité sur des niveaux qui contiennent les deux mécaniques (75 000 pas + réglages au hasard : entiers, sans −0, ≤ `MAX_SPEED`, jamais dans un bloc plein, parité cohérente).

## Les nouveaux morceaux (13) et les variantes mutées (4 morceaux, 1 variante chacun)
| morceau | thème | étiquettes | variantes | exigence | solution | intention |
|---|---|---|---|---|---|---|
| `nuit-cheminee` | nuit | mural vertical | 4 | 1–4 | 2.0–3.2 s | Monter une cheminée dont un mur s'éteint par moments : grimper tant qu'il est allumé, sortir par le haut. |
| `nuit-escalier` | nuit | vertical | 4 | 1–3 | 2.2–2.5 s | Gravir un escalier dont une marche sur deux seulement est allumée. |
| `nuit-marelle` | nuit | respiration | 4 | 1–2 | 1.9–2.6 s | Marcher sur des pierres qui s'allument à tour de rôle : sauts courts, de quoi souffler (3 sauts). |
| `nuit-opposition` | nuit | precision | 5 | 1–5 | 2.2–4.8 s | Sauter d'îlot en îlot au-dessus des pics : quand l'un s'éteint l'autre s'allume. |
| `nuit-pont` | nuit | precision | 5 | 1–3 | 1.4–2.4 s | Traverser un long pont de blocs qui s'allument et s'éteignent. |
| `nuit-portes` | nuit | precision | 4 | 2–5 | 3.4–4.2 s | Un couloir fermé par des portes qui s'ouvrent à tour de rôle, des pics entre elles. |
| `nuit-relais` | nuit | precision vertical · **long** | 3 | 2–5 | 5.4–7.8 s | Le pont, les îlots, puis l'escalier. |
| `neon-cheminee` | néon | mural vertical | 2 | 1–2 | 2.4–3.1 s | Une cheminée dont les deux murs ne sont jamais solides ensemble. |
| `neon-couloir` | néon | precision | 3 | 1–5 | 1.1–2.8 s | Un sol qui change à chaque saut : sauter au bord pour faire apparaître le suivant. |
| `neon-pics` | néon | precision | 4 | 2–5 | 2.2–2.7 s | Compter ses sauts : chaque saut inverse les portes, des pics entre elles. |
| `neon-relais` | néon | precision · **long** | 3 | 4–5 | 5.3–5.8 s | Le couloir au-dessus des pics, puis les portes à passer en comptant ses sauts. |
| `neon-respiration` | néon | respiration vertical | 3 | 1–2 | 2.1–2.4 s | Des marches de sol alterné séparées par des pics : un petit saut par marche (3 sauts). |
| `neon-silence` | néon | precision | 3 | 1–1 | 2.1–2.7 s | Sauter une fois pour faire apparaître le pont, puis courir **sans sauter** sous les pics du plafond. |

Dans chaque mécanique : 7 et 6 morceaux dédiés, **un enchaînement long** (5,3–7,8 s) et **une respiration** (exigence ≤ 2 partout, au moins 3 sauts à chaque entrée : test). **Mutateurs** (`clignotant`, `alterne`, jamais hors de leur thème) : `marelle` v5 et `piliers` v5 (+`clignotant:lent`), `saut-plafond` v5 et `petits-trous` v5 (+`alterne`). Règles inchangées : appui humain, ±3 pas ≥ 50 %, raccord ≥ 90 %, plats, familles, 6 variantes au plus. Variantes écartées en route : `nuit-opposition` (deux paires de grandes fenêtres, gigue 0 %), `neon-relais` suite=6, `nuit-marelle` à deux paires (gigue 0–1 %), `escalier` +`clignotant` (exigence 4 sur une respiration).

**Solveur** : les 13 morceaux et les 5 mutés (152 solutions) en **422 s = 7 min** sur 4 fils ; le catalogue entier re-résolu de zéro (`--force`, 4 fils, 75 morceaux, 330 variantes) en **1 465 s = 24,4 min** (5 855 s de calcul), plafond du lot : 30 min. Un morceau où il faut **attendre** (un bloc qui n'est pas encore allumé) n'avait « aucune solution » : le faisceau écartait les branches immobiles au profit de celles qui se jettent dans le vide. Seconde passe, **seulement si la première échoue et seulement dans un niveau à blocs dynamiques** : la moitié du faisceau est réservée aux meilleures branches posées au sol (`tools/beam.ts`) ; la clé de déduplication connaît la parité, les phases et l'état des blocs. Les morceaux sans bloc dynamique ont les mêmes solutions, bit pour bit (vérifié).

## `measure:jump` (120 dates, `npm run measure:jump -w @cdj/jump-sim`)
Globalement : **54,1 %** de tirages validés (69,2 % des composés ; 58,6 % au lot 11), **secours 0**, temps de l'auteur 27,99–31,80 s. Forêt, usine et glace redonnent **exactement** les lignes du lot 11 (65,1 / 35,5 / 58,0 %) : leur composition n'a pas bougé (le golden le confirme date par date).

| thème (mécanique) | jours | tirages validés | secours | temps de l'auteur (min · moy · max) | exigence/min | part de la mécanique | en commun avec la veille |
|---|---|---|---|---|---|---|---|
| foret | 31 | 65,1 % | 0 | 28,21 · 29,66 · 31,11 s | 468 · 505 · 553 | — | 0,77 (max 2) |
| usine (tapis) | 16 | 35,5 % | 0 | 28,32 · 29,52 · 31,70 s | 450 · 502 · 542 | 21 · 30 · 36 % | 0,88 (max 3) |
| glace (glace) | 23 | 58,0 % | 0 | 28,48 · 29,61 · 31,56 s | 449 · 503 · 543 | 20 · 29 · 40 % | 0,87 (max 3) |
| **nuit (clignotant)** | 27 | **48,2 %** | 0 | 27,99 · 29,52 · 31,80 s | 464 · 510 · 548 | 21 · 31 · 39 % | 0,56 (max 2) |
| **neon (alterne)** | 23 | **57,2 %** | 0 | 28,09 · 29,42 · 30,93 s | 474 · 515 · 549 | 22 · 28 · 38 % | 0,52 (max 2) |

**Thème forcé** (12 dates × 5 thèmes, du 2027-08-12 au 2027-08-23) :

| thème forcé | niveaux | tirages validés | des composés | secours | temps de l'auteur (min · moy · max) | exigence/min | part de la mécanique | génération (moy · max) |
|---|---|---|---|---|---|---|---|---|
| foret | 12 | 65,3 % | 72,3 % | 0 | 28,16 · 29,43 · 30,15 s | 518 | 0 % | 108 · 156 ms |
| usine | 12 | 44,2 % | 79,1 % | 0 | 28,08 · 29,40 · 30,66 s | 510 | 27 % | 78 · 120 ms |
| glace | 12 | 54,2 % | 72,2 % | 0 | 28,46 · 29,60 · 30,41 s | 500 | 29 % | 94 · 144 ms |
| nuit | 12 | 47,2 % | 61,8 % | 0 | 28,01 · 29,04 · 30,16 s | 501 | 28 % | 201 · 294 ms |
| neon | 12 | 54,8 % | 72,7 % | 0 | 28,43 · 29,57 · 30,38 s | 515 | 26 % | 233 · 343 ms |

Surveillance des impasses (usine était à 35 %) : nuit 48 % et néon 57 % **sans rien ajuster** — aucune composition changée. Rejeu de la preuve 6,9 ms en moyenne (inchangé). Niveaux de secours de nuit et de néon : `FALLBACK_BY_THEME` (`npm run secours:modules -w @cdj/jump-sim` les choisit parmi 80 tirages valides) ; `THEMED_REST_GROUPS` : les 13 morceaux rangés à la main sans toucher usine ni glace (`repos:modules -- --themes`).

## Versions, golden, jours figés
- `JUMP_GENERATOR_VERSION` **8** (le niveau des dates en nuit et en néon change : nouveaux morceaux et quota ; forêt, usine et glace gardent leurs morceaux, seul l'identifiant et la preuve portent g8). `JUMP_SIM_VERSION` **3**. Golden du niveau du jour régénérés : **deux des six dates changent** (25/10 nuit, 25/12 néon) ; les quatre autres ne changent que d'identifiant. Golden de DailyTrack : aucun fichier touché.
- **Jours figés** : `main` n'a pas bougé depuis le début du lot ; `npm run freeze:days -w @cdj/jump -- demain` lancé **dans un worktree sur `main`** (8c5bc52) : **0 fichier écrit**, le 16 et le 17 octobre sont déjà figés et se relisent. `apps/jump/test/figes.test.ts` : chaque fichier de `public/levels/` se recharge et se rejoue avec le nouveau code.

## Vérifié / non vérifié / décisions pour Nathan
**Vérifié** : `tsc -b` propre ; Vitest `core`, `jump-sim`, `apps/jump` (721 tests, dont `nuit-neon.test.ts` côté simulation et `blocks.test.ts` côté jeu) ; e2e Chromium de `apps/jump` (107 verts, 4 outils sautés) dont `nuit-neon.spec.ts` : niveau nuit et niveau néon en `&solution` au temps de l'auteur sans mort, un morceau de chaque **au doigt en paysage**, mouvement réduit (une seule opacité sur 30 images, contour épaissi) contre effets normaux (la face clignote), `?debug&hitbox`, métronome et `?metronome=off` ; captures du jeu relues (nuit, néon, hitbox).
**Non vérifié** : Firefox et WebKit en local (la CI tranche) ; l'écoute réelle du clic et du métronome (logique et niveaux testés, pas l'oreille) ; un vrai téléphone ; la perf sur vrai GPU ; la CI après rebase (à confirmer sur la PR).

**Décisions pour Nathan**
1. **Branche** : la session impose `main` mais une PR brouillon demande une branche : le travail est sur `lot-12-nuit-neon`.
2. **Le métronome** bat quatre temps par cycle (deux accents sur les bascules) et ne se règle que par `?metronome=off` : pas de curseur dans le menu. À ajouter si tu le trouves envahissant.
3. **Remise à A sans saut** : l'éclat du fanion n'apparaît que si B était solide ; passer le fanion avec A déjà solide ne fait rien.
4. **Exigence** : les morceaux de nuit sont moins exigeants que ceux de la glace par leurs commandes (un pont se court tout droit) ; la difficulté est dans l'attente et le tempo, que l'exigence (gigue des commandes) ne mesure pas.
5. **Couleurs** identiques dans tous les thèmes (comme le tapis et la glace) : un morceau nuit forcé en `?theme=foret` garde ses blocs bleus.
6. **Quatre morceaux ordinaires seulement** reçoivent un mutateur (6 variantes au plus, respirations exclues : leur exigence monte à 4).
