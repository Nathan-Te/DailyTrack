# Lot O1 — Un tableau de bord et des passations à jour

Branche `claude/tableau-passations-uq5xui`, PR brouillon. **Pour les joueurs : rien.** Aucun jeu ni serveur touché.

## Livré
- **`npm run tableau`** → `docs/tableau.md` (`-- --verifier` échoue s'il est périmé) : une ligne par jeu des fiches et une ligne « Plateforme » (catégorie, état de départ, premier jour, identité K5, dernier lot et sa date, passation à jour ou ⚠ « N lots depuis »), puis une section par zone avec « Où on en est », « Prochain lot », « Décisions en attente ». L'état de production et de recette n'est pas dans le dépôt : le tableau renvoie à `/admin/` › Jeux. Script `scripts/tableau.mjs`, test `apps/portail/test/tableau.test.ts`.
- **Forme commune des passations** : trois sections finales aux titres fixes (5 lignes · une ligne · liste ou « aucune »). `nouveau-jeu` les écrit, `--passation` les **conserve**. Ajoutées aux 5 passations existantes (Blocks, Gravity, Pinball, Rush, Vertige) et **créées** pour Track, Jump, Tower et la plateforme (qui n'en avaient pas).
- **Règle de fin de lot** : `CLAUDE.md` (une ligne) → `docs/regles/racine/tableau-et-passations.md` ; `creer-un-jeu.md` ; `docs/orchestration.md` § 12 quater (les conversations). Le job `zones` tolère `docs/tableau.md` **et `docs/tableau-dates.json`** ; la CI de PR lance le test du tableau dès qu'une passation ou un README de lot change.

## À savoir
- **Dates** : un README de lot n'a pas de date et git ne sert pas à un test (clone peu profond). `docs/tableau-dates.json` (produit par la commande, deux lignes de plus par lot) garde le jour où chaque README a été vu la première fois ; les lots d'avant O1 sont datés d'après l'historique git. Un conflit sur ces deux fichiers se résout en relançant `npm run tableau`.
- **Contenu des passations : repris des README des derniers lots, rien d'inventé** ; ce qui n'y est pas écrit dit « à compléter par la conversation du jeu » (prochain lot de tous les jeux, décisions de Track et Jump). Les « décisions » des jeux du kit viennent des README (GR7, PBR1, V3, BR-A2, T9, U6) : **certaines sont peut-être déjà tranchées**, chaque conversation les relit.
- Le gabarit de passation d'un jeu neuf devait rester sous 8 000 octets (test T1) : l'en-tête a été raccourci pour y faire entrer les trois sections (7 723 → < 8 000), seuil inchangé.
- **Décision laissée à Nathan** : Cibles (témoin) n'a pas de passation ; le tableau l'indique.

## Vérifié / non vérifié
Vérifié en local : `tableau.test.ts`, `nouveauJeu.test.ts`, `zonesJeu.test.ts`, `ciZones.test.ts`, `consignes.test.ts`, `npm run consignes`. **CI de la PR : voir la PR.** Non vérifié : le rendu de `docs/tableau.md` sur téléphone (un coup d'œil sur la PR suffit).
