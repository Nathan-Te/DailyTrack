# Lot 27 — Ajustements de jeu (DailyJump)

Versions : `JUMP_SIM_VERSION` **11** (nouvelle : v3 à v10 se jouent toujours, chaque niveau porte sa version) · `JUMP_GENERATOR_VERSION` **21** (identifiants `…-g21`, `RESTART_GENERATOR`) · `VARIETY_DAYS` **4** (inchangé). Branche `claude/gifted-dirac-wwch23`, PR brouillon `jeu:jump`. Règles : `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md` (« Ajustements (lot 27) »). Retours de Nathan après avoir joué : les cinq points ci-dessous.

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté sur la PR) ; en local : `npm run dev:jump`. (`?seed=` ne fonctionne que hors production.) **2026-12-09** : une forêt de g21 (vent continu partout : `vent-pont`, `vent-planeur`, `champignon-rafale` v8 — un ancien morceau à rafales —, des champignons).

1. **Tout essayer d'un coup, sans debug** : `<aperçu>?seed=2026-12-09` — le **décompte** « 3, 2, 1, Partez ! » ; **mourir avant le premier fanion** (courir sans sauter) → on repart de **zéro**, le chrono à 0, sans décompte ; **R** après un fanion = reprise volontaire (le chrono continue, pas une mort) ; **Entrée** = recommencer à zéro (avec décompte) ; le **vent continu** (colonnes d'air qui ne s'arrêtent jamais) ; au doigt (`&touch=1`) les plaques drapeau et recommencer à côté de la pause ; à l'arrivée, le **résultat reste affiché pendant la rediffusion et le carnage**.
2. **Régler la durée du décompte** : `<aperçu>?seed=2026-12-09&debug&tune` — section Caméra, curseur « Décompte « 3, 2, 1, Partez ! » avant le départ » (1,5 s par défaut).

## Ce qui a changé

### 1. Mort avant le premier point de passage → nouvel essai à zéro (sim v11)
- Après l'attente de la reprise (le décor continue de tourner : cela masque le changement de position des dangers), l'essai **repart de l'état de départ exact** : chrono 0, horloge des dangers à leur phase de départ, **immédiatement, sans décompte**. Après le premier point : inchangé (reprise au dernier point, chrono qui continue). L'essai qui finit par cette mort est clos ; ses morts partent au carnage comme des vies.
- **Anciens niveaux inchangés** : `dailyLevel(jour, thème, 10)` rend le niveau g20 ; golden v3 à v10 **identiques au bit** (`daily-golden*.json`, `replay-golden*.json`) ; nouvelles références `…-v11.json` (jour : 19/12/2026). Rediffusions, vies et carnage des versions d'avant valides côté client et côté API.

### 2. Commandes harmonisées avec Track
Lues dans `apps/web/src/input.ts` (rien n'y est modifié ; un test lit ce fichier et compare) :

| action | Track | Jump (reprise) |
|---|---|---|
| dernier point de passage | **R** · manette **Y** · plaque drapeau | **R** · **Y** · plaque drapeau |
| recommencer depuis le départ | **Entrée** · manette **X** · plaque « recommencer » | **Entrée** · **X** · plaque « recommencer » |
| pause | P / Échap · Start · plaque pause | inchangé |

Au doigt, **en haut à gauche, à côté de la pause, dans l'ordre de Track** : pause · drapeau · recommencer · plein écran, cibles de 44 px, aux doigts seulement. Pause (« Recommencer à zéro », « Depuis le point de passage »), « Comment jouer » et Réglages › Commandes listent les deux actions (fr + en, `npm run traductions` fait).
- **Reprise volontaire** : un quatrième bit de la commande (`INPUT_RESPAWN`, rediffusions de v11 codées `count × 16 + bits`), enregistré, rejoué, **pas une mort** (ni compteur, ni carnage). **API** (aucun code changé) : les morts viennent du rejeu, donc elle est exclue des morts et des 30 par joueur ; testé (`apps/api/test/jumpLives.test.ts`). Avant le premier point, ou dans un niveau d'avant la v11 (une rediffusion ne peut pas la porter) : **elle fait « recommencer à zéro »**.

### 3. Forêt : le vent souffle en continu (g21)
Aucune zone en rafale dans un niveau v11 (règle de `dailyProblems`). Variantes à rafales écartées du catalogue v11 (texte, solutions et place gardés : références au bit près), remplacées par des variantes **ajoutées au bout** (`cycle=0` : la clause de rafale est retirée), toutes résolues et validées (solveur, toutes phases, voies parasites : 0 fermée) :

| morceau | variantes à rafales (écartées) | variantes continues (ajoutées) | notes |
|---|---|---|---|
| `champignon-rafale` | v0–v5 | v6, v7, v8 | 1 · 1 · 3 |
| `champignon-tourbillon` | v0–v5 | v6, v7, v8, v9 | 3 · 4 · 5 · 2 |
| `vent-relais` | v0, v1 | v2, v3, v4 | 5 · 5 · 4 |
| `vent-rafale` | v0–v5 | v6, v7 | 1 · 1 |

**Aucun morceau retiré.** `vent-rafale` (« attendre la rafale ») devient « se laisser porter entre les deux scies » : sans lui, la forêt perdait un morceau d'origine et un jour de 2027 tombait au **secours** à W = 4 (mesuré, test de variété) ; avec lui, 0 secours. Secours de la forêt rechoisi (l'ancien, à rafales, reste celui des références). Règle d'équilibre (lot 26) : la mécanique d'origine de la forêt est le **vent continu** ; les champignons restent « l'élément ». Les jours figés gardent leurs rafales et leur affichage (ralenti des feuilles, lot 18) : inchangé.

