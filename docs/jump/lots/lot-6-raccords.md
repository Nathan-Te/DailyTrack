# Lot 6 — Les raccords fluides (DailyJump)

## À tester
Aperçu de la branche `claude/dailyjump-raccords-fluides-didou1` (toutes les dates y sont ouvertes) :
- **Le niveau du jour : [`https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-raccords-fluides-didou1/jump/`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-raccords-fluides-didou1/jump/)** — on atterrit sur un palier de 2 tuiles et on repart aussitôt ; le fanion est au début du palier.
- **Trois dates conseillées**, chacune avec `&solution` (la rediffusion de l'auteur, sans aucune course entre deux morceaux) :
  - courte (27,99 s, 11 morceaux) : [`?seed=2026-11-04`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-raccords-fluides-didou1/jump/?seed=2026-11-04) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-raccords-fluides-didou1/jump/?seed=2026-11-04&solution)
  - longue (30,78 s, 11 morceaux, un 5/5) : [`?seed=2026-11-23`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-raccords-fluides-didou1/jump/?seed=2026-11-23) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-raccords-fluides-didou1/jump/?seed=2026-11-23&solution)
  - la plus exigeante des 45 premières (50,6 points/min, 12 morceaux) : [`?seed=2026-11-05`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-raccords-fluides-didou1/jump/?seed=2026-11-05) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-raccords-fluides-didou1/jump/?seed=2026-11-05&solution)
- `&debug` : limites des morceaux ; la galerie `?modules` montre chaque morceau entre ses deux paliers standard.

## La règle v2 en bref
- **Format de morceau v2** (`format: 2`) : les paliers **ne sont plus dessinés** ; la grille commence à la première colonne du défi et finit à la dernière ; `paliers: <entrée> <sortie>` donne la rangée du sol de chaque côté. Les 27 fichiers ont été convertis par script (retrait des 3 colonnes de palier v1 de chaque bout, plages `repeter` et coordonnées des scies décalées), puis relus.
- **Palier standard** (`PALIER_LENGTH` = 2) posé par `buildModule` **et** par l'assemblage : sol plein, plein dessous, **vide au-dessus jusqu'en haut** (un rebord, pas un couloir). Morceau seul : garde · palier d'entrée (`S`) · grille · palier de sortie · piste · `F`.
- **Point canonique = bord droit du palier.** Une solution **sort** au premier pas où le centre du personnage franchit ce bord, au sol, à `runSpeed`, en **course propre** (`isCleanRun` : bouton relâché, tampon vide, ni montée ni mur) ; le morceau suivant entre en élan **au pas suivant**, depuis son `entryTick`. Entrée *arrêt* : immobile au début du palier (premier morceau, reprise sur un fanion).
- **Niveau du jour** : le palier de sortie d'un morceau **est** le palier d'entrée du suivant (aucune colonne de raccord), le fanion à son début ; `JOINT_TICKS` = 0.

```
                ├──── palier partagé (2 tuiles) ────┤
  morceau k      C                                   │   morceau k+1
    ↘ on atterrit                                     │  ↗ on repart en élan, sans course
  ##############▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│#################
                 ↑ fanion : reprise = entrée          ↑ bord droit : la solution k sort ici (au sol,
                   « arrêt » du morceau k+1 seul        course propre) ; k+1 part au pas suivant
```

## Course à vide, avant / après
Mesurée sur la rediffusion de l'auteur (120 dates) : temps **au sol sans appui de saut**, centre au-dessus d'un palier de raccord. « Avant » = lot 5 (`g1`) sur cette branche avant la conversion, la zone de raccord étant les 3 + 1 + 3 colonnes (palier de sortie, colonne de raccord, palier d'entrée).

| mesure | avant (lot 5) | après (lot 6) | cible |
|---|---|---|---|
| par raccord : moyenne · max | 0,45 s · 0,64 s | **0,13 s · 0,18 s** | < 0,25 s |
| total des raccords, % du temps de l'auteur : moyenne · max | 13,4 % · 18,5 % | **4,5 % · 6,0 %** (< 6 %, règle) | < 6 % |
| plus longue course au sol sans saut : moyenne · max | 2,71 s (29,7 t.) · 5,35 s (58,8 t.) | 2,49 s (27,3 t.) · 4,99 s (54,8 t.) | — |
| morceaux seuls (élan) : temps sur les paliers · plus longue course | 0,38 s · 0,88 s (9,6 t.) | 0,12 s · 0,81 s (8,9 t.) | — |

La **plus longue course** baisse peu : ce sont les plats **à l'intérieur** des morceaux (`plaine`, `tunnel`, l'approche de `ascenseur`, la sortie de `saut-long`…), pas les raccords (décision 1).

