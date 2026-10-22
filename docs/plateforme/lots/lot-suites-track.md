# Lot de plateforme — suites des lots 32 à 36 de Track

Branche `claude/laughing-fermat-z6xw2r`, partie de `main` à `1842813` (lot 36 fusionné). Les lots 32 à 36 de Track ont chacun signalé un point hors de leurs zones ; ce lot les règle sans toucher au jeu (`apps/web/src/**`, `packages/sim/src/**`, `apps/api/src/cdj.ts`, `salon.ts` : intouchés ; seul `apps/web/e2e/perf.spec.ts` change, pour la mesure).

## 1. Une seule mesure du premier chargement

- `mesureTrack` de `scripts/budgets.mjs` (exportée) suit le **graphe statique de `index.html`** (script d'entrée, `modulepreload`, feuilles, imports statiques de proche en proche : `graphePremierChargement`). `apps/web/e2e/perf.spec.ts` l'**importe** : plus de copie. `admin-*.js` n'est plus compté (ligne à part, plafond propre).
- Test sur un petit `dist` factice (aucune construction) : `apps/portail/test/mesureTrack.test.ts` — un morceau chargé par `import()` (même au nom inconnu) et `admin-*.js` ne comptent pas, un import statique ajouté à l'entrée compte (et le même fichier chargé par `import()` non), un cycle est suivi sans boucle.
- Aucun workflow ni test de la CI n'appelle `budgets.mjs` en dehors de ces deux-là ; `npm run measure:budget` est une autre mesure (le coût de l'API sur Turso). `apps/portail/test/budgets.test.ts` lit les limites dans `perf.spec.ts` (adaptées : fil du Salon, nouvelle ligne `track.admin`).

### Mesure avant / après (octets compressés, `npm run build && node scripts/budgets.mjs`, `main` à `1842813`)

