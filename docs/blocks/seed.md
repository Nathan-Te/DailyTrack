# Blocks — seed (source de vérité du jeu)

À déposer dans `docs/blocks/seed.md`. **Seul Nathan le modifie.** Titre provisoire.

- **Inspiration** : *Block Blast* (Hungry Studio). On reprend la mécanique, qui est libre d'usage, **ni le nom ni le style visuel**.
- **Création** : par `npm run nouveau-jeu -- --id blocks --classement score`. Publication sous `/blocks/`, état `off` tant que Nathan ne l'a pas changé.
- **Catégorie : Arcade.** Il a un classement du jour, mais il **n'entre pas dans le classement cumulé**, ni dans la journée parfaite, la série ou la ligne de partage du portail. Tower rejoint la même catégorie.
- **Direction artistique : celle de Tower**, reprise telle quelle : ses blocs, leurs yeux, ses palettes. Elle vient d'un module commun extrait de Tower, réutilisable par les prochains jeux.

## 1. Le jeu en une phrase
Chaque jour, la même suite de pièces pour tout le monde. On reçoit les pièces **par séries de trois** et on les pose dans l'ordre qu'on veut dans une grille de 8 × 8, sans les tourner. Chaque ligne ou colonne remplie disparaît et rapporte des points, et les effacements multiples et enchaînés font des combos. La partie s'arrête quand aucune des pièces restantes ne trouve plus sa place.

## 2. Les piliers
1. **Compris en trois secondes.** Glisser, poser, effacer. Aucun tutoriel nécessaire.
2. **Une main, un pouce.** Pensé d'abord pour le téléphone en portrait. La souris marche aussi bien.
3. **Réfléchir, pas réagir.** Aucun chrono, aucune pression de temps.
4. **Le plaisir de l'effacement.** C'est le moment fort ; un combo se sent dans les mains et dans les oreilles.
5. **La même partie pour tous, rejouable à volonté.** Une seule suite de pièces par jour, tirée de la graine. Essais illimités. Connaître la suite fait partie du jeu.
6. **Un score est une preuve.** La partie est déterministe, et le serveur la rejoue.

## 3. Les règles
- **La grille** : 8 × 8 cases, vide au départ.
- **Trois pièces à la fois** :
  - on reçoit une **série de trois pièces**, et on les pose **dans l'ordre qu'on veut**, chacune n'importe où si toutes ses cases tombent sur des cases vides ;
  - la série suivante n'arrive qu'une fois les trois posées ;
  - **aucune pièce suivante n'est montrée** : choisir l'ordre des trois est déjà le défi.
- **Pas de rotation.** Les orientations sont des **pièces distinctes** du catalogue (un L vers la gauche, un L vers la droite…).
- **L'effacement** : après chaque pose, toute ligne **et** toute colonne entièrement remplie est effacée. Une même pose peut en effacer plusieurs ; une case au croisement compte pour les deux.
- **La fin** : dès qu'**aucune des pièces restantes** de la série ne peut être posée nulle part. Une pièce qui ne rentre nulle part est **grisée**, pour qu'on le voie. Le jeu montre brièvement pourquoi (« Plus de place ! ») avant l'écran de fin.
- **La suite n'a pas de fin fixe**, mais elle **devient plus difficile** au fil des pièces : la part des grosses pièces augmente selon le rang de la pièce dans la suite, de façon déterministe. Une partie finit donc toujours. Un plafond technique (par exemple 2 000 pièces) arrête une partie trop longue, pour la taille de la rediffusion.
- **Aucun autre mécanisme** au premier jalon : pas de bonus, pas de joker, pas de seconde chance.

## 4. Le catalogue de pièces
Une vingtaine de formes de 2 à 9 cases (40 pièces en comptant chaque orientation), chacune avec un poids de tirage. **Pas de pièce de 1 case.** Point de départ, à calibrer :