## Variantes adoucies ou retirées, exigences
Re-résolues pour la nouvelle règle (raccord strict ≥ 90 %, depuis 25 positions d'entrée couvrant un pas de course). **Raccord : 100 % pour les 75 solutions en élan.** Adoucies (au pas près une fois le palier raccourci : la phase des scies à l'arrivée a changé) : `scie-ronde` cycle 150 → **135** ; `cheminee-scie` haut 1 cycle 360 → **390**, haut 2 cycle 480 → **360** ; `ressort-plafond` bord 3 → **4** ; `cheminee-pics` plaque 2 en élan → nouveau paramètre `couloir` (passage bas de 2 colonnes) et une variante plus douce `plaque=0 couloir=2` ; `demi-tour` écart 3 → **4** (à l'arrêt, il ne tenait que par un saut mural sur le bord du niveau, interdit maintenant). **Aucune retirée.** Exigence des variantes : avant 1 → 35 · 2 → 20 · 3 → 5 · 4 → 9 · 5 → 5 (74) ; **après 1 → 36 · 2 → 24 · 3 → 3 · 4 → 6 · 5 → 6 (75)**. Durées des solutions (entrée → sortie) : 1,63 à 4,33 s, moyenne 2,63 s (2,93 s au lot 5, paliers compris).

**Repli « l'autre pas » retiré** : sur 720 tirages, aucun échec d'enchaînement (au lot 5 sans repli : 135 sur 572). Une seule tolérance, mesurée : depuis certaines positions d'entrée la sortie vient quelques pas après la fin des commandes stockées (`puits` v0) ; le test de raccord et l'assemblage tiennent alors droite (`RACCORD_TAIL` = 64 pas au plus).

## Seuils recalés (niveau du jour, `JUMP_GENERATOR_VERSION` 2, identifiants `…-g2`)
| constante | lot 5 | lot 6 | pourquoi |
|---|---|---|---|
| `JOINT_TICKS` | 9 | **0** | plus de course entre deux solutions |
| `MAX_PIECES` | 10 | **13** | morceaux plus courts : 11 à 12 par niveau |
| `MAX_DAILY_HEIGHT` | 48 | **56** | un morceau de plus, plus de dérive verticale ; à 48, 45 % des tirages en impasse |
| `EXIGENCE_RATE_MIN` / `_MAX` / `_CENTER` | 380 / 460 / 420 | **430 / 520 / 475** | la même suite tient en moins de temps ; fenêtre recentrée sur la médiane (473), même largeur relative |
| `FORCE_REST_SLACK` (nouveau) | — | 3 s | la respiration n'est imposée que quand elle ne pourrait plus tomber au milieu (sinon impasse avec des morceaux courts) |
| `EMPTY_RUN_MAX` (nouveau) | — | 60 ‰ | course à vide sur les paliers < 6 % du temps de l'auteur, règle du générateur |
| `FALLBACK_PIECES` | 10 morceaux | 12 morceaux | tirage le plus central de 400 dates (30,21 s, 476) |

Golden du générateur régénérés (`UPDATE_GOLDEN=1 … golden-daily.test.ts`) : **chaque date change** (nouveau catalogue, paliers partagés, seuils) ; ceux de DailyTrack, du personnage, de l'essai et des rediffusions n'ont pas bougé ; **`JUMP_SIM_VERSION` toujours 3**.

## Mesures (`npm run measure:jump -w @cdj/jump-sim`, sortie complète)

### Niveau du jour — 120 dates (du 2026-10-16 au 2027-02-12)

#### Tirages
| mesure | valeur |
|---|---|
| tirages essayés (6 par jour, jusqu'à 40 sans tirage valide) | 720 |
| composés (sans impasse) | 555 (77,1 %) |
| **validés** (rejeu sans mort, toutes les règles) | **409** (56,8 % des tirages, 73,7 % des composés) |
| tirage retenu (indice) : moyenne · maximum | 2,51 · 5 |
| jours sans tirage valide parmi les 6 premiers | 0 |
| **niveau de secours utilisé** | **0** |

Refus et impasses :

- 165 × impasse (impasse au morceau n)
- 110 × exigence n hors de [n, n]
- 13 × le dernier tiers (n) est moins exigeant que le premier (n)
- 12 × course à vide sur les paliers n ‰ (moins de n ‰)
- 5 × exigence n hors de [n, n] ; le dernier tiers (n) est moins exigeant que le premier (n)
- 4 × exigence n hors de [n, n] ; course à vide sur les paliers n ‰ (moins de n ‰)
- 1 × respiration à n ‰ (entre n et n)
- 1 × exigence n hors de [n, n] ; le dernier tiers (n) est moins exigeant que le premier (n) ; course à vide sur les paliers n ‰ (moins de n ‰)

#### Temps de l'auteur
min **27,99 s** · moyenne **29,60 s** · max **31,05 s** (permis : 25,00–40,00 s, centre 30 s)

| tranche | niveaux |
|---|---|
| 26–28 s | 1 █ |
| 28–30 s | 91 ███████████████████████████████████████████████████████████████████████████████████████████ |
| 30–32 s | 28 ████████████████████████████ |
| 32–34 s | 0  |
| 34–36 s | 0  |
| 36–38 s | 0  |
| 38–40 s | 0  |

Écart temps de l'auteur − estimation (somme des solutions de l'entrée à la sortie, aucune course entre deux) : min -4 · moyenne 10,3 · max 59 pas.

#### Course à vide (rediffusion de l'auteur)
Temps **au sol sans appui de saut**, centre du personnage au-dessus d'un palier ; plus longue course au sol sans saut du niveau.

| mesure | moyenne | max |
|---|---|---|
| par raccord (1280 raccords) | 0,13 s | 0,18 s |
| total des raccords, en % du temps de l'auteur | 4,5 % | 6,0 % |
| palier de départ (accélération comprise) | 0,20 s | 0,22 s |
| palier d'arrivée (jusqu'à `F`) | 0,10 s | 0,16 s |
| plus longue course au sol sans saut | 2,49 s · 27,3 tuiles | 4,99 s · 54,8 tuiles |

