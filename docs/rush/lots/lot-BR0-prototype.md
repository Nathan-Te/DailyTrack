# Lot BR0 — « Rush », prototype de boss rush (un chevalier, des gelées, un golem)

Titre et identifiant provisoires. Le jeu est **`off`**, catégorie **arcade**. Pas de niveau du jour, d'XP, de médailles ni de classement soigné : ce lot répond à trois questions. **Pour les joueurs : rien.**

## Livré
- **Créé par le kit** : `npm run nouveau-jeu -- --id rush --nom "Rush" --classement temps --categorie arcade` ; `docs/rush/seed.md` (la vision, provisoire) et `docs/rush/consignes.md` (la DA, la simulation entière, les commandes).
- **`packages/rush-sim`** (60 Hz, entiers, pur) : chevalier (32 directions, enchaînement de 3 coups en arc, esquive à fenêtre d'invincibilité, 3 cœurs), gelée, chauve-souris (tourne, s'annonce, plonge), **golem** (poing en zone, onde, chute de pierres, chacun **annoncé par un cercle rouge**, phase 2 sous 50 %), arène, chrono arrêté à la chute. Rediffusion = suite des changements de l'octet d'entrée. Un **pilote** (le « Diamant » provisoire, les mesures) gagne 59 jours sur 60.
- **`apps/rush`** : Three.js **à la demande**, 100 % code (ombrage à trois tons, contour par coque inversée, petits yeux, animation procédurale), arrêt sur image, recul, éclair blanc, secousse dosée, éclats, arc du coup, ralenti, 19 sons Web Audio procéduraux ; fantôme (le Diamant) ; joystick virtuel + « Coup » + « Esquive », clavier et manette réglables (M1, M2).
- **`?debug&tune`** : 13 curseurs (vitesse, portée, arc, cadence, recul, fenêtre d'esquive, vie et cadence du golem ; arrêt sur image, secousse, éclats, vue, éclair), « Exporter » en JSON (`&reglages=` le recharge). Un réglage de la simulation relance la partie, **non classable**.
- **Scénarios** : `?scenario=arene` (vagues sans fin, `&monstres=30`), `?scenario=boss`, `?scenario=boss&phase=2`.
- **Serveur** : contrat par `definirJeuNeuf`, essais, test d'API (SQLite et libSQL) ; golden (3 parties, 2 scénarios à 3 000 ticks, empreinte de tout l'état).

## Mesures (`npm run mesures:rush -w @cdj/rush-sim`, `?debug&fps`)
| Quoi | Résultat |
|---|---|
| **Déterminisme** | Node : 62 tests de la sim, golden au bit près + empreinte d'état. **Chromium** : même golden, `determinisme.spec.ts` vert. **Firefox et WebKit : non lancés ici** (Playwright refuse de les installer sur cette machine) ; le job `@navigateurs` de la CI les joue. Node et Chromium sont tous deux V8 : la preuve entre moteurs reste à faire en CI. |
| **Rejeu, 2 min** (arène, 30 monstres, 7 200 ticks) | **10 ms** (1,3 µs par tick) sur un Xeon 2,1 GHz ; Cloud Run (1 vCPU partagé) : estimé 2 à 3 fois plus, **< 40 ms** |
| **Rejeu, 5 min** (18 000 ticks) | **24 ms** ; estimé < 80 ms. Pire rejeu du jour (10 min, golem, chevalier invincible) : 27 ms. Une unité de plafond (`unitesServeur: 1`) suffit |
| **Taille** | partie du jour (22 s) : 349 changements, **943 caractères** ; 2 min : 5 128 ; 5 min : 12 915 ; **pire permis** (un changement tous les 3 ticks, 5 min) : 16 014 pour 40 000 acceptés |
| **Poids** | premier chargement **41,4 Ko gzip** (ligne `rush.jsCss`, plafond provisoire **44 Ko**) ; la partie **161,5 Ko gzip** à la demande (Three.js 149,7 + simulation 6,8 + kit 5,0 ; Tower : 159) |
| **Images par seconde**, 30 monstres | **non mesurables sur un téléphone ici.** Chromium sans GPU (rastériseur logiciel), processeur ralenti ×4 : 20 i/s, mais c'est le rastériseur. À lire : **7 ms de dessin côté processeur** sous ralenti ×4 (1,3 ms sans), pour 16,7 ms disponibles ; **~317 appels, 37 à 47 mille triangles**. À confirmer sur un vrai téléphone : `?debug&fps&scenario=arene&monstres=30` |

