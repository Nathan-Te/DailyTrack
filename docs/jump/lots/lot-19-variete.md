# Lot 19 — Variété des passages (DailyJump)

Retour de Nathan : d'un jour à l'autre, **on reconnaît vite les passages** ; ce qui se répète, c'est le **morceau de base**, quelle que soit sa variante (en g12 : `escalier-friable` les 31/10, 03/11 et 05/11 ; `mur-friable` les 29/10, 04/11 et 05/11). Objet : qu'un même morceau de base revienne rarement, et qu'il ne se ressemble plus quand il revient.

Versions : `JUMP_GENERATOR_VERSION` **14** (identifiants `…-g14`) · `JUMP_SIM_VERSION` **4, inchangée** (aucune ligne de la physique, de `level.ts`, `attempt.ts`, `player.ts` ni `replay.ts` n'a bougé) · **golden v3 identiques** (`golden.json`, `replay-golden.json`, `daily-golden.json` : aucun octet modifié) · golden v4 régénérés. Consignes ajoutées : `packages/jump-sim/CLAUDE.md` (« Variété (lot 19) »), `apps/jump/CLAUDE.md` (« Outil de la variété `?semaine` (lot 19) »).

## 1. Mesure d'abord (générateur g13, 365 dates à partir du 27/10/2026)
Outil nouveau : `npm run variete:jump -w @cdj/jump-sim` (`tools/variete.ts`), au niveau du **morceau de base**.

| mesure | g13 (avant) | g14 (après) |
|---|---|---|
| morceaux de base permis par thème (communs + du thème) | forêt 57 (9) · usine 55 (7) · glace 55 (7) · nuit 55 (7) · néon 54 (6) | inchangé (aucun morceau ajouté) |
| morceaux par niveau (moyenne) | 10,3 à 10,9 | 10,4 à 10,9 |
| les dix plus fréquents (apparitions sur 365 jours) | plongeon 127 (un jour sur 2,9) · puits 108 · mur-seul 99 · escalier-friable 98 · descente-scies 97 · demi-tour 96 · ascenseur 89 · pendule 89 · cheminee-vide 87 · chute-pics 87 | plongeon 87 (un jour sur 4,2) · puits 84 · cheminee-vide 83 · chute-pics 82 · puits-descente 82 · demi-tour 81 · lucarne 78 · descente-scies 75 · mur-seul 75 · pendule 71 |
| **écart entre deux apparitions du même morceau** : moyenne · **minimum** · médiane | 7,66 · **1** · 5 jours | 7,76 · **3** · 5 jours |
| retours à 1 jour · à 2 jours | 243 · 912 (30,5 % des retours avant 3 jours) | **0 · 0** |
| retours avant 4 / 5 / 7 jours | 39,3 % / 48,2 % / 60,4 % | 20,9 % / 37,4 % / 61,0 % |
| morceaux de base distincts sur 7 jours glissants (min · moyenne · max) | 39 · 49,1 · 58 | **50 · 56,3 · 65** |
| … sur 30 jours glissants | 73 · 78,2 · 83 | 75 · 80,4 · 83 |
| un même morceau sur 7 jours glissants, au plus (`measure:jump`, 120 dates) | 4 fois (19 morceaux) | **3 fois** (aucun au-delà) |
| morceaux en commun entre deux jours consécutifs (`measure:jump`, 120 dates) | 0,61 en moyenne, 3 au plus | 0,02 en moyenne (*) |
| secours | 0 | **0** |

(*) Le seul jour en commun de la mesure (2 morceaux) est la jonction du 26/10 calculé par g14 avec le 27/10 : en vrai le 26/10 est figé (g10), et c'est son contenu réel que la règle lit (§ 2) ; sur les 365 dates à partir du 27/10 : **aucun**.

## 2. Règle anti-répétition : W = 3
**Un morceau de base ne revient pas avant `VARIETY_DAYS` = 3 jours** : deux niveaux à moins de 3 jours d'écart n'ont aucun morceau en commun, toutes variantes confondues. Pour les niveaux v4, elle **remplace le repos par groupes** (la référence v3, g9, le garde au bit près).

### Pourquoi 3 (et pas 5 ou 7)
Deux contraintes : **bornée** (pas de chaîne qui oblige à regénérer tout l'historique, un niveau sous 2 s) et **0 secours**.
- Une règle « chaque jour écarte les W − 1 précédents » est une **chaîne sans fin** (le 27/10 dépend du 26, qui dépend du 25…). Pour la borner il faut des **coupures**. Une coupure statique (deux moitiés du catalogue de part et d'autre) coûte trop : les jours proches de la coupure n'ont que la moitié du catalogue (mesuré en essai : impossible dès W = 4). Retenu : **des époques de 6 jours** (`VARIETY_EPOCH`) ; dans une époque chaque jour écarte les jours d'avant ; **les deux derniers jours d'une époque écartent aussi les deux premiers de la suivante**, qui, eux, ne regardent jamais en arrière au-delà de leur époque. Chaque paire de jours proches est couverte une fois, sans boucle ; un niveau dépend d'au plus **8 niveaux** (son époque et les premiers jours de la suivante). Le prix : le dernier jour d'une époque écarte les morceaux de **4 jours** (2 avant, 2 après) au lieu de 2 — c'est lui qui borne W.
- Mesures (générateur d'essai, 120 dates sauf mention ; « chaîne idéale » = sans borne, pour comparer) :

| règle | secours | tirages validés |
|---|---|---|
| chaîne idéale, W = 3 · 4 · 5 · 6 | 0 · 0 · **4** · **22** | 26,8 % · 23,4 % · 14,8 % · 8,6 % |
| époques, W = 3, 4 jours · 6 jours (365 dates) · 8 jours (365 dates) | 3 · 1 · 2 | 21,7 % · 28,1 % · 26,8 % |
| époques, W = 4, 6 · 8 · 10 jours (8 et 10 avec 150 tirages par jour) | 12 · 7 · 6 | 13,6 % · 11,1 % · 11,3 % |
| **retenu : époques de 6 jours, W = 3, avec les variantes du lot et les tirages prouvés dans l'ordre du score estimé** (365 dates) | **0** | 65,5 % des tirages rejoués |

W = 4 n'est tenable qu'avec une chaîne sans borne (interdite) ; W = 5 ne l'est même pas ainsi. **Le catalogue est trop mince** (§ 5).
- **Déterminisme** : tout se déduit de la date (position dans l'époque, `varietyNeighbours`) ; le niveau est le même calculé seul, après ses voisins, ou en remontant le temps (test, à froid).
- **Les jours figés comptent avec leur contenu réel** : `VARIETY_FROZEN` = les morceaux du 25 et du 26/10, **figés en g10** par la mise en production du 25/10 (la PR robot #135, pas encore fusionnée : **son commit est repris tel quel dans cette branche**, `apps/jump/public/levels/2026-10-24…26.json`) ; un test vérifie la table contre les fichiers. Les 27 et 28/10 les écartent.
- **La chaîne de figeage n'a pas à changer** pour cette règle (rien dans `scripts/`). **Réserve** (décision 1) : si g14 part en production après le 25/10, les jours figés par l'ancien code jusqu'à « demain » ne sont pas dans la table ; la règle peut casser à la jonction pendant 2 jours.
- **Temps de génération** (`variete:jump`, à froid : dépendances de variété comprises, 72 dates) : **moyenne 0,44 s, maximum 1,51 s, aucune au-dessus de 2 s** (g13 : 0,34 s par niveau sans dépendance, 1,12 s au plus). Pour y arriver, sans changer aucune règle de validation :
  - les tirages sont **prouvés dans l'ordre de leur score estimé** (durée et exigence de la composition) par lots de 6 ; le premier valide dont la plus longue course tient sous 1,2 s arrête le lot (sinon le meilleur score rejoué du lot) ; un tirage dont l'**exigence estimée** sort de la fenêtre ou ne monte pas en tension est refusé sans rejeu (c'était le premier motif de refus après rejeu). Rejoués : 2 à 3 tirages par jour au lieu de 6 à 8 ;
  - trois rejeux de moins par tirage, **mêmes niveaux au bit près** (vérifié sur 40 dates v4 et v3 avant / après) : la chaîne fournit l'état v3, un seul rejeu sert à la course au sol et aux voies lentes, un niveau trop haut est refusé avant le rejeu, les morceaux construits sont gardés ;
  - jusqu'à 120 tentatives (`DAILY_MAX_ATTEMPTS_V4`) : une impasse ne coûte presque rien.
- **Défaut trouvé (lot 16) et corrigé** : la géométrie d'une voie lente déborde de son morceau (mur gauche de la cage après le palier de sortie du morceau d'avant ; descente murée au-dessus du palier de sortie) ; une **reprise** sur le point de passage, qui joue la solution « arrêt » du morceau seul, s'y cognait (19/10 et 02/11 en g14 : `chute-pics` suivi d'une portion dure). Le test de `daily.test.ts` ne le voyait que sur 20 dates ; c'est maintenant une **règle du générateur** (`slowRespawnProblems`). Le **secours de la forêt** la cassait : rechoisi (`secours:modules -- --theme=foret`, 80 valides sur 80), l'ancien gardé pour la v3.

## 3. Mutateurs de silhouette
### Inventaire des mutateurs existants (lots 7 à 13 ; emplois sur 120 niveaux g13)
`plafond` (99 : plafond plein ou garni de pics) · `fosse` (29 : fond vide ↔ fond de pics) · `sol-friable` (78) · `patrouille` (18 : une scie mobile de plus) · `garde` (63 : pics contre un mur) · `ressort` (3) · `denivele` (203 : la fin descend ou monte) · `surface` (18 : glace, tapis) · `clignotant` (11) · `alterne` (14) · `vent` (20). Ils changent surtout le **danger** ou la **mécanique** d'un passage ; la **forme** (hauteurs, largeurs, places) ne variait que par les paramètres `repeter` écrits à la main.

### Les quatre nouveaux (`modules.ts`, au plus 2 par variante comme avant)
| mutateur | zone | effet |
|---|---|---|
| **`hausse`** — hauteur des marches et des murs | `zone hausse <colonnes> <rangée>` | `+hausse:<k>` (−3 à 3) : le haut d'une colonne pleine monte de k rangées ou descend de −k |
| **`ecart`** — largeur des écarts | `zone ecart <colonnes>` | `+ecart:<k>` (−1, 1, 2, 3) : ces colonnes recopiées 1 + k fois (une plage `repeter` de plus, qui ne doit en chevaucher aucune ; tout ce qui suit se décale, scies comprises) |
| **`decale`** — position des dangers | `zone decale <colonnes> <rangées>` | `+decale:<dc>[:<dr>]` : pics, scies fixes et points des scies mobiles du rectangle se déplacent d'un bloc ; un pic arrive sur un support du même côté |
| **`echange`** — un danger contre un autre de même exigence | `zone echange <colonnes> <rangées>` | `+echange:scies` (pics → petites scies fixes `o`) ou `+echange:pics` (l'inverse, tournés vers leur support) ; **gardée seulement si sa note est celle de sa variante d'origine** (test) |
| **mécanique du thème dans les morceaux génériques** | (mutateurs existants) | `surface:glace` / `tapis`, `clignotant:calme`, `vent:haut` posés sur des morceaux sans mécanique |

### Variantes admises (37, **ajoutées au bout de leurs morceaux**, `V4_ONLY_VARIANTS` : la référence v3 ne les connaît pas)
Toutes passent `solve:modules` (jouables aux deux entrées), `phases:modules` (8 phases, attente ≤ 12 s ; aucune nouvelle refusée), la règle du lot 8c (gigue ±3 ≥ 50 %, raccord ≥ 90 %, appuis humains), la règle des 1,5 s du lot 18 (profil `calme`), `voies:modules` (aucune voie parasite), et les règles du catalogue (plats, respiration notée 2 au plus avec trois sauts, vent jamais vers un danger caché). Note = exigence (arrêt / élan).

| variante | réglage | note | thème |
|---|---|---|---|
| ascenseur v6 | `trou=1 cycle=240 +hausse:1` | 1 (1/1) | tous |
| ascenseur v7 | `trou=1 cycle=240 +surface:glace` | 1 (1/1) | glace |
| cheminee-vide v4 | `large=1 haut=1 +hausse:-2` | 5 (5/5) | tous |
| cheminee-vide v5 | `large=1 haut=2 +vent:haut` | 2 (1/2) | forêt |
| chute-pics v5 | `prof=1 +decale:0:2` | 5 (3/5) | tous |
| chute-pics v6 | `prof=2 +decale:0:-2` | 3 (3/1) | tous |
| chute-pics v7 | `prof=3 +echange:scies` | 4 (4/4) = v1 | tous |
| corniches v5 | `large=1 +hausse:2` | 1 (1/1) | tous |
| corniches v6 | `large=1 +surface:glace` | 1 (1/1) | glace |
| demi-tour v6 | `ecart=1 +hausse:2` | 2 (1/2) | tous |
| descente-scies v6 | `cycle=240 +hausse:1` | 2 (2/2) | tous |
| descente-scies v7 | `cycle=240 +decale:0:2` | 1 (1/1) | tous |
| descente-scies v8 | `cycle=180 +hausse:-1` | 3 (3/1) | tous |
| escalier-friable v3 | `large=2 +hausse:1` | 4 (4/4) | tous |
| iles-scie v6 | `ecart=1 cycle=240 +decale:0:2` | 3 (3/1) | tous |
| lucarne v4 | `fenetre=2 +surface:glace` | 5 (2/5) | glace |
| mur-friable v4 | `haut=3 +ecart:1` | 5 (1/5) | tous |
| mur-seul v6 | `haut=1 +hausse:2` | 4 (4/4) | tous |
| mur-seul v7 | `haut=2 +hausse:-2` | 2 (2/1) | tous |
| mur-seul v8 | `haut=2 +surface:glace` | 4 (3/4) | glace |
| pendule v6 | `cycle=180 +hausse:2` | 2 (2/2) | tous |
| pendule v7 | `cycle=240 +decale:2` | 1 (1/1) | tous |
| pendule v8 | `cycle=180 +surface:glace` | 1 (1/1) | glace |
| petits-trous v6 | `trou=1 +hausse:1` | 2 (2/1) | tous |
| petits-trous v7 | `trou=2 +surface:glace` | 1 (1/1) | glace |
| petits-trous v8 | `trou=1 +clignotant:calme` | 1 (1/1) | nuit |
| plongeon v6 | `cycle=240 +hausse:-2` | 1 (1/1) | tous |
| puits v4 | `large=1 prof=4 +ecart:1` | 2 (2/2) | tous |
| puits v5 | `large=1 prof=6 +echange:scies` | 4 (2/4) = v0 | tous |
| quinconce v6 | `ecart=1 +decale:1` | 1 (1/1) | tous |
| rebonds-doux v5 | `long=1 +surface:glace` | 1 (1/1) | glace |
| rebonds-doux v6 | `long=2 +clignotant:calme` | 1 (1/1) | nuit |
| saut-long v6 | `trou=5 +hausse:1` | 1 (1/1) | tous |
| saut-long v7 | `trou=6 +hausse:-1` | 1 (1/1) | tous |
| scie-ronde v6 | `cycle=240 +hausse:1` | 1 (1/1) | tous |
| tunnel v5 | `long=1 +hausse:1` | 2 (1/2) | tous |
| tunnel v6 | `long=2 +surface:tapis:droite` | 2 (2/2) | usine |

Emplois sur 120 niveaux g14 : `hausse` 56 · `ecart` 15 · `decale` 21 · `echange` 6 (47,4 % des morceaux posés ont au moins un mutateur, 43,4 % en g13). `MAX_VARIANTS` **reste 10** (le plus chargé : `descente-scies`, `mur-seul`, `pendule`, `petits-trous`, 9).

### Variantes refusées (retirées, aucune règle relâchée)
| candidate | pourquoi |
|---|---|
| ascenseur `trou=1 cycle=180 +decale:1` | au pas près en élan (gigue 54 / 23,5 / 14,5 %) |
| cheminee-vide `large=1 haut=1 +ecart:1` | raccord 88 % (< 90 %), gigue ±3 32,5 % |
| demi-tour `ecart=3 +hausse:-1` | ne se construit pas (corniche d'une rangée : rien à abaisser) |
| escalier (respiration) `+surface:tapis:gauche`, `+alterne` | notées 3 en élan (une respiration : 2 au plus) |
| corniches (respiration) `+clignotant:calme` | deux sauts seulement (une respiration en demande trois) |
| plongeon `cycle=300 +vent:droite` | le vent pousse vers une scie hors de l'écran du téléphone (règle du lot 13) |
| cinq échanges : cheminee-vide `+echange:scies` (2 contre 4), chute-pics `prof=1 +echange:scies` (4 contre 5), demi-tour `ecart=2` (2 contre 4) et `ecart=1` (3 contre 2) `+echange:scies`, mur-friable `haut=4 +echange:scies` (5 contre 2), quinconce `ecart=1` (2 contre 1) et `ecart=2` (2 contre 1) `+echange:pics` | note différente de leur variante d'origine : pas « de même exigence » |

## 4. Catalogue embarqué compacté (budget)
Chaque solution embarquée répétait en base64 l'en-tête de sa rediffusion (`module:<id>:<n>`, incompressible) et des clés JSON. Le catalogue embarqué (`MODULE_PACKED`) ne garde plus que les séries et `[entrée, sortie, note]` ; tout le reste se déduit (`unpackCatalog`), et le déplié est **exactement** la projection de `modules/solutions.json` (test). **Jump : 375 917 → 374 469 o (−1 448 o)** avec la règle, 37 variantes et l'outil ; marge 4 021 o (`docs/plateforme/budgets.md`).

## 5. Ce qui manque au catalogue (un lot de contenu)
Estimation (script d'essai du lot, non gardé dans le dépôt : sous la règle bornée, le jour le plus chargé écarte les morceaux de 2 (W − 1) jours ; la plus petite réserve vue à W = 3 avec 0 secours, de 20 à 25 morceaux de base selon le thème, sert de seuil) : **morceaux de base à ajouter** pour tenir…

| thème | W = 4 (jour moyen · pire jour) | **W = 5** (moyen · pire) | W = 7 (moyen · pire) |
|---|---|---|---|
| forêt | 5 · 11 | **11 · 17** | 17 · 22 |
| usine | 2 · 9 | **8 · 14** | 14 · 19 |
| glace | 6 · 12 | **12 · 16** | 18 · 23 |
| nuit | 6 · 11 | **12 · 17** | 17 · 21 |
| néon | 3 · 7 | **9 · 15** | 15 · 19 |

Un morceau **commun** compte pour tous les thèmes : pour W = 5, **une quinzaine de morceaux communs de plus** (un quart du catalogue commun, 48 aujourd'hui), dont des respirations (6 communes, une par niveau) et des portions notées 4 ou 5 (la « pointe » imposée est le premier motif d'impasse), serait le bon ordre de grandeur. C'est une estimation, à reprendre par la mesure du lot de contenu.

## 6. Générateur g14 : comparatif avec g13 (`npm run measure:jump`, 120 dates du 16/10/2026 au 12/02/2027, même machine ; g13 mesuré sur `main`)
| mesure | g13 | g14 |
|---|---|---|
| tirages essayés · composés | 780 · 530 (67,9 %) | 852 · 605 (71,0 %) |
| tirages rejoués · **validés parmi les rejoués** | 530 · **49,2 %** | 235 · **65,5 %** (240 écartés sans rejeu, 130 refusés sur l'estimation) |
| **niveau de secours** | **0** | **0** (et 0 sur 365 dates, `variete:jump`) |
| temps de l'auteur (min · moyenne · max) | 28,08 · 29,40 · 31,93 s | 28,01 · 29,62 · 31,95 s |
| exigence par minute (moyenne) | 495,4 | 488,6 |
| tiers d'exigence (moyennes) | 13,7 · 19,3 · 35,7 | 14,0 · 20,4 · 35,0 |
| voies lentes par niveau (min · moyenne · max) · surcoût moyen | 1 · 2,0 · 3 · 4,51 s | 1 · 1,9 · 4 · 4,41 s |
| « toutes voies lentes » ÷ auteur (moyenne · max) | 1,313 · 1,564 | 1,277 · 1,679 |
| plus longue course au sol sans saut (moyenne · max) | 1,12 · 1,80 s | 1,15 · 1,98 s |
| hauteur · largeur (moyennes) | 48,1 · 284,9 | 49,4 · 285,1 |
| génération d'un niveau, cache chaud (moyenne · max) | 380 · 1 120 ms | 134 · 632 ms |
| par thème : tirages validés (des essayés) · secours | forêt 34,7 · usine 20,3 · glace 35,3 · nuit 31,0 · néon 45,4 % · 0 | 14,7 · 17,6 · 24,3 · 18,2 · 18,0 % · 0 (ces taux comptent les tirages écartés sans rejeu) |
| thème forcé (12 dates × 5) : secours | 0 | 0 |

Les mesures du § 1 (avant / après) sont celles de `variete:jump`.

## 7. Jours régénérés
**Aucun jour public ni figé n'est touché.** Les fichiers figés (16 → 26/10/2026 ; les 24, 25 et 26/10 en g10, repris du robot de la mise en production du 25/10) sont intacts et se rejouent (`figes.test.ts`). **Les jours g14 commencent le 27/10/2026** (J + 2 de la PR, ouverte le 25/10 ; c'est aussi `VARIETY_ORIGIN`). **Les 120 niveaux mesurés à partir du 27/10 changent tous** par rapport à g13 (la règle touche chaque jour). La première semaine g14 (temps de l'auteur ; morceaux) :

| date | thème | auteur | morceaux |
|---|---|---|---|
| 27/10 | forêt | 31,950 s | vent-puits v1, grande-scie v5, tremplin v3, pendule v3, cheminee v1, piliers-scie v0, descente v4, vent-colonne v0, vent-rafale v4, escalier-friable v2, puits-descente v3 |
| 28/10 | néon | 29,792 s | iles-friables v0, saut-plafond v0, scie-sol v1, neon-pics v2, neon-relais v1, petits-trous v6, cheminee-scie v2, ressort-mur-iles v1, neon-couloir v2 |
| 29/10 | forêt | 29,950 s | ressort-mur v1, plongeon v6, vent-derive v0, lucarne v3, scies-jumelles v3, mur-trous v3, tunnel v3, plafond-pics v2, vent-relais v0, demi-tour v3 |
| 30/10 | néon | 30,050 s | descente-scies v4, escalier-friable v3, neon-silence v2, mur-seul v7, neon-respiration v0, marelle v0, cheminee-pics v2, neon-cheminee v0, iles-scie v6, pont-friable v4, puits v2 |
| 31/10 | nuit | 30,700 s | nuit-escalier v5, ascenseur v6, saut-long v0, ressorts-trous v0, puits-descente v2, nuit-pont v8, nuit-marelle v4, piliers v6, nuit-opposition v6, cheminee v0, paroi-friable v1 |
| 01/11 | forêt | 28,008 s | vent-derive v1, scie-sol v0, vent-colonne v4, scies-jumelles v3, tunnel-scies v1, tunnel v0, plafond-pics v0, tremplin v1, demi-tour v1, vent-pont v3, ressort-plafond v1 |
| 02/11 | glace | 28,733 s | cheminee-pics v0, glace-corniches v0, plongeon v6, piliers-scie v0, glace-promenade v3, grande-scie v0, ressort-mur-iles v3, cheminee-vide v4, lucarne v4, chute-pics v5 |

Démonstration `?api=demo` régénérée (`npm run jump:seed -w @cdj/api`, 15 jours). Journée de référence du déterminisme v4 : **du 31/10 au 09/11** (le 31/10 en g14 n'a plus de reprise au départ parmi ses essais fictifs ; le 09/11, une nuit, en a 21). Les tests du serveur de Jump (`jumpBoard`, `jumpBundle`, `jumpProfile`) passent du 20/10 au **29/10** : le 20/10 en g14 n'avait presque plus d'essais fictifs qui arrivent (dette connue des joueurs fictifs v4, lot 16).

## 8. Outil `?semaine`
`?semaine=AAAA-MM-JJ` : les 7 niveaux du jour à partir de la date, côte à côte ; pour chacun une **miniature** (plein en gris, mécanique en crème, dangers en rouge, repères et colonnes des morceaux qui reviennent en jaune) et la **liste de ses morceaux de base** ; **un morceau présent dans plusieurs jours est surligné** (son infobulle dit les autres dates). `&generateur=13` montre la même semaine en g13, lue dans `apps/jump/public/outils/semaine-g13.json` (du 27/10 au 23/11, produit avec le code de `main` d'avant le lot). Outil en français, exempté des catalogues ; chargé à la demande comme la galerie (`semaine-*.js`, 2 175 o, compté par la mesure du budget comme `gallery-*.js` : décision 4). Captures : `img/lot-19-semaine-g14.png`, `img/lot-19-semaine-g13.png`. e2e : `semaine.spec.ts`.

## 9. Tests et vérifications
- **Nouveaux** : `packages/jump-sim/test/variete.test.ts` (la règle sur **365 dates** jours figés compris et secours 0, couverture et bornes des époques, déterminisme à froid dans tout ordre, les variantes ajoutées passent les règles v4, un échange garde la note d'origine), `modules.test.ts` (les quatre mutateurs : effet exact, refus clairs), `attente.test.ts` (les variantes sans horloge n'ont pas de phases), `apps/jump/test/semaine.test.ts` (table des jours figés = fichiers, outil), e2e `semaine.spec.ts`.
- **Adaptés, sans affaiblir** : tests du repos par groupes passés sur la référence v3 (où il existe encore) ; versions (14) ; jours fixes des tests serveur (§ 7) ; délais d'exécution de trois tests (`niveau.test.ts` 30 s : le premier niveau se calcule avec ses voisins ; `jumpHistory.test.ts` 180 s : 65 s mesurés seul, les essais fictifs du 30/10 coûtent 10,5 s contre 5,5 s en g13 ; `variete.test.ts` 600 s).
- **Vérifié en local** : `npm run typecheck` ; Vitest (projet SQLite) de `packages/jump-sim`, `apps/jump`, `apps/api`, `packages/ui` ; golden v3 inchangés ; e2e Chromium `semaine`, `jour`, `chargement`, `voie-lente`, `horloge`, `replay` ; construction et poids ; captures de l'outil lues à l'œil.
- **Non vérifié en local** : Firefox et WebKit, projet libSQL, les autres e2e de Jump : la CI complète (commit `[ci complet]`).

## 10. Décisions laissées à Nathan
1. **Jonction avec les jours figés** : `VARIETY_ORIGIN` = 27/10 et `VARIETY_FROZEN` (25 et 26/10, g10) supposent une mise en production de g14 le 25 ou le 26/10. Plus tard, les jours figés par l'ancien code jusqu'à « demain » ne sont pas dans la table et la règle peut casser pendant 2 jours à la jonction : il faudra décaler `VARIETY_ORIGIN` et compléter la table avec les fichiers figés (ou, lot de plateforme, que le jeu et le serveur lisent les jours figés voisins). La PR robot #135 (jours figés du 24 au 26/10) est encore ouverte ; son commit est repris ici tel quel.
2. **W = 3** au lieu de 5 visés (§ 2, § 5) : un lot de contenu (≈ 15 morceaux communs) permettrait W = 5.
3. **Tirages prouvés dans l'ordre du score estimé** et **refus sur l'exigence estimée** : changent la façon de choisir le tirage (pas les règles d'un niveau valide) ; c'est ce qui tient la génération à froid sous 2 s. Le « taux de tirages validés » de `measure:jump` n'est plus comparable tel quel (§ 6 : validés parmi les rejoués).
4. **Budget de l'outil** : `semaine-*.js` est compté dans le premier chargement par `scripts/budgets.mjs` (zone partagée), comme la galerie ; proposition : ranger `semaine-` et `gallery-` parmi les fichiers « à la demande » (`budgets.md`).
5. **Règle de reprise près d'une voie lente** (§ 2) : défaut du lot 16 corrigé en règle ; secours de la forêt rechoisi.
6. Dettes toujours ouvertes : joueurs fictifs v4 qui reprennent mal après une mort (ils ont imposé le changement de jour de trois tests serveur), calibration des taux de tirages.

## 11. Scénario en 2 clics
*(Liens de l'aperçu de la PR : voir le commentaire « Aperçu » de la PR ; en local : `npm run dev:jump`.)*
- **La première semaine g14** : `…/jump/?semaine=2026-10-27` — à voir : aucun morceau surligné dans deux jours à moins de 3 jours d'écart ; des silhouettes nouvelles (`hausse`, `decale`…) dans les listes (`plongeon v6`, `mur-seul v7`, `chute-pics v5`).
- **La même semaine en g13** : `…/jump/?semaine=2026-10-27&generateur=13` — à voir : `plongeon` les 27 et 29/10, `ressorts-escalier` le 27 et le 30, `plafond-pics` et `puits-descente` les 27, 28 et 30/10, `mur-seul` les 31/10 et 01/11 : les retours à 1 ou 2 jours que Nathan reconnaissait.
