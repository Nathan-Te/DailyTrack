# Lot V0 — « Vertige » : courir, sauter, longer les murs, dasher (prototype)

**État : prêt à tester, PR en brouillon, jeu `off`.** Deux parties livrées : la simulation et le bac à sable, puis les réglages et les mesures. Rien d'autre : pas de gravité, de portail, de niveau du jour, de médaille, de son (hors périmètre).

## Livré
- **Le jeu** créé par `npm run nouveau-jeu -- --id vertige --nom "Vertige" --classement temps --categorie arcade` (la commande a planté à la fin sous Windows : `fiches`, golden et `traductions` relancés à la main). `docs/vertige/` : `seed.md` (la vision de la passation), `passation-initiale.md`, `maquettes/vertige-maquette-3d.html`, `consignes.md` (monde en blocs, entiers, angle de vue en commande, deux styles, commandes).
- **`packages/vertige-sim`** : entière, 120 Hz, l'enveloppe commune. Boîte 0,6 × 1,8 × 0,6, collisions axe par axe. Course, saut (grâce au bord, saut mémorisé), contrôle en l'air, course sur le mur, saut de mur, dash ; valeurs de la maquette. Chrono du premier mouvement à la zone d'arrivée. Table de sinus **entière** (outil + test). Commandes d'un pas : touches, **lacet et tangage** (différences, 1/65 536 de tour).
- **`apps/vertige`** : Three.js, première personne, mains procédurales, roulis sur le mur, champ qui s'élargit au dash, **deux styles** (`?style=doux|cartouche`, touches 1 et 2). Souris à pointeur verrouillé, clavier par `event.code` (ZQSD et WASD sont les mêmes touches), manette (stick gauche, stick droit, A, RB), commandes réglables du kit ; R recommence. Scénarios `bac-a-sable`, `mur`, `parcours`. Sur écran tactile : « À jouer sur ordinateur… ».
- **Partie 2** : `?debug&tune` (19 réglages de sensation + sensibilité, champ, roulis ; export JSON ; `&reglages=` le recolle). **Confort** (bouton dans la scène) : champ de vision 70–110°, roulis, sensibilité, style, gardés dans `vertige:confort`. `?debug&fps` : images par seconde, appels de dessin, **taille réelle de la rediffusion en cours**.
- **Serveur** : le contrat par `definirJeuNeuf` (le temps en pas de 1/120 s, pas de médaille), rejeu vérifié par le banc, essais et recette.