## Ce que je ne peux pas dire
- **Le combat est-il bon dans les mains ?** Je n'ai pas de main : j'ai vérifié que ça marche (le pilote bat le golem en ~22 s, un joueur immobile perd en ~9 s, chaque annonce précède son coup de 50 ticks au moins, l'esquive rend invincible) mais pas que ça se sent bien. C'est le but de `?debug&tune`.
- **La maquette `maquettes/boss-rush-3d.html` ne m'est pas parvenue** (seule la charte l'était) : elle n'est pas dans `docs/rush/maquettes/`, et la DA est écrite **d'après la description** (aplats, contour noir, petits yeux, caméra haute, famille crème / moutarde / terre cuite). À comparer avec la maquette.
- Captures et GIF (`docs/rush/lots/`) : rendus par un Chromium sans GPU, vues en paysage 844 × 390.

## Décisions prises (à confirmer)
- Le **chrono ne compte pas l'arrêt sur image** (le jeu retient les `avancer()` du kit ; la simulation n'en sait rien). Sinon : le mettre dans la simulation.
- **Défaite = le pire temps** (10 minutes), comme une partie inachevée de « Cibles ». Dans l'arène d'essai le chevalier ne meurt jamais.
- Golem à **120 points de vie** (le pilote : ~22 s ; un joueur : à mesurer), onde à esquiver **à l'instant où elle part** (l'anneau naît au bord du golem).
- Deux thèmes (`clair`, `sombre`) : seulement le sol et la lumière.
- Le HUD est celui du kit (bande de 44 px) + cœurs et vie du golem ; la charte vise une bande de 30 px : question de plateforme.
- `PAS_MIN_DIRECTION` : une direction change au plus tous les 3 ticks, pour borner la rediffusion.

## Questions pour Nathan
**DA** : le golem se lit-il (pile de cailloux ou boss) ? Le contour de 4,5 cm, la caméra à 60°, 13 m de sol dans la hauteur : trop loin sur téléphone ? Faut-il des ombres portées plus nettes, des visages plus expressifs (yeux du golem) ? Le sol damier, ou un décor par thème ? Les cercles rouges (bord plein, rayures qui avancent, clignotement final) sont-ils assez clairs sur le sol clair ?
**Sensations** : arrêt sur image (70 ms, ×1,35 sur le golem, ×1,7 au grand coup), secousse, recul (36 cm/tick), coup en 17 ticks (0,28 s), esquive de 16 ticks pour 40 d'attente, visée assistée (vers l'ennemi proche quand le doigt ne tient rien) : trop, pas assez ? Le golem frappe-t-il juste ? La phase 2 (deux coups, deux ondes à 48 ticks, cinq pierres) est-elle un pic ou un mur ? Faut-il retenir les cœurs, plus de cœurs ?
**Commandes** : joystick fixe en bas à gauche (ou flottant) ? « Coup » 84 px au pouce, « Esquive » 62 px au-dessus-gauche : bien placés ? Manette A = coup, B = esquive (X et Y sont au kit) ; clavier espace / Maj.

## Proposition de découpage
1. **BR1 — le niveau du jour** : une carte plus grande (chemin, détours, salles), caméra qui suit, tirée de la graine (générateur v2), thèmes. Le golem y est au bout.
2. **BR2 — l'XP et les améliorations** : les monstres donnent de l'XP, trois choix par niveau ; le choix est une entrée de la rediffusion (format v2, nouvel événement d'entrée).
3. **BR3 — la réserve de boss** : 4 à 6 boss, un par jour tiré de la graine ; le pilote apprend chaque boss.
4. **BR4 — les médailles.** **Recommandation : le pilote (robot) en trois stratégies** (foncer au boss, un peu d'XP, beaucoup d'XP) ; le **Diamant est la meilleure des trois**, or / argent / bronze en pourcentages comme aujourd'hui (130 / 160 / 200 %). Le **temps théorique** (distance ÷ vitesse + coups minimaux) ne sert qu'à **refuser** une rediffusion plus rapide que le possible. Le robot suit le précédent de Blocks et de Jump et réutilise le rejeu ; le temps théorique seul ignore les choix du joueur.
5. **BR5 — le branchement final** : mentions légales (`rush:*`), musique, « Comment jouer » avec schéma, nouveautés, partage, fantôme, budgets, Firefox et WebKit, passage `preview`.
