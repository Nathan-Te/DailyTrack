# Rush — consignes

Chargé par lecture des fichiers du jeu (zone `docs/rush/**`). Réponses et docs en français. **Créé par `npm run nouveau-jeu -- --id rush --nom "Rush" --classement temps --categorie arcade`** (lot K4g, lot BR0) ; vision : `docs/rush/seed.md` (provisoire : Nathan l'écrira) ; à coller dans une conversation d'orchestration : `docs/rush/passation.md` (générée). L'historique est dans `docs/rush/lots/`.

## État
- **Prototype (lot BR0)** : un chevalier, deux monstres, un boss, une arène, les sensations, les commandes, le rejeu par le serveur. **Pas encore** de niveau du jour (chemin, détours), d'XP, d'améliorations, de médailles définitives, de réserve de boss. Le jeu est « sans médaille » (`sansMedaille`) ; le « Diamant » n'est que la partie du pilote (`bot.ts`).
- **Il est `off`** (`etatDepart`) : absent de l'accueil, « Bientôt » sur sa page ; Nathan le passe en `preview` puis `on` depuis `/admin/` › Jeux. Catégorie **arcade** : classement propre, ni journée ni cumul.
- Les mentions légales ne nomment pas les clés `rush:*` tant que le jeu est `off` ; **avant `on`, un lot de la plateforme les décrit** (règle de fidélité du lot R5).

## Où est quoi
- `packages/rush-sim` : la simulation. `partie.ts` (le monde : chevalier, monstres, golem, zones annoncées, ondes, événements), `reglagesSim.ts` (les réglages de `?debug&tune`), `entrees.ts` (l'octet d'entrée), `rediffusion.ts` (l'enveloppe et la charge), `bot.ts` (le pilote), `variante.ts` (le classement : le temps, le seul endroit qui le sait), `generateur.ts` (le contenu : jour, `arene`, `boss`), `trig.ts` + `maths.ts` (la trigonométrie et les outils entiers), `constantes.ts` (versions, unités, limites). Golden : `npm run golden:rush -w @cdj/rush-sim`, **jamais sans monter la version concernée** ; mesures : `npm run mesures:rush -w @cdj/rush-sim`.
- `apps/rush` : `main.ts` (`brancherJeu`), `definition.ts` (la glue, premier chargement), **`corps.ts` (à la demande : la scène, la boucle, les sensations)**, `acteurs.ts` (les personnages), `effets.ts` (éclats, ombres, cercles rouges, ondes, arc du coup), `cel.ts` (ombrage plat et contour), `palette.ts`, `sons.ts`, `controles.ts` + `actions.ts` (commandes), `interface.ts` (cœurs, vie du golem, doigts), `tune.ts` + `sensations.ts` (`?debug&tune`), `essai.ts` (options d'adresse), `e2e/` (ports 4181 et 8795).
- `apps/api/src/rush.ts` (le contrat minimal), `apps/api/scripts/rush-*.ts`, `apps/api/test/rush.test.ts`.

## La direction artistique (3D sans aucun asset)
- **Tout est code** : sphères, cônes, boîtes arrondies (`RoundedBoxGeometry`), jamais de fichier de modèle ni de texture. Le sol est un damier dessiné sur un `canvas`.
- **Aplats** : `MeshToonMaterial` à **trois tons** (`cel.ts`, `DataTexture` de 3 pixels, filtre le plus proche) ; jamais de dégradé, de reflet ni de lumière ponctuelle. Les yeux et les lueurs sont des aplats sans lumière.
- **Contour noir** : la coque inversée (la forme lissée, gonflée de 4,5 cm le long de ses normales, vue de l'intérieur) ; l'encre est `ENCRE` de `palette.ts`.
- **Petits yeux** : un blanc et une pupille, qui clignent (`clignement`), sur chaque personnage ; ceux de la chauve-souris virent au rouge quand elle s'annonce.
- **Animation procédurale** : chaque image, `animer*` (`acteurs.ts`) pose le corps d'après l'état de la simulation — balancement de la marche, écrasement et étirement de la gelée, battement des ailes, bras du golem qui se lèvent pendant l'annonce et s'abattent à l'impact, roulade de l'esquive. Aucune animation enregistrée.
- **Les couleurs du monde** vivent dans `palette.ts` (les deux thèmes ne changent que le sol, le ciel et la lumière) ; l'interface hors partie ne lit que les jetons de `@cdj/ui`. **Les cercles rouges au sol** (`COULEURS.danger`) sont réservés aux attaques du golem : un cercle rouge = ça frappe.
- **Les sensations ne touchent jamais à la simulation** : arrêt sur image (le jeu retient les appels d'`avancer()` du kit pendant le gel : la simulation n'avance pas, **le chrono non plus** — à confirmer par Nathan, voir le README du lot), éclair blanc, secousse, éclats, ralenti. Leurs réglages sont dans `sensations.ts`.
- **Mesure de la scène** : `?debug&fps` affiche les images par seconde, le temps de dessin, les appels de dessin et les triangles ; viser **moins de 300 appels et 40 000 triangles avec 30 monstres**.

## La simulation entière
- **60 Hz, tout en entiers**, pas fixe (`TICKS_PAR_SECONDE`). 1 mètre = 4 096 unités ; les vitesses sont en unités par tick, les durées en ticks. **`idiv` pour toute division** (jamais de `-0`), `isqrt` pour une racine ; **jamais** `Math.sin`, `cos`, `atan2`, `pow`, `**`, `Date`, `performance`, `Math.random` (liste commune de `@cdj/core/testing`, `test/purete.test.ts`). La trigonométrie est une table de 128 directions (`trig.ts`).
- **Les entrées d'un tick tiennent dans un octet** (`entrees.ts`) : la direction (0 = aucune, 1 à 32), le coup (bit 6), l'esquive (bit 7). Le coup et l'esquive agissent sur le **front montant** ; l'appui est gardé en mémoire (10 ticks pour le coup, 6 pour l'esquive). La rediffusion est la suite des **changements** de cet octet (`rediffusion.ts` : écart en ticks, octet) : au plus 8 000 changements, 40 000 caractères ; le jeu ne change pas de direction plus d'une fois tous les 3 ticks.
- **Le hasard** (apparitions, positions des pierres) vient de `contenu.graine`, tiré à des ticks fixés par l'état. L'ordre des tirages ne change jamais sans monter `RUSH_SIM_VERSION`.
- **Les événements** (`Partie.evenements`, vides sans `journal`) servent au rendu (sons, éclats, secousse) et **ne sont jamais lus par la simulation**.
- **`RUSH_SIM_VERSION`** monte dès qu'une règle, une constante ou un réglage par défaut change une partie rejouée ; **`RUSH_GENERATOR_VERSION`** dès que le contenu d'un jour change. Puis `npm run golden:rush -w @cdj/rush-sim` en comprenant pourquoi.
- **Les réglages de `?debug&tune`** (`reglagesSim.ts`) changent la simulation : une partie jouée avec d'autres réglages n'est **pas classable** (`classable` de la définition). Les défauts sont ceux de la partie classée.
- **Le pilote** (`bot.ts`) lit l'état et rend l'octet d'entrée : il fait le Diamant provisoire, les mesures et les tests ; il gagne environ 98 % des jours. Il ne triche pas (mêmes entrées qu'un joueur).

## Les commandes
- **Au doigt** (charte, révision 17) : **un joystick virtuel à gauche** (32 directions), **« Coup » et « Esquive » en boutons à droite**, aux bords, jamais devant le personnage ; marges `env(safe-area-inset-*)` ; boutons de 44 px au moins (84 et 62 px). Le centre reste libre.
- **Au clavier** : flèches ou ZQSD/WASD pour bouger, espace ou J pour le coup, Maj gauche ou K pour l'esquive. **À la manette** : stick gauche ou croix, A (coup), B (esquive) ; Start met en pause. Toutes ces touches sont **réglables par jeu** (règle M2 : le jeu déclare `ACTIONS_RUSH`, jamais une touche en dur) ; le jeu lit les touches tenues par l'instance de `Commandes` du kit.
- Un nouvel écran déclare son action principale à la manette (`manette.ts` du kit, règle M1).

## Zone et budget
La ligne `rush.jsCss` de `docs/plateforme/budgets.md` est celle du premier chargement (l'accueil seul) ; **la scène 3D (`corps-`) et la simulation (`rediffusion-`) sont à la demande** (`budget.aLaDemande` de la fiche). Un budget ne se relève qu'avec Nathan. Un nouveau spec e2e se déclare dans la fiche (`e2e.specs`) **et** `apps/rush/e2e/durees.json`.
