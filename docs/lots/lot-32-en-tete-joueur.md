# Lot 32 — Track : l'identifiant du joueur passe dans l'en-tête

Dette n° 1 de Track (passation du 21/10/2026, § 7). Avant le lot, DailyTrack envoyait l'identifiant secret du joueur dans l'adresse (`?player=<id>`) pour le classement du jour, le fantôme et le Salon : cet identifiant **est** l'identité du joueur, et une adresse finit dans les journaux de requêtes de Cloud Run (gardés 30 jours) et dans tout journal intermédiaire. Jump et le portail utilisaient déjà `X-Player-Id` (non journalisé). **Après le lot : plus aucune adresse de Track ne porte l'identifiant ; le serveur le lit dans l'en-tête sur toutes les routes de DailyTrack.**

Zones : `apps/web/**`, `apps/api/src/cdj.ts` et `salon.ts`, `apps/api/test/salon.test.ts`, `apps/api/scripts/measure-{salon,budget}.ts`, `docs/lots/**`, `docs/orchestration.md`, la ligne de Track de `budgets.md`. **Rien d'autre** (voir « Pour un lot de plateforme »).

## 1. Routes touchées

| Route | Avant | Après |
|---|---|---|
| `GET /api/day/<date>/leaderboard` | `?limit=&player=<id>` | `?limit=` + en-tête `X-Player-Id` |
| `GET /api/day/<date>/ghost` | `?kind=first\|ahead&player=<id>` | `?kind=` + en-tête (obligatoire pour `ahead` : 400 `invalid_player` sans lui, comme avant) |
| `POST /api/submit` | `playerId` dans le corps | en-tête `X-Player-Id` ; **le corps n'a plus d'identifiant** |
| `GET /api/salon/now` | `?player=<id>` | en-tête (un spectateur n'en envoie aucun : pas de présence, comme avant) |
| `GET /api/salon/<session>/board` | `?player=<id>&since=` | `?since=` + en-tête |
| `POST /api/salon/<session>/submit` | `playerId` dans le corps | en-tête ; plus d'identifiant dans le corps |
| `GET /api/salon/<session>/ghosts` | `?refs=` (aucun joueur) | inchangée : les fantômes se demandent par **référence publique** |

Déjà en en-tête avant le lot (inchangées) : `GET /api/me`, `GET /api/name`, `POST /api/me/code`, `GET /api/portail/jour`. `PUT /api/player` garde l'identifiant dans son **corps** (jamais dans l'adresse ; `@cdj/profile`, zone partagée, non touchée).

- **Client** (`apps/web/src`) : `asPlayer(playerId)` (`api.ts`, une seule définition) donne l'en-tête ; `LeaderboardApi` passe par `ProfileClient.call` (même chemin que le profil, déjà en en-tête) ; `HttpSalonApi` par `apiCall` (= `call` de `@cdj/profile`, qui prend déjà des en-têtes : **aucun changement du module commun**). Plus de `player=`, d'`encodeURIComponent` de l'identifiant ni de clé de cache qui le contienne (le jeu n'a aucun cache d'adresses). Le mode démo (`demo.ts`, `salonDemo.ts`) ne fait aucun appel réseau.
- **Serveur** (`cdj.ts`, `salon.ts`) : `playerOf(req, url, route)` lit **`X-Player-Id` d'abord**, sinon l'ancien `?player=` (transition) ; un identifiant mal formé, d'où qu'il vienne, reste refusé (400 `invalid_player`). Les envois lisent l'en-tête puis, à défaut, `body.playerId` (le corps n'est jamais dans une adresse ; garde les clients anciens et les outils `recette:seed`, `history:seed`, `smoke`). Quand l'en-tête et l'ancien paramètre sont tous deux présents, **l'en-tête désigne le joueur** et le paramètre n'est pas compté.
- **Codes d'erreur** : aucun nouveau (`invalid_player`, `no_ghost`… existants). Validation par rejeu, classements, Salon, golden, rediffusions : **inchangés** (aucune version).
- **CORS** : le serveur autorisait déjà `X-Player-Id` pour toutes les routes (`api.ts`, `Access-Control-Allow-Headers`) : **rien à changer côté plateforme**. En production le jeu appelle `/api/` sur sa propre origine (`VITE_API_URL=/`) : pas de CORS, donc pas de pré-vol. Seul un appel d'une autre origine (`?api=http://…`, essais locaux) ajoute un pré-vol par route, gardé 24 h (`Access-Control-Max-Age: 86400`).
- **Outils de mesure** (`measure-salon.ts`, `measure-budget.ts`) : passés à l'en-tête, pour qu'ils mesurent le chemin réel du jeu (`measure:salon` vérifié, sans erreur ; `measure:budget` demande un `sqld`, **non lancé**).

