# Lot 3 — La rediffusion, le fantôme, le carnage et les taches (DailyJump)

## À tester
Aperçu de la branche `ccr-4577740d-3047yh` (la branche de cette session) :
- **`https://nathan-te.github.io/DailyTrack/b/ccr-4577740d-3047yh/jump/?scenario=essai&carnage=demo`** : le carnage de démonstration démarre tout seul. Le héros (la solution de l'auteur, 21,6 s) avance, **50 vies fictives** partent avec lui ou de leurs points de passage quand il y arrive, meurent partout (éclats, taches), 3 arrivent. Compteur « 50 vies · 3 arrivées ». N'importe quelle commande (touche, manette, doigt) le passe ; seul, il s'arrête un instant après l'arrivée du héros.
- **`https://nathan-te.github.io/DailyTrack/b/ccr-4577740d-3047yh/jump/?scenario=essai`** : **mourir une vingtaine de fois** (les taches restent, couleur du personnage, sur le sol, les murs, les plafonds), **finir** : ton propre carnage démarre (ton essai en héros, toutes tes vies du jour). Une commande pour passer, puis le bandeau. **Recharger** : taches et meilleur temps sont là, et le **fantôme** (carré translucide) refait ton meilleur essai, calé sur ton chrono ; ses morts (un anneau) et ses reprises se voient. **G** (ou 👻 au téléphone, « 👻 Fantôme » en bas à gauche sur ordinateur) le cache, c'est mémorisé ; `&ghost=off` le cache sans toucher au réglage.
- **`…/jump/?scenario=essai&watch=best`** : ton meilleur essai rejoué seul, sans pouvoir jouer (R le relance). Au téléphone, en paysage : un doigt n'importe où passe le carnage.
- `&fx=off` : ni éclats ni tremblement, **mais les taches restent**. `&debug&tune` : rien n'est enregistré dès qu'un réglage diffère (« réglages modifiés : rien n'est enregistré »).

## Format de la rediffusion (`packages/jump-sim/src/replay.ts`)
Octets puis base64url (`@cdj/core`) : `FORMAT` (1) · `JUMP_SIM_VERSION` (varint) · identifiant du niveau (`essai` ; plus tard la date) · drapeaux du départ (saut tenu ; départ sur un point de passage) · [point, chrono, début de chaque section — pour une vie] · séries `varint(count × 8 + bits)`. Borne `MAX_ATTEMPT_TICKS` = 72 000 pas (10 min). Un **essai** commence au premier pas commandé (le chrono vaut le nombre de pas rejoués) ; ses reprises sur les points de passage ne sont pas enregistrées, la sim les refait. Une **vie** est une rediffusion du même format partie d'un point de passage : son en-tête porte l'état du niveau à cet instant, elle se rejoue seule **exactement** comme elle a été vécue.
**Taille** : la solution de l'essai (21,6 s, 112 séries) = **163 octets** (218 caractères) ; une vie stockée ≈ 83 caractères en moyenne.
`replayAttempt(niveau, rediffusion)` rend : arrivée, pas, chrono, morts (pas, chrono, cause, position, vie), vies (départ, pas de début, commandes, fin : `mort` / `arrivée` / `abandon`). Refus : `JumpReplayError` `version` (à ignorer), `length`, `format` (y compris des pas après la fin de l'essai), `level`.

## Mesures
| Mesure | Valeur |
|---|---|
| Rejeu de l'essai (`replayAttempt`, 2 595 pas, découpage en vies compris), Node 22 | **4,4 ms** (1,4 µs par pas) |
| Simulation du carnage, toutes les vies en course (copies de la solution), Node | 50 vies 0,11 ms · 150 vies 0,31 ms · 300 vies 0,41 ms **par pas** |
| Stockage d'une journée chargée (300 vies, 300 morts, meilleur essai) | **41 ko** ; relu en 4,7 ms au chargement (meilleur essai rejoué compris) |
| Placement de 252 taches au chargement (`stainFor`) | 7,8 ms |

**Carnage dans le navigateur** (`MESURE=1 npx playwright test mesure-carnage --project=chromium`) : téléphone 844 × 390 @2, rendu logiciel SwiftShader, fil principal mesuré dans le jeu (`__jump.frameTimes`). SwiftShader ne fait que ~12 images/s : chaque image y porte ~10 pas, donc on compte à part la simulation **par pas** et le dessin **par image**, et l'on en déduit une image à 60 i/s (2 pas + 1 dessin). « Foule » = N copies de la solution, toutes en course en même temps jusqu'au bout (pire cas) ; « démo » = N vies fictives (morts, éclats, taches).

| Processeur | Vies | N | En course (moy.) | Simulation / pas | Dessin / image | Image à 60 i/s (2 pas + dessin) | Image mesurée (moy. · 95e c.) | Images/s (SwiftShader) |
|---|---|---|---|---|---|---|---|---|
| ×1 | foule | 0 | 0 | 0,01 ms | 3,93 ms | **3,96 ms** | 4,04 ms · 2,10 ms | 15 |
| ×1 | foule | 50 | 50 | 0,06 ms | 5,73 ms | **5,84 ms** | 6,23 ms · 7,00 ms | 14 |
| ×1 | foule | 150 | 150 | 0,08 ms | 4,90 ms | **5,07 ms** | 5,68 ms · 4,60 ms | 13 |
| ×1 | foule | 300 | 300 | 0,14 ms | 3,51 ms | **3,79 ms** | 4,79 ms · 5,80 ms | 13 |
| ×1 | démo | 50 | 14 | 0,02 ms | 3,85 ms | **3,89 ms** | 4,02 ms · 2,60 ms | 15 |
| ×1 | démo | 150 | 49 | 0,04 ms | 3,23 ms | **3,32 ms** | 3,59 ms · 4,30 ms | 14 |
| ×1 | démo | 300 | 104 | 0,07 ms | 4,64 ms | **4,77 ms** | 5,25 ms · 2,60 ms | 13 |
| ×4 | foule | 0 | 0 | 0,04 ms | 7,70 ms | **7,78 ms** | 8,08 ms · 9,70 ms | 13 |
| ×4 | foule | 50 | 50 | 0,14 ms | 7,44 ms | **7,72 ms** | 8,70 ms · 11,20 ms | 13 |
| ×4 | foule | 150 | 150 | 0,27 ms | 8,99 ms | **9,53 ms** | 11,60 ms · 14,30 ms | 12 |
| ×4 | foule | 300 | 300 | 0,54 ms | 9,63 ms | **10,71 ms** | 15,44 ms · 23,10 ms | 11 |
| ×4 | démo | 50 | 14 | 0,08 ms | 6,43 ms | **6,58 ms** | 7,15 ms · 9,70 ms | 13 |
| ×4 | démo | 150 | 48 | 0,15 ms | 8,95 ms | **9,25 ms** | 10,48 ms · 12,90 ms | 12 |
| ×4 | démo | 300 | 104 | 0,28 ms | 9,02 ms | **9,58 ms** | 11,82 ms · 14,90 ms | 12 |

**Lecture** : « N = 0 » est le héros seul (le jeu sans carnage). Sur un processeur ×4 (téléphone moyen), 150 vies en course coûtent ≈ 9,5 ms par image à 60 i/s contre 7,8 ms sans foule, 300 vies ≈ 10,7 ms : sous les 16,7 ms d'une image, **aucune réduction d'effets n'a été nécessaire**. Presque tout est dans le dessin (Three.js, pour l'essentiel le même que sans carnage) ; la simulation de 150 vies pèse 0,3 ms par pas. Les chiffres à ×1 sont bruités (±2 ms d'un passage à l'autre, rendu logiciel sur 2 cœurs) : ne lire que les ordres de grandeur.

## Vérifié / non vérifié / décisions
**Vérifié** : typecheck ; Vitest (`jump-sim` : 136 tests, dont aller-retour du format, refus de version / de borne / mal formée, **rejeu = vécu** essai par essai sur trois sessions à graine fixe avec morts, reprises, arrivées et abandons, chaque vie rejouée seule identique, golden des octets et des empreintes ; `apps/jump` : 103 tests, dont purge au changement de jour / niveau / version, plafonds 300, `tuned`, stockage absent ou qui lève, calendrier du carnage, taches toujours sur une face de bloc plein) ; `npm test` complet (1 194 tests SQLite + 158 libSQL) ; **golden du personnage et de l'essai inchangés, `JUMP_SIM_VERSION` toujours 2** ; golden de DailyTrack inchangés (aucun fichier de DailyTrack ni zone partagée touchés, aucune dépendance) ; e2e **Chromium** en local (DailyJump : 49 tests verts, plus l'outil de mesure qui ne tourne qu'avec `MESURE=1`, dont déterminisme Node ↔ navigateur sur 19 rediffusions, `?carnage=demo`, mourir-finir-recharger (fantôme et taches à leur place), `?watch=best`, `?ghost=off`, stockage qui lève, `tuned`, passage du carnage au doigt en paysage) ; captures relues à l'œil (taches découpées par les blocs, carnage, téléphone).
**Non vérifié** : Firefox et WebKit (absents ici : la CI tranche, les specs y tournent dans la part 1) ; un vrai téléphone (la cible « 150 vies sans saccade » est mesurée en rendu logiciel avec ralentissement du processeur, pas sur l'appareil) ; le ressenti du carnage.

**Décisions pour Nathan**
1. **Dangers du carnage** : ceux du monde du héros. Une vie partie d'un point de passage à un autre instant que lors de sa vraie course voit (à l'écran seulement) des scies un peu décalées ; elle meurt quand même exactement là où elle est morte (sa propre simulation). C'est l'écart accepté par le prompt.
2. **Départ des vagues** : une vie part quand le héros **touche** son point de passage **ou en dépasse la colonne** (la solution de l'auteur saute par-dessus deux des cinq points : sans cela, leurs vies ne partiraient jamais). Une vie dont le point n'est jamais passé ne part pas (elle ne compte pas dans « N vies »).
3. **Fin du carnage** : il reste au moins 0,75 s après l'arrivée du héros (on lit « 1 arrivée »), puis s'arrête quand toutes les vies ont fini, au plus 1,5 s après le héros. **Passer** = un *appui* (une direction tenue depuis l'arrivée ne le passe pas). R passe le carnage et recommence.
4. **Le carnage démarre à chaque arrivée**, même sans autre vie (ton essai rejoué seul) ; un essai aux réglages modifiés n'en a pas (il ne se rejoue pas avec les réglages par défaut) : bandeau tout de suite.
5. **Taches** : sur la face de bloc plein la plus proche (et les faces à moins de 0,6 tuile de plus : une mort dans un coin peint les deux), cherchées jusqu'à 48 tuiles — une chute au fond du grand gouffre des friables (39 tuiles de large) peint le bas du mur le plus proche. Découpées au pochoir par les blocs pleins (pas sur les friables ni les ressorts, qui bougent). Au-delà de 300, la plus ancienne se fond dans la couleur des blocs (1,6 s) puis part. Pendant le carnage, les taches du jour s'effacent et réapparaissent avec les morts rejouées.
6. **Mémoire** : par niveau (`jump:jour|meilleur|vies|morts:<niveau>`), purgée au changement de jour (date de Paris, relue à chaque écriture : une page restée ouverte après minuit repart de zéro), de niveau (empreinte du contenu) ou de version ; les mémoires des autres niveaux d'un autre jour sont rangées au chargement. Un essai en cours quand la page se ferme est gardé comme un abandon (ses vies). Un essai de plus de 10 min n'est pas enregistré.
7. **Démonstration** : 14 essais fictifs (graine 2026) = 50 vies ; « perturbations de la solution » : par moments d'autres commandes pendant 4 à 40 pas ; après une reprise, la solution repart du pas qui va le plus loin depuis ce point (cherché une fois parmi les pas voisins). Seulement sur `?scenario=essai`.
8. **Le meilleur temps du HUD est celui du jour** (rejeu), plus celui de la session : « Meilleur du jour : … » sur le bandeau.
9. **Branche** : le prompt nommait `lot-3-rediffusion-dailyjump` ; cette session cloud impose sa branche `ccr-4577740d-3047yh`, d'où l'adresse de l'aperçu ci-dessus.
10. **Outil de mesure** `e2e/mesure-carnage.spec.ts` : ne tourne qu'avec `MESURE=1` (comme les mesures de DailyTrack) ; en CI il apparaît « sauté ». Les bornes larges de `apps/jump/test/mesures.test.ts` (rejeu, simulation du carnage, poids du stockage), elles, sont vérifiées à chaque `npm test`.