### 4. Le résultat pendant la rediffusion et le carnage
Un **autocollant compact** (charte « Cartouches ») posé **à gauche, sous le titre du carnage** : temps en grand, médaille, morts de l'essai, place au classement (quand le serveur l'a donnée), écart au record d'avant, puis REJOUER, « Classement » et « Suite : Track › ». Il ne cache ni l'arrivée (à droite du héros) ni le milieu du carnage. L'écran d'arrivée complet s'ouvre toujours à la fin du carnage (« Fermer »).
**Maquette à valider par Nathan** (Chromium, `captures-lot-27`) : paysage `img/lot-27-paysage-resultat-carnage.png` · portrait `img/lot-27-portrait-resultat-carnage.png` · ordinateur `img/lot-27-ordinateur-resultat-carnage.png`. (Le niveau capturé est un aperçu : pas de médaille de classement, pas de bouton « Classement ».)

### 5. Le décompte « 3, 2, 1, Partez ! »
**1,5 s** (180 pas : 3, 2, 1 de 0,5 s, puis « Partez ! » 0,7 s au départ du chrono), réglable dans `?debug&tune`. Au premier départ et à « recommencer à zéro » ; jamais après une mort. Les dangers bougent déjà en temps négatif (lot 15). Affichage seulement. Capture : `img/lot-27-paysage-decompte-3.png` (avec les plaques) et `img/lot-27-portrait-decompte-1.png`.

## Mesures, g21 contre g20 (lot 26)

| mesure | g20 (lot 26) | g21 |
|---|---|---|
| **niveau de secours utilisé** (120 dates) | **0** | **0** |
| tirages validés · tirage retenu (moy. · max) | 169 · 6,72 · 71 | 165 · 4,82 · 31 |
| temps de l'auteur (min · moy. · max) | 28,01 · 29,58 · 31,94 s | 28,02 · 29,56 · 32,01 s |
| plus longue course au sol sans saut (moy. · max) | 1,18 · 1,86 s | 1,17 · 1,93 s |
| génération d'un niveau, rejeux compris (moy. · max) | 69,0 · 461,6 ms | 83,7 · 491,3 ms |
| **W = 4, 365 dates** (`variete:jump`) | 0 secours, écart min. 4 | **0 secours, écart min. 4**, 125 morceaux employés sur 125 |
| génération à froid, 48 dates | 0,21 s · 0,74 s | **0,30 s · 0,67 s** (< 1,5 s) |
| équilibre : jours à élément (forêt · usine · glace · nuit · néon) | 72 · 70 · 81 · 80 · 68 % (365 dates) | 81 · 56 · 83 · 81 · 61 % (120 dates : échantillon plus bruité, usine 56 % et néon 61 % comme en g20 sur 120) |
| budget Jump (JS + CSS) · catalogue anglais | 358 034 o · 5 631 o | 361 447 o (+3 413, marge 17 043) · 5 753 o |

## Décisions laissées à Nathan
1. **Durée du décompte** : Track a un décompte de **3 s** (3, 2, 1, PARTEZ !) ; la demande disait « environ 1,5 s » et « aligne sur Track s'il en a un » : j'ai gardé **1,5 s** et le **style** de Track (annonce au premier tiers, chiffres puis « Partez ! »). Une valeur (`START_DEFAULTS.pret`) pour passer à 3 s.
2. **Select** ne recommence plus (comme Track, où c'est la caméra) : Jump n'a pas de touche caméra, il reste libre.
3. **Petit portrait (≤ 599 px)** : les deux plaques tactiles sont cachées (la bande du centre prend la place ; la pause les propose) ; en paysage, partout, elles sont là. Le drapeau n'existe que dans un niveau en v11 (les jours figés en v10 et les morceaux n'ont pas de reprise volontaire : R y recommence à zéro).
4. **Index du `CLAUDE.md` racine** (zone partagée, non touchée) : y ajouter « Ajustements (lot 27) » sous `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`.
5. `e2e/zones.json` (zone partagée) n'est pas touché : les tests de navigateur du lot sont dans `horloge.spec.ts` (déjà déclaré).
6. Jours : g21 commence au jour de bascule de « Mettre en production » ; **aucun jour public ni figé touché** (`figes:jump -- --verifier` à jour). Démonstration `public/demo/` régénérée (`jump:seed`).

## Vérifié, non vérifié
**Vérifié** : tests unitaires (jump-sim, apps/jump, apps/api sur SQLite), e2e Chromium des specs touchés, construction, typecheck, 365 dates sans secours, captures (paysage, portrait, ordinateur) regardées. **Non vérifié** : Firefox et WebKit (la CI complète de `main` ; le format ×16 des rediffusions v11 n'a pas de référence croisée entre navigateurs), le rendu sur un vrai téléphone, libSQL (la CI).
