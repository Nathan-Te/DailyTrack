# Lot PBG1 — Pinball : plans de table, rampes, orbite, combo et mini-batteur

Premier des trois lots de contenu (PBG1 la forme des tables, PBG2 la boucle mission puis multibille, PBG3 les éléments qui se débloquent). Décisions de Nathan du 16/11 : ajoutées telles quelles à la fin de `docs/pinball/seed.md` (le seul changement du seed). Règles en vigueur : `packages/pinball-sim/CLAUDE.md` (« Les plans, les rails et le combo »), `apps/pinball/CLAUDE.md`, `docs/pinball/consignes.md`.

## Ce que le lot livre
- **Quatre plans de haut de table** (`packages/pinball-sim/src/plans.ts`, une donnée) ; le bas ne change pas. Le générateur tire **le thème, puis le plan, puis les modules** ; un plan ne revient jamais deux jours de suite (400 et 5 000 jours testés).

  | plan | rampes | mini-batteur | idée |
  |---|---|---|---|
  | `doublette` | 2, qui se croisent au sommet | non | chaque rampe ramène la bille dans le couloir de l'autre côté ; le plan le plus chargé |
  | `tremplin` | 1, au milieu, qui traverse la table | à droite | le mini-batteur alimente la rampe |
  | `bretelle` | 1, à gauche, qui contourne le haut | à gauche | le mini-batteur lance vers la bouche de la rampe |
  | `boucle` | 1, grande boucle à droite | non | la bille revient dans le couloir de gauche |

  Chaque plan a **son orbite** (un couloir le long de l'arc, bouches à gauche et à droite), **son trou** (présent dans tous les thèmes, le futur verrou du PBG2) et six emplacements dont deux fixes (l'élément du thème et le trou) : **quatre modules tirés au lieu de cinq** avant les plans. 500 tables possibles.
- **Les rampes et l'orbite, en entiers** : un rail est une autre couche (la bille ne touche plus le plateau), **prise à la bouche à 500 px/s ou plus**, plus lente elle redescend (la bouche est un mur) ; sur le rail la pente et le frottement la ralentissent, et si elle n'atteint pas le sommet elle ressort par l'entrée. Une rampe rapporte 800, l'orbite 500 (prise des deux côtés).
- **Le combo** : un rail réussi dans les 5 s qui suivent le précédent fait monter le compteur ; chaque rang ajoute 50 % de la valeur du rail (800, 1 200, 1 600, 2 000, 2 400 au rang 5, au plus), multiplié par le multiplicateur ; perdu avec la bille. Compteur « COMBO ×n » dans le HUD, avec sa jauge de temps.
- **Le mini-batteur** : il prend exactement l'angle du batteur du même côté ; **la rediffusion ne change pas de forme** (trois commandes).
- **Le rendu** : rails en volume et surélevés par thème (montagnes russes, toboggan aquatique, tube orbital, rail de wagonnet), la bille monte sur la rampe et passe devant le plateau ; rendu de secours : rails en couche au-dessus du sol ; plaques et flèches pour les rails ; HUD combo ; l'aperçu « Aujourd'hui » montre et nomme le plan ; `?plan=<id>` (combinable avec `?theme=` et `?robot`) ; huit curseurs dans `?debug&tune`.
- **Le robot** suit une bille sur un rail jusqu'à son bout (horizon de 2 400 pas) et vise donc les rampes et l'orbite avec la même méthode et les mêmes contraintes humaines ; **la validation exige que chaque rampe et l'orbite soient menées à leur bout au moins une fois sur chaque table**.
- Versions : `PINBALL_SIM_VERSION` 4, `PINBALL_GENERATOR_VERSION` 4, `PINBALL_BOT_VERSION` 3 ; golden régénéré (les quatre robots jouent quatre plans différents).

