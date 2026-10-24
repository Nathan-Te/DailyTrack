# Lot 42 — Track : de nouvelles voitures pour le Garage

Branche `claude/lot-42-nouvelles-voitures-0b1a8a` (imposée par la session ; le prompt proposait `lot-42-nouvelles-voitures`). Parti de `main` à `20b059d` : **le lot 40c (qualité des voitures) est fusionné** (PR #127), condition de départ remplie. Le standard suivi : [`lot-40c-voitures-qualite/standard.md`](lot-40c-voitures-qualite/standard.md).

## Où en est le lot : fini

**Point d'arrêt n° 1 (la vitrine)** : les six silhouettes, montrées dans `/track/vitrine/?planche=voiture` à côté des quatre existantes. **Décision de Nathan (24/10/2026) : « Tout est ok »** — les six voitures gardées sans retouche, les noms (Badger, Boar, Armadillo, Gecko, Sailfish, Pelican), la courbe de déblocage et l'ordre du Garage proposés, et le phare propre à chaque voiture (la monoplace la Nuit). La suite a été faite dans la même PR.

| | fait |
|---|---|
| Six plans (D à I) | au standard du 40c ; tests des modèles sur les dix voitures |
| Vitrine | onze colonnes (l'existant, la civile, A à I), paliers 1 et 2, fantômes, vue en mouvement (paliers 1 à 3), coûts |
| Déblocages | six lignes de `DEBLOCAGES`, l'ordre du Garage (`VOITURES_GARAGE`), tests de `sim` et d'API |
| Garage | les dix voitures au catalogue (noms en anglais pour tous, descriptions fr + en), chacune à la demande ; **la couleur du motif** (pastilles) ; captures |
| Phare par voiture | `PlanVoiture.phare` → `followCar` (la monoplace la Nuit) |
| Budget | +192 o au premier chargement (cible : 0 o, voir plus bas) ; chaque voiture ≤ 4 ko ; décision du 40c inscrite dans `budgets.md` |

## Les six voitures

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

## La courbe de déblocage (décision de Nathan, 24/10/2026)

Avec les règles du lot 35 (l'or à 4,5 % du temps de l'auteur, l'auteur à 84 % du pilote), l'or est rare et l'auteur l'est encore plus : les voitures « faciles » se gagnent aux jours joués.

| ordre au Garage | voiture (`id`) | condition (`DEBLOCAGES`) | pour qui |
|---|---|---|---|
| 1 | Sparrow (`civile`) | dès le départ | — |
| 2 | **Pelican** (`fourgon`) | 3 jours joués | la première semaine (la voiture qui fait sourire arrive vite) |
| 3 | Weasel (`evolution`) | 3 ors (inchangé) | — |
| 4 | **Badger** (`rallye`) | 7 jours joués | une semaine de jeu |
| 5 | Moray (`gt`) | 10 jours joués (inchangé) | — |
| 6 | **Gecko** (`roadster`) | 14 jours joués | deux semaines de jeu |
| 7 | **Armadillo** (`pickup`) | 6 ors | les bons pilotes |
| 8 | Dragonfly (`proto`) | 1 médaille d'auteur (inchangé) | — |
| 9 | **Boar** (`muscle`) | 30 jours joués | prestige : les plus assidus (un mois) |
| 10 | **Sailfish** (`monoplace`) | 3 médailles d'auteur | prestige : les meilleurs |

Une ligne de `DEBLOCAGES` par voiture (`packages/sim/src/garage.ts`), lue par le serveur (`GET /api/garage`, réponse de l'envoi) et par le jeu ; tests : `packages/sim/test/garage.test.ts` (chaque seuil), `apps/api/test/planning.test.ts` (bloc « Garage » : un joueur de 9 jours et 3 ors a la Pelican, la Weasel et la Badger ; à 30 jours, 7 ors et 3 auteurs, les dix). Le joueur de démonstration (`?api=demo` : 4 jours, 3 ors) a la Sparrow, la Pelican et la Weasel.

Conditions nouvelles qui me sembleraient meilleures (proposées, **non implémentées**) : « 7 jours d'affilée » (récompense l'assiduité plutôt que le total), « une médaille d'or sur chaque thème » (fait voir tous les thèmes), « finir 5 sessions du Salon ».

## Au Garage

- **Le catalogue** (`apps/web/src/voiture/catalogue.ts`) : dix fiches, dérivées de `VOITURES_GARAGE` (l'ordre du Garage) — `id`, `nom` et `description` (`voiture.<id>.*`), `deblocage` (`DEBLOCAGES`), `charger()`. Les quatre premières gardent leur `import()` ; **les six du lot passent par un seul chargeur à la demande** (`voiture/modelesLot42.ts`), qui charge le plan voulu (chaque plan reste son propre morceau). Noms (`catalogue.base.*`, premier chargement : la ligne « Nouvelle voiture » de l'arrivée) et descriptions (`catalogue.base.garage.*`, avec le Garage), fr + en ; `npm run traductions` passé. Page d'admin : la voiture d'essai propose les dix (`VOITURES_ESSAI`, `admin/index.html`).
- **Dix vignettes** : elles étaient déjà dessinées une par une, après l'affichage du Garage (lot 41) ; rien de plus n'est dessiné en 3D à la fois (une seule voiture sur la scène, celle qu'on regarde).
- **La couleur du motif** (décision de Nathan du 23/10/2026 : automatique, crème, asphalte, lagon) : une rangée de quatre pastilles sous les motifs (`radiogroup` « Couleur du motif », boutons de 44 px, nom écrit et lu : `teinte.<id>`), comme les couleurs. **Une teinte qui retomberait sur l'automatique pour la couleur de caisse choisie** (`teinteLisible` : contraste < 2,1) a son échantillon **hachuré** et un contour en tirets, `aria-disabled`, reliée à la ligne d'explication sous la rangée (« Hachurée : trop proche de la couleur de ta voiture, le motif resterait illisible. ») ; elle ne se choisit pas. Si la teinte gardée devient illisible avec une nouvelle couleur, « Auto » est coché (c'est ce que dessine la livrée). Textes `garage.teinte`, `garage.teinte.grisee`, `teinte.*` (fr + en, dans le morceau du Garage). Testé : `e2e/garage.spec.ts` (caisse lagon → lagon hachurée et non choisie ; pétrole → crème retenue, enregistrée, 44 px).
- **Le phare propre à chaque voiture** : le faisceau de la Nuit part de 0,75 m de haut et 1,2 m devant le centre, pour toutes les voitures ; le nez bas de la monoplace (0,4 à 0,67 m) était sous lui et brillait de ses propres phares. `PlanVoiture.phare` (`y`, `z`) → `Voiture.phare` → `followCar(…, phare)` des trois composeurs (palier 1, paliers de la vitrine, existant) ; la Sailfish le pose devant sa pointe (0,5 m, 2,45 m). Les neuf autres gardent le défaut (rien ne change pour elles).

### Captures du Garage et de la course

- `garage-bureau.jpg`, `garage-telephone.jpg` : le Garage avec la Pelican (dix cartes, vignettes, progression) ; `garage-bureau-teinte.jpg`, `garage-telephone-teinte.jpg` : la caisse lagon, la couleur du motif (crème et lagon hachurées, l'explication) ;
- `poursuite-monoplace-stade.jpg`, `-nuit.jpg`, `-canyon.jpg` : la Sailfish en course (`?voiture=monoplace`), la Nuit sans reflet sur le nez.

## Budget

- **Premier chargement : +192 o** (JS + CSS 285 599 → 285 791 o ; cible du prompt : 0 o ; marge 6 001 → 5 809 o). Ce qui reste au premier écran : le catalogue à dix fiches, les six règles de `DEBLOCAGES`, les six noms (la ligne de l'arrivée) et le phare par voiture (≈ 45 o : `followCar`, `Voiture.phare`). La première version ajoutait +424 o (un `import()` par voiture) : un seul chargeur à la demande pour les six (−153 o), le catalogue dérivé de `VOITURES_GARAGE` (−58 o), la Sparrow qui ne recopie plus `capotPlat` et `plaque` de `details.ts` (−21 o). **À valider par Nathan** (moins de 1 ko : la règle commune ne demande pas de justification au-delà de ce paragraphe) ; pistes pour revenir à 0 : retirer le phare par voiture (la monoplace brillerait de nouveau la Nuit), ou charger les noms des voitures avec le Garage (la ligne de l'arrivée attendrait ce morceau).
- **Chaque voiture à la demande, ≤ 4 ko compressés** : plan seul 1,8 à 2,1 ko (tableau des mesures), atelier commun 0,65 ko, chargeur 0,44 ko — la première voiture du lot chargée coûte ≈ 3,2 ko, les suivantes ≈ 2 ko. Morceau du Garage : +0,2 ko (couleur du motif) ; catalogue anglais +70 o ; page d'admin +38 o. Ligne de Track de `docs/plateforme/budgets.md` mise à jour, et **la décision du lot 40c inscrite** (+6,6 ko acceptés par Nathan le 23/10/2026, sans levier).
- **Compilation** : aucun nuanceur ne change ; le Garage et le jeu compilent le même programme de livrée pour chaque voiture (joints : 2 à 8 segments de flanc selon le plan). `profil.spec.ts` n'est pas touché par le lot (la civile reste la voiture de ces tests).

## Vérifié / non vérifié

**Vérifié** : `npm test` en entier (Vitest : sim, API sur SQLite et libSQL, jeu), typecheck, `npm run traductions` ; e2e Chromium : `vitrine-voiture` (onze colonnes, 33 vues, plafonds, vue en mouvement ; téléphone, axe), `garage` (dix voitures, progression, couleur du motif, axe FR et EN, pause, anglais, hors connexion, arrivée), `voiture`, `perf` (budgets), `admin`, `accessibilite` ; captures ci-dessus (rendu logiciel). **Sur cette machine, `garage.spec.ts › le fantôme de ton record…` dépasse son attente de 5 s à l'ouverture du Garage — exactement comme `main`** (12,5 à 13,5 s mesurés sur les deux, rendu logiciel lent) ; la CI le passe : ce n'est pas un effet du lot.
**Non vérifié** : un vrai téléphone (temps d'image, rendu des six voitures) ; Firefox et WebKit (hors du sous-ensemble d'une PR) ; la poursuite des cinq autres voitures en jeu (seule la Sailfish a ses captures : `VOITURE=<id>` pour les autres).

## Décisions pour Nathan

1. **Le budget** : +192 o au premier chargement au lieu de 0 o (les deux pistes ci-dessus si tu veux 0).
2. **Les conditions nouvelles** proposées (« 7 jours d'affilée », « une médaille d'or sur chaque thème », « 5 sessions du Salon ») : un lot à part si tu en veux une.

## À tester (aperçu de la PR)

- `/?demo=joueur`, puis Track, Garage : les dix voitures, de la plus facile à la plus difficile, avec leur condition et la progression ; la rangée « Couleur du motif » sous les motifs (choisis la caisse Lagon : la crème et le lagon sont hachurés et expliqués).
- `/track/?api=demo` puis Garage : la Pelican est débloquée (4 jours joués) ; touche-la, puis cours avec elle.
- Essayer une voiture (sans rien enregistrer, course non classée) : `/track/?home=0&voiture=<id>` avec `<id>` = `fourgon` (Pelican), `rallye` (Badger), `roadster` (Gecko), `pickup` (Armadillo), `muscle` (Boar), `monoplace` (Sailfish) — la caméra capot (touche C) et la Nuit (`&theme=nuit`) pour la monoplace.
- `/track/vitrine/?planche=voiture` : les dix voitures côte à côte.
