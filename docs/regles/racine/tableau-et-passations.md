# Le tableau de bord et les passations (lot O1)

> Règle de fin de lot, renvoyée par [`CLAUDE.md`](../../../CLAUDE.md) (« Fin de lot »). Décision de Nathan (20/11) : **le dépôt porte l'état** ; une conversation d'orchestration dure quelques lots, se ferme par une mise à jour de la passation, et la suivante repart de ce seul fichier ; une page unique dit où en est chaque jeu.

## La passation de chaque zone
- Une passation par zone à conversation : `docs/<jeu>/passation.md` (un jeu qui n'est pas un témoin) et `docs/plateforme/passation.md`. Celle d'un jeu du kit est écrite par `npm run nouveau-jeu` (sections 1 à 7, générées : on ne les retouche pas) ; celles de Track, Jump, Tower et de la plateforme sont écrites à la main.
- **Elle se termine par trois sections aux titres fixes** (le script les lit, `apps/portail/test/tableau.test.ts` les garde) :
  1. `## Où on en est` : **5 lignes au plus** (une puce par ligne) ;
  2. `## Prochain lot` : **une ligne** ;
  3. `## Décisions en attente` : une liste à puces (qui attend Nathan, d'après quel README), **ou « aucune »** seul.
- Ce qui n'est pas écrit quelque part ne s'invente pas : « à compléter par la conversation du jeu ».
- `npm run nouveau-jeu -- --id <id> --passation` réécrit les sections 1 à 7 et **conserve** ces trois sections.

## La règle de fin de lot
Tout lot, avant de s'arrêter : (1) met à jour les trois sections de la passation **de sa zone** ; (2) lance `npm run tableau` ; (3) commite `docs/tableau.md` et `docs/tableau-dates.json`. Le job `zones` tolère ces deux fichiers pour un lot de jeu. `npm run tableau -- --verifier` (et `apps/portail/test/tableau.test.ts`, lancé par la CI de PR dès qu'une passation, un README de lot ou le tableau change) échoue s'ils ne sont pas à jour.
- **Conflit** sur `docs/tableau.md` ou `docs/tableau-dates.json` en fusionnant `main` : ne pas les fusionner à la main, relancer `npm run tableau`.
- Le tableau avertit (« ⚠ N lots depuis ») quand des README de lots sont plus récents que la dernière mise à jour de la passation de la zone.

## Ce que le tableau lit, et d'où viennent les dates
- Une ligne par jeu des fiches (`config/jeux/*.json` : nom, catégorie, état de départ, premier jour, identité complète ou ce qui manque, règle K5) et une ligne « Plateforme » ; le dernier lot est le plus récent des `lot-*.md` de `docs/<jeu>/lots/` (Track : `docs/lots/`, plateforme : `docs/plateforme/lots/`).
- **L'état de la production et de la recette (`off`, `preview`, `on`) n'est pas dans le dépôt** : le tableau renvoie à `/admin/` › Jeux.
- **Dates** : un README de lot ne porte pas de date et git ne sert pas à un test (clone peu profond, commit pas encore fait). `docs/tableau-dates.json` garde donc le jour où `npm run tableau` a vu chaque README pour la première fois, et l'empreinte des trois sections de chaque passation avec le jour où elle a changé. Les lots d'avant le lot O1 sont datés d'après l'historique de git. Le fichier est produit par la commande, jamais à la main.

## Les conversations d'orchestration
Voir `docs/orchestration.md`, « Les conversations d'orchestration (lot O1) ».
