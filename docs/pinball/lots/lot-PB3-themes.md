# Lot PB3 — Pinball : les éléments des quatre thèmes et les missions

Branche `ccr-3f426e27-b410vi` (le nom du prompt, `claude/pinball-themes-3`, n'a pas été pris : la session impose celui-ci), PR brouillon `jeu:pinball`. Le jeu reste `off`. **Versions : `PINBALL_SIM_VERSION` 3, `PINBALL_GENERATOR_VERSION` 3** (`PINBALL_BOT_VERSION` 1, seuils provisoires inchangés jusqu'au PB4) ; **golden régénéré** (`npm run golden:pinball`, voir plus bas).

## Livré
- **Les éléments, dans la simulation, en entiers, fonction du numéro de pas** (`packages/pinball-sim`, détail et unités : son `CLAUDE.md`) : **manège** (foire), **tourbillon** et **Bulles** plus douces (océan), **trou noir**, **deux portails** et **astéroïde** (espace), **geyser** et **coulée** (volcan). Points du seed (tour 500, coulée 300, geyser 750, portail 800, tourbillon 2 000). Emplacements de la maquette, **listes permises par thème** (`permisDe`).
- **La mission**, une par table : 5 tours de manège, 3 plongées, 3 passages par un portail, 4 geysers. **10 000 points au multiplicateur d'avant, puis un cran, une seule fois par partie.** `Partie.mission / but / compteur / missionFaite` ; **les quatre buts sont des réglages** (`butManege`…) donc dans `?debug&tune`.
- **Le rendu, dans les deux niveaux** : chaque élément visible et animé (three.js : volumes et textures qui tournent ; secours à plat : le dessin de la maquette) ; **chaque module porte son nom du thème** (catalogues fr + en) avec sa flèche, **qui clignote tant que la mission n'est pas réussie** ; lampes de la mission autour de l'élément ; **le moment fort** : éclat doré, message « Mission réussie ! ×2 », vibration, et **une brève secousse de caméra en three.js seulement** (jamais avec « moins de mouvement »).
- **Le HUD** : une pastille compacte en haut de la table (`.pinball-mission`) : la phrase de la mission avant le premier lancer, puis « Manège 3 / 5 » et sa jauge de lampes ; marges et largeur bornées pour le portrait (vérifié à 390 × 844).
- **`?debug&tune`** : 19 curseurs de plus (vitesse du manège, force et spirale du tourbillon, force du trou noir, poussée du geyser, accélération de la coulée, pauses, Bulles, **but de chaque mission**), bornes dans `bornes.ts`.
- **Essais (hors production, jamais classés)** : `?theme=<id>` joue maintenant **la table de ce thème** (avec son élément et sa mission : `dailyPinball(jour, version, theme)`), plus seulement ses couleurs ; **`?essai=mission`** met la partie au but moins un.
- **Réglages de Nathan** : **aucun JSON exporté n'était joint** à ce lot ; les réglages par défaut existants sont inchangés, les nouveaux sont ceux de la maquette (sauf les écarts ci-dessous).

## Écarts avec la maquette (décisions de ce lot, à confirmer en jouant)
- **Manège** : la maquette ajoute l'angle parcouru (`|da|`) dans un sens ou dans l'autre. Même règle ici, **au huitième de tour** (`secteur`, sans angle) ; elle se garde d'une bille à l'autre. Une traversée droite vaut un demi-tour.
- **Geyser** : la maquette fait `vx × 0,5`, ce qui peut ramener la bille sur lui. Ici : poussée **de côté, loin de lui** (90 px/s, `geyserDevie`) **et au plus 8 jets par bille** (`geyserParBille`) — un plafond dur pour la règle « aucun élément ne garde la bille ». Mesuré avec la valeur de la maquette (sans poussée de côté) : jusqu'à 3 jets à la suite, pas de boucle infinie observée ; le plafond reste la seule garantie démontrable.
- **Coulée** : elle ne pousse que **la bille qui monte** (300 points à l'entrée) ; celle de la maquette poussait aussi la bille qui tombe, et le bord haut du couloir était alors un équilibre stable (bille gardée).
- **Astéroïde** : période 2 048 pas (3,4 s) au lieu de 3,2 s, pour que l'angle avance d'un nombre entier d'unités par pas. **Tourbillon et portails** : capteurs après le déplacement (la maquette : avant), mêmes rayons et mêmes sorties.
- **Bulles** : les deux modules (le trio *et* la paire) sont plus doux dans l'océan (330 et 285 px/s) ; la maquette n'adoucissait que le trio.
- **Un élément qui n'est pas celui du thème** rapporte ses points mais ne compte pas pour la mission (utile aux essais).

## Le test de déterminisme (point 8)
`determinisme.test.ts` durait **24 s** et a dépassé son délai au PB2. Il est **découpé** : un test par table (deux par thème), parties de 3 minutes au plus, « répétée cent fois » sur une minute ; **tout le fichier dure 7 s, le plus long test 2,1 s**. **Ce qui reste couvert** : jeu pas à pas = pilote = serveur (`rejouer`) = `jouer`, sur les quatre thèmes ; la partie sans appui de 15 minutes entières ; la partie de 8 minutes du golden. **La campagne de 40 tables jusqu'à la fin** est celle de `npm run mesures:pinball` (40 / 40 jours, client = serveur ; coût d'un rejeu de 15 minutes ≈ 243 ms, 2,2 millions de pas/s). Le test « un événement de moins change la partie » retire maintenant **un appui et son relâchement** sur dix appuis (retirer deux événements fixes ne changeait plus la partie sur la nouvelle table).

