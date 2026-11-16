# Seed — « Pinball » (flipper du jour, arcade), 15 novembre 2026

Validé par Nathan d'après la maquette jouable `pinball-maquette-jouable.html` (versée dans `docs/pinball/maquettes/`). Ce seed est la source de vérité du jeu ; seul Nathan le modifie.

## Le jeu
- **Un flipper, une table par jour, la même pour tous.** Trois billes par partie. Pas de nudge, pas de tilt.
- **Commandes** : batteur gauche (←, Q, A, moitié gauche de l'écran), batteur droit (→, D, P, moitié droite). Pour lancer, on maintient puis on relâche (Espace, ↓, ou toucher l'écran) : plus on tient, plus le lancer est fort.
- **Le bas de la table ne change jamais**, parce que c'est lui qui donne les sensations : deux batteurs, deux lance-pierres, deux couloirs de retour, le couloir du lanceur et les trois couloirs du haut.
- **Le haut est tiré du jour** : six emplacements, garnis de modules, dont l'élément propre au thème au centre.

## Les modules communs
- **Bumpers** (trio) et **mini-bumpers** (paire).
- **Banque de trois cibles**, à faire tomber toutes.
- **Spinner**, qui tourne au passage.
- **Trou**, qui garde la bille un instant puis la relance.
- **Couloirs du haut** (fixes) : quand on allume les trois, le multiplicateur monte.

## Les thèmes, un par jour
Le thème change chaque jour. On pourra en ajouter.

| Thème | Élément du thème | Autres noms | Mission |
|---|---|---|---|
| **Fête foraine** | Manège : un plateau qui tourne et entraîne la bille | Pommes d'amour (bumpers), Chamboule-tout (cibles), Grande roue (spinner), Stand de tir (trou) | Fais 5 tours de manège |
| **Océan** | Tourbillon : il aspire la bille et la recrache | Bulles (bumpers plus doux), Coquillages (cibles), Hélice (spinner), Pieuvre (trou) | Plonge 3 fois dans le tourbillon |
| **Espace** | Trou noir, qui courbe la trajectoire, et deux portails | Planètes (bumpers), Astéroïde (bumper qui se déplace), Satellites (cibles), Radar (spinner), Sonde (trou) | Passe 3 fois par le portail |
| **Volcan** | Geyser, qui pousse vers le haut, et Coulée, un couloir qui accélère | Braises (bumpers), Rochers (cibles), Moulin (spinner), Cratère (trou) | Déclenche 4 geysers |

Chaque module porte son nom sur la table, dans le vocabulaire du thème, avec une flèche qui montre où tirer. La flèche clignote quand le module compte pour la mission.

## Le score
- Les points de la maquette servent de départ, à régler sur le prototype :

  | Action | Points |
  |---|---|
  | Lance-pierre | 10 |
  | Spinner (par passage) | 50 |
  | Bumper | 100 |
  | Couloir allumé | 100 |
  | Cible | 250 |
  | Couloir de la coulée | 300 |
  | Tour de manège | 500 |
  | Geyser | 750 |
  | Portail | 800 |
  | Trois couloirs allumés | 1 000, et le multiplicateur monte d'un cran |
  | Trou | 1 500 |
  | Banque de cibles complète | 2 000 |
  | Tourbillon | 2 000 |
  | Mission réussie | 10 000, et le multiplicateur monte d'un cran |

- **Le multiplicateur** va de ×1 à ×6 et multiplie tous les points. Il se garde d'une bille à l'autre.
- **Catégorie Arcade** : un classement du jour au **meilleur score**. On rejoue autant qu'on veut, et c'est la meilleure partie qui compte. Le jeu est hors du cumulé, de la journée parfaite et de la série du portail.

## La table du jour
- **Tirée de la graine du jour** : le thème, puis les modules des six emplacements, dans des listes permises par emplacement.
- **Validée par un robot** avant d'être servie : aucune bille ne doit rester coincée, et chaque module doit pouvoir être touché. Une table refusée est retirée, avec une graine suivante fixée.
- **Jours figés** : le générateur monte sa version et n'écrit jamais de date. Une table servie ne change plus.

## Les médailles : calculées chaque jour
- **Le robot joue la table du jour** plusieurs parties fixées d'avance. Ses scores donnent les seuils Bronze, Argent, Or et Diamant, en pourcentages réglés par Nathan sur le prototype.
- Les seuils sont **figés avec la table**, comme le temps de l'auteur de Jump.

