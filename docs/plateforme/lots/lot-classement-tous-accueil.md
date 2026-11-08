# Lot de plateforme — « Classement du jour » : l'aperçu de « Tous » à l'accueil

Demande de Nathan (08/11/2026, constat sur la recette) : dans le bloc « Classement du jour » de l'accueil, « Amis » montre une liste, « Tous » n'avait que « 21e sur 45 » et un lien. Il faut **un aperçu de « Tous » aussi**.

## Livré
- **Serveur** (`apps/api/src/portail.ts`) : `GET /api/portail/jour` porte `joueur.classementTous` (`{ sur, top[≤ 3], moi | null }`, **les mêmes lignes que `classementAmis`**, `null` tant que personne n'a fini un jeu). Les 3 premiers viennent du cumul du classement gardé (celui de `/classement/`). **Aucune requête de plus par visite** : leurs pseudos sont lus une fois par entrée gardée (`nomsDe`, clé `#accueil`, factorisé avec la page `/classement/`), donc une lecture sur clés primaires par fenêtre de 45 s et par instance. `corps` (la ligne) est commun aux deux classements.
- **Portail** : `panneauClassement` (`apps/portail/src/portail.ts`) montre, dans « Tous », la liste (`#classement-tous-liste`, `ligneAmis`) puis la place gardée (`#classement-tous-texte`, « 21e sur 45 ») ; ta ligne (moutarde) est ajoutée si tu n'es pas dans les 3 premiers. `.salle-vue` (une règle de `salle.css`). Le cache de l'accueil du navigateur ne garde pas `classementTous` (comme `classementAmis`) : il montre le texte seul, la réponse fraîche apporte la liste. Aucune clé de stockage nouvelle : les pages de mentions n'ont pas à changer.
- **Règles à jour** : `apps/api/CLAUDE.md` (champ), `docs/regles/api/portail-lot-i2.md`, `docs/regles/portail/la-salle-de-jeux-lot-u1.md`.

## Vérifié
- `tsc -b` ; `vitest` SQLite **et** libSQL : `amis.test.ts` (nouveau cas : 3 premiers, ta ligne dans le haut, ligne ajoutée hors du haut sans temps cumulé, joueur qui n'a rien fini, visiteur, aucun identifiant secret), `portail.test.ts`, `portailDemo.test.ts`, les trois bancs ; `vitest apps/portail` (36 fichiers, dont `construction.test.ts` : budgets).
- **Bancs de réponses : références réécrites (`UPDATE_BANC=1`), différence voulue et seule** : `classementTous` ajouté dans 12 réponses de `GET /api/portail/jour` (Jump 4, Tower 3, Track 5) ; comparé avant/après par script : tout le reste est identique.
- e2e `portail-jour.spec.ts`, `portail.spec.ts`, `amis.spec.ts` (20 passés, Chromium) ; `portail-jour.spec.ts` vérifie la liste de « Tous ».

## À décider (Nathan)
- Quand ta ligne est dans la liste, « 1er sur 1 » en dessous répète ton rang : gardé pour le total (« sur 45 »). Une clé « sur N classés » (fr + en) pourrait le remplacer.
- Non vérifié : le rendu sur la recette réelle (il faut la fusion).
