# Lot de mise en production — CI complète de `main` verte (26/10/2026, lancement le 27)

Branche `claude/brave-tesla-22j3xh`. Point de départ : `main` au commit `a12d0ac` « Update lancement.json » (lancement passé au **2026-10-27** par Nathan : `config/lancement.json` n'est pas touché). Run rouge analysé : [40399054124](https://github.com/Nathan-Te/DailyTrack/actions/runs/40399054124). Ce lot ne lance ni la production ni aucun workflow.

## Chaque test rouge, sa cause, sa correction
| Test | Cause | Correction |
|---|---|---|
| `apps/portail/test/lancement.test.ts` (« une seule clé, une date valide ») | attendait `"2026-10-26"` et « un lundi » | vérifie une date du calendrier valide, sans la valeur |
| `apps/portail/test/jours.test.ts:47` | attendait `"2026-10-26"` | idem (`formatDay(parseDay(...))`) |
| `apps/api/test/classement.test.ts:89` (`20753` au lieu de `20752`) | **pas une mesure ni l'heure** : `daysFromCivil(2026, 10, 26)` écrit en dur, `20753` est le 27/10 | ligne retirée : la ligne d'avant compare déjà à `config/lancement.json` |
| `apps/api/test/jours-passes.test.ts:31` | `jours-passes.json` (R6) commençait au 26/10 ; la journée n° 1 est le 27 | le fichier est **vide** (aucun jour n'est « passé » avant une première mise en production après le lancement) ; le test exige, s'il n'est pas vide, un début à la journée n° 1 et aucun trou. Aucun circuit servi ne change |
| `packages/sim/test/generator.test.ts:60` (5 s) | six générations de circuit avec le délai par défaut | `timeout: 60_000` justifié dans le test (même ordre que le test voisin) |
| `e2e-parts (webkit 2/2)` et `(jump webkit 1/1)` annulés après 30 min | **aucun spec en cause** : l'étape `npx playwright install-deps webkit` (apt) est restée bloquée 29 min (la part 1/2 la finit en 30 s) ; le job n'a jamais démarré un spec | `ci.yml` : apt règle `Retries 3` et `Timeout 30` (une connexion muette échoue puis se retente), 15 min par étape d'installation. **Première version (boucle `timeout 300` × 3) retirée** : elle tuait `npx` mais pas `apt-get`, qui gardait le verrou dpkg ; sur un miroir lent elle a fait échouer `e2e-pr (3/4)` du run 40407200339 (voir « Runs de CI ») |
| instable `salon.spec.ts` › « le classement final reste 8 s… » (Chromium) | « images pendant le classement final » = 0 : la fenêtre de contrôle commençait à `fin + écart maximal + 0,6 s` ; avec une image toutes les 2 à 3 s (deux pages en rendu logiciel ; la trace montre 15 s pour noter 6 images) elle pouvait ne contenir aucune image. Ce n'est pas un défaut du Salon | la fenêtre commence à la deuxième image après la fin ; les assertions de fond (identifiant inchangé, classement visible, bascule au même instant) sont inchangées |

## Vrais défauts trouvés
Aucun dans le code des jeux ni du serveur : tous les rouges sont des tests (date en dur, délai, cadence) ou l'infrastructure de CI (apt). Aucun comportement, golden ni jour servi n'a changé.

## Règles ajoutées (`CLAUDE.md` racine, « Tests et CI »)
Un test ne compare jamais à une date écrite en dur (la source : `config/lancement.json`) ; les installations apt de la CI se bornent par la configuration d'apt, jamais en tuant `npx` (verrou dpkg gardé).

## Pour R11 et la suite
`jours-passes.json` est vide : R11 se met à jour après ce lot (la PR « Jours figés » le remplira à la première mise en production).

## Vérifié / non vérifié
Voir « Runs de CI » ci-dessous (rempli à la fin).

## Runs de CI
- [40399054124](https://github.com/Nathan-Te/DailyTrack/actions/runs/40399054124) (`main`, a12d0ac) : rouge, analysé ci-dessus.
- [40407200339](https://github.com/Nathan-Te/DailyTrack/actions/runs/40407200339) (PR, 427c082) : rouge — `e2e-pr (3/4)`, `install-deps chromium` : miroir apt lent (≈ 50 ko/s), mon `timeout 300` a tué `npx` mais pas `apt-get` (verrou dpkg), les 2 essais suivants ont échoué ; la construction a été sautée, puis « DailyJump » a échoué en conséquence (`config.webServer` 60 s). Tous les autres jobs verts.
- [40408167715](https://github.com/Nathan-Te/DailyTrack/actions/runs/40408167715) (déclenchement manuel, 427c082) : annulé après ≈ 90 s, aucun test en échec (je ne sais pas qui l'a annulé).
- (à compléter : la CI de la PR et la CI complète après la correction d'apt)
