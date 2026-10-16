# Lot 11 — Les thèmes jouables : socle, tapis roulants et glace (DailyJump)

## À tester
Aperçu de la branche (toutes les dates y sont ouvertes), **avec le son** (un premier geste le déverrouille) : `https://nathan-te.github.io/DailyTrack/b/ccr-06e8ae06-xu26wh/jump/` (adresse à confirmer après la première construction de la PR).
- **Un niveau usine et un niveau glace**, avec `&solution` (rediffusion de l'auteur) : `?seed=2026-10-21&accueil=0&solution` (usine) et `?seed=2026-10-19&accueil=0&solution` (glace). Les 16 et 17 octobre sont figés (g4, sans mécanique) : choisir une date à partir du 18.
- **Trois morceaux tapis et trois morceaux glace** dans la galerie `?modules` (filtre « Thème » : usine / glace) : par exemple `tapis-contraire`, `tapis-lance`, `tapis-mur` et `glace-freinage`, `glace-mur`, `glace-cheminee` ; chacun s'ouvre dans son thème. Aussi `plongeon`, `scie-ronde`, `plafond-pics` (variantes `+surface:…`).
- **Réglages** : `?debug&tune` → section « Tapis et glace » : `beltSpeed`, `iceAccel`, `iceDecel` (la partie devient « réglages modifiés », rien n'est enregistré).
- **Thème forcé** : `?seed=2026-10-21&theme=glace` est un essai (identifiant `…-tglace`, bandeau « essai de thème », rien dans l'historique, la série ni le partage). `?debug&hitbox` montre les surfaces (tapis cyan avec leur sens, glace bleu pâle).

## Les nouveaux caractères et la physique
`[` tapis vers la gauche, `]` tapis vers la droite, `~` glace (`level.ts`) : des **blocs pleins** ; seule la face du dessus agit (murs et dessous ordinaires). Réglages optionnels de `JumpParams`, **absents de `DEFAULT_JUMP_PARAMS`** (`SURFACE_DEFAULTS`, lus par `surfaceParam`) : ainsi la table des défauts, donc le golden du personnage, ne bouge pas.

| | réglage | défaut | effet mesuré |
|---|---|---|---|
| Tapis | `beltSpeed` | 171 u/pas ≈ 5 tuiles/s | vitesse visée au sol = course + `beltSpeed` dans le sens du tapis : **16 tuiles/s avec**, **6 contre** (au lieu de 11) ; immobile, on est emporté à 5 tuiles/s |
| Glace | `iceAccel`, `iceDecel` | 4 et 4 u/pas² | pleine vitesse en **94 pas** (23 au sol) ; arrêt en **94 pas et 4,25 tuiles** (12 pas, 0,49 tuile) ; vitesse maximale inchangée ; demi-tour aussi lent |

- **Vitesse gardée en quittant le tapis** : `PlayerState.carry` (−1 / 1, **absent** sinon : les empreintes des niveaux sans tapis ne changent pas) ; en l'air, la vitesse acquise n'est ni freinée ni réaccélérée au-delà de la course (on peut encore la freiner activement). Un saut plat mesure **7,87 tuiles** depuis le sol ou la glace, **11,46** depuis un tapis qui avance, 7,58 depuis un tapis contraire (en l'air on accélère vers la course : sauter sur place « court » le long du tapis). Un mur, un sol ordinaire ou l'arrêt effacent `carry`. Tout reste ≤ `MAX_SPEED`, entier, sans −0 (fuzz sur un niveau qui contient les deux surfaces, réglages au hasard compris).
- La surface sous les pieds (`groundTile`) : la tuile de la colonne du centre si elle est pleine, sinon la première des colonnes couvertes.
- **Ressenti** (jeu seulement, lecture de la sim) : événements `tapisDebut/Fin`, `glaceDebut/Fin`, `glaceFrein` ; ronronnement spatialisé (3 voix, portée 9 tuiles, panoramique) ; crissement de glisse ; chevrons qui défilent (à 2,4 tuiles/s, la moitié de la vitesse du tapis, pour ne pas hacher l'image : `BELT_FLOW`) ; reflet de la glace, éclats de givre, étincelles de rouage ; tout dans des pools plafonnés, coupé par `?fx=off` et le mouvement réduit ; contrastes testés.

## Le socle : le thème entre dans le générateur
- `jumpThemeForDay` (`packages/jump-sim/src/themes.ts`) : **mêmes thèmes qu'au lot 9** sur 400 dates (référence figée avant le changement : `fixtures/themes-lot9.json`) ; `apps/jump` l'appelle.
- Morceaux : métadonnée `theme: usine|glace` (+ étiquette `tapis` / `glace`, vérifiées ensemble) ; un morceau d'une mécanique ne sort que dans son thème. **Mutateur `surface`** : `zone surface <colonnes> <rangée>` ; `+surface:glace`, `+surface:tapis:gauche|droite` ; la variante est réservée au thème de sa mécanique (`variantTheme`).
- **Quota de signature** (constantes nommées) : `SIGNATURE_MIN_PIECES` = 2 morceaux de la mécanique, `SIGNATURE_SHARE_MIN`/`MAX` = 20–40 % du temps de l'auteur ; imposé dès `FORCE_MECH_AT` (45 %), favorisé par `MECH_WEIGHT` ; règle de `dailyProblems`, vérifiée sur le rejeu. Secours propre à chaque thème à mécanique (`FALLBACK_BY_THEME`).
- **Thème forcé = essai** : `dailyLevel(jour, thème)` ; un thème différent de celui de la date donne un autre niveau, identifiant `jour-AAAA-MM-JJ-g6-t<thème>`, `forcedTheme` ; forcer le thème de la date rend le niveau de la date. Les trois thèmes sans mécanique composent la même suite de morceaux (le thème n'y change que l'identité visuelle).
- **Thèmes sans mécanique inchangés** : le sel des groupes de repos ne bouge pas ; les morceaux d'une mécanique sont rangés à la main (`THEMED_REST_GROUPS`, outil `repos:modules -- --themes`) : groupes de même taille à un près, au moins 3 morceaux ou variantes de chaque mécanique chaque jour. Les niveaux des dates en foret / nuit / néon gardent exactement leurs morceaux et leur hash (seuls l'identifiant et la preuve, qui le porte, changent avec g6).
- Consignes : `docs/jump/consignes.md` (section « Lot 11 — thèmes jouables »).

## Les nouveaux morceaux (14) et variantes de surface (6)
| morceau | thème | étiquettes | variantes | exigence | solution | intention |
|---|---|---|---|---|---|---|
| `glace-cheminee` | glace | glace mural vertical | 3 | 2–5 | 2.6–2.6 s | Monter une cheminée en sautant d'un mur à l'autre, puis franchir le trou du sommet pour se poser sur une corniche de glace : on la quitte aussi vite qu'on y arrive. |
| `glace-corniches` | glace | glace precision | 4 | 1–1 | 1.9–2.0 s | Dévaler des corniches glacées dont chacune porte un pic là où l'on glisse : l'élan emporte, il faut sauter au bon endroit. |
| `glace-freinage` | glace | glace precision | 5 | 1–5 | 2.1–2.4 s | Se poser sur une petite plaque de glace au-delà d'un trou, sans glisser jusque dans les pics : retenir son élan en l'air, puis repartir. |
| `glace-mur` | glace | glace mural vertical | 4 | 1–1 | 2.7–3.4 s | Foncer sur la glace jusqu'au pied d'un grand mur sans pouvoir s'arrêter, puis le remonter saut mural après saut mural. |
| `glace-promenade` | glace | glace respiration | 4 | 2–2 | 2.5–3.8 s | Glisser sur une longue piste de glace en sautant de petites marches : l'élan se garde tout seul, il suffit de sauter à temps. |
| `glace-relais` | glace | glace precision mural · long | 3 | 1–2 | 5.4–5.7 s | Dévaler des corniches de glace, se poser sur une plaque avant les pics, puis foncer sur la glace jusqu'à un grand mur à remonter. |
| `glace-saut-haut` | glace | glace precision | 5 | 1–1 | 1.9–2.1 s | Courir sur la glace pour prendre tout son élan, puis franchir un trou jusqu'à une corniche plus haute : l'élan ne se rattrape pas. |
| `tapis-alternes` | usine | tapis precision | 4 | 1–2 | 1.8–3.1 s | Franchir des tapis qui se croisent au-dessus des pics : chaque plateforme tire dans son sens, sauter de l'une à l'autre en gardant le rythme. |
| `tapis-contraire` | usine | tapis scie | 4 | 1–5 | 2.0–2.3 s | Remonter un tapis roulant qui recule en passant sous des scies qui descendent à tour de rôle : avancer au bon moment, sans se laisser ramener. |
| `tapis-escalier` | usine | tapis precision vertical | 4 | 1–2 | 1.9–2.1 s | Gravir un escalier dont chaque marche est un tapis qui recule : sauter de marche en marche avant d'être ramené en arrière. |
| `tapis-lance` | usine | tapis precision | 4 | 1–5 | 1.7–2.1 s | Un tapis qui lance un saut trop long à pied : sauter au bord et retenir son élan pour se poser sur la plateforme avant les pics. |
| `tapis-mur` | usine | tapis mural vertical | 4 | 1–2 | 2.4–2.8 s | Se laisser emporter par un tapis jusqu'au pied d'un mur, puis le remonter saut mural après saut mural sans retomber sur le tapis. |
| `tapis-relais` | usine | tapis scie precision · long | 2 | 5–5 | 5.9–5.9 s | Remonter un long tapis contraire sous des scies, franchir des tapis croisés au-dessus des pics, puis se faire lancer au-dessus d'un trou : garder son élan, puis le retenir. |
| `tapis-respiration` | usine | tapis respiration | 2 | 1–1 | 2.4–3.0 s | Se laisser porter par un tapis rapide en sautant de petites marches : le tapis fait le travail, il suffit de garder le rythme. |

Variantes `+surface` de morceaux ordinaires : `plafond-pics` v4 (glace), `scie-ronde` v4 (glace) et v5 (tapis droite), `plongeon` v3 (glace), v4 (tapis gauche), v5 (tapis droite). Dans chaque mécanique : 7 morceaux, **un enchaînement long** (5,4–5,9 s) et **une respiration** (exigence ≤ 2 partout, au moins 3 sauts). Règles inchangées : ±3 pas ≥ 50 %, raccord ≥ 90 %, plats, familles, 6 variantes au plus. Variantes écartées en route : `glace-freinage` (plafond sans solution), `plafond-pics` tapis gauche (au pas près).

**Solveur** : le catalogue entier re-résolu de zéro (`--force`, 4 fils) : **1 471 s = 24,5 min** (5 877 s de calcul) pour 65 morceaux et 290 variantes avant la retouche « clavier » ; **1 246 s = 20,8 min** (4 981 s de calcul) avec la règle d'appui minimal (voir plus bas). Plafond du lot : 30 min. Les nouveautés seules : ≈ 4 min.

## `measure:jump` (120 dates, `npm run measure:jump -w @cdj/jump-sim`, après la retouche « clavier »)
Globalement : **58,6 %** de tirages validés (71,3 % des composés ; 63,6 % avant la retouche), **secours 0**, 3 jours sur 120 sans tirage valide parmi les 6 premiers, temps de l'auteur 28,04–31,70 s, exigence 443–553 (fenêtre 425–570), génération 122 ms en moyenne (211 ms au pire), rejeu 4,6 ms.

### Par thème (niveaux du jour : le thème de chaque date)

| thème (mécanique) | jours | tirages validés | secours | temps de l'auteur (min · moy · max) | exigence/min (min · moy · max) | part de la mécanique (min · moy · max) | morceaux en commun avec la veille |
|---|---|---|---|---|---|---|---|
| foret (—) | 31 | 65,1 % | 0 | 28,21 · 29,66 · 31,11 s | 468 · 505 · 553 | 0 · 0 · 0 % | 1,13 (max 4) |
| usine (tapis) | 16 | 35,5 % | 0 | 28,32 · 29,52 · 31,70 s | 450 · 502 · 542 | 21 · 30 · 36 % | 0,81 (max 3) |
| glace (glace) | 23 | 58,0 % | 0 | 28,48 · 29,61 · 31,56 s | 449 · 503 · 543 | 20 · 29 · 40 % | 1,13 (max 3) |
| nuit (—) | 27 | 61,7 % | 0 | 28,04 · 29,71 · 31,10 s | 443 · 513 · 548 | 0 · 0 · 0 % | 1,00 (max 4) |
| neon (—) | 23 | 65,2 % | 0 | 28,19 · 29,28 · 31,11 s | 481 · 511 · 543 | 0 · 0 · 0 % | 0,87 (max 3) |

### Thème forcé (12 dates × 5 thèmes, du 2027-08-12 au 2027-08-23)

| thème forcé | niveaux | tirages validés | des composés | secours | temps de l'auteur (min · moy · max) | exigence/min (moy) | part de la mécanique (moy) | génération (moy · max) |
|---|---|---|---|---|---|---|---|---|
| foret | 12 | 65,3 % | 72,3 % | 0 | 28,16 · 29,43 · 30,15 s | 518 | 0 % | 128 · 168 ms |
| usine | 12 | 44,2 % | 79,1 % | 0 | 28,08 · 29,40 · 30,66 s | 510 | 27 % | 97 · 145 ms |
| glace | 12 | 54,2 % | 72,2 % | 0 | 28,46 · 29,60 · 30,41 s | 500 | 29 % | 86 · 137 ms |
| nuit | 12 | 65,3 % | 72,3 % | 0 | 28,16 · 29,43 · 30,15 s | 518 | 0 % | 127 · 198 ms |
| neon | 12 | 65,3 % | 72,3 % | 0 | 28,16 · 29,43 · 30,15 s | 518 | 0 % | 125 · 175 ms |

Les trois thèmes sans mécanique donnent la même ligne en « thème forcé » (même composition : voulu). Usine est le thème le plus contraint (35 % de tirages validés sur ses 16 jours) : presque tous ses refus sont des **impasses de composition** (respiration imposée, quota de tapis), jamais un niveau invalide ; le niveau est trouvé au tirage suivant (jusqu'à 40) et le secours n'a pas servi.

## Jours figés et versions
- `JUMP_GENERATOR_VERSION` **7** (6 pour le thème, 7 pour la retouche « clavier ») ; `JUMP_SIM_VERSION` **3** (inchangée) ; golden du personnage, de l'essai et des rediffusions **inchangés** ; golden de DailyTrack inchangés (aucun fichier de DailyTrack touché).
- Golden du niveau du jour régénérés. **Au g6 seul**, les dates en thème sans mécanique gardaient les mêmes morceaux et la même empreinte de niveau ; **au g7** (catalogue re-résolu, repos recalculé, fenêtre d'exigence 425–570) tous les niveaux changent : la règle « figer avant de changer de version » s'applique (rien à figer de plus : voir ci-dessous).
- **Jours figés** : `main` n'a pas bougé depuis le début du lot ; `npm run freeze:days -w @cdj/jump -- demain` lancé **dans un worktree sur `main`** : 0 fichier écrit (le 16 et le 17 octobre sont déjà figés en g4 et se relisent). Test `apps/jump/test/figes.test.ts` : chaque fichier de `public/levels/` se recharge et se rejoue avec le nouveau code.

## Retouche : jouable au clavier (piste 1)
**Le problème** (retour de Nathan sur un pont friable sous des scies basses) : la règle de jouabilité du lot 8c décale les changements de commande de ±3 pas, mais ne dit pas **combien de temps un doigt tient ou lâche une touche**. Or la hauteur du saut dépend de la durée de l'appui (réglages par défaut) :

| appui | 1 pas (8 ms) | 3 pas (25 ms) | 5 pas (42 ms) | 8 pas (67 ms) | 12 pas (100 ms) |
|---|---|---|---|---|---|
| hauteur | 0,98 tuile | 1,36 | 1,71 | 2,22 | 2,82 |

Une pression de touche dure 60 à 100 ms (2 à 2,8 tuiles) : un passage qui demande un « petit saut » de 1,3 tuile est infaisable. **Mesuré sur le catalogue** : sur 580 solutions, **81 avaient un appui d'un seul pas, 192 (33 %) un appui de moins de 5 pas, 118 un relâchement d'un seul pas entre deux appuis**.

**La règle** (`modules.ts`, constantes nommées) : `PRESS_MIN` = **5 pas** (42 ms : un appui franc ; le plus petit saut exigible fait 1,71 tuile) et `RELEASE_MIN` = **3 pas** (25 ms entre deux appuis). `pressProblems(commandes)` refuse toute solution qui ne les tient pas : `moduleSpan` (donc le solveur, les tests, la preuve) la rejette ; `ModuleSolution.press` donne l'appui le plus court de chaque solution stockée. `EXIGENCE_VERSION` 4.
- **Solveur** : la recherche en faisceau interdit les suites qui coupent un appui avant `PRESS_MIN` ou rappuient avant `RELEASE_MIN` (`beam.ts`, `pressMin`, `releaseMin`) ; tout candidat du durcissement passe par `moduleSpan`.
- **Mesure d'exigence** : la gigue ne fabrique plus d'appui d'un pas : après le décalage, un appui trop court est **prolongé** et un second appui trop proche **retardé** (`humanized`, `tools/exigence.ts`). Un passage qui demandait un geste inhumain échoue donc à la gigue et est refusé.
- **Résultat** : sur les 535 solutions qui sautent, **le plus court appui est de 5 pas** (aucune sous la règle ; test `clavier.test.ts` sur tout le catalogue, et sur 3 000 gigues).

**Ce qu'il a fallu adoucir ou retirer** (le solveur ne trouvait plus de solution à ±3 pas ≥ 50 % aux deux entrées) :
- **adoucis** : `grande-scie` (scies relevées d'une rangée : 3 tuiles de dégagement au lieu de 2), `scies-jumelles`, `escalier-scies`, `scie-sol`, `tapis-relais` (cycles des scies), `demi-tour` (écart), `cheminee-vide`, `tunnel` (variante de respiration) ;
- **retirés** (leurs passages exigeaient des appuis de 1 à 3 pas) : **`pont-patrouille`** (le pont de la capture : trop de micro-sauts sous des scies basses ; l'élan échouait à 0–13 %, même avec des trous plus larges et des scies relevées), **`demi-tour-ressorts`** (échec en élan à toute variante), **`toboggan`** (une seule variante tenait). Le catalogue compte **62 morceaux, 279 variantes**. Les trois restent dans les niveaux figés du 16 et 17 octobre (g4), qui se rejouent toujours.
- **Repos** : le sel des groupes passe à `repos19541:` (les groupes n'étaient plus de la même taille à un près) ; table des morceaux d'une mécanique recalculée ; niveaux de secours recalculés pour les trois cas (sans mécanique, usine, glace).
- **Fenêtre d'exigence** : 445–570 → **425–570** (la queue basse s'est allongée : 133 tirages de 603 sous 445, moyenne 403, contre 6 tirages hauts ; médiane inchangée à 505) : tirages validés 54,7 % → 58,6 %, secours 0.
- **Non couvert** : la **manette** a la même contrainte (appui par image, ≥ 2 pas) ; le tactile aussi ; la règle les couvre toutes (appui minimal 42 ms). Un joueur plus rapide que 42 ms n'est pas gêné ; un joueur qui tient 100 ms fait des sauts de 2,8 tuiles : les passages à plafond bas sont donc ceux d'une hauteur de saut **choisie** de 1,7 à 2,8 tuiles, ce que la gigue (appui prolongé) mesure.

## Vérifié / non vérifié / décisions pour Nathan
**Vérifié** : `tsc -b` propre ; Vitest `jump-sim`, `core`, `apps/jump` (644 tests) ; e2e Chromium de `apps/jump` (100 verts, 4 outils de mesure ou de capture sautés hors variable d'environnement) dont usine et glace en `&solution`, un morceau tapis et un morceau glace au doigt en paysage, thème forcé sans écriture dans l'historique ; captures du tapis et de la glace relues.
**Non vérifié** : Firefox et WebKit en local (la CI tranche) ; un vrai téléphone ; l'écoute réelle du ronronnement et du crissement (logique testée seulement) ; la perf sur vrai GPU ; la CI après rebase (à confirmer sur la PR).

**Décisions pour Nathan**
1. **Le 17 octobre est un jour de glace sans glace** : il est déjà figé (g4) et le reste ; son thème naturel est « glace » mais son niveau n'a pas de mécanique.
2. **La glace est peu exigeante** : mesurée par le solveur et la gigue, plusieurs morceaux de glace sont à l'exigence 1 (l'inertie se maîtrise bien en courant droit ; l'air permet de retenir son élan). Le budget d'exigence du jour reste tenu (510 en moyenne). Pour durcir : plafonds à pics (`+plafond:pics` fait passer `glace-freinage` à 4), plaques plus petites, `iceDecel` plus bas.
3. **Un tapis contraire se contourne en sautant** (la vitesse en l'air n'est plus freinée) : voulu, c'est le « saut de tapis », mais l'auteur le fait ; un plafond bas le limiterait.
4. **Un thème forcé neutre** (forêt / nuit / néon) donne le même niveau avec un autre identifiant ; seul l'aspect change.
5. **Réglages absents des défauts** : choix pour garder le golden du personnage intact ; si tu préfères les ranger dans `DEFAULT_JUMP_PARAMS`, le golden `params` changera (aucune trajectoire).
6. **Trois morceaux retirés** (`pont-patrouille`, `demi-tour-ressorts`, `toboggan`) : si tu tiens à l'un d'eux, il faut le redessiner avec plus de dégagement (et non adoucir la règle).
7. **`PRESS_MIN` = 5 pas (42 ms)** est un choix : à 4 pas (33 ms) le plus petit saut tombe à 1,54 tuile et plus de passages à plafond bas seraient permis, mais un appui aussi bref est déjà difficile à répéter ; à 6 pas (50 ms), 1,89 tuile, davantage de morceaux seraient retirés. À régler d'après tes essais au clavier.
