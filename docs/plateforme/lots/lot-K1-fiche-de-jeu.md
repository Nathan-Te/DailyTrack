# Lot K1 — La fiche de jeu, lue par la plateforme (Tower d'abord)

Conception : `docs/plateforme/kit-de-jeu.md` (lot K0, PR #239 pas encore fusionnée). Pour les joueurs : **rien**. Aucun golden, aucune `*_VERSION`, aucune table, aucun fichier de jour touchés.

## Le schéma final (`packages/core/src/fiche.ts`) et ses écarts avec K0
`config/jeux/tower.json` suit le § 3 de K0, validé par `validerFiche` (tous les problèmes d'un coup). Écarts :
- `budget.lignes` est une **liste de noms** (pas de plafond) : les plafonds restent dans `budgets.md`, un seul endroit (un test vérifie les noms).
- `etiquette.dessin` est obligatoire ; `titre` (clé de catalogue, absent = nom en capitales) et `zones { jeu, serveur }` ajoutés ; `e2e` porte aussi `suite`, `zones`, `specs`, `parts` (les zones de CI de Tower quittent `e2e/zones.json`) ; `admin: { outils }` ; `etatDepart` seulement `off | on`.
- **La validation garde la règle des zones** : une fiche ne peut réclamer que des chemins, tables (`<id>_…`), préfixe, destination, zones de CI et lignes de budget de son jeu (le lot d'un jeu écrit sa fiche). `zones-jeu.mjs` autorise `config/jeux/<id>.json` (la sienne) et ce que `npm run fiches` génère.
- `jours.mode` existe (`fichier-par-jour` pour Tower) ; le registre des versions de Tower reste un lot à part.

`npm run fiches` écrit `config/jeux/projections/{portail,serveur,ci,jeu}.json` et un `fiches.generated.ts` dans `core`, `profile`, `ui`, `musique` (paquets qui n'importent rien d'extérieur) ; le test `packages/core/test/fiches.test.ts` vérifie qu'ils sont à jour. Les listes générées sont **écrites en toutes lettres, comme avant** : l'accès `r.tower.fond` d'un objet avait coûté +147 o à Track (mesuré, corrigé en constantes isolées).

## Branché sur la fiche (pour Tower ; Track et Jump gardent leur code)
- **Portail** (projection `portail`, 110 o) : cartouches, nom, accroche, titre, étiquette (`etiquetteDe` de `@cdj/ui`), format du score, filtre du cumul, noms de classement et de partage, destinations du message. Un test interdit de nommer Tower en dur dans ces fichiers.
- **Tableau de bord** : `tuilesDesJeux` (tuile « Tower finis » dès que l'API envoie `chiffres.tower`), `nomDuJeuAdmin` (plus de « Track » par défaut pour un résultat retiré).
- **Socle** : `Jeu` (type), valeurs des jetons de l'étiquette, `formatScore` ; `JEUX_PUBLICS`, préfixes de stockage, destinations, zones de nouveautés, scènes de musique : une seule liste générée (core et profile).
- **Scripts** : `zones-jeu`, `ci-scope`, `ci-zones` (suites, zones, specs, fumée, parts), `site` (dossier publié, preuve interdite), `budgets` (lignes) lisent `fiches-lecture.mjs`.
- **Mentions** : test des `data-tables` de chaque fiche (deux pages) ; **cohérence code ↔ fiche** : `apps/api/test/fiches.test.ts` (tables, tri, thèmes, rejeu, versions…).
- **Laissé** — K1b/K1c : Track et Jump (leurs lignes de `JEUX_SANS_FICHE`, ternaires, zones) ; **K2** : tout ce qui est serveur, `mise-en-production.mjs`, `recette.mjs`, `e2e-*.mjs`, CSS des zones/étiquettes/sélecteur d'amis (feuilles écrites à la main, vérifiées par `packages/ui/test/fiches.test.ts`), étiquette générique d'un jeu neuf (K3). **Workflows non touchés** : Tower y est dans des expressions (`matrix.suite == 'tower'`), noms d'artefacts et étapes ; les lire d'une projection demande de générer le YAML ou une matrice depuis `scope` — faisable sans affaiblir `securite-workflows.mjs`, mais c'est un lot (K2).

## Avant / après (même session, deux constructions fraîches de `HEAD` et de la branche)
- `ci-zones.mjs` (4 modes) × 11 listes de fichiers, `zones-jeu.mjs` (4 branches × 5 jeux d'étiquettes × 11 listes), `ci-scope.mjs` : **sorties identiques**, sauf le nombre/la liste des tests unitaires (+3 fichiers de test ajoutés par ce lot).
- `site.mjs` : mêmes fichiers (615), mêmes tailles hors noms hachés ; empreintes identiques pour tout ce qui n'est pas JS/CSS **sauf** les pages HTML dont l'URL de script porte le hachage d'un chunk changé (portail : le chunk `jour` devient `jeuxFiches`). Images, manifeste, musique, jours : identiques.
- `budgets.mjs` : **Track** identique (296 846, dist octet pour octet) ; **Tower** accueil 39 942 → 39 938, jeu 174 672 → 174 665 ; **Jump** +8 o (un octet de hachage dans `classementAmis.js`, bruit gzip) ; **portail** premier chargement 33 681 → 33 887 (**+206 o**, plafond du lot 512 o : la projection, `etiquetteDe`, les helpers ; moins les ternaires retirés). Plafonds de `budgets.md` inchangés.
- Diff : aucun golden, aucune `*_VERSION`, aucun fichier de jour. Tests de Tower et du portail modifiés parce qu'ils lisent la fiche : `horsProduction`, `mentions`, `clesUtilisees`, `zonesJeu`.

## K1b (Jump) et K1c (Track), 5 lignes chacun
1. Écrire `config/jeux/jump.json` (`track.json`) ; la validation suppose `apps/<id>/`, `packages/<id>-sim/` : Track (`web`, `sim`, code `cdj`) demandera un champ de dossiers.
2. Retirer sa ligne de `JEUX_SANS_FICHE` ; `npm run fiches` ; les listes générées gardent leur ordre.
3. Retirer les branches « sans fiche » : `cartes()`, `JEUX` de `classement.ts`, `nomDuJeu`, titres `jeu.<id>.titre`, `etiquetteDe`.
4. Déplacer ses zones/specs de `e2e/zones.json` et ses suites (`web`/`jump`) dans la fiche ; `regression` y suit.
5. Vérifier les mêmes comparaisons avant/après et le budget du jeu ligne à ligne (Track : octet pour octet).

## Vérifié / non vérifié
- Vérifié : suite complète SQLite (406 fichiers, 6 013 tests) avant la correction des constantes ; `tsc -b` et `tsc -p apps/portail` ; tests ciblés après correction (`ui`, `core`, `portail`, zones). Reste à voir sur la CI : projet libSQL, e2e, run en mode `main` forcé.
- **CI en mode `main` forcé (run 41532090082, `e2738db`) : tout vert sauf `e2e-parts (chromium 2/3)`, une seule assertion — `apps/web/e2e/perf.spec.ts`, budget de Track : 296 880 o mesurés pour un plafond de 296 736 (+144).** Ce n'est pas ce lot : `origin/main` seul, reconstruit à part, mesure **296 880** (la branche aussi, octet pour octet) — le dépassement vient d'un lot déjà fusionné (S1b ?). Je n'ai pas relevé le plafond (décision de Nathan, règle d'arrêt) ; `e2e` et la fusion restent bloqués tant qu'il n'est pas réglé (relever à 297 000 o, ou retirer 144 o de Track).
- **Non fait** : captures côte à côte de la cartouche (à regarder sur l'aperçu de la PR, § Nathan ci-dessous) ; budgets mesurés à froid une seule fois par état.
- **Nathan (2 clics)** : (1) aperçu de la PR, `/` : cartouche de Tower avec « Brouillon », identique à la production ; (2) recette après fusion, `/admin/` : tuile « Tower finis » (si Tower est monté sur la recette).