#### Forme
| mesure | min | moyenne | max |
|---|---|---|---|
| morceaux par niveau | 11 | 11,7 | 13 |
| hauteur (rangées, ≤ 56) | 29 | 49,9 | 56 |
| largeur (colonnes) | 281 | 304,1 | 328 |

#### Exigence
| mesure | min | moyenne | max |
|---|---|---|---|
| somme des exigences | 22 | 23,4 | 26 |
| par minute (dixièmes de point ; fenêtre 430–520) | 441 | 473,5 | 512 |
| exigence du morceau le plus exigeant | 4 | 4,2 | 5 |
| premier tiers (moyenne pondérée, dixièmes) | 10 | 15,2 | 22 |
| deuxième tiers (moyenne pondérée, dixièmes) | 10 | 18,6 | 25 |
| dernier tiers (moyenne pondérée, dixièmes) | 17 | 25,1 | 38 |

Par jour de la semaine (exigence par minute, moyenne) : lundi 468 · mardi 473 · mercredi 477 · jeudi 474 · vendredi 475 · samedi 473 · dimanche 474.

#### Étiquettes (morceaux par niveau, moyenne ; niveaux qui en ont)
| étiquette | par niveau | niveaux |
|---|---|---|
| mural | 3,38 | 120/120 |
| precision | 4,72 | 120/120 |
| vertical | 3,96 | 120/120 |
| scie | 3,16 | 120/120 |
| friable | 2,03 | 120/120 |
| ressort | 1,07 | 98/120 |
| respiration | 1,00 | 120/120 |

