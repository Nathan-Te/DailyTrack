# Lot P — L'interrupteur des jeux

Branche `claude/game-state-toggle-4m4ix4`, PR brouillon. Consignes : `CLAUDE.md` racine (« Publication des jeux »), `apps/api/CLAUDE.md` (« Publication des jeux (lot P) »), marche à suivre de Nathan : `docs/mise-en-ligne.md`.
**Écart** : `docs/tower/cadrage.md` (« à déposer tel quel ») n'était pas dans le dépôt ni dans la demande ; le lot suit le prompt seul.

## Où vit l'interrupteur
Le lot N1 est fusionné : c'est la rubrique **Jeux** du panneau `/admin/` (derrière la session Google), `apps/portail/src/adminJeux.ts`. Pas de page à jeton.

## Les états, tels que construits
| État | Accueil, journée, série, partage, classement du jour | `/<jeu>/` | API du jeu |
|---|---|---|---|
| `off` (un jeu sans ligne en base aussi) | absent | « Bientôt » | `404 game_unavailable` |
| `preview` | absent | jouable avec la clé (bandeau « Aperçu »), sinon « Bientôt » | accepte avec la clé seulement ; l'envoi (`/api/submit`, `/api/jump/submit`) est rangé à part (`apercu = 1`, `hidden = 1`), les autres écritures sont refusées |
| `on` | présent ; compte dans la journée dès le premier jour entier | tous | normal |
Table `jeux` (état, `live_from`, périodes, empreinte de la clé), journal dans la même transaction que chaque changement, `GET /api/jeux` (`s-maxage=30`, lu en mémoire par instance 30 s). Track et Jump sont semés `on` par le schéma (sinon le déploiement les aurait cachés). Aperçus de PR (recette, jamais la production) : tous les jeux, badge « Brouillon », sans clé. Sans réseau : liste construite (`JEUX_PUBLICS`, seuls les jeux déjà publics).

## La clé d'aperçu
192 bits au hasard, **rendue une seule fois**, stockée en SHA-256 seulement ; en-tête `X-Preview-Key` (CORS autorisé), jamais l'adresse d'une requête : le lien `/<jeu>/?apercu=<clé>` la range dans `cdj:apercu:<jeu>` puis la retire (`history.replaceState`). Révocable ; une clé n'ouvre jamais un jeu `off`. Passer à `on` efface les résultats d'aperçu.

## `live_from` et les séries (tests à dates fixes : `packages/core/test/jeux.test.ts`, `apps/api/test/jeux.test.ts`)
Périodes `[du, au)` : activer ouvre demain (activation en cours de journée → ne compte qu'à partir du lendemain, mais visible et jouable) ; désactiver ferme demain (séries acquises intactes, rien supprimé) ; réactivé le jour même : aucun trou ; activé puis retiré le même jour : aucune période ; série à cheval : un jour fini seulement dans un jeu qui ne comptait pas encore n'en est pas un. `on` n'ajoute pas le jeu au classement cumulé (réglage à part, non créé).

## Vérifié / non vérifié
- Vérifié en local : `npm run typecheck`, tests unitaires SQLite **et** libSQL `file:` (jamais Turso) : trois états, jeu inconnu `off`, clé bonne / révoquée / absente / dans l'adresse, résultats d'aperçu absents des classements et effacés au passage `on`, `live_from` et séries, remise à zéro qui garde la table, journal sans clé ni adresse ; **un seul e2e** (`jeux-interrupteur.spec.ts`, ports 4198 / 8818) : Jump `off` › l'accueil et `/jump/` › `on`.
- Non vérifié : le panneau dans un navigateur (clics, fenêtres de confirmation, copie du lien) — aucun e2e dédié (règle R13), le code suit les autres rubriques ; Firebase Hosting réel (`X-Forwarded-Host` d'un aperçu de PR, cache de 30 s) ; le bandeau d'aperçu en vrai sur téléphone ; Turso.
- **Budgets** : Track +205 o sur le premier chargement (294 455 → 294 660 ; la lecture de l'état au démarrage) pour une marge de 57 o : **plafonds relevés de 200 / 100 / 200 o, à valider par Nathan** (`perf.spec.ts`, `budgets.md`). Jump +92 o (marge ample), portail +232 o (marge 302). `interrupteur-*` de Jump sort de la mesure (à la demande).
- **Scénario pour Nathan (2 clics)** : le panneau n'est pas utilisable sur l'aperçu d'une PR (adresse non autorisée chez Google) → **sur la recette après la fusion** : `/admin/` › Jeux › Jump › Off, recharger l'accueil (jusqu'à 60 s : cache de l'accueil) : Jump a disparu, `/jump/` dit « Bientôt » ; › On : il revient, résultats compris.
- Décision laissée à Nathan : la désactivation retire le jeu de l'accueil tout de suite, de la journée dès le lendemain ; le jour de la désactivation l'accueil et `aujourdhuiParfaite` peuvent diverger (une journée, rare).
- CI de la PR verte sur ba4823d (run 41033126903 : unitaires SQLite et libSQL, e2e-pr 4 parts, api-image). Deux rouges corrigés en route : le délai de 5 s des tests de journée en CI, et les specs qui comptent les requêtes (`GET /api/jeux` à l'ouverture d'un jeu).