## 2. Transition de `?player=`, compteur et date de retrait

- L'ancien paramètre est **encore lu** pour les onglets restés ouverts avec l'ancien jeu (sans lui, leur classement et leur présence disparaîtraient jusqu'au rechargement).
- **Jamais journalisé** : aucune ligne de journal ne contient l'identifiant (les journaux structurés ne contiennent d'ailleurs jamais l'adresse demandée ; vérifié par un test qui rejoue toutes les routes, l'ancien paramètre, un identifiant mal formé et un 429, et cherche l'identifiant dans toutes les lignes). La seule trace : **une ligne** `paramètre ?player= encore utilisé (transition du lot 32)` avec `route` et `total`, **au plus toutes les 5 min par instance** (`LEGACY_LOG_MS`).
- **Compteur anonyme** : `legacyPlayerParam` `{ since, total, byRoute }` dans la réponse de `GET /api/admin/overview` (jeton d'admin ; par instance, remis à zéro au redémarrage de l'instance). Rien n'est retenu du joueur (ni identifiant, ni adresse).
- **Date de retrait proposée : 7 jours après la mise en production de ce lot** (ouverture publique le 23/10/2026 : si la production part le 22 ou le 23/10, retrait le 29 ou le 30/10/2026), **à condition que le compteur soit tombé à (presque) zéro**. **Retouche 32b** (à faire ce jour-là, courte) : retirer le `else` de `playerOf` (`cdj.ts`) et le compteur, retirer `body.playerId` des envois si plus aucun outil ne s'en sert, retirer les tests « transition » de `salon.test.ts`, mettre la page des mentions à jour (§ 4).
- **Limite assumée** : un onglet resté ouvert avec l'ancien jeu continue d'écrire l'identifiant dans **l'adresse**, donc dans le journal de requêtes de Cloud Run (hors de notre code), jusqu'à son rechargement ou à la retouche 32b. Et **les journaux déjà écrits gardent les anciennes adresses 30 jours** (purge possible dans Cloud Logging : décision d'exploitation de Nathan, § 6).

## 3. Budget (premier chargement de Track)

Mesuré avant (`main` à `2bd5b93`, après `npm run build`) et après, par `node scripts/budgets.mjs` (la méthode de `apps/web/e2e/perf.spec.ts`). Octets gzip :

| | avant | après | écart | budget | marge |
|---|---|---|---|---|---|
| JS + CSS (`track.jsCss`) | 283 480 | **283 440** | **−40** | 284 100 | 620 → **660** |
| JS (`track.js`) | 272 225 | 272 185 | −40 | 274 000 | 1 815 |
| hors three.js (`track.horsThree`) | 139 459 | 139 419 | −40 | 141 000 | 1 581 |
| catalogue anglais / fil du Salon / miniatures / polices | 7 245 / 27 372 / 25 385 / 139 604 | identiques | 0 | | |

Le changement allège (il ne grossit pas). `docs/plateforme/budgets.md` : lignes de Track mises à jour et section « Lot 32 ». `apps/portail/test/budgets.test.ts` (qui compare les **limites**) reste vert.

## 4. Pour un lot de plateforme (zones partagées, **non touchées ici**)

1. **Pages des mentions** (`apps/portail/mentions-legales/index.html`, la française qui fait foi, et `legal/index.html`) : la ligne sur le journal de Cloud Run dit aujourd'hui « adresse demandée — pour certaines lectures de DailyTrack, elle contient ton identifiant — ». **À retirer (« pour certaines lectures de DailyTrack, elle contient ton identifiant ») dans le lot qui suit la retouche 32b**, pas avant : jusqu'au retrait de `?player=`, un ancien onglet peut encore l'y mettre, et la phrase doit rester vraie (règle de fidélité du lot R5). Les journaux déjà écrits gardent la mention 30 jours après ce retrait (durée à dire ou à purger). Mettre à jour les deux pages dans le même lot (`apps/portail/test/mentions.test.ts` vérifie la parité).
2. **`apps/api/CLAUDE.md`** (hors de ma zone : `scripts/zones-jeu.mjs` ne le liste pas) — section DailyTrack, texte prêt à coller : « *Lot 32 : toutes les lectures et tous les envois de DailyTrack lisent l'identifiant du joueur dans l'en-tête `X-Player-Id` (`playerOf`, `cdj.ts` ; Salon : `kit.playerOf`), jamais dans l'adresse. Transition : l'ancien `?player=` reste lu quand l'en-tête manque, compté sans rien retenir (`legacyPlayerParam` de `/api/admin/overview`, une ligne de journal au plus toutes les 5 min : route et total, jamais l'identifiant), jusqu'à la retouche 32b (7 jours après la mise en production ; voir `docs/lots/lot-32-en-tete-joueur.md`). Les envois lisent l'en-tête puis `body.playerId`.* » La même rubrique de l'index du `CLAUDE.md` racine peut citer « Lot 32 ».
3. **Effacement / mentions** : aucune donnée gardée de plus ou de moins (aucune table, durée ni stockage ne change) : `docs/plateforme/effacement.md` et les constantes des mentions n'ont rien à changer.

