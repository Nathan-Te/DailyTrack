# Tower — seed (source de vérité du jeu)

À déposer dans `docs/tower/seed.md`. **Seul Nathan le modifie.**
- Code : `packages/tower-sim` et `apps/tower`.
- Publication sous `/tower/`, **état `off`** (lot P) tant que Nathan ne l'a pas changé.

## 1. Le jeu en une phrase
Chaque jour, la même suite de pièces et la même plateforme pour tout le monde. On empile, la tour tangue, on perd une vie à chaque pièce qui tombe, et l'on vise la plus haute tour possible quand la dernière pièce est posée.

## 2. Les piliers
1. **Une partie courte et bornée.** Une suite d'un nombre fixe de pièces (point de départ : 40), soit environ 2 minutes de jeu. Essais illimités dans la journée.
2. **La même tour possible pour tous.** Suite de pièces, plateforme, bonus et malus : tout vient de la graine du jour.
3. **La physique est le jeu.** Les pièces vacillent, glissent et basculent : c'est la source de la tension et des effondrements spectaculaires.
4. **Un score est une preuve.** La partie est déterministe et rejouée par le serveur, comme Track et Jump.
5. **Jouable partout.** Des commandes discrètes, aussi bonnes au tactile qu'au clavier.

## 3. Une partie
- **Les pièces** : des polyominos, les sept tétrominos au premier jalon. Elles tombent une à une, à vitesse constante, depuis le haut de l'écran. Le joueur voit la pièce suivante.
- **Commandes** : gauche et droite par demi-case, rotation de 90°, descente accélérée. Dès qu'une pièce touche la tour, le joueur n'a plus la main dessus et la suivante apparaît.
  - Au tactile : des **boutons** par défaut, aux bords de l'écran (règle de la charte).