#### Emploi des morceaux (niveaux qui le contiennent ; jours où il est disponible ; variantes)
| morceau | niveaux | disponible | variantes (emplois) |
|---|---|---|---|
| cheminee | 74 | 80 | 0:18 1:45 2:11 |
| puits | 72 | 80 | 0:60 1:9 2:3 |
| grande-scie | 71 | 80 | 0:40 1:25 2:6 |
| scie-sol | 71 | 80 | 0:7 1:8 2:56 |
| ascenseur | 69 | 80 | 0:10 1:50 2:9 |
| mur-friable | 69 | 80 | 0:20 1:27 2:22 |
| scie-ronde | 65 | 80 | 0:25 1:12 2:28 |
| demi-tour | 64 | 80 | 0:31 1:8 2:25 |
| escalier-friable | 62 | 80 | 0:13 1:49 |
| piliers | 62 | 80 | 0:7 1:55 |
| quinconce | 62 | 80 | 0:50 1:12 |
| saut-long | 62 | 80 | 0:53 1:4 2:5 |
| plafond-pics | 59 | 80 | 0:21 1:22 2:16 |
| iles-friables | 58 | 80 | 0:10 1:48 |
| pont-friable | 55 | 80 | 0:21 1:13 2:21 |
| lucarne | 50 | 80 | 0:28 1:22 |
| ressort-plafond | 50 | 80 | 0:3 1:42 2:5 |
| cheminee-pics | 46 | 80 | 0:0 1:0 2:46 |
| ressorts-trous | 46 | 80 | 0:28 1:18 |
| cheminee-scie | 41 | 80 | 0:0 1:21 2:20 3:0 |
| mur-seul | 40 | 80 | 0:15 1:14 2:11 |
| escalier | 39 | 80 | 0:0 1:1 2:38 |
| petits-trous | 37 | 80 | 0:17 1:0 2:20 |
| ressort-mur | 32 | 80 | 0:14 1:18 |
| descente | 18 | 80 | 0:6 1:6 2:6 |
| tunnel | 14 | 80 | 0:7 1:3 2:4 |
| plaine | 12 | 80 | 0:5 1:7 2:0 |

Morceaux qui ne sortent jamais : aucun.
Variantes qui ne sortent jamais : cheminee-pics:0, cheminee-pics:1, cheminee-scie:0, cheminee-scie:3, escalier:0, petits-trous:1, plaine:2.

#### D'un jour au suivant
Morceaux en commun entre deux jours consécutifs : min 2 · moyenne 4,19 · max 7 (répartition : 0→0 1→0 2→7 3→22 4→43 5→36 6→10).

#### Coûts (Node, une date à la fois)
| mesure | valeur |
|---|---|
| génération d'un niveau (tous ses tirages, rejeux compris) : moyenne · max | 51,3 ms · 212,3 ms |
| rejeu de la preuve (`replayAttempt`) : moyenne · max | 2,45 ms · 5,15 ms (689 ns par pas) |
| taille de la preuve (base64url) : moyenne | 187 caractères |

## Le solveur
`npm run solve:modules -w @cdj/jump-sim`, tout le catalogue (150 solutions) : **250,5 s** sur 4 fils (998 s de calcul, Node 22) ; une retouche d'un morceau : 10 à 25 s. Ce qui change : le but est la **sortie canonique** vérifiée à chaque pas (plus l'arrivée) ; en élan la recherche part du bord du palier d'entrée ; une branche qui passe le bord de sortie hors de la course propre, ou repasse à gauche du palier d'entrée, est perdue ; le durcissement compte aussi les 25 positions d'entrée ; la solution est finie tout droit jusqu'à l'arrivée du morceau seul. Le solveur reste dans `tools/`.

