# Lot 5 — Le classement

**Livré**
- **API** (`apps/api`) : classement du jour, rejeu des courses côté serveur, pseudo, fantômes du premier et du joueur juste devant. Le cœur (`src/api.ts`) n'utilise que l'API Web standard (`Request`/`Response`) et une petite interface SQL : il tourne tel quel sur **Node + SQLite** (conteneur Docker, `src/server.ts`) et sur **Cloudflare Workers + D1** (`src/worker.ts`). Les tables se créent au premier appel.
- **Validation par rediffusion** : le jeu envoie la suite de commandes de la course ; le serveur la **rejoue avec le même code de simulation** (`replayRace`) et n'enregistre que le temps qu'il a lui-même recalculé. Un temps annoncé par le client est ignoré. Les courses rejetées (illisibles, non terminées, d'une autre version ou d'un autre jour) ne créent même pas de joueur.
- **Client** : pseudo choisi à la première arrivée (mémorisé, modifiable), envoi du meilleur temps, rang « 3 / 12 » dans le panneau d'arrivée, **classement du jour** (touche **L**), **fantômes** (touche **G** : son record → le premier → le joueur devant → aucun ; les écarts aux points de contrôle se comparent au fantôme affiché). Un envoi raté (réseau) se retente à la fin de la course suivante ; un message clair et un bouton « Réessayer » s'affichent. Sans adresse d'API, le jeu fonctionne comme avant et aucun classement n'apparaît.