| Famille | Pièces | Poids |
|---|---|---|
| Petites | 2 cases horizontale et verticale | faible |
| Barres | 3, 4 et 5 cases, horizontales et verticales | moyen |
| Carrés | 2 × 2 ; 3 × 3 | moyen / faible |
| Coins | 3 cases en L (4 orientations) | moyen |
| L et J | 4 cases (8 orientations) ; grand L de 5 cases, 3 × 3 (4 orientations) | moyen / faible |
| T, S et Z | 4 cases dans leurs orientations ; grand T de 5 cases, 3 × 3 (4 orientations) | moyen / faible |
| Rectangles | 2 × 3 et 3 × 2 | faible |

- **La suite est fixe**, tirée de la graine, **indépendante de la grille du joueur** : pas de tirage « qui aide ».
- **Garde-fous** :
  - au plus une pièce à boîte de 3 × 3 par série ;
  - pas de très grosse pièce dans les 2 premières séries ;
  - la rampe de difficulté est réglable (`?debug&tune`).

## 5. Le score
Les valeurs sont un point de départ, à calibrer en jouant. Le score est un entier.
- **Pose** : +1 point par case posée.
- **Effacement** : une pose qui efface `n` lignes et/ou colonnes rapporte `10 × n × n` points (1 ligne = 10, 2 = 40, 3 = 90, 4 = 160…).
- **Combo** : chaque pose qui efface au moins une ligne augmente le compteur de 1, et les points d'effacement sont multipliés par ce compteur. Le combo **survit à deux poses sans effacement** et se perd à la troisième.
- **Plateau vide** : vider entièrement la grille rapporte +300, avec un moment de célébration.
- **Affichage** : le score et le combo en cours sont toujours visibles, et chaque gain s'affiche à l'endroit de l'effacement.
- **Classement du jour** : score ↓ ; départage par le plus grand combo, puis par le premier arrivé.
- **Médailles** : Bronze, Argent, Or, **Diamant**. Dans les données, la clé du Diamant reste `auteur`.
  - **Le Diamant** est le score d'un bot fort : pour chaque série, il cherche le meilleur ordre et les meilleures positions des trois pièces, selon une évaluation de la grille.
  - **Les médailles doivent être atteignables par des humains.** Le Bronze est à la portée d'une première partie attentive ; l'Argent, d'un joueur régulier ; l'Or demande une très bonne partie ; le Diamant est exceptionnel, mais battable.
  - Elles se calibrent sur des bots de force graduée, et **pas en simples fractions du Diamant**. Elles se recalent ensuite sur les vrais scores des joueurs de test. (Constat du 7 nov. 2026 : avec une pièce à la fois, les joueurs faisaient environ 900 points face à des médailles vers 10 000.)
- **Ligne à partager** : `Du Jour · Blocks #5 — 4 582 pts — 🥈 — combo ×7`.
- **Pas de fantôme en partie** : une grille en transparence est illisible. Hors partie, on peut **revoir la partie du n° 1 du jour** (si la plateforme la sert) et celle du Diamant, en rediffusion à vitesse lisible.

## 6. Prise en main
- **Le plateau des trois pièces** : sous la grille en portrait, à côté au PC. Les trois pièces y sont à **la même échelle fixe**, jamais ajustée à leur taille, pour qu'un domino paraisse petit et un 3 × 3 gros.
- **Glisser-déposer** : on saisit n'importe laquelle des pièces restantes. Elle grossit à la taille des cases de la grille et **reste sous le doigt, au point où on l'a saisie** (aucun décalage).
  - Une **ombre** montre où elle tombera, aimantée à la case la plus proche.
  - Les lignes et colonnes **qui seraient effacées** s'allument pendant le survol.
- Relâcher hors d'un endroit valide la renvoie à sa place, sans pénalité.
- **Souris** : même geste. **Clavier et manette** : choisir l'une des pièces restantes, déplacer l'ombre case par case, puis poser (règles M1 et M2 de la plateforme).
- Cibles tactiles larges ; vérifié en portrait **et** en paysage.

