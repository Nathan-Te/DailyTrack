# Lot 56 — Track : l'ambiance sonore des thèmes est retirée

Décision de Nathan (31/10/2026) : les ambiances des thèmes sont « horribles » ; après l'écoute d'une proposition de remplacement, **on supprime l'ambiance et on ne garde rien**. Ce lot ne contient donc que le retrait. Branche `claude/lot-56-ambiances-e1nwq4`. `packages/sim`, golden, rediffusions, classement : non touchés.

## Ce qui a été retiré
- Les **sept recettes de bruit filtré** du lot 23 (`AMBIENCE`, `AmbienceKind`, `ambienceFor`, `ambienceLevel` dans `audioLogic.ts`) et leur **construction en direct** (`buildAmbience`, `setAmbience`, `ambienceKind` dans `audio.ts`), les deux appels de `main.ts`.
- Le **curseur « Ambiance »** des Réglages et ses deux textes (fr + en).
- Le **bus « ambiance »** (`cdj:audio` n'a plus que le volume, le dernier volume, le moteur et les effets ; une ancienne valeur `ambience` enregistrée est ignorée sans erreur).
- Les tests de l'ancienne ambiance ; `test/ambiances.test.ts` échoue si un reste réapparaît.
- Aucun fichier sonore n'existait pour l'ambiance : tout était du code. Le moteur et les effets du lot 55 ne changent pas.

## Mesure (premier chargement, `node scripts/budgets.mjs`)
Voir `docs/plateforme/budgets.md` (lignes `track.jsCss`, `track.js`, `track.horsThree`, `track.anglais` mises à jour) : le premier chargement **diminue**, plafonds inchangés.

## Fichiers hors zone
`docs/plateforme/traductions.md` (régénéré : deux clés de moins). Rien d'autre.
