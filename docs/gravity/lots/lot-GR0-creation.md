# Lot GR0 (plateforme) — Création du jeu « Gravity »

Commande : `npm run nouveau-jeu -- --id gravity --nom "Gravity" --classement score --categorie arcade` (essai à blanc d'abord, puis pour de bon ; il a lancé `npm run fiches`, le golden du jeu et `npm run traductions`).

## Livré
- Le squelette du générateur (copie de « Cibles ») : `apps/gravity`, `packages/gravity-sim`, `apps/api/{src,test,scripts}/gravity*`, fiche `config/jeux/gravity.json`, et les lignes mécaniques des fichiers partagés (Dockerfile, tsconfig, verrou, catalogues, `CLAUDE.md` racine, `budgets.md`). Seule autre retouche : `apps/portail/test/miseEnProduction.test.ts`, qui nomme les jeux en dur (3 listes, comme au lot V0 de Vertige) ; le jeu reste le squelette.
- `docs/gravity/seed.md` : le seed de Nathan, tel quel. `docs/gravity/maquettes/gravity-maquette-jouable.html` : la maquette jouable.
- Fiche : état `off`, catégorie `arcade`, classement `score`, étiquette corail `#FFB892` / coque `#C9622E`, police Lilita One (étiquette et `identite.police`). `identite.motif` et `identite.illustration` restent « à choisir » : `preview` est refusé jusqu'au premier lot du jeu.
- `docs/gravity/passation.md` générée, avec en tête le renvoi vers `docs/gravity/passation-initiale.md` (la passation jointe, versée telle quelle).

## À faire par Nathan
- `--passation` réécrit `passation.md` et retire le renvoi vers `passation-initiale.md` (à remettre).
- **Premier jour** : `premierJour` vaut `2026-11-02` (valeur du générateur), à fixer avant `preview`.
- **Plafond de budget** : `gravity.jsCss` garde les 48 Ko du modèle, à fixer avec la mesure du jeu.
- Les étiquettes `classement` de la fiche (`touches`, `dernier`) sont celles du squelette ; le premier lot du jeu les remplace.
**Vérifié** : `npm run fiches -- --verifier`, `npm run traductions -- --verifier`, `npm run consignes`, `npm run typecheck` : verts en local. `npm run verifier` et la CI de la PR (« Kit de bout en bout » compris) : voir le rapport de la PR.

**Pour les joueurs** : rien
