# Lot V1 — « Vertige » : la gravité par quarts de tour et les portails

**État : prêt à tester, PR en brouillon, jeu `off`.** Partie 0 (retrait du style Cartouche et des mains), partie 1 (gravité) et partie 2 (portails) sont livrées. Hors périmètre, non touché : modules et solutions, générateur, médailles, son, passe artistique, téléphone, mentions légales, valeurs de sensation de V0.

## Livré
- **Partie 0** : « Lumière douce » est le seul rendu (code, touches 1 et 2, `?style=`, option du Confort retirés ; clé `vertige:confort` inchangée, un ancien `style` stocké est ignoré). Les mains procédurales sont retirées. Le retour de sensation passe par la caméra : champ de vision +12° au dash, roulis sur le mur, **léger balancement de la marche** (réglable : case « Balancement » du Confort).
- **Partie 1, la gravité** (`packages/vertige-sim`, entiers) : 24 repères (les rotations du cube, `orientation.ts`), la physique de V0 inchangée dans le repère du joueur. **Bascule instantanée** (centre de la boîte et vitesse du monde conservés, lacet et tangage relatifs au repère), **transition de la caméra de 0,3 s** (réglable dans `?debug&tune`, 0 à 1 000 ms). Deux déclencheurs à comparer : **(a) surfaces** (blocs marqués : on les touche, la gravité tourne vers eux) et **(b) orbes** (flèche = nouvelle gravité). Le format de rediffusion ne change pas : la gravité vient de la simulation.
- **Partie 2, les portails** (`portails.ts`, `fenetres.ts`) : paires d'ouvertures de 1,6 × 2,4 m dans un mur de blocs, poche vide de 1 m derrière le plan. **Le centre de la boîte passe le plan** : translation et rotation s'appliquent à la position, la vitesse, le regard **et la gravité**. **Un seul niveau de rendu** (les autres portails y sont des aplats roses). **Couture invisible** : quand l'œil est dans la poche, la caméra est de l'autre côté.
- **Règles écrites** dans `docs/vertige/consignes.md` (« La gravité », « Les portails », regard à 120 Hz, questions ouvertes) ; `seed.md` mis à jour comme demandé (Arcade confirmée, 30 à 45 s, Lumière douce retenue et niveaux de qualité en V4, pas de mains) — **c'est une exception à « ne pas modifier le seed », faite à ta demande**.
- **Version** : `VERTIGE_SIM_VERSION` 2 (les anciennes rediffusions sont refusées : le jeu est `off`) ; le générateur reste à 1 (le contenu du jour est le même).

## À tester (2 clics, sur l'aperçu de la PR, sur ordinateur)
1. `/vertige/?scenario=gravite&debug&tune` : à l'ouest, **sauter sous le plafond violet** (la gravité monte, on marche la tête en bas), **courir contre le grand mur violet** puis longer le mur du nord (« d'un mur à l'autre ») ; à l'est, **prendre les orbes** (leur flèche dit la direction ; R recommence). Régler la transition de caméra dans « Sensations ». Dis si tu gardes (a), (b) ou les deux.
2. `/vertige/?scenario=portails&debug&fps` : trois paires dans l'ordre — **droite** (A1 → B1), **quart de tour** (A2 → B2, la vue tourne de 90°), **qui change la gravité** (A3 → plafond de B3 : on ressort en tombant vers l'ouest et on retombe sur le grand mur) ; puis l'**orbe** du mur (retour au sol) et l'arrivée. `?scenario=cube` : les six directions à la suite. Captures et GIF : `images/lot-V1-*.png`, `lot-V1-portails.gif`, `lot-V1-cube.gif`.

