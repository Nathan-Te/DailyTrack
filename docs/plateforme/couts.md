# Surveiller les coûts de la plateforme

Lot P4. Guide pas à pas **à suivre une fois** (≈ 20 minutes), puis un coup d'œil par semaine. Il complète `docs/mise-en-ligne.md` (étape 1 : l'alerte à 1 €) et `docs/securite-facturation.md` (pire cas, coupures). Chiffres mesurés : `docs/plateforme/lots/lot-P4-consolidation.md` ; projection : `npm run measure:platform -w @cdj/api`.

**Rappel** : une alerte de budget **ne bloque rien** ; elle t'écrit. Le vrai frein reste le plafond de **2 instances** de Cloud Run (`docs/securite-facturation.md`, § 1). Les chiffres de facturation arrivent avec quelques heures de retard.

---

## 1. Un budget Google Cloud avec alertes à 50, 90 et 100 % de 5 € par mois (5 min)

1. [console.cloud.google.com](https://console.cloud.google.com) → projet `dailytrack-511513` → menu ☰ → **Facturation** → **Budgets et alertes**.
2. Si le budget `alerte-1-euro` de la mise en ligne existe : l'ouvrir → **Modifier**. Sinon **Créer un budget**.
3. **Nom** : `plateforme-5-euros`. **Périmètre** : *tous les projets* du compte de facturation (la recette est dans le même projet, elle compte aussi). **Services** : tous.
4. **Montant** : *Montant spécifié*, **5 €**, période **mensuelle**. Décocher « Inclure les crédits » (on veut voir la vraie dépense).
5. **Seuils** : **50 %** (2,50 €), **90 %** (4,50 €), **100 %** (5 €), en *Dépense réelle*. Ajouter un seuil **100 % en dépense prévue** (*Prévisionnelle*) : il prévient dès que la tendance du mois dépasse 5 €.
6. **Notifications** : *Envoyer des alertes par e-mail aux administrateurs et utilisateurs de la facturation* (ton adresse). **Terminer**.
   - **Tu dois voir** `plateforme-5-euros · 5,00 €` dans la liste. Le premier e-mail arrive quand 2,50 € sont dépensés.
7. Facultatif : supprimer l'ancien budget à 1 € (sinon tu reçois les deux séries d'e-mails, ce qui n'est pas grave).

**Pourquoi 5 €** : point de départ du lot. Tant que la plateforme reste dans l'offre gratuite, la dépense est **0 €** ; 5 € couvrent une sortie modérée (par exemple ≈ 200 000 vCPU-s de calcul au-delà du gratuit), pas une emballée. Si tu changes le montant, garde les trois seuils.

## 2. Turso : l'usage de la base (5 min, puis chaque lundi)

1. [app.turso.tech](https://app.turso.tech) → ton organisation → **Usage** (ou *Billing* → *Usage*, selon la version du tableau de bord) : lignes lues, lignes écrites, stockage, pour le mois en cours. Les deux bases (production `dailytrack-misterzcool` et recette) comptent dans la **même** offre gratuite : 500 M lignes lues, 10 M lignes écrites par mois.
2. **Alertes** : si le tableau de bord propose des notifications d'usage (un réglage d'alerte ou de plafond par e-mail dans *Settings* / *Billing*), les activer à **50 %** et **80 %**. *Non vérifié par l'agent* (pas d'accès au compte) : si rien de tel n'existe, regarder la page **Usage chaque lundi** — c'est une minute — et noter les deux nombres dans un fichier (la tendance compte plus que la valeur).
3. Sur l'offre gratuite, Turso **ne facture rien** : au-delà, il bloque ou demande de passer à une offre payante. Pas de surprise sur la carte bancaire, mais un risque d'**interruption** : c'est pour cela qu'on regarde.

## 3. La projection du mois, avec les vrais joueurs (5 min, chaque lundi)

Le nombre de **joueurs par jour** de chaque jeu, lu directement dans la base de production (lectures seules, une par jeu) :

```bash
turso db shell dailytrack-misterzcool "SELECT ROUND(COUNT(*) / 7.0) FROM results WHERE day >= (SELECT MAX(day) - 6 FROM results)"            # DailyTrack
turso db shell dailytrack-misterzcool "SELECT ROUND(COUNT(*) / 7.0) FROM jump_results WHERE day >= (SELECT MAX(day) - 6 FROM jump_results)"  # DailyJump
```

Chaque table a une ligne par joueur classé et par jour : le résultat est la **moyenne de joueurs classés par jour** sur les 7 derniers jours (un joueur qui ne finit jamais n'est pas compté : majorer de 20 %). Le Salon oublie tout (lot 27b) : son activité se lit dans **Cloud Run → `cdj-api` → Métriques → Nombre de requêtes** (le Salon fait ≈ 560 requêtes par joueur et par demi-heure ; s'il y a beaucoup plus de requêtes que les joueurs du jour n'en expliquent, c'est lui).

Puis, sur ton poste ou dans Cloud Shell (dans le dépôt, après `npm ci`) :

