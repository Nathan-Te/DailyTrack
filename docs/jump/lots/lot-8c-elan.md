# Lot 8c — Adoption de l'élan (DailyJump)

## À tester
Aperçu de la branche `ccr-9cb88ba0-62npko` :
- **Niveau du jour** : `https://nathan-te.github.io/DailyTrack/b/ccr-9cb88ba0-62npko/jump/`. Tenir la droite sur le plat : après 0,35 s la vitesse monte jusqu'à 18 tuiles/s. Pendant ce temps, un son discret qui monte ; en élan plein, la traînée se marque. Lâcher, faire demi-tour ou toucher un mur coupe l'élan, avec un souffle léger. L'élan passe d'un morceau à l'autre.
- **Trois dates avec la solution de l'auteur** :
  - `…/jump/?seed=2026-10-16&solution` (29,29 s) ;
  - `…/jump/?seed=2026-10-25&solution` (31,15 s) ;
  - `…/jump/?seed=2026-11-03&solution` (29,55 s).
  
  Ajouter `&debug` pour voir les limites des morceaux, l'entrée de chacun et sa note d'exigence.
- **Morceaux `elan`** : `…/jump/?modules`, menu « Étiquette » → « élan » (6 morceaux). Chacun se joue de trois façons : « À l'arrêt », « À la course », « En élan plein ».
  - `grand-saut` : un trou que seul l'élan plein franchit ;
  - `elan-plafond` : de petits sauts sous un plafond bas, sans jamais lâcher la droite ;
  - `elan-mur` : un mur qu'on enjambe sans le toucher, sinon l'élan est perdu ;
  - `elan-friable` : un sol qui s'effondre derrière soi ;
  - `elan-scie` : une scie à dépasser de vitesse ;
  - `elan-traversee` : un enchaînement long.
  
  Exemple d'adresse : `…/jump/?module=grand-saut&entree=plein&solution`.

## Règle des raccords : deux états canoniques
```
   palier de sortie du morceau n = palier d'entrée du morceau n+1
   ┌────────────┐
 ──┤ ▓▓  ▓▓     │──►  le centre franchit le bord droit, au sol, rien en cours, et :
   └────────────┘
     course      : vx = runSpeed (375)    compteur d'élan = COURSE_SPRINT (1)
     élan plein  : vx = sprintSpeed (614) compteur d'élan = sprintDelay (42, borné)
   → morceau n+1 : on joue la solution stockée pour CETTE entrée, au pas suivant
```
- **Pourquoi deux états seulement.** Le compteur est borné à `sprintDelay` : deux élans pleins sont donc exactement le même état. La course est l'état atteint deux pas après un bref relâchement : il suffit d'un pas sans direction (`tap`, nouvelle action du solveur).
  - Deux personnages dans le même état ne diffèrent que par leur position. Le raccord reste exact, comme au lot 6.
  - On ne remet pas l'élan à zéro sur chaque palier : on garderait le raccord exact, mais l'élan ne passerait plus les coutures.
  - Garder la vitesse et le compteur quelconques aurait multiplié les entrées à résoudre.
- **Trois entrées par morceau** : arrêt, course, plein (`MODULE_ENTRIES`).
  - Chaque solution sort dans l'un des deux états (`ModuleSolution.exit`).
  - Le solveur garde la plus rapide, durcie à 2 % près.
  - L'assemblage joue ensuite la solution de l'entrée qui correspond à cette sortie (`compose` le prévoit, le rejeu le vérifie).
  - Le raccord doit réussir au moins 90 % du temps sur 25 positions dans un pas, **pour chaque entrée lancée**.
- **Paliers** : toujours 2 tuiles. Aucune mesure n'a demandé d'en passer à 3 : 0,08 s de course à vide par raccord en moyenne, 0,21 s au plus.

