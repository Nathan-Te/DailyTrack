# Lot GR7 — Gravity : plus vite, plus varié, de nouveaux dangers (scies, sols fragiles, lasers)

Branche `claude/beautiful-turing-s2wan4` (imposée par la session, sans « gravity » : la PR porte l'étiquette **`jeu:gravity`**), PR brouillon. Le jeu reste `off`. **Pour les joueurs : rien.** Zones de la passation § 3 seulement ; **aucun fichier partagé touché** hors `docs/plateforme/traductions.md` (régénéré par `npm run traductions`).

## Le seed a été modifié (autorisation de Nathan, dans le prompt du lot)
**Premier commit de la branche, à part** : « seed : dangers et montée en difficulté, sur autorisation de Nathan » — la phrase « La vitesse monte… » de « Le niveau du jour » remplacée, et la section « Les dangers et la montée en difficulté (ajout du 18 novembre 2026) » juste avant « Technique », telle que donnée. **Rien d'autre.** Aucun test ni job ne protège `docs/gravity/seed.md` (les tests de zones ne citent que `docs/seed.md` et les seeds de la plateforme). La règle reste : seul Nathan modifie le seed, ou un lot qu'il y autorise par écrit (écrit dans les deux `CLAUDE.md`).

## Versions : pas de registre d'anciennes versions
Le jeu est `off`, **aucun jour n'est figé** : **générateur 5, simulation 4, robot 4** ; les versions d'avant (générateur 4, simulation 3) sont **retirées** des registres et **le golden de g4 / sim 3 n'est pas gardé** (règle « ce qu'on peut retirer »). `versions.test.ts`, `gravityVersions.test.ts` et `jourFige.test.ts` posent des versions factices 6 / 5.

## 1. La vitesse — comparer en 2 clics
Départ **8 cases/s** (7 avant), croisière de la 1re boucle (12,5) à **549 m** (1 210 avant), **vite au début puis à plat** (parabole, `COURBE_DOUCE`) ; chaque boucle relève la croisière : **+1,5 (14) à la 2e, +1 (15) à la 3e**, en 150 m, sous le plafond absolu de 17. Constantes nommées (`constantes.ts`), `GRAVITY_SIM_VERSION` 4.

| distance | 0 | 100 m | 200 m | 300 m | 400 m | 550 m | 1 000 m | 1 210 m | 1 520 m | 1 700 m | 3 190 m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **avant** (cases/s) | 7,0 | 7,5 | 7,9 | 8,4 | 8,8 | 9,5 | 11,6 | 12,5 | 12,5 | 12,5 | 12,5 |
| **maintenant** | 8,0 | 9,5 | 10,7 | 11,6 | 12,2 | 12,5 | 12,5 | 12,5 | 12,5 → 14 | 14,0 | 15,0 |

- **Ancienne courbe** : `/gravity/?vitesse=7&pente=220&courbe=1` (réglages d'essai existants + `courbe`, nouveau) · **nouvelle** : `/gravity/`. Les deux avec `&robot` pour regarder (la courbe d'avant avec les relèvements de boucle d'aujourd'hui au-delà de 1 520 m).

## 2. Jamais tout droit
- **La Nuit** : le cycle reste calé sur l'arrivée du joueur, mais **les blocs s'éteignent quand il est au milieu d'eux**, après la mise en garde (le clignotement) ; le chemin sûr quitte le sol à temps pour le plafond (qui reste plein, fenêtre ± 4 pas). **Le Néon** : la couleur d'arrivée s'éteint pendant qu'on est dessus.
- **Tests** (`jamais-tout-droit.test.ts`) : un joueur qui ne fait rien **depuis l'entrée du morceau** meurt dans chaque morceau en rythme (12 jours, deux tours), le calage de la Nuit et du Néon, le laboratoire ; le robot passe (franchissabilité).
- **Part passive** (morceaux qui se passent sans rien faire, hors souffles, après le 1er thème, 30 jours) : **49,4 % avant → 1,7 % maintenant** (seuil : 20 %). Les seuls passifs sont **l'avion et l'onde sans danger** (des modes, pas des rythmes).

