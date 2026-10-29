# Lot 28 — Blocs alternés lisibles (DailyJump)

Versions : `JUMP_SIM_VERSION` **12** (nouvelle : v3 à v11 se jouent toujours, golden **identiques au bit**) · `JUMP_GENERATOR_VERSION` **22** (identifiants `…-g22`, `ALT_KEPT_GENERATOR`) · `VARIETY_DAYS` 4 (inchangé). Branche `claude/stoic-cerf-ms8o72`, PR brouillon `jeu:jump`. Règles : `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md` (« Blocs alternés persistants / lisibles (lot 28) »). Retour de Nathan : « sur la nuit, les blocs qui alternent semblent se remettre à zéro parfois au point de passage ».

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté sur la PR) ; en local : `npm run dev:jump`. (`?seed=` ne fonctionne que hors production.)

1. **Néon, alternés près d'un point de passage** : `<aperçu>?seed=2026-11-10` — le premier morceau après le premier fanion est `neon-silence` (des blocs A/B en séries). Passe le fanion, **saute une fois** (les blocs passent en B : la face violette, la bascule laisse sa trace), puis **cours à droite jusqu'à mourir**. À la réapparition les blocs **restent en B** (avant : retour à A) ; le repère dit le jeu suivant (pastille sur les blocs pleins, filigrane sur les blocs absents). Un saut sur place sur le palier les remet en A.
2. **Nuit, sans alterné** : `<aperçu>?seed=2026-10-31` — aucun bloc alterné ; passe le fanion, meurs : les clignotants **continuent leur cycle sans à-coup** (ils ne repartent pas de zéro). Une mort **avant** le premier fanion recommence tout l'essai à zéro (lot 27, voulu).

## La cause trouvée (diagnostic, avant tout changement)

Mesuré sur les jours de production et de recette (`diag` jetables, rien de gardé) :
- **(a) est la cause, mais pas sur la nuit** : *aucun* jour de nuit n'a jamais de bloc alterné (0 sur 120 dates × 5 générateurs g14 / g17 / g19 / g20 / g21, 0 sur 365 dates en g22, 0 dans les 13 jours figés). Les **blocs A/B n'existent que dans le néon** ; les blocs qui « alternent » de la nuit sont les **clignotants** (b/d, deux groupes en opposition de phase). Hypothèse : Nathan a vu le **néon** (le jour figé du **28/10** en est un : 99 tuiles alternées, g17) : un néon sombre se prend pour une nuit. Là, la règle du lot 15 est bien celle qu'il décrit : la reprise remet A (`checkpointAttempt` repart de `initialAttempt`) **et** le fanion franchi remet A. Sur les 24 néons de 120 dates, la preuve de l'auteur est en **B pendant 47,5 % du temps** : près d'une mort sur deux remettait les blocs à l'état A, et **118 franchissements de fanion sur 225 (52 %) se font en B** (remise à A au fanion).
- **(b) écarté pour les joueurs** : les sections qui repartent de zéro à la reprise (v3) ne touchent que les jours figés d'avant le lancement (18/10 et 22/10, nuit) ; les archives commencent à la journée n° 1 (26/10).
- **(c) joue sur la nuit, voulu** : depuis le lot 27, une mort avant le premier point recommence l'essai à zéro (chrono et clignotants à leur phase de départ) — c'est un retour au départ complet, pas une remise à zéro « au point de passage » ; après le premier point, l'horloge continue.
- **(d) écarté** : 5 448 clignotants × reprises rejoués (nuits g21, plusieurs instants après le fanion) : l'état dessiné (`blockLooks`) est **toujours** celui de la formule `blinkIsSolid` du chrono, 0 écart.

## Ce qui a changé

### Simulation v12 (alternés persistants)
- **La reprise sur un point — après une mort ou par R — garde la parité (A ou B)** ; seul un nouvel essai à zéro (départ, « recommencer », mort avant le premier point) la remet à A. **Le fanion franchi remet toujours A** (voir décisions). v3 à v11 : inchangées ; niveau sans alterné : identique (testé sur 1 500 pas).
- **En-tête d'une vie** : `ReplayStart.alt` (drapeau de départ 16, seulement sur un point d'un niveau v12) ; l'empreinte du rejeu compte la parité en v12 seulement. L'API n'a pas changé (elle rejoue par `checkLife`) ; les 24 essais fictifs du jour de référence passent tous.
- **Joueurs fictifs** : repartant en B ils sautent d'abord sur place (sinon ils mouraient à chaque vie).

