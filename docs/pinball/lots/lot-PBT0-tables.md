# Lot PBT0 — des tables dessinées d'un seul tenant, à jouer avant de choisir

PR brouillon, étiquette `jeu:pinball`, jeu `off`. **Branche : `ccr-de126858-tcwdxq`** (la session impose ce nom ; le prompt disait `claude/pinball-tables-0` : le nom ne contient pas `pinball`, l'étiquette `jeu:pinball` est donc **nécessaire** pour que le job `zones` reconnaisse la PR). **La capture de Nathan a été reçue** : `captures-pbt0/retour-volcan-doublette-pbl2.png` (Volcan × « doublette » après PBL2).

## En bref
- **Six plans d'essai jouables** (`?plan=t1` … `?plan=t6`, avec `?theme=`, `?miroir`, `?essai=verrou|multibille|porte|poteau`), **jamais tirés par le générateur**. Chacun est une table complète : 5 ou 6 tirs de 30 ms au moins (de 30 à 165 ms), une orbite et/ou une rampe qui ne croisent rien, les bumpers en poche en haut, la zone de tir libre vide, 131 à 231 ‰ de densité (la table de Nathan : **336 ‰**).
- **Les rails sont des fils fins dans les quatre thèmes** ; l'habillage du thème n'est plus qu'à l'arche d'entrée et à la sortie d'une rampe.
- **Les douze plans (avec les miroirs) × quatre thèmes = 48 tables passent tout** : règles de conception, fenêtres de tir, **validation du lot PB4 (48/48 : aucune bille coincée, chaque module touché, mission, porte)**, visibilité en 390 × 844, plaques, golden à part.
- **Les tables du jour ne bougent pas** : `PLANS`, générateur, `golden-pinball.json`, `refusees.ts`, seuils, `PINBALL_*_VERSION` — inchangés (les tests du golden et des seuils passent).

## Le retour de Nathan, chiffré
Sur sa capture (Volcan × doublette, modules `geyser, trou, bumpers, mini, coulée, mini`) : **trois rails qui se croisent** (deux rampes et l'orbite) dessinés en voies de wagonnet, qui couvrent **254 ‰** du haut du plateau à eux seuls (rails de 18 px) ; avec les obstacles (100 ‰) la table en occupe **336 ‰**. Sur les 94 tables du jour : 248 à 391 ‰, **315 ‰ en médiane** (`npm run densites:pinball -w @cdj/pinball-sim`). Les plans d'essai : **131 à 231 ‰** (rails 60 à 87 ‰, obstacles 71 à 143 ‰).

## Les règles de conception (`packages/pinball-sim/src/conception.ts`, section « Concevoir une table » du `CLAUDE.md`)
| règle | garde | ce qu'on a retenu |
|---|---|---|
| 5 à 7 tirs, 30 ms au moins (PBL2) | `tirsDeConception`, `nombreDeTirs` | mission, verrou, rampe, orbite, porte, chaque banque ; la poche n'est un tir que si elle se vise (40 à 90 ms sur la moitié des tables) |
| au plus une rampe, une orbite ; aucun croisement ; rien dessous | `railsGenants` | 14 px de dégagement + la demi-largeur (6) entre l'axe du rail et le bord de tout obstacle, 30 px entre deux rails |
| bumpers en poche en haut, jamais dans la zone de tir | `pocheEnDefaut` | y ≤ 250, emplacements à 110 px au plus ; sous les couloirs du haut (le trio : y ≥ 172) |
| zone de tir libre vide | `obstaclesDansLaZone` | inchangée (PBL2) |
| rien ne se touche | `obstaclesQuiSeTouchent` | 8 px entre deux modules, la porte, le mini-batteur, les couloirs du haut, les murs |
| budget de densité | `densite`, `DENSITE_MAX` = **250 ‰** | pire plan d'essai (231) + 8 % ; refuse la table de Nathan et la moitié des tables du jour |
| visibilité | `apps/pinball/test/visibilite.test.ts` | la caméra par défaut cadrée en 390 × 844, les **vrais maillages** des rails, la silhouette de chaque obstacle (sol et sommet du modèle) : **aucun pixel touché** ; une sentinelle prouve que le test voit un rail qui cache |
| miroir | `miroirDePlan` (`<id>m`) | l'orbite est refaite (le châssis n'est pas symétrique : arc à x = 196,25, couloirs du haut à x = 192) ; **tous les tests passent dans les deux sens** |

## Les six plans (schémas dans `captures-pbt0/schema-t<n>.png` : la table vue de dessus, les tirs numérotés, leur fenêtre et le batteur d'où on les prend)
Ils ont une épine commune, **mesurée, pas choisie** : le verrou est le trou à (180, 398) (la seule place où sa fenêtre atteint 30 ms : 33 à 35), la mission au centre bas (182, 315), la poche des bumpers en (212, 176), les bouches d'orbite et la porte éprouvées au PBL2. Ce qui change : les rails, les banques, le mini-batteur, les places des portails de l'Espace.

| plan | l'idée | tirs (fenêtre min – max sur 4 thèmes et 2 sens, ms) | Diamant du robot (médiane des 8 tables) |
|---|---|---|---|
| `t1` | **L'orbite et la rampe se répondent** : orbite (porte à droite) et rampe basse qui longe la bande gauche | mission 36–163 · verrou 33 · rampe 33 · orbite 45–86 · porte 50–68 · banque 63 | 4 641 870 |
| `t2` | **La poche des bumpers en haut, nourrie par l'orbite** : orbite seule, banque en bas à gauche | mission 36–163 · verrou 33 · orbite 38–86 · porte 68 · banque 76 | 2 347 630 |
| `t3` | **Deux cibles de chaque côté, un tir central** : deux banques sur les flancs bas | mission 36–163 · verrou 33 · orbite 38–86 · porte 50 · banques 63–76 | 2 484 920 |
| `t4` | **Le mini-batteur et sa rampe** : une grande rampe longe le haut (pas d'orbite, pas de porte), mini-batteur à gauche | mission 36–165 · verrou 33 · rampe 35 · banques 51–90 | 3 751 540 |
| `t5` | **Le mini-batteur de gauche nourrit l'orbite** | mission 36–163 · verrou 33 · orbite **30** · porte 50–68 · banque 63 | 2 110 940 |
| `t6` | **Le mini-batteur de droite et la banque de gauche** | mission 36–163 · verrou 33 · orbite 38–86 · porte **35** · banque 76 | 3 217 670 |

Les 36 ms de la mission sont **l'Espace** (deux portails de 14 px) ; ailleurs elle a 45 à 165 ms. **`t5` (orbite 30 ms) et `t6` (porte 35 ms) sont à ras du seuil.**

## Les mesures (`npm run valider-essais:pinball -w @cdj/pinball-sim`, 48 tables, 5,6 s chacune)
- **Validation du lot PB4 : 48/48 valides** (aucune bille coincée : la plus lente met 5 143 pas pour être perdue, le délai est 54 000 ; chaque module touché ; mission ; porte ouverte et franchie). **Le robot verrouille une bille et lance une multibille sur les 48 tables.**
- **Diamant** (le meilleur de 4 parties de 6 minutes du robot, sur la table d'essai, ce n'est pas un jour servi) : médiane **2 899 960**, de 1 002 340 à 7 205 910 (le Diamant médian des tables du jour au PBL2 : 3 246 800 ; le robot est chaotique, ± 11 %).
- **Fluidité** (`captures-lot-pbl2 -g mesure`, `PLAN=t1`, processeur ralenti ×4, 390 × 844, bloom, multibille, médiane) : `t1` **14,2 ms (Volcan), 15,2 (Espace), 16,9 (Océan), 18,6 (Foire)** ; 129 à 156 appels de dessin. Mesurée sur `t1` seulement (les rails sont les mêmes partout : moins de triangles qu'avant) ; PBL2 : 14,9 à 19,2 ms sur ses plans.
- Un premier jet de `t4` avait des **billes coincées** (8 tables sur 8) : le mini-batteur déplacé de 7 px créait un creux contre le mur gauche où la bille s'arrêtait. Remis en (46, 405) : c'est la place éprouvée au PBG1. **Leçon écrite** : un mini-batteur ne se déplace pas sans `valider-essais`.

## Les rails, plus discrets
Un rail = **deux fils de 1,8 px** sur les bords d'une gouttière de 12 px (18 et 16 avant), un fond quasi transparent, des fûts très fins ; ni traverses, ni ruban, ni lueur, dans les deux rendus (three.js : `rails3d.ts`, `FIL` ; à plat : `dessin.ts`, `FIL_PLAT`). L'arche d'entrée de chaque bouche et la sortie d'une rampe gardent l'habillage du thème (foire : poteaux rouge et blanc, océan : corail et écume, espace : anneau néon, volcan : bois et fer). Voir la planche.

## Planche (`captures-pbt0/planche.png`) et captures
À gauche la table de Nathan ; puis `t1` à `t6`, chacun en Fête foraine et en Volcan, en portrait. Les miroirs : `miroir-t<n>-foire.png`. Océan et Espace : seulement `t1` (`plan-t1-ocean.png`, `plan-t1-espace.png`) ; l'Espace est le thème où la mission a le moins de marge (36 ms).

## Ce qui est vérifié, ce qui ne l'est pas
- **Vérifié** : tout ce qui est ci-dessus, par des tests (`conception.test.ts` 61 tests sans simulation, `conception-tirs-t1…t6` 48 tables, `visibilite.test.ts` 49, `golden-essais.test.ts` 13 : une partie du robot sur chaque plan rejouée au bit près par `rejouer`, ce que fait le serveur ; `ancrage` et `lisibilite` jouent aussi les douze plans ; `essai.test.ts` pour `?plan=t1` et `?miroir`).
- **Pas vérifié** : (1) **le serveur ne peut pas jouer un plan d'essai** (il tire le plan du jour : `dailyPinball(jour)`) — c'est voulu, les essais ne sont jamais classés ; la rediffusion est vérifiée par `rejouer`, la même fonction ; (2) **la visibilité est mesurée dans l'écran entier 390 × 844**, pas dans la zone libre entre les bandes du HUD (même cadrage à l'échelle près) ; (3) **le plaisir de jeu** : c'est ton essai ; (4) la musique et le son n'ont pas changé ; (5) `scripts/unit-durees.json` n'a pas les lignes des nouveaux fichiers de test (zone partagée : ils pèsent 5 s par défaut ; mesurés : conception 1 s, chaque `conception-tirs` 8 s, golden 1 s).
- **Les plans se ressemblent par leur épine** (verrou, mission, poche) : c'est ce qui était jouable ; si tu veux plus de variété, dis quel tir déplacer (la mission à gauche exige une orbite plus étroite, une retouche plan par plan).

## Pour décider (Nathan)
1. **Joue chaque plan, garde-en au moins quatre**, demande des retouches plan par plan (les outils `conception`, `regler-essai` et `valider-essais` rejouent une retouche en une minute).
2. **`t5` et `t6` sont à ras du seuil de 30 ms** : à garder seulement si le tir te convient en jouant.
3. **Le plafond de densité (250 ‰)** et le seuil de 30 ms te sont soumis.
4. PBT1 (hors périmètre) : les tables du jour = les plans gardés ; il devra recalculer `refusees.ts`, les seuils et le golden (monter les trois versions).

## Scénario de test (2 clics)
Base : `<aperçu>` (le commentaire « Aperçu » de la PR ; jeu `off`, essais jamais classés).
- `<aperçu>/pinball/?plan=t1&theme=volcan` · `t2` · `t3` · `t4` · `t5` · `t6` (ajouter `&theme=foire|ocean|espace`).
- **Retourné** : `<aperçu>/pinball/?plan=t1&theme=volcan&miroir` (ou `?plan=t1m`).
- Les essais : `&essai=verrou`, `&essai=multibille`, `&essai=porte`, `&essai=poteau` ; l'éventail des tirs : `&debug&tirs`.

## Fichiers
`packages/pinball-sim/src/` : `conception.ts`, `plans-essai.ts`, `plans-outils.ts` (miroir), `plans.ts`, `generateur.ts` (`tablesDuPlan`, empreinte des plans d'essai) · `tools/` : `conception`, `regler-essai`, `valider-essais`, `densites`, `schemas-essais`, `references-essais` · `test/` : `conception*.test.ts`, `golden-essais.test.ts` + `fixtures/golden-essais.json` · `apps/pinball` : `rails3d.ts`, `dessin.ts`, `essai.ts`, `niveau.ts`, `panneau.ts`, catalogues, `test/visibilite.test.ts`, `e2e/captures-lot-pbt0.spec.ts` · consignes : `packages/pinball-sim/CLAUDE.md`, `apps/pinball/CLAUDE.md`, `docs/pinball/consignes.md`.

**Pour les joueurs : rien** (le jeu est `off`).
