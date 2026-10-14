# Seed — « DailyJump » (titre provisoire)

Source de vérité du jeu. Vit dans `docs/jump/seed-dailyjump.md` du dépôt DailyTrack, n'est modifié que par Nathan. Deuxième jeu quotidien du futur portail, après DailyTrack. Développé **dans le cloud** (Claude Code sur le web), dans le **même monorepo** que DailyTrack, publié sur **GitHub Pages** sous `/jump/`.

---

## 1. Le jeu en une phrase
Chaque jour, un niveau de plateformes court et brutal à la Super Meat Boy, le même pour tout le monde : on meurt, on réapparaît aussitôt, on recommence jusqu'à passer, puis on chasse le chrono — et à la fin on regarde tous ses essais rejoués en même temps.

## 2. Les piliers
1. **Une minute par jour.** Un passage parfait dure 25 à 40 secondes. On joue en pause café, au clavier, à la manette ou au téléphone ; on revient demain.
2. **Le même niveau pour tous.** Un niveau par jour, déduit de la date (même règle de changement de jour que DailyTrack : minuit, heure de Paris), identique pour chaque joueur.
3. **La mort ne coûte rien.** Mort instantanée, réapparition au départ en moins de 0,2 s, aucun écran, aucun menu. Essais illimités. La frustration doit toujours se transformer en « encore une ».
4. **Un temps est une preuve.** La simulation est **déterministe et entièrement en entiers** : un essai est la suite des commandes du joueur, rejouable à l'identique partout. Le temps classé est celui que le code recalcule, jamais celui qu'on annonce.
5. **Toujours juste, toujours lisible.** Un danger se voit, une mort s'explique. Le niveau se lit d'un coup d'œil ; les commandes répondent à la frame près.

**Pas de difficulté selon le jour de la semaine** : chaque niveau vise le même niveau d'exigence.

