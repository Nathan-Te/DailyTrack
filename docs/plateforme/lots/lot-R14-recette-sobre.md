# Lot R14 — Une recette sobre, qui ne peut pas bloquer la production

**Pour les joueurs : rien.** Aucune donnée de production touchée, golden inchangés, aucun secret dans le dépôt.

## Pourquoi
Turso (29/10) : `dailtrack-recette` 65,2 M lignes lues / 1,85 M écrites, production 0,37 M / 0,014 M. Quota **commun** (500 M / 10 M) : la recette en prenait 99 %, et dépasser une limite **bloque toutes les bases**. Turso compte les lignes **parcourues**, pas rendues.

## La répartition (estimation — **non lue chez Turso**)
Je n'ai aucun jeton Turso en lecture dans cette session : les chiffres Turso ci-dessus sont les tiens. Croisés avec GitHub Actions (`recette.yml` : 405 runs en tout, 100 sur les 27–29/10 : 68 PR, 31 fusions, 1 manuel) et avec une mesure locale de chaque outil :

| Source | Part estimée | Base de l'estimation |
|---|---|---|
| **`recette:seed`** à chaque déploiement d'une révision de PR, de `main`, + cron quotidien | **≈ 90 % des lectures et des écritures** | ≈ 340 passages × ≈ 2 600 instructions et ≈ 5 000 lignes écrites (index compris) chacun ; 1,85 M / 340 ≈ 5 400 écritures par passage |
| smoke complet contre chaque révision de PR + répétition | quelques % | écrit un joueur « Fumée », une soixantaine de requêtes (non mesuré) |
| trafic réel de la recette, aperçus de PR, sauvegarde d'essai | négligeable | aucun appel automatique ; la base de recette ≈ 700 lignes |
| CI, tests (libSQL compris), `stabilite`, outils de mesure | **0** | aucun workflow de test ne reçoit d'adresse ni de jeton Turso ; le projet `libsql` de Vitest ouvre un fichier temporaire ; `api-image` parle à un `sqld` du runner |

**Un point inexpliqué** : 65,2 M / 340 passages ≈ **190 000 lignes lues par passage**, alors que mon compteur local n'en voit que ≈ 7 000 (estimation basse) pour 2 600 instructions, soit ≈ 74 lignes par instruction. Hypothèse, **à vérifier** : chaque instruction HTTP relit le schéma (57 objets : 24 tables + 33 index). Si c'est vrai, **le nombre d'instructions est ce qui coûte**, d'où la sobriété du seed ci-dessous. Vérification (Nathan) : `turso db inspect <base> --queries`, puis 100 × `turso db shell <base> "SELECT 1"` et la variation de *Usage*.

## Ce qui visait Turso, ce qui vise une base locale
- **Désormais local, sans exception** : tests unitaires (SQLite en mémoire, libSQL en fichier), `measure:*` (fichier ou `sqld` local), `plans`, `measure:lignes`. `openLibsql` **lève** sous Vitest devant un hôte distant ; `test/pasDeTurso.test.ts` échoue si l'environnement du test désigne Turso, si un fichier de test cite `libsql://` hors de la liste des tests de configuration, ou si un workflow de test le fait.
- **Distant seulement avec `--distant`** (sinon sortie 1, hôte nommé, jamais le jeton) : `recette:seed`, `lancement:remise-a-zero`, `base:sauvegarde`, `pseudos:migrate`, `smoke` complet. Les workflows le passent.
- **Aperçus de PR** : ils **lisent** la recette (choix : une base locale embarquée demanderait un serveur par aperçu ; la lecture coûte quelques lignes, voir ci-dessous) et **n'écrivent plus** : `recette:seed` ne tourne plus pour une révision de PR, et le smoke de sa révision est en **lecture seule**. Leur serveur est le même code que la production, donc les mêmes fenêtres de calcul.

## `recette:seed` n'écrit que ce qui manque
Un marqueur `recette_seed:<segment>:<date>` dans `meta` par segment (Track d'un jour, Jump du jour, classement d'un jour, « Démo » du jour), lié à la génération de données (une remise à zéro périme tout) et aux versions des jeux. Mesuré en local (`recette:seed --mesure`, 7 jours) :

| Passage | Instructions | Lues (bas) | Écrites (hors lots) |
|---|---|---|---|
| avant, 1er | 2 490 | 5 944 | 571 |
| avant, chaque suivant | 2 597 (+273 en lot) | 7 135 | 372 |
| **après, 1er** | 2 510 | 5 945 | 583 |
| **après, même jour** | **7** | **19** | **0** |
| **après, jour suivant** | 745 | 1 307 | 166 |

