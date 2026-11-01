# Lot 31 — Cheminées à scie plus larges, portions dures selon la pire phase, course du n° 1 (DailyJump)

Versions : `JUMP_GENERATOR_VERSION` **25** (`…-g25`) · `JUMP_SIM_VERSION` 13 **inchangée** (la simulation ne bouge pas : un niveau g24 se rejoue tel quel) · golden v3 à v12 **identiques au bit** (`daily-golden-v13.json` et `replay-golden-v13.json` refaits, jour de référence le 06/12/2026). Branche `claude/vigilant-pasteur-93f8l5`, PR brouillon `jeu:jump`. Règles : `packages/jump-sim/CLAUDE.md` (« Place autour de la lame et portion dure (lot 31) ») et `apps/jump/CLAUDE.md` (« Course du n° 1 (lot 31) »).

## Scénario en 2 clics
`<aperçu>` = le lien d'aperçu commenté sur la PR (en local : `npm run dev:jump`).
1. **La cheminée élargie, jouée seule** : `<aperçu>/jump/?module=cheminee-scie&variante=6&entree=arret` (scie collée à la paroi droite : 2,06 tuiles libres à gauche) ; `…&variante=5` (collée à gauche, la plus dure : note 5) ; `…&variante=1` : l'ancienne (scie au milieu, 1,06 tuile de chaque côté) pour comparer.
2. **Un classement, « Voir le carnage » et la course du n° 1** : `<aperçu>/jump/?api=demo` (le « aujourd'hui » de la démonstration est le 30/10/2026, une usine **dont la cheminée est `cheminee-scie` v6**) ; **jour de forêt** : `<aperçu>/jump/?api=demo&seed=2026-10-29` (archive de la démonstration, forêt g25, son classement figé). Finir le niveau → « Accueil » : « Voir le carnage » est sur la carte du carnage du jour ; « Tout le classement › » (ou le classement de l'arrivée) → **« Voir la course du n° 1 »**.

## Le morceau identifié
**`cheminee-scie`** (famille `cheminee`, forêt comprise : les jours 29/10, 03/11, 08/11 en g25 en tirent un ; il est commun à tous les thèmes). Cheminée de 3 colonnes de large, une scie `o` (diamètre 0,875 tuile) qui va et vient sur un rail vertical **au milieu** : 1,06 tuile libre de chaque côté, le personnage glissait contre la paroi à portée des dents. **Les 31/10 et 01/11 ne sont pas des jours de forêt** avec le sac de thèmes du générateur courant (glace, nuit) ; la capture de Nathan vient d'un niveau d'une version antérieure (le sac a changé, et `cheminee-scie` revient dans tous les thèmes).
`npm run lame:modules -w @cdj/jump-sim -- --etroites --tout` liste les variantes à scie mobile qui ne tiennent pas la règle : **seul `cheminee-scie` (v0 à v4, dont v1 à v3 utilisables)**. `--portes` liste les scies qui **barrent** un puits d'une paroi à l'autre : `ressort-scie` v0 à v2 et `chute-pics` v2 (scie ajoutée par `+patrouille`, 0,06 tuile libre).

## Règle « place autour de la lame » (g25)
`src/lame.ts` (pur) : l'enveloppe balayée par une scie mobile laisse **au moins 2 tuiles libres entre la lame et une paroi**, sur toute sa course, dans un couloir ou une cheminée qu'on traverse (flanqué de blocs ou de pics des deux côtés, rail libre, un sol : une fosse comme celle d'`ascenseur` n'est pas un couloir). Le catalogue g25 n'a plus les variantes refusées (`BLADE_TIGHT`, table générée, relue par un test).
**Remplaçantes** (méthode du lot 17 : les refusées gardent texte, solutions et place ; les nouvelles sont au bout de la liste, `V4_ONLY_VARIANTS`, paramètre `rail`) : v5 `rail=3 cycle=600` (notes 5/2) · v6 `rail=5 cycle=660` (1/1) · v7 `rail=3 cycle=300 +denivele:3` (1/2) · v8 `rail=5 cycle=300 +patrouille` (3/3) · v9 `rail=3 cycle=300 +patrouille` (5/1) ; toutes : `solve:modules`, `phases:modules` (8 phases, attente ≤ 12 s), `etats:modules`, `voies:modules`. Deux essais de patrouille refusés (période commune trop longue : attente de 17 s ; solution « au pas près »). Une cheminée de 4 colonnes aurait fait un plat de 7 tuiles (règle des plats : 6) : les remplaçantes restent à 3 colonnes, rail collé.
**Décision à confirmer (Nathan)** : les **portes** (`ressort-scie`, `chute-pics` v2 : la scie barre tout le puits, on la passe au bon moment) ne sont pas lues par la règle ; la lire demanderait de les élargir à ≥ 5 colonnes ou de les retirer.