## Vérifié
- **Tests du paquet** (175 verts) : `elements.test.ts` (32 : chaque élément et la mission, comptée une fois, du multiplicateur d'avant) ; **`themes-surete.test.ts`** : lâchée partout autour de chaque élément sans batteur, la bille est toujours perdue ou revenue au lanceur (4 thèmes × 4 tables) ; 600 tirs à 1 500 px/s par thème : jamais à moins de 5,8 px d'un mur, jamais hors de la table, jamais plus de 7,4 px par pas ; sorties des portails et du tourbillon libres sur 80 tables ; `generateur.test.ts` (listes permises, éléments présents et mission possible sur 400 jours par thème, thème imposé) ; **absence de flottant** (code, et état entier d'une vraie partie de **chaque thème**) ; golden (quatre rediffusions du pilote, une par thème, dont trois réussissent leur mission).
- **Serveur** : `apps/api/test/pinball.test.ts` joue le module d'essais sur **les quatre thèmes** (huit jours, deux parties par jour) : le serveur rejoue et retrouve les mêmes scores.
- **e2e** (33 tests existants + 9 de `themes.spec.ts`, 5 s) : pastille avant et après le lancer dans les quatre thèmes et en anglais ; `?essai=mission` : le moment fort (message, multiplicateur, score) est celui que la simulation calcule, au même pas, dans trois thèmes. `essai.test.ts` : `?essai=mission` rend la partie non classable, nul sur la production.
- **Poids** : premier chargement **44 159 o** (plafond 48 Ko, PB2 : 43 075 o) ; rendu à la demande **154 178 o** (`corps-` 149 392 + `dessin-` 4 786, gzip 9) sous le plafond de 166 Ko proposé au PB2.
- **Captures regardées** (390 × 844) : les quatre thèmes en three.js et un en rendu de secours (espace), **plus le moment fort de la foire, soit une de plus que les cinq permises** (c'est le point central du lot : il fallait le voir ; il a montré la jauge illisible sur le fond doré, corrigé). Outil : `captures-lot-pb3.spec.ts` (hors CI).
- **`npm run verifier` : tout est vert** (775 s : typecheck, tests unitaires SQLite 141 fichiers et libSQL 84, constructions, e2e de tous les jeux dont Pinball 6 specs, budgets). Deux échecs trouvés en route et corrigés : un caractère `³` du panneau absent de la police servie (`polices.test.ts`) et `docs/plateforme/traductions.md` à régénérer (`npm run traductions`).

## Non vérifié
- **La sensation de jeu** : les forces sont celles de la maquette, passées en entiers ; la manège (cinq tours), le geyser (poussée de côté) et la mission en général se règlent en jouant avec le panneau. **Le robot de la maquette réussit la mission sur 3 thèmes sur 4 en quelques minutes, et plonge rarement dans le tourbillon (océan : 0 / 3 sur la plupart des tables)** : à lire avec le robot du PB4, pas comme une difficulté.
- La fluidité de la 3D sur un vrai téléphone (comme au PB2, le conteneur n'a que le WebGL logiciel) ; la vibration de la mission ; Firefox et WebKit ; les captures des thèmes à 360 × 640 et du rendu de secours des trois autres thèmes ; **le moment fort des trois autres thèmes en image** (testé par e2e, pas regardé).
- Les liens de l'aperçu (voir plus bas) : le réseau du conteneur refuse `web.app`.

## Zones partagées et propositions
Rien hors zones, hors les exceptions tolérées : la fiche (`e2e.specs` : `themes.spec.ts`) et sa projection `config/jeux/projections/ci.json`, la ligne de Pinball de `budgets.md` (prose seulement : les colonnes se recalent par `--recaler`). **Reste proposé aux lots de la plateforme (déjà dit au PB2) : déclarer `three` dans `apps/pinball/package.json`, une ligne de budget mesurée du rendu, et les mentions légales (clés du navigateur du jeu).**

## Pour Nathan : tester en 2 clics (recette, le jeu est `off`)
La base de l'aperçu est donnée par le commentaire « Recette » de la PR (expire 7 jours après la dernière poussée) :
- **Un lien par thème**, jamais classé : `/pinball/?theme=foire`, `?theme=ocean`, `?theme=espace`, `?theme=volcan`
- **Une mission presque finie** (le moment fort tout de suite) : `/pinball/?theme=foire&essai=mission` — la partie commence au but moins un ; hors production, jamais classée
- **Les réglages** : `/pinball/?debug&tune` (sections Fête foraine, Océan, Espace, Volcan et Missions)
- Ce que Nathan regarde : on comprend chaque élément sans explication ; la flèche qui clignote montre quoi viser ; la mission réussie se sent.

## Attend les lots suivants
Un lot « b » avec les valeurs que Nathan règle · PB4 : robot, validation des tables, vrais seuils · PB5 : identité, textes complets, mentions · sons et musique.

**Pour les joueurs : rien**
