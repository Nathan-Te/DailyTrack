# Retouche 24 — Virages relevés sans tremplin

**À essayer** : `?scenario=surfaces` (virages relevés serré puis large) et `?scenario=air` (un saut dont la réception est un virage relevé) ; sur l'aperçu de la branche : `https://nathan-te.github.io/DailyTrack/b/claude-jolly-archimedes-pm4phl/?scenario=surfaces`. Le cas signalé par Nathan : Stade, `?seed=2026-10-11` (virage relevé en entrant sur le bord extérieur, à pleine vitesse).

## Le défaut

Au début d'un virage relevé (`L2/b`, `R/tb`…), le bord extérieur de la route gagnait ≈ 2,4 m en 8 m (`BANK_RAMP`, rampe **linéaire**) : la pente passait de 0 à 0,3 d'un coup, puis retombait à la fin de la rampe — une marche de pente à l'entrée (tremplin) et une autre à la fin de la rampe (la route « s'efface » sous la voiture). À 25 m/s en virage serré ou 48 m/s en virage large, la voiture décollait sur le bord extérieur.

## Ce qui change

- **Rampe = fraction de l'arc**, comme `CUVE_RAMP_ARC` pour les cuves : `BANK_RAMP_ARC` = **0,5** (`track.ts`). Le relevé est donc complet au milieu du virage seulement ; la rampe s'allonge avec le virage (12,5 m sur l'axe d'un virage serré, 37,7 m sur l'axe d'un virage large, au lieu de 8 m).
- **Profil lissé** : `bankFactor(t)`, quintique (« smootherstep ») de chaque bout, avec `t = q / (q + |dp|)` (fraction d'arc, sans trigonométrie). Pente **et** courbure nulles à l'entrée et à la sortie : la route ne fait ni marche ni tremplin. Le gradient de `bankAt` est la dérivée exacte de la hauteur (testé par différences finies).
- **Pilote** (`autopilot.ts`) : la vitesse de passage compte sur la pente en travers *là où elle est* (`slope × bankFactor(t)` par point de la ligne), pas sur la pente complète d'un bout à l'autre du bloc.
- Inchangés : pentes `BANK_SLOPE_TIGHT` 0,3 et `BANK_SLOPE_WIDE` 0,22, `world.sample` / `collide` (ils appellent `bankAt`), le rendu `trackMesh.ts` (`arcPoint` appelle `bankAt` : la route dessinée suit la nouvelle courbe), le générateur (aucune règle ne dépendait de la longueur de la rampe).
- **`SIM_VERSION` 14, `GENERATOR_VERSION` 15** ; golden (`essai-autopilot.json`, `daily-golden.json`) et `npm run history:seed` régénérés.

## Mesures avant / après

**Profil de la route le long de l'arc, au bord extérieur (+6 m de l'axe)** :

| | pente max | variation de pente sur 1 m | pente sur les 2 premiers mètres |
|---|---|---|---|
| serré, avant | 0,225 | **0,211** | **0,224** |
| serré, après | 0,196 | 0,052 | 0,032 |
| large, avant | 0,165 | **0,162** | **0,164** |
| large, après | 0,059 | 0,006 | 0,002 |