## Vérifié / non vérifié / décisions
**Vérifié** : typecheck ; `npm test` complet (1 299 tests SQLite + 158 libSQL), dont DailyJump et le socle (364) : format v2 (`format: 2` exigé, palier standard posé à côté de la grille, garde, scie au-dessus d'un palier refusée), **chaque solution stockée sort au bord droit de son palier, au sol, à `runSpeed`, en course propre** (`moduleSpan`, pas stockés = pas rejoués), raccord ≥ 90 %, 60 dates (paliers partagés sans colonne de raccord, fanion au début du palier, **la solution suivante démarre au pas de sortie de la précédente** avec ses propres commandes, **la reprise sur un fanion donne exactement l'entrée « arrêt » du morceau seul et sa solution en sort**, cibles de course à vide, `palierTicks` = la mesure des outils), fuzz étendu (départs aux raccords : élan à une position au hasard dans un pas de course et reprises sur chaque fanion, réglages par défaut et au hasard) ; golden du générateur régénérés, **golden de DailyTrack, du personnage, de l'essai et des rediffusions inchangés, `JUMP_SIM_VERSION` 3** ; `measure:jump` et `measure:modules` complets ; e2e DailyJump **Chromium** en local (59 tests : `?seed=…&solution` finit au temps de l'auteur avec paliers partagés et morceaux bout à bout, la galerie en portrait et paysage, `?module=…&solution`, un niveau du jour au doigt en paysage). Aucune zone partagée ni fichier de DailyTrack touché, aucune dépendance.
**Non vérifié** : Firefox et WebKit (la CI tranche) ; vrai téléphone ; **le ressenti** (le palier de 2 tuiles laisse-t-il le temps de lire la suite ?).

**Décisions pour Nathan**
1. **Conversion = retrait du palier dessiné (3 colonnes) de chaque bout**, pas de tout le plat : les morceaux gardent leurs approches et sorties plates (`ascenseur` 9 colonnes avant le fossé, `saut-long` 13 après, `plaine`, `tunnel`…). Les retirer toutes ramènerait un morceau à ≈ 1,4 s : il faudrait ≈ 20 morceaux par niveau alors que le repos en laisse 18 par jour, et 19 raccords dépasseraient 6 %. C'est ce qui reste de la plus longue course (2,49 s en moyenne) ; à traiter avec les enchaînements et mutateurs du lot 7.
2. **Colonne de garde** devant le premier palier (morceau seul et niveau du jour) et règle « le centre ne repasse pas à gauche du palier d'entrée » : sans elles, le solveur prenait un saut mural sur le bord du niveau au départ arrêté, impossible à une reprise sur un fanion.
3. **Morceau seul** : après le palier de sortie, une colonne de piste et l'arrivée (la solution est sortie avant ; le temps affiché dans la galerie est celui de toute la rediffusion, comme avant). **Niveau du jour** : l'arrivée juste après le dernier palier.
4. **Course propre** exigée à la sortie (en plus d'« au sol, à `runSpeed` ») : c'est ce qui rend le raccord exact ; **raccord** = 25 positions dans un pas de course, droite tenue au plus 64 pas après les commandes (`RACCORD_TAIL`, aussi dans l'assemblage).
5. **Seuils** : hauteur 56 (48 donnait 45 % d'impasses), fenêtre d'exigence 430–520 (la densité monte : même exigence, moins de course), jusqu'à 13 morceaux ; la course à vide sous 6 % est une **règle** (le pire tirage était à 6,1 % sans elle). Taux de validation 56,8 % (lot 5 : 56,3 %), secours 0.
6. Les variantes à 5/5 (`cheminee-pics` 0 et 1, `cheminee-scie` 0 et 3) et `escalier:0`, `demi-tour:2` ne sortent pas : le profil visé (1,3 → 3,3) leur préfère les 4/5 ; à revoir avec les seuils de `exigenceOf` sur de vraies parties.
7. Branche imposée par la session : `claude/dailyjump-raccords-fluides-didou1` ; la ligne « morceau » de la surimpression `?debug` compte encore le morceau à partir d'une colonne avant lui (affichage seul, `apps/jump` non touché à cause du lot en parallèle).
