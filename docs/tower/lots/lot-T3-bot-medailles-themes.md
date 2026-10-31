# Lot T3 — Bot de l'auteur, médailles et thèmes

Branche `claude/tower-bot-medailles-themes-d8tz33`, PR brouillon. Consignes : `docs/tower/consignes.md` (mises à jour : « Le bot de l'auteur, les médailles et les thèmes »). Tower reste `off`. `lab/` intact ; aucune version ni aucun golden de Track ou de Jump touché ; `TOWER_SIM_VERSION` inchangée (3). **Aucun fichier de jour commité** (deux fichiers de test dans `packages/tower-sim/test/fixtures/jours/`). Pour les joueurs : rien.

## Livré
- **Le bot** (`packages/tower-sim/src/bot/`, pur, scanné par `purete.test.ts`) : glouton pièce par pièce, sur **une copie de la partie** (`Partie.cloner`, instantané du monde de Rapier : identique à l'original, testé). Positions à la demi-case (5 de chaque côté), rotations sans doublon (1 / 2 / 4), **les vraies commandes**, la tour se calme, note entière (hauteur − 100 000 par vie perdue − 1 500 par pièce qui bouge + largeur du sommet × 50 %). Arrêt anticipé par borne haute ; anticipation de la pièce suivante pour les 2 meilleurs coups. **La preuve est une rediffusion ordinaire** (`rejouer` redonne sa hauteur : testé). Les paliers s'appliquent à lui comme au joueur.
- **Il sait s'arrêter** : une tour très haute s'effondre souvent sur les dernières pièces (premiers essais : 75 m puis 17 m à la fin). Il retient les pièces après lesquelles la tour calme est la plus haute, rejoue l'arrêt (les pièces suivantes jetées à la mer jusqu'à la dernière vie) et garde la meilleure preuve. Et, si le réglage ordinaire donne moins de 30 m, il essaie des **variantes** (poids de la largeur 20 / 100 / 0 %) sous un **plafond de 600 000 ticks de calcul** (un nombre de ticks, aucune horloge).
- **Les médailles** (`medailles.ts`) : millimètres entiers par `idiv`, Or 90 / Argent 75 / Bronze 55 % du Diamant (clé `auteur`), médaille la plus haute dont la hauteur atteint le seuil (≥) ; tests aux bords.
- **La préparation des jours** : `npm run preparer:tower -w @cdj/tower-sim -- --du … --au …` (un `worker_threads` par cœur, un jour par fil), fichier du jour avec `medailles` et `preuve` ; n'écrase qu'avec `--forcer`, **refuse toujours une autre version `g`** (`tools/plan.ts`, testé) ; garde-fou étendu : la preuve rejouée donne exactement le Diamant écrit.
- **Les thèmes** : six (`port`, `chantier`, `canyon`, `banquise`, `jungle`, `nuit`), sac commun de `@cdj/core` **tel quel** (n = 6 : pas d'arrêt nécessaire) ; `TOWER_GENERATOR_VERSION` = **2**, la version 1 (tout `port`) reste appelable et inchangée (golden : les empreintes de v1 sont gardées, v2 ne diffère que par le thème). Palettes en aplats ; les cinq autres à la demande. Test de contraste pièce / fond de chaque thème.
- **Le jeu** : objectif de médaille dans le HUD, « Médailles en calcul… », médailles « provisoires » (production sans fichier : estimation géométrique), bloc « Médailles du jour » et médaille obtenue à l'écran de fin, meilleure médaille de la session en mémoire, `?seed=…&bot` et `?theme=…` (hors production), Web Worker du bot (hors production, retiré de la construction de production), greffon qui retire la `preuve` des fichiers publiés (testé).

## Les mesures (`npm run mesures-t3:tower`, Xeon 2,1 GHz, 4 cœurs, 30 jours du 05/11 au 04/12/2026)
**Budget de calcul — tenu.** Une journée sur **un cœur** (9 jours, un à la fois, dont 3 repris avec une variante) : **médiane 59 s, pire cas 69 s** (budget 90 s). Avec 4 jours en parallèle (machine chargée) : médiane 58 s, pire 95 s. `preparer:tower` sur **14 jours, 4 cœurs : 3 min 7 s**.

| Secondes par pièce selon la hauteur de la tour | 0–10 m | 10–20 | 20–30 | 30–40 | 40–50 | 50–60 | 60–70 | 70–80 |
|---|---|---|---|---|---|---|---|---|
| (réglage ordinaire) | 0,6 | 1,1 | 1,3 | 1,6 | 1,7 | 2,3 | 2,3 | 2,7 |

**La hauteur du bot (le Diamant)**, 30 jours : médiane **68,1 m**, moyenne 63,8 m, minimum **6,0 m** (17/11), maximum 102,9 m ; quartiles 40,5 m et 90,0 m. Les 40 pièces sont posées 7 jours sur 30 ; 15 jours finissent « arrêtés par le bot » ; médiane de 3 pièces tombées ; **9 jours** ont eu besoin d'une variante ; paliers franchis par sa preuve : médiane 6 sur 6 (les six sur 18 jours). Par largeur : 5 m 70,1 m (7 jours) · 6 m 55,8 m (11) · 7 m 65,6 m (4) · 8 m 75,7 m (8) — **la largeur ne se lit pas dans le Diamant**.

**Deux joueurs simulés, en % du Diamant du jour**
| joueur | médiane | quartiles | 90ᵉ centile | ≥ 55 % | ≥ 75 % | ≥ 90 % | ≥ 100 % |
|---|---|---|---|---|---|---|---|
| glouton du lot T2 | 18 % (13,9 m) | 6 – 47 % | 70 % | 20 % | 7 % | 3 % | 3 % |
| bot imparfait (décalage d'une demi-case, 1 pièce sur 4) | 29 % (20,0 m) | 17 – 55 % | 95 % | 27 % | 10 % | 10 % | 7 % |

**Estimation géométrique** (aire des 40 pièces ÷ largeur de la plateforme) : bot / estimation à 100 % = médiane **224 %** (de 19 % à 484 %). Avec ce coefficient (`COEFFICIENT_GEOMETRIQUE_PCT`) : écart médian au bot **39 %**, **11 jours sur 30 à moins de 25 %**, pire écart 1 095 %. **C'est un mauvais prédicteur** : le repli n'est qu'un dernier recours, d'où « provisoires ».

## Proposition de calibrage (à ne pas appliquer)
1. **Les pourcentages sont trop hauts pour un joueur.** Un joueur presque aussi bon que le bot (le « bot imparfait ») n'atteint le Bronze (55 %) que 27 fois sur 100. Proposition : **Bronze 20 %, Argent 35 %, Or 55 %** (atteints par 67 %, 43 % et 27 % des joueurs imparfaits, 47 %, 37 % et 20 % des gloutons), Diamant inchangé.
2. **Le Diamant est volatil** (6 m à 103 m, un quartile entre 40 et 90 m) : la partie du bot est chaotique. Pistes : **plafonner le Diamant au dernier palier (60 m)** (au-delà, l'écart ne dit plus rien d'un joueur) ; ne jamais servir un jour sous ~25 m (le 17/11, 6 m, est ratable : tirer le contenu du jour par essais sur la valeur du bot).
3. **Paliers** : tous les 10 m jusqu'à 60 m, le joueur imparfait médian reste à 20 m (le 90ᵉ centile à 42 m) : il ne voit que les deux premiers effets. Proposition : un palier **tous les 6 à 8 m** (par exemple 8, 16, 24, 32, 40, 48 m).
4. **Plateformes** : les largeurs de 5 à 8 m n'ont pas d'effet mesurable sur le bot (échantillons de 4 à 11 jours) ; **à calibrer au T5** sur la sensation plutôt que sur le bot.

## Vérifié / non vérifié
- **Vérifié** : `npm run typecheck`, `npm run verifier` (typecheck, 30 fichiers de tests unitaires, construction, 3 specs Tower dans Chromium) ; Vitest `packages/tower-sim` (copie de la partie, bot : déterminisme, preuve rejouée, arrêt, plafond, reprises ; médailles aux bords ; sac de thèmes sur deux ans ; préparation ; garde-fou ; golden g2 + v1 inchangée) et `apps/tower` (palettes, retrait de la preuve, adresses) ; `npm run build -w @cdj/tower` en production : **aucun fichier de bot ni de worker émis, aucune `preuve` dans `jours/`** ; Web Worker de bout en bout dans Chromium sur un jour sans fichier (« Médailles en calcul… », « Le bot réfléchit… », puis l'objectif, 57 s) ; 7 captures lues (cinq thèmes, portrait, écran de fin).
- **Non vérifié** : Firefox, WebKit et un téléphone sur le nouveau code (la simulation n'a pas changé, mais le Web Worker et la file du bot n'y ont pas tourné) ; la sensation d'un joueur humain face au Diamant ; la CI de la PR (voir le run).
- **Budget** : `tower.jsCss` = **167 950 o** pour un plafond de **168 000 o inchangé** (marge de 50 o) : le bot, son worker et les cinq palettes sont à la demande. **Marge presque nulle : le prochain lot de Tower devra alléger ou demander à Nathan.**

## À brancher par la plateforme (T4)
« Mettre en production » : quels jours préparer (`preparer:tower` avec le code alors en production, registre des versions `g` et `sim`, copie dans l'image du serveur). **`scripts/site.mjs`** : la vérification croisée que le site assemblé ne contient aucune `preuve` (comme pour Jump). Le serveur : classement prouvé, refus des copies (R9), fantôme Diamant. Médailles gardées dans le navigateur.

## Questions pour Nathan
1. **Un bot qui s'arrête** (il jette ses dernières pièces à la mer pour garder sa tour) te convient-il comme Diamant ? Un joueur peut en faire autant, mais cela change le jeu.
2. **Le calibrage ci-dessus** (20 / 35 / 55 %, plafond de 60 m, paliers plus bas) : lequel appliquer au T5 ?
3. **Les jours ratés** (le 17/11 : 6 m) : accepter, ou faire choisir le contenu du jour par essais sur la valeur du bot (le générateur monterait en version 3) ?
4. **`?bot` sans fichier** montre la partie du réglage ordinaire, qui peut finir plus bas que le Diamant (arrêt ou variante) : la fin affiche « Diamant du jour ». À garder ?

## Liens de test (aperçu de la PR : `/tower/…`)
Les fichiers de jour ne sont pas commités : sur l'aperçu, `&bot` calcule dans le Web Worker (≈ 1 minute, la ligne dit « Le bot réfléchit… »).
- Regarder le bot : `/tower/?seed=2026-11-05&bot` ; jouer : `/tower/?seed=2026-11-05` (l'objectif apparaît une fois les médailles calculées).
- Thèmes : `/tower/?seed=2026-11-05&theme=banquise`, `…&theme=chantier`, `…&theme=canyon`, `…&theme=jungle`, `…&theme=nuit`, `…&theme=port`.
