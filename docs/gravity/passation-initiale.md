# Passation — « Gravity » (coureur sans fin, arcade), 14 novembre 2026

Ce document ouvre **la conversation d'orchestration de Gravity**. Joins-y le seed (`seed-gravity.md`) et la maquette jouable (`gravity-maquette-jouable.html`).

**Le dépôt fait foi.** Après GR0, la référence à jour est `docs/gravity/passation.md`, générée par `npm run nouveau-jeu`. Ce document-ci ne sert qu'à démarrer.

---

## 1. Le jeu
Tout est dans le seed. En une phrase : un coureur sans fin en une touche, où l'on inverse la gravité seulement au contact d'une surface (sol, plafond, plateformes du milieu). Le niveau infini est le même pour tous dans la journée, avec les cinq thèmes de Jump et leurs blocs spéciaux. Le score compte la distance, les pièces et les gemmes, avec un multiplicateur. Les bonus sont fixes, et les médailles sont calculées chaque jour par un robot.

## 2. Décisions déjà prises (Nathan, 14/11)
- **Catégorie Arcade**, classement au meilleur score du jour.
- **Plateformes au milieu de l'écran**, en plus du sol et du plafond.
- **Médailles calculées chaque jour** : 60 % du score d'un robot qui prend tout, jusqu'à la fin du 1er, du 2e et du 3e thème, puis de la boucle.
- **Bonus fixes** (bouclier, aimant), posés par le niveau, les mêmes pour toutes les parties.
- **Multiplicateur** : +1 toutes les 10 pièces d'affilée, jusqu'à ×5 ; une pièce ratée le remet à ×1.
- **Une bonne partie dure de 1 à 3 minutes.**
- **La DA de Jump**, reprise par le module commun `@cdj/visuels/plateformes` (lot DA2 de la plateforme), avec le héros cousin de Jump et son bandeau.

## 3. Ce qui reste à trancher
- La couleur de l'étiquette (corail, provisoire) et le nom.
- Le pourcentage des médailles et la longueur d'un thème, à régler sur le prototype (`?debug&tune`).
- Les sensations : vitesse de départ et sa montée, force de la gravité, tampon, temps de grâce.

## 4. La plateforme, en bref (le détail est dans le dépôt)
- **Du Jour**, sur playdujour.com. Track et Jump sont les jeux du jour ; Tower, Blocks et Rush, l'arcade. Le portail est une salle de jeux (charte, révision 19).
- **Le kit de jeu** : la fiche (avec son bloc `identite`), `definirJeuNeuf`, `@cdj/kit` (`brancherJeu`), `npm run nouveau-jeu`. **Gravity n'écrit que sa simulation, son rendu, ses sensations, ses textes et son contrat serveur.**
- **Les règles qui comptent le plus pour Gravity** :
  - **simulation déterministe en entiers**, rejouée par le serveur ; la rediffusion = les pas des appuis ;
  - **jours figés** : le générateur monte sa version, il n'écrit jamais de date ; seuils des médailles figés avec le niveau ;
  - **budgets en Ko**, avec une marge de 5 à 10 % ;
  - **le son se mêle à celui du téléphone** (lot S2) ;
  - **tests sur une base locale**, jamais sur Turso.
- **Zones de Gravity** : `apps/gravity/**`, `packages/gravity-sim/**`, `apps/api/src/gravity*.ts`, `docs/gravity/**`, sa fiche. **`@cdj/visuels` est une zone partagée** : un changement de la DA commune passe par la conversation de la plateforme.

## 5. La méthode
- **Un lot = une session neuve = une branche = une PR en brouillon.** L'agent s'arrête quand la CI de la PR est verte. Les retouches sont des lots « b ».
- **Prompts courts**, au gabarit habituel : Contexte · À livrer · Scénario de test (2 clics) · Critères d'arrêt · Modifications des consignes · Hors périmètre. On n'envoie jamais de `CLAUDE.md`. Après chaque prompt, dire à Nathan en 1 à 3 lignes ce qu'il doit tester.
- **Maquettes d'abord** pour tout écran. **Les sensations se règlent par Nathan** (`?debug&tune`, export JSON).
- **Une ou deux parties par lot**, avec un arrêt propre.
- **Chaque PR** a une section « Pour les joueurs » (FR // EN, ou « rien »).

## 6. Ordre de départ
1. **Côté plateforme**, en parallèle : **DA2** (la DA de Jump en module commun) et **GR0** (création du jeu).
2. **GR1, premier lot de la conversation de Gravity** : la simulation en entiers (course, inversion au contact, tampon, temps de grâce, sol, plafond et plateformes du milieu, piques, vide, bord de l'écran), le générateur infini du jour (morceaux communs, sans les thèmes à mécanique), le rendu par `@cdj/visuels/plateformes` et `?debug&tune`. Les mesures : déterminisme, coût du rejeu d'une partie de 3 et de 10 minutes, taille de la rediffusion.
3. **Ensuite** :
   - GR2 : thèmes et blocs spéciaux ;
   - GR3 : pièces, gemmes, multiplicateur et bonus ;
   - GR4 : robot et médailles du jour ;
   - GR5 : identité, accueil, fin de partie et branchement au portail.