### Générateur g22
- **Validation de la reprise depuis B** (`npm run etats:modules`, 50 s) : 40 variantes à alternés (8 morceaux du néon + `petits-trous` et `saut-plafond` par `+alterne`), à chaque phase essayée de leur horloge, du palier en B, solution jouable par un humain (règle du lot 8c) sans plus de 12 s sur le palier. **Une variante écartée** : `laser-alterne-portes` v6 (phases 243 et 292 sur 390 : gigue ±3 à 24 % et 18 %), gardée dans le fichier pour g21 et avant. Pas de remplaçante (le morceau a déjà 10 variantes, `MAX_VARIANTS`).
- **Les alternés dans le néon seulement** : règle de `dailyProblems` (et 365 dates testées). Aucun jour public ni figé touché (`figes:jump -- --verifier` à jour). Démonstration `public/demo/` régénérée (`jump:seed` : seules les versions changent).

### Affichage (`apps/jump`)
- **Repère de l'état suivant** : bloc absent = son repère (barre A / losange B) en filigrane ; bloc plein = une pastille de l'autre jeu à son coin. **Bascule visible à chaque saut** : le jeu qui disparaît laisse une face fantôme 0,25 s (avec mouvement). **Jamais de changement sans saut** (sauf le fanion, voir décisions) : la reprise ne fait plus partir d'évènement de bascule en v12.

## Jours de nuit qui avaient des alternés
**Aucun** (voir (a)). Jours de néon concernés par le changement de règle : tous ceux de g22 ; par l'écartement de `laser-alterne-portes` v6 : 14 dates sur 120 changent de morceaux (en cascade par la règle de variété W = 4), aucune fixée.

## Mesures (120 dates, g22 contre g21 du README du lot 27)

| mesure | g21 (lot 27) | g22 |
|---|---|---|
| niveau de secours (120 dates) | 0 | **0** |
| tirages validés · tirage retenu (moy. · max) | 165 · 4,82 · 31 | 162 · 6,74 · **186** (30/11, forêt : la cascade de la variété) |
| temps de l'auteur (min · moy. · max) | 28,02 · 29,56 · 32,01 s | 28,02 · 29,53 · 32,01 s |
| plus longue course au sol sans saut (moy. · max) | 1,17 · 1,93 s | 1,18 · 1,93 s |
| génération rejeux compris (moy. · max, machine différente) | 83,7 · 491,3 ms | 66,4 · 362,9 ms |
| W = 4, 365 dates | 0 secours, écart min. 4, 125/125 | **0 secours, écart min. 4**, 125/125 |
| génération à froid, 48 dates | 0,30 · 0,67 s | **0,22 · 0,60 s** (< 1,5 s) |
| équilibre (forêt · usine · glace · nuit · néon) | 81 · 56 · 83 · 81 · 61 % | 81 · 56 · 83 · 81 · 61 % |
| budget Jump (JS + CSS) | 370 349 o (`main`, mesuré) | **371 110 o (+761, marge 7 380)** |

## Décisions laissées à Nathan
1. **Le fanion remet toujours A** (j'ai gardé la règle du lot 12). C'est le seul changement d'état sans saut qui reste ; or **52 % des franchissements de la preuve se font en B**, donc la bascule au fanion se verra encore. La retirer (« seul un nouvel essai à zéro remet A », au sens strict) demande qu'**un morceau à alternés soit jouable depuis A et B en élan** (aujourd'hui toutes les solutions du catalogue partent de A au fanion) : des solutions « depuis B » pour 40 variantes aux deux entrées, la preuve de l'auteur qui choisit ses solutions selon la parité, la validation de raccord en B — un lot à part, que je propose si le fanion gêne.
2. **Variante écartée sans remplaçante** (`laser-alterne-portes` v6) : en ajouter une exige de relever `MAX_VARIANTS` à 11.
3. **Index du `CLAUDE.md` racine** (zone partagée, non touchée) : y ajouter « Blocs alternés persistants (lot 28) » sous `packages/jump-sim/CLAUDE.md` et « Blocs alternés lisibles (lot 28) » sous `apps/jump/CLAUDE.md`. `e2e/zones.json` non touché : les deux tests de navigateur sont dans `horloge.spec.ts` (déjà déclaré).
4. **Pour les joueurs** : la PR le dit (lignes `[Jump]`).

## Vérifié, non vérifié
**Vérifié** : tests unitaires (`jump-sim`, `apps/jump`, `apps/api` jump), 2 tests de navigateur (Chromium), construction, typecheck, 365 dates sans secours, validation de l'état B, budget. **Non vérifié** : Firefox et WebKit (la CI complète de `main`), le rendu sur un vrai téléphone, libSQL (la CI), aucune capture regardée (le repère se lit dans les tests de dessin ; à valider à l'œil par Nathan sur l'aperçu).
