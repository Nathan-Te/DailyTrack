# Lot B0 — création du jeu « Blocks » (plateforme, court)

Commande : `npm run nouveau-jeu -- --id blocks --nom "Blocks" --classement score --categorie arcade` (53 fichiers créés, 9 fichiers partagés avec des lignes mécaniques, puis `fiches`, `golden:blocks`, `traductions`).

## Livré
- Fiche `config/jeux/blocks.json` : `off`, `categorie: arcade`, `cumul: false`, ordre 5. Seed de Nathan versé tel quel (`docs/blocks/seed.md`) ; `passation.md` et `consignes.md` générés ; aucun `CLAUDE.md` modifié.
- **À fixer par Nathan** : teinte provisoire (`#B8D8F4` / `#1F4E79`), plafond `blocks.jsCss` (45 Ko, celui du modèle), premier jour (`2026-11-02`, avant `preview`).

## Correctif après la première CI (rouge)
Trois tests nommaient les jeux un par un : `miseEnProduction.test.ts`, `fiches.test.ts` et `routesChaudes` (la mesure de `rate` grossissait avec chaque route : `DELETE FROM rate` avant chaque route, plafonds inchangés). **Le dernier touche la garde R14 (zone partagée) : à valider par Nathan.**

## Reste rouge : « jeu fictif (2/3) » — décision de Nathan
`routesChaudes` « portail classement (cumul) » : 15 lignes parcourues pour un plafond de 13, dans la copie à **6 fiches** (les 5 du dépôt + `essai`). Sur les 5 fiches du dépôt : 12 pour 12, donc vert à ras. Trois requêtes (`jeux`, `planning`, `jump_levels`) comptent chacune autant de lignes que de jeux : la mesure monte de 3 par jeu, le plafond `7 + nombre de fiches` de 1. Tout 5ᵉ jeu réel l'aurait fait casser. Je n'ai pas relevé le plafond sans toi ; options : plafond à 3 par jeu (`3 × (N − 1)` mesuré) ou corriger le comptage (`src/comptage.ts`, delta de `sqlite_stmt`).

## Vérifié / non vérifié
- Local : `fiches` et `traductions` à jour, typage vert, tests de Blocks (63), `miseEnProduction`, `fiches`, `routesChaudes` verts. Run complet `--project sqlite` : 467 fichiers, 6597 tests verts. CI : tout vert sauf le point ci-dessus.
- La phrase de `passation.md` « seed à écrire par Nathan » est du texte fixe du générateur, périmée.

Pour les joueurs : rien.
