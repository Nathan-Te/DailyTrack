# Lot QA2 — maquettes améliorées des jeux : l'interface, puis le visuel

Relecture, sans correction : aucun fichier de `apps/*/src` ni de `packages/*/src` n'est modifié. Les deux parties sont livrées pour les cinq jeux.

## Ce qui est livré (`docs/relectures/maquettes/jeux/`)
- **Relecture relancée** sur la branche (= `main` après QA1) : `npm run relecture -- --seulement '^(track|jump|tower|blocks|rush)$' --langues fr --tailles 1440x900,390x844,844x390,360x740` — 30 passages, 377 s, aucun manque.
- **`<jeu>-interface.html` ×5** : avant (capture) / après (dessiné à la taille réelle, 1 440 × 900, 844 × 390, 390 × 844), 10 écrans chacun — accueil (ordinateur, paysage, portrait), arrivée (ordinateur, portrait), pause, réglages, classement, **HUD en partie en paysage et en portrait** avec le cadre des marges de l'iPhone — et une légende numérotée (constats J1… R2, plus ceux de ce lot : commandes qui recouvrent le sol de Jump, message « Tourne ton téléphone » qui couvre une flèche ou la voiture, barre de 52 px de Rush).
- **`comparaison.html`** : accueil et arrivée des cinq jeux, avant puis après, avec un tableau « commun (proposé une fois) / identité ».
- **`<jeu>-visuel.html` ×5** : à gauche la capture réelle, à droite la scène redessinée, en code seulement. Jump, Tower, Blocks en canvas ; **Track et Rush en three.js 0.186.1** (importmap jsdelivr), la caméra « proche » de Track y est reprise. Deux ou trois thèmes chacun, cinq propositions qui s'allument ou s'éteignent (`#base`, `#solo=<nom>`), une fiche par proposition (ce qui change, en code, coût en Ko gzip et en i/s, golden).
- **`index.html`** : les trois changements principaux de chaque maquette, trois lots de plateforme (accueil du kit, pause et arrivée, HUD commun) et un ou deux lots par jeu.
- Outils : `scripts/relecture/maquettes-jeux.mjs` (assemble ; sources dans `docs/relectures/maquettes/jeux/src/`), `scripts/relecture/mesure-visuels.mjs` (images par seconde, processeur ralenti 4 fois, écrit `src/mesures.json`).

## Scénario de test pour Nathan (2 clics)
1. Ouvrir `docs/relectures/maquettes/jeux/comparaison.html` : les cinq jeux, avant et après.
2. Ouvrir `track-visuel.html` puis `jump-visuel.html` : la scène actuelle, la scène proposée, deux thèmes (boutons en haut).

## Vérifié
- Les 11 pages s'ouvrent seules et ont été regardées dans Chromium (cadres d'interface, deux thèmes de chaque scène, aucune erreur de console). `npm run consignes`, typecheck, tests : voir la PR.
- Aucun fichier de jeu modifié ; aucune écriture en base ; aucune donnée personnelle (le joueur « Démo » des captures est fictif).
- Une seule idée **touche à la simulation** : la forme des circuits de Track (lot T-C, optionnel, change le générateur et les golden). Tout le reste est de l'affichage.

## Coût mesuré (i/s, processeur ralenti 4 fois, rendu logiciel : base → tout allumé)
Jump 52 → 35 · Tower 57 → 57 · Blocks 54 → 26 · Track 54 → 29 · Rush 51 → 47. **À retenir** : toutes les propositions ensemble coûtent cher dans Blocks (pièces avec yeux : 45 seules), Track (biomes : 39 seuls) et Jump (parallaxe : 37 seule) ; chaque lot de jeu les remesure et met les plans fixes en cache (un canvas hors écran pour le fond) avant de les adopter.

## Non vérifié, limites
- **Coût** : les Ko sont le poids gzip du code marqué dans chaque maquette (ordre de grandeur, ±50 %) ; les i/s sont pris dans Chromium **sans carte graphique** (rendu logiciel), processeur ralenti 4 fois, bruit d'environ ±10 % : ils comparent les propositions entre elles, ils ne prédisent pas un téléphone. Les scènes 3D sont plus légères que les jeux. À remesurer sur un vrai téléphone dans chaque lot de jeu.
- **three.js** : le réseau de cette session refuse jsdelivr ; les pages ont été vérifiées avec le même paquet 0.186.1 servi depuis `node_modules`. Ouvertes avec internet, elles chargent jsdelivr.
- **Captures** : Tower montre son thème Port par défaut (le jour est « Nuit », que la maquette visuelle montre aussi) ; l'arrivée de Blocks et de Rush est l'écran d'essai (`?scenario=…`) ; la partie de Track en portrait porte la carte « Tourne ton téléphone ». La marge du haut de l'iPhone en portrait (47 px simulés) ne se retrouve pas dans les captures : à vérifier sur un vrai téléphone.
- Les décors « scène schématique » des écrans de HUD sont des fonds neutres, pas le jeu ; le visuel est dans les maquettes visuelles. Vertige et Cibles : hors périmètre.

## Décisions laissées à Nathan
- Valider ou non chaque numéro des légendes, puis l'ordre des lots de l'index (plateforme d'abord).
- Le cadrage de Jump (sol à 62 % en paysage) est un réglage de caméra : à essayer avec `?debug&tune`.
- Lot T-C (variété des circuits de Track) : il change les golden, à décider.

## Pour les joueurs
rien
