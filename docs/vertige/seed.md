# Vertige — seed (vision du jeu)

> **Provisoire : la vision de la passation** (`docs/vertige/passation-initiale.md`, versée au lot V0). **Nathan l'écrira en entier après le prototype** (lot V0) ; les titres sont ceux du gabarit.

## 1. Le jeu en une phrase

Un plateformer en vue à la première personne : un niveau par jour, le même pour tous, à finir le plus vite possible ; la rediffusion fait preuve. Inspiration : *SEUM: Speedrunners from Hell* (niveaux courts, mouvement nerveux, recommencer en un geste). Image de référence : plateformes de pierre claire et tapis rouges au-dessus des nuages, château, braseros, gemmes, portail rose, et un cadre de pierre qui flotte de travers.

## 2. Les piliers

- **Le mouvement avant tout** : course sur les murs et saut de mur, dash ; à venir : changement de gravité (atteindre un plafond ou un mur), portails reliant deux endroits éloignés, une touche d'espace non euclidien.
- **Un monde de blocs alignés sur les axes, une gravité par quarts de tour** (6 directions) : c'est ce qui rend possible une **simulation déterministe en entiers**, rejouée par le serveur. Les objets de travers sont du décor.
- **L'angle de vue fait partie des commandes enregistrées** (lacet et tangage à chaque pas, en entiers).
- **Tout est fait en code**, sans aucun asset : géométrie low poly, lumières, ciel, nuages, mains, animation procédurale.
- **Un niveau du jour assemblé de modules dont la solution est connue** : le risque principal du jeu.

## 3. Une partie

*(à écrire : la durée visée, 45 s ou 90 s ?)*

## 4. Le classement et les médailles

Au temps (le plus court d'abord), catégorie Arcade : un classement du jour, hors du cumulé, de la journée parfaite et de la série du portail. Le Diamant sera le temps du robot (lot V3). *(seuils or, argent, bronze à écrire)*

## 5. Le contenu du jour

*(à écrire : tirage de modules, thèmes)*

## 6. Les commandes

PC d'abord : clavier et souris, et manette. Le téléphone est une question ouverte : des commandes simplifiées, ou « à jouer sur ordinateur ».

## 7. L'identité visuelle et sonore

La direction artistique reste à choisir sur le prototype : « Lumière douce » (proche de l'image : ombres douces, brume, halo, couleurs ACES) ou « Cartouche » (aplats et contour d'encre, comme Tower, Blocks et Rush), ou un mélange.