## Mesures
- **Validation des 500 tables** (`npm run valider:pinball -w @cdj/pinball-sim -- --ecrire`, 10 minutes sur 4 cœurs, 4,5 s par table) : **471 valides, 29 refusées** (`refusees.ts`, retirées au tirage : le jour passe à la graine suivante). Motifs : bille coincée (21 : une bille lâchée à l'arrêt qui se pose en équilibre sur le haut d'un poteau ou entre deux fins de murs — **18 sont sur `foire:tremplin`**, 10 % de ce couple), spinner jamais touché (5), mission jamais réussie (3). Aucun couple (plan, thème) n'est vidé : au pire 18 tables refusées sur 180.
- **Le robot, 30 jours** (`npm run robot:pinball -w @cdj/pinball-sim -- --jours 30`) : 30/30 tables valides, mission réussie dans 118 parties sur 120, **une table = 4,8 s en moyenne (6,9 s au pire)** pour les quatre parties des seuils. **Répartition par plan** (Diamant = meilleur score du robot) :

  | plan | jours | Diamant min / médiane / max | parties avec la mission | partie du robot / Diamant (médiane) |
  |---|---|---|---|---|
  | boucle | 8 | 52 500 / 116 400 / 157 700 | 31/32 | 75 % |
  | bretelle | 7 | 65 200 / 96 900 / 127 800 | 28/28 | 85 % |
  | doublette | 7 | 93 300 / 106 200 / 178 400 | 28/28 | 82 % |
  | tremplin | 8 | 74 800 / 122 000 / 204 800 | 31/32 | 77 % |

  Les plans sont comparables (médianes de 97 000 à 122 000). Les pourcentages des médailles ne bougent pas (15 / 35 / 60 % ; la partie du robot / Diamant : minimum 21 %, 10 % sous 52 %, 25 % sous 65 %, médiane 82 %). **Les scores du robot sont nettement plus hauts qu'avant les rails** (les rampes et le combo rapportent) : les seuils sont recalculés chaque jour, rien à régler, mais Nathan verra des Diamants à six chiffres.
