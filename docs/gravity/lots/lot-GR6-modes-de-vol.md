# Lot GR6 — Gravity : les modes de vol (avion, onde, ressort) et les portails de vitesse

Branche `claude/inspiring-carson-3of00w` (imposée par la session, sans « gravity » : la PR porte l'étiquette **`jeu:gravity`**), PR brouillon. Le jeu reste `off`. **Pour les joueurs : rien.** Zones de la passation § 3 seulement ; **aucun fichier partagé touché** hors `docs/plateforme/traductions.md` (régénéré par `npm run traductions`).

## Le seed a été modifié (autorisation de Nathan, dans le prompt du lot)
Premier commit de la branche, à part : « seed : les modes de vol, sur autorisation de Nathan » — la section « Les modes de vol (ajout du 17 novembre 2026) » juste avant « Technique », et une ligne dans « Encore ouvert ». **Rien d'autre** dans le seed. Aucun test ni job de CI ne protège ce seed (cherché : seuls `docs/seed.md` et les seeds de plateforme sont cités par les tests de zones). La règle reste : seul Nathan modifie le seed, ou un lot qu'il y autorise par écrit (écrit dans les deux `CLAUDE.md`).

## Versions : pas de registre d'anciennes versions
Le jeu est `off` et **aucun jour n'est figé** (`apps/gravity/public/jours/` vide, rien servi) : **générateur 4, simulation 3, robot 3**, et les versions 2 / 3 et 2 sont **retirées des registres**, avec l'archive de leur golden (règle « ce qu'on peut retirer », `packages/gravity-sim/CLAUDE.md`). Dès qu'un jour est figé, on ne retire plus. `versions.test.ts`, `gravityVersions.test.ts` et `jourFige.test.ts` posent maintenant des versions factices 5 / 4.

## Livré
1. **Sim** (entiers) : l'entrée est l'état du bouton (`appuyer` / `relacher`, un changement par pas, une file les sépare). Avion (maintenu on monte, inertie, `|vy| ≤ 8`), onde (±45°, sol et plafond glissés, seuls les piques tuent), ressort (gravité réduite, un bond par début d'appui même en l'air, ≥ 12 pas), portails de mode (on garde `g` en entrant, retour vers le sol), **portails de vitesse** (×0,8 ; ×1,15 ; ×1,3 ; ×1,5 jusqu'au suivant, **plafond absolu 17 cases/s**, la caméra suit la vitesse réelle). Bouclier, aimant, morts, multiplicateur : dans tous les modes ; **un sauvetage du vide remet en mode gravité**. Constantes nommées (`constantes.ts`), à régler au GR7.
2. **Générateur** (`plan.ts`, `sections.ts`) : introduction **selon le rang du thème** (1er avion, 2e onde, 3e ressort), **première section de chaque mode facile** (2 morceaux, couloir large), puis mélange, plus de sections et plus dense à la 2e boucle. Une section = 2 à 4 morceaux + un morceau de retour ; **tout est posé dans le temps**, pas dans les colonnes (même difficulté à toute vitesse). Portails de vitesse dès le 2e thème : rapides là où l'on respire, lents avant un passage technique ou une onde.
3. **Rediffusion et serveur** : la liste des pas où l'appui commence ou finit, en deltas, premier changement = un appui, deux au même pas refusés ; `MAX_CHANGEMENTS` 8 000, `MAX_CARACTERES` 32 100 ; `apps/api/src/gravity.ts` et `gravity-essais.ts` adaptés. Golden régénéré.
4. **Robot** : planificateur de gravité gardé (il s'arrête au portail d'entrée), **pilote** pour les trois modes qui juge chaque changement à ±4 pas sur des copies sans bouclier. Contraintes nommées : 12 pas entre deux appuis en gravité et ressort (`ROBOT_ECART_MIN`), **6 pas par appui ou relâché en avion et en onde** (`ROBOT_MAINTIEN_MIN`), fenêtre ±4, sans bouclier.
5. **Jeu** : héros par mode (bandeau toujours là), arches de portail (une couleur et une icône par mode, chevrons de vitesse), lignes de vitesse et recul de caméra, annonce du mode (la consigne la 1re fois seulement) et icône du mode près du multiplicateur, sons (portail, virage de l'onde, bond, souffle de l'avion — règle S2), catalogues fr + en, « Comment jouer » court. Détail : `apps/gravity/CLAUDE.md`.

## Mesures
- **Franchissabilité : 30 jours sur 30** (du 2026-11-17, 2 280 m, strict) sans entorse, les trois modes traversés chaque jour ; **6 autres jours** en PR (`franchissabilite.test.ts`), les 30 jours en Régression (`franchissabilite-30-jours.test.ts`). Toutes les fenêtres mesurées : 9 pas (± 4).
- **`preparer:gravity` : 45 jours (17/11 → 31/12/2026), 0 échec, 83 s** (≈ 1,8 s par jour).
- **Budget du robot** : 1,14 s par jour en moyenne, **1,76 s au plus** sur les 30 jours (2 280 m ; la boucle des cinq thèmes seule fait moins) pour **≤ 3 s** demandés. **Où passe le temps** : non mesuré à part ; le budget n'est pas dépassé (le pilote juge chaque changement sur 9 copies pilotées 1,5 s, la recherche de gravité garde son graphe d'états).
- Poids : premier chargement `gravity.jsCss` **45 387 o** (45 403 avant : pas de croissance), `gravity.demande` 199 768 o pour 203 Ko ; aucun morceau partagé nouveau.

## Les motifs des sections (ce que le générateur pose)
- **Avion** : couloir de 6 rangées (facile), 5 ou 4 qui **ondule** (période 3 s à 2,2 s, amplitude 1 à 2 rangées), des **piliers** en haut puis en bas (1,25 s d'écart, épaisseur 1 ou 2), pièces en vague sur l'axe.
- **Onde** : couloir de 5 (facile), 4 ou 3 rangées en **escalier** (une rangée toutes les 0,5 à 0,8 s), **bordé de piques** ; 3 rangées seulement à basse vitesse et très dur.
- **Ressort** : **trous** et **colonnes** de 1 ou 2 cases toutes les 1,1 à 1,4 s, pièces en arc au-dessus de chaque obstacle.
- **Retour de Nathan (après la première recette)** : (1) **on entre dans un mode toujours à l'endroit** (`g = 1` à l'entrée : un avion ne vole plus jamais la tête en bas, même si on était au plafond au portail) ; (2) **deux styles par section** — un couloir ou **un champ d'obstacles en l'air** : avion = blocs suspendus, colonnes du plafond ou du sol, mines de piques ; onde = mines de piques (1 × 2, amas, piques qui pendent ou montent) ; ressort = piques au sol en plus des trous et colonnes. L'axe contourne chaque obstacle du côté qui laisse ≥ 3 rangées. 30 jours sur 30 repassés (1,39 s par jour en moyenne, 2,13 s au plus), golden régénéré (même version 4 : jamais livrée), captures `obstacles-avion.png` et `obstacles-onde.png`.
- Chaque section : portail → couloir libre d'1 s → motif → deux colonnes ouvertes → morceau de retour (portail de retour, sol, pièces). Le morceau d'avant est calme et finit sur le sol.

## Liens de recette (jeu `off` : avec la clé d'aperçu)
Base : l'aperçu de la PR (lien commenté sur la PR) ou, après la fusion, `https://recette.playdujour.com/gravity/?apercu=<clé>&…` ; jamais classé.
- **Avion** : `/gravity/?mode=avion` · le robot : `/gravity/?mode=avion&robot`
- **Onde** : `/gravity/?mode=onde` · `/gravity/?mode=onde&robot`
- **Ressort** : `/gravity/?mode=ressort` · `/gravity/?mode=ressort&robot`
- **Portails de vitesse** (2026-11-17) : `/gravity/?jour=2026-11-17&morceau=36` (›› au morceau 37, puis lent au 38) · `?jour=2026-11-17&morceau=83` (››› au 84, lent au 86) ; `&vitesse=` pour la vitesse de départ.
- **Partie normale** : `/gravity/`
- **Une mort, pour voir l'écran de fin** : `/gravity/?jour=2026-11-17&morceau=8` — JOUER, ne touche à rien : tu meurs en 3 s environ (mesuré : 2,7 s), le bilan 1,5 s, puis **l'écran de fin du kit** (« Partie d'essai : non classée »).
- Captures : `docs/gravity/captures/GR6/` (`mode-avion.png`, `mode-onde.png`, `mode-ressort.png`, `annonce-portrait.png`).

## Les pièces de PG2
**Aucune n'est fusionnée sur `main`** (vérifié en fin de lot : `main` n'a pas bougé). Donc **pour le GR7** : le bilan dans l'écran de fin du kit (cause, distance, pièces, gemmes, thème atteint, multiplicateur maximal, **mode le plus loin atteint** — la donnée est déjà dans `Resultat.modeLoin`) **et le retrait du petit écran de fin propre à Gravity** ; `generateurDuNiveau` (et `gravityVersions.test.ts` retourné) ; la vérification des pieds en gravité inversée.

## Vérifié / non vérifié
**Vérifié** : `npx tsc -b` propre ; unitaires `gravity-sim` (254+), `gravity` (86), `apps/api/test/gravity*` (SQLite) ; golden ; e2e Gravity (essais, écrans du kit, poids, déterminisme, partie, classement) en Chromium ; `npm run verifier` entièrement vert (865 s : typecheck, unitaires SQLite et libSQL, constructions, e2e Track, Jump et Gravity, budgets) ; la CI de la PR : voir la PR.
**Non vérifié** : le son à l'oreille (testé avec un faux contexte audio) ; le rendu sur un vrai téléphone (l'avion et le ressort sont petits à l'écran : à juger par Nathan) ; Firefox / WebKit ; `budgets-controle.mjs` (exige le dist de `apps/web`, remplacé par `mesureJeuNeuf`).
**Écarts au prompt** : branche sans « gravity » (étiquette à la place) ; en gravité et en ressort le robot relâche **un pas** après l'appui (le relâché n'y fait rien : la rediffusion porte appui, relâché, appui) ; le robot de l'onde et de l'avion est un pilote (loi de poursuite de l'axe, jugée par simulation) et non une recherche exhaustive : une preuve par simulation, pas par énumération.

## Ce qui attend le GR7
Le réglage des modes sur le prototype (durée des sections, fréquence, multiplicateurs des portails de vitesse, constantes de l'avion / de l'onde / du ressort : tout est nommé dans `constantes.ts`), les seuils et le pourcentage des médailles, les pièces de PG2 (ci-dessus), une piste de musique, la limite de `memeContenu` de la plateforme (README du lot GR5) avant le premier jour figé.

## CI de la PR (premier run)
- **Gravity, ma zone** : `ecrans-kit.spec.ts` (« pause et fin de partie à 2560 × 1440 ») et `partie.spec.ts` (« une partie entière ») attendaient `#jeu-fin` 5 s : l'écran de fin termine d'un trait le calcul des seuils d'un jour non figé (le robot, plus long avec les modes de vol), et la machine de CI le rend plus lent. **Corrigé** : l'attente passe à 20 s (comme `classement.spec.ts`) — rien d'affaibli, l'assertion est la même ; verts en local (21 / 21, un worker).
- **Hors zone** : `packages/pinball-sim/test/robot.test.ts` (« le robot vise : la mission du jour… », `Test timed out in 30000ms`) a fait échouer `jeu fictif (1/3)` ; je n'y touche pas : relancé une fois par le commit suivant ; s'il échoue encore, c'est à Nathan / à la plateforme.

