# Seed — La catégorie « Party », 20 novembre 2026

Vision de Nathan. Ce seed est la source de vérité de la catégorie ; seul Nathan le modifie.

## L'idée
Une troisième catégorie, à côté des jeux classés (Track, Jump) et de l'arcade (Tower, Blocks…) : **des petits jeux très simples, de type party game**.

- **Un jeu Party ne change pas d'un jour à l'autre** : ni niveau du jour, ni thèmes. Seuls quelques éléments peuvent être tirés au hasard.
- **Une partie dure 30 à 60 secondes**, se comprend sans explication et se joue au doigt comme au clavier.
- **Un jeu Party coûte un ou deux lots**, pas dix : c'est la condition pour en avoir beaucoup.

## Étape 1 — Le jeu Party du jour
- **Pas de classement permanent** : le jeu ne change pas, un classement à vie n'aurait pas de sens.
- **Chaque jour, un jeu Party est mis en tête**, à tour de rôle. Lui seul a **un classement, pour ce jour-là**.
- Ce jour-là, tout le monde joue **la même partie** : les éléments tirés au hasard viennent de la graine du jour, et le serveur rejoue la partie pour valider le score.
- Les autres jeux Party restent **jouables librement**, avec le record personnel gardé sur l'appareil.
- La catégorie Party est **hors du cumul, de la journée parfaite et de la série**, comme l'arcade.
- Pas de médailles pour commencer.

## Étape 2 — Le lobby, chacun dans son coin
- Un joueur **crée un lobby**, choisit **une liste de jeux Party** et invite par un lien ; ses amis et son groupe sont à portée de main.
- **Chaque manche se lance pour tous** : chacun joue de son côté, en même temps, la même partie.
- **Entre deux manches, on voit les scores des autres**, des points selon la place, puis un podium final.
- Pas de temps réel : le serveur est interrogé entre les manches.

## Étape 3 — Se voir en direct
- Les joueurs se voient jouer en temps réel, en vrai party game.
- C'est une marche technique (connexions permanentes, coût du serveur) : **à décider après l'étape 2**, sur des chiffres. Un intermédiaire possible : la progression des autres, rafraîchie toutes les quelques secondes.

## Le moule d'un jeu Party
- Le kit fournit **tout l'habillage** : accueil, compte à rebours, fin de partie, record, classement du jour, réglages, retours, son.
- Le jeu n'écrit que **sa simulation** (déterministe, en entiers, rejouée par le serveur), **son rendu** et **ses textes**.
- **Pas de générateur de niveaux, pas de thèmes, pas de robot, pas de jours figés** : une graine suffit.
- L'identité (règle K5) est allégée : une couleur d'étiquette et une illustration ; la police et le motif sont ceux de la catégorie.

## Le premier jeu, pilote du moule : « Pile poil »
- **Dix jauges à la suite.** Un curseur va et vient sur une jauge ; on appuie pour l'arrêter **pile sur la cible**.
- Plus on est près du centre de la cible, plus on marque : 100 points au centre, 0 hors de la cible. Un arrêt parfait donne un bonus, et les arrêts parfaits d'affilée le font grimper.
- **De jauge en jauge, le curseur accélère et la cible rétrécit.** Les dernières jauges ont une cible qui bouge.
- **Une seule commande** : toucher l'écran, Espace ou un bouton de la manette.
- La graine tire la place et la taille des cibles, la vitesse et le sens de départ du curseur.
- La rediffusion ne contient que les dix pas des appuis.
- Le nom, les points et les vitesses se règlent sur le prototype (`?debug&tune`).

## Encore ouvert
- Le nom de la catégorie à l'écran (« Party » pour l'instant) et sa couleur.
- La règle du tour de rôle : dans l'ordre, ou tirée de la graine du jour sans répétition proche.
- Le record personnel : sur l'appareil seulement, ou gardé par le serveur.
- Les jeux suivants.