## À tester (2 clics, sur l'aperçu de la PR, sur ordinateur)
1. `/vertige/?scenario=bac-a-sable&debug&tune` : courir, sauter, longer le mur (les deux murs de l'ouest), sauter du mur, dasher (les trous de 2 à 10 m : les deux derniers se passent au dash), puis régler et **Exporter**.
2. `/vertige/?scenario=parcours&style=cartouche`, puis `&style=doux` : finir le parcours, choisir un style. Captures : `images/lot-V0-lumiere-douce.png`, `images/lot-V0-cartouche.png` ; GIF du parcours : `images/lot-V0-parcours.gif`. Détail des mesures : `V0-mesures.md`.

## Mesures (Node 24, Ryzen 7 7800X3D ; Chromium avec un Radeon RX 7800 XT)
| Quoi | Résultat |
|---|---|
| Déterminisme au bit près | golden : 5 parties (parcours scripté, avec souris qui tremble, 2 marches au hasard de 6 000 pas, partie vide), **empreinte de tout l'état tous les 600 pas**. Node ✓, Chromium ✓, **WebKit ✓** (identiques au bit près). **Firefox ne se lance pas sur cette machine** (`spawn UNKNOWN`) : le job `@navigateurs` de la CI le lira. |
| Rejeu de 60 / 120 s | **3,2 / 6,5 ms** (arène, 17 boîtes) ; 44 ms pour 120 s avec **200 boîtes** ; 0,34 ms pour le parcours (6,2 s). Sur Cloud Run, compter 2 à 4 fois plus (vCPU partagé) : **~15–25 ms**, et 90–180 ms avec 200 boîtes. Le coût vient des boîtes testées à chaque pas, pas de la durée. |
| Taille de la rediffusion, 120 s | **souris synthétique** (aucune main humaine n'a joué) : 7 ko bruts (geste un quart du temps) à 22 ko (trois quarts, affichage 60 Hz), 45 ko (144 Hz) ; **pire cas 58 ko bruts, 77 000 caractères**, 32 ko en gzip. Regard à 60 Hz : environ moitié moins ; à 30 Hz : environ trois fois moins. Limite posée : 200 000 caractères. 60 s : environ moitié. `?debug&fps` donne la vraie valeur. |
| Poids | premier chargement **49,7 ko** gzip (plafond posé : 53 ko, **provisoire, à valider**) ; **à la demande** : `corps-` 603 ko brut / **153 ko gzip** (Three.js, scène, mains, commandes), simulation de la partie 2,7 ko, panneau d'essai 1,8 ko. |
| Images par seconde (1 280 × 720, sans limite) | GPU de la machine : **Lumière douce 1 100** (sans halo 1 340, sans ombres 1 310, sans les deux 1 710), **Cartouche 1 150** (sans ombres 1 440) ; 190 appels de dessin, 7 000 triangles. **Portable simulé** (rendu logiciel, processeur ÷ 4, 960 × 540) : douce **18**, sans halo 55, sans ombres 30, sans les deux 63 ; Cartouche **54**, sans ombres 67. Le halo coûte le plus, puis les ombres. **Aucun vrai portable moyen n'a servi** : ordres de grandeur seulement. |

## Écarts avec la maquette (décisions à confirmer)
- **Course sur le mur** : la maquette testait la vitesse horizontale totale (de face contre un mur, elle collait) ; ici, la vitesse **le long du mur**. Une vitesse contre un mur est annulée (le saut de mur pousse donc franchement). Les pas remplacent les secondes (arrondi : grâce 12 pas, saut mémorisé 14, dash 20, recharge 102).
- **Parcours sans portail** : il s'arrête sur la dernière plateforme (le château reste au loin, en décor). Trois gemmes sur quatre ; l'arrivée est une zone, plus un rayon.
- **Manette** : le déplacement est numérique (le stick vaut quatre touches) ; seul le regard est analogique.
- **Échap** : le navigateur garde la touche quand il rend la souris ; le jeu la renvoie au kit pour la pause.

## Non vérifié, ou limites
- Firefox, le job « Kit de bout en bout », « jeu-fictif », « Budgets » (mesuré à la main avec `mesureJeuNeuf`) : **à lire dans la CI**. Beaucoup de tests de la plateforme échouent sous Windows (chemins, fins de ligne) : détail dans la PR.
- **Jamais joué à la souris ni à la manette réelles** : le pointeur verrouillé et la manette ne sont pas testables ici. Les sensations sont à juger par Nathan.
- **Mentions légales** : `vertige:confort` (et les quatre clés du kit) doivent y être décrites **dès que les textes « à remplacer » partiront** : lot de la plateforme, à proposer avec V1.

## Questions pour Nathan
1. **Style** : Lumière douce (plus proche de l'image, 3 fois plus coûteuse sur petite machine) ou Cartouche (net, cohérent avec Tower, Blocks, Rush) — ou la lumière douce avec le contour ?
2. **Sensations** : lesquelles faut-il changer (`?debug&tune`, collez le JSON) ? la course sur le mur est-elle trop courte (1,7 s) ou trop collante ?
3. **Confort** : le roulis sur le mur et le champ de 84° vous gênent-ils ? Garder le roulis par défaut ?
4. **Téléphone** : « à jouer sur ordinateur » (ce lot) ou joystick, glisser pour regarder, boutons Saut et Dash ?
5. **Durée visée** (45 ou 90 s ?) et **regard à 60 Hz** (rediffusion deux fois plus petite) ?

## Découpage proposé
V1 gravité par quarts de tour et portails (les mentions légales) · V2 modules de niveau et leurs solutions · V3 générateur et robot (le Diamant, les médailles) · V4 rendu et effets · V5 son (session `ambient`) · V6 branchement final et téléphone.

## Pour les joueurs
rien
