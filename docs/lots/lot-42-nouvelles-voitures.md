# Lot 42 — Track : de nouvelles voitures pour le Garage

Branche `claude/lot-42-nouvelles-voitures-0b1a8a` (imposée par la session ; le prompt proposait `lot-42-nouvelles-voitures`). Parti de `main` à `20b059d` : **le lot 40c (qualité des voitures) est fusionné** (PR #127), condition de départ remplie. Le standard suivi : [`lot-40c-voitures-qualite/standard.md`](lot-40c-voitures-qualite/standard.md).

## Où en est le lot : point d'arrêt n° 1 (la vitrine)

Les six silhouettes sont construites, au standard du 40c, et montrées dans la vitrine **à côté des quatre voitures existantes** : `/track/vitrine/?planche=voiture` (aperçu de la PR). **J'attends que Nathan garde, écarte ou fasse retoucher chacune** avant de passer aux déblocages, au Garage et à la couleur du motif.

| | fait | reste (après le tri de Nathan) |
|---|---|---|
| Six plans (D à I) | caisse tôle, détails, roues, feux, fantôme, vue capot, motifs ; tests des modèles | retouches demandées |
| Vitrine | onze colonnes (l'existant, la civile, A à I), paliers 1 et 2 à l'arrêt, fantômes, vue en mouvement (paliers 1 à 3), coûts | — |
| Déblocages | courbe proposée ci-dessous | `DEBLOCAGES`, tests d'API |
| Garage | — | fiches, noms, descriptions fr + en, couleur du motif (pastilles), captures |
| Budget | 0 o au premier chargement (mesuré) ; chaque voiture ≤ 4 ko | ligne de Track de `budgets.md` (dont la décision du 40c) |

## Les six voitures proposées

**S'inspirer d'un type, jamais d'un modèle** : chacune prend les proportions et l'esprit d'un **type** de voiture que tout le monde reconnaît ; aucune ne reprend la silhouette, la calandre, les phares, les prises d'air ou la ligne d'un modèle précis, ni marque, ni logo, ni nom (plaques vierges). Les noms sont des noms d'animaux en anglais, comme les quatre premières (à valider).

| plan | nom proposé | le type dont elle s'inspire | pourquoi elle | sa signature (ce qui la fait lire à 50 m) |
|---|---|---|---|---|
| D | **Badger** | la compacte de rallye (trois-portes des spéciales sur terre) | le type que le prompt cite en premier ; une compacte, mais haute et élargie : un autre caractère que la Sparrow | ailes rapportées, bavettes, rampe de quatre phares ronds, écope de toit, grand becquet à dérives, ouïes de capot |
| E | **Boar** | la muscle car à moteur avant | la silhouette la plus reconnaissable de toutes : long capot, arrière court | capot très long à bossage et écope, queue de canard, hanches larges, nez plat à calandre d'un bord à l'autre, pare-chocs en métal clair |
| F | **Armadillo** | le pick-up tout-terrain | la seule voiture « utilitaire » : une benne ouverte, posée haut | cabine carrée, benne (ridelles, plancher, hayon), grandes ailes en plastique sombre, pare-buffle, arceau, prise d'air de plongée |
| G | **Gecko** | le petit roadster deux places | la seule voiture découverte : on voit les sièges | habitacle ouvert, sièges crème, pare-brise bas dans son cadre, arceau, phares ronds, arrière court |
| H | **Sailfish** | la monoplace carénée d'autrefois | la plus « course » : roues à demi apparentes, sans changer la boîte de la simulation | fuseau au nez pointu, pontons, casque du pilote, grande dérive dorsale (la « voile »), ailes-carénages sur bras, aileron avant bas |
| I | **Pelican** | la fourgonnette de livraison d'autrefois | la voiture décalée, pour sourire ; et un grand flanc plein pour la livrée | caisse haute et ronde, ailes séparées en goutte, gros phares ronds sur les ailes, calandre à barreaux, marchepieds |

Écartées avant d'être dessinées : la **voiturette** (les roues sont imposées à 2,6 m d'empattement : une voiturette deviendrait un œuf étiré) et le **break familial** (trop proche de la Sparrow vue de dos). La fourgonnette est « d'autrefois » parce qu'une fourgonnette moderne de 1,4 m de haut (plafond du standard) se lirait comme une compacte ; ses ailes séparées et ses phares sur les ailes la font lire tout de suite.

**Purement cosmétiques** : mêmes `CarParams`, même boîte, mêmes points de contact, golden et rediffusions inchangés ; les roues sont aux points de contact (`voitureModeles.test.ts`). Le pick-up et la fourgonnette **paraissent** plus hauts (la caisse posée haut, la route se voit dessous) : c'est un dessin ; la monoplace a les roues apparentes **à leur place** (le fuseau se resserre entre elles).

### Captures (`docs/lots/lot-42-nouvelles-voitures/`)

- `voitures-p1.jpg`, `voitures-p2.jpg` : les six voitures (une par ligne, D à I) sous quatre angles (trois quarts arrière, profil, avant, arrière), paliers 1 et 2, en orange de Track avec la double bande ;
- `couleurs-p2.jpg` : chacune en glycine (claire : motif asphalte) et en pétrole (foncée : motif crème), trois quarts avant et arrière, palier 2 ;
- `nuit-voitures-p2.jpg` : les six sur la Nuit (motifs, numéro et feux allumés).

Outil : `CAPTURES=1 npx playwright test captures-lot42` (`-g quatre|couleurs|detail|vues` ; `VOITURES=D,E`, `COL=D`, `PALIER=1|2`, `THEME=theme-nuit`, `VUES="az,el,d[,cx,cy,cz];…"`).

### Mesures (au standard du 40c)

| plan | triangles palier 1 / 2 | fantôme | maillages | silhouette |x| / long. / haut. | œil de la vue capot | poids (plan seul, compressé) |
|---|---|---|---|---|---|---|
| D Badger | 3 961 / 9 264 | 368 | 6 | 1,045 / 4,08 / 1,39 m | +0,10 m | 2,1 ko |
| E Boar | 3 738 / 8 844 | 392 | 6 | 1,035 / 4,70 / 1,27 m | +0,06 m | 1,9 ko |
| F Armadillo | 3 969 / 9 404 | 392 | 6 | 1,045 / 4,67 / 1,39 m | +0,22 m, 15 cm plus en avant | 1,9 ko |
| G Gecko | 3 650 / 8 688 | 368 | 6 | 1,02 / 4,22 / 1,15 m | +0,03 m | 2,0 ko |
| H Sailfish | 3 972 / 10 300 | 440 | 6 | 1,02 / 4,50 / 1,20 m | — | 1,9 ko |
| I Pelican | 3 769 / 8 628 | 368 | 6 | 1,02 / 4,28 / 1,39 m | +0,16 m, 47 cm plus en avant (au-dessus du capot, devant le pare-brise) | 1,8 ko |

Plafonds tenus sans les relever : ≤ 4 000 triangles au palier 1, ≤ 12 000 au palier 2, six maillages, fantôme d'un maillage (≤ 460 au test ; la monoplace est à 440 : ses quatre ailes de roue restent dans le fantôme), |x| ≤ 1,06 m, longueur ≤ 4,75 m, hauteur ≤ 1,4 m. **Atelier commun** (`voiture/atelier.ts` : tubes, carénages de roue, phares ronds) : 0,65 ko, un morceau partagé chargé avec la première des six. Chaque voiture complète ≈ 2,5 à 2,8 ko compressés (≤ 4 ko). **Premier chargement : 0 o** (283 547 o, comme `main` : les six plans et l'atelier sont hors du morceau `voiture`, `vite.config.ts`).