## 7. Direction artistique et sensations
- **Celle de Tower, reprise telle quelle** : mêmes blocs en aplats, même relief, **mêmes petits yeux** (ils clignent, regardent la pièce qu'on déplace, et ferment les yeux, contents, quand leur ligne s'efface), mêmes palettes par thème du jour.
- **Ces visuels viennent d'un module commun extrait de Tower** : un lot de plateforme, avant le rendu de Blocks. Tower doit rester identique.
- **L'effacement** :
  - la ligne s'illumine puis éclate en particules de sa couleur ;
  - un combo fait monter le son d'un demi-ton à chaque palier, avec « Combo ×3 ! » ;
  - un plateau vide déclenche une petite célébration ;
  - une vibration courte sur téléphone, qu'on peut couper.
- Sons Web Audio procéduraux : prise, pose, effacement, combo, fin.
- **Des décors détaillés pour chaque thème**, au niveau de ceux de Tower (plans, motifs, petits éléments propres au thème), toujours plus calmes que la grille et les pièces.
- **Lisible partout** : la grille est la vedette, au téléphone comme sur un grand écran de PC ; HUD et écrans à l'échelle de ceux des autres jeux.
- Toute la charte de la plateforme : HUD compact, écrans sur la scène, plein écran, FR et EN.

## 8. Contraintes techniques
- **Simulation pure et déterministe**. L'état = grille, rang de la série, pièces restantes de la série, score, combo. Une action = (emplacement de la pièce dans la série, colonne, ligne). **La rediffusion est minuscule et son rejeu quasi gratuit** pour le serveur.
- Versions de règles et de tirage ; golden ; jours figés par la mise en production.
- **Le jeu naît `off`**, passe par `preview`, puis `on` par Nathan.
- **Pas de publicité** au premier jalon.

## 9. Scénarios d'essai (deux clics)
- `?scenario=presque-plein` : grille presque pleine et série qui permet un effacement multiple (combo et effets).
- `?scenario=blocage` : aucune des pièces restantes ne rentre (fin de partie).
- `?scenario=ordre` : une série où l'ordre de pose décide de tout (un ordre efface, un autre bloque).
- `?scenario=plateau-vide` : une pose qui vide la grille.
- `?seed=AAAA-MM-JJ` : le jour d'une date ; `&bot` pour regarder le bot jouer.

## 10. Hors du premier jalon
Rotation des pièces, aperçu des séries suivantes, bonus et jokers, seconde chance, partie libre à graine aléatoire, grilles d'autres tailles, mode aventure, multijoueur, publicité.

## 11. Découpage suggéré (conversation de Blocks)
0. **Création** (lot de plateforme) : `nouveau-jeu`, et ce seed versé.
1. **Le cœur jouable** : grille, une pièce et la suivante, glisser-déposer, effacement, fin, suite du jour et sa rampe, rendu avec les blocs communs. **À tester** : `/blocks/?seed=<date>` au téléphone.
2. **Score, combos et sensations** : barème, combo, plateau vide, effets, sons, yeux. **À tester** : `?scenario=presque-plein`.
3. **Bot, médailles, thèmes** : Diamant, seuils, thème du jour. **À tester** : `?seed=…&bot`.
4. **Branchement fin** : classement Arcade, partage, `preview`. **À tester** : le lien d'aperçu au téléphone.
5. **Lisibilité et décors** : mise en page au PC et au téléphone, décors des thèmes, fantôme retiré. **À tester** : la recette au PC, puis au téléphone, et `?theme=<id>`.
8. **Trois pièces et médailles humaines** : séries de trois au choix de l'ordre, sans aperçu, bot et médailles recalibrés. **À tester** : `?scenario=ordre`, puis une vraie partie du jour.
