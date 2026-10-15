# Lot 7b — Chargement rapide, respirations, tension (DailyJump)

## À tester
**Page par défaut, à ouvrir sur téléphone (cache vide, puis rechargée) :** [`https://nathan-te.github.io/DailyTrack/b/ccr-8dc52550-3xoanp/jump/`](https://nathan-te.github.io/DailyTrack/b/ccr-8dc52550-3xoanp/jump/) (l'aperçu existe quand le workflow de la branche a fini ; ajouter `?debug` montre `__jump.daily.load`). Au premier chargement « Préparation du niveau… » puis le niveau ; au rechargement, le niveau arrive tout de suite (cache, preuve rejouée). Pour la respiration adoucie : [`?module=tunnel`](https://nathan-te.github.io/DailyTrack/b/ccr-8dc52550-3xoanp/jump/?module=tunnel) (et `&solution`).

## Ce qui change
**1. Chargement.** `dailyLevel` s'exécute dans un worker de module (`dailyWorker.ts`) ; `dailyLoader.ts` est l'unique point d'appel (cache, worker, repli sur le fil principal). Le cache (`jump:niveau:<id>`, versions de la sim et du générateur dans la charge) **rejoue la preuve** à la relecture et régénère si elle échoue ; purgé par jour et avec la mémoire du jour ; stockage protégé. Seules modifications ailleurs dans `apps/jump` : l'appel dans `main.ts` (et `load` dans `__jump.daily`) et un mot dans le balayage de `memory.ts`.

**Temps de fil principal bloqué par le chargement** (Chromium, téléphone 844 × 390 @2, rendu logiciel, médiane de 5 passages ; `mesure-chargement.spec.ts`, méthode du lot 3 : `Emulation.setCPUThrottlingRate`) :

| Processeur | Chargement | Fil principal dans le chargeur | Niveau prêt après | Tâches longues avant « prêt » (somme · plus longue) |
|---|---|---|---|---|
| ×1 | avant (génération sur le fil principal) | **202 ms** | 205 ms | 381 · 381 ms |
| ×1 | worker (cache vide) | **5 ms** | 225 ms | 180 · 180 ms |
| ×1 | cache | 35 ms | 36 ms | 1141 · 744 ms (*) |
| ×4 | avant | **707 ms** | 724 ms | 1339 · 1173 ms |
| ×4 | worker (cache vide) | **17 ms** | 282 ms | 621 · 470 ms |
| ×4 | cache | 93 ms | 94 ms | 1042 · 579 ms (*) |

« Avant » = le repli sans worker, qui est exactement le chemin d'avant le 7b. Le niveau n'est pas prêt plus tôt avec le worker (il faut charger le script puis générer), mais le fil principal reste libre et la page affiche son message. (*) Avec le cache, la lecture et la construction de la scène s'enchaînent sans attente dans une seule tâche : les « tâches longues » mesurent surtout la construction de la scène (SwiftShader), pas le niveau ; la colonne « fil principal dans le chargeur » est la bonne.

**2. Respirations.** Règle : toute variante d'un morceau `respiration` a une exigence ≤ 2 (aux deux entrées), testée sur tout le catalogue.
- `tunnel` : plafond relevé d'une rangée (4 rangées libres au lieu de 3 : les petits sauts ne se cognent plus), bosses tous les 4 tuiles au lieu de 3 ; la variante `+plafond:pics` (la plus dure) est remplacée par un second `+denivele:2` ; **exigences 1 à 3 → 1 à 2 pour toutes ses variantes**, aucune n'est devenue au pas près. L'étiquette est gardée.
- **`escalier` aussi dépassait** (variantes à 4 et à 5 : `large=2` et `large=2 +sol-friable`) : ces deux variantes sont remplacées par `large=3 +ressort` et `large=1 +ressort` (une première tentative, `large=3 +denivele:2`, faisait un plat de 10 tuiles, refusé par la règle des plats). Toutes ses variantes sont maintenant à 1–2.
- Les quatre autres respirations (`corniches`, `descente`, `petits-trous`, `rebonds-doux`) étaient déjà ≤ 2, sans nouvelle résolution.

**3. Tension.** Règle testée : dernier tiers ≥ deuxième tiers, en plus de dernier ≥ premier. 120 dates, 6 tirages par jour :

| Pilotage | Tirages validés | Secours | Tiers 1 · 2 · 3 (dixièmes) |
|---|---|---|---|
| g3 (avant le lot) | 66,3 % | 0 | 15,1 · 27,6 · 27,1 |
| g4, nouveau catalogue, règle seule non appliquée | 67,6 % | 0 | 15,3 · 24,7 · 29,8 |
| g4, règle appliquée, pilotage inchangé (profil 1,0→3,0, correction 60 % dès 33 %) | **42,1 %** | 0 | 15,6 · 22,0 · 32,6 (2 jours sans tirage valide dans les 6 premiers) |
| profil 1,0→3,0, correction 60 % dès 50 % | 52,0 % | 0 | 15,7 · 21,3 · 33,0 |
| profil 1,0→3,4, correction 60 % dès 50 % | 53,7 % | 0 | 15,9 · 21,2 · 33,7 |
| profil 1,0→3,6, correction 60 % dès 70 % | 58,3 % | 0 | 16,6 · 20,2 · 33,4 |
| profil 1,0→3,6, correction 150 % dès 60 % | 56,9 % | 0 | 16,4 · 20,5 · 32,1 |
| profil 1,0→3,4, correction 100 % dès 60 % | 59,9 % | 0 | 16,3 · 20,1 · 33,8 |
| **retenu : profil 1,0→3,6, correction 100 % dès 60 %** | **61,8 %** | **0** | **16,2 · 20,5 · 34,5** |

**Décision : la règle est appliquée** (≥ 60 %, secours 0) avec `PROFILE_END` 36, `EXIGENCE_STEER` 100, `STEER_FROM` 600. La marge sur le seuil est mince (1,8 point) : le taux a baissé de 6 points par rapport au g3, c'est le prix de la règle. La tension monte maintenant franchement (16 → 20 → 35 au lieu de 15 → 28 → 27) : le milieu est plus calme (la respiration y est maintenant vraiment douce), la fin plus dure.

**4. Versions.** `JUMP_GENERATOR_VERSION` 4 (`…-g4`), `JUMP_SIM_VERSION` 3. Golden régénérés (`daily-golden.json`) : le catalogue (`tunnel`, `escalier`) et le pilotage de l'exigence changent le niveau de chaque date, les temps d'auteur suivent ; les golden de la simulation et de DailyTrack sont inchangés.

## `measure:jump` (120 dates, du 16/10/2026 au 12/02/2027)
| mesure | g3 (avant) | g4 (après) |
|---|---|---|
| tirages validés | 477 (66,3 %) | **445 (61,8 %)** |
| tirages composés | 622 | 649 |
| niveau de secours | 0 | **0** |
| temps de l'auteur : min · moy. · max | 28,17 · 29,69 · 32,00 s | 28,18 · 29,63 · 31,44 s |
| exigence par minute (fenêtre 445–540) | 497,0 | 500,5 (446–529) |
| exigence par tiers (moyenne) | 15,1 · 27,6 · 27,1 | **16,2 · 20,5 · 34,5** |
| `tunnel` : niveaux qui l'emploient | 30 | 39 |
| `escalier` : niveaux qui l'emploient | 34 | 21 |
| respirations par niveau | 1,00 (120/120) | 1,00 (120/120) |
| morceaux en commun d'un jour au suivant | 1,05 (max 4) | 0,96 (max 4) |
| enchaînements longs par niveau | 1,62 | 1,73 |
| course à vide aux raccords | 4,1 % (max 6,0) | 4,1 % (max 5,8) |
| génération d'un niveau, Node : moy. · max | 114,8 · 386,7 ms | 91,8 · 153,6 ms (bruit de machine) |
| rejeu de la preuve, Node : moy. · max | 3,75 · 8,10 ms | 3,94 · 7,80 ms |

`tunnel` sort plus souvent parce qu'il est devenu la respiration la plus douce (le générateur choisit la variante la plus proche de son profil, et la respiration du milieu doit rester calme). À surveiller si on veut plus de variété de respirations (nouveaux morceaux : hors périmètre).

## Vérifié / non vérifié / décisions pour Nathan
**Vérifié** : tests unitaires de `core`, `jump-sim`, `apps/jump` (le worker rend la même empreinte que l'appel direct sur 4 dates, cache lu / absent / périmé / preuve corrompue / contenu illisible / stockage qui lève / sans stockage, repli de 5 façons, règle des respirations sur tout le catalogue, règle de tension sur 60 dates) ; tests de DailyTrack (`packages/sim`, `apps/web`) inchangés et verts ; `tsc -b` ; e2e Chromium de DailyJump (75 passés, dont les 6 nouveaux : état de chargement, relecture du cache sans nouveau worker, cache corrompu régénéré, repli sans `Worker`, stockage refusé, `?seed=…&solution` au temps de l'auteur depuis le worker puis depuis le cache).
**Non vérifié** : Firefox et WebKit en local (seul Chromium est installé ici) — la CI les lance ; le worker de module n'a donc pas été vu sous Firefox/WebKit par moi (le repli sans worker est testé, et couvre un échec de chargement du script) ; la rapidité sur un vrai téléphone (la mesure est un ralentissement ×4 du processeur dans Chromium).
**Pour Nathan** : (1) la marge de 1,8 point sur le seuil de 60 % est mince — acceptable ? sinon on relâche la règle en « dernier tiers ≥ deuxième − 2 dixièmes » ; (2) `escalier` portait lui aussi l'étiquette `respiration` avec des variantes dures : je l'ai adouci plutôt que de lui retirer l'étiquette (deux variantes remplacées) ; (3) le worker double le poids du JavaScript de simulation chargé (≈ 189 ko non compressés, mis en cache par le navigateur) ; (4) un cache sain est lu sans attendre : les « tâches longues » du premier écran sont dues à la construction de la scène, un autre lot pourrait la découper.
