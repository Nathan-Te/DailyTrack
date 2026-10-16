# Lot 8c — L'élan essayé puis écarté, et une règle de jouabilité humaine (DailyJump)

## À tester
Aperçu de la branche `ccr-9cb88ba0-62npko` : `https://nathan-te.github.io/DailyTrack/b/ccr-9cb88ba0-62npko/jump/`.
- **Niveau du jour** : la course seule, comme avant le lot. L'élan reste disponible dans `?debug&tune&sprint=1`. Les cartes sont redevenues denses : 10,8 morceaux pour 30 s, contre 12,5 avec l'élan.
- **Trois dates avec la solution de l'auteur** (générateur g5) : `?seed=2026-10-25&solution`, `?seed=2026-11-03&solution`, `?seed=2026-12-25&solution`.
- **Le passage de la capture** : `?module=plafond-pics&variante=1` (plafond hérissé, pics au sol). Toutes ses variantes se jouent maintenant avec une marge humaine ; les deux qui n'en avaient pas (35 % et 23 % de réussite à ±3 pas) sont remplacées.
- **La galerie** `?modules` : les 51 morceaux, chacun à au moins deux variantes, toutes jouables.

## Ce qui s'est passé
1. **L'élan par défaut a été construit puis mesuré** : physique à deux vitesses, deux états canoniques au raccord, trois entrées par morceau, six morceaux `elan`, générateur g5. Les mesures étaient bonnes (66,4 % de tirages validés, élan 57,5 % du temps).
2. **En jeu, Nathan a trouvé deux défauts** :
   - un passage **impossible à un humain**, `plafond-pics` en élan plein (14 à 22 % de réussite à ±3 pas) ;
   - une carte **trop large**, faite pour garder l'élan, donc **moins technique** : 382 colonnes pour 30 s, contre 293 au lot 7 (+31 %).
3. **Décision de Nathan** : l'élan n'est pas adopté par défaut, et une règle « jouable par un humain » s'applique à tout le catalogue. La branche est revenue à la physique de `main` (commit « retour à la physique et au catalogue de main ») : **`JUMP_SIM_VERSION` reste 3**, les rediffusions, mémoires et niveaux figés restent valables.

## La règle de jouabilité humaine
- **Mesure** : la gigue de chaque solution stockée, c'est-à-dire chaque changement de commande décalé au hasard de ±1, ±2 ou ±3 pas, 200 tirages chacun.
- **Avant** : une solution était refusée sous 50 % de réussite à **±1 pas (8 ms)**. Ce seuil laissait passer ce qu'un joueur parfait réussit, pas un humain : `plafond-pics` v2 était à 35 % à ±3 pas.
- **Maintenant** (`HUMAIN_MIN`, `exigenceOf`) : refusée sous **50 % de réussite à ±3 pas (25 ms)**. La note se lit sur ce même taux : 1 au-dessus de 95 %, 2 au-dessus de 85 %, 3 au-dessus de 72 %, 4 au-dessus de 60 %, 5 sinon. `EXIGENCE_VERSION` passe à 3.
- **Effet sur le catalogue de `main`** : 51 variantes refusées sur 233, dont toutes celles de 10 morceaux. Le problème existait donc avant l'élan ; l'élan l'aggravait (27 % des solutions sous la barre, contre 18 %).
- **Le solveur suit la règle** :
  - le durcissement vise ±3 pas (48 tirages, au lieu de 16 à chaque amplitude) ;
  - **repli robuste** : quand la plus rapide n'est pas jouable, le solveur prend la plus sûre jusqu'à 25 % plus lente, qui devient la référence (`fastest`), la plus rapide restant notée (`rapide`). C'est arrivé pour 34 solutions, en moyenne 4,6 % plus lentes (11,2 % au plus).
