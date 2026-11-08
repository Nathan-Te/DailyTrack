# Lot 58 — Track : des blocs plus complexes, à la Trackmania

Branche `claude/lot-58-blocs-complexes-ubs6bq`, PR brouillon. **Étapes 1 et 2 livrées : catalogue chiffré et prototypes jouables ; premier retour de Nathan (08/11) appliqué (§ 2). Arrêt obligatoire : Nathan garde, retouche ou écarte chaque famille** ; l'étape 3 (le générateur) attend ses choix. Aucune version ne change : `GENERATOR_VERSION` 21, `SIM_VERSION` 14 ; golden des versions publiées et rediffusions de référence identiques (suite de `packages/sim` verte). Prérequis : lots 49 et 57 fusionnés ; la « bascule automatique » (lot 54 de l'énoncé) est celle du lot R11, comme l'a confirmé Nathan au lot 57.

**On s'inspire de Trackmania pour les idées, jamais pour les fichiers ni les noms** : rien de Trackmania ni de sa communauté (objets, modèles, textures, noms) ; tout est construit par le code, avec nos noms. Règle : `packages/sim/CLAUDE.md`, « Blocs plus complexes, à la Trackmania (lot 58) » (pas dans `docs/regles/sim/` : zone partagée, hors des zones d'un lot de Track — le job `zones` l'a refusé ; un lot de la plateforme peut l'y déplacer).

## Pour les joueurs
rien

