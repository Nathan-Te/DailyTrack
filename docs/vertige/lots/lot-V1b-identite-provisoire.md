# Lot V1b — « Vertige » : identité provisoire pour la recette

**État : prêt, PR en brouillon, jeu `off` (en production comme en recette tant que Nathan ne le passe pas `preview`).** Hors périmètre, non touché : la simulation, le rendu, le message d'erreur du panneau d'administration (`apps/portail`, zone partagée, traité par la conversation de la plateforme), le bouton « Mettre en production ».

## Pourquoi
Passer Vertige en `preview` depuis `/admin/` › Jeux ne faisait rien : le serveur refusait (`400 invalid_action`, règle K5, `apps/api/src/jeux.ts`) parce que le bloc `identite` de `config/jeux/vertige.json` valait « à choisir », et le panneau affiche pour ce code un texte générique qui ne dit pas pourquoi. Ce lot remplit une identité **provisoire** ; la définitive vient avec la passe artistique (V4).

## Livré
- **Maquette** `docs/vertige/maquettes/identite.html` (page autonome, polices du dépôt) : la cartouche de Vertige sur l'étagère du portail avec Track, Jump (cartes faites à la main : seuls leur nom et leur teinte sont figurés), Tower et Blocks (leurs vraies illustrations), en **3 variantes**, chacune avec la cartouche à sa taille, en petit (téléphone) et grossie ×3 : **A `quadrillage`** (le monde en blocs), **B `losanges`**, **C `lignes`**. Police « Rubik Mono One », teinte de la fiche (`#F7C59F` / `#8A3B12`). Les motifs sont calculés par la vraie fonction `fondDuMotif`, la cartouche suit `.salle-etiquette` du portail.
- **Illustrations** en SVG écrit en code : plateforme de pierre claire, tapis rouge, portail rose, nuages, cadre de pierre de travers (creux : le motif se voit à travers). Dessinées dans un cadre de 76 × 64 pour tenir dans les 45 % de largeur de la cartouche sans toucher le nom « VERTIGE ». Les trois sont dans la maquette (B et C en ligne) ; **la variante A est dans `apps/vertige/public/illustration.svg`**.
- **Variante A appliquée à la fiche** : `identite` = « Rubik Mono One », `quadrillage`, `apps/vertige/public/illustration.svg`, `aujourdhui: false`. `npm run fiches` : 7 fichiers générés changent (`fiches.generated.ts`, projections, feuilles du portail, `identites/vertige.generated.css`). `npm run fiches -- --verifier` : à jour.
- **Changer de variante, d'une ligne** : `identite.motif` dans la fiche (`losanges` ou `lignes`), copier l'illustration voulue (le SVG de la variante, dans la maquette) vers `apps/vertige/public/illustration.svg`, `npm run fiches`.
- **Consignes** : `docs/vertige/consignes.md`, « État » : identité provisoire, à refaire en V4 **avant tout passage en `on` en production**. `seed.md` non modifié.
- **Captures** : `docs/vertige/lots/images/lot-V1b-identite.png` (les trois variantes, 2 080 × 6 414).

## Critères d'arrêt
- **La fiche passe la règle K5, prouvé par un test** : `apps/api/test/vertigeIdentite.test.ts` — identité complète, projection serveur sans `identiteIncomplete`, puis `POST /api/admin/jeux/vertige/etat` vers `preview` accepté (200) et retour à `off` (200), sur **base locale** (SQLite et libSQL `file:`, jamais Turso). **Vérifié qu'il échoue avec l'ancienne fiche** (`400 invalid_action`) : il reproduit le défaut d'origine.
- **Poids** : `illustration.svg` 2 167 o brut, **563 o gzip** (Tower 282, Blocks 277, Rush 348 : plus riche, mais un fichier à part, chargé seulement par la cartouche du portail ; aucune ligne de budget ne le compte, règle K5). Premier chargement du jeu (`vertige.jsCss`, plafond 53 Ko) : la seule chose qui bouge est la feuille d'identité (motif et face de police, déjà dans le build), **+63 o gzip** mesurés en construisant Vertige avant / après (somme gzip des fichiers hors préfixes `aLaDemande` : 75 287 → 75 350 o, tout le dossier) ; marge du lot V1 : 3 074 o. `node scripts/budgets-controle.mjs controler` (via `npm run verifier`) vert. **Non mesuré** : la ligne `vertige.jsCss` par `node scripts/budgets.mjs`, qui exige que tous les jeux soient construits (je n'ai construit que Vertige).
- `npm run verifier -- --sans-e2e` : typecheck, portail, unitaires SQLite (131 fichiers) et libSQL (81), construction des jeux, budgets : **tout vert**. e2e de Vertige (4 specs, Chromium, 11 tests) : **verts**. La CI de la PR est à lire.

## Hors zone : une ligne dans un test partagé (à valider)
`packages/core/test/identite.test.ts` (zone partagée) : une identité complète oblige un jeu à fournir son panneau « Aujourd'hui » **ou** à s'inscrire à `AUJOURDHUI_EXEMPTES`. J'ai inscrit `vertige` avec la même raison que Blocks et Rush (« à fournir par la conversation du jeu »). Rien n'est affaibli : sans cette ligne, le test échoue (vérifié) ; l'alternative, `aujourdhui: true` sans panneau, aurait été fausse. Le nom de branche ne porte pas de jeu : le job `zones` traite la PR comme une PR de la plateforme.

## À tester (2 clics)
1. Ouvrir `docs/vertige/maquettes/identite.html` (ou la capture) et comparer A, B, C.
2. **Après fusion et déploiement de la recette** : panneau d'administration de la recette, rubrique Jeux, passer Vertige en `preview` : accepté, cartouche visible sur le portail de recette (avec la clé d'aperçu).

## Non vérifié, à regarder par Nathan
- **Le rendu dans le vrai portail** : je n'ai pas lancé le portail ni la recette ; la maquette recopie les règles de `.salle-etiquette` (marges à l'œil), pas son code. À la taille de la cartouche, l'illustration fait environ 70 × 60 px : lisible (cadre, portail rose, tapis, pierre) mais les détails fins (joints de pierre) sont petits.
- Le pied de la cartouche et le bouton « Jouer » de la maquette sont des figurants ; l'état « Bientôt » d'un jeu `off` n'est pas dessiné.
- **Décisions laissées à Nathan** : la variante (A appliquée, B et C prêtes) ; que Vertige reste sans panneau « Aujourd'hui » jusqu'à V4 ; l'illustration provisoire ne doit **pas** passer `on` en production (règle écrite dans les consignes, pas testée).

## Pour les joueurs
rien
