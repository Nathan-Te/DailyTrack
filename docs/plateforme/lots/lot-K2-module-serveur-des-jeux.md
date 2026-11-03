# Lot K2 — Le module serveur commun des jeux (Tower d'abord)

Branche `claude/jeux-module-serveur-dkf6up`, PR brouillon. **Pour les joueurs : rien.** Conception : `kit-de-jeu.md` § 4 ; règles : `apps/api/CLAUDE.md`, « Module des jeux (lot K2) ».

## Le contrat final (`apps/api/src/jeux/contrat.ts`) et ses écarts avec K0
Le contrat ne connaît ni la base ni HTTP : il lève `RefusJeu` (un code de la liste unique), le module en fait la réponse. Par rapport aux cinq fonctions de K0, la lecture de `tower.ts` a imposé :
- **le niveau du jour en trois temps** (`regle`, `calculer`, `restaurer`) à la place de `niveauDuJour` : le module garde la ligne du niveau (cache en mémoire, un seul calcul à la fois, ligne en base) et le contrat ne touche aucune table ;
- **`decoder` / `jourDe` / `memeContenu` / `entrees`** (copies : le module hache) au lieu de `decoder` / `empreinteEntrees` seuls ; `rejouer` rend la mesure du jeu, `rejouee` dit ce qu'elle écrit, `medaille` la médaille ;
- **des formateurs de réponses** (`ligneClassement`, `reponseEnvoi`, `jourProfil`, `versPortail`, `portailJour`, `infoJour`) : « mêmes réponses » oblige, le format reste celui du jeu ; `scoreDiamant` n'est pas un appel du module (le Diamant vit dans le niveau, via `empreinteAuteur` et `fantome.lire`) ;
- `fantome` facultatif (`route`, `lire`) ; `routesPropres` est dans la configuration (`ConfigJeu`), pas dans le contrat.

