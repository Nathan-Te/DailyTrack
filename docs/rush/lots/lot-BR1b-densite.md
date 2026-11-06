# Lot BR1b — Rush : un niveau dense, une course hors combat

Suite de BR1 (fusionné). Jeu `off` : golden et format libres (golden **régénéré**, `RUSH_SIM_VERSION` 4 → **5**, `RUSH_GENERATOR_VERSION` 2 → **3** ; ni l'une ni l'autre n'a été servie). **Pour les joueurs : rien** (jeu `off`). **DA figée** : seule la lisibilité (le chevalier penché, des lignes de vitesse, des obstacles en formes simples). Règles qui en sont issues : `docs/rush/consignes.md` (« Le niveau dense et la course (lot BR1b) »), `apps/rush/CLAUDE.md` (trois règles ajoutées).

## 1. La course hors combat (simulation, `partie.ts`)
- **Valeurs** (`reglagesSim.ts`, toutes des curseurs de `?debug&tune`) : `courseDelai` **72 ticks** (1,2 s), `courseMontee` **24 ticks** (0,4 s), `courseFacteur` **160 %**, `courseRayon` **1 000 cm** (10 m).
- `majCourse` (une fois par tick) : `calme` compte les ticks tranquilles ; passé le délai, `elan` monte d'un cran par tick **tant que le chevalier marche** ; la vitesse est `vit × (100·montée + (facteur − 100)·elan) / (100·montée)`.
- **Coupée aussitôt** (`calme` et `elan` à 0) : au **premier coup donné** (`commencerCoup`, et pendant tout le coup), à la **première alerte** d'un monstre (`veille`), au **premier dégât** (`blesser`), et tant qu'un **ennemi déjà alerté** est à moins du rayon. **Jamais une fois la barrière fermée**, ni dans les scénarios d'essai. **L'esquive est inchangée** (testé : même course calme ou en pleine course).
- **Lisibilité** : le chevalier se penche en avant (+0,34 rad) et allonge sa foulée ; des **lignes de vitesse** (cinq bandes brun pâle derrière lui : le blanc ne se lit pas sur le sable) ; plus de poussière. Rien d'autre. `br1b-course.png`.

## 2. Un niveau plus compact
- **Chemin principal de 70 à 100 m** (`BORNES_NIVEAU` mis à jour ; mesuré **70 / 80 / 90 m** sur 365 jours), étapes de 4,5 à 7 m, liens plus courts. **Une clairière ou une rencontre tous les 12,4 m en moyenne** (la consigne visait 15 à 20 m : voir « Questions »). Aucun monstre du chemin à moins de 16 m du départ.

## 3. La règle de densité
- **Jamais plus de ~4 s de course sans rencontre** sur le chemin principal : `sansRencontreMax` 3 000 cm (4 s à 7,49 m/s). `rencontresDuChemin` mesure sur la grille (le champ de distance donne l'abscisse de chaque rencontre ; une rencontre a une **portée** : l'alerte de 10 à 12 m d'un groupe, 7 / 10 m d'un monstre seul, 2,5 m d'un obstacle) le plus long tronçon entre deux rencontres, du départ au bord de l'arène. **`problemesDuNiveau` refuse un niveau qui la dépasse** ; le plan ajoute un épars au milieu du plus long tronçon tant que c'est nécessaire ; **le niveau porte son temps maximal** (`Niveau.sansRencontreCm`, `tempsSansRencontre`, affiché par jour sur la carte). **Mesuré : 1,1 / 1,8 / 2,9 s** (min / médiane / max, 365 jours) — très sous 4 s : les alertes de 10 à 12 m remplissent le chemin.
- **Groupes** : 2 à 4 par niveau, **2 à 4 monstres** (70 % gelées), en travers du chemin (sur un lien de 6,4 m ou un pont de 4,4 m : où il est étroit), **alerte de 10 à 12 m** (`Monstre.ra`, propre à chaque monstre). `br1b-groupe-avant.png`, `br1b-groupe-alerte.png`.
- **Obstacles cassables** : 1 à 2 par niveau, **ronces (1 coup)** ou **caisses (2 coups)**, un disque de cases du chemin. Le coup final en vaut deux. Deux sortes (mesuré : **272 sur 367 contournables**) : ils **barrent tout** (il faut les briser) ou **laissent un passage plus étroit et plus long** (≥ 1,2 m de plus, vérifié sur la grille). Ils occupent leurs cases (`bloquees`, `marchable`) jusqu'à ce qu'ils cèdent (événements `obstacle`, `brise`). **Ils ne donnent rien** : `butin` (0) est l'emplacement prévu pour les gemmes du BR2. `br1b-obstacle-intact|touche|brise.png`.

## 4. Des détours en boucle
- Le camp est posé entre **deux clairières consécutives** du chemin et lui est relié **aux deux** (`Detour.hub2`) : le détour revient plus loin ; le chemin principal reste le plus court (testé : aucun camp sur le champ de distance). **Mesuré : 79 % des détours sont des boucles** (839 sur 1 060 ; 183 jours sur 365 entièrement en boucle) ; au moins la moitié dans **chaque** niveau (règle). Les autres sont des culs-de-sac quand la géométrie (écarts de 8 m, angles) ne laisse pas de place : 60 essais de boucle, puis 16 de cul-de-sac.
- **Coût d'un détour** (pilote qui ne prend que ce camp, comparé à « foncer », 176 détours sur 60 jours) : **−3,6 / 10,3 / 24,3 s** (min / médiane / max). Les camps font **8 à 11 monstres** et sont à **17-85 m** du chemin (21 / 54 / 84 m mesurés). **Limite honnête** : la boucle évite la rencontre du lien qu'elle double, donc le coût net peut être faible (négatif au pire) ; la médiane est à 10 s, le bas de la cible.

## 5. Cibles de temps (pilote, 60 jours : `npm run mesures:rush -w @cdj/rush-sim`)
| | victoires | temps min / médiane / max | dégâts subis | rediffusion |
|---|---|---|---|---|
| **foncer** | **60 / 60** (≥ 58 demandé) | **49,4 / 57,5 / 71,1 s** (golem compris) | **0,28** | 2 571 caractères au plus |
| **tout nettoyer** | 57 / 60 | 90,1 / 119,6 / 139,4 s | 0,57 | **6 388** au plus (pour 40 000) |
- **Écart tout nettoyer − foncer** (parties gagnées des deux côtés) : **30,6 / 61,1 / 88,9 s** (médiane **+61 s** : dans « +60 à 90 s »). **Foncer** : médiane 57,5 s, dans « ~45 à 60 s » ; **quelques jours dépassent 60 s** (le maximum, 71 s, est un jour où le pilote perd du temps contre un groupe). Le golem prend ~33 s.
- **Le pilote sait utiliser la course** : il marche sans cesse et ne frappe que ce qui barre la route, donc la simulation la lui donne ; mesuré : **la course couvre 5 / 19 / 33 % du trajet avant l'arène** (médiane 19 %). Elle sert surtout dans les clairières, au départ et sur les liens des boucles ; entre les groupes il y a peu de place (les alertes de 10 à 12 m, voulues).

## 6. Scénarios à 2 clics (en local : `npm run dev -w @cdj/rush`, puis JOUER)
- `/?debug&scenario=jour` (`&jour=2026-11-10`, `&theme=carriere`) : le niveau du jour.
- `/?debug&scenario=carte&jours=7` : la vue de dessus des 7 jours avec les **boucles** (bleu), les **groupes** (orange, cercle d'alerte), les **obstacles** (vert : ronces, marron : caisses), le **plus long temps sans rencontre**, les temps « foncer » et « tout nettoyer » de chaque jour.
- Captures (`docs/rush/lots/`, 1280 × 720, outil `apps/rush/e2e/captures-lot-br1b.spec.ts`, `CAPTURES=1`) : `br1b-carte-7-jours.png`, `br1b-groupe-avant.png`, `br1b-groupe-alerte.png`, `br1b-obstacle-intact.png`, `-touche.png`, `-brise.png`, `br1b-course.png`. J'en ai regardé quatre (carte, groupe, obstacle, course) ; les autres ne sont pas relues.

## 7. Mesures
- **Rejeu** (Node, Cloud Run 2 à 3 fois plus) : partie du jour du pilote 18 ms ; **pire jour** (10 min, chevalier invincible) **243 ms** (83 ms au BR1 : jusqu'à 50 monstres au lieu de 38) ; pire partie « tout nettoyer » sur 60 jours **175 ms** ; **taille de la rediffusion d'une partie « tout nettoyer » : 6 388 caractères au plus**. **Génération du niveau 7,8 ms** (1,3 au BR1 : 47 tentatives en moyenne, 325 au plus sur 365 jours, 448 sur 4 000 ; `MAX_ESSAIS` 4 000).
- **Poids** : premier chargement **43,01 Ko gzip pour 44** (42,82 au BR1) ; à la demande : scène `corps-` **181,0 Ko** (179,7), simulation `rediffusion-` **15,1 Ko** (12,3 : le générateur grossit).
- **Triangles du niveau** : jusqu'à 75 000 pour un niveau entier (le test passe de 60 000 à 100 000 : les boucles étalent le niveau ; le moteur coupe les morceaux hors du champ, un morceau reste sous 12 000). Appels de dessin sous 200 (spec e2e du BR1, inchangé).

## 8. Tests et ce qui n'est pas vérifié
- **Sim** : 131 tests, dont `course.test.ts` (12 : valeurs, montée, arrêt, coupure au coup / à l'alerte / au dégât, rayon, arène, scénarios, esquive, réglages, déterminisme) et, dans `niveau.test.ts`, densité, une clairière ou une rencontre tous les 15 à 20 m (mesure moyenne 11 à 20), groupes, boucles, obstacles (1 ou 2 coups, coup final, cases libérées, passage contourné ou barré), **sur 365 graines**, pilote. **Golden régénéré.** App : `niveauVue` (seuil des triangles), e2e Rush (un spec neuf : la course et un obstacle qui cède ; l'ancien sur la pastille « BOSS » passe de 100-175 m à 55-110 m).
- Hors zone de Rush, exceptions prévues : `docs/plateforme/traductions.md` (régénéré : curseurs de la course, légende de la carte).
- **Non vérifié** : le ressenti (rien n'a été joué à la main ni sur téléphone : la course, le poids des obstacles, la lisibilité du penché vu d'en haut, très discret) ; un vrai GPU ; Firefox et WebKit ; les ponts et les obstacles sur un pont (un obstacle ne barre jamais un pont : seulement un lien de chemin).

## Questions pour Nathan
- **Densité** : la règle des 4 s est tenue largement (2,9 s au plus) parce que les groupes à 10-12 m couvrent le chemin ; la course ne couvre que ~19 % du trajet. Veux-tu **plus de course** (moins de rencontres, des alertes plus petites) ou on garde ? Et **une rencontre tous les 12 m** (au lieu de 15 à 20) te convient-il ?
- **Coût des détours** : médiane 10 s (bas de « 10 à 25 »), parce que la boucle double un lien qui a lui-même une rencontre. Veux-tu des camps plus loin / plus gros, ou des boucles qui ne sautent aucune rencontre ?
- **Rejeu** : le pire jour passe de 83 à 243 ms (Node) : à garder ou à réduire (moins de monstres) ?
- **Temps de « foncer »** : médiane 57,5 s, quelques jours au-dessus de 60 s.
