# `packages/profile` (`@cdj/profile`) : le profil commun à tous les jeux, côté client

Chargé quand on lit un fichier de `packages/profile`. **Zone partagée** (un seul propriétaire à la fois ; un lot n'y touche que si son prompt le dit). Créé au lot P0 de la plateforme (`docs/plateforme/lots/lot-P0-socle.md`) en extrayant d'`apps/web` (lot 30 de DailyTrack) le code d'identité, **sans le changer**. Vision : `docs/plateforme/seed-phase-2.md` (ne pas modifier). Règles du serveur et de la plateforme : `apps/api/CLAUDE.md` (« Plateforme (lot P0) », « Profil (lot 30) »).

## Ce que contient le module
- `identity.ts` — clés de la plateforme (`PLATFORM_PREFIX` = `cdj:`, `PLAYER_KEY` `cdj:player`, `NAME_KEY` `cdj:name`, `NEXT_KEY` `cdj:player:next`, `NOTICE_PREFIX` `cdj:notice:`), `createIdentity(stockage)` (lecture et création de l'identifiant secret de 128 bits, pseudo, « Changer mon code » en cours), `readIdentity` (existe-t-elle, et son pseudo, **sans rien créer** : `__jump.profile`), `writeIdentity` (code chargé), `readPlayerId`, `isValidName` / `normalizeName` (miroir de `cleanName` du serveur), `keysWith`.
- `transfer.ts` — code de transfert **`CDJ2.<identifiant : 32 hexadécimaux>.<CRC-32 sur 8 hexadécimaux>`** (46 caractères) : `encodeTransfer`, `decodeTransfer(code, legacy?)`, `crc32`. Les anciens codes `CDJ1` (records de DailyTrack) se lisent dans DailyTrack (`apps/web/src/transfer.ts`), passés en `legacy`.
- `client.ts` — `call` (délai de 8 s, erreurs traduites, corps vide = panne réseau, `suggestions` de pseudo gardées), `ProfileClient` : `GET /api/me`, `GET /api/name`, `PUT /api/player`, `POST /api/me/code` ; `MeProfile`, `ApiResult`. L'identifiant secret voyage dans l'en-tête `X-Player-Id`.
- `sync.ts` — `ProfileSync<M>` (au plus une synchronisation par 30 s, une seule à la fois, adoption de `cdj:player:next` après un « Changer mon code » dont la réponse s'est perdue) ; la fusion est **celle du jeu** (`merge`), la part commune est `mergeName` (le pseudo du serveur gagne).
- `profile.ts` — `Profile` : `rename` (propriété du premier, suggestions, hors ligne), `changeCode` (rotation et révocation), `NAME_TAKEN_MESSAGE`.

## Invariants
- **Mêmes clés, même format, mêmes requêtes que DailyTrack avant le lot P0** : les clés `cdj:*` sont celles de la plateforme ; le format du code ne change pas ; les chemins, en-têtes et corps des requêtes non plus. **Le comportement de DailyTrack reste identique** (ses façades `identity.ts`, `transfer.ts`, `api.ts`, `profileSync.ts`, `online.ts` délèguent ici).
- **Aucun accès direct au stockage ni au réseau** : le stockage est injecté (le `gameStorage()` de chaque jeu, avec son préfixe physique `apercu:` dans un aperçu ; les deux jeux partagent l'origine, donc la même identité), `fetch` est injectable. Ni `localStorage`, ni `document`, ni `window`, ni `location` (test `purete.test.ts`).
- **Aucune logique de jeu** : le module n'importe aucun paquet (ni `@cdj/sim`, ni `@cdj/jump-sim`) ; les records, médailles et la fusion des temps sont au jeu.
- Un pseudo appartient à son premier propriétaire (serveur) ; le code se garde comme un mot de passe ; un code révoqué rend `410 code_revoked`.
- Textes en français. Une clé, un format ou une requête qui change = les deux jeux et le serveur ensemble, avec une migration.

## Tests
- `npx vitest run packages/profile` — `transfer.test.ts`, `client.test.ts`, `identity.test.ts` (bloc « pseudo »), `profile.test.ts` : **déplacés d'`apps/web/test` au lot P0, blocs identiques** (preuve : `bash packages/profile/tools/blocs-deplaces.sh`) ; `identity.test.ts` (identité injectée), `sync.test.ts` (service générique), `purete.test.ts` : propres au module.
- Restent dans `apps/web/test` (inchangés) : `profileSync.test.ts` (fusion des records de DailyTrack et service branché sur elle), les anciens codes `CDJ1` et `applyIdentity` (`transfer.test.ts`), `LeaderboardApi` (`api.test.ts`), les modes de fantôme (`online.test.ts`). e2e : `apps/web/e2e/profil.spec.ts`, `accueil.spec.ts` (DailyTrack), `apps/jump/e2e/smoke.spec.ts` (`__jump.profile`).
