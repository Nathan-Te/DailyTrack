# Seed — « Gravity » (jeu d'arcade, titre provisoire), 14 novembre 2026

Validé par Nathan d'après la maquette jouable `gravity-maquette-jouable.html` (versée dans `docs/gravity/maquettes/`). Ce seed est la source de vérité du jeu ; seul Nathan le modifie.

## Le jeu
- **Un coureur sans fin, en une touche.** Le personnage court tout seul vers la droite. Toucher l'écran (ou clic, Espace, A à la manette) **inverse la gravité** : il tombe vers le plafond, ou de nouveau vers le sol.
- **La règle qui fait le jeu : on ne peut inverser que si l'on touche une surface.** Pas d'inversion en l'air. Un appui juste avant de toucher est gardé un court instant (tampon) ; un appui juste après avoir quitté un bord passe encore (temps de grâce).
- **Les surfaces ne sont pas que le sol et le plafond** : des **plateformes au milieu de l'écran**, à plusieurs hauteurs. On peut se tenir dessus comme dessous. Les motifs : escalier de plateformes, deux étages troués en quinconce, îlots flottants au-dessus du vide, plateforme centrale. Il y a souvent plusieurs chemins.
- **On meurt** en tombant dans le vide (en haut ou en bas), en touchant du rouge (piques), ou rattrapé par le bord gauche de l'écran quand un mur bloque la course.
- **Une bonne partie dure de 1 à 3 minutes.**

## Le score
- La **distance** : 1 point par mètre.
- **Les pièces** : 10 points × le multiplicateur.
- **Les gemmes**, rares, sur les chemins difficiles : 100 points × le multiplicateur.
- **Le multiplicateur** : +1 toutes les 10 pièces ramassées d'affilée, jusqu'à ×5. **Une pièce ratée, et il retombe à ×1.**
- **Catégorie Arcade** : un classement du jour au **meilleur score**. On rejoue autant qu'on veut, la meilleure partie compte. Le jeu est hors du cumulé, de la journée parfaite et de la série du portail.

## Les bonus : posés par le niveau, les mêmes pour toutes les parties
- **Bouclier** : il te sauve une fois. Un pique traversé, une chute rattrapée (la gravité s'inverse), ou un recul devant le bord de l'écran.
- **Aimant** : pendant 8 secondes, les pièces proches viennent à toi.
- Ils sont placés par le générateur à des endroits fixes du niveau du jour : **aucun hasard d'une partie à l'autre**.

## Le niveau du jour
- **Infini, et le même pour tous dans la journée** : une suite de morceaux de 16 colonnes, tirée de la graine du jour.
- **Cinq thèmes, ceux de Jump**, dans un **ordre tiré chaque jour** : un thème tous les 300 m environ, puis la boucle reprend, plus vite et plus dense. La vitesse monte doucement avec la distance.
- **Morceaux communs** : trou au sol, trou au plafond, zigzag, pilier, piques, plateformes du milieu (les quatre motifs ci-dessus), inverseur.
- **Les blocs spéciaux, un par thème** (la mécanique de Jump, adaptée) :
  - **Usine** : tapis roulant, qui pousse plus vite ;
  - **Glace** : sol de glace, trop glissant pour prendre appui : **pas d'inversion dessus** ;
  - **Nuit** : blocs qui s'allument et s'éteignent en rythme, et clignotent avant de s'éteindre ;
  - **Néon** : deux couleurs, une seule solide à la fois, au battement ;
  - **Forêt** : courant d'air, qui porte vers le haut ;
  - **Partout** : l'inverseur, qui change la gravité dès qu'on le touche.

## Les médailles : calculées chaque jour
- **Un robot joue le niveau du jour en prenant tout** (pièces, gemmes, bonus), en suivant le chemin que le générateur sait sûr.
- Son score donne quatre seuils, chacun **à 60 % du score du robot** à une distance donnée :
  - **Bronze** : fin du 1er thème ;
  - **Argent** : fin du 2e ;
  - **Or** : fin du 3e ;
  - **Diamant** : fin de la boucle des cinq thèmes.
- Les seuils sont **figés avec le niveau** (règle des jours figés), comme le temps de l'auteur de Jump. Le pourcentage se règle par Nathan.

## La DA
- **Celle de Jump** : fonds sombres, tuiles à bord clair, rouge réservé aux dangers, le petit cube jaune avec ses yeux. Le héros de Gravity est son cousin : **le même cube jaune, avec un bandeau d'encre** dont les pans flottent.
- Elle est **reprise par un module commun** (`@cdj/visuels`, comme Blocks reprend Tower), pas recopiée.
- **L'étiquette** : corail (`#FFB892`), coque `#C9622E`, police **Lilita One** (celle de Jump). La couleur est provisoire, au choix de Nathan.
- Pièces couleur papier cerclées d'encre ; gemmes couleur Diamant (`#4FC3DC`) ; bonus en disque papier avec un dessin Diamant.
- **Le HUD** : le score en grand au centre, le multiplicateur en autocollant jaune avec sa jauge, la médaille visée en haut à droite, les bonus actifs en haut à gauche, le nom du thème quand il change.

## Technique (règles de la plateforme)
- **Simulation déterministe en entiers**, rejouée par le serveur. **La rediffusion n'est que la liste des pas où le joueur a touché l'écran**, donc minuscule même pour une longue partie. Le serveur rejoue jusqu'à la mort et retrouve le score. Une durée maximale de partie (10 minutes ?) borne le coût du rejeu.
- **Le générateur monte sa version, jamais une date** (jours figés). Les seuils des médailles sont figés avec le niveau.
- **Téléphone d'abord** : une touche, en paysage comme en portrait.

## Encore ouvert
- La couleur de l'étiquette et le nom.
- Le pourcentage des médailles (60 %) et la longueur d'un thème (300 m), à régler sur le prototype.