## La DA
- **Rendu three.js** (choix de Nathan du 15/11) : vue de la table inclinée, meuble en bois, rails et batteurs en volume, bumpers à yeux qui s'enfoncent, cibles qui tombent, ombres, bille en métal.
- **Le sol de la table est un dessin 2D** (bandes, lampes, étiquettes, flèches), posé en texture : on retouchera les visuels plus tard sans toucher au jeu.
- **La simulation est en 2D** : le rendu ne fait que la montrer.
- Les palettes des quatre thèmes sont celles de la maquette.
- **L'étiquette** (provisoire, au choix de Nathan) :
  - fond lilas `#C9B6F2`, coque `#5B3FA0` ;
  - police Righteous ;
  - motif : losanges, comme des lampes de table ;
  - illustration : la bille entre deux batteurs.
- **Le HUD** : le score, le multiplicateur, les billes restantes, et la mission avec sa jauge.

## Technique (règles de la plateforme)
- **Simulation déterministe en entiers**, en pas fins (environ 600 par seconde), rejouée par le serveur.
- **La rediffusion ne contient que les pas** où un batteur est pressé ou relâché, et ceux du lanceur.
- **Une durée maximale de partie** borne le coût du rejeu. Elle est à mesurer au premier lot.
- **three.js est chargé à la demande**, comme dans Rush. Le jeu suit le réglage de qualité de la plateforme (lot Q1).
- **Téléphone d'abord**, en portrait.

## Encore ouvert
- L'étiquette (couleur, police, motif, illustration) et le premier jour.
- Les points, les pourcentages des médailles et la durée maximale, à régler sur le prototype (`?debug&tune`).
- Les sensations : force des batteurs, pente, rebonds, lanceur.
- **Bille sauvée** au lancement (quelques secondes pendant lesquelles une bille perdue revient) : oui ou non.
- **Un rendu à plat en secours**, pour la qualité minimale et les petits écrans. C'est le Canvas+ de la maquette, qui dessine déjà le sol : il coûte peu et règle la lisibilité du haut de la table.

## Le contenu des tables (décisions de Nathan du 16/11/2026)

### Des plans de table tirés du jour
- **Le bas de la table ne change toujours pas** : les batteurs, les lance-pierres, les couloirs de retour et le lanceur.
- **Le haut suit un plan tiré du jour**, parmi plusieurs. Un plan fixe la place des rampes, de l'orbite, du mini-batteur et des emplacements de modules. Ensuite, les modules sont tirés dans les emplacements du plan.
- On pourra ajouter des plans, comme des thèmes.

### Les nouveaux éléments
- **Rampes** : des rails où la bille monte, puis redescend vers un batteur. Il faut les prendre assez vite : trop lente, la bille redescend par l'entrée. Elles sont habillées par thème : montagnes russes (Fête foraine), toboggan aquatique (Océan), tube orbital (Espace), rail de wagonnet (Volcan).
- **Orbite** : un couloir qui fait le tour du haut de la table.
- **Combo** : enchaîner des rampes et des orbites en quelques secondes fait monter un compteur de combo, qui rapporte de plus en plus.
- **Mini-batteur** : un troisième batteur en haut de la table, sur certains plans. Il bouge avec le bouton du batteur du même côté.
- **Éléments qui se débloquent** :
  - une **porte** qui s'ouvre quand la banque de cibles est complète, et donne accès à un passage ;
  - un **kickback** : le couloir de sortie gauche renvoie une fois la bille en jeu, quand on l'a allumé ;
  - un **aiguillage**, qui change la sortie d'une rampe.

### La boucle de la partie : mission, puis multibille
1. **La mission du thème** se fait comme aujourd'hui.
2. **La mission réussie allume le verrou.** Une bille qui y entre est verrouillée, et une nouvelle bille arrive au lanceur.
3. **Avec deux billes verrouillées, c'est la multibille** : trois billes en jeu en même temps, avec quelques secondes de bille sauvée au départ.
   - **Pendant la multibille, l'élément du thème rapporte un jackpot**, de plus en plus gros à chaque fois.
   - La multibille s'arrête quand il ne reste qu'une bille sur la table.
4. **Puis la mission revient, au niveau suivant** : un but plus haut, et elle rapporte plus. La boucle recommence.
- Une partie reste à trois billes, avec une durée maximale.
