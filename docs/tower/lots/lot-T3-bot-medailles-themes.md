# Lot T3 — Bot de l'auteur, médailles et thèmes

Branche `claude/tower-bot-medailles-themes-d8tz33`, PR brouillon. Consignes : `docs/tower/consignes.md` (mises à jour : « Le bot de l'auteur, les médailles et les thèmes »). Tower reste `off`. `lab/` intact ; aucune version ni aucun golden de Track ou de Jump touché ; `TOWER_SIM_VERSION` inchangée (3). **Aucun fichier de jour commité** (deux fichiers de test dans `packages/tower-sim/test/fixtures/jours/`). Pour les joueurs : rien.

## Livré
- **Le bot** (`packages/tower-sim/src/bot/`, pur, scanné par `purete.test.ts`) : glouton pièce par pièce, sur **une copie de la partie** (`Partie.cloner`, instantané du monde de Rapier : identique à l'original, testé). Positions à la demi-case (5 de chaque côté), rotations sans doublon (1 / 2 / 4), **les vraies commandes**, la tour se calme, note entière (hauteur − 100 000 par vie perdue − 1 500 par pièce qui bouge + largeur du sommet × 50 %). Arrêt anticipé par borne haute ; anticipation de la pièce suivante pour les 2 meilleurs coups. **La preuve est une rediffusion ordinaire** (`rejouer` redonne sa hauteur : testé). Les paliers s'appliquent à lui comme au joueur. Si le réglage ordinaire donne moins de 30 m, il essaie des **variantes** (poids de la largeur 20 / 100 / 0 %) sous un **plafond de 600 000 ticks de calcul** (un nombre de ticks, aucune horloge) ; une variante coupée par le plafond est abandonnée.
- **Il joue comme un joueur** (correction après le retour de Nathan sur le premier essai, où il posait ses pièces indésirables au pied de la tour, hors de l'écran, ou les jetait à la mer, et s'arrêtait en jetant ses dernières pièces) : **la caméra ne montre que 6,5 m sous le sommet de la tour** (`VUE_COURTE − MARGE_HAUT`) ; **un coup dont la pièce se pose plus bas est interdit** (`coupInterdit`, `PROFONDEUR_VISIBLE_MM`), il n'y a plus de coup « à la mer » et plus d'arrêt par jets : **le Diamant est la hauteur où finit une vraie partie, effondrements compris**. Vérifié : un test rejoue le bot sur une haute tour (aucune pièce sous la zone), un autre compare la constante à la caméra, et un audit de quatre jours rejoués donne **0 violation, la pièce la plus basse à 4,0 m sous le sommet**.
- **Les médailles** (`medailles.ts`) : millimètres entiers par `idiv`, Or 90 / Argent 75 / Bronze 55 % du Diamant (clé `auteur`), médaille la plus haute dont la hauteur atteint le seuil (≥) ; tests aux bords.
- **La préparation des jours** : `npm run preparer:tower -w @cdj/tower-sim -- --du … --au …` (un `worker_threads` par cœur, un jour par fil), fichier du jour avec `medailles` et `preuve` ; n'écrase qu'avec `--forcer`, **refuse toujours une autre version `g`** (`tools/plan.ts`, testé) ; garde-fou étendu : la preuve rejouée donne exactement le Diamant écrit.
- **Les thèmes** : six (`port`, `chantier`, `canyon`, `banquise`, `jungle`, `nuit`), sac commun de `@cdj/core` **tel quel** (n = 6 : pas d'arrêt nécessaire) ; `TOWER_GENERATOR_VERSION` = **2**, la version 1 (tout `port`) reste appelable et inchangée (golden : les empreintes de v1 sont gardées, v2 ne diffère que par le thème). Palettes en aplats ; les cinq autres à la demande. Test de contraste pièce / fond de chaque thème.
- **Le jeu** : objectif de médaille dans le HUD, « Médailles en calcul… », médailles « provisoires » (production sans fichier : estimation géométrique), bloc « Médailles du jour » et médaille obtenue à l'écran de fin, meilleure médaille de la session en mémoire, `?seed=…&bot` et `?theme=…` (hors production), Web Worker du bot (hors production, retiré de la construction de production), greffon qui retire la `preuve` des fichiers publiés (testé).

## Les mesures (`npm run mesures-t3:tower`, Xeon 2,1 GHz, 4 cœurs, 30 jours du 05/11 au 04/12/2026 — remesurées après la correction ci-dessus)
**Budget de calcul — tenu.** Une journée sur **un cœur** (9 jours, un à la fois, dont 4 repris avec une variante) : **médiane 43 s, pire cas 51 s** (budget 90 s). Avec 4 jours en parallèle (machine chargée) : médiane 46 s, pire 82 s. `preparer:tower` sur **14 jours, 4 cœurs : 2 min 43 s**.

| Secondes par pièce selon la hauteur de la tour (réglage ordinaire) | 0–10 m | 10–20 | 20–30 | 30–40 | 40–50 | 50–60 | 60–70 | 70–80 | 80–100 |
|---|---|---|---|---|---|---|---|---|---|
| | 0,5 | 0,8 | 0,9 | 1,2 | 1,1 | 1,2 | 1,3 | 2,0 | 2,5 |

**La hauteur du bot (le Diamant)**, 30 jours : médiane **49,4 m**, moyenne 56,0 m, minimum **4,1 m** (17/11), maximum 103,4 m ; quartiles 37,0 m et 74,0 m. Les 40 pièces sont posées 6 jours sur 30 ; 25 jours finissent à 0 vie (la partie s'arrête quand les trois vies sont perdues ; aucune n'est jetée exprès) ; **20 jours sur 30 ont eu besoin d'une variante** ; les six paliers sont franchis 21 jours sur 30 (plus haute tour atteinte avant la fin : médiane 73 m — le bot monte plus haut qu'il ne finit). Par largeur : 5 m 38,8 m (7 jours) · 6 m 51,0 m (11) · 7 m 67,6 m (4) · 8 m 48,9 m (8) — **la largeur ne se lit pas dans le Diamant**. *Avant la correction (arrêt par jets, pied de la tour) la médiane était de 68 m : cet écart est ce que le bot gagnait en trichant.*

**Deux joueurs simulés, en % du Diamant du jour**
| joueur | médiane | quartiles | ≥ 15 % | ≥ 30 % | ≥ 50 % | ≥ 75 % |
|---|---|---|---|---|---|---|
| glouton du lot T2 | 19 % (13,9 m) | 7 – 52 % | 53 % | 43 % | 27 % | 17 % |
| bot imparfait (décalage d'une demi-case, 1 pièce sur 4) | 16 % (9,1 m) | 6 – 53 % | 50 % | 37 % | 30 % | 7 % |

**Estimation géométrique** (aire des 40 pièces ÷ largeur de la plateforme) : bot / estimation à 100 % = médiane **195 %** (de 13 % à 504 %). Avec ce coefficient (`COEFFICIENT_GEOMETRIQUE_PCT`) : écart médian au bot **39 %**, **7 jours sur 30 à moins de 25 %**, pire écart 1 417 %. **C'est un mauvais prédicteur** : le repli n'est qu'un dernier recours, d'où « provisoires ».

## Proposition de calibrage (à ne pas appliquer)
1. **Les pourcentages sont trop hauts pour un joueur.** Les deux joueurs simulés ont une médiane à 16–19 % du Diamant : le Bronze (55 %) n'est atteint que par 17 à 23 % d'entre eux. Proposition : **Bronze 15 %, Argent 30 %, Or 50 %**, Diamant inchangé (atteints par 50 %, 37 % et 30 % des joueurs imparfaits, 53 %, 43 % et 27 % des gloutons).
2. **Le Diamant est volatil** (4 m à 103 m, un quartile entre 37 et 74 m) : la partie du bot est chaotique, et un joueur *humain* qui voit la tour fait sans doute mieux que nos deux joueurs simulés. Pistes : **plafonner le Diamant au dernier palier (60 m)** ; ne jamais servir un jour dont le bot finit sous ~25 m (le 17/11 : 4,1 m, le 23/11 : 14,7 m ; tirer le contenu du jour par essais sur la valeur du bot).
3. **Paliers** : tous les 10 m jusqu'à 60 m, le joueur simulé médian reste à 9–14 m : il ne voit que le premier effet. Proposition : un palier **tous les 6 à 8 m** (par exemple 8, 16, 24, 32, 40, 48 m).
4. **Plateformes** : les largeurs de 5 à 8 m n'ont pas d'effet mesurable sur le bot (4 à 11 jours par largeur) ; **à calibrer au T5** sur la sensation plutôt que sur le bot.

## Vérifié / non vérifié
- **Vérifié** : `npm run typecheck`, `npm run verifier` (typecheck, tests unitaires, construction, 3 specs Tower dans Chromium) ; Vitest `packages/tower-sim` (copie de la partie, bot : déterminisme, preuve rejouée, zone visible, plafond, reprises ; médailles aux bords ; sac de thèmes sur deux ans ; préparation ; garde-fou ; golden g2 + v1 inchangée) et `apps/tower` (palettes, retrait de la preuve, adresses) ; `npm run build -w @cdj/tower` en production : **aucun fichier de bot ni de worker émis, aucune `preuve` dans `jours/`** ; Web Worker de bout en bout dans Chromium sur un jour sans fichier (« Médailles en calcul… », « Le bot réfléchit… », puis l'objectif), refait après la correction de la zone visible : le Diamant calculé dans le navigateur (38,790 m le 05/11) est celui de Node, au millimètre ; 7 captures lues (cinq thèmes, portrait, écran de fin).
- **Non vérifié** : Firefox, WebKit et un téléphone sur le nouveau code (la simulation n'a pas changé, mais le Web Worker et la file du bot n'y ont pas tourné) ; la sensation d'un joueur humain face au Diamant ; la CI de la PR (voir le run).
- **Budget** : `tower.jsCss` = **167 950 o** pour un plafond de **168 000 o inchangé** (marge de 50 o) : le bot, son worker et les cinq palettes sont à la demande. **Marge presque nulle : le prochain lot de Tower devra alléger ou demander à Nathan.**

## À brancher par la plateforme (T4)
« Mettre en production » : quels jours préparer (`preparer:tower` avec le code alors en production, registre des versions `g` et `sim`, copie dans l'image du serveur). **`scripts/site.mjs`** : la vérification croisée que le site assemblé ne contient aucune `preuve` (comme pour Jump). Le serveur : classement prouvé, refus des copies (R9), fantôme Diamant. Médailles gardées dans le navigateur.

## Questions pour Nathan
1. **La règle de la zone visible** (6,5 m sous le sommet) te convient-elle ? Elle est la plus stricte (paysage) ; en portrait le joueur voit 29 m sous le sommet, mais le Diamant est le même pour tous.
2. **Le calibrage ci-dessus** (15 / 30 / 50 %, plafond de 60 m, paliers plus bas) : lequel appliquer au T5 ?
3. **Les jours ratés** (le 17/11 : 4,1 m) : accepter, ou faire choisir le contenu du jour par essais sur la valeur du bot (le générateur monterait en version 3) ?
4. **`?bot` sans fichier** montre la partie du réglage ordinaire, qui peut finir plus bas que le Diamant (une variante l'a battu) : la fin affiche « Diamant du jour ». À garder ?

## Liens de test (aperçu de la PR : `/tower/…`)
Les fichiers de jour ne sont pas commités : sur l'aperçu, `&bot` calcule dans le Web Worker (≈ 1 minute, la ligne dit « Le bot réfléchit… »).
- Regarder le bot : `/tower/?seed=2026-11-05&bot` ; jouer : `/tower/?seed=2026-11-05` (l'objectif apparaît une fois les médailles calculées).
- Thèmes : `/tower/?seed=2026-11-05&theme=banquise`, `…&theme=chantier`, `…&theme=canyon`, `…&theme=jungle`, `…&theme=nuit`, `…&theme=port`.