## Catalogue : critère de banalité, morceaux repris ou retirés
- **Le critère de banalité** est mesuré sur les solutions stockées (`tools/banal.ts`). Une variante est banale dans deux cas :
  - A : une de ses solutions lancées tient la droite sans presque sauter (au plus 1 appui, droite seule au moins 90 % du temps) et a une exigence ≤ 2 ;
  - B : le morceau est étiqueté `precision` et la variante tombe à une exigence de 1.
  
  Avant le nettoyage, 46 variantes l'étaient ; il n'en reste plus aucune, ce que vérifie un test.
- **Retirés**, car toutes leurs variantes étaient au pas près ou avaient un raccord sous 90 % une fois l'élan adopté :
  - `plongeon`, `ressort-scie`, `ressorts-trous` (aussi banal en course), `escalier-scies`, `cheminee-quinconce`, `demi-tour-ressorts` ;
  - `escalier` : une respiration qui montait à 5 d'exigence.
- **Repris** :
  - `saut-long` : deux trous coupés d'une île, sur une piste trop courte pour l'élan plein. Il perd l'ancienne clé `elan: oui` et reste `precision`.
  - `descente` et `descente-scies` : des bosses ;
  - `ressorts-escalier` : des corniches étroites ;
  - `scie-ronde` : des cycles de 100 pas et du dénivelé ;
  - `tunnel-scies` : des cycles de 720 et 840 pas ;
  - `toboggan`, `ressort-mur` et `piliers` (un ressort ajouté).
  
  Ailleurs, les variantes au pas près ou banales ont été retirées.
- **Six morceaux `elan`**, avec leur propre limite de plat : `ELAN_FLAT_MAX` = 14 tuiles. Il faut 14,6 tuiles pour atteindre l'élan plein depuis l'arrêt, 13,5 depuis la course.
- **Bilan** : 51 morceaux et 233 variantes avant le lot, **50 morceaux et 200 variantes** après (tous utilisables). `EXIGENCE_VERSION` passe à 3.