| | Ancienne méthode de `budgets.mjs` (tout `dist/assets` moins 4 préfixes) | Méthode du lot 36 (graphe + page d'admin) | **Mesure unique** (graphe, admin à part) |
|---|---|---|---|
| JS | 283 438 | 254 268 | **243 386** |
| CSS | 11 412 | 11 412 | **11 412** |
| JS + CSS | **294 850** | 265 680 | **254 798** |
| JS hors three.js | 150 672 | 121 502 | **110 620** |
| page d'admin | (comptée) | 10 882 (comptée) | **10 882 (à part)** |

Les 29 ko d'écart de l'ancienne méthode : les morceaux à la demande du lot 36 (`verify-*.js`, scénarios, démo, Salon, générateur) qu'elle comptait à tort, plus la page d'admin. **Le chiffre est le même dans `node scripts/budgets.mjs` et dans `perf.spec.ts`** (une seule fonction ; le test écrit « premier chargement : JS 243386 + CSS 11412 = 254798 o » dans ses annotations).

## 2. Budgets de Track (décisions de Nathan, 22/10/2026)

| Clé | Plafond avant | Plafond après | Mesuré | Marge après |
|---|---|---|---|---|
| `track.jsCss` | 287 400 | **276 600** (−10 800) | 254 798 | 21 802 |
| `track.js` | 276 000 | **265 200** (−10 800) | 243 386 | 21 814 |
| `track.horsThree` | 143 300 | **132 500** (−10 800) | 110 620 | 21 880 |
| `track.miniatures` (fil des circuits) | 26 600 | **30 000** | 26 524 | 3 476 (était 76) |
| `track.salon` (fil du Salon) | 30 000 | **32 000** | 28 502 | 3 498 (était 1 498) |
| `track.admin` (nouvelle ligne, informative) | — (comptée dans le premier chargement) | **12 500** (10 882 + 15 %, arrondi à 500 o) | 10 882 | 1 618 |

Justification des deux fils (écrite dans `docs/plateforme/budgets.md`) : ils ne retardent pas le premier écran (téléchargés en parallèle, calcul hors du fil principal), et sans relèvement la moindre retouche du générateur ou du pilote les aurait dépassés. Tout relèvement futur reste une décision de Nathan.

## 3. Démo du portail après la bascule des médailles

`apps/api/src/portailDemo.ts` appelait `medalsFor(authorMs)` sans le jour : à partir du 28/10/2026 (bascule du lot 35) ses seuils étaient ceux d'avant. Corrigé : `medalsFor(circuit.authorMs, day)`.

**À savoir (décision pour Nathan, § 5)** : ce correctif seul ne redonne pas une médaille d'or au joueur « Démo » après le 27/10. Les seuils du lot 35 (or à ≈ 0,88 fois le temps du pilote, bronze à ≈ 0,95) sont **sous** le temps du pilote automatique, et aucun réglage du pilote n'est plus rapide que ≈ 0,97 fois son propre temps (mesuré sur 28, 29 et 30/10 : `grip` jusqu'à 1,5, `look`, `cut`, `wall`). Avec l'ancien code la course choisie était « en or » avec les anciens seuils et le serveur lui donnait **aucune médaille** de toute façon ; avec le nouveau, le joueur envoie sa course la plus rapide (sans médaille), sans mentir sur les seuils. Test (`apps/api/test/portailDemo.test.ts`, jour 30/10/2026) : les cinq jours (26/10 → 30/10) ont la médaille que valent les seuils **du jour** ; avant la bascule une médaille, après elle aucune et la course la plus rapide du pilote — vérifié **rouge sur l'ancien code** (« la course la plus rapide, pas celle de l'ancien réglage : expected 38147 to be less than 38147 »).

## 4. Consignes

`apps/api/CLAUDE.md` (rubrique « Identifiant du joueur dans l'en-tête (lot 32) », texte du README du lot 32 § 4.2) ; `CLAUDE.md` racine (index : « Lot 32 », « Freinage après un boost (lot 34) », « Premier chargement et chargement à la demande (lot 36) » ; budgets : mesure unique, admin hors du premier chargement, marge ≈ 21,8 ko au lieu de « 600 o ») ; `apps/web/CLAUDE.md` (mesure unique, plafonds, admin).

## 5. Vérifié / non vérifié / décisions pour Nathan

- **Vérifié** : `npm run typecheck` ; `npx vitest run --project sqlite apps/portail` (budgets, mesure sur `dist` factice) ; `apps/api/test/portailDemo.test.ts` (SQLite) ; `perf.spec.ts` sur Chromium (`npx playwright test e2e/perf.spec.ts -g "pèse peu|page d'admin|polices|Salon"`, après `npm run build` et `npm run build:node -w @cdj/api`) ; `node scripts/budgets.mjs` (chiffres ci-dessus). CI de la PR : voir la PR.
- **Non vérifié** : la CI complète de `main` (le résultat sera celui de la PR) ; l'aperçu de la PR à la main (voir plus bas).
- **Décision pour Nathan** : la démo du portail n'aura **plus de médaille de Track après le 27/10** (§ 3). Deux pistes : l'accepter (le portail montre alors un temps sans médaille, un état qu'il faut aussi voir) ; ou fournir au joueur « Démo » une rediffusion plus rapide que le pilote (la conduite d'un humain gardée dans le dépôt, ou un pilote « coupeur » dans `sim` : un lot de Track).

## 6. Reste à faire après la retouche 32b (prévue le 29 ou 30/10/2026)

- **Lot de plateforme suivant** : retirer des **deux** pages des mentions (`apps/portail/mentions-legales/index.html`, la française qui fait foi, et `legal/index.html`) la phrase « pour certaines lectures de DailyTrack, elle contient ton identifiant » (ligne sur le journal de Cloud Run), et mettre à jour `apps/portail/test/mentions.test.ts` (parité des deux pages). **Pas avant la retouche 32b** : tant que `?player=` est accepté, la phrase reste vraie (règle de fidélité du lot R5). Les journaux déjà écrits gardent la mention 30 jours après ce retrait (durée à dire, ou purge dans Cloud Logging : décision d'exploitation de Nathan).
- Rien d'autre côté plateforme : aucune table, durée ni stockage ne change (`docs/plateforme/effacement.md` et les constantes des mentions n'ont rien à changer).
- Précharger le morceau du Salon (lot 36, § 10) : **non**, il ne serait chargé que pour le Salon.

## 7. Aperçu de la PR

https://playdujour-recette--pr-116-daizlis7.web.app/ (révision de recette étiquetée `b-claude-laughing-46p403`, car la PR touche le serveur) — ouvrir https://playdujour-recette--pr-116-daizlis7.web.app/?demo=joueur : le portail affiche le joueur de démonstration avec sa médaille d'or de Track tant qu'on est avant le 28/10/2026.
