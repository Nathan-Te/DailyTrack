# Lot R1 (plateforme) — L'environnement de recette

**Livré** : un serveur de recette séparé (service Cloud Run, base Turso, secrets à lui), une révision étiquetée par PR qui touche le serveur, l'aperçu de la branche branché dessus, la production (API **et** site) qui attend la validation de Nathan, et un stockage local propre aux aperçus. Rien ne change pour les joueurs tant que le guide n'est pas suivi.

## Le flux

```
PR (branche du dépôt, touche le serveur)          fusion dans main
  │ recette.yml                                     │ production.yml
  ├─ image → révision b-<branche>-<empreinte>       ├─ changes : le serveur est-il touché ? (SERVER_PATHS)
  │   SANS trafic sur cdj-api-recette               ├─ recette : révision par défaut de la recette mise à jour
  ├─ /api/health + npm run smoke                    │            (/api/health + npm run smoke)
  ├─ commentaire « Recette » sur la PR              ├─ ⏸ validation de Nathan (environnement `production`,
  └─ Pages reconstruit l'aperçu /b/<branche>/       │    un clic pour les deux jobs suivants)
       VITE_API_URL = la révision (sinon la recette ├─ api : Cloud Run de production (ENVIRONMENT=production)
       par défaut), jamais la production ;          └─ pages : site publié depuis main (VITE_STORAGE=production)
       stockage apercu:*                           PR fermée : étiquette retirée (recette.yml, cleanup)
```

Fichiers : `.github/workflows/{recette,production,deploy-api,pages}.yml`, `scripts/recette.mjs` (étiquette, dossier d'aperçu, adresse, `SERVER_PATHS` : partagés par les workflows), `apps/api/src/config.ts` (`ENVIRONMENT`, règle des noms de base, `recetteSeedTarget`), `apps/api/scripts/recette-seed.ts` (`npm run recette:seed`), `apps/{web,jump}/src/storage.ts` (seul point d'accès au stockage), `docs/plateforme/{consignes,recette}.md`.

## Ce que Nathan doit faire
Suivre `docs/plateforme/recette.md` : ≈ **45 minutes**, une fois, coût visé **0 €** (recette à 0 instance au repos, 1 au plus ; base Turso gratuite ; validation gratuite, le dépôt est public). Étapes 0 à 7 **avant** de fusionner cette PR (elle se vérifie elle-même sur la recette), 8 et 9 après.

## Vérifier que tout marche (une fois le guide suivi)
1. Re-run du workflow **Recette** de cette PR : commentaire « Recette » avec `https://b-…---cdj-api-recette-…`, `/api/health` à `ok`, essai de bout en bout réussi.
2. Ouvrir l'aperçu : classement avec les pilotes « Démo » (`recette:seed`), un tour classé **sur la recette**, profil neuf ; le vrai jeu n'a pas bougé.
3. Fusionner : workflow **Production** → recette → « Waiting for review » → un clic → API et site partis ensemble.

