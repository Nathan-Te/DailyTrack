# Lot K5b — un refus d'identité incomplète, lisible et impossible à rater

Plateforme, panneau d'administration. Pour les joueurs : rien.

## Fait
- **Code `identite_incomplete` (400)** dans `apps/api/src/codesErreur.ts` (sens, `docs/plateforme/codes-erreur.md`, traduction `erreur.identite_incomplete` fr + en). `apps/api/src/jeux.ts` le lève à la place d'`invalid_action` pour la règle K5 ; `off` reste permis. Le corps porte `manque` (`["police", "motif", "illustration"]` selon la fiche) : aucune donnée de joueur.
- **Les champs qui manquent** : `projectionServeur.identiteIncomplete` (booléen) devient `identiteManque` (liste) dans `packages/core/src/fiche.ts` ; `npm run fiches` a réécrit `fiches.generated.ts` et `projections/serveur.json`.
- **Texte du panneau** (`TEXTES_ERREUR`, français seulement : outil de l'éditeur, pas de version anglaise) : la phrase demandée ; si `manque` est donné, « police, motif ou illustration » devient la liste réelle (seuls les trois noms connus sont repris).
- **Bandeau sur la ligne de l'action, pour toutes les actions confirmées** (`apps/portail/src/adminErreur.ts`, `ctx.refuser(e)`) : fiche du jeu, image, groupe, ligne de résultat d'un joueur, nouveautés, message, suppression d'un joueur. Bandeau d'erreur de la charte, `role="alert"`, focus, jusqu'à l'action suivante ; la fenêtre se ferme comme avant. Le 401 ramène à la connexion partout (avant : pas toujours). Les zones d'erreur lointaines d'Images et de Groupes sont retirées.
- **Consignes** : `apps/api/CLAUDE.md` (« Codes d'erreur »), `apps/portail/CLAUDE.md` (« Refus après confirmation »), `packages/core/CLAUDE.md` (nom de la projection).

## Tests
- `apps/api/test/jeuxIdentite.test.ts` (SQLite et libSQL) : `preview` et `on` refusés avec `manque`, `off` permis, jeu complet passe, état inchangé. Les fiches sont fixées par un `vi.mock` : le test ne dépend pas de l'identité réelle de Vertige.
- `apps/portail/test/admin.test.ts` (texte générique, avec champs, valeurs inconnues ignorées) ; `packages/core/test/identite.test.ts` (projection) ; `packages/ui/test/catalogues.test.ts` (code traduit fr + en) ; `docs/plateforme/traductions.md` régénéré.
- `apps/web/e2e/admin-panneau.spec.ts` (pas de nouveau spec, R13) : étape « Jeux » — refus simulé, bandeau dans la carte du jeu, `role="alert"`, focus, un seul bandeau, effacé par l'action suivante.
- Bancs de réponses : aucune réponse existante ne change (seule la réponse de ce refus change de code).

## Scénario pour Nathan
Capture (vrai serveur, Vertige, identité « à choisir ») : `docs/plateforme/lots/lot-K5b-captures/bandeau-identite-incomplete.png`.

## Limites
Le bandeau est posé d'après le dernier bouton cliqué hors dialogue (écouteur en capture) ; sans bouton retrouvé, il s'ouvre en tête du contenu. Les accents graves de la phrase demandée (`config/jeux/<id>.json`) s'affichent tels quels (texte brut).