## 5. Vérifié, et comment

- **Tests d'API** (`apps/api/test/salon.test.ts`, SQLite **et** libSQL) : l'en-tête accepté sur **chaque** route de Track (classement, fantôme `first` et `ahead`, Salon `now`/`board`, envoi du jour, envoi du Salon) ; l'ancien `?player=` encore accepté et compté route par route ; l'en-tête l'emporte sur le paramètre ; identifiant mal formé refusé en 400 ; **aucun identifiant dans les journaux produits** (le test échoue si on ajoute l'identifiant à la ligne de transition : essayé).
- **Tests de clients** (`apps/web/test/{api,salon,watch}.test.ts`) : adresses sans identifiant, en-tête présent, corps sans identifiant, spectateur du Salon sans rien.
- **e2e** `apps/web/e2e/adresses-joueur.spec.ts` (Chromium, vrai serveur lancé dans le spec sur le **port 8799**, réservé ; une ligne dans `durees.json`) : relève **toutes** les requêtes d'une course du jour (chargement, G ×2 = fantômes du premier et du joueur devant, envoi, classement), de l'ouverture du Salon (`now`, `board`, `ghosts`) et de « revoir le meilleur tour » (jour et Salon), et échoue si l'identifiant du joueur (ou de l'adversaire) ou `player=` apparaît dans une adresse ; il vérifie aussi que l'en-tête part sur chaque route (sinon le test passerait avec un jeu qui n'enverrait plus rien) et que les fantômes du Salon n'en portent aucun. **Il a bien échoué sur l'ancien client** (build de `main` : `…/leaderboard?limit=5&player=dfee…`) avant de passer sur le nouveau. `watch-serveur.spec.ts` vérifie en plus qu'un spectateur n'envoie **aucun** `X-Player-Id`.
- Lancés ici : `npm run typecheck` ; `npx vitest run --project sqlite` (**178 fichiers, 2 339 tests verts**) et `--project libsql` (**385 tests verts**) ; `adresses-joueur`, `watch-serveur`, `leaderboard` (3 tests), `salon-serveur` en local sur Chromium, verts. `measure:salon` (6 joueurs, 2 min) sans erreur.
- **À noter** : `salon-serveur.spec.ts` relancé *deux fois d'affilée* (`--repeat-each=2`) échoue à la seconde (mêmes pseudos sur le même serveur en mémoire : ce n'est pas un défaut du lot, le spec n'est pas fait pour `--repeat-each`) ; seul, il passe (6 min en rendu logiciel dans cet environnement).

## 6. Non vérifié, et décisions pour Nathan

- **Non vérifié** : la CI de la PR (voir le lien ci-dessous) ; Firefox et WebKit (le nouveau spec est Chromium seulement, comme les autres specs de ce type) ; le comportement derrière **Firebase Hosting** (le renvoi `/api/**` vers Cloud Run transmet-il `X-Player-Id` ? Jump et le portail en dépendent déjà en production, donc oui) ; `measure:budget` (demande `sqld`).
- **À décider** : (1) la **date de retrait** (7 jours après la mise en production, si le compteur est à zéro) et qui lance la retouche 32b ; (2) purger les **journaux Cloud Run déjà écrits** (qui contiennent d'anciennes adresses avec l'identifiant) ou les laisser expirer (30 jours) — c'est un réglage d'exploitation, hors du dépôt ; (3) le lot de plateforme du § 4 (mentions, `apps/api/CLAUDE.md`).
- **Mise en production** : rien de spécial (aucun schéma, aucune ressource). Les onglets ouverts avant la mise en production continuent de marcher (transition). Le serveur est déployé **avant** le site (flux de `production.yml`) : un nouveau client n'arrive donc jamais sur un ancien serveur ; **un retour arrière du serveur seul** (sans le site) casserait l'identification des joueurs du nouveau jeu — le retour arrière officiel (`retour-arriere.yml`) remet les deux.

## 7. Aperçu de la PR

(Lien ajouté sur la PR dès que l'aperçu est publié.)
