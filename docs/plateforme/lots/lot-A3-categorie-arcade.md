# Lot A3 (plateforme) — La catégorie « Arcade » : Tower d'abord, Blocks ensuite

Décision de Nathan : un jeu est `jour` (Track, Jump) ou `arcade` (Tower, puis Blocks). Un jeu d'arcade a son niveau du jour et son classement, mais **n'entre ni dans le classement cumulé, ni dans la journée** (journée parfaite, « n fini sur m », série, ligne de partage du portail), qu'il soit épinglé ou non.

## Livré
- **Fiche** : champ `categorie` (`jour` | `arcade`, obligatoire) validé par `@cdj/core` ; un jeu `arcade` exige `classement.cumul: false`. Facultatif : `categorieDepuis` (AAAA-MM-JJ). Les quatre fiches ont leur catégorie ; **Tower est `arcade`** (sa fiche change, c'est tout). La projection du portail n'écrit que l'arcade.
- **Générateur** : `npm run nouveau-jeu -- --id <id> --categorie jour|arcade` (défaut `jour`), écrit dans la fiche et dans la passation.
- **Règle de jour** (`categorieLe`, `@cdj/core/jeux`) : un changement de catégorie compte à partir du lendemain. La fiche porte `categorieDepuis` = le premier jour de la nouvelle catégorie (avant : l'autre) ; les journées et séries acquises ne bougent pas.
- **Serveur** (`portail.ts`, `groupes.ts`, `classementAmis.ts`) : la catégorie se lit ce jour-là, sans nom de jeu. Un jeu d'arcade a `compte: false` + `categorie: "arcade"` dans `GET /api/portail/jour` (série, journée parfaite, favoris du jour l'ignorent) ; il reste dans les vues du classement (jamais « Cumulé »). Les réponses de classement (`jeux[]`) et des groupes (`arcade[]`) disent quels onglets sont d'arcade.
- **Portail** : section « Arcade » sous les jeux du jour (cartouches compactes, étoile, **favoris d'arcade en tête**) ; `/classement/` : séparateur « Arcade » avant les onglets d'arcade (Tous, Amis, Mon groupe, Groupes). Le partage du portail ne cite que les jeux du jour ; la ligne d'un jeu d'arcade reste celle de la page du jeu.
- **Consignes** : `CLAUDE.md` racine et `docs/regles/racine/publication-des-jeux.md` (règle), `creer-un-jeu.md`, `docs/orchestration.md` § 12 bis (choisir la catégorie à la création), `packages/core/CLAUDE.md`.

## Tests
`packages/core/test/{jeux,fiches}.test.ts` (catégorie validée, arcade ⇒ hors cumul, `categorieLe` à dates fixes) · `apps/api/test/categorie.test.ts` (**changement au lendemain**, séries acquises, arcade depuis toujours ; SQLite et libSQL) · `towerPortail.test.ts` (journée, série, épinglé ou non, cumul) · `apps/portail/test/{partage,mesJeux,classementVues,jeuxFiches,nouveauJeu}.test.ts` (partage sans arcade, favoris en tête, onglets, `--categorie arcade`).

## À savoir (honnêteté)
- **Le banc de Tower a changé** (`apps/api/test/fixtures/banc-tower.json`, `UPDATE_BANC=1`, 8 réponses) alors que le critère dit « bancs inchangés » : c'est inévitable, ces réponses portent la règle (Tower n'est plus dans la série du profil du joueur 1 : 1 → 0 ; `compte: false`, `categorie: "arcade"` dans le jour, les vues et les groupes). **Golden, bancs Track et Jump : inchangés.** Nathan valide.
- **`categorieDepuis` est écrit à la main** dans la fiche (le lendemain de la fusion) quand le jeu a déjà des journées acquises : rien ne le déduit de la date de fusion. Tower, `off` et jamais compté, n'en a pas besoin. Un contrôle automatique est possible dans un lot suivant.
- **Un jeu d'arcade se classe à un score** (sa vue hors cumul est celle des jeux « hauteur ») ; un jeu d'arcade au temps n'est pas prévu.
- Le scénario « 1 fini sur 2 » de la demande : le joueur de démonstration a **Track en favori** (`DEMO_FAVORIS`), donc `/?demo=joueur` affiche « 1 fini sur 1 » (Jump sous « Les autres jeux », Tower sous « Arcade »). Je n'ai pas touché au joueur de démonstration.
- Budget du portail (B1) : `portail.premier` 35 485 o pour 38 Ko de plafond (+292 o) ; le tableau de `budgets.md` (pose du lot B1) n'est pas modifié.
- Vérifié en local : `npm run verifier` tout vert (typecheck, unitaires SQLite et libSQL, constructions, e2e Track / Jump / Tower / Cibles, budgets) et `npm run consignes`. Pas de capture regardée ; la CI de la PR reste à voir.

## Pour les joueurs
- [Du Jour] Tower rejoint la nouvelle section Arcade : il garde son classement, sans compter dans la journée. // Tower moves to the new Arcade section: it keeps its leaderboard, outside the daily streak.
