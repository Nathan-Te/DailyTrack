# Lot B0 — création du jeu « Blocks » (plateforme, court)

Commande : `npm run nouveau-jeu -- --id blocks --nom "Blocks" --classement score --categorie arcade` (53 fichiers créés, 9 fichiers partagés avec des lignes mécaniques, puis `fiches`, `golden:blocks`, `traductions`).

## Livré
- Fiche `config/jeux/blocks.json` : `off`, `categorie: arcade`, `cumul: false`, ordre 5. Seed de Nathan versé tel quel (`docs/blocks/seed.md`) ; `passation.md` et `consignes.md` générés ; aucun `CLAUDE.md` modifié.
- **À fixer par Nathan** : teinte provisoire (`#B8D8F4` / `#1F4E79`), plafond `blocks.jsCss` (45 Ko, celui du modèle), premier jour (`2026-11-02`, avant `preview`).

## Correctif après la première CI (rouge)
Trois tests nommaient les jeux un par un : `miseEnProduction.test.ts`, `fiches.test.ts` et `routesChaudes` (la mesure de `rate` grossissait avec chaque route : `DELETE FROM rate` avant chaque route, plafonds inchangés). **Le dernier touche la garde R14 (zone partagée) : à valider par Nathan.**

## Plafond des lignes parcourues (décision de Nathan : option A)
`routesChaudes` « portail classement (cumul) » monte de 3 lignes par jeu (12 à 5 fiches, 15 à 6 ; trois requêtes : `jeux`, `planning`, `jump_levels`). Plafond `7 + N` → `3 × N` (15 et 18). Il cassait au 6ᵉ jeu, quel qu'il soit.

## Vérifié / non vérifié
- Local : `fiches` et `traductions` à jour, typage vert, tests de Blocks (63), `miseEnProduction`, `fiches`, `routesChaudes` verts. Run complet `--project sqlite` : 467 fichiers, 6597 tests verts. CI : à relire après cette poussée (le jeu fictif à 6 fiches n'est pas rejoué en local).
- La phrase de `passation.md` « seed à écrire par Nathan » est du texte fixe du générateur, périmée.

Pour les joueurs : rien.
