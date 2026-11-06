# Lot « CI du bouton Mettre en production » du 06/11/2026

Run analysé : https://github.com/Nathan-Te/DailyTrack/actions/runs/42198926108 (`main` à `1eecaf0`, mode `production`). Quatre causes, trois corrections ; le run n'avait pas encore touché la production.

| Job rouge | Cause | Correction |
|---|---|---|
| `recette-serveur / deploy` (smoke) : « le temps cumulé… 666496 ms cumulées » | **Défaut serveur.** Rush (arcade, au temps, `cumul: false`) entrait dans le cumul du jour : seuls les jeux « hauteur » en étaient écartés. Le cumul d'un joueur aurait compté Rush, et « tout fini » l'aurait exigé. | `ligneDe(…, horsCumul)`, `classerLaJournee` (`horsCumul`), `bilanDe(…, toutJeu)`, `ClassementDuJour.lignes` ; `PortailDuJeu.cumul` posé par `jeux/module.ts`. Tests : `classementDuJour.test.ts`, `rush.test.ts`. |
| `e2e-parts (navigateurs webkit)` : `jump/smoke.spec.ts` fond 0,1979 < 0,2 | **Test dépendant du jour réel.** Le niveau d'aujourd'hui (usine) a 0,2006 de fond sous Chromium et 0,1979 sous WebKit ; sur 25 jours mesurés (Chromium) : 0,247 à 0,88. | Le spec joue le niveau du 03/11 (`?seed=`, 0,51), seuils inchangés. |
| `e2e-parts (tower chromium)` : `classement.spec.ts` « une copie est refusée » | « Envoi de ta partie… » dure plus que les 5 s par défaut de l'assertion sur l'exécuteur de la CI (page saturée 5 à 16 s après la fin de partie, déjà noté au lot « CI complète du 03/11 »). | Attente de l'état portée à 40 s (`ENVOI`) pour le rang, « nouveau record » et « copie » ; assertions inchangées. |
| `ci / e2e`, `ci-verdict`, `recette-verification` | Dérivés des trois ci-dessus. | — |

## Vérifié / non vérifié
- Vérifié en local : `npm run verifier -- --sans-e2e` (typecheck, 126 fichiers SQLite, 76 libSQL, verts) ; `vitest apps/api` complet (946 tests) ; `jump/e2e/smoke.spec.ts` (6, Chromium) ; `tower/e2e/classement.spec.ts` (5, Chromium).
- **Non vérifié** : WebKit (absent ici) et l'échec Tower, qui ne se reproduit pas en local (il ne dépend que de la lenteur de l'exécuteur) ; le smoke contre la vraie recette (un agent ne lance pas de workflow).
