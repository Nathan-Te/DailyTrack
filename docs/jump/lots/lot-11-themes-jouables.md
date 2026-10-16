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
| `glace-cheminee` | glace | glace mural vertical | 3 | 3–5 | 2.6–2.6 s | Monter une cheminée en sautant d'un mur à l'autre, puis franchir le trou du sommet pour se poser sur une corniche de glace : on la quitte aussi vite qu'on y arrive. |
| `glace-corniches` | glace | glace precision | 4 | 1–1 | 1.9–2.0 s | Dévaler des corniches glacées dont chacune porte un pic là où l'on glisse : l'élan emporte, il faut sauter au bon endroit. |
| `glace-freinage` | glace | glace precision | 5 | 1–4 | 2.1–2.4 s | Se poser sur une petite plaque de glace au-delà d'un trou, sans glisser jusque dans les pics : retenir son élan en l'air, puis repartir. |
| `glace-mur` | glace | glace mural vertical | 4 | 1–4 | 2.7–2.9 s | Foncer sur la glace jusqu'au pied d'un grand mur sans pouvoir s'arrêter, puis le remonter saut mural après saut mural. |
| `glace-promenade` | glace | glace respiration | 4 | 1–2 | 2.5–3.8 s | Glisser sur une longue piste de glace en sautant de petites marches : l'élan se garde tout seul, il suffit de sauter à temps. |
| `glace-relais` | glace | glace precision mural · long | 3 | 1–4 | 5.4–5.7 s | Dévaler des corniches de glace, se poser sur une plaque avant les pics, puis foncer sur la glace jusqu'à un grand mur à remonter. |
| `glace-saut-haut` | glace | glace precision | 5 | 1–1 | 1.9–2.1 s | Courir sur la glace pour prendre tout son élan, puis franchir un trou jusqu'à une corniche plus haute : l'élan ne se rattrape pas. |
| `tapis-alternes` | usine | tapis precision | 4 | 1–4 | 1.9–3.1 s | Franchir des tapis qui se croisent au-dessus des pics : chaque plateforme tire dans son sens, sauter de l'une à l'autre en gardant le rythme. |
| `tapis-contraire` | usine | tapis scie | 4 | 2–5 | 2.0–2.4 s | Remonter un tapis roulant qui recule en passant sous des scies qui descendent à tour de rôle : avancer au bon moment, sans se laisser ramener. |
| `tapis-escalier` | usine | tapis precision vertical | 4 | 1–4 | 1.9–2.0 s | Gravir un escalier dont chaque marche est un tapis qui recule : sauter de marche en marche avant d'être ramené en arrière. |
| `tapis-lance` | usine | tapis precision | 4 | 1–3 | 1.7–2.1 s | Un tapis qui lance un saut trop long à pied : sauter au bord et retenir son élan pour se poser sur la plateforme avant les pics. |
| `tapis-mur` | usine | tapis mural vertical | 4 | 1–4 | 2.4–2.8 s | Se laisser emporter par un tapis jusqu'au pied d'un mur, puis le remonter saut mural après saut mural sans retomber sur le tapis. |
| `tapis-relais` | usine | tapis scie precision · long | 3 | 5–5 | 5.7–5.9 s | Remonter un long tapis contraire sous des scies, franchir des tapis croisés au-dessus des pics, puis se faire lancer au-dessus d'un trou : garder son élan, puis le retenir. |
| `tapis-respiration` | usine | tapis respiration | 2 | 2–2 | 2.4–3.0 s | Se laisser porter par un tapis rapide en sautant de petites marches : le tapis fait le travail, il suffit de garder le rythme. |

Variantes `+surface` de morceaux ordinaires : `plafond-pics` v4 (glace), `scie-ronde` v4 (glace) et v5 (tapis droite), `plongeon` v3 (glace), v4 (tapis gauche), v5 (tapis droite). Dans chaque mécanique : 7 morceaux, **un enchaînement long** (5,4–5,9 s) et **une respiration** (exigence ≤ 2 partout, au moins 3 sauts). Règles inchangées : ±3 pas ≥ 50 %, raccord ≥ 90 %, plats, familles, 6 variantes au plus. Variantes écartées en route : `glace-freinage` (plafond sans solution), `plafond-pics` tapis gauche (au pas près).

**Solveur** : le catalogue entier (65 morceaux, 290 variantes) re-résolu de zéro (`--force`, 4 fils) : **1 471 s = 24,5 min** (5 877 s de calcul), sans aucune variante sans solution ni au pas près ; plafond du lot : 30 min. Les nouveautés seules : ≈ 4 min (238 s pour 124 solutions). Les solutions des 231 variantes d'avant sont **inchangées** (comparées une à une).

## `measure:jump` (120 dates, `npm run measure:jump -w @cdj/jump-sim`)
Globalement : 63,6 % de tirages validés (73,6 % des composés), **secours 0**, temps de l'auteur 28,06–31,14 s, exigence 463–545 (fenêtre 445–570), génération 144 ms en moyenne (252 ms au pire), rejeu 5 ms.

### Par thème (niveaux du jour : le thème de chaque date)

