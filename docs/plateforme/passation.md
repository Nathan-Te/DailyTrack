# Passation — Plateforme

> À coller dans une nouvelle conversation d'orchestration de la plateforme, avec `CLAUDE.md` (règles communes) et `docs/plateforme/synthese.md` (état d'ensemble). Trois sections finales aux titres fixes, lues par `npm run tableau` (`docs/tableau.md`) : **tout lot de la zone les met à jour, puis lance `npm run tableau`**.

## Où on en est
- Plateforme (portail, serveur `apps/api`, socle, kit, recette, production) ; dernier README de lot : PA1b (21/11), le jeu Party du jour (tour de rôle calculé du jour, seul le jeu du jour classé, section « Party » du portail, mentions) ; avant : PA1 (partie 1, 21/11), la catégorie `party` ; puis : O1 (20/11), le tableau de bord `docs/tableau.md` ; U6 (18/11), un seul format de classement.
- L'état d'ensemble est dans `docs/plateforme/synthese.md` et `docs/orchestration.md` ; les jeux ont chacun leur passation (`docs/<jeu>/passation.md`) et `docs/tableau.md` les rassemble.
- Repris le 20/11 (lot O1) des README de lots et des CLAUDE.md ; à compléter par la conversation de la plateforme.

## Prochain lot
PA2, « Pile poil » (`docs/party/seed.md`), le premier vrai jeu Party : il rend visibles la section « Party » et l'onglet, que l'aperçu d'une PR ne montre pas tant qu'aucun jeu Party n'existe au registre (le lot PA1b ne les prouve que sur le jeu fictif de la CI). Puis le lobby (étape 2 du seed) et les médailles des jeux Party.

## Décisions en attente
- Nathan : relever le plafond `portail.classement` de 57 à 60 Ko (proposé par U6, marge de 711 o ; `docs/plateforme/budgets.md` n'est pas modifié).
- Plateforme (U6) : porter les seuils des médailles sur un jour passé est un petit lot serveur, si Nathan veut les seuils partout.
- Nathan (seed Party, « Encore ouvert ») : tranché le 21/11 (tour de rôle dans l'ordre des jeux `on` par date d'ouverture, record sur l'appareil, police `Lilita One`, motif `confettis`) ; restent le nom et la couleur de la catégorie à l'écran (« Party » pour l'instant) et les jeux suivants.