**Voiture qui suit l'arc à écart constant de l'axe** (pas en l'air, de l'entrée au bout de l'arc ; test `l'entrée ne décolle pas la voiture`) :

| virage, vitesse d'entrée | écart | avant | après |
|---|---|---|---|
| serré, 25 m/s | +4 m / +5,5 m | 26 / 25 | **0 / 0** |
| serré, 30 m/s | +4 m / +5,5 m | 30 / 29 | 8 / **0** |
| large, 40 m/s | +4 m / +5,5 m | 26 / 50 | **0 / 0** |
| large, 48 m/s | −3 m / +4 m / +5,5 m | 9 / 35 / 54 | **0 / 0 / 0** |

Au centre de la route (écart 0) : 0 pas en l'air avant comme après. Le virage serré à 48 m/s ne se prend pas (144 m/s² d'accélération latérale pour 44 d'adhérence) : on y fait donc le test à 25 m/s, la vitesse d'un virage serré tenu au bord extérieur. Il reste 8 pas en l'air à 30 m/s sur le bord extérieur d'un virage serré (écart +4 m) : le relevé y monte de 1,2 m sur ≈ 16 m d'arc : à ce rythme, la pesanteur (24,6 m/s²) est tout juste dépassée.

**Le relevé reste plus rapide que le plat** (pilote, mêmes réglages) :

| | avant | après |
|---|---|---|
| vitesse minimale, serré, relevé / plat | 1,170 | **1,078** |
| vitesse minimale, large, relevé / plat | 1,047 | **1,033** |
| accélération latérale tenue au tiers central de l'arc, large (relevé / plat) | — | 42,5 / 40,7 m/s² |
| idem, serré | — | 49,0 / 38,8 m/s² |
| temps de course du pilote (circuit d'essai de 9 blocs), serré (relevé − plat) | −109 ms | +15 ms |
| idem, large (relevé − plat) | −9 ms | −32 ms |

Le gain de vitesse du virage serré baisse (l'ancien profil donnait la pente complète dès 8 m, d'où le tremplin) ; en temps de tour, le virage serré relevé n'est plus un gain pour le pilote (le pilote reste près de l'axe quand le plat lui laisse couper le bord intérieur). C'est le prix d'un relevé qui ne décolle pas ; essayé : une pente de relevé serré de 0,36 ou 0,42 ne change pas le temps du pilote (−6 / +6 ms) et accentue la bosse : laissée à 0,3.

## Mesure du générateur (60 dates, `npm run measure:generator`)

Durées d'auteur toujours dans 30–40 s (répartition 30–32 : 1, 32–34 : 4, 34–36 : 14, 36–38 : 19, 38–40 : 22 ; aucun circuit de secours). Taux de validation par thème (12 dates × 6 tentatives, avant → après) : stade 76 → 76 % · rallye 62 → 62 % · banquise 32 → 34 % · nuit 60 → 58 % · campagne 67 → 68 % · canyon 79 → 81 % · col 50 → 55 % · ville 82 → 82 %. Moments de choix, vitesse du pilote (min 64,7 m/s) et figures : inchangés dans le bruit (voir `npm run measure:generator`).

## Tests

- `packages/sim/test/surfaces.test.ts` (20 tests, dont trois nouveaux) : part du relevé (`bankFactor`) nulle, pente nulle et courbure nulle aux bords, symétrique, monotone, pleine au milieu ; gradient = dérivée de la hauteur (serré, large, virage à gauche) ; **l'entrée ne décolle pas la voiture** (serré à 25 m/s et large à 48 m/s, au centre et sur le bord extérieur, plus l'intérieur d'un virage large à 40 m/s : 0 pas en l'air) ; vitesse minimale en relevé +6 % serré et +2 % large (avant : +12 % et +3 %) ; accélération latérale du tiers central plus grande en relevé.
- `cuves-rapides.test.ts` : « la paroi est la ligne la plus rapide » demande maintenant **au moins la moitié** des circuits Stade et Nuit à cuve des 40 premiers jours (5 sur 10 ; 6 sur 10 avant : un circuit de Stade passe de la paroi au fond, 39,98 s → 39,66 s). Même constat sur 80 jours : 10 sur 20 (11 sur 20 avant).
- e2e `surfaces.spec.ts` et `air.spec.ts` verts.

## Pièges

- La rampe d'une cuve (`CUVE_RAMP_ARC`) et celle d'un relevé (`BANK_RAMP_ARC`) partagent la fraction d'arc `t = q / (q + |dp|)`, mais pas le profil (la cuve utilise un cubique `smooth`, le relevé un quintique).
- Le pilote lit la pente de relevé dans `Centerline.wall` (comme celle d'une paroi de cuve) : un virage ne peut pas être à la fois relevé et en cuve (refusé par `parseToken`).