- **Morceaux adoucis plutôt que retirés** : le catalogue garde ses 51 morceaux, à au moins deux variantes chacun (règle du lot 7).
  - scies plus lentes : `cheminee-scie`, `pont-patrouille`, `ressort-scie`, `escalier-scies` ;
  - fenêtres plus hautes : `lucarne` ;
  - plaques de pics plus courtes : `cheminee-pics` ;
  - puits plus large : `puits-descente` ;
  - trous plus courts : `tremplin`, `demi-tour-ressorts` (avec un appel de deux tuiles avant les ressorts) ;
  - variantes voisines plus douces pour une dizaine d'autres ;
  - respirations `tunnel` et `escalier` adoucies (une respiration reste notée 2 au plus).
  
  Au final : **51 morceaux, 231 variantes**, toutes à ±3 pas ≥ 50 % aux deux entrées.

## Avant / après (120 dates, `npm run measure:jump`)
| Mesure | `main` (g4) | Essai de l'élan (g5, abandonné) | Lot 8c (g5) |
|---|---|---|---|
| Tirages validés · secours | 61,8 % · 0 | 66,4 % · 0 | **63,9 % · 0** |
| Temps de l'auteur : min · moyenne · max | 28,18 · 29,63 · 31,44 s | 28,01 · 29,56 · 31,74 s | 28,01 · 29,70 · 31,65 s |
| Largeur du niveau (colonnes, moyenne) | 292,7 (lot 7) | 382,3 | 289,2 |
| Morceaux par niveau (moyenne) | 10,7 (lot 7) | 12,5 | 10,8 |
| Course à vide aux raccords | 4,1 % | 3,0 % | 4,1 % (max 5,7 %) |
| Plus longue course : moyenne · max | — | 1,19 · 1,58 s | 0,96 · 1,80 s |
| En commun d'un jour au suivant | 0,96 (max 4) | 0,87 (max 3) | 0,92 (max 4) |
| Variantes sous ±3 = 50 % | 51 / 233 | 160 solutions sur 600 | **0 / 231** |

**Fenêtre d'exigence recalée** de 445–540 (centre 492) à **445–570 (centre 505)** : les notes, lues sur ±3, sont un peu plus hautes en moyenne. Sans ce recalage, 57,1 % des tirages étaient validés ; avec, 63,9 %. Les médailles ne changent pas (or ×1,10, argent ×1,30, bronze ×1,60).

## Vérifié / non vérifié / décisions pour Nathan
- **Vérifié** :
  - typecheck ; Vitest DailyJump (523 tests) et `npm test` complet ;
  - golden du personnage, de l'essai et des rediffusions inchangés (même physique) ; golden du niveau du jour régénérés (g5) ;
  - e2e DailyJump en Chromium, en local ; CI sur la PR (Chromium, Firefox, WebKit).
- **Non vérifié** : les passages repris, joués au doigt par un humain. La règle mesure une marge, elle ne remplace pas une partie.
- **Décisions pour Nathan** :
  1. **Jours figés** : le 16 et le 17/10 sont figés en g4, comme l'impose la règle du lot 10 avant tout changement de générateur. Ils contiennent des passages que la règle refuse aujourd'hui :
     - le 16/10 : `pont-patrouille` v0 (8 % de réussite à ±3 pas), `tremplin` v0, `ressorts-trous` v1 ;
     - le 17/10 : `scie-sol` v2, `demi-tour-ressorts` v1.
     
     Les garder (le 16 se joue en ce moment), ou supprimer `apps/jump/public/levels/2026-10-17.json` avant de fusionner pour que demain soit déjà en g5 ?
  2. **Seuil** : 50 % à ±3 pas. Un seuil de 70 % serait plus prudent, mais le catalogue de `main` y perdait 89 variantes sur 233.
  3. **Repli robuste** jusqu'à 25 % plus lent : l'auteur joue alors une route sûre, pas la plus rapide. Un joueur d'élite battra plus nettement l'auteur sur ces 34 solutions.
  4. **L'élan** : le garder seulement dans `?debug&tune`, ou le reprendre plus tard sous une autre forme (bouton dédié, tapis d'élan) dans un lot à part.