**Routes**
| Route | Rôle |
|---|---|
| `GET /api/health` | versions de la simulation et du générateur, date UTC du serveur |
| `GET /api/day/AAAA-MM-JJ` | infos du circuit du jour (id, temps d'auteur, palette) : le jeu peut détecter une version différente |
| `POST /api/submit` `{playerId, name?, date, replay}` | rejoue, enregistre le meilleur temps du joueur, renvoie `{ms, rank, participants, medal, improved…}` |
| `PUT /api/player` `{playerId, name}` | change de pseudo (joueurs déjà classés) |
| `GET /api/day/…/leaderboard?limit=&player=` | `{participants, top[], me}` |
| `GET /api/day/…/ghost?kind=first\|ahead&player=` | nom, temps, intermédiaires et **rediffusion** du premier / du joueur devant |

**Règles du classement** : seul le circuit d'aujourd'hui (UTC) accepte des temps, avec **10 minutes de grâce** après minuit pour finir une course commencée la veille ; les jours passés restent consultables, **figés**. Meilleur temps par joueur et par jour ; à temps égal, le premier arrivé passe devant. Le circuit du jour est calculé au premier appel puis mis en cache en base (`circuits`), donc il reste le même même si le générateur change plus tard.

**Sécurité** (ce qui est garanti, et ce qui ne l'est pas)
- Garanti : un temps falsifié ne passe pas (rejeu) ; requêtes SQL paramétrées ; pseudo validé (1 à 20 caractères, lettres/chiffres/espace/`. _ ' -`) et affiché via `textContent` ; corps limité à 400 ko (même sans `Content-Length`) ; rediffusion bornée à 10 min de jeu ; **limitation de débit** par adresse (60 requêtes / 10 min, adresse hachée avec un sel, jamais stockée en clair) et par joueur (30 / 10 min), appliquée avant tout rejeu ; l'identifiant du joueur (128 bits tirés par le navigateur) n'est jamais renvoyé par l'API.
- **Non garanti** : un programme qui conduit « mieux qu'un humain » avec des commandes valides n'est pas détectable (comme sur tout classement par rediffusion) ; on peut multiplier les identités (changer de navigateur = nouveau joueur, accepté par le seed) ; il n'y a pas de filtre de pseudos grossiers.

**Coût mesuré** : rejouer une course de 40 s (4 773 pas) prend **≈ 6 ms** de calcul sur Node. Générer le circuit du jour (premier appel du jour) prend **35 ms en moyenne, jusqu'à ~0,5 s**.

⚠️ **Le seed dit que les offres gratuites suffisent ; pour l'API, ce n'est pas le cas sur Workers.** Cloudflare limite l'offre gratuite à **10 ms de calcul par requête** (vérifié dans leur documentation, page « Limits »). Le rejeu tient à peine, la génération du circuit non. Trois options :
1. **Ton serveur (Docker)** — recommandé : aucune limite de calcul, une base SQLite dans un volume. Voir ci-dessous.
2. **Cloudflare Workers Paid** (5 $/mois) : 30 s de calcul par requête par défaut ; D1 et le reste restent dans l'offre gratuite pour ce volume.
3. Workers gratuit en précalculant le circuit du jour hors du Worker (une tâche planifiée qui l'insère dans D1) : possible, mais le rejeu seul approche déjà les 10 ms ; je ne le recommande pas.

**Déployer sur ton serveur (Docker)**
```bash
docker build -f apps/api/Dockerfile -t circuit-du-jour-api .
docker run -d --name cdj-api -p 8787:8787 -v cdj-data:/data \
  -e TRUST_PROXY=1 -e RATE_SALT=<une-valeur-secrete> -e ALLOW_ORIGIN=https://nathan-te.github.io \
  circuit-du-jour-api
```
Mets-le derrière ton reverse proxy en HTTPS (`TRUST_PROXY=1` pour lire l'adresse du client dans `X-Forwarded-For`). Sauvegarde le volume `/data` (un seul fichier SQLite).

**Déployer sur Cloudflare (Workers Paid)**
```bash
npx wrangler login
npx wrangler d1 create circuit-du-jour        # recopier le database_id dans apps/api/wrangler.toml
npm run deploy:worker -w @cdj/api             # puis régler ALLOW_ORIGIN (wrangler.toml) et RATE_SALT (wrangler secret put RATE_SALT)
```

**Brancher le jeu** : dans GitHub → Settings → Secrets and variables → Actions → *Variables*, créer `VITE_API_URL` = l'adresse de l'API (sans `/` final). Les workflows Pages et aperçu la lisent à la construction. Pour essayer sans rien déployer : lancer l'API en local (`npm run build:node -w @cdj/api && DB_PATH=:memory: npm start -w @cdj/api`) et ouvrir le jeu avec `?api=http://localhost:8787`.

**À tester** : deux appareils (ou deux navigateurs), le même jour, deux temps, un classement : sur le premier, finir un tour, choisir un pseudo, voir « Rang 1 / 1 » ; sur le second, finir un tour plus lent, voir « Rang 2 / 2 », ouvrir le classement (**L**) puis passer au fantôme du premier (**G**).

**Garde-fous**
- `apps/api/test/api.test.ts` (32 tests, vraie base SQLite en mémoire) : rejeu et temps recalculé, deux joueurs, meilleur temps conservé, égalités, rediffusions falsifiées / coupées / illisibles / d'une autre version / d'un autre jour, validation des champs, jours ouverts / fermés / grâce, fantômes (premier, devant, rejouables à l'identique), pseudo, circuit généré puis mis en cache et identique à celui du jeu, CORS, corps trop gros, limitation de débit (aucune adresse en clair), aucun joueur créé sans course valide.
- `apps/api/test/server.test.ts` : le vrai serveur HTTP Node, « deux appareils, deux temps, un classement », CORS, corps énorme refusé en flux (la connexion est fermée ensuite).
- `apps/web/test/api.test.ts`, `online.test.ts` : client (URL, erreurs, réseau coupé) et règles de pseudo identiques à celles du serveur.
- `apps/web/e2e/leaderboard.spec.ts` (Playwright, Chromium) : deux contextes de navigateur isolés jouent une course complète en accéléré avec la rediffusion d'un pilote ; pseudo refusé puis accepté, rangs 1/1 puis 2/2, classement affiché, **le serveur retrouve exactement les temps du navigateur**, pseudo et envoi mémorisés, fantôme du premier puis du joueur devant ; serveur injoignable ; sans API. Le serveur est lancé par Playwright à partir du bundle de production.
- Vérifié aussi à la main : le Worker tourne dans **workerd + D1 local** (`wrangler dev`) et joue le scénario complet ; il génère exactement le même circuit (même temps d'auteur) que Node.

**Pas vérifié ici** : la construction de l'image Docker (pas de Docker dans ce conteneur), un déploiement réel sur Cloudflare, et la limite de calcul de l'offre gratuite (documentée, non mesurée sur Cloudflare).

**Limites** : classement du jour seulement (les archives viennent au lot 6) ; pas de ligne de partage (lot 6) ; identité par navigateur ; le premier appel de la journée paie la génération du circuit.
