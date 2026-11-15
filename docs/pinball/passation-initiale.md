# Passation — « Pinball » (flipper du jour, arcade), 15 novembre 2026

Ce document ouvre **la conversation d'orchestration de Pinball**. Joins-y le seed (`seed-pinball.md`) et la maquette jouable (`pinball-maquette-jouable.html`).

**Le dépôt fait foi.** Après PB0, la référence à jour est `docs/pinball/passation.md`, générée par `npm run nouveau-jeu`. Ce document-ci ne sert qu'à démarrer.

---

## 1. Le jeu
Tout est dans le seed. En une phrase : un flipper à trois billes, avec une table par jour, la même pour tous.
- Le bas de la table est fixe. Le haut a six emplacements tirés du jour, dont l'élément propre au thème (Fête foraine, Océan, Espace, Volcan).
- Chaque table a une mission.
- La table est validée par un robot, qui calcule aussi les médailles du jour.
- Le rendu est en three.js, sur une simulation 2D.

## 2. Décisions déjà prises (Nathan, 15/11)
- **Catégorie Arcade**, classement au meilleur score du jour.
- **Trois billes** par partie. **Pas de nudge**, pas de tilt.
- **Les quatre thèmes de la maquette**, avec leur élément et leur mission. On pourra en ajouter.
- **Nom : Pinball.**
- **Rendu three.js** (option B de la maquette), préféré au Canvas+. Les visuels se retravailleront plus tard.

## 3. Ce qui reste à trancher
- L'étiquette (lilas, provisoire) et le premier jour.
- Les points, les pourcentages des médailles et la durée maximale d'une partie, à régler sur le prototype (`?debug&tune`).
- Les sensations : force des batteurs, pente, rebonds, lanceur.
- La bille sauvée au lancement : oui ou non.
- Un rendu à plat en secours pour la qualité minimale (voir le seed).

## 4. La plateforme, en bref (le détail est dans le dépôt)
- **Du Jour**, sur playdujour.com.
  - Track et Jump sont les jeux du jour ; Tower, Blocks et Rush, l'arcade.
  - Le portail est une salle de jeux (charte, révision 19).
- **Le kit de jeu** : la fiche (avec son bloc `identite`), `definirJeuNeuf`, `@cdj/kit` (`brancherJeu`), `npm run nouveau-jeu`.
  - **Pinball n'écrit que sa simulation, son rendu, ses sensations, ses textes et son contrat serveur.**
  - Ses noms de thèmes restent dans ses zones (lot K7).
- **Les règles qui comptent le plus pour Pinball** :
  - **simulation déterministe en entiers**, rejouée par le serveur ; la rediffusion = les pas des appuis sur les batteurs et le lanceur ;
  - **jours figés** : le générateur monte sa version, il n'écrit jamais de date ; la table et les seuils des médailles sont figés ensemble ;
  - **budgets en Ko**, avec une marge de 5 à 10 %. three.js se charge à la demande, comme dans Rush ;
  - **le réglage de qualité** de la plateforme s'applique (lot Q1) ;
  - **le son se mêle à celui du téléphone** (lot S2) ;
  - **tests sur une base locale**, jamais sur Turso.
- **Zones de Pinball** : `apps/pinball/**`, `packages/pinball-sim/**`, `apps/api/src/pinball*.ts`, `docs/pinball/**`, et sa fiche.

## 5. La méthode
- **Un lot = une session neuve = une branche = une PR en brouillon.** L'agent s'arrête quand la CI de la PR est verte. Les retouches sont des lots « b ».
- **Prompts courts**, au gabarit habituel :
  - Contexte ;
  - À livrer ;
  - Scénario de test (2 clics) ;
  - Critères d'arrêt ;
  - Modifications des consignes ;
  - Hors périmètre.
- On n'envoie jamais de `CLAUDE.md`.
- Après chaque prompt, dire à Nathan en 1 à 3 lignes ce qu'il doit tester.
- **Maquettes d'abord** pour tout écran.
- **Les sensations se règlent par Nathan** (`?debug&tune`, export JSON).
- **Une ou deux parties par lot**, avec un arrêt propre.
- **Chaque PR** a une section « Pour les joueurs » (FR // EN, ou « rien »).

## 6. Ordre de départ
1. **Côté plateforme : PB0**, la création du jeu.
2. **PB1, premier lot de la conversation de Pinball** : la simulation en entiers et le générateur de table, sans le rendu.
   - **La simulation** : bille, murs, batteurs, lance-pierres, lanceur, modules communs, pas fins.
   - **Le générateur** : thème et six emplacements, depuis la graine du jour.
   - **Les mesures** :
     - déterminisme : la même rediffusion donne le même score, en client et en serveur ;
     - coût du rejeu d'une partie de 5 et de 20 minutes ;
     - taille de la rediffusion.
   - **Un rendu de contrôle à plat**, le Canvas de la maquette, pour voir la simulation.
3. **Ensuite** :
   - PB2 : le rendu three.js de la maquette, branché sur la simulation, avec `?debug&tune` ;
   - PB3 : les éléments des quatre thèmes et les missions ;
   - PB4 : le robot, la validation des tables et les médailles du jour ;
   - PB5 : l'identité, l'accueil, la fin de partie et le branchement au portail.
