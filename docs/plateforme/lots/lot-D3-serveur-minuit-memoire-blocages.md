# Lot D3 — Minuit, la mémoire de Tower, et les blocages de 8 s

Suite de D1 (`docs/plateforme/analyse-refus.md`) et D2. Branche `claude/lot-d3-minuit-memory-blocking-p6r8p0`, PR en brouillon. **Pour les joueurs : rien.** Golden et trois bancs : inchangés (`git diff apps/api/test/fixtures` vide).

## C9 — le niveau du lendemain, prêt avant minuit
- **Dans la demi-heure d'avant minuit de Paris**, la première requête d'une instance lance (sans que sa réponse l'attende) `dailyLevel(demain)` de chaque jeu ouvert ; le niveau est écrit en base comme à minuit, toute instance le lit ensuite. **Aucun niveau ne change** (même calcul, même règle vérifiée à la lecture ; test : minuit sert les mêmes réponses avec et sans préparation).
- **Et le calcul ne bloque plus le fil principal** : Jump (1,9 s) et Track (0,4 s) se calculent dans un fil de calcul (`dist/niveaux-fil.mjs`, `build-node.mjs`, `Dockerfile`), repli sur place sans le fichier.
- **Mesure** (`npm run measure:minuit -w @cdj/api`, Xeon 2,8 GHz, 30 requêtes simultanées sur une instance neuve à minuit, base `file:`) :

| cas | premier `portail/jour` | fil principal bloqué |
|---|---|---|
| avant le lot (calcul sur place, rien de préparé) | **2 437 ms** | **2 384 ms** |
| fil de calcul, rien de préparé (instance sans requête avant minuit) | 2 524 ms | **8 ms** |
| **niveau préparé à 23 h 35** (préparation : 322 ms, hors du fil principal) | **28 ms** | 0 ms |

Sur Cloud Run (3 à 5 fois plus lent, D1) le « avant » donnait les 6 à 10 s relevés. **Limite** : Cloud Run ne donne du calcul que pendant une requête ; une instance sans aucune requête entre 23 h 30 et minuit ne prépare rien (le premier joueur d'après minuit attend alors ~2 s au lieu de 28 ms, sans bloquer les autres).

## C10 — la mémoire de Tower
- **Mesuré** (`npm run measure:memoire -w @cdj/api -- --n=1000`, un processus par jeu, ramasse-miettes forcé, la boucle respire entre deux rejeux) :

| après N rejeux | 0 | 1 | 10 | 100 | 1 000 | tas JS 0 → 1 000 |
|---|---|---|---|---|---|---|
| Tower, fil principal (rss Mo) | 225 | 227 | 232 | 247 | **250** | 23,5 → 19,6 |
| Tower, **fil de calcul** (production, rss du processus) | 422 | 423 | 289 | 340 | **336** (pic 426) | 23,6 → 23,7 |
| Jump | 199 | 197 | 197 | 197 | **197** | 29,7 → 29,8 |
| Track | 111 | 112 | 111 | 111 | **111** | 18,8 → 18,9 |

- **Il n'y a pas de fuite** : tas JS, `external` et mémoire linéaire du WebAssembly (1,3 Mo) restent plats sur 1 000 rejeux ; le monde de Rapier est libéré à chaque rejeu (`Partie.dispose`, `finally`). La hausse « de 20 % à 50–86 % » est **le prix fixe d'avoir Rapier en marche** : le `rss` monte de ~100 Mo pendant les ~100 premiers rejeux (le compilateur optimisant de V8 compile le WebAssembly dans des fils d'arrière-plan, dont les arènes malloc restent) puis plafonne à 300–450 Mo, avec ±80 Mo d'une exécution à l'autre. La dent de scie de D1 est ce plateau qui bouge, pas une croissance.
- **Essayé** (rejeux de 300, trois passages) : `MALLOC_ARENA_MAX=1/2` : pas de gain net hors du bruit ; **`--liftoff-only`** : rss ≈ 200 Mo stable (au lieu de 280–440) mais **+40 % de temps de rejeu** (127 ms au lieu de 89). **Non appliqué** (décision de Nathan : le service est à 1 Gio depuis D2 ; le plafond de rejeux de Tower est calibré sur 450 ms).
- **Correction faite** : l'examen d'un jour préparé (la preuve rejouée, 0,4 à 1 s) tournait **dans le fil principal** et y chargeait un second Rapier ; il passe par le fil de Tower (`examinerParLeFil`). Effet mesuré sur le `rss` : aucun distinguable du bruit (avant 307 → 356 Mo, après 279–439 Mo selon les passages) ; effet sur le blocage : l'examen ne bloque plus le fil principal. Tower est `off`, rien n'est en production.

## C8 et C2 — les mesures (`apps/api/src/mesures.ts`)
Sans donnée personnelle, volume borné (un relevé par minute et par instance qui sert, ≤ 10 « blocage », ≤ 20 « envoi lent », ≤ 10 « ramasse-miettes long » par minute). Les lignes, leurs champs et comment les lire : `apps/api/CLAUDE.md`, « Minuit, mémoire et blocages ». **Filtres Cloud Run › `cdj-api` › Journaux** :
- `jsonPayload.message="boucle d'événements"` — le relevé de la minute (`p50Ms`, `p99Ms`, `maxMs`, **`maxEnRequeteMs`**, `gcMaxMs`, `rssMo`) ;
- `jsonPayload.message="blocage de la boucle d'événements"` — un écart > 1 s : **`type: "calcul"`** (le fil de Node était occupé : `cpuMs` ≈ `retardMs`) ou **`"attente"`** (il n'a rien consommé : conteneur gelé hors requête, ou hôte lent) ; `routes` dit ce qui tournait ;
- `jsonPayload.message="envoi lent"` — étapes d'un envoi > 3 s : `lectureMs`, `controlesMs`, `rejeuMs`, `ecritureMs`, `sqlMs`.
Le tableau de bord de `/admin/` montre la mémoire de l'instance qui répond et son plus grand retard de boucle pendant une requête (24 h), en « État du site ».

## La cause des blocages de 8 s
**Non reproduite en local.** Essayé : minuit simulé (blocage de 2,4 s du fil principal, le niveau de Jump : **trouvé et supprimé par C9**), 1 000 rejeux de chaque jeu, et une charge mixte (`npm run measure:charge -w @cdj/api` : 8 vagues de 6 envois de chaque jeu en même temps + lectures du portail, serveur mesuré, Tower et niveaux dans leurs fils) : **plus long retard du fil principal 323 ms, aucune ligne « blocage », « envoi lent » ni « ramasse-miettes long »** (Tower rend 503 `busy` à 8 envois sur 48 quand six arrivent ensemble : sa file de 4, voulue). Ce qui reste, D1 § 6 bis : 8 s **après ≈ 31 s sans requête**. **Hypothèse** : le conteneur gelé hors requête qui se réveille (ou une instance chaude aux connexions Turso mortes). **Comment trancher en production** une fois déployé : chercher « blocage de la boucle d'événements » autour d'un envoi de plus de 8 s (`httpRequest.latency>="8s"`, même instance) : `type: "calcul"` + `routes` → un calcul dans le fil principal à corriger ; `type: "attente"` avec `enRequete: false` → gel de Cloud Run (C6 : `--cpu-boost` / instance minimale) ; `enRequete: true` et `sqlMs` grand dans « envoi lent » → Turso (aller-retour réseau). Aucune ligne « blocage » au minuit suivant le déploiement = C9 réussi. Limite de `type` : `cpuMs` est celui du seul fil principal (`process.threadCpuUsage`, Node ≥ 22.19 ; sinon tout le processus).

## Vérifié / non vérifié
- **Vérifié** : `tsc -b`, 885 tests de `apps/api` (SQLite), dont `mesures` (blocage « calcul » et « attente », envoi lent, aucun identifiant), `niveauxFil` (fil = sur place date par date, préparation avant minuit, minuit sans calcul, jeu éteint), `towerFil` (examen par le fil), `admin` (bloc `instance`), `dockerfile`. `node scripts/securite-workflows.mjs` : 0 écart.
- **Non vérifié** : libSQL (CI), l'image Docker et le fichier `niveaux-fil.mjs` sur Cloud Run, la mémoire en production, la cause des 8 s (se lit après déploiement). Les tableaux ci-dessus viennent d'une machine locale (4 cœurs), pas de Cloud Run.
- **CI** : à remplir (run de PR et run en mode `main`).