Déclenchement : fusion dans `main` + cron quotidien seulement.

## Index et plans
`EXPLAIN QUERY PLAN` de **toutes** les requêtes du serveur (300 distinctes, captées en lançant les 588 tests d'API) : **aucun index ne manque sur une route chaude** — tout est `SEARCH`. 43 parcours complets restent, **tous justifiés un par un** (`PARCOURS_PERMIS`) : ménages d'une fois par fenêtre ou par heure (`rate` : un index coûterait une écriture à chaque clé), opérations rares sur un joueur (changer de code, effacer : `salon_runs` et `jump_lives` sont oubliés chaque session ou jour), scripts à la main. **Aucune migration d'index n'a donc été ajoutée** (rien à mesurer avant/après sur une base saine).

Lignes lues par route, base de référence (300 joueurs, 14 jours), **à froid** (instance neuve) : portail `jour` visiteur 3, avec joueur 420 ; `classement` 453 (lecture du jour, une fois par fenêtre de 45 s ; **0 à chaud**) ; classement Track 16 ; `/api/me` 24 ; bundle Jump 22 ; envois Track 8, Jump 20. Contre-épreuve : **sans** les six index de `results` / `jump_results`, les mêmes routes lisent **5 118** (portail joueur), 2 823 (`/api/me`), 1 921 (bundle), 2 807 (envoi) lignes — c'est ce que le garde-fou attrape.

## Garde-fous de CI
`openTestDb` examine chaque requête du serveur par `EXPLAIN QUERY PLAN` (un `SCAN` de grande table non justifié fait échouer le test qui la lance) ; `routesChaudes.test.ts` : ≤ 100 lignes lues par route (770 pour le calcul du classement du jour), ≤ 10 parcourues, ≤ 30 instructions. Limite : le compteur local donne une estimation **basse** (voir `apps/api/CLAUDE.md`) ; l'exact reste le `sqld` local des scripts `measure:*`.

## Étapes de Nathan
1. **Séparer les quotas** (la vraie protection) : [app.turso.tech](https://app.turso.tech) › menu de l'organisation › **Create organization** (offre gratuite) › p. ex. `dailytrack-recette`. Puis, avec la CLI : `turso org switch dailytrack-recette` · `turso db create dailytrack-recette` · `turso db show dailytrack-recette --url` (adresse `libsql://…`, le nom contient « recette ») · `turso db tokens create dailytrack-recette` (écriture) et `… --read-only` (lecture).
2. Secret Manager (projet `dailytrack-511513`) : `printf %s "<jeton écriture>" | gcloud secrets versions add cdj-recette-turso-token --data-file=-` et pareil pour `cdj-recette-turso-lecture` (jeton en lecture seule). Aucun jeton dans GitHub.
3. GitHub › Settings › Environments › `recette` › variable **`RECETTE_TURSO_DATABASE_URL`** = la nouvelle adresse. Fusionner ce lot (ou « Run workflow » de *Recette* sur `main`) : la recette redémarre sur la base neuve, `recette:seed` l'écrit **une seule fois**.
4. **Vérifier** : *Usage* de l'ancienne organisation : la recette n'y consomme plus rien. Quand c'est bon, `turso db destroy dailtrack-recette` (dans l'ancienne organisation) : les lectures de la production restent seules sur son quota.
5. **Alerte** : tableau de bord Turso › *Settings*/*Billing* : une notification d'usage à 50 % et 80 % *si l'offre la propose* (non vérifié ; sinon la ligne du lundi de `couts.md` § 10).
6. **Scénario (2 clics)** : (a) ce README ; (b) Turso › Usage, 24 h après la fusion : les lignes de la recette progressent **beaucoup moins vite** (≈ 7 instructions par passage quotidien au lieu de ≈ 2 600 par poussée de PR).

## Vérifié / non vérifié
- **Vérifié en local** : typecheck ; tests d'API SQLite (588 + nouveaux) ; mesures ci-dessus ; `workflows.test.ts` ; contre-épreuve sans index.
- **Non vérifié** : tout ce qui est chez Turso (usage réel, hypothèse du schéma relu à chaque instruction) ; les workflows modifiés n'ont pas tourné (je ne les lance pas) ; l'alerte Turso.
- **CI de la PR (#193) verte** sur 899288e : https://github.com/Nathan-Te/DailyTrack/actions/runs/40964551220 (unitaires SQLite + libSQL, `api-image`, e2e des zones touchées).