## 3. Le personnage
- **Commandes** : gauche, droite, saut. **Pas de bouton de course** (simplifie le tactile ; la vitesse vient de l'élan). Recommencer : touche dédiée (R / bouton de manette / bouton à l'écran), qui repart du départ, chrono à zéro. Rien d'autre.
- **Sur téléphone** : moitié gauche de l'écran = gauche et droite (on glisse de l'une à l'autre sans lever le doigt), moitié droite = saut (tenir = plus haut), un petit bouton pour recommencer. Paysage recommandé, portrait jouable. **Le mobile est une cible de premier rang** : chaque lot est jouable au doigt dès sa livraison.
- **Mouvement** : accélération et décélération au sol, contrôle en l'air un peu plus faible, vitesse maximale.
- **Saut à hauteur variable** : relâcher tôt coupe le saut.
- **Mur** : glisser le long d'un mur en le poussant (chute ralentie) ; **saut mural** qui repousse du mur. C'est le cœur de Meat Boy. Remonter un mur seul, saut mural après saut mural, reste possible.
- **Les tolérances qui font les bonnes sensations** : *coyote time* (on peut encore sauter quelques ticks après avoir quitté le bord), *tampon de saut* (un appui juste avant l'atterrissage est pris en compte), tolérance de coin (on glisse au-dessus d'un coin qu'on frôle par la tête). Toutes en ticks, donc déterministes.
- **Le feeling se règle par Nathan** : panneau `?debug&tune` (gravité, impulsion de saut, coupe de saut, accélérations, vitesse de glisse, poussée murale, tolérances), utilisable aussi au doigt. Une partie jouée avec des réglages modifiés n'est jamais enregistrée ; les valeurs retenues deviennent les défauts (version +1).

## 4. Le niveau
- **Une grille de tuiles**, vue de côté, plusieurs écrans de long (horizontal avec des passages verticaux). La caméra suit le personnage avec une avance dans la direction du mouvement.
- **Éléments du premier jalon** : blocs pleins, pics, **scies** fixes et mobiles (trajet périodique), **blocs friables** (cèdent peu après qu'on s'y pose), **ressorts**. Un départ, une arrivée.
- **Plus tard** : glace, tapis roulants, vent, canons, lave montante, interrupteurs. Chaque nouvel élément entre avec sa règle de générateur.
- **Les éléments mobiles d'un morceau de niveau démarrent leur cycle quand le joueur entre dans ce morceau** (voir § 6). C'est un choix de design (le niveau est juste : on ne rate pas un passage parce qu'on est arrivé à la mauvaise seconde) et un choix technique (les solutions des morceaux restent valables une fois assemblées).
- **Points de passage** (fanions) : mourir après en avoir touché un fait reprendre dessus, **chrono qui continue** (comme les reprises de DailyTrack). Mourir avant le premier point, ou recommencer, démarre un nouvel essai depuis le départ, chrono à zéro. Pas de touche « revenir au dernier point » : seule la mort y ramène.
- **À la mort, tout le niveau revient à son état initial** (scies, blocs friables, ressorts) ; les éléments mobiles redémarrent à l'entrée de leur section. Chaque vie repart du même état.

## 5. La partie du jour
- **Le chrono** part à la première commande (le monde attend le joueur) et court jusqu'à l'arrivée, morts et reprises sur les points de passage comprises. Le **temps du jour** est le meilleur essai complet, avec ou sans morts : un essai avec reprises compte comme un autre. Le **nombre de morts** du jour est compté et affiché.
- **Vocabulaire** : un *essai* va du départ à l'arrivée (ou jusqu'à « recommencer ») ; une *vie* est un tronçon d'essai entre deux réapparitions.
- **Médailles** : bronze, argent, or et **temps de l'auteur** (§ 6). Les écarts entre médailles sont à calibrer sur de vraies parties (point de départ : or = auteur × 1,10, argent × 1,30, bronze × 1,60).
- **Fantôme** : son meilleur essai. Plus tard (avec le serveur) : celui du premier.
- **Le carnage** — la signature : à l'arrivée, **toutes les vies de la journée rejouées ensemble**, des dizaines de petits personnages qui meurent partout et un seul qui arrive au bout. Le « héros » est l'essai qui vient de finir, rejoué depuis le départ ; chaque autre vie part de son point de départ (départ ou point de passage) **au moment où le héros y passe**, si bien que le carnage avance par vagues avec lui. Chaque vie est déjà une suite de commandes : ça ne coûte que le rendu.
- **Les traces** : là où l'on meurt, une tache de peinture reste sur les murs et le sol pour la journée (non gore : de la couleur, pas du sang). Le niveau raconte nos échecs.
- **La ligne à partager** : `DailyJump #12 — 31,402 s — 🥇 — 47 💀` (le rang s'ajoutera avec le classement).
- **Archives** : rejouer les niveaux des jours précédents, sans classement.

## 6. Le niveau du jour : des morceaux qui portent leur solution
Le pilote automatique de DailyTrack ne se transpose pas : chercher une suite de sauts sur un niveau entier coûte trop cher. Le niveau du jour est donc **assemblé à partir de morceaux qui ont déjà leur solution**.

- **Le morceau** (« module ») : une portion de niveau écrite en texte (une grille ASCII, comme les circuits écrits à la main de DailyTrack) + ses métadonnées : intention (« saut mural en cheminée », « scies en quinconce »), étiquettes (mural, précision, vertical, scie, friable, ressort), raccord d'entrée et de sortie, durée de référence, et **sa solution** (une suite de commandes).
- **Les raccords** : chaque morceau commence et finit sur un **palier** (sol plat d'au moins 3 tuiles). Le palier d'entrée porte le **point de passage** du morceau. Deux états d'entrée possibles : *arrêt* (au sol, immobile) et *élan* (au sol, vitesse maximale vers la sortie). Chaque solution précise l'état dans lequel elle sort.
- **Le solveur hors ligne** : un script Node (`npm run solve:modules`) cherche la solution la plus rapide de chaque morceau et de chaque variante (recherche par faisceau sur des actions grossières : direction tenue × durée d'appui du saut, à un pas de quelques ticks). Les solutions sont **stockées dans le dépôt**, et un test vérifie que chacune, rejouée, amène bien le personnage au palier de sortie. Le solveur ne tourne jamais en production.
- **Les variantes** : un morceau existe en plusieurs réglages (largeur d'un trou, hauteur d'un mur, vitesse d'une scie). Chaque variante a sa propre solution stockée. Le catalogue est fini et vérifié.
- **L'assemblage du jour** : `dailyLevel(jour)` pur, graine tirée de la date, 6 à 10 morceaux enchaînés sur des raccords compatibles, avec des quotas (au moins un passage mural, au moins un passage de scies, pas plus de deux morceaux « précision » d'affilée, un morceau de respiration au milieu) et un repos par groupes pour limiter la répétition d'un jour à l'autre.
- **La validation** : la concaténation des solutions est **rejouée** sur le niveau assemblé. Si elle arrive au bout, le niveau est valide et ce temps est le **temps de l'auteur**. Sinon on essaie un autre tirage. Rien n'est supposé : tout est rejoué.
- **Les mesures** : un script (`npm run measure:jump`) donne, sur des dizaines de dates, le taux de validation, la durée de l'auteur (cible 25–40 s), la répartition des étiquettes et le coût d'un rejeu. Toute règle de générateur se juge à ses mesures.

## 7. Direction artistique
- **Formes géométriques procédurales, zéro asset** : le personnage est un carré expressif (deux yeux, écrasement et étirement à l'atterrissage et au saut — **à l'affichage seulement**), les tuiles sont des aplats à bord net, les scies tournent, les pics sont francs.
- Rendu **2D vue de côté en Three.js** (caméra orthographique) pour garder la pile et les outils de DailyTrack (pools de particules, `QualityGovernor`, réglages de qualité).
- **Une palette par jour** (thèmes comme DailyTrack : forêt, usine, glace, nuit, néon…), fond en deux ou trois plans de parallaxe simples.
- **La mort est un spectacle bref** : éclatement en particules de la couleur du personnage, petit tremblement d'écran (coupable), tache qui reste.
- **Son** : Web Audio procédural comme DailyTrack (saut, atterrissage, glisse, mort, scie, arrivée).
- Le jeu se charge en quelques secondes, mobile compris.

## 8. Technique
- **Dans le monorepo DailyTrack.** Espaces du jeu : `packages/jump-sim` (simulation pure du saut), `apps/jump` (le jeu), `docs/jump/` (seed, consignes, README des lots). Espaces partagés : `packages/core` (le socle commun, extrait **au besoin**) et `packages/clock` (la règle du changement de jour). DailyTrack ne doit **jamais** changer de comportement à cause de DailyJump : ses golden tests sont le garde-fou de toute extraction.
- **`packages/core`** est **pur** et ne contient **aucune logique de jeu** : PRNG à graine, conversion des jours du calendrier, codage des rediffusions (octets ↔ base64url, varint pour les séries compressées), test de pureté générique appliqué à `core`, à la sim de DailyTrack et à `jump-sim`. Il grandit seulement quand un jeu a besoin d'un morceau.
- **`packages/clock`** porte la règle « aujourd'hui = la date à Paris, changement à minuit ». Elle lit l'heure, donc elle reste **hors de `core`** et hors de toute sim ; les deux jeux l'utilisent telle quelle.
- **`packages/jump-sim`** :
  - pas fixe à 120 Hz, interpolation à l'affichage seulement ;
  - **aucun nombre à virgule dans l'état** : positions en unités entières (**1 tuile = 4 096 unités**, soit 16 px × 256 sous-pixels), vitesses en unités par tick, minuteries en ticks ;
  - divisions entières par une fonction maison (`idiv`) qui tronque vers zéro et **ne renvoie jamais `-0`** ; **seule exception** : l'indice de tuile d'une coordonnée (`tileOf`, décalage de 12 bits, arrondi vers le bas, jamais `-0`), plus rapide et testé ;
  - collisions boîte contre grille, axe par axe ; scies en cercle contre boîte, par distances au carré entières ;
  - **vitesse maximale strictement inférieure à une tuile par tick** (test) : la traversée de mur est impossible par construction ;
  - commandes : 3 bits par tick (gauche, droite, saut tenu) ; l'appui du saut est déduit dans la simulation ; « recommencer » est un événement de session, pas une commande de la simulation ;
  - mêmes interdits que la sim de DailyTrack (pas de `Math.random`, `Date`, fonctions transcendantes, imports externes autres que `@cdj/core`), vérifiés par le test de pureté, plus un test qui vérifie que tout l'état reste entier après des milliers de ticks aléatoires ;
  - `JUMP_SIM_VERSION` et `JUMP_GENERATOR_VERSION`, golden tests, même règle de versions que DailyTrack.
- **`apps/jump`** : Vite + Three.js, boucle à pas fixe, entrées clavier / manette / tactile fusionnées en mêmes commandes, outils `?debug` exposés sur `window.__jump` (même esprit que `__cdj` : `phase`, `manual`, `advance`…), stockage local préfixé `jump:`, paramètres d'adresse déclarés dans une liste unique (`urlOptions.ts`).
- **Publication** : le même site GitHub Pages que DailyTrack, sous `/jump/`, avec des chemins relatifs ; même mécanisme d'aperçu par branche (`/b/<branche>/jump/`).
- **Pas de serveur au premier jalon.** Le jeu fonctionne entièrement sans API (comme DailyTrack sans réseau).

## 9. Méthode
- Les règles de DailyTrack (guide technique § 8) : un lot = une session neuve = une branche = une PR brouillon ; README d'une page dans `docs/jump/lots/` ; le prompt de lot indique les modifications de `docs/jump/consignes.md` (importé par le `CLAUDE.md` racine) ; l'agent s'arrête quand la CI est verte ; rapports honnêtes (vérifié / non vérifié / décisions pour Nathan).
- **Zones partagées** (`packages/core`, `packages/clock`, `package.json` / `package-lock.json` racine, `.github/workflows/`, configuration racine, `CLAUDE.md` racine, `apps/api/Dockerfile`) : touchées seulement si le prompt le dit, jamais par deux lots en même temps ; un lot qui touche `packages/core` laisse inchangés les golden des deux jeux.
- **Chaque lot fournit un scénario lançable en deux clics** depuis l'aperçu, sur ordinateur comme sur téléphone : `?scenario=bac-a-sable`, `?scenario=essai`, `?module=<id>`, `?module=<id>&solution` (regarder la solution), `?seed=AAAA-MM-JJ`, `?debug&tune`, `?touch=1`. Tout paramètre d'adresse rejoint `urlOptions.ts`, puis la page d'admin.
- Effort moyen pour la plupart des lots ; le modèle le plus puissant pour la physique, le solveur et les bugs de déterminisme.

## 10. Hors du premier jalon
Classement en ligne et fantôme du premier (phase 2, avec le socle serveur commun) ; carte de chaleur des morts de tous les joueurs (phase 2) ; portail commun, série tous jeux confondus et publicité (phase 3) ; Salon en direct ; éditeur de niveaux ; objets à ramasser ; boss ; plusieurs personnages.

**Point ouvert pour la phase 2** : le nombre de morts et les points de mort ne sont pas prouvés si l'on n'envoie que le meilleur essai. Soit ils restent déclaratifs (jamais classés), soit le client envoie tous les essais et le serveur les rejoue (coût à mesurer).

## 11. Plan en lots
- **Lot 0 — Le socle partagé** *(livré)*. `packages/core` extrait de DailyTrack, golden de DailyTrack inchangés ; `packages/jump-sim` testé ; `apps/jump` publiée sous `/jump/` avec une grille et un personnage immobile ; CI étendue.
- **Lot 1 — Le personnage** *(livré)*. Physique en entiers, course, saut variable, glisse et saut muraux, tolérances, caméra, clavier et manette, panneau de réglages, bac à sable.
- **Lot 1b — Jouable sur mobile.** Commandes tactiles (gauche / droite à glisser, saut, recommencer), page adaptée au téléphone (aucun défilement ni zoom, paysage recommandé), panneau de réglages au doigt ; `tileOf` dans la sim (golden inchangés). **À tester** : le bac à sable sur téléphone, régler le feeling au doigt.
- **Lot 1b — Jouable sur mobile** *(livré)*.
- **Lot 2 — Les dangers et la mort** *(livré, avec la retouche 2b : points de passage)*. Pics, scies fixes et mobiles, blocs friables, ressorts ; mort instantanée, réapparition en 0,15 s, remise à zéro du niveau, chrono, arrivée ; niveau d'essai écrit à la main et sa solution (temps de l'auteur 21,6 s) ; galerie `?scenario=dangers`.
- **Lot 3 — La rediffusion et le carnage.** Enregistrement de chaque essai, rejeu exact (Node ↔ Chromium ↔ Firefox ↔ WebKit), golden ; fantôme du meilleur essai ; le carnage par vagues à l'arrivée ; les taches de peinture de la journée. **À tester** : `?scenario=essai&carnage=demo`, puis mourir une vingtaine de fois, finir, regarder son propre carnage.
- **Lot 3c — CI.** Les tests e2e de DailyJump rejoignent le rapport fusionné de la CI (tests instables nommés). Zone partagée : lancé seulement quand aucun lot de DailyTrack ne touche aux workflows.
- **Lot 4 — Les morceaux et le solveur.** Format des morceaux (grille, bloc annexe, métadonnées), solveur hors ligne (repris du chercheur du lot 2), 25 à 30 morceaux avec leurs variantes, une solution par variante et par état d'entrée, stockées et testées ; mesure de l'**exigence** d'un morceau (marge de sa solution) pour écarter les passages au pas près ; galerie des morceaux. **À tester** : la galerie, `?module=<id>` pour jouer un morceau, `&solution` pour regarder sa solution.
- **Lot 5 — Le niveau du jour.** Assemblage par la date, raccords, quotas, repos, validation par rejeu, temps de l'auteur et médailles, palette du jour, script de mesure. **À tester** : trois dates (`?seed=`) donnent trois niveaux jouables et différents.
- **Lot 6 — L'arrivée et le partage.** Écran d'arrivée (temps, médaille, morts), ligne à partager, archives, accueil minimal. **Jalon** : une semaine de niveaux joués par Nathan.
- **Ensuite** : retouches de feeling, thèmes et nouveaux éléments, juice, finitions tactiles ; puis **phase 2** (socle serveur commun : identité et pseudo partagés avec DailyTrack, classement prouvé, fantôme du premier, carnage du jour) et **phase 3** (portail).

## 12. Références
- **Super Meat Boy** : la référence de rythme, de mort instantanée et de carnage final.
- **Celeste** : la référence des tolérances (coyote time, tampon de saut, coins) et de la lisibilité.
- **Spelunky 2** : un défi quotidien de plateformes, mais à un seul essai — l'autre façon de faire du quotidien.
- **DailyTrack** : tout ce qui n'est pas le personnage et le niveau.