**Nuanceur** : aucun changement (`nuanceurLivree.ts`, `modele.ts`, `forme.ts`, `surfaces.ts` intouchés) ; chaque plan n'écrit que son `CadreLivree` ; les boucles de joints ont la taille de chaque plan (2 à 8 segments sur les flancs). La compilation n'est donc pas plus longue que pour les quatre premières.

## La courbe de déblocage proposée (à valider ; pas encore dans `DEBLOCAGES`)

Avec les règles du lot 35 (l'or à 4,5 % du temps de l'auteur, l'auteur à 84 % du pilote), l'or est rare et l'auteur l'est encore plus : les voitures « faciles » se gagnent aux jours joués.

| ordre au Garage | voiture | condition | pour qui |
|---|---|---|---|
| 1 | Sparrow | dès le départ | — |
| 2 | **Pelican** | 3 jours joués | la première semaine (la voiture qui fait sourire arrive vite) |
| 3 | Weasel | 3 ors (inchangé) | — |
| 4 | **Badger** | 7 jours joués | une semaine de jeu |
| 5 | Moray | 10 jours joués (inchangé) | — |
| 6 | **Gecko** | 14 jours joués | deux semaines de jeu |
| 7 | **Armadillo** | 6 ors | les bons pilotes |
| 8 | Dragonfly | 1 médaille d'auteur (inchangé) | — |
| 9 | **Boar** | 30 jours joués | prestige : les plus assidus (un mois) |
| 10 | **Sailfish** | 3 médailles d'auteur | prestige : les meilleurs |

Conditions nouvelles qui me sembleraient meilleures (proposées, **non implémentées**) : « 7 jours d'affilée » (récompense l'assiduité plutôt que le total), « une médaille d'or sur chaque thème » (fait voir tous les thèmes), « finir 5 sessions du Salon ».

