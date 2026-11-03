# Lot K4c — les réglages par défaut d'un jeu neuf (partie A faite) ; générateur et « Cibles » (partie B : arrêt propre, non commencée)

*3 novembre 2026. Conception : `docs/plateforme/kit-de-jeu.md`. Pour les joueurs : rien.*

**Résultat.** La **partie A** est faite et verte à elle seule. La **partie B** (`npm run nouveau-jeu`, « Cibles », le job « Kit de bout en bout », « Créer un jeu ») **n'est pas commencée** : arrêt propre prévu par le prompt. **Le but du kit (« un jeu neuf sans retouche hors de ses zones ») n'est donc pas atteint**, et `kit-de-jeu.md` ne le déclare pas terminé.

## Partie A — ce qui est fait, et la preuve
| Quoi | Où | Preuve |
|---|---|---|
| **Enveloppe de rediffusion commune** (format, versions, jour ou scénario, charge d'octets, refus codés, texte borné avant lecture) | `packages/core/src/enveloppe.ts` (`@cdj/core/enveloppe`) | `packages/core/test/enveloppe.test.ts` ; test de pureté de `core` vert. Les trois simulations existantes ne sont pas touchées. |
| **Table commune `resultats_jeu`** (seule table nouvelle ; `cle1`–`cle3` en croissant, un index) | `db.ts`, `plans.ts`, `remiseAZero.ts` ; deux pages de mentions (`data-tables="resultats_jeu"`, FR et EN) | migration réversible (`DROP TABLE`) ; `remiseAZero.test.ts`, `mentions.test.ts`, plans `EXPLAIN` de `openTestDb` (aucun `SCAN`) verts |
| **Adaptateur** `adaptateurResultatsJeu(code, colonnes de la fiche)` (1 à 3 colonnes, `signe: -1` pour un score ↓, clés inutilisées en `remplissage`) ; `AdaptateurTable.niveaux` devient **facultatif** (niveau du jour en mémoire de l'instance, pas de table de niveaux) | `jeux/adaptateur.ts`, `jeux/module.ts` | `jeuNeuf.test.ts` |
| **Contrat minimal** + **formateurs par défaut tirés de la fiche** + `definirJeuNeuf` | `jeux/defauts.ts` | un jeu jouet à **deux fiches de test** (`score ↓` : points puis octets ; `temps ↑` : ticks) passe de bout en bout : niveau du jour, envoi rejoué, classement, rang, égalités, refus codés, copies, profil, portail, aperçu rangé à part, « Changer mon code », effacement, remise à zéro, deux jeux séparés, jeu fermé = `404 game_unavailable` (21 tests, SQLite **et** libSQL) |
| **Fiche** : `donnees.tableCommune: "resultats_jeu"` (la liste `tables` peut être vide) | `packages/core/src/fiche.ts` | `fiches.test.ts` (accepté, autre valeur et table volée refusées) |
| **Kit, à la demande** : `records`, `envoi` (file hors ligne), `amis` (lecture pure) et `amisDom` (colle des amis et du groupe) | `packages/kit/src/` | `records.test.ts`, `envoi.test.ts`, `amis.test.ts` (16 tests) |

**Les trois bancs de réponses sont identiques** (Track, Jump, Tower : `apps/api/test/banc*.test.ts` verts avec toute la suite API, 1 679 tests sur SQLite et libSQL). Aucun golden, aucune version, aucun budget ne bouge (aucun jeu n'importe les nouvelles briques).

## Le contrat minimal d'un jeu neuf
`versions`, `niveauDuJour(jour)` (pure), `decoder`, `rejouer`, `score` (les colonnes de la fiche), `seuils` (Diamant, or, argent, bronze), `entrees` (texte canonique, base de l'empreinte anti-copie). **Aucun point d'extension obligatoire.** Facultatifs : `theme`, `empreinteAuteur`, `contenuPublic`, `mesures`, `ticksParSeconde`, `fantome`, `joursFiges`. Détail : `apps/api/CLAUDE.md`, « Un jeu neuf sur le module ».

## Ce qu'un jeu neuf obtient par défaut, et ce qu'il écrit
- **Obtient** : routes `info`, `day`, `submit`, `board` (+ fantôme réservé aux classés, `me`), ordre de validation, plafond de rejeux, copies, aperçu, effacement, remise à zéro, médailles par seuils, réponses de forme fixe, journal ; côté client records, file d'envoi hors ligne, colle des amis et du groupe.
- **Écrit** : simulation et générateur, rejeu, seuils, rendu, sensations, sons, contenu des écrans.

## Écarts et limites (dites, pas cachées)
- **File d'envoi et enquête D1** : le README de D1 n'est **pas fusionné** (PR 248 ouverte). La file suit donc le comportement de Tower, **sans** délai aligné sur le pire rejeu, message « envoi en cours » ni traitement « déjà enregistrée » : à ajouter quand D1 est fusionné (une seule classe, `packages/kit/src/envoi.ts`).
- **Amis côté serveur** : `amis.ts` (`MOTIFS_JEUX`, suggestions) et `classementAmis.ts` nomment encore Track, Jump et Tower ; le filtre `Amis` / `Mon groupe` n'est donc **pas encore servi** pour un jeu sur `resultats_jeu`. Le portail (`unite: "mm"` seulement) ne sait pas non plus afficher un score en `points`. Ce sont deux retouches de la partie B (jeu témoin).
- `amisDom.ts` : typée, **jamais jouée** hors navigateur.
- Le lien « Amis » du jeu jouet n'est pas essayé ; le test de bout en bout est celui du kit, pas encore un job de CI.
- K4b (chaîne de production) : non fusionné à ma connaissance ; aucun de ses fichiers n'est touché.

## Reste (partie B, un lot à part)
1. `npm run nouveau-jeu -- --id <id> [--classement temps|score] [--a-blanc]` (idempotent) : fiche (`off`), simulation, application, contrat serveur, tests, `docs/<id>/{seed,consignes,passation}.md`, entrées mécaniques, ligne de `budgets.md` à plafond provisoire.
2. « Cibles » (30 s, 8 × 6, 20 cibles, score ↓, bot du Diamant, jamais en production, `preview` sur la recette) et ses deux fiches de test.
3. Le job de CI « Kit de bout en bout » (génère un jeu `essai`, typage, fiche, zones, budgets, partie scriptée, Amis, Mon groupe, aperçu, effacement, remise à zéro, jour figé).
4. Amis et score en points côté serveur et portail (voir plus haut) ; « Créer un jeu » en 5 étapes dans `CLAUDE.md` et `docs/orchestration.md`.

## Vérifié / non vérifié
- **Vérifié en local** : `tsc -b`, tests de `core`, `kit`, `apps/api` (sqlite + libsql), mentions, remise à zéro.
- **CI de PR, 1er run** (https://github.com/Nathan-Te/DailyTrack/actions/runs/41653872380) : tout vert (scope, zones, Budgets, unit 4/4, api-image, e2e-pr 2/4, 3/4, 4/4) **sauf `e2e-pr (1/4)`** : `apps/web/e2e/profil.spec.ts:144` (« un record fait sur un appareil apparaît sur l'autre », Track, `#finish .online .rank` introuvable après 30 s). Zone que le lot ne touche pas (serveur de Track inchangé, bancs identiques) ; **le fichier entier passe en local, 7 tests sur 7, sans relance** (`npx playwright test e2e/profil.spec.ts --project=chromium --retries=0`, 2,3 min). Règle d'arrêt (1) : une seule relance (ce commit de rapport) ; si le test échoue encore, Nathan tranche.
- **Non vérifié** : aucun run en mode `main` forcé (la partie B n'existe pas, et ce lot ne touche ni workflow ni budget) ; `stabilite.yml`, `recette.yml` non lancés.
