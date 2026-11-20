# Lot PBT0b — des tables en éventail, sur le modèle d'un vrai flipper

PR brouillon, étiquette `jeu:pinball`, jeu `off`. **Branche : `ccr-de126858-tcwdxq`** (celle du PBT0, que la session impose ; le prompt disait `claude/pinball-tables-0b`) : **la PR du PBT0 (#370) est à fermer par Nathan** — ce lot en reprend les commits et **remplace ses six plans** par trois variantes. **La photo de Spider-Man Vault Edition a été reçue** : `docs/pinball/maquettes/references/reference-spider-man-vault.jpg`.

## En bref
- **Une architecture en éventail** (`packages/pinball-sim/src/eventail.ts`) : une table n'est plus un plan libre, c'est ce que chaque **place de l'arc** porte (l'orbite et sa porte, la rampe, le jouet central, le verrou, la poche, une banque), le côté de la rampe, le mini-batteur, le miroir. **Trois variantes jouables `?plan=e1` à `?plan=e3`** (avec `?theme=`, `?miroir`, les essais), jamais tirées par le générateur.
- **Trois règles nouvelles, gardées par des tests** : **une bouche est libre** (la ligne de chaque bout de batteur à chaque bouche ne touche rien : « plus jamais de mur devant une rampe »), **une bouche regarde les batteurs** (25° au plus), **le haut est réservé** à la poche des bumpers. Les règles du PBT0 restent (5 à 7 tirs de 30 ms, rails sur les bords et sans croisement, densité, visibilité, miroir).
- **Le bas est couvert de lumière** (les deux rendus) : un **médaillon** central (le symbole du thème, la jauge de la mission autour, la lampe du verrou au centre), **un rayon de lampes peintes vers chaque tir** dans la couleur de son intention, un **socle de lampes** sous le jouet de la mission.
- **24 tables (3 plans × 2 sens × 4 thèmes) passent tout** : validation PB4 **24/24**, fenêtres de tir, bouches, densité, visibilité 390 × 844, plaques, golden à part. **Les tables du jour ne bougent pas.**

## Ce que Spider-Man apprend, et ce qu'on en prend
| la table de référence | chez nous |
|---|---|
| tirs en éventail, chaque bouche regarde les batteurs | `PLACES` : bouches de l'orbite (15° et 18° de la direction des batteurs), de la porte, de la rampe (15°) ; `bouchesDeTravers` ≤ 25° |
| rien entre les batteurs et une bouche | `bouchesBloquees` : deux lignes (bout de chaque batteur) par bouche, à une bille près |
| rampes qui partent de l'arc et reviennent par les bords | la rampe courte (retour par le flanc gauche) et la grande boucle (bords gauche, haut, droit) |
| le jouet au centre | l'élément de la mission en (182, 315) (165 ms à la Fête foraine) |
| bumpers en poche en haut | la poche (212, 176) ; `hautOccupe` : rien d'autre au-dessus de y = 205 |
| un bas ouvert mais couvert d'inserts | médaillon, rayons, socle (`dessinerLampesDuSol`) |

## Les trois variantes (schémas : `captures-pbt0b/schema-e<n>.png`, la table vue de dessus, les tirs numérotés, leur fenêtre et le batteur d'où on les prend, la ligne de visée de chaque bouche en pointillé)
| plan | l'idée | tirs (fenêtre min – max sur 4 thèmes et 2 sens, ms) | Diamant du robot (médiane) |
|---|---|---|---|
| `e1` | **l'éventail complet** : l'orbite et sa porte, la rampe, le jouet, le verrou | mission 45–165 · verrou 33 · rampe 35 · orbite 45–86 · porte 68 | 6 299 065 |
| `e2` | **la grande rampe le long des bords**, le mini-batteur de gauche, deux banques (un flanc bas et le haut) | mission 45–165 · verrou 33 · rampe 35 · banques 51–96 | 2 606 805 |
| `e3` | **la rampe courte et deux banques**, sans orbite | mission 45–165 · verrou 33 · rampe 35 · banques 51–96 | 3 754 685 |

**Pourquoi trois et pas quatre** (le prompt disait « 3 ou 4 »). L'orbite et sa porte **occupent les deux lignes de visée des flancs** : une banque de flanc ou le mini-batteur y bloque une bouche (`bouchesBloquees` le dit), et une banque en haut à droite se cache derrière le jouet et la porte (6 ms à la Fête foraine). Une table d'orbite n'a donc que **cinq tirs** (`e1`) ; le miroir de `e1` porte la porte à gauche et la rampe à droite. Un quatrième plan aurait été `e1` avec un mini-batteur ou une banque : refusé par les règles.

