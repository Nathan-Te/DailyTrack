# Lot 57 — Track : des sauts et des transitions techniques

Branche `claude/wonderful-bell-vfr093`, PR brouillon. **Étape 2 livrée : prototypes jouables. Arrêt obligatoire : Nathan garde, retouche ou écarte chaque élément** ; l'étape 3 (le générateur) attend ses choix. Aucune version du générateur ni de la simulation ne change dans cette étape : `GENERATOR_VERSION` 21, `SIM_VERSION` 14, golden et rediffusions de référence identiques (suite de `packages/sim` verte, voir « Vérifié »). Prérequis : lot 49 fusionné ; la « bascule automatique » est celle du lot R11 (plateforme), confirmé par Nathan.

## Pour les joueurs
rien (les prototypes ne se jouent que par `?scenario=…` ; seule la signalétique des réceptions change dans les circuits : voir plus bas)

## 1. L'état des lieux (v21, 200 circuits : 25 par thème à partir du 10/11/2026)
Outil : `packages/sim/scripts/mesure-sauts.ts` (hors CI, ≈ 30 s ; commande en tête du fichier). Classement : `classerSauts` / `classerTransitions` (`sautsClasse.ts`).

**Sauts** — 201 sauts (1,0 par circuit) :

| partie | répartition |
|---|---|
| approche | ligne droite 74 % · après un virage 24 % · après une chicane 1 % · en descente 0 % |
| appel | **tremplin plat 100 %** (aucun en dévers, sur une crête, au bord d'une cuve, en virage) |
| vol | **dans l'axe 100 %** |
| réception | plus basse 59 % · dans l'axe 19 % · autre revêtement 11 % · en virage 10 % · plus étroite 2 % · décalée 0 % · en angle 0 % · plus haute 0 % |
| sortie | ligne droite 98 % · virage immédiat 2 % · chicane 0 % |
| vitesse | élan 63 % · plaque ou turbo 37 % |

- **« ligne droite → tremplin → réception dans l'axe » : 52 % des sauts** (105 / 201), 22 % au même niveau ; jusqu'à 2 par circuit (16 circuits sur 200). Combinaison la plus fréquente : droite | plat | axe | plus bas | droite (30 %).
- **Les sauts du lot 49 sont bien là** (106 des 201 figures de saut : réception en virage 27, saut à l'élan 23, tremplin en sortie de relevé 19, chicane-tremplin 15, saut vers la glace 14, falaise 8) **mais ils restent doux** : la rampe est toujours plate et droite, le vol toujours dans l'axe, et deux ou trois droites séparent le virage d'approche de la rampe (la chicane-tremplin se range « après un virage »). La sortie est presque toujours une ligne droite (98 %) : le dégagement imposé derrière un saut (lot 20, lot 34) efface toute sortie technique.
- Par thème (sauts par circuit · part dans l'axe) : Canyon 2,0 · 76 % ; Stade 1,36 · 44 % ; Rallye 1,32 · 79 % ; Nuit 1,24 · 48 % ; Ville 0,6 · 47 % ; Campagne, Col, Banquise ≈ 0,5 · 8 à 15 %.

**Transitions** — 3 054 raccords (15,3 par circuit). « Geste » = le pilote d'auteur lâche, freine ou braque nettement à moins de 16 m du raccord ; « décolle » = la voiture quitte le sol.

| raccord | par circuit | geste | décolle | geste, hors virage |
|---|---:|---:|---:|---:|
| creux (la pente augmente) | 2,88 | 24 % | 30 % | 24 % |
| revêtement | 2,79 | 51 % | 9 % | 31 % |
| dévers (entrée ou sortie de relevé) | 2,21 | 86 % | 13 % | — |
| crête (la pente diminue) | 2,18 | 97 % | **100 %** | 97 % |
| largeur | 2,06 | 40 % | 8 % | 34 % |
| virage contre une pente | 1,45 | 97 % | 58 % | — |
| rebords / vide | 0,90 | 46 % | 15 % | 28 % |
| cuve | 0,80 | 34 % | 5 % | 31 % |

Lecture : **les creux, les largeurs, les revêtements et les cuves sont surtout de simples raccords** (le pilote n'y fait rien dans 2 cas sur 3) ; **les crêtes font toujours décoller**, et le « geste » y est le frein qui fige la caisse en l'air : un geste subi, pas un choix ; dévers et virages en pente sont des gestes, mais ceux du virage (la mesure ne peut pas séparer le raccord du virage). Il n'existe ni dévers sur une droite, ni virage qui monte ou descend : les virages sont tous à plat, la pente s'arrête à leur entrée.

## 2. La grammaire (prototypes) — à choisir
Un saut = approche + appel + vol + réception + sortie (+ source de vitesse). Quatre géométries nouvelles, en **blocs nouveaux** (aucun circuit d'avant n'en a ; champs optionnels de `Block`, `hasLift` faux pour les anciens : leur chemin de calcul ne change pas) : **dévers d'une droite** `/i` `/j` (naît et meurt en un bloc), **virage en pente** `/+` `/-` (la pente naît et meurt avec l'arc, se combine au relevé), **virage-tremplin** `/k` (les 16 derniers mètres de l'arc montent d'un niveau), **appel sur une crête** (une montée suivie d'un vide). Règle complète : `docs/regles/sim/grammaire-des-sauts-lot-57.md`.

Page : **`/track/?scenario=sauts`** (deux touchers jusqu'à un élément ; « Essayer », « Variante 2 », « Miroir »). Fenêtre de vitesse au bord : plancher × 1,08 → plafond (borné à la vitesse du pilote + 6 m/s), vérifiée par la simulation avec cap ± 4° et ± 2 m de l'axe.

| saut | parties (approche · appel · vol · réception · sortie · vitesse) | fenêtre au bord | pilote | thèmes proposés |
|---|---|---|---|---|
| `saut-biais` | droite · **dévers** · tournant · décalée, plus basse · droite · élan | 36–50 m/s | 44 | Stade, Nuit |
| `saut-angle` | virage · **virage-tremplin** · tournant · **en angle** (virage) · droite · élan | 36–43 | 36 | Stade, Canyon |
| `saut-courbe` | virage · **virage-tremplin** · tournant · décalée · droite · élan | 36–47 | 40 | Stade, Rallye, Col |
| `saut-reception-relevee` | virage · plat · axe · **dans un virage relevé** · droite · élan | 36–43 | 36–44 | Stade, Nuit |
| `saut-drop` | virage · plat · axe · **deux niveaux plus bas** · virage · élan | 31–50 | 44 | Canyon, Col |
| `saut-step-up` | descente · **crête** · axe · **plus haute** · droite · élan (var. 2 : plaque) | 43–52 (59–68) | 44 (62) | Stade, Col |
| `saut-elan` | **chicane** · plat · axe · même niveau · droite · **élan : freiner = tomber court** | 43–50 | 44 | Rallye, Campagne |
| `saut-double` | droite · plat · axe · **sur le second appel** · droite · élan | 43–50, puis 36–50 | 44 / 44 | Canyon, Rallye |
| `saut-bosse` | droite · **crête sans tremplin** · axe · plus basse (var. 2 : terre) · droite · élan | 36–48 | 42 | Rallye, Campagne |
| `saut-herbe` | droite · plat · axe · **herbe de course** (var. 2 : terre) · virage · élan | 36–50 | 44 | Campagne, Rallye |
| `saut-chicane` | droite · plat · axe · plus basse · **chicane** (var. 2 : virage serré) · élan | 31–50 | 44 | Ville, Canyon |

| transition | ce qu'elle demande | thèmes proposés |
|---|---|---|
| `transition-crete` | le virage commence au sommet : la voiture est légère en braquant | Campagne, Rallye |
| `transition-compression` | le virage commence au creux : elle s'écrase et tient mieux | Col, Canyon |
| `transition-devers` | la route penche peu à peu avant un virage : vers l'intérieur (aide) ou l'extérieur (var. 2, contre-dévers) | Col, Nuit |
| `transition-pente` | un virage qui monte puis un qui descend (var. 2 : deux niveaux dans un ample) | Col, Campagne |
| `transition-esse` | S relevé en descente : le relevé change de côté en plongeant | Col, Stade |
| `transition-retrecissement` | la route se resserre en montant, un serré derrière la crête | Campagne, Ville |
| `transition-appui` | la seconde moitié d'un long virage passe sur la glace (var. 2 : l'herbe de course) | Banquise, Campagne |

**Signalétique (jamais de saut à l'aveugle)** : chaque réception porte désormais deux **balises** (poteau, panneau à flèche verte) dont la tête dépasse le bord de l'appel — d'autant plus hautes que la réception est basse ; vues depuis l'appel sur le saut en contrebas (8 m plus bas), invisibles avant. Le virage-tremplin a ses chevrons et sa bande d'alerte. **Cela vaut aussi pour les sauts des circuits actuels** (rendu seulement, rien de la simulation) : à garder ou à réserver aux nouveaux sauts, au choix de Nathan.

**Ce que la simulation ne permet pas (honnête)** : un tremplin en dévers donne du roulis et une petite dérive (réception décalée de 2 à 4 m), **pas un vrai changement de trajectoire** : la voiture ne reçoit de poussée latérale que de la pesanteur et des pneus. Le vrai « vol tournant » vient du virage-tremplin (la caisse tourne encore au décollage : jusqu'à 0,6 rad/s mesuré, 37° de cap à la réception si on ne fige pas). Le **contrôle aérien** reste celui du lot 19 (frein = figer) : on oriente la caisse en choisissant quand figer, rien de plus ; un vrai pilotage en l'air serait un comportement nouveau (`?debug&tune`), non fait.

Captures (appel puis réception, palette du premier thème proposé) : `docs/lots/lot-57-sauts-transitions/captures/` (`CAPTURES=1 npx playwright test captures-lot57 --project=chromium`).

## Vérifié
- `packages/sim` : suite complète verte (626 tests : golden des versions publiées, rediffusions de référence, `figures`, `variete365`…) ; seul échec au premier passage, `legerete.test.ts` : `grammaire.ts` tire les figures, il rejoint la liste des fichiers lourds (il n'est jamais dans le premier chargement).
- `test/grammaire.test.ts` : 18 éléments finis par le pilote dans chaque variante, deux sens, trois largeurs ; chaque saut se pose sur toute sa fenêtre de vitesse et d'angle.
- `apps/web` : tests unitaires verts (1 237) ; captures produites, 5 regardées.
- Budget (`node scripts/budgets.mjs` après `npm run build`) : voir « Budget ».

## Non vérifié
- Le jeu au téléphone (à faire par Nathan, liens ci-dessous). L'écart pilote / humain sur ces sauts (étape 3, avec les circuits générés).
- Le décor posé près d'un virage en pente : `decor/commun.ts`, `existant.ts` et `ville.ts` lisent la hauteur d'un virage à plat (`b.y0`, ou `b.y0 + b.rise / 2`) ; un arbre ou un immeuble peut flotter ou s'enfoncer d'un niveau au plus près des prototypes. À reprendre à l'étape 3 pour les éléments gardés (règles de pose du lot 37).
- L'étape 3 entière : générateur, compatibilités, budget de technicité, poids par thème, golden de la nouvelle version, 60 circuits par thème, ressemblance et temps de génération avant / après.

## Budget (`node scripts/budgets.mjs` après `npm run build`, `main` b725556 contre la branche)
| mesure | `main` | lot 57 | écart | plafond |
|---|---:|---:|---:|---:|
| premier chargement JS + CSS | 298 087 | 299 086 | **+999 o** (cible ≤ +1,5 ko) | 312 Ko |
| fil des circuits (miniatures, circuit du jour) | 29 472 | 30 187 | +715 | 33 Ko |
| fil du Salon | 31 618 | 32 350 | +732 | 35 Ko |
| catalogue anglais · admin | 7 990 · 12 278 | 8 006 · 12 361 | +16 · +83 | 9 · 14 Ko |

Le premier chargement porte la géométrie (`liftAt`, lecture des modificateurs) et le rendu (balises, marques du virage-tremplin) ; la page et les textes des prototypes sont chargés avec les scénarios. `budgets.md` n'est pas retouché à cette étape (les chiffres bougeront à l'étape 3) ; sa ligne de Track (296 957) était déjà en retard sur `main` (298 087).

## Décisions pour Nathan
1. Chaque saut et chaque transition : garder, retoucher, écarter.
2. Les balises de réception sur tous les sauts (anciens circuits compris), ou seulement sur les nouveaux.
3. Un vrai contrôle aérien (orienter la caisse au volant en l'air) : comportement nouveau, réservé aux blocs nouveaux — à faire ou non.

## À tester (aperçu de la PR, au téléphone)
`/track/?scenario=sauts`, puis chaque élément (« Essayer », « Variante 2 », « Miroir »). Les sauts doivent se lire avant l'appel et demander un vrai geste.