## Ce qui est à vérifier (connu)

- **La monoplace la nuit** : le phare de la scène (une lumière à 1,2 m devant et 0,75 m au-dessus du centre de la voiture, la même pour toutes) éclaire le nez bas de la monoplace, qui brille vu de face. Si Nathan garde la Sailfish, je propose une position du phare propre à chaque voiture (comme l'œil de la vue capot), quelques octets au premier chargement.
- **La vue capot** : l'œil est réglé par voiture (tableau) ; la fourgonnette et le pick-up l'avancent au-dessus du capot (sinon il serait sous le toit de la cabine).
- Le rendu sur un vrai téléphone et le temps d'image réel (rendu logiciel seulement ici).

## Vérifié / non vérifié (à ce point d'arrêt)

**Vérifié** : `test/voitureModeles.test.ts` sur les dix voitures (six maillages, plafonds, fantôme, roues aux points de contact et braquage, silhouette, vue capot à chaque inclinaison, feux stop) ; typecheck ; `e2e/vitrine-voiture.spec.ts` (onze colonnes, 33 vues dessinées, plafonds, vue en mouvement ; téléphone et axe) ; budgets (premier chargement inchangé) ; captures ci-dessus (rendu logiciel, Chromium).
**Non vérifié** : un vrai téléphone ; Firefox et WebKit ; la poursuite en jeu (les six ne sont pas encore au catalogue : `?voiture=` ne les connaît pas avant l'étape 3).

## Décisions pour Nathan

1. **Les six silhouettes** (vitrine) : pour chacune, la garder, l'écarter ou la retoucher (et quoi).
2. **Les noms** : Badger, Boar, Armadillo, Gecko, Sailfish, Pelican.
3. **La courbe de déblocage** ci-dessus (et l'ordre au Garage), ou une autre ; une condition nouvelle ?
4. **La monoplace la nuit** : une position du phare par voiture (quelques octets au premier chargement), ou rien.

## À tester (aperçu de la PR)

- `/track/vitrine/?planche=voiture` : les six nouvelles (colonnes D à I) à côté des quatre existantes, aux paliers 1 et 2, à l'arrêt (on tourne autour en glissant) et en fantôme ; « Vue en mouvement » sous chaque colonne (Stade, Nuit, Canyon ; palier 3 dans le dialogue) ; les pastilles de couleur, de motif et de teinte repeignent tout.
