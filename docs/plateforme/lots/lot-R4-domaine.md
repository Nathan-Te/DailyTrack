# Lot R4 (plateforme) — playdujour.com : le domaine, l'hébergement et la mise en production

Aucun changement de `packages/sim`, `packages/jump-sim`, `core`, `clock`, de la physique, du générateur ni d'une règle de jeu ; **golden des deux jeux inchangés** ; **aucune dépendance ajoutée** (l'outil officiel `firebase-tools`, version épinglée **15.34.0**, est lancé par `npx` dans les workflows seulement). Région `europe-west1` **vérifiée** : elle est dans la liste des régions prises en charge pour les renvois de Firebase Hosting vers Cloud Run (<https://firebase.google.com/docs/hosting/cloud-run>, consultée le 20/10/2026).

## 1. Les adresses et le flux
```
                 ┌──────────────── Firebase Hosting (projet dailytrack-511513) ────────────────┐
PR ──► Aperçu : https://<site recette>--pr-<n>-<empreinte>.web.app/{,track/,jump/}   /api/** ─► cdj-api-recette (défaut)
   │            (PR qui touche le serveur : le même canal, construit pour SA révision b-… par son adresse directe)
   ▼
fusion ──► Recette : https://recette.playdujour.com/{,track/,jump/}   /api/** ─► cdj-api-recette (révision par défaut) + recette:seed
   ▼
bouton « Mettre en production » ──► https://playdujour.com/{,track/,jump/}   /api/** ─► cdj-api
   CI complète verte → figer (code en production) → serveur [validation Nathan] → site → smoke --lecture-seule
   → étiquette prod-AAAA-MM-JJ-HHMM → redirections GitHub Pages (bascule) → PR « Jours figés » → résumé
Retour arrière : retour-arriere.yml (image + version du site de l'étiquette précédente, puis vérification).
Ancienne adresse : https://nathan-te.github.io/DailyTrack/… ─► https://playdujour.com/track/…  (#dujour=… : le profil)
```
Fichiers : `firebase.json` (en-têtes, redirections `/track` `/jump`, renvoi `/api/**`) ; `apps/portail/` (portail, redirections ; sans `package.json`, donc **sans toucher au verrou npm**) ; `scripts/site.mjs`, `domaine.mjs`, `mise-en-production.mjs`, `sonde-proxy.mjs` ; workflows `deploy-site.yml`, `apercu.yml`, `retour-arriere.yml` (nouveaux), `production.yml` (le bouton), `recette.yml` (fusion → recette), `deploy-api.yml` (`ref`, jours figés, origines, `TRUST_PROXY`), `pages.yml` (redirections seulement), `preview.yml` (Cloudflare, jamais configuré : supprimé). Jeux : `VITE_API_URL=/` → `/api/` sur leur propre origine ; import au démarrage ; aperçus Firebase reconnus par DailyJump (`isPreview`). `@cdj/profile` : `migration.ts`.

## 2. Ce que Nathan doit faire → `docs/plateforme/domaine.md`
Firebase sur le projet (étape 1), deux sites (2), droit `firebasehosting.admin` pour `cdj-deploy` (3), domaines et **DNS chez OVH** (4, certificat jusqu'à 24 h), variables `FIREBASE_SITE_PRODUCTION` / `FIREBASE_SITE_RECETTE`, secret `ROBOT_TOKEN` et deux réglages du dépôt (5), premier essai PR → aperçu → fusion → recette (6), **mesure de `TRUST_PROXY`** (7), « Mettre en production » = la bascule (8), vérification de la migration (9). ≈ 1 h 30 + attente du DNS.

## 3. Les choix, et pourquoi
- **Aperçu d'une PR qui touche le serveur : adresse directe de sa révision, pas un renvoi épinglé.** Firebase ne permet pas de viser une révision **choisie** : `firebase.json` n'a pas de champ d'étiquette, seulement `pinTag`, qui est (lu dans `firebase-tools` 15.34.0) **expérimental** (`pintags`), épingle **la dernière révision créée** du service (une autre PR peut avoir déployé entre-temps), et refuse d'épingler un canal tant que le site « live » ne l'est pas — ce qui figerait la recette par défaut sur une révision de PR. Donc : `recette.yml` crée d'abord le canal `pr-<n>` (son adresse est fixe), ajoute son origine aux origines permises **de cette révision seulement**, puis construit l'aperçu avec l'adresse de la révision (CORS, en recette seulement). Les autres PR : `/api/` même origine, recette par défaut.
- **Jours figés dans le dépôt : PR « robot » fusionnée automatiquement**, pas un commit direct : `main` exige les statuts `test` et `e2e`, qu'un commit direct contournerait (il faudrait affaiblir la protection) ; la PR fait passer la CI sur les fichiers (le job `api-image` sert chaque jour figé). Avec `ROBOT_TOKEN` (jeton à droits limités) la PR se fusionne seule et sa fusion lance la CI de `main` ; **sans lui**, une fusion faite par le jeton du workflow ne lancerait pas cette CI (règle de GitHub) et la mise en production suivante la refuserait : la PR est alors ouverte, sa CI lancée, Nathan fusionne. Les fichiers sont dans l'image et le site **avant** la PR (déployés depuis l'artefact du job `figer`) ; un jour figé différent arrête tout.
- **Approbation unique** : le job `serveur` (environnement `production`) attend Nathan ; le site, la vérification et l'étiquette suivent sans second clic. `figer` tourne avant (il n'écrit rien dans le dépôt).
- **Stockage** : production, recette et aperçus sont des origines distinctes ; les déploiements ne posent plus `VITE_STORAGE`, la production garde ses clés `cdj:*` / `jump:*`. Le mécanisme de préfixe est gardé (le serveur de développement s'en sert), son rôle est réécrit. Test : `apps/portail/test/domaine.test.ts` (aucune adresse de recette, d'aperçu, `www`, `http` ou `web.app` n'a l'origine de la production ; les aperçus ne vont jamais sur le site de production) + les garde-fous de `deploy-site.yml` simulés.
- **Le choix du joueur** (autre identité déjà là) : `confirm()` du navigateur, dans les deux jeux (texte commun `migrationQuestion`) : simple, accessible, sans nouvelle interface ; demandé une seule fois par lien.
- **Dates** : ancienne origine permise par le serveur **jusqu'au 31/12/2026** ; redirections **au moins jusqu'au 01/06/2027** (`scripts/domaine.mjs`, `domaine.md`).

## 4. La migration : ce qui passe, ce qui ne passe pas
Passe (fragment `#dujour=1.<base64url>.<CRC-32>`, ≤ 16 000 caractères, jamais envoyé à un serveur, effacé aussitôt par `history.replaceState`, importé une fois) : identité (code `CDJ2`), pseudo ; DailyJump : envoi en attente du classement, vies à envoyer, mémoire du jour (par priorité, ce qui tient). Pas d'identité ici → import automatique ; même identité → ajout de ce qui manque ; autre identité → choix, puis règle d'un code chargé. **Ne passe pas** : réglages (son, caméra, commandes), historique et série locaux, records non envoyés des jours passés (la synchronisation du serveur rend le reste), un joueur sans identité (rien sur le serveur). Les paramètres de l'adresse (`?seed=`, `?watch=`, `?api=`…) sont gardés ; `/b/…` → « Les aperçus ont déménagé ».

## 5. Poids et coûts (mesurés sur le site assemblé ; détail `couts.md` § 5)
Premier chargement, compressé : **portail 2,8 ko**, **DailyTrack 259 ko** (890 ko bruts, 6 fichiers), **DailyJump 355 ko** (1,4 Mo bruts, 9 fichiers) ; Three.js ≈ 140 ko par jeu ; fichiers à empreinte gardés un an. Firebase Hosting : 10 Go stockés et **360 Mo/jour** transférés gratuits, puis 0,026 $/Go et **0,15 $/Go** → ≈ 1 000 premiers chargements de DailyJump par jour gratuits ; ≈ 1,6 $/mois par tranche de 1 000 nouveaux joueurs quotidiens. Cloud Run : **moins** de requêtes (plus de pré-vols ; le CDN garde les lectures `public` du lot P4). `measure:platform` compte encore les pré-vols : borne haute (à retirer par un lot du serveur).

## 6. Vérifié / non vérifié / décisions pour Nathan
**Vérifié** (local) : tests unitaires `npm test` (SQLite et libSQL) et `npm run typecheck` + `tsc -p apps/portail` ; nouveaux tests : `packages/profile/test/migration.test.ts` (pas d'identité, même, autre gardée / prise, abîmé, effacement, taille, un seul import), `apps/{web,jump}/test/migration.test.ts`, `apps/portail/test/` (correspondance des chemins **paramètres compris**, numéros du jour = `circuitNumber` / `levelNumber` sur 730 jours, `firebase.json`, origines et date de retrait, stockage par origine, étiquette, **liste des changements depuis la dernière étiquette**, jours figés, sonde) ; **workflows** : `actionlint` 1.7.7 + `shellcheck` 0.11 (aucune remarque dans les fichiers de ce lot ; 6 anciennes, inchangées, dans `ci.yml` et `stabilite.yml`), et `apps/portail/test/workflows.test.ts` lance les étapes « Configuration présente ? » **sans secrets** (sautées, vertes, « Firebase non configuré : voir docs/plateforme/domaine.md »), les garde-fous (aperçu → production refusé) et vérifie les déclencheurs (production : bouton seulement) ; **e2e** `apps/web/e2e/domaine.spec.ts` (portail ; jeux sous `/track/` et `/jump/` : ressources, niveaux figés, démos, `/api/` même origine sans en-tête `Origin` ; redirection + import entre deux origines locales ; choix et import unique) : **20/20** en Chromium (`--repeat-each=5 --retries=0`). CI de la PR : § 7.
**Deux tests existants ajustés, sans rien affaiblir** : `apps/web/test/ciComplete.test.ts` lisait la structure de l'ancien `production.yml` (jobs `ci-complete`, `changes`) ; il vérifie maintenant **le même invariant** sur le bouton (le garde CI complète est la première étape du premier job, tout ce qui déploie en dépend). `apps/jump/test/jeu.test.ts` (« l'adresse ne se lit que dans `urlOptions.ts` ») a refusé la première version de l'import : la lecture de l'adresse a été déplacée dans `urlOptions.ts` (`pageAddress`), le test n'a pas bougé.
**Non vérifié** (aucun accès d'un agent) : tout ce qui touche Firebase, OVH et Google Cloud pour de vrai — le déploiement par `firebase-tools` avec la fédération d'identité, les formes exactes des réponses `--json` (lues dans le code de `firebase-tools` 15.34.0, pas exécutées), les enregistrements DNS (Firebase les donne), le comportement de `hosting:clone` et du retour arrière, l'adresse du client vue par Cloud Run derrière Firebase ; l'e2e dans Firefox et WebKit (pas installés ici : le run complet de `main` les lancera ; le test des jeux s'y saute sans WebGL, portail et migration tournent).
**Décisions pour Nathan** :
1. **Bloquant avant la bascule : `TRUST_PROXY`** (guide, étape 7). Derrière Firebase, la limite de débit **par adresse** peut devenir commune à tous les joueurs (valeur trop basse) ; la sonde le mesure sur la recette. Reste ouvert : un appel direct à `run.app` peut fausser son adresse si la valeur est ≥ 2 (la limite **par joueur**, en base, tient). Le fermer = un petit lot du serveur (lire l'en-tête du client posé par Firebase, ou refuser ce qui ne vient pas de Firebase) : **à décider**.
2. `ROBOT_TOKEN` (recommandé) ou fusion à la main des PR « Jours figés ».
3. Retirer les pré-vols de `measure:platform` (lot du serveur), et le jour venu, la conservation des versions Firebase (50 par site proposé).
4. La première « Mettre en production » prend comme « code en production » le dernier run réussi de l'ancienne « Production » : **le vérifier dans le résumé** (sinon relancer avec `reference`).

### Checklist de la bascule
- ☐ Étapes 1 à 6 de `domaine.md` faites ; `recette.playdujour.com` sert `main`, `/api/health` répond.
- ☐ Étape 7 : sonde « TRUST_PROXY est juste » sur la recette ; `RECETTE_TRUST_PROXY` et `TRUST_PROXY` réglées.
- ☐ `playdujour.com` « Connecté » (certificat) dans la console Firebase ; `www` redirige.
- ☐ CI complète verte sur le dernier commit de `main`.
- ☐ « Mettre en production » : « code en production » vérifié, validation, tout vert, étiquette posée, job `bascule` vert.
- ☐ Étape 9 : l'ancienne adresse redirige, ton profil est là (DailyTrack et DailyJump), `/b/…` explique.
- ☐ PR « Jours figés » fusionnée.

## 7. CI de la PR
*(rempli après le run de la PR.)*