## 3. La variété (générateur 5)
- **48 motifs au catalogue** (19 avant) : variantes (longueurs, hauteurs, côté du danger, répétitions), **difficulté de 1 à 5**, courbe **en vagues** (3 ou 4 morceaux tendus, un pour souffler avec des pièces ; 4 ou 5 à la 2e boucle) dont le niveau monte avec la distance et la boucle ; nouveaux motifs : couloir de piques aux trous alternés, inversions rapides, faux chemin (gemme sur la trajectoire d'une inversion tardive), escalier entre piques, îlots au-dessus de piques, gouffre, piliers doubles, slalom. **Les motifs d'avant respectent « jamais tout droit »** (le danger est du côté d'arrivée).
- **Anti-répétition** : jamais le même motif à moins de 6 morceaux, jamais la même variante deux fois dans une boucle.

| 30 jours, 2 tours (3 040 m) | avant (g4) | maintenant (g5) |
|---|---|---|
| motifs distincts par boucle | 18,9 / 18,2 | **40,4 / 34,0** (sur 2 boucles : 19 → 47) |
| même motif à moins de 6 morceaux | 64,4 par jour | **0** |
| même variante deux fois dans une boucle | 124,2 par jour (pas de variantes) | **0** |
| part passive, hors souffles | 49,4 % | **1,7 %** |
| difficulté moyenne par thème (1re / 2e boucle) | — | 1,7 · 2,0 · 2,0 · 3,0 · 3,1 / 2,3 · 2,9 · 3,0 · 2,9 · 3,0 |

`npm run variete:gravity -w @cdj/gravity-sim -- --jours 30` (par jour : motifs par boucle, répétitions, part passive, difficulté par thème). **Écart au prompt** : « au moins deux fois plus de motifs distincts » est tenu sur le catalogue (48 / 19) et sur 2 tours (47 / 19), à peine sur la 2e boucle (34 / 18,2 : 1,9 ×, elle compte plus de morceaux de section).

## 4. Les trois dangers (sim + générateur + rendu)
- **Scies** : disque rouge sur un rail, aller-retour, collision ronde (0,4 case), **au milieu de son rail quand on arrive**. **Sols fragiles** : craquent au contact, tombent **54 pas** plus tard, ne reviennent pas (état dans `Partie.fragiles`, immuable, dans le graphe du robot). **Lasers** : trait pâle 60 pas puis rayon 90 pas. **Rouge = danger, bouclier les sauve** ; causes de mort `scie` et `laser`.
- **Introduction par rang** : scies au 2e thème, sols fragiles et lasers au 3e ; **le 1er passage est un morceau `intro` (variante 0, difficulté 1, seul, annoncé « Nouveau : les scies… » une fois par partie)** ; ensuite des motifs à danger, des combinaisons (4e thème), des sections à danger (**scies en avion, lasers en onde**…). Écraseurs, plateformes mobiles et projectiles : **GR8**, la place est laissée (une liste par danger dans `Morceau`).
- **Rendu** : scie qui tourne, fissures à 4 niveaux puis chute, laser (trait pâle qui clignote, rayon, lentilles), **aucune secousse** ; **sons** (règle S2) : scie qui passe près, craquement, effondrement, laser qui se charge puis brûle ; catalogues fr + en, 3 lignes dans « Comment jouer ».

## 5. Le robot et la franchissabilité
- **30 jours (Régression) et 6 jours (PR)** verts ; **120 jours sur 120 sans entorse à 2 280 m**, 30 sur 30 à 3 040 m ; **`preparer:gravity` : 45 jours (17/11 → 31/12), 0 échec, 131 s**. **Budget** : le robot seul **1,6 s par jour** en moyenne, **2,4 s au plus** (3 040 m) pour ≤ 3 s ; `preparer` (preuve + seuils, deux passes) 2,9 s par jour. Seuils recalculés, `GRAVITY_BOT_VERSION` 4.
- **Le laboratoire des motifs** (`npm run labo:gravity`, nouveau) : un motif forcé, vitesse constante de 8 à 17 cases/s, les deux côtés d'arrivée, robot strict + joueur passif. Il a trouvé et fait corriger des défauts avant tout jour (par exemple `ilotsPiques` à 8 cases/s, `escalierPiques`, `special-foret` du plafond…).

## Liens de recette (jeu `off` : avec la clé d'aperçu ; base : l'aperçu de la PR, jamais classé)
`https://recette.playdujour.com/gravity/?apercu=<clé>&…` · **partie normale** : `/gravity/`
- **Scies** : `/gravity/?danger=scies` · `&robot` pour regarder · **Sols fragiles** : `?danger=fragiles` (ne fais rien : tu t'y poses, il craque, il tombe) · **Lasers** : `?danger=lasers`
- **La Nuit, bloc qui prévient et s'éteint** : `/gravity/?jour=2026-11-17&morceau=77` (inverse avant qu'il s'éteigne) · **le Néon** : `/gravity/?jour=2026-11-17&morceau=73` · `&robot` pour les voir passés.
- **Comparer la vitesse** : voir § 1. **Une mort** : `/gravity/?danger=lasers` — JOUER, ne touche à rien.
- Captures : `docs/gravity/captures/GR7/` (`scies.png`, `fragiles.png`, `lasers.png`, `nuit-avertissement.png`).

## Vérifié / non vérifié
**Vérifié** : unitaires `gravity-sim` (≈ 300), `gravity` (≈ 100), `apps/api/test/gravity*` ; golden régénéré (g5 / sim 4 / bot 4) ; e2e `essais.spec.ts` (12, dont `?danger=` ×3 et `&robot`) en Chromium ; build ; `npm run verifier` : typecheck, unitaires SQLite (146 fichiers) et libSQL (87), constructions, e2e Gravity (22 verts ; le 23e, le compte des lignes de « Comment jouer », corrigé à 19 puis vert) ; le contrôle des budgets (`budgets-controle`) ; la CI de la PR : voir la PR.
**Non vérifié** : le son à l'oreille (faux contexte audio) ; le rendu sur un vrai téléphone ; Firefox / WebKit ; **la longueur du préavis de la Nuit à l'œil** (le clignotement est celui d'avant, 42 pas) ; les avions et ondes sans danger restent passifs (voulu : ce sont des modes).
**À Nathan / plateforme** : (1) **plafond `gravity.demande` : 203 → 230 Ko proposé** (commit à part, « refusé : retirer ce commit ») — mesure 208,36 Ko, soit 5,4 Ko de trop ; le générateur, le plan, le robot et les dessins des 48 motifs pèsent ≈ 8 Ko gzip de plus (la scène : 2,2 Ko), le premier chargement 46,30 Ko pour 48 ; sans ta décision le job « Budgets » reste rouge. (2) `scripts/unit-durees.json` (zone partagée) n'a pas de ligne pour les trois nouveaux fichiers de tests de `gravity-sim` (≈ 4 s, 1,5 s, 1 s : 5 s par défaut ; aucun test > 10 s hors la Régression existante).
