# Rush — seed (vision du jeu)

> **Version provisoire du lot BR0** (prototype), écrite à partir de la demande de Nathan. **Nathan l'écrira en entier après le prototype** (les titres sont ceux du gabarit ; ce qui n'est pas encore décidé est dit). Titre et identifiant (`rush`) provisoires.

## 1. Le jeu en une phrase

Un jeu de **boss rush** pour Du Jour : chaque jour, le même niveau pour tous ; on le termine en battant son boss **le plus vite possible**. Inspirations : *TinyLegends Crazy Knight*, *Minigore*.

## 2. Les piliers

- **Le choix du joueur** : monter en puissance (tuer des monstres, gagner de l'XP et des niveaux, choisir une amélioration parmi trois) **ou** foncer au boss pour le chrono.
- **Un jeu ambitieux** : les sensations visuelles et la qualité comptent avant tout (arrêt sur image, recul, secousse, éclats, sons).
- **La direction artistique, en 3D sans aucun asset** (tout en code), dans la famille du site : formes simples, ombrage en aplats (cel), contour noir, petits yeux. Maquette de référence : `maquettes/boss-rush-3d.html` (trois scènes animées, en code seulement) ; Nathan juge la DA **en mouvement**, sur le prototype.
- Catégorie **Arcade** (lot A3) : le jeu a son classement mais ne compte ni dans la journée ni dans le cumul.

## 3. Une partie

*(à écrire par Nathan)* Prototype BR0 : une arène, un chevalier (déplacement libre, coup en arc en enchaînement de trois, esquive avec un court instant d'invincibilité, trois cœurs), deux monstres (une gelée qui fonce, une chauve-souris qui tourne autour puis plonge) et un boss, le golem, aux trois attaques **annoncées par un cercle rouge au sol** (coup de poing en zone, onde, chute de pierres) et à la phase 2 sous 50 % de vie. Le chrono s'arrête à la chute du golem.

## 4. Le classement et les médailles

Le **temps** de la chute du boss, le plus court gagne. Les médailles (méthode : robot, temps théorique ou autre) sont **à décider** : voir les questions du README du lot BR0.

## 5. Le contenu du jour

*(provisoire, lot BR1 ; Nathan l'écrira)* Un **niveau**, le même pour tous, tiré de la graine du jour : on part d'un point de départ, on suit un **chemin** (une suite de clairières reliées par des chemins ou des ponts) jusqu'à l'**arène du golem**, et **2 à 4 détours** (à 20-40 m du chemin) mènent à des **camps** de 4 à 8 monstres ; quelques monstres sont épars sur le chemin principal (on peut les contourner en prenant un risque). Les monstres ont un rayon d'alerte et une laisse : ils ne poursuivent pas sur toute la carte, et un joueur qui file doit pouvoir passer au prix de quelques coups. En entrant dans l'arène, une barrière se referme derrière le chevalier et le golem se réveille. **Foncer ≈ 1 min à 1 min 15** (golem compris), **tout nettoyer ≈ +1 min** ; le choix « monter en puissance ou foncer » est posé, même si l'XP n'arrive qu'au lot BR2. Trois **thèmes** purement visuels (prairie, carrière, sous-bois). Prévu ensuite : une réserve de boss dont un est tiré chaque jour (BR3).

## 6. Les commandes

Au doigt : un joystick virtuel à gauche, « Coup » et « Esquive » en boutons à droite (charte, révision 17). Au clavier et à la manette : les mêmes, réglables (règles M1 et M2).

## 7. L'identité visuelle et sonore

Voir le point 2 et `docs/rush/consignes.md` (la DA du prototype). Sons : Web Audio procédural.

## 8. Ce que le jeu n'est pas

*(à écrire)*

## 9. Plan en lots

Prototype (lots BR0, BR0b, BR0c : voir les README `docs/rush/lots/`), puis :
- **BR1** — le niveau du jour (grille de collision, chemin, détours, camps, arène, barrière, générateur sur 365 graines, trois thèmes visuels, caméra qui suit, pilote qui navigue). **DA figée** : lisibilité seulement.
- **BR2** — l'XP, les niveaux, les améliorations (une parmi trois) : le choix « monter en puissance ou foncer » prend son sens.
- **BR3** — les autres boss (la réserve de boss, un tiré chaque jour).
- **BR4** — les médailles (les trois stratégies du pilote : foncer, nettoyer à moitié, tout nettoyer ; le Diamant définitif).
- **BR-A** — la **passe artistique** : modèles faits dans Blender pour le golem, les boss et le chevalier, budget de triangles mesuré sur téléphone, réglage de qualité.
- **BR5** — la publication (mentions légales, passage `preview` puis `on` par Nathan).