| thème (mécanique) | jours | tirages validés | secours | temps de l'auteur (min · moy · max) | exigence/min (min · moy · max) | part de la mécanique (min · moy · max) | morceaux en commun avec la veille |
|---|---|---|---|---|---|---|---|
| foret (—) | 31 | 61,3 % | 0 | 28,57 · 29,68 · 31,14 s | 469 · 509 · 544 | 0 · 0 · 0 % | 0,73 (max 3) |
| usine (tapis) | 16 | 64,6 % | 0 | 28,27 · 29,76 · 30,44 s | 475 · 511 · 545 | 21 · 26 · 38 % | 0,50 (max 1) |
| glace (glace) | 23 | 60,9 % | 0 | 28,06 · 29,62 · 31,09 s | 482 · 510 · 535 | 20 · 27 · 37 % | 0,83 (max 3) |
| nuit (—) | 27 | 64,8 % | 0 | 28,31 · 29,57 · 31,03 s | 463 · 505 · 529 | 0 · 0 · 0 % | 0,59 (max 3) |
| neon (—) | 23 | 67,4 % | 0 | 28,40 · 29,76 · 30,86 s | 481 · 513 · 544 | 0 · 0 · 0 % | 0,74 (max 3) |

### Thème forcé (12 dates × 5 thèmes, du 2027-08-12 au 2027-08-23)

| thème forcé | niveaux | tirages validés | des composés | secours | temps de l'auteur (min · moy · max) | exigence/min (moy) | part de la mécanique (moy) | génération (moy · max) |
|---|---|---|---|---|---|---|---|---|
| foret | 12 | 72,2 % | 83,9 % | 0 | 28,23 · 29,34 · 30,97 s | 507 | 0 % | 151 · 207 ms |
| usine | 12 | 54,2 % | 76,5 % | 0 | 28,32 · 29,56 · 31,98 s | 509 | 28 % | 124 · 228 ms |
| glace | 12 | 66,7 % | 76,2 % | 0 | 28,23 · 29,77 · 31,21 s | 510 | 27 % | 125 · 158 ms |
| nuit | 12 | 72,2 % | 83,9 % | 0 | 28,23 · 29,34 · 30,97 s | 507 | 0 % | 139 · 185 ms |
| neon | 12 | 72,2 % | 83,9 % | 0 | 28,23 · 29,34 · 30,97 s | 507 | 0 % | 127 · 178 ms |

Les trois thèmes sans mécanique donnent la même ligne en « thème forcé » (même composition : voulu).

## Jours figés et versions
- `JUMP_GENERATOR_VERSION` **6** ; `JUMP_SIM_VERSION` **3** (inchangée) ; golden du personnage, de l'essai et des rediffusions **inchangés** ; golden de DailyTrack inchangés (aucun fichier de DailyTrack touché).
- Golden du niveau du jour régénérés : tous les identifiants passent en g6 ; les dates en thème sans mécanique gardent les mêmes morceaux et la même empreinte de niveau ; les dates usine / glace changent (nouveaux morceaux, quota de signature).
- **Jours figés** : `main` n'a pas bougé depuis le début du lot ; `npm run freeze:days -w @cdj/jump -- demain` lancé **dans un worktree sur `main`** : 0 fichier écrit (le 16 et le 17 octobre sont déjà figés en g4 et se relisent). Test `apps/jump/test/figes.test.ts` : chaque fichier de `public/levels/` se recharge et se rejoue avec le nouveau code.

## Vérifié / non vérifié / décisions pour Nathan
**Vérifié** : `tsc -b` propre ; Vitest `jump-sim`, `core`, `apps/jump` (639 tests) ; e2e Chromium de `apps/jump` (100 verts, 4 outils de mesure ou de capture sautés hors variable d'environnement) dont usine et glace en `&solution`, un morceau tapis et un morceau glace au doigt en paysage, thème forcé sans écriture dans l'historique ; captures du tapis et de la glace relues.
**Non vérifié** : Firefox et WebKit en local (la CI tranche) ; un vrai téléphone ; l'écoute réelle du ronronnement et du crissement (logique testée seulement) ; la perf sur vrai GPU ; la CI après rebase (à confirmer sur la PR).

**Décisions pour Nathan**
1. **Le 17 octobre est un jour de glace sans glace** : il est déjà figé (g4) et le reste ; son thème naturel est « glace » mais son niveau n'a pas de mécanique.
2. **La glace est peu exigeante** : mesurée par le solveur et la gigue, plusieurs morceaux de glace sont à l'exigence 1 (l'inertie se maîtrise bien en courant droit ; l'air permet de retenir son élan). Le budget d'exigence du jour reste tenu (510 en moyenne). Pour durcir : plafonds à pics (`+plafond:pics` fait passer `glace-freinage` à 4), plaques plus petites, `iceDecel` plus bas.
3. **Un tapis contraire se contourne en sautant** (la vitesse en l'air n'est plus freinée) : voulu, c'est le « saut de tapis », mais l'auteur le fait ; un plafond bas le limiterait.
4. **Un thème forcé neutre** (forêt / nuit / néon) donne le même niveau avec un autre identifiant ; seul l'aspect change.
5. **Réglages absents des défauts** : choix pour garder le golden du personnage intact ; si tu préfères les ranger dans `DEFAULT_JUMP_PARAMS`, le golden `params` changera (aucune trajectoire).