```bash
npm run measure:platform -w @cdj/api -- --jump 800 --track 300 --salon 40
```

`--jump` : joueurs DailyJump par jour · `--track` : joueurs du circuit du jour de DailyTrack · `--salon` : joueurs qui passent 30 minutes au Salon par jour. Le script affiche, pour un mois de 30 jours, chaque ressource (requêtes Cloud Run **pré-vols CORS compris**, calcul, mémoire, lignes Turso), sa part de l'offre gratuite, ce qui dépasse (Cloud Run en dollars, au tarif public), le jeu qui pèse le plus, et la **marge** : par combien multiplier les joueurs avant le premier plafond.

**Lire le résultat** : le calcul de Cloud Run est compté **au plus** (chaque requête facturée seule, arrondie à 100 ms) ; avec beaucoup de joueurs simultanés, les requêtes se partagent le temps facturé et la vraie dépense est plus basse. Les requêtes et les lignes Turso, elles, sont exactes à l'hypothèse du joueur type près.

## 4. Quand l'offre gratuite approche : les décisions écrites à l'avance

Ce sont des **propositions de l'agent, à valider par Nathan** (cocher ou corriger). Le déclencheur est la **part la plus haute** que donne `measure:platform` avec les vrais joueurs (ou un e-mail du budget). Chaque étape est un petit lot, préparé à l'avance ; **aucune n'est automatique**. On les prend dans l'ordre : chacune coûte moins au jeu que la suivante.

| Seuil | Ce qu'on fait | Gain estimé | Ce que le joueur perd |
|---|---|---|---|
| ≥ 50 % | Rien. `measure:platform` chaque lundi, Turso chaque lundi. | — | rien |
| ≥ 70 % | **1. Le Salon, moins souvent** : classement lu toutes les **10 s** au lieu de 5 (finale : 2 s inchangé), `now` toutes les 20 s, fantômes seulement quand le classement change. Lot de DailyTrack (`salonMode.ts`, contrat inchangé). | ≈ − 45 % des requêtes du Salon (≈ 300 au lieu de 558 par demi-heure) | un classement du Salon un peu moins vif |
| ≥ 80 % | **2. Moins de relectures** : DailyJump relit le jour à l'arrivée au plus toutes les **10 min** (au lieu de 3), le profil au retour sur l'accueil toutes les 5 min (au lieu de 30 s) ; DailyTrack de même pour son profil. Constantes `ARRIVAL_REFRESH_MS`, `READ_FRESH_MS` (`apps/jump/src/dayReads.ts`), `SYNC_GAP_MS` (`@cdj/profile`, les deux jeux). | ≈ − 2 requêtes par joueur DailyJump et par jour | le top 10 et les taches des autres un peu moins frais |
| ≥ 90 % | **3. La carte des morts moins souvent** : recalcul au plus toutes les **10 min** (`JUMP_MAP_REFRESH_MS`) ; si ce sont les lignes **lues** de Turso qui montent. | ≈ − 70 % des lignes lues par la carte | les taches des autres arrivent plus tard |
| ≥ 100 % prévu | **4. Accepter une petite dépense** : relever le budget (10 €), le plafond de 2 instances borne de toute façon la facture (`docs/securite-facturation.md`). Si ce sont les **lignes Turso** : passer Turso à l'offre payante (le jeu s'arrêterait sinon). | — | rien |
| emballement | **5. Couper** : `--max-instances=1`, puis au besoin la coupure manuelle du niveau 2 (`docs/securite-facturation.md`) ; les jeux restent jouables sans serveur (classement indisponible, rien de perdu, les envois attendent). | arrêt de la dépense | le classement, le Salon et les profils, le temps de la coupure |

Déjà fait par le lot P4 (ne compte plus comme réserve) : la lecture regroupée de DailyJump (30 → 12 requêtes par joueur et par jour), l'envoi qui rend le classement, les en-têtes de cache.

**Piste plus forte, phase 3** : servir l'API sur **la même origine** que les jeux (le nom de domaine, avec un équilibreur ou une réécriture d'adresse) supprimerait **tous les pré-vols CORS** (≈ 7 requêtes par joueur DailyJump et par jour, ≈ 37 % de ses requêtes). Et si tu acceptes d'envoyer l'identifiant dans le **corps** des `POST` (`text/plain`) plutôt qu'en en-tête, les pré-vols de l'envoi et des vies disparaissent dès maintenant (une entorse à la règle « identifiant en `X-Player-Id` », à décider).

## Checklist (une fois)
- ☐ Budget `plateforme-5-euros` : 50 / 90 / 100 % réels + 100 % prévu, e-mail.
- ☐ Turso : alerte d'usage activée, ou rappel « Usage chaque lundi » dans ton agenda.
- ☐ `npm run measure:platform -w @cdj/api -- --jump … --track … --salon …` lancé une fois avec les vrais chiffres.
- ☐ Le tableau du § 4 relu : chaque ligne acceptée ou corrigée (réponds dans la PR du lot P4 ou dans le prochain prompt).
