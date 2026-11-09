# Passation — « Vertige » (plateformer en vue à la première personne, titre provisoire), 9 novembre 2026

Ce document ouvre **la conversation d'orchestration de Vertige**. Joins-y le lot `lot-V0-prototype-deplacements.md`, la maquette `vertige-maquette-3d.html` et l'image de référence de Nathan.

**Le dépôt fait foi.** Une fois V0 fusionné, la référence à jour est `docs/vertige/passation.md`, générée par `npm run nouveau-jeu` à partir des consignes du dépôt. Ce document-ci ne sert qu'à démarrer.

---

## 1. Le jeu (vision de Nathan, à écrire en seed après le prototype)
- **Un plateformer en vue à la première personne**, un niveau par jour, le même pour tous. On le termine **le plus vite possible** ; le classement est au temps, et la rediffusion fait preuve.
- **Inspiration** : *SEUM: Speedrunners from Hell* (niveaux courts, mouvement nerveux, recommencer en un geste). Image de référence : plateformes de pierre claire et tapis rouges au-dessus des nuages, château, braseros, gemmes, portail rose, et un cadre de pierre qui flotte de travers.
- **Les mécaniques** :
  - course sur les murs et saut de mur ;
  - dash ;
  - **changement de gravité** (atteindre un plafond ou un mur) ;
  - **portails** reliant deux endroits éloignés ;
  - une touche d'**espace non euclidien** (portails, objets de travers, perspectives impossibles).
- **Catégorie Arcade** : un classement du jour, hors du cumulé, de la journée parfaite et de la série du portail.
- **PC d'abord** : clavier et souris, et manette. Le téléphone est une question ouverte (§ 3).

## 2. Décisions déjà prises
- **Le monde est fait de blocs alignés sur les axes, et la gravité ne tourne que par quarts de tour** (6 directions). C'est ce qui rend possible une **simulation déterministe en entiers**, rejouée par le serveur comme `jump-sim`. Les objets de travers (le cadre qui tourne) sont du **décor**, sans collision.
- **L'angle de vue fait partie des commandes enregistrées** : lacet et tangage à chaque pas, en entiers (fraction de tour). Le serveur rejoue la partie exacte.
- **Les portails** : la traversée applique une translation et une rotation par quarts de tour (entières). Le rendu montre la vue de l'autre côté sur **un seul niveau** de profondeur, pas de portail vu dans un portail.
- **Le niveau du jour** sera assemblé à partir de **modules dont la solution est connue**. Les solutions bout à bout prouvent que le niveau est faisable et donnent le temps du robot (la médaille Diamant) et une rediffusion de démonstration. C'est **le risque principal du jeu**.
- **Tout est fait en code**, sans aucun asset : géométrie low poly, lumières, ciel, nuages, mains de la vue à la première personne, animation procédurale.
- **La DA reste à choisir sur la maquette jouable**, qui compare deux styles :
  - **Lumière douce** : proche de l'image, ombres douces, brume, halo (bloom), rendu de couleurs ACES ;
  - **Cartouche** : aplats et contour d'encre, comme Tower, Blocks et Rush.

  Les deux respectent la charte : la règle « pas de flou ni de dégradé » vise l'interface, pas la scène d'un jeu.

## 3. Les questions ouvertes (à trancher après le prototype)
1. **La DA** : Lumière douce, Cartouche, ou un mélange.
2. **Le téléphone** : des commandes simplifiées (joystick à gauche, glisser pour regarder, boutons Saut et Dash), ou « à jouer sur ordinateur », avec seulement le classement et la rediffusion.
3. **La durée visée** d'une partie : 45 s ? 90 s ?
4. **Le confort** : champ de vision réglable, roulis de la caméra sur le mur (réglable ou désactivable), secousses. La nausée est le premier risque d'un jeu à la première personne.
5. **Le générateur** : la taille de la bibliothèque de modules, les variantes par thème, et la façon d'enchaîner gravité et portails sans perdre le joueur.
6. **Le nom.**

## 4. La plateforme, en bref (le détail est dans le dépôt)
- **Du Jour**, sur playdujour.com : Track et Jump sont les jeux du jour ; Tower, Blocks et Rush sont en arcade. Le portail est une « salle de jeux » (charte, révision 19).
- **Monorepo** `Nathan-Te/DailyTrack` : Firebase Hosting, API sur Cloud Run, base Turso.
- **Le kit de jeu** :
  - la fiche `config/jeux/<id>.json`, avec le bloc `identite` (police, motif, illustration) ;
  - le module serveur `definirJeuNeuf` ;
  - `@cdj/kit` (`brancherJeu`), qui fournit les écrans, le HUD, l'envoi, les amis, le partage, la manette, les commandes réglables et le son ;
  - `npm run nouveau-jeu`.

  **Vertige n'écrit que sa simulation, son rendu, ses sensations, ses textes et son contrat serveur.**
- **Rush est l'autre jeu en 3D** (three.js). Ce qui peut se partager entre eux, par exemple la version de three.js, les contours ou les mains, passe par la conversation de la plateforme : c'est une zone partagée.
- **Les règles qui comptent le plus pour Vertige** :
  - **simulation déterministe en entiers**, rejouée par le serveur ;
  - **jours figés** à la mise en production : le générateur monte sa version, il n'écrit jamais de date ;
  - **budgets en Ko**, avec une marge de 5 à 10 % (`docs/plateforme/budgets.md`). three.js pèse environ 146 Ko et se charge pendant l'accueil ;
  - **le son se mêle à celui du téléphone** (lot S2) : session `ambient`, jamais d'élément `<audio>` ;
  - **tests sur une base locale**, jamais sur Turso (R14).
- **Zones de Vertige** : `apps/vertige/**`, `packages/vertige-sim/**`, `apps/api/src/vertige*.ts`, `docs/vertige/**`, sa fiche. Tout le reste est une zone partagée : si un lot doit y toucher, il s'arrête et le demande à la conversation de la plateforme.

## 5. La méthode
- **Un lot = une session neuve = une branche = une PR en brouillon.** L'agent s'arrête quand la CI de la PR est verte. Les retouches sont des lots « b ».
- **Prompts courts** : ils renvoient aux consignes du dépôt au lieu de les répéter. Gabarit : Contexte · À livrer · Scénario de test (2 clics) · Critères d'arrêt · Modifications des consignes · Hors périmètre.
  - On n'envoie jamais de `CLAUDE.md` : le prompt dit quelles consignes le lot modifie lui-même.
  - Après chaque prompt, dire à Nathan en 1 à 3 lignes ce qu'il doit tester.
- **Maquettes d'abord** pour tout écran. **Les sensations se règlent par Nathan** (`?debug&tune`, export JSON).
- **Les gros lots s'arrêtent souvent après leur première partie** : une ou deux parties par lot, avec un arrêt propre.
- **Chaque PR** a une section « Pour les joueurs » (FR // EN, ou « rien »).

## 6. Ordre de départ
1. Nathan joue la maquette `vertige-maquette-3d.html` sur ordinateur et choisit un style, ou les garde tous les deux pour le prototype.
2. **Lancer V0** (prototype des déplacements). Nathan teste sur ordinateur : `/vertige/?scenario=bac-a-sable&debug&tune`, puis `/vertige/?scenario=parcours`.
3. **Avec le README de V0** : trancher les questions du § 3, écrire le seed complet (`docs/vertige/seed.md`), puis découper la suite :
   - V1 : gravité et portails ;
   - V2 : modules et solutions ;
   - V3 : générateur et robot (médailles) ;
   - V4 : rendu et effets ;
   - V5 : son ;
   - V6 : branchement final et téléphone.