## Portion dure selon la pire phase
Une variante est dure si sa note est 4 ou 5 **à au moins une des 8 phases** de `phases.json` (`PHASE_HARD`, généré), plus seulement sur sa course de référence. Parmi les **634 variantes utilisables** : **130 → 153 dures (+23, dans 13 morceaux)** : `balancier`, `chaland`, `cheminee-scie`, `chute-pics`, `descente-scies`, `escalier-scies`, `iles-scie`, `laser-*`, `nuit-*`, `piliers-scie` (toutes ses variantes), `presse-*`, `ressort-*`, `tunnel-rase`… Les règles des voies lentes ne changent pas. `voies:modules` les examine aussi : trois variantes se ferment (détour jouable) : `descente-scies` v1, `piliers-scie` v2 et v4.
**Voies lentes par niveau (120 dates)** : moyenne **1,8 → 2,1** (+0,3), maximum **3 → 6** (à surveiller) ; « toutes voies lentes » ÷ auteur : 1,26 → 1,31 en moyenne, 1,54 → 1,80 au pire.

## Deux effets de bord, mesurés (décisions à confirmer)
- **Hauteur maximale 56 → 57 rangées pour la version 13** (`maxDailyHeight`) : avec plus de portions dures, le **22/08/2027** (néon, quatre longs possibles dont trois durs) n'avait plus un seul tirage à 56 rangées (1 000 impasses, **secours**). 57 : 0 secours. Les versions d'avant gardent 56 (références intactes).
- **`tunnel-rase` : trois variantes de plus** (cycles 600, 720, 900, deux non dures) : sans elles une autre date tombait au secours (trop peu de longs non durs). Secours du néon : `cheminee-scie` v6.

## Mesures (365 dates pour la variété, 120 pour le reste ; avant = `main` reconstruit sur la même machine)
| mesure | g24 | g25 |
|---|---|---|
| niveau de secours (365 dates) | 0 | **0** |
| W = 3 · W = 4 retours trop tôt (365 dates) | 0 · 0 | **0 · 0** |
| tirage retenu : médiane · p90 · max (365 dates) | 6 · 12 · 156 | 6 · 12 · **78** |
| génération à froid, 48 dates : moyenne · max | 0,38 · 0,94 s | **0,39 · 1,05 s** (< 1,5 s) |
| temps de l'auteur (120 dates) : min · moy. · max | 28,04 · 29,46 · 31,78 s | 28,02 · 29,56 · 32,02 s |
| plus longue course au sol sans saut : moy. · max | 1,19 · 2,00 s | 1,24 · 1,98 s (≤ 2 s) |
| morceaux · hauteur par niveau (moyennes) | 10,3 · 51,1 | 10,3 · 51,8 (≤ 57) |
| exigence par minute : moy. | 493 | 488 (fenêtre 425–570) |
| étiquettes par niveau (mural · scie ; jours avec) | 2,54 · 2,74 (120/120) | 2,59 · 2,61 (120/120) ; équilibre des mécaniques : `measure:jump`, mêmes ordres de grandeur |
Budget Jump (`scripts/budgets.mjs`) : **378 232 → 381 790 o** (+3 558) ; sans la barre de la course 380 478 (+2 246, plafond 381 490 → 382 490 proposé). `apps/jump/e2e/poids.spec.ts` : `course-*` à la demande (comme `manette-`) et son « avant » **+1 000 o** (8 624 → 9 624) ; **`scripts/budgets.mjs` (zone partagée) n'exclut pas encore `course-`** : une ligne à ajouter ; le plafond de `jump.jsCss` passe à 382 490 (`budgets.md`, lu par `apps/portail/test/budgets.test.ts`), à confirmer.

## « Revoir le carnage » sur l'accueil
**Présent, aucun lot ne l'avait cassé** : le bouton de l'accueil (`#home-carnage`, « Voir le carnage », comme la maquette `jump-accueil.html`) est caché avant d'avoir fini le niveau, **visible après une partie finie, après un carnage, et après un rechargement** (la mémoire du jour est gardée). Nouveau test e2e (`classement.spec.ts`, démonstration) qui le garde. Le libellé est « Voir le carnage » dans le catalogue (la maquette dit pareil ; « Revoir » est le nom du lot 10).

## La course du n° 1
Bouton **« Voir la course du n° 1 »** dans l'écran du classement (posé sur la scène, depuis l'accueil et l'arrivée ; **les archives ont le même écran**, donc le même bouton), absent sans classé. Il rejoue **l'essai complet du premier** (la rediffusion déjà servie pour son fantôme, `ghost/first` : **aucune route à étendre**, elle porte l'essai classé en entier, morts et reprises), dans la version de simulation de son niveau, **caméra sur son personnage** : la barre du carnage devient celle de la course (pseudo · morts, chrono, avancement, **pause**, **×1 / ×2**, **Retour au classement**, Échap, manette). Une commande ne la passe pas ; à la fin ou en quittant on revient à l'écran d'origine puis au classement. Module `course.ts` **à la demande**. Textes `course.*` et `classement.course*` (fr + en), `docs/plateforme/traductions.md` régénéré.

## Vérifié, non vérifié
**Vérifié** : suite sqlite de `jump-sim` (dont le golden v3 à v12 inchangé) ; `apps/jump`, `apps/web/test`, `packages/ui`, tests d'API de Jump ; `typecheck` ; construction ; e2e `classement` (6 tests) et `poids` ; une capture regardée (la barre de la course). **Non vérifié** : libSQL et e2e complets (la CI), Firefox et WebKit, la manette réelle, la course sur téléphone. `voies.test.ts` (« aucun raccourci ») dure ≈ 330 s : son délai passe de 300 à 900 s.
**Un fichier temporaire hors du dépôt** (`/daily.bak`, une sauvegarde faite par erreur pendant un essai) n'a pas pu être supprimé : à effacer.