- **La plateforme** : la même pour tous le jour donné, assez étroite pour que la tour déborde vite.
- **Les vies** : 3. **Chaque pièce qui tombe sous le niveau de la plateforme coûte une vie**, y compris les pièces emportées par un effondrement : une cascade peut coûter plusieurs vies. À 0 vie, la partie s'arrête.
- **La fin** : toutes les pièces posées, ou plus de vies. On attend alors que la tour se stabilise : toutes les pièces immobiles, 5 s au plus.
- **Le score** : la **hauteur finale stable**, au millimètre (le point le plus haut d'une pièce posée sur la tour).
  - Départage : vies restantes, puis temps.
  - La hauteur maximale atteinte est affichée, mais ne compte pas.
- **Les paliers** : tous les 10 m de hauteur stable, un **bonus ou malus du jour** se déclenche, le même pour tous au même palier. Premier jalon :
  - bonus : *lierre* (la pièce suivante se colle à ce qu'elle touche), *pièce figée* (la pièce suivante devient immobile une fois posée), *petite pièce* ;
  - malus : *pièce géante*, *coup de vent* (poussée latérale pendant trois pièces), *pièce glissante*.
- **Médailles** : Bronze, Argent, Or et **Diamant**. Le Diamant est le score du bot de l'auteur (§ 5) ; dans les données, sa clé est `auteur`, comme dans les autres jeux.
- **La ligne à partager** : `Du Jour · Tower #12 — 42,7 m — 🥇 — ❤️❤️🖤`. Mêmes règles que les autres jeux : émojis seulement dans ce texte, rien d'identifiant, `💎` pour le Diamant.
- **Fantômes** :
  - la silhouette de **sa** meilleure tour, en transparence derrière la tour en cours ;
  - le bouton fantôme reste en vue en partie (charte, révision 12).
- **Classement** : à la hauteur, par jour. **Tower n'entre pas dans le classement cumulé au temps** (son score est une hauteur). Il a son classement et son onglet. La liste des jeux du cumul est un réglage de Nathan.

## 4. Direction artistique
- Dans la famille du portail (charte `docs/plateforme/identite.md`, direction « Cartouches ») : aplats francs, couleurs vives, ombres nettes, aucun dégradé, zéro asset.
- **Tower aura sa propre étiquette** (couleur, police, coque ou non), comme Track et Jump. Elle est proposée **en maquettes avant le lot T1** et choisie par Nathan.
- Les pièces ont **de petits yeux qui paniquent** quand la tour tangue (affichage seulement, comme le personnage de Jump).
- Une palette et un fond par thème du jour. Le vent est rendu visible par des traînées.
- Un effondrement court et lisible : secousse courte, sons Web Audio procéduraux.
- La caméra monte avec la tour.
- **Règles d'interface de la plateforme** :
  - HUD compact, une bande de 30 px en haut ; le centre est libre (ici, c'est la tour) ;
  - « on reste dans le jeu » ;
  - pause et « Comment jouer » en dialogues ;
  - bouton plein écran en vue ;
  - le message en direct seulement à l'accueil, à l'arrivée et en pause ;
  - textes en FR et EN dans les catalogues.

## 5. Le contenu du jour
- **`dailyTower(jour)`**, une fonction pure :
  - graine tirée de la date, même règle de changement de jour que Track et Jump ;
  - suite de pièces, en sac mélangé pour éviter les séries absurdes ;
  - plateforme ;
  - tirage des bonus et malus par palier ;
  - thème, suivant la **règle du sac de thèmes** des autres jeux : jamais deux jours de suite le même.
- **Jours figés** : comme Jump, les jours servis sont figés par « Mettre en production » (registre, version du générateur, aucune date écrite dans le code). Changer le générateur = monter `TOWER_GENERATOR_VERSION`.
- **Le bot de l'auteur** : pour chaque pièce, il essaie les positions et les rotations, simule jusqu'à la stabilisation, et garde le meilleur compromis hauteur / stabilité (glouton). Son score donne les médailles. Point de départ, à calibrer :
  - Or = Diamant × 0,90 ;
  - Argent = Diamant × 0,75 ;
  - Bronze = Diamant × 0,55.

  Il tourne **au moment où les jours sont figés**, pas au premier joueur du jour, et ses commandes **ne quittent jamais le serveur** (règle R9 : refus des copies). **Si son coût est trop élevé**, on se rabat sur une estimation géométrique (aire des pièces / largeur de la plateforme), à mesurer.

## 6. Technique
- Même architecture que Track et Jump :
  - `packages/tower-sim` pur : pas fixe, commandes entières par tick, aucune lecture d'horloge ni de hasard non semé ;
  - `apps/tower` : Vite et Three.js orthographique ;
  - rediffusion = preuve ;
  - `TOWER_SIM_VERSION` et `TOWER_GENERATOR_VERSION` ;
  - golden tests ;
  - déterminisme Node ↔ Chromium ↔ Firefox ↔ WebKit.
- **Le moteur physique est la grande inconnue** : contacts empilés entre corps rigides, frottement, mise en sommeil. Il sera choisi par l'**essai technique du lot T0**, sur des mesures.
- **Coût serveur** : rejouer 2 minutes de physique avec 40 corps coûte bien plus qu'un tour de Track. À mesurer dès le lot T0 : Cloud Run (1 vCPU) et la limitation de débit existante doivent tenir.

## 7. Hors du premier jalon
- Autres formes de pièces.
- Sorts lancés par le joueur.
- Mode puzzle (poser sous un laser).
- Mode course.
- Multijoueur, et classement par rang.

## 8. Références
*Tricky Towers* (WeirdBeard) pour la mécanique : on reprend les principes, **ni son nom ni son style visuel**.

## 9. Plan en lots
- **T0 — Essai technique de la physique.** **Décision de Nathan** à la fin : le moteur.
- **Maquettes de Tower** (conversation d'orchestration, pas un lot) : étiquette, HUD, accueil, arrivée. Validées par Nathan **avant T1**.
- **T1 — Une partie jouable** : pièces, commandes clavier et boutons tactiles, caméra, vies, fin, score, suite fixe d'essai, HUD des maquettes.
  - À tester : `/tower/?scenario=essai`.
- **T2 — Rediffusion et contenu du jour** : enregistrement, rejeu exact (4 environnements), golden, `dailyTower`, paliers de bonus et malus, jours figés.
  - À tester : `/tower/?seed=AAAA-MM-JJ` sur trois dates, et `?scenario=paliers` (tour montée juste sous le palier de 10 m).
- **T3 — Bot, médailles et thèmes.**
  - À tester : `?seed=…&bot` pour regarder le bot jouer, puis battre sa médaille.
- **T4 — Branchement à la plateforme** : classement prouvé côté serveur, journée, série, partage, carte d'accueil. C'est **Nathan** qui passe le jeu à `preview` depuis l'administration.
  - À tester : le lien d'aperçu sur téléphone.
- **T5 — Sensations** : yeux paniqués, sons, effondrements, réglages de sensation par Nathan (`?debug&tune`). Ensuite, Nathan passe le jeu à `on`.