## Le stockage partagé, avant / après
- **Avant** : les aperçus (`/b/<branche>/`) et le jeu publié partagent l'origine `nathan-te.github.io`, donc `localStorage`. Un tour sur un aperçu écrivait dans les clés de la production : identité (`cdj:player`, `cdj:name` : c'était la même identité), records (`cdj:best:<circuit>`, y compris des circuits d'essai, de thème forcé ou d'autres versions de générateur), places vues (`cdj:rank:*`), réglages, caméra, son, aide ; pour DailyJump, historique et série (`jump:historique`), mémoire des niveaux (`jump:jour:*`, `jump:meilleur:*`, `jump:vies:*`, `jump:morts:*`), réglages.
- **Après** : `VITE_STORAGE` est fixée à la construction. main : clés inchangées (`gameStorage()` rend `localStorage` lui-même, aucune migration). Aperçu et serveur de développement : `apercu:cdj:*` et `apercu:jump:*`, les clés de la production sont invisibles et jamais modifiées. `vite build` sans variable (tests e2e, CI) : clés de la production, pour que les e2e portent sur elles. Une valeur inconnue donne le préfixe (jamais la production). Contrôle dans `pages.yml` : le préfixe voulu est bien dans les fichiers publiés.
- **Ce que Nathan a pu écrire en production depuis des aperçus, et le nettoyer** : DailyTrack — rien à faire pour le profil : depuis le lot 30, le serveur fait foi (un record d'aperçu pour le circuit d'un jour était une vraie course, rejouée par le serveur s'il a été envoyé) ; seuls les « jours joués » de la carte du profil peuvent compter des jours d'essai (`?day=`, thèmes forcés). DailyJump — l'historique et la série peuvent contenir des jours joués sur un aperçu. Pour nettoyer, sur `https://nathan-te.github.io/DailyTrack/` puis `…/jump/`, console du navigateur (F12) : `Object.keys(localStorage).sort()` pour voir ; **copier d'abord son code de transfert** (Réglages › Profil), puis au besoin `localStorage.removeItem("jump:historique")` (DailyJump repart d'un historique vide) ou, tout DailyJump : `Object.keys(localStorage).filter(k => k.startsWith("jump:")).forEach(k => localStorage.removeItem(k))`. Ne pas supprimer `cdj:player` sans avoir le code. Les anciennes données d'aperçu restent sous les clés de la production (aucune migration) ; les aperçus repartent de zéro.
- **Non couvert** : le cache IndexedDB des miniatures (`cdj-thumbs`) reste partagé ; c'est un cache déterministe (clé = circuit + versions), sans donnée de joueur.

## Vérifié
- `npm run typecheck`, `npm test` (projets `sqlite` : 111 fichiers, 1 757 tests ; `libsql` : 9 fichiers, 179 tests) : verts. Ajoutés : `apps/api/test/recette.test.ts` (config et étiquette, 21 tests), `apps/web/test/storage.test.ts`, `apps/jump/test/storage.test.ts` (préfixe, stockage préfixé, **aucun appel direct à `localStorage` hors du point d'accès**). Aucun test existant modifié ; golden des deux jeux inchangés (ni `sim`, ni `jump-sim`, ni versions touchés).
- Serveur construit (`dist/server.mjs`) : refuse `ENVIRONMENT=recette` sur `dailytrack-misterzcool`, la production sur `dailytrack-recette-…`, `SALON_MINUTES` en production ; démarre en recette (`NODE_ENV=production`, horloge de test) et passe `npm run smoke` en entier.
- `recette:seed` : refuse sans `ENVIRONMENT=recette`, sur une base sans « recette », avec `ENVIRONMENT=production` ; sur une base de recette locale, 2 jours = 21 temps rejoués par `createApi` en 2 s ; relancé, aucun doublon.
- Workflows : `actionlint` 1.7.7 + `shellcheck` 0.11 sans erreur (remarques de style seulement) ; étapes de configuration **simulées sans secrets** (script qui exécute le `run` de l'étape) : recette et production non configurées → sautées avec leur message, base mal branchée → erreur claire, aperçu sans recette → sans serveur, aperçu visant la production → refusé, plan d'une PR de fork → rien. Constructions `VITE_STORAGE=apercu|production` des deux jeux contrôlées par l'étape de `pages.yml`.

## Non vérifié
- Rien n'a tourné sur Google Cloud, Turso ni dans un vrai run GitHub configuré (un agent n'en a pas les droits) : `gcloud run deploy --tag --no-traffic`, l'adresse de révision (`https://<étiquette>---<hôte>`, contrôlée par le workflow qui prévient si elle diffère), `update-traffic`, `--remove-tags`, la relance de Pages par `workflow_dispatch` depuis un run, **un seul clic pour deux jobs du même environnement** (comportement documenté de GitHub, à constater à l'étape 8), le commentaire sur la PR.
- Les nouvelles étapes du job `api-image` (`ci.yml` : image en recette refusée sur une base sans « recette », horloge de test, essai de bout en bout via `recette.local` → `host-gateway`) : pas de Docker ici, elles tournent pour la première fois dans la CI de cette PR.
- Les e2e Playwright n'ont pas été lancés ici (la CI de la PR les lance) ; le jeu construit sans variable garde les clés de la production, ils portent donc sur le même stockage qu'avant.

## Décisions pour Nathan
- **Branche par défaut** du dépôt = `ccr-9cb88ba0-62npko` : à remettre sur `main` (guide, étape 0). Sinon « Run workflow » n'apparaît pas pour les nouveaux workflows et **le run de nuit de la CI tourne sur cette branche-là, pas sur `main`**.
- **Une seule approbation** pour l'API et le site (les deux jobs attendent ensemble l'environnement `production`) ; le site n'est plus publié directement par une poussée sur main mais par `production.yml` (sinon le refondre en deux workflows aurait demandé deux clics). Les aperçus ne sont pas bloqués : un groupe de concurrence par branche, et la publication réessaie si `gh-pages` a bougé.
- **Même projet Google Cloud**, mêmes comptes de déploiement et fédération ; dépôt d'images, compte d'exécution, secrets, service et base **propres à la recette**. Durcissement possible (compte de déploiement réservé à la recette, `cdj-deploy` réservé à l'environnement `production`) : guide, étape 3.
- `SALON_MINUTES` et `TEST_CLOCK_OFFSET_MS` en recette : par « Run workflow » de `recette.yml` sur une branche, pas à chaque PR (l'essai de bout en bout vérifie un Salon de durée normale).
- `packages/profile/**` est dans `SERVER_PATHS` pour le futur module de profil : le lot P0 corrige le chemin s'il en prend un autre (deux listes, un test les compare).
- `preview.yml` (Cloudflare, inactif) visait l'adresse de **production** : il vise maintenant `RECETTE_API_URL`, avec `VITE_STORAGE=apercu`.