## Écarts avec le brief, à lire
1. **« Vise 50 ms pour le jouet et le verrou »** : le jouet a **45 ms** au Volcan et à l'Océan (165 à la Fête foraine, 51 à l'Espace) ; **le verrou plafonne à 33 ms** — le trou ne garde que les billes de moins de 650 px/s, et sa seule place jouable est (180, 398) (mesuré au PBT0). Tous les tirs passent le seuil de 30 ms ; **50 n'est pas atteint** (mission −5 ms, verrou −17 ms).
2. **Le verrou n'est pas sur l'arc** : il est devant les batteurs, pas au tiers haut.
3. **Pas de spinner** : il a des murs, la zone de tir libre (PBL2) les interdit, et un rail ne passe pas au-dessus d'un module.
4. **La jauge de la mission et le verrou sont dynamiques, le reste est peint** : le médaillon, les rayons et le socle sont cuits dans le sol (donc immobiles) ; **les rayons ne s'allument pas** (les flèches vives de PBL1 s'allument au bout de chacun).
5. **Le jouet n'est pas plus haut** : son modèle garde l'emprise de collision (règle du PBV4) ; il gagne un socle de lampes, pas un modèle plus grand. À regarder sur la planche : c'est la partie la moins convaincante.
6. **Le nom du thème n'est plus peint sur la table** : le médaillon le remplace (il reste dans le panneau « Aujourd'hui » et sur l'accueil).

## Mesures (`npm run valider-essais:pinball -w @cdj/pinball-sim`, 24 tables, 5,5 s chacune)
- **Validation du PB4 : 24/24** (aucune bille coincée : la plus lente met 6 397 pas, le délai est 54 000 ; chaque module touché ; mission ; porte). Le robot verrouille et lance une multibille sur les 24. **Diamant** médian 3 635 750 (le robot est chaotique, ±11 %).
- **Densité** : 93 à 231 ‰ (plafond 250 ; la table de Nathan du PBL2 : 336).
- Une erreur utile : un premier `e1` plaçait la banque en haut à droite (6 ms) ; `regler-essai` n'y trouvait rien parce que ce n'était pas une question de position — la ligne de visée est bloquée par le jouet et la porte. La poche reçoit alors une seconde paire de mini-bumpers (les deux portails de l'Espace).

## Planche et captures (`captures-pbt0b/`)
`planche.png` : la photo de Spider-Man, la capture de Nathan (PBL2), le PBT0 refusé (`t1`) puis `e1`, `e2`, `e3`, chacun en Fête foraine (haut) et en Volcan (bas), en portrait. `miroir-e<n>-foire.png` : les miroirs. `plan-e<n>-<thème>.png`.

## Ce qui est vérifié, ce qui ne l'est pas
- **Vérifié** : par des tests (`conception.test.ts` : les règles sur 3 plans × 2 sens × 4 thèmes, dont les angles des bouches ; `conception-tirs-e1…e3` : 24 tables ; `visibilite.test.ts` ; `golden-essais.test.ts` : une partie du robot sur chaque plan rejouée au bit près par `rejouer`, ce que fait le serveur ; `ancrage` et `lisibilite` jouent les six plans), et `npm run verifier`.
- **Pas vérifié** : (1) le serveur ne joue pas un plan d'essai (il tire le plan du jour) : voulu, les essais ne sont jamais classés ; (2) la visibilité est mesurée dans l'écran entier, pas dans la zone libre du HUD ; (3) **les lampes au sol ne sont vues que sur les captures** (quatre thèmes, un plan en Océan et Espace non repris : je n'ai regardé que Fête foraine et Volcan) ; (4) le plaisir de jeu ; (5) `scripts/unit-durees.json` n'a pas les lignes des nouveaux tests (zone partagée : 5 s par défaut).

## Pour décider (Nathan)
1. **Regarde d'un coup d'œil** : les tirs se voient-ils, y a-t-il un mur devant une bouche, le bas est-il vide, est-ce un vrai flipper ? **Garde au moins deux variantes** (avec leurs miroirs et quatre thèmes : 16 tables).
2. **Le jouet** : faut-il un modèle plus haut (il sort alors de l'emprise de collision : un lot PBV) ?
3. Le médaillon prend la place du nom du thème : à garder ?

## Scénario de test (2 clics)
Base : `<aperçu>` (le commentaire « Aperçu » de la PR ; jeu `off`, essais jamais classés).
- `<aperçu>/pinball/?plan=e1&theme=volcan` · `e2` · `e3` ; **retournés** : ajouter `&miroir`. Autres thèmes : `&theme=foire|ocean|espace`. Essais : `&essai=verrou|multibille|porte|poteau` ; l'éventail des tirs : `&debug&tirs`.

**Pour les joueurs : rien** (le jeu est `off`).
