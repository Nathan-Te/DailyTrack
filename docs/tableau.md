# Tableau de bord — où en est chaque jeu

> **Produit par `npm run tableau`** — rien à saisir ici : tout est lu dans `config/jeux/` (fiches), `docs/<jeu>/lots/` (README des lots) et `docs/<jeu>/passation.md` (trois sections finales : « Où on en est », « Prochain lot », « Décisions en attente »). Tout lot met sa passation à jour, puis lance `npm run tableau` (`-- --verifier` : échoue si ce fichier n'est pas à jour). Règle : `CLAUDE.md`, « Règles communes à tous les lots ».
>
> **L'état de la production et de la recette (`off`, `preview`, `on`) n'est pas dans le dépôt** : il se lit dans le panneau d'administration, `/admin/` › Jeux. La colonne « Fiche » ne dit que l'état de départ de la fiche (`etatDepart`) ; ⚠ identité : règle K5 (ni `preview` ni `on`).
>
> **Dates des lots** : le jour où `npm run tableau` a vu le README pour la première fois (`docs/tableau-dates.json`). Les lots d'avant le lot O1 sont datés d'après l'historique de git.

| Zone | Fiche | Dernier lot | Passation |
|---|---|---|---|
| **Plateforme** | — | O1 — Un tableau de bord et des passations à… (20/11) | 20/11 |
| **Track** | jour · `on` | R17 (Track, CI) — le test du Salon serveur… (18/11) | 20/11 |
| **Jump** | jour · `on` | 33 — Incident du 06/11/2026 : le niveau du… (06/11) | 20/11 |
| **Tower** | arcade · `off` | T9 — Les visuels : décors, bonus et malus,… (02/11) | 20/11 |
| **Cibles** | jour · `off` · témoin | — | aucune |
| **Blocks** | arcade · `off` | B8c — Blocks : un tirage adapté à la… (08/11) | 20/11 |
| **Rush** | arcade · `off` | BR-A2 — Rush : le niveau, la lumière et… (09/11) | 20/11 |
| **Vertige** | arcade · `off` | V3 — « Vertige » : le niveau du jour, le… (13/11) | 20/11 |
| **Gravity** | arcade · `off` | GR7 — Gravity : plus vite, plus varié, de… (18/11) | 20/11 |
| **Pinball** | arcade · `off` | PBR1 — Pinball : un robot des médailles 4,5… (18/11) | 20/11 |

## Plateforme
- **Dernier lot** : O1 — Un tableau de bord et des passations à jour — 20/11 (`lot-O1-tableau-de-bord.md`).
- **Passation** : mise à jour le 20/11 (`docs/plateforme/passation.md`).
- **Où on en est** :
  - Plateforme (portail, serveur `apps/api`, socle, kit, recette, production) ; dernier README de lot : O1 (20/11), le tableau de bord `docs/tableau.md` et la forme commune des passations ; avant : U6 (18/11), un seul format de classement, un podium partout.
  - L'état d'ensemble est dans `docs/plateforme/synthese.md` et `docs/orchestration.md` ; les jeux ont chacun leur passation (`docs/<jeu>/passation.md`) et `docs/tableau.md` les rassemble.
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation de la plateforme.
- **Prochain lot** : à compléter par la conversation de la plateforme (les README de O1 et de U6 n'annoncent pas de suite).
- **Décisions en attente (Nathan)** : 
  - Nathan : relever le plafond `portail.classement` de 57 à 60 Ko (proposé par U6, marge de 711 o ; `docs/plateforme/budgets.md` n'est pas modifié).
  - Plateforme (U6) : porter les seuils des médailles sur un jour passé est un petit lot serveur, si Nathan veut les seuils partout.

## Track — jour
- **Fiche** : état de départ `on`, premier jour 2026-10-13 ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : R17 (Track, CI) — le test du Salon serveur ne dépend plus de l'heure — 18/11 (`lot-R17-salon-serveur-test-stable.md`).
- **Passation** : mise à jour le 20/11 (`docs/track/passation.md`).
- **Où on en est** :
  - Track (jour ; fiche `on`, premier jour 2026-10-13) ; dernier README de lot : R17 (18/11), le test du Salon serveur ne dépend plus de l'heure (`docs/lots/lot-R17-salon-serveur-test-stable.md`).
  - L'état des lots est dans `docs/orchestration.md` § 2 ; ses lots sont dans `docs/lots/`.
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation du jeu.
- **Prochain lot** : à compléter par la conversation du jeu (suite proposée dans `docs/orchestration.md` § 9, à confirmer avec Nathan).
- **Décisions en attente (Nathan)** : 
  - à compléter par la conversation du jeu.

## Jump — jour
- **Fiche** : état de départ `on`, premier jour 2026-10-16 ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : 33 — Incident du 06/11/2026 : le niveau du jour de Jump changé par une mise en production — 06/11 (`lot-33-incident.md`).
- **Passation** : mise à jour le 20/11 (`docs/jump/passation.md`).
- **Où on en est** :
  - Jump (jour ; fiche `on`, premier jour 2026-10-16) ; dernier README de lot : le lot 33 (06/11), incident : le niveau du jour changé par une mise en production, réparé et gardé par des garde-fous (`docs/jump/lots/lot-33-incident.md`).
  - L'état d'ensemble est dans `docs/jump/synthese.md` ; ses lots sont dans `docs/jump/lots/`.
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation du jeu.
- **Prochain lot** : à compléter par la conversation du jeu.
- **Décisions en attente (Nathan)** : 
  - à compléter par la conversation du jeu (les décisions du § 6 du lot 33 n'ont pas été reprises ici : à relire).

## Tower — arcade
- **Fiche** : état de départ `off`, premier jour 2026-11-02 ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : T9 — Les visuels : décors, bonus et malus, taquet (Tower) — 02/11 (`lot-T9-visuels.md`).
- **Passation** : mise à jour le 20/11 (`docs/tower/passation.md`).
- **Où on en est** :
  - Tower (arcade, `off`) ; dernier README de lot : T9 (02/11), les visuels : six décors, habillage des effets, taquet (`docs/tower/lots/lot-T9-visuels.md`).
  - Non vérifié à T9 : un vrai téléphone, iPhone, Firefox et WebKit, les six effets en partie réelle de bout en bout.
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation du jeu.
- **Prochain lot** : à compléter par la conversation du jeu (T9 note qu'une ligne de budget `tower.decors` / `tower.habits` est un lot de plateforme).
- **Décisions en attente (Nathan)** : 
  - Nathan (T9) : les textes anglais des tampons (IVY!, BOLTED!, MINI!, GIANT…, GUST…, SLIPPERY…).
  - Nathan (T9) : les fissures de la géante restent-elles sur la pièce écrasée, ou 3 s suffisent ?
  - Nathan (T9) : des habits plus gros que la pièce (décors à 20 px par mètre plus calmes que la planche) ?
  - Nathan (T9) : valider les nouveaux ciels du canyon et de la jungle (contraste).

## Cibles — jour
- **Fiche** : état de départ `off`, premier jour 2026-11-02, jeu témoin (jamais en production) ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : aucun README de lot.
- **Passation** : aucune (`docs/cibles/passation.md`) — jeu témoin, pas de conversation d'orchestration.

## Blocks — arcade
- **Fiche** : état de départ `off`, premier jour 2026-11-02 ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : B8c — Blocks : un tirage adapté à la grille, des médailles à la mesure d'un joueur — 08/11 (`lot-B8c-tirage-adapte.md`).
- **Passation** : mise à jour le 20/11 (`docs/blocks/passation.md`).
- **Où on en est** :
  - Blocks (arcade, `off`, branché par le kit) ; dernier README de lot : B8c (08/11), tirage v6, règles v3, bot v5 : chaque série est tirée selon la grille, médailles recalibrées (`docs/blocks/lots/lot-B8c-tirage-adapte.md`).
  - Vérifié au dernier lot : tests unitaires, typecheck, e2e Chromium (87 tests). Non vérifié : un vrai téléphone, Firefox et WebKit.
  - La publication (`off` → `preview` → `on`) est faite par Nathan dans `/admin/` ; l'état réel n'est pas dans le dépôt.
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation du jeu.
- **Prochain lot** : à compléter par la conversation du jeu (le README de B8c n'annonce pas de suite).
- **Décisions en attente (Nathan)** : 
  - Nathan : juger le ressenti du jeu avec le tirage adapté (B8c : non vérifié, « Nathan »).

## Rush — arcade
- **Fiche** : état de départ `off`, premier jour 2026-11-02 ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : BR-A2 — Rush : le niveau, la lumière et l'ambiance — 09/11 (`lot-BR-A2-monde.md`).
- **Passation** : mise à jour le 20/11 (`docs/rush/passation.md`).
- **Où on en est** :
  - Rush (arcade, `off`, branché par le kit) ; dernier README de lot : BR-A2 (09/11), le niveau, la lumière et l'ambiance (archipel, sol calculé, fabrique de décor, ambiance par thème, HUD).
  - Le README de BR-A2 parle d'un lot BR-A1 qui recolorera le golem ; aucun README BR-A1 n'est au dépôt.
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation du jeu.
- **Prochain lot** : à compléter par la conversation du jeu (le README de BR-A2 cite BR-A1, le golem recoloré, sans le dater).
- **Décisions en attente (Nathan)** : 
  - Nathan (BR-A2 § 7) : le sable de la prairie, pâle ou réchauffé à la cible quand le golem sera recoloré ?
  - Nathan (BR-A2 § 7) : l'entrée de l'arène, un portique plus bas ou des piliers seuls (le linteau cache un peu l'arène de loin) ?
  - Nathan (BR-A2 § 7) : les rais de lumière (25 % en prairie, 15 % en carrière, 90 % dans le sous-bois), bon ?
  - Nathan (BR-A2 § 7) : la basse qualité sans vent (le contour par coque ne suit pas le balancement), voulu ?

## Vertige — arcade
- **Fiche** : état de départ `off`, premier jour 2026-11-02 ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : V3 — « Vertige » : le niveau du jour, le robot et les médailles — 13/11 (`lot-V3-niveau-du-jour.md`).
- **Passation** : mise à jour le 20/11 (`docs/vertige/passation.md`).
- **Où on en est** :
  - Vertige (arcade, `off`, branché par le kit) ; dernier README de lot : V3 (13/11), le niveau du jour (6 à 8 modules, robot de 28 à 38 s), le robot et les médailles.
  - V3 a rendu ses médailles au smoke de la recette (sortie de zone accordée par Nathan : `apps/api/scripts/smokeRead.ts`, `apps/api/test/smokeLecture.test.ts`).
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation du jeu.
- **Prochain lot** : à compléter par la conversation du jeu (le README de V3 n'annonce pas de suite).
- **Décisions en attente (Nathan)** : 
  - Nathan : passer Vertige en `preview` sur la recette pour le scénario 2 de V3 (un clic dans `/admin/` ; l'identité provisoire de V1b le permet).
  - Nathan : calibrer le barème des médailles (`config/jeux/vertige.json`, `medailles.bareme`) avec ses temps ; les jours déjà figés gardent leurs seuils.

## Gravity — arcade
- **Fiche** : état de départ `off`, premier jour 2026-11-02 ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : GR7 — Gravity : plus vite, plus varié, de nouveaux dangers (scies, sols fragiles, lasers) — 18/11 (`lot-GR7-dangers-et-difficulte.md`).
- **Passation** : mise à jour le 20/11 (`docs/gravity/passation.md`).
- **Où on en est** :
  - Gravity (arcade, `off`, branché par le kit) ; dernier README de lot : GR7 (18/11), vitesse relevée, générateur 5, simulation 4, robot 4, trois dangers (scies, sols fragiles, lasers), 48 motifs.
  - Aucun jour n'est figé (le jeu est `off`).
  - Non vérifié à GR7 : le son à l'oreille, un vrai téléphone, Firefox et WebKit, la longueur du préavis de la Nuit à l'œil.
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation du jeu.
- **Prochain lot** : à compléter par la conversation du jeu (le README de GR7 n'annonce pas de suite).
- **Décisions en attente (Nathan)** : 
  - Nathan : relever le plafond `gravity.demande` de 203 à 230 Ko (proposé par GR7, noté « à confirmer » dans `docs/plateforme/budgets.md` ; sans cela le job « Budgets » reste rouge).
  - Plateforme : `scripts/unit-durees.json` n'a pas de ligne pour les trois nouveaux fichiers de tests de `gravity-sim` (GR7, 5 s par défaut).

## Pinball — arcade
- **Fiche** : état de départ `off`, premier jour 2026-11-02 ; identité complète. Production et recette : `/admin/` › Jeux.
- **Dernier lot** : PBR1 — Pinball : un robot des médailles 4,5 fois plus rapide — 18/11 (`lot-PBR1-robot-rapide.md`).
- **Passation** : mise à jour le 20/11 (`docs/pinball/passation.md`).
- **Où on en est** :
  - Pinball (arcade, `off`, branché par le kit) ; dernier README de lot : PBR1 (18/11), un robot des médailles 4,5 fois plus rapide (2,4 à 2,8 s sur ordinateur, ≈ 10,6 s avec un processeur ralenti ×4), scores identiques.
  - `PINBALL_SIM_VERSION` inchangée ; `PINBALL_BOT_VERSION` n'a pas monté (résultats identiques).
  - Non vérifié : la vitesse sur un vrai téléphone ; l'aperçu `/pinball/?robot` n'a pas été regardé par un humain.
  - Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation du jeu.
- **Prochain lot** : à compléter par la conversation du jeu (le README de PBR1 n'annonce pas de suite).
- **Décisions en attente (Nathan)** : 
  - Nathan : monter ou non `PINBALL_BOT_VERSION` (PBR1 : non, pour ne pas changer l'empreinte des jours protégés ; une ligne à changer pour garder la trace).
  - Nathan : si 3,3 s d'attente reste trop, passer les tranches du calcul du navigateur de 4 ms à 8 ms toutes les 16 ms (divise l'attente par deux ; hors périmètre de PBR1, non fait).