## Avant / après (120 dates, `measure:jump` et `measure:elan`)
| Mesure | Lot 7b (g4, sans élan) | Lot 8c (g5, avec l'élan) |
|---|---|---|
| Temps de l'auteur : min · moyenne · max | 28,18 · 29,63 · 31,44 s | 28,01 · 29,56 · 31,74 s |
| Mêmes niveaux g5 joués sans élan (estimation par morceau) | — | 30,04 · 35,44 · 42,12 s (**écart moyen 5,87 s**, de 2,03 à 11,98 s) |
| Part du temps en élan (au-delà de la course) · en élan plein | 0 % · 0 % | 57,5 % · 37,7 % |
| Coutures franchies en élan plein | 0 | 6,15 par niveau (53 % des coutures) |
| Course à vide aux raccords (part du temps de l'auteur) | 4,1 % (max 5,8 %) | 3,0 % (max 4,8 %) |
| Plus longue course au sol sans saut : moyenne · max | — | 1,19 s · 1,58 s (cible ≤ 1,2 · ≤ 2 s) |
| Tirages validés · secours | 61,8 % · 0 | **66,4 %** · **0** |
| Morceaux en commun d'un jour au suivant | 0,96 (max 4) | 0,87 (max 3) |

**Médailles** : les facteurs sont inchangés (or ×1,10, argent ×1,30, bronze ×1,60). Avec l'élan, la même suite de morceaux tient en 5,9 s de moins ; pour tenir les 30 s, le générateur prend donc plus de morceaux (12,5 par niveau en moyenne, jusqu'à 15).

**Réglages recalés**, chacun justifié par une mesure :
- `MAX_PIECES` 13 → 15 ;
- fenêtre d'exigence 445–540 → **600–740** ;
- `PROFILE_END` 36 → 34, `EXIGENCE_STEER` 100 → 60 ;
- `FORCE_ELAN_AT` = 450 ‰ ;
- `SHARED_WEIGHT` = 2 : sans lui, 1,56 morceau en commun d'un jour au suivant ;
- `REST_SALT` `repos17912:` ;
- durées : 0,9 s au moins par morceau (`MODULE_MIN_TICKS`), enchaînements longs de 3 à 8 s (`LONG_MIN_TICKS`) ;
- `LONGEST_RUN_MAX` inchangé.

## Sortie de `measure:jump` (extrait) et temps du solveur
```
validés 478/720 (66,4 %) · secours 0 · auteur 28,01 / 29,56 / 31,74 s · morceaux 10 / 12,5 / 15
exigence par minute 623 / 674,9 / 717 (fenêtre 600–740) · tiers 20,2 → 22,8 → 36,6
élan : 57,5 % du temps · plein 37,7 % · coutures en plein 6,15 / niveau · entrées arrêt 120 · course 645 · plein 738
génération 162,7 ms en moyenne (289,1 ms au pire) · rejeu de la preuve 6,17 ms
```
**Solveur** (tout re-résoudre, `measure:modules -- --solveur`, 4 fils) : **1208,7 s (20,1 min)**, 4828 s de calcul, sous le plafond de 30 min. Avant le lot : 968,7 s pour 233 variantes à 2 entrées ; maintenant 200 variantes à 3 entrées, avec les replis. La toute première résolution, sur 55 morceaux avant le nettoyage, prenait 1780 s.
- Essai : 21,625 s → 18,483 s.
- Galerie des dangers : 12,675 s → 8,858 s.
- Les mémoires v3 sont purgées par le mécanisme existant (`JUMP_SIM_VERSION` 4, testé).

## Vérifié / non vérifié / décisions pour Nathan
- **Vérifié** :
  - `npm test` : jump-sim 290 tests, apps/jump 185 tests, golden de DailyTrack inchangés ;
  - typecheck ;
  - e2e DailyJump en Chromium, en local ;
  - e2e : la solution du jour finit au temps de l'auteur, le morceau `grand-saut` en élan plein au temps de sa solution, la galerie filtre `elan`, le niveau du jour se joue au doigt en paysage ;
  - la CI (Chromium, Firefox, WebKit) se lit sur la PR.
- **Non vérifié** :
  - la sensation au vrai doigt, sur un vrai téléphone ;
  - le niveau du son de l'élan sur haut-parleur de téléphone ;
  - le temps « sans élan », seulement estimé : 2,1 morceaux par niveau n'ont pas de solution sans élan et comptent pour leur durée avec l'élan, donc l'écart est sous-estimé.
- **Décisions pour Nathan** :
  1. Les deux replis du solveur, *robuste au raccord* et *calme* (qui ne prend jamais l'élan), deviennent la référence quand la plus rapide échoue. Faut-il les garder ?
  2. `MODULE_MIN_TICKS` (1 s → 0,9 s) et `LONG_MIN_TICKS` (5 s → 3 s) ont été abaissés : l'élan raccourcit tout.
  3. Les 7 morceaux retirés : faut-il les redessiner pour l'élan, ou les abandonner ?
  4. `LAUNCH_TILES` passe de 5 à 3 dans la galerie : 5 tuiles enclenchaient l'élan avant le morceau.
  5. `SHARED_WEIGHT` = 2 : un nouveau poids, qui favorise les morceaux propres au jour.
  6. `ressort-mur` et `saut-long` demandent l'élan pour certaines variantes, sans l'étiquette `elan`.
  7. La démo de l'essai (`?carnage=demo`) ne contient presque plus que des abandons, et plus aucune arrivée après des morts : le test passe maintenant à 32 essais. Le test du plafond des vies faisait 40 passes de cette démo : 1 280 essais rejoués, 5,5 s en CI pour une limite de 5 s. Il revient à 640 essais, son volume d'avant le lot (20 passes de 32), avec les mêmes assertions. Faut-il refaire la démo ?
