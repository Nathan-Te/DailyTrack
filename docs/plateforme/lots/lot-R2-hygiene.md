# Lot R2 (plateforme) — l'hygiène du dépôt

PR brouillon de la branche du lot. Aucun changement de code de jeu, d'API ni de physique ; **golden des deux jeux inchangés** ; aucun test existant modifié (un seul test ajouté : `apps/api/test/ciScope.test.ts`). Tableau de correspondance complet : [`lot-R2-correspondance.md`](lot-R2-correspondance.md).

## 1. Comment Claude Code charge les `CLAUDE.md` (vérifié dans la documentation)
Source : <https://code.claude.com/docs/en/memory>, § « How CLAUDE.md files load » (lue le 19/10/2026) :
- « Claude Code loads `CLAUDE.md` … from your current working directory and every directory above it » — au **lancement**.
- « Claude also discovers `CLAUDE.md` … files in subdirectories under your current working directory. Instead of loading them at launch, Claude Code loads each one **once Claude reads, writes, or edits another file in that subdirectory**. » (un `cat` ou `head` d'un seul fichier compte comme une lecture).
- Les imports `@chemin` : « imported files also load at launch » et « don't reduce its context cost » (profondeur 4) — d'où la suppression des deux `@docs/…` de la racine, qui chargeaient 11 300 mots pour rien.
- La doc recommande moins de 200 lignes par fichier et propose `.claude/rules/*.md` à `paths:` (même chargement à la demande). Après `/compact`, le `CLAUDE.md` racine est relu ; ceux des sous-dossiers se rechargent à la demande.
**Conséquences** : (1) le `CLAUDE.md` racine est le seul chargé à coup sûr → il est court ; (2) une zone n'est chargée que lorsqu'on y lit un fichier → chaque `CLAUDE.md` de zone dit « lis-moi si je ne suis pas chargé » (la racine aussi) ; (3) `.claude/rules/` n'apporterait rien de plus que des `CLAUDE.md` de dossier, qui restent à côté du code. Les lignes de nos fichiers sont longues (puces denses) : la recommandation des 200 lignes n'est pas tenue, la tenir demanderait de réécrire les règles, ce qui est hors périmètre (« aucune règle perdue »).

## 2. Nouvelle carte des consignes
| Fichier | Contient | Chargé quand |
|---|---|---|
| `CLAUDE.md` (racine, 1 857 mots) | carte du dépôt, règles communes, index des rubriques, « Plusieurs jeux » (zones partagées), commandes, « Tests et CI », méthode | toujours |
| `packages/sim/CLAUDE.md` | DailyTrack : simulation, générateur, thèmes, figures, déterminisme | on lit `packages/sim` |
| `apps/web/CLAUDE.md` | DailyTrack : rendu, interface, tactile, miniatures, Salon côté jeu | on lit `apps/web` |
| `apps/api/CLAUDE.md` | serveur (classement, pseudos, profil, Salon serveur, production) **et plateforme** (recette, aperçus) | on lit `apps/api` |
| `packages/jump-sim/CLAUDE.md` | DailyJump : simulation, morceaux, solveur, générateur, versions, jours figés | on lit `packages/jump-sim` |
| `apps/jump/CLAUDE.md` | DailyJump : jeu, tactile, sensations, thèmes visuels, accueil et arrivée | on lit `apps/jump` |
**Choix** : découpage par **package/app** (là où la doc charge) plutôt que par jeu seul, car un lot de simulation et un lot d'interface n'ont pas besoin des mêmes règles ; les règles de plateforme sont dans `apps/api/` (leur zone, comme le demande le prompt) et leurs renvois sont dans la racine. Les puces mixtes sont réparties ligne à ligne (`packages/jump-sim` : règles de sim, de morceaux et de générateur ; `apps/jump` : tout ce qui s'affiche). Un lot qui change une version relit « Règles de `jump-sim` » ; les deux fichiers de chaque jeu se renvoient l'un à l'autre. « Tests et CI » reste à la racine : c'est une règle des deux jeux et de la zone partagée `ci.yml`.
**`docs/*/consignes.md`** deviennent des **renvois de quelques lignes** (et ne disparaissent pas) : des README de lots les citent (« consignes DailyJump mises à jour »…) et un lecteur qui les ouvre doit trouver où est parti le contenu. Le `CLAUDE.md` racine ne les importe plus.
**Le tableau de correspondance** (annexe, 61 rubriques) montre l'origine et la destination de chaque rubrique ; le contrôle mécanique (chaque ligne de règle des anciens fichiers retrouvée à l'identique) donne 0 manquante.

## 3. Taille du contexte chargé au démarrage
Mesure : mots (`wc -w`) et caractères des fichiers chargés ; jetons ≈ caractères ÷ 4 (approximation, le français tokenise un peu plus gros).
| | Mots | Caractères | Jetons ≈ |
|---|---|---|---|
| **Avant** (`CLAUDE.md` + deux imports) | 27 871 | 191 321 | ≈ 47 800 |
| **Après**, au démarrage (racine seule) | 1 857 | 12 652 | ≈ 3 200 (**−93 %**) |
| Après, lot de simulation DailyJump (racine + `jump-sim`) | 8 613 | 58 300 | ≈ 14 600 |
| Après, lot d'interface DailyJump (racine + `apps/jump`) | 6 089 | 42 216 | ≈ 10 600 |
| Après, lot de simulation DailyTrack (racine + `sim`) | 8 647 | 58 035 | ≈ 14 500 |
| Après, lot de serveur (racine + `apps/api`) | 6 605 | 45 869 | ≈ 11 500 |
Le total des consignes ne baisse pas (29 274 mots : en-têtes et index en plus) ; ce qui baisse, c'est ce qu'une session charge. Une session qui franchit plusieurs zones charge chacune à la demande.

## 4. Filtres de CI par chemin
`scripts/ci-scope.mjs` (pur, testé par `apps/api/test/ciScope.test.ts` : 20 tests, zones partagées, doutes, faux amis de noms, normalisation des chemins) range chaque fichier changé en `track`, `jump` ou `plateforme`.
- **Un jeu seul** : `packages/sim`, `apps/web`, `docs/lots`, `docs/seed.md`, `docs/orchestration.md`, `docs/guide-technique.md` → `track` ; `packages/jump-sim`, `apps/jump`, `docs/jump` → `jump` ; `docs/plateforme`, `docs/mise-en-ligne.md`, `docs/securite-facturation.md` → `plateforme` ; `apps/jump/public/levels` (lu par le serveur) → `jump` + `plateforme`.
- **Zone partagée = les trois** : `apps/api`, `packages/core`, `packages/clock`, le module de profil, `.github/workflows`, `scripts/`, `package.json`, le verrou, les configurations racine, le `CLAUDE.md` racine. **Tout fichier qu'aucune règle ne reconnaît** (et une liste vide, un chemin étrange) = les trois : le doute ne saute jamais un test.
- **Ce qui tourne** : `test` (typecheck + Vitest sur les deux bases + build) **toujours en entier** ; **e2e** : les parts DailyTrack si `track`, les parts DailyJump si `jump` ; **`api-image`** si le serveur est touché (`SERVER_PATHS` de `scripts/recette.mjs`, ou toute zone partagée / tout doute). Le **run de nuit**, un lancement manuel et `main` ne filtrent rien.
- **Mécanique** : un job `scope` calcule les fichiers (`git diff origin/<base>...HEAD`) ; la matrice `e2e-parts` reste **identique** (des tests la lisent) et chaque part commence par une étape « Cette part est-elle concernée ? » ; une part non concernée saute toutes ses étapes et réussit (≈ 10 s de runner).
- **Le verdict `e2e`** : job `if: always()` qui tourne toujours ; il échoue si `scope` a échoué, réussit en le disant dans le résumé s'il n'y a aucune suite à vérifier, sinon fusionne les rapports des parts jouées.
- **Comment GitHub traite un job sauté pour un statut requis** (source : <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks>) : un job sauté par une condition `if` **rapporte « Success »** ; un *workflow* sauté par `paths`/`branches` laisse ses contrôles **« Pending »** et bloque la fusion (« Avoid requiring workflows that can be skipped ») ; un job dont un `needs` a échoué est sauté et « may not block merging » (d'où `always()`). On filtre donc **au niveau des jobs et des étapes, jamais du workflow** (`on.paths` n'est pas utilisé dans `ci.yml`), et `e2e` ne dépend pas d'un saut pour être vert.
- **Durée du push au verdict d'une PR DailyJump seule** — *avant* : 8 runs réussis de PR DailyJump seule (lots 3c, 8c, 11, 12, 13) du 16/10 : 11 min 34 s à 17 min 47 s, **médiane 14 min 22 s**, ex. 13 min 50 s pour le run 38976608069, dont le chemin critique est la part Chromium de DailyTrack (9 min 13 s) ; *après* (estimation à partir des jobs de ce run, **à confirmer** par la première PR DailyJump) : `scope` ≈ 20 s, puis la plus longue part DailyJump (WebKit, 3 min 29 s) et le job `test` (4 min 22 s) en parallèle, puis le verdict (≈ 25 s) : **≈ 5 min**. Les PR qui touchent DailyTrack, le serveur ou une zone partagée gardent ≈ 14 min.

## 5. Synthèses
- **`docs/jump/synthese.md`** (nouveau) : architecture, physique, mécaniques par thème, morceaux et solveur, générateur et versions, jours figés, interface, outils, décisions de Nathan, dettes ; chaque point renvoie au README du lot. À tenir à jour par chaque lot DailyJump.
- **`docs/orchestration.md`** (DailyTrack) : vérifié lot par lot (0 à 31b) ; corrigé : fenêtre d'envoi du Salon (`fin + 3 s`, l'ancien `+ 60 s` subsistait deux fois), introduction, index (nouvelles consignes, DailyJump, plateforme). Rien d'autre n'était périmé (versions 14 / 15 vérifiées dans `constants.ts`).
- **Dettes nommées** : § 8 de `docs/orchestration.md` — `salon.spec.ts:149` (runs `push`, lot 3c) et `tactile.spec.ts` (lot 13). Non corrigées.
- Les README de lots restent en place ; les `CLAUDE.md` disent de partir de la synthèse.