(Prototypes réservés aux outils d'essai, `?scenario=blocs` : aucun circuit du jour ne change.)

## 1. Le catalogue chiffré
Coûts : **sim** (simulation, premier chargement et fils de travail), **rendu**, **générateur** (règles à écrire à l'étape 3), **pilote**, **budget** (octets compressés). Mesuré pour l'ensemble des familles prototypées (première version, eau et propulseur compris) : **premier chargement +1 428 o** (299 086 → 300 514, cible ≤ +1,5 ko), fil des circuits +765 o, fil du Salon +778 o ; après le retour de Nathan : +1 403 o (voir « Budget ») ; la répartition par famille ci-dessous est une **estimation** (taille du code ajouté), pas une mesure.

| famille | ce que le joueur vit | thèmes (fiches du lot 49) | coût | risques |
|---|---|---|---|---|
| **Direction bloquée** `Ed` | le volant ne répond plus 1,5 s : s'aligner avant la bande | Stade, Nuit | sim : un test sur le volant ; rendu : portique ; générateur : aucun virage dans les ≈ 70 m qui suivent ; pilote : rien ; ≈ 0,2 ko avec les autres effets | injuste devant un virage (règle d'équité) ; lisible (portique violet, HUD) |
| **Freins coupés** `Ef` | 3 s sans frein ni « figer » : lever le pied tôt | Stade, Canyon | sim : un test ; générateur : pas de freinage obligatoire dans les ≈ 140 m qui suivent ; pilote : rien (il lâche) | injuste avant un serré ; le frein qui ne répond pas surprend (HUD qui décompte) |
| **Régulateur** `Er` | 4 s à la vitesse d'entrée, gaz et frein sans effet : on ne fait que tourner | Stade, Ville | sim : une accélération remplacée ; générateur : la suite doit passer à la vitesse d'entrée du pilote **et** d'un humain plus lent ; pilote : rien | qui entre lent reste lent (choix réel, mais punitif) |
| **Voiture fragile** `Ex` | 8 s : une réception brutale (> 20 m/s contre le sol) ou de travers, **ou un rebord pris de face (> 8 m/s contre le rebord)**, casse la voiture | Rallye, Canyon | sim : un test dans `land` ; générateur : aucune chute de 2 niveaux, aucun saut à plus de ≈ 60 m/s dans la portée ; pilote : il se pose à plat (il fige) | frustrant si mal mesuré ; la casse se dit (HUD « Cassée ! », reprise comme une chute) |
| ~~**Propulseur**~~ `Ep` | **écarté par Nathan** (08/11) : « une variante moins intéressante que le tremplin pour aller en hauteur » ; l'idée de Trackmania était en fait d'autres roues qui changent la conduite sur une portion — laissée de côté | — | retiré du code | — |
| **Remise à zéro** `E0` | le portique crème éteint l'effet (et le moteur coupé) | avec les effets | sim : trois affectations | aucun |
| **Ralenti** (non prototypé) | « temps ralenti » | — | **impossible tel quel** : ralentir le temps = un pas variable (interdit) ; à pas fixe, ce n'est qu'un plafond de vitesse, déjà rendu par le régulateur à basse vitesse ou l'eau | doublon |
| **Route bombée** `/a` | chaussée arrondie sans rebords : le sommet porte, les côtés glissent vers le vide (dérive de 1,4 m en 2 s à 4 m de l'axe, chute à 8 m) | Nuit, Stade | sim : `liftAt` (un cas de plus) ; rendu : 8 bandes en travers ; générateur : chaîne ≥ 2 blocs, virages larges ; pilote : rien (il tient l'axe) ; ≈ 0,4 ko | peu visible de nuit sans néons (les bords néon de la Nuit la dessinent) ; décor à poser (lot 37) |
| **Virage très relevé** `/f` | un ample relevé à 45° (**l'ample seulement**, depuis le retour de Nathan : voir § 2) se prend sans lever le pied, plaqué (pilote : sortie de l'ample à 47,0 m/s, contre 45,9 en `/b` et 45,6 à plat) ; **le chrono n'y gagne presque rien** : le pilote reste près de l'axe d'un relevé, il ne coupe pas (S de deux larges : 11 279 ms à plat, 11 498 en `/f`, 11 557 en `/b` ; un large seul : 9 630 en `/f`, 9 679 à plat) | Stade, Nuit, Canyon | sim : une pente de plus (`bankSlope`) ; rendu : aucun (suit `bankAt`) ; générateur : comme `/b` ; pilote : il lit la pente ; ≈ 0,1 ko | le bord intérieur descend sous la route (10 m sur 20 m de large) : `voidY` suit ; sensation plus que temps |
| ~~**Eau**~~ `S/w` | **écartée par Nathan** (08/11) : sans intérêt dans les circuits actuels ; il faudrait un vrai bassin (un décor d'eau), pas une route bleue | — | retirée du code | — |
| **Dévers et transitions** | dévers d'une droite, S relevé, virage en pente : **déjà au lot 57** ; le 45° ci-dessus s'y ajoute | Col, Nuit | — | — |
| **Tube de glace** (prototype hors page) | cuves sur la glace (`V/g`, `L2/cg`) : **aucun code** | Banquise | mesuré : droites aussi vites que la route, mais **virages lents** (le pilote tombe à 14,5 m/s dans `L2/cg` : la paroi sur glace ne tient pas) ; il faudrait une « glace de piste » pour les parois (un revêtement, ≈ 0,2 ko) | pas encore réussi : à retoucher avant de le proposer |
| **Plateformes** | grandes surfaces ouvertes, trajectoire libre entre deux portes | Stade, Ville | **cher** : des surfaces plus larges qu'une cellule (32 m), des portes plus larges, un pilote qui choisit entre plusieurs lignes (aujourd'hui il n'en connaît qu'une), un générateur qui vérifie chaque ligne | le choix ne se mesure pas avec un seul pilote |
| **Murs roulables, boucle** | voir § 3 | — | lot à part | — |

**Classement (plaisir / coût, le meilleur d'abord)** : 1. **blocs à effet** direction bloquée, freins coupés, régulateur et remise à zéro (un champ d'état, très « Trackmania », lisibles par portique, de vrais gestes) ; 2. **virage relevé à 45°** (une pente, aucun rendu, grosse sensation, peu de temps gagné) ; 3. **route bombée** (identité de la Nuit) ; 4. **voiture fragile** (bon marché mais délicate à rendre juste) ; 7. tube de glace (un revêtement de plus à régler) ; 8. plateformes (pilote et générateur à refaire) ; 9. ralenti (impossible ou doublon) ; 10. murs roulables et boucle (lot à part). Le propulseur et l'eau, classés 3ᵉ et 5ᵉ à l'étape 1, sont écartés par Nathan.

## 2. Les prototypes — à choisir
Page **`/track/?scenario=blocs`** (deux touchers jusqu'à un bloc ; « Essayer », « Variante 2 », « Miroir »). Chacun : `?scenario=bloc-<nom>` (`&v=1`, `&m=1`). Paramètres dans `?debug&tune` (durées et forces des effets, traînée de l'eau ; une course réglée n'est jamais classée). Le pilote finit chaque variante, deux sens, trois largeurs (`test/blocs.test.ts`).

| prototype | variante 1 · variante 2 | pilote (variante 1) | thèmes proposés |
|---|---|---|---|
| `bloc-direction` | à la sortie d'un virage large · volant bloqué sur un saut | finit, aucune reprise | Stade, Nuit |
| `bloc-freins` | descente puis virage large · deux larges enchaînés | finit | Stade, Canyon |
| `bloc-regulateur` | à pleine vitesse, large et bosse · à la sortie d'un serré (38 m/s tenus 4 s) | finit | Stade, Ville |
| `bloc-fragile` | rampe, chute d'un niveau, bosse, tremplin, remise à zéro · sur la tôle ondulée | finit (réceptions ≤ 17,6 m/s, seuil 20) | Rallye, Canyon |
| `bloc-remise` | freins coupés rendus juste avant un virage serré | finit | Stade, Canyon |
| `bloc-bombee` | droites et un large · un ample puis un large de l'autre côté | finit | Nuit, Stade |
| `bloc-releve-fort` | deux amples à 45° · un S de deux amples | finit, à fond | Stade, Nuit, Canyon |

**Signalétique (comprendre avant d'y être)** : chaque bloc à effet a un **portique de sa couleur, son nom sur la poutre** (« FREINS COUPÉS », lu de loin), la bande peinte en travers ; le HUD dit l'effet et le temps qui reste ; route bombée en bandes plus claires au sommet, sans rebords ; eau bleue avec clapotis et gerbe. Captures (approche puis passage, palette du premier thème proposé) : `docs/lots/lot-58-blocs-complexes/captures/` (`CAPTURES=1 npx playwright test captures-lot58 --project=chromium`).

**Retours de Nathan (08/11/2026, aperçu au téléphone) et ce qui a changé** :
- *« Les blocs à effet devraient afficher un message au milieu de l'écran »* → un effet qui commence s'annonce au centre (« Direction bloquée ! », « Freins coupés ! », « Régulateur : la vitesse est tenue », « Voiture fragile : pas de choc ! », « Voiture cassée ! », « Effet terminé ») ; le HUD garde le temps restant.
- *« Le régulateur : le bruit du moteur est décorrélé »* → sous le régulateur, le moteur s'entend appuyer (gaz du son fixé à 0,6) quoi que fasse le pied ; freins coupés ou régulateur : plus de feux stop, de bruit de frein ni de témoin « figer ».
- *« La voiture fragile ne fait rien, je l'ai prise et foncé dans un mur »* → elle ne cassait qu'aux réceptions ; **un rebord pris de face (> 8 m/s contre le rebord) la casse aussi** (un frôlement non) ; test : tout droit dans le mur d'un serré à 30 m/s.
- *« Le propulseur : laisser de côté »*, *« l'eau : on peut l'oublier »* → **retirés** (code, prototypes, textes, réglages).
- *« Le virage relevé à 45° : la voiture fait n'importe quoi »* → **deux défauts trouvés et mesurés** avec un conducteur qui ne suit pas l'axe : (1) **la caisse se couchait vers l'extérieur** (roulis jusqu'à 8,4 en pente sur un large, 1,5 sur l'ample, pour un sol à 1) : le couple de roulis comptait la pesanteur le long de la pente comme une force latérale ; corrigé pour ce bloc seul (seule la force des pneus fait rouler la caisse : roulis ≤ 1,02) ; (2) **sur un large, la voiture décolle hors de l'axe** (jusqu'à 94 pas en l'air sur 286 : le relevé monte de 10 m en 37 m d'arc) → `/f` réservé à l'ample (une pente plus douce ne suffisait pas : roulis 2,5 dès 0,5 sur un large avant la correction). Limite restante : rouler haut (8 m vers l'extérieur) donne un petit envol à la sortie (14 % du virage en l'air).
- Direction bloquée, freins coupés, remise à zéro, route bombée : pas de remarque.

**Choix de Nathan** : propulseur et eau écartés ; les autres *en attente* (garder, retoucher, écarter, et leurs thèmes).

## 3. Murs roulables et boucle : état technique (non faits ici)
**Ce que la simulation fait aujourd'hui** : un monde en **champ de hauteurs** (`world.sample` : hauteur et gradient sous chaque roue) ; quatre ressorts **verticaux** ; l'orientation de la caisse = un **cap** (lacet) plus tangage et roulis gardés en **pentes** (jamais des angles) ; la pesanteur toujours selon −y. **Exception, les cuves (lot 18)** : `world.shell` donne la distance signée à une paroi et sa normale dans un profil en travers (surface de révolution ou cylindre), et `substepShell` intègre la voiture dans le plan tangent (`tangentFrame` construit l'avant à partir du cap et de la normale) : la voiture monte déjà jusqu'à la verticale d'une paroi.
- **Mur roulable** (une paroi verticale le long d'une droite, qu'on roule) : **presque à portée** — c'est une cuve dont le profil passe directement de la route au mur (rayon de raccord petit) et dont le mur est plus haut que `CUVE_LIP`. Il manque : une transition d'entrée et de sortie *dans le sens de la marche* (aujourd'hui la rampe de la cuve monte en travers), l'adhérence de paroi au-dessus de `shellStickHi` sans glisser vers le fond (réglage), et le pilote sur la paroi (la ligne « paroi » des cuves l'a déjà).
- **Boucle** : **hors de portée du modèle actuel**. Au sommet la normale pointe vers le bas : le cap n'est plus défini à partir de la normale (`tangentFrame` dégénère quand l'avance est parallèle à la normale du sol plat), la caisse est à l'envers (tangage en pente : non borné), et le champ de hauteurs a deux valeurs au même (x, z) (entrée et sortie de la boucle).
- **Ce qu'il faudrait changer** : (1) une **orientation complète** de la caisse dans `CarState` (quaternion : quatre nombres, normalisé par `Math.sqrt` à chaque pas — seuls `+ × ÷ √`, déterministes) à la place du couple cap + pentes, **pour les blocs nouveaux seulement** (le chemin d'avant reste) ; (2) un **contact par distance signée** à des surfaces analytiques (cylindre pour le mur, tore ou clothoïde pour la boucle, paramétrées par l'abscisse curviligne s et l'écart en travers), point le plus proche par **2 à 3 itérations de Newton à nombre fixe** (polynômes et racines : déterministe) ; (3) la pesanteur projetée dans le repère de contact, l'appui (v² ÷ R) qui charge les pneus ; (4) les cellules : une boucle occupe la même cellule deux fois (entrée et sortie) → une table de « sous-blocs » par cellule.
- **Coût à 120 Hz** : 2 sous-pas × 4 roues × (3 itérations de Newton ≈ 40 opérations) ≈ 1 000 opérations par pas, moins que la suspension actuelle ; négligeable devant le rendu. Le coût réel est en **code** (≈ 2 à 3 ko dans le premier chargement et dans les deux fils de travail) et en **tests** (rediffusions, golden).
- **Pilote** : vitesse minimale au sommet v² ≥ g × R (pesanteur 24,6 ; R = 12 m → 17 m/s, avec la marge d'adhérence ≈ 22 m/s), ligne au milieu, aucun freinage dans la boucle ; mur roulable : la ligne « paroi » des cuves.
- **Lot proposé** : « 58b — contact 3D : murs roulables, puis boucle » (Opus, effort élevé) : d'abord le mur roulable (extension des cuves, ≈ 1 ko), puis la boucle (orientation complète, nouvelle géométrie, rendu en tube), chacun avec ses prototypes et son arrêt pour Nathan ; budget à relever probablement de ≈ 2 ko pour la boucle (à chiffrer en début de lot).

## 4. Ressemblance, écart pilote / humain
Étape 3 (avec le générateur) : la mesure de ressemblance du lot 49 avant / après et l'écart entre le pilote et un humain sur les nouveaux blocs ne se mesurent qu'avec des circuits générés. À noter dès maintenant : direction bloquée et régulateur **retirent** des commandes (pilote et humain y sont égaux) ; freins coupés et fragile favorisent l'humain prudent, propulseur et eau ne changent pas l'écart.

## Vérifié
- `packages/sim` : suite verte ; `test/blocs.test.ts` (22 tests) : chaque effet appliqué puis retiré (volant inerte 0,5 s ; 1 s de frein à 40 m/s ne retire que ≈ 3 m/s contre > 30 sans l'effet ; régulateur à 0,3 m/s près, montée comprise ; chute de 2 niveaux casse la fragile, pas celle d'un niveau ; tangage 0,7 à la réception la casse ; un rebord pris de face aussi ; un seul effet à la fois ; remise à zéro, point de contrôle, arrivée) ; route bombée (pente au bord 0,4 ; dérive ≥ 1 m en 2 s à 4 m de l'axe ; chute depuis 8 m) ; 45° (pente 1 au milieu ; un ample seul plus vite que `/b` et qu'à plat ; refusé sur un large ; roulis ≤ 1,15 de 8 m à gauche à 8 m à droite de l'axe) ; les 7 prototypes finis par le pilote (variantes, deux sens, trois largeurs) ; rediffusions rejouées au temps près. Golden et rediffusions de référence identiques.
- `apps/web` : tests unitaires verts (`test/blocsEffet.test.ts` : couleurs des effets loin de l'orange et entre elles, portique de chaque bloc au palier 1) ; captures produites (26 après le retour de Nathan), 6 regardées en tout.
- Budget (`node scripts/budgets.mjs` après `npm run build`, `main` f82a321 contre la branche) : voir plus bas.

## Non vérifié
- Le jeu au téléphone (à faire par Nathan, liens ci-dessous). Le décor posé près d'une route bombée ou d'un virage très relevé (le décor lit la hauteur d'une route plate : un élément peut flotter de 2 m au plus près des prototypes ; à reprendre à l'étape 3 pour les familles gardées). L'étape 3 entière.

## Budget (`main` f82a321 contre la branche)
| mesure | `main` | lot 58 | écart | plafond |
|---|---:|---:|---:|---:|
| premier chargement JS + CSS | 299 086 | 300 489 | **+1 403 o** (cible ≤ +1,5 ko) | 312 Ko |
| fil des circuits | 30 187 | 30 905 | +718 | 33 Ko |
| fil du Salon | 32 350 | 33 080 | +730 | 35 Ko |
| catalogue anglais · admin | 8 006 · 12 361 | 8 225 · 12 433 | +219 · +72 | 9 · 14 Ko |

Le premier chargement porte la simulation (effets, route bombée, 45°) et le rendu (portiques, bandes, route bombée, annonces, HUD) ; la page et les textes des prototypes sont chargés avec les scénarios. Si Nathan écarte des familles, leur code part à l'étape 3 et la marge revient.

## Décisions pour Nathan
1. Chaque prototype : garder, retoucher, écarter (et ses thèmes).
2. Le tube de glace : une « glace de piste » pour les parois (un revêtement de plus) ou l'écarter.
3. Le lot 58b (murs roulables, puis boucle) : à lancer ou non.

## À tester (aperçu de la PR, au téléphone)
https://playdujour-recette--pr-309-d5xl54qc.web.app/track/?scenario=blocs, puis chaque bloc (« Essayer », « Variante 2 », « Miroir »). Le portique et la forme doivent se lire avant d'y être ; on ne doit jamais se sentir piégé.