## Critères d'arrêt
- **Golden étendu** (`packages/vertige-sim/test/fixtures/golden-vertige.json`, 11 rediffusions, **état complet tous les 600 pas**) : le cube (six orbes à la suite = les six directions), le parcours des portails (3 traversées, 1 bascule), un va-et-vient (30 traversées), des marches au hasard semé vers les surfaces, les orbes et les portails. **Node ✓, Chromium ✓ (`determinisme.spec.ts`, au bit près). WebKit et Firefox : non lancés ici** (leur téléchargement est refusé dans ce conteneur) ; le job `@navigateurs` de la CI les lit. Rien dans le code n'est propre à un moteur : entiers seulement, pas de `Math.sin`, produits sous 2⁵³.
- **Mesures** (détail et méthode : `V1-mesures.md`) :
  - **Rejeu avec portails** : **5,0 ms pour 45 s, 13,0 ms pour 120 s** (Node, ce conteneur) ; même coût que sans portail, il vient des boîtes testées. Sur Cloud Run, compter ~25 à 50 ms pour 120 s.
  - **Images par seconde avec un portail à l'écran** (rendu logiciel, aucun GPU ici ; « portable » = processeur ÷ 4, qui ne ralentit pas le rastériseur) : halo et ombres **9,7 / 13,4 i/s**, sans halo **13,0 / 12,1**, sans halo ni ombres **10,0 / 23,4** ; sans portail 19 / 17 (36 sans halo). **Chiffres très bruités, ordre de grandeur seulement.** Solide : **un portail visible fait passer de 111 à 308 appels de dessin** (13 000 triangles) — chaque fenêtre redessine la scène.
  - **Poids** : premier chargement **49 926 o** gzip (V0 : 49 707, **+219 o**), plafond 53 Ko intact (marge 3 074) ; `corps-` à la demande 154 Ko gzip (+1 Ko). `budgets.md` mis à jour.
- **Tests** : `gravite.test.ts` (24 rotations, déclencheurs, bascule, **symétrie : un script joué dans les 24 orientations de la salle cubique donne le même état local**), `portails.test.ts` (poches vides, rotations propres, règle du centre, paire droite / quart de tour / gravité, retour, pieds en avant), `e2e/gravite-portails.spec.ts` (partie du navigateur = Node, transition, fenêtres, couture : images consécutives de la traversée sans saut).
- **CI de la PR** : à lire (voir la PR).

## Décisions prises (à confirmer)
- **Centre conservé à la bascule** (pas les pieds) puis poussée le long du nouveau haut : sur un plafond marqué la boîte retombe immédiatement ; l'angle de 180° tourne autour de l'axe horizontal le plus proche de la droite du joueur.
- **Orbes** : éteintes 2 s puis rallumées (pas à usage unique : on peut rejouer un essai) ; verrou de 0,2 s entre deux bascules.
- **Les surfaces tournent vers ce que l'on touche**, y compris par la tête ou le flanc ; une surface déjà sous les pieds ne fait rien.
- **Poche de 1 m, murs de 1,2 m** : la contrainte de niveau qui rend inutile tout cas particulier de collision « à cheval » (règle dans les consignes, testée).
- **Pas de transition de caméra à une traversée** : la couture invisible la remplace.

## Non vérifié, ou limites
- **Jamais joué à la souris ni à la manette réelles** (comme V0) : la transition de 0,3 s, le balancement et le ressenti des orbes / surfaces sont à juger par toi. Aucun vrai GPU ni portable : voir plus haut.
- **Coins entre deux surfaces marquées** (deux faces violettes qui se touchent) : le verrou de 0,2 s évite le tremblement mais la gravité peut y alterner ; à regarder dans `gravite` (le coin ouest/nord) avant de généraliser.
- **Le coût d'un portail** (× 2,8 en appels de dessin) devra être traité en V4 (décor lointain, demi-résolution) si les petites machines le sentent.
- Les mentions légales ne changent pas (aucune clé de stockage nouvelle : `vertige:confort` gagne deux champs).

## Questions pour Nathan
1. **Déclencheur : (a) surfaces, (b) orbes, ou les deux ?** (ajouté aux questions ouvertes des consignes.)
2. La transition de caméra (0,3 s) : trop courte, trop longue, ou à couper pour certains joueurs (case dans le Confort) ?
3. Le balancement de la marche : à garder par défaut ?

## Pour les joueurs
rien
