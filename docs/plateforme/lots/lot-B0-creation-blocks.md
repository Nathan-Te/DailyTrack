# Lot B0 — création du jeu « Blocks » (plateforme, court)

Commande : `npm run nouveau-jeu -- --id blocks --nom "Blocks" --classement score --categorie arcade` (sortie complète : 53 fichiers créés, 9 fichiers partagés avec des lignes mécaniques, puis `npm run fiches`, `golden:blocks` et `npm run traductions`).

## Livré
- Fiche `config/jeux/blocks.json` : état `off`, `categorie: arcade`, `classement.cumul: false`, ordre 5. Projections et `*.generated.*` régénérés.
- Seed de Nathan versé tel quel dans `docs/blocks/seed.md` (octet pour octet, `cmp` identique au fichier reçu).
- Teinte provisoire du générateur (`#B8D8F4` / `#1F4E79`) : **à choisir par Nathan** (Blocks reprendra la DA de Tower).
- Plafond de budget provisoire : ligne `blocks.jsCss` de `budgets.md` = celle du modèle (45 Ko) ; à fixer avec la mesure du jeu.
- Premier jour : `2026-11-02` (celui du modèle) ; **à fixer par Nathan avant `preview`**.
- `docs/blocks/passation.md` et `consignes.md` générés. Aucun `CLAUDE.md` modifié par moi.

## Vérifié en local
`npm run fiches -- --verifier` et `npm run traductions -- --verifier` à jour ; `npm run typecheck` vert ; Vitest (sim, app, API de Blocks) : 6 fichiers, 63 tests verts.

## Non vérifié / à décider
- La phrase de `passation.md` qui dit « seed à écrire par Nathan » est du texte fixe du générateur (régénérée, inchangée) : elle est périmée mais je ne retouche pas un fichier généré.
- CI de la PR (« Kit de bout en bout » compris) : à lire sur la PR ; e2e Chromium non lancés en local.

Pour les joueurs : rien.