- **Coût du rejeu** (`npm run mesures:pinball`) : 40/40 jours client = serveur au bit près ; **15 minutes (540 000 pas) = 138 ms**, 3,9 millions de pas par seconde (machine de ce lot ; le README du PB1 donnait 338 ms sur une autre machine : pas comparable, aucune régression mesurée). Un rail ne coûte rien de plus qu'un pas de bille.
- **Fluidité** (comme au PBV1 : Chromium de Playwright, 390 × 844, processeur ralenti ×4, WebGL logiciel, bille en jeu, bloom compris, plan `doublette`, le plus chargé) : Fête foraine 14,1 ms (141 appels, 65 439 triangles), Océan 13,4 ms (117 appels, 71 674 triangles), Espace 12,5 ms (124, 48 063), Volcan 12,9 ms (120, 50 645) : **tous sous 16,7 ms**, au niveau du PBV4 (13,3 à 14,7 ms). Les rails ajoutent 7 appels et 10 000 à 14 000 triangles (trois maillages au plus).
- **Budgets** (`mesureJeuNeuf`, gzip) : **premier chargement 44 722 o** (`pinball.jsCss`, inchangé : rien n'a été ajouté au premier chargement, `?plan=` se lit sans la liste des plans) ; **`pinball.rendu` 183 522 o** (plafond 178 Ko : dépassé) et **`pinball.demande` 238 455 o** (plafond 228 Ko : dépassé ; elle compte aussi les sons du PBS1, fusionnés sans relèvement). **Relèvement proposé, à confirmer par Nathan** : `pinball.rendu` 178 → 190 Ko, `pinball.demande` 228 → 245 Ko (marge de 6,5 Ko chacun ; refusé : retirer le commit de budgets et alléger `rails3d.ts`, environ 15 Ko avant compression). Écrit dans `docs/plateforme/budgets.md` (« Relèvements »).

## Vérifié, et non vérifié
- **Vérifié** : `npm run verifier` (typecheck, tests unitaires SQLite et libSQL, construction, e2e des zones) ; tests du paquet : chaque rampe et l'orbite (entrée, vitesse minimale, sortie, changement de couche, recul), le combo, le mini-batteur (le bon bouton le lève, 300 tirs à 1 500 px/s ne le traversent pas), aucune traversée ni bille coincée sur aucun plan (`themes-surete`, `rails`, `validation`), le déterminisme et le golden, l'absence de flottant, la règle des plans sur 400 jours ; le serveur rejoue les mêmes scores sur les quatre plans (`apps/api/test/pinball.test.ts`) ; captures regardées : chaque plan en three.js (quatre) et un en rendu de secours (Espace, bretelle).
- **Non vérifié** : le ressenti (Nathan joue) ; les plans sur un vrai appareil (rendu logiciel seulement) ; la bille sur une rampe en rendu de secours et en volcan (vue par les agents du lot en foire, océan et espace) ; le comportement des plaques sur d'autres tailles d'écran que 390 × 844 et 360 × 640.
- **Un échec déjà sur `main`, corrigé par une exception tolérée** : `packages/ui/test/chainesEnDur.test.ts` refusait trois chaînes de `apps/pinball/src/tune-sons.ts` (le panneau des sons du PBS1, vérifié sur un arbre propre de `origin/main`) : le fichier est déclaré outil interne dans `packages/ui/test/applications.ts` (`EXCLUSIONS`, comme `tune.ts`), une des exceptions tolérées d'un lot de jeu.
- **Les e2e de haute qualité** (`partie`, `rendu`, `classement`) sont sensibles à la charge de la machine : en parallèle d'un gros calcul l'écran de fin dépasse son délai (6,5 s mesurés sous charge), seuls sur la machine ils passent. À surveiller en CI.

## Décisions à valider par Nathan
1. **Points** : rampe 800, orbite 500 (entre la cible 250 et le trou 1 500), combo +50 % par rang jusqu'au rang 5, délai de 5 s ; **vitesse minimale d'entrée 500 px/s** (le plus long rail des quatre plans finit encore à 450 px/s) — tout est dans `reglages.ts` et dans `?debug&tune`.
2. **Les étiquettes sont plus serrées** : 40 à 59 % des plaques sont réduites à 68–100 % (15 % avant les plans), et la doublette recouvre parfois un rail avec une plaque. Les quatre plans sont plus encombrés que l'ancienne table ; les règles dures (aucune plaque n'en recouvre une autre, un module, un poteau, une lampe) tiennent, les seuils de lisibilité sont par plan (`test/etiquettes.test.ts`). Si tu trouves les textes trop petits, desserrer un plan (la doublette d'abord : emplacements (190, 150) et (262, 190) de la boucle).
3. **29 tables refusées sur 500**, dont 18 du couple foire × tremplin : acceptable, ou on décale un emplacement du tremplin.
4. **Le trou** de chaque plan est un module comme un autre (1 500 points) jusqu'au PBG2.
5. Le plan d'essai `classique` (la table des lots PB1 à PB4) reste dans le code pour les tests des règles ; jamais tiré.

## Les sons de PBS1
Le lot PBS1 était fusionné dans `main` à la fusion de ce lot : **les sons des nouveaux éléments sont ajoutés** (`sonsLogique.ts`, une ligne dans `Evenement`, une règle dans `sonsDuPas`, une recette, un délai ; `tune-sons.ts` : un exemple chacun, groupe « Les rails ») : prise d'un rail (`EV_RAIL`), recul (`EV_RECUL`), rampe réussie (`EV_RAMPE`), orbite (`EV_ORBITE`), combo (`EV_COMBO`, un demi-ton plus haut à chaque rang) ; `Photo.combo` est lu par la scène. Non écoutés (rien ne se vérifie à l'oreille ici) : à régler par Nathan avec `?debug&sons`.

## Scénario de test pour Nathan (2 clics)
Base de l'aperçu de la PR : `<aperçu>` (le jeu est `off` ; ces adresses jouent des essais, jamais classés).
- **Un lien par plan, un thème chacun** : `<aperçu>/pinball/?plan=doublette&theme=foire` · `?plan=tremplin&theme=ocean` · `?plan=bretelle&theme=espace` · `?plan=boucle&theme=volcan`.
- **Le robot sur le plan à deux rampes** : `<aperçu>/pinball/?plan=doublette&theme=foire&robot`.

Ce que Nathan regarde : les tables ne se ressemblent plus d'un jour à l'autre, une rampe réussie fait plaisir, une rampe ratée se comprend, et le combo donne envie d'enchaîner.

## Ouvert pour le lot suivant
- Le verrou du PBG2 prendra **le trou** de chaque plan ; la porte, le kickback et l'aiguillage (PBG3) ajouteront leurs emplacements au plan.
- Budgets `corps-` / `pinball.rendu` : voir le tableau de `docs/plateforme/budgets.md`.

Pour les joueurs : rien (le jeu est `off`).