## 6. Vérifié / non vérifié / décisions pour Nathan
**Vérifié** : documentation de Claude Code lue (§ 1) et du traitement des jobs sautés (§ 4) ; contrôle mécanique « aucune règle perdue » (0 manquante) ; mesures de taille ; `ci-scope` testé (20 tests) ; tests existants des parts et de la CI (`e2eParts`, `ciE2e`) verts ; typecheck et `npm test` (résultats dans la PR) ; syntaxe de `ci.yml` (YAML valide, jobs `scope`, `e2e-parts`, `e2e`, `api-image`, `test`).
**Non vérifié** : (1) **le comportement réel du nouveau `ci.yml` dans GitHub Actions** : cette PR touche `ci.yml` (zone partagée = tout tourne), donc elle montre le cas « tout lancé » et le verdict vert, **pas** le cas « DailyJump seul » ; (2) le **run d'essai DailyJump seul** demandé comme critère d'arrêt : il faut une PR dont la seule différence avec `main` est un fichier de DailyJump, donc après la fusion de ce lot (ou une branche d'essai à partir de celle-ci, que je n'ai pas le droit de pousser sans votre accord) ; recette : changer `docs/jump/synthese.md` seul et ouvrir la PR ; attendu : parts DailyTrack « sautées » en quelques secondes, verdict `e2e` vert ; (3) la durée « après » (estimation) ; (4) que les agents ouvrent bien le `CLAUDE.md` de leur zone (comportement de Claude Code, non mesuré sur une session réelle).
**Décisions pour Nathan** : (a) accord pour une branche d'essai (ou attendre la première PR DailyJump) afin de fermer le critère « run d'essai » ; (b) garder « Tests et CI » à la racine (≈ 610 mots chargés partout) ou le déplacer dans `apps/web/` et `apps/jump/` (gain 1 000 jetons, risque d'un agent DailyJump qui ne lit pas la règle) ; (c) `api-image` tourne aussi pour un lot DailyJump qui touche `packages/jump-sim` ou les niveaux figés (le serveur les rejoue : voulu, mais cela dépasse « serveur touché » au sens strict) ; (d) en faire un statut requis ? Non : `test` et `e2e` restent les seuls requis ; (e) réécrire les `CLAUDE.md` en listes courtes (200 lignes) est un lot à part.
