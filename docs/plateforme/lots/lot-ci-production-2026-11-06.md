# Lot « CI du bouton Mettre en production » du 06/11/2026

Run analysé : https://github.com/Nathan-Te/DailyTrack/actions/runs/42198926108 (`main` à `1eecaf0`, mode `production`). Quatre causes, trois corrections ; le run n'avait pas encore touché la production.

| Job rouge | Cause | Correction |
|---|---|---|
| `recette-serveur / deploy` (smoke) : « le temps cumulé… 666496 ms cumulées » | **Défaut serveur.** Rush (arcade, au temps, `cumul: false`) entrait dans le cumul du jour : seuls les jeux « hauteur » en étaient écartés. Le cumul d'un joueur aurait compté Rush, et « tout fini » l'aurait exigé. | `ligneDe(…, horsCumul)`, `classerLaJournee` (`horsCumul`), `bilanDe(…, toutJeu)`, `ClassementDuJour.lignes` ; `PortailDuJeu.cumul` posé par `jeux/module.ts`. Tests : `classementDuJour.test.ts`, `rush.test.ts`. |
| `e2e-parts (navigateurs webkit)` : `jump/smoke.spec.ts` fond 0,1979 < 0,2 | **Test dépendant du jour réel.** Le niveau d'aujourd'hui (usine) a 0,2006 de fond sous Chromium et 0,1979 sous WebKit ; sur 25 jours mesurés (Chromium) : 0,247 à 0,88. | Le spec joue le niveau du 03/11 (`?seed=`, 0,51), seuils inchangés. |
| `e2e-parts (tower chromium)` : `classement.spec.ts` « une copie est refusée » | « Envoi de ta partie… » dure plus que les 5 s par défaut de l'assertion sur l'exécuteur de la CI (page saturée 5 à 16 s après la fin de partie, déjà noté au lot « CI complète du 03/11 »). | Attente de l'état portée à 40 s (`ENVOI`) pour le rang, « nouveau record » et « copie » ; assertions inchangées. |
| `ci / e2e`, `ci-verdict`, `recette-verification` | Dérivés des trois ci-dessus. | — |

## Deuxième run (42205919251, `main` à `323ce63`) : la CI, la recette serveur et la sauvegarde sont vertes ; reste `recette-verification`
| Job rouge | Cause | Correction |
|---|---|---|
| `recette-verification` (smoke complet **par le site**) : 7 ✗ « Cibles … 404 game_unavailable » | Cibles (jeu témoin) est **fermé (`off`) sur la recette**, alors que Tower, Blocks et Rush y sont ouverts. Le smoke ouvre un jeu `off` avec l'hôte d'un canal d'aperçu de PR (`X-Forwarded-Host`) ; Firebase Hosting **réécrit** cet en-tête, donc par le site le jeu reste fermé. Première mise en production depuis l'arrivée de Cibles (04/11). | `smoke.ts` : par une adresse de site (pas `*.run.app`, pas local), un jeu qui répond `404 game_unavailable` est noté « fermé » et ses routes ne se jouent pas ; en direct sur le service ou sur l'image de la CI, le 404 reste un échec. |

Contournement sans code, si besoin : `/admin/` › Jeux, passer Cibles en `preview` sur la **recette**.

## Vérifié / non vérifié
- Vérifié en local : `npm run verifier -- --sans-e2e` (typecheck, 126 fichiers SQLite, 76 libSQL, verts) ; `vitest apps/api` complet (946 tests) ; `jump/e2e/smoke.spec.ts` (6, Chromium) ; `tower/e2e/classement.spec.ts` (5, Chromium).
- Deuxième run : site de production assemblé en local (`VITE_PRODUCTION=1 npm run build`, `scripts/site.mjs --production` : 18 niveaux figés vérifiés) ; regex d'adresse contrôlée sur les six adresses (service, site, local, production).
- **Non vérifié** : WebKit (absent ici) et l'échec Tower, qui ne se reproduit pas en local (il ne dépend que de la lenteur de l'exécuteur) ; le smoke contre la vraie recette (un agent ne lance pas de workflow).
