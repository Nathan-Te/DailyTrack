# Lot PB0 (plateforme) — Création du jeu « Pinball »

Commande : `npm run nouveau-jeu -- --id pinball --nom "Pinball" --classement score --categorie arcade` (essai à blanc d'abord ; elle a lancé `npm run fiches`, le golden du jeu et `npm run traductions`).

## Livré
- Le squelette du générateur (copie de « Cibles ») : `apps/pinball`, `packages/pinball-sim`, `apps/api/{src,test,scripts}/pinball*`, `config/jeux/pinball.json`, et les lignes mécaniques des fichiers partagés. Seule autre retouche : `apps/portail/test/miseEnProduction.test.ts`, qui nomme les jeux en dur (3 listes, comme au lot GR0).
- `docs/pinball/seed.md` (le seed de Nathan, tel quel), `docs/pinball/maquettes/pinball-maquette-jouable.html`, `docs/pinball/passation-initiale.md`, et `docs/pinball/passation.md` générée avec le renvoi vers la passation initiale en tête (`--passation` le retire : à remettre).
- Fiche : `off`, `arcade`, classement `score`, étiquette lilas `#C9B6F2` / coque `#5B3FA0`, police d'étiquette Righteous, `identite.motif` = losanges.

## À savoir
- **Righteous n'est pas encore hébergée** (`packages/ui/polices/`) : le test `identite.test.ts` refuse `identite.police: "Righteous"` tant qu'elle ne l'est pas, et l'héberger sort des zones de Pinball. `identite.police` reste donc « à choisir » ; le premier lot du jeu héberge la police (procédure K5) et remplit l'illustration. `preview` est refusé d'ici là.
- **Thèmes** : K7 n'est pas fusionné ; la fiche garde ce que le générateur écrit (`clair`, `sombre`). Les quatre thèmes (`foire`, `ocean`, `espace`, `volcan`, noms FR et EN du prompt) sont à poser quand K7 sera là, ou par le premier lot. Le sac de thèmes commun exige au moins cinq thèmes (`themes.ts` du squelette).
- **Premier jour** : `2026-11-02` (valeur du générateur), à fixer par Nathan avant `preview`. **Plafond de budget** : `pinball.jsCss` garde les 48 Ko du modèle.

**Vérifié** : `fiches`, `traductions`, `consignes`, `typecheck`, tests de `core`, `ui`, `portail`, du jeu et de son serveur : verts en local. CI : voir la PR.

**Pour les joueurs** : rien
