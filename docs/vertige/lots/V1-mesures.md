# Lot V1 — le détail des mesures

**Machine** : 4 cœurs Intel Xeon 2,1 GHz partagés, **aucun GPU** (la PR est faite dans un conteneur : tout le rendu est logiciel, SwiftShader), Node 22. **Ce que ces mesures ne disent pas** : aucun vrai portable ni vrai GPU n'a servi ; le « portable simulé » (processeur ÷ 4 par CDP) ne ralentit que le fil JavaScript de la page, pas le rastériseur logiciel, qui tourne dans un autre processus : les deux séries sont donc deux mesures du même rendu logiciel, à lire comme **un ordre de grandeur bruité** (quatre cœurs partagés, deux passes dont une dérangée par un autre calcul : voir l'écart d'une ligne à l'autre). `?debug&fps` donne les chiffres de la machine de Nathan.

## Le coût du rejeu (Node 22, médiane de 25 rejeux, ms ; min – max)
| partie | niveau (boîtes) | pas | rejeu | par seconde de jeu |
|---|---|---:|---|---:|
| marche au hasard 120 s | bac-a-sable (17) | 14 400 | 13,0 (11,3 – 16,1) | 0,11 |
| **va-et-vient 45 s, portails** (56 traversées) | portails (27) | 5 400 | **5,0** (4,6 – 8,2) | 0,11 |
| **va-et-vient 120 s, portails** (152 traversées) | portails (27) | 14 400 | **13,0** (12,3 – 18,0) | 0,11 |
| marche au hasard 45 s, gravité (9 bascules) | gravite (6) | 5 400 | 4,1 (3,9 – 9,8) | 0,09 |
| marche au hasard 120 s, gravité (16 bascules) | gravite (6) | 14 400 | 11,4 (10,8 – 12,5) | 0,09 |
| marche au hasard 120 s, 200 boîtes | synthétique (200) | 14 400 | 68,0 (67,0 – 90,7) | 0,57 |

Le coût vient toujours des boîtes testées à chaque pas : **les portails et la gravité ne coûtent presque rien** (au plus un test de plan par paire et par pas ; les blocs d'une orientation sont construits une fois). La machine de V0 (Ryzen 7 7800X3D) était environ 2 fois plus rapide (6,5 ms pour 120 s sur l'arène) : rapportées à elle, les valeurs ci-dessus sont cohérentes. Cloud Run : compter 2 à 4 fois plus que ici → **de l'ordre de 25 à 50 ms pour 120 s** de portails.

## Images par seconde et appels de dessin, un portail à l'écran (960 × 540, rendu logiciel)
Position : devant le premier portail, à 6 m, deux fenêtres dessinées (celle qu'on regarde et celle qu'on voit au fond : l'autre est derrière). Passe n° 2, au calme.

| configuration | machine de la PR (i/s) | « portable » ÷ 4 (i/s) | appels de dessin | triangles |
|---|---:|---:|---:|---:|
| portail à l'écran, halo et ombres | 9,7 | 13,4 | 308 | 13 000 |
| portail à l'écran, sans halo | 13,0 | 12,1 | 295 | 13 000 |
| portail à l'écran, sans ombres | 15,4 | 8,8 | 259 | 12 000 |
| portail à l'écran, sans halo ni ombres | 10,0 | 23,4 | 246 | 12 000 |
| sans portail (salle de la gravité), halo et ombres | 19,2 | 17,1 | 111 | 5 000 |
| sans portail, sans halo | 22,7 | 36,1 | 98 | 5 000 |

**Ce qui est solide** : un portail visible **fait passer la scène de 111 à 308 appels de dessin (× 2,8)** et de 5 000 à 13 000 triangles : chaque fenêtre redessine toute la scène (décor lointain, nuages, îlots compris) dans une texture. **Ce qui ne l'est pas** : les images par seconde (le rendu logiciel sur quatre cœurs partagés varie du simple au double d'une passe à l'autre ; première passe, dérangée : 5,2 i/s avec halo et ombres contre 9,7 au calme). Le sens est net (un portail à l'écran coûte à peu près le double ; le halo et les ombres pèsent en plus) ; les chiffres ne le sont pas. Pistes de V4 si c'est trop : ne dessiner dans une fenêtre que le décor proche, réduire la texture (demi-résolution), couper le halo dans la fenêtre.

## Poids (gzip)
| quoi | V0 | V1 | écart |
|---|---:|---:|---:|
| premier chargement (`vertige.jsCss`, plafond 53 Ko, `mesureJeuNeuf`) | 49 707 | **49 926** | +219 (marge 3 074) |
| `corps-` (Three.js, la scène, les commandes), à la demande | 153 Ko | 154 Ko (610,6 Ko brut) | +1 Ko |
| simulation de la partie (`course-`), à la demande | 2,7 Ko | 5,7 Ko | +3 Ko |

La simulation grossit (orientations, portails, niveaux) mais elle est à la demande ; le premier chargement ne bouge que de 219 octets (le catalogue). Le plafond n'est pas touché.