## L'adaptateur de table (`jeux/adaptateur.ts`)
`AdaptateurTable` : la table, les colonnes de classement (nom de fiche, colonne, sens de l'index, `signe`), les colonnes écrites, celles qu'une meilleure partie ne remplace pas, la table du niveau. `sqlDe` en fabrique toutes les requêtes ; `verifierAdaptateur` le compare à la fiche. Tower : `tower_results`, hauteur ↓, vies ↓, ticks ↑. **La table commune `resultats_jeu` (K4) est un adaptateur de plus** (`filtreJeu`, `signe: -1`) : `jeuxModule.test.ts` le prouve sur une table d'essai (rang, haut du classement, remplacement par une meilleure partie), sans rien créer au schéma.

## Ce que fait le module (`jeux/module.ts`, `fil.ts`)
Routes `info`, `day`, `submit`, `board`, fantôme, `me` aux mêmes adresses ; ordre de validation inchangé ; classement par colonnes (rang par l'index, `hidden = 0`) ; copies ; aperçu ; effacement ; « Changer mon code » ; crochets `portail` et `admin` ; fil de calcul (`executeurFil`, générique). **Amis, Mon groupe et classement des groupes n'étaient pas dans `tower.ts`** : ils passent par `api.ts` → `amis.classementJeu` et le classement que `portail.classes` rend ; le banc les couvre. La fiche est lue par le serveur (`apps/api/src/fiches.generated.ts`, `npm run fiches`).

## Retiré de `tower.ts`
`tower.ts` : 709 → 458 lignes (schéma, types, contrat, adaptateur) ; `towerFil.ts` (97) supprimé, son exécuteur est `jeux/fil.ts` ; `towerRejeu.ts` 77 → 73. Disparus de Tower : les routes et leur aiguillage, `submit`, `board`, `rankOf`, le cache du niveau, `myProfile`, la garde du fantôme, les crochets `portail`, `admin`, `erase`, `rotateStatements`, `validate`. Le module compte 836 lignes : le gain est pour K2b et K2c, pas pour Tower seul.

## Le banc avant / après
`scripts/banc.ts` + `scripts/banc-tower.ts` ; référence `test/fixtures/banc-tower.json` (**169 traces** : les réponses et des relevés de la base), produite par le code d'avant (commit `233b879`, avant tout changement du serveur), rejouée par `test/bancTower.test.ts` sur SQLite **et** libSQL `file:`. Couvre : envoi valide, **un refus par code d'erreur de Tower** (25 codes différents dans la référence), plafond 503, débit 429, grâce de minuit, panne du rejeu, classements Tous / Amis / Mon groupe / Groupes / portail, profil, fantôme (verrouillé, débloqué, sans preuve, fichier abîmé), copie, `off` / aperçu de PR / `preview` avec et sans clé / `on`, administration (fiche, masquer, retirer, renommer), changement de code, effacement, jour figé, état de la base.
**Résultat : 0 différence** (statut, `Cache-Control`, `Vary`, `Retry-After`, corps, lignes écrites). Normalisé : les jetons tirés au hasard et deux horodatages de l'interrupteur lus sur l'horloge réelle (`modifieLe`, `creeeLe`). Seules différences hors banc : les textes des erreurs (jamais renvoyés depuis le lot I6).

## Coûts (R14)
`npm run measure:lignes`, avant et après, **identique** : classement 59 lignes lues / 7 instructions à froid ; profil 16 / 6 ; envoi 69 / 25 / 2 écrites. Plans `EXPLAIN` : le texte de rang, de haut de classement et de classés est celui d'avant (testé) ; `towerEnvoi.test.ts` (plan) et `routesChaudes.test.ts` passent. Temps de rejeu : même exécuteur, même appel ; **non remesuré**.

## Ce que K2b (Jump) aura à faire
1. Écrire `banc-jump.ts` sur le code d'avant, versé en premier commit.
2. `contratJump` + `ADAPTATEUR_JUMP` (`jump_results` : ticks ↑) ; board, `me`, `bundle` : formateurs dans le contrat, `bundle` et `ghost/first` en `routesPropres`.
3. `jumpLives.ts` (vies, carte, carnage, oubli) reste en `routesPropres`.
4. Ajouter à la configuration ce que Jump a de plus : `levelId` dans le classement, `deaths`, `firstOfClosed` (point d'extension du board si besoin).
5. Retirer le code dupliqué de `jump.ts` ; `MOTIFS_JEUX` et le banc inchangés.

## Ce que K2c (Track) aura à faire
1. `banc-track.ts` d'abord, avant tout changement.
2. Préfixe `/api` (routes historiques), `results` (ms ↑), circuit du jour et variantes du planning dans le contrat.
3. Salon, Garage, planning, fantômes choisis, admin de Track : `routesPropres`, jamais migrés.
4. `GameInstance.profile` (`/api/me`) et `X-Player-Id` en transition (`playerOf`) à garder tels quels.
5. Les médailles par version du générateur (lot G1) restent dans le contrat de Track.

## Vérifié / non vérifié
Vérifié : `tsc -b` ; suite `apps/api` sur SQLite **et** libSQL, `packages/core`, `apps/portail`, `ciZones` ; banc identique ; `securite-workflows` 0 écart ; e2e Tower `classement.spec.ts` contre le vrai serveur (4/4 ; un premier passage a vu échouer « sans serveur » une fois, passé aux deux relances). Non vérifié : mesure de temps de rejeu, `smoke` sur la recette. Modifié hors du module, par nécessité : `packages/core/src/ficheSorties.ts` (la vue serveur de la fiche) et son test, `e2e/zones.json` (zone `api-jeux`, citée par le spec `classement` de Tower), `codesErreur.test.ts` (lit aussi `src/jeux/`). Ni version, ni table, ni migration, ni fichier de jour, ni golden.

## CI
À remplir : run de la PR ; run en mode `main` forcé une fois (puis le forçage retiré).
