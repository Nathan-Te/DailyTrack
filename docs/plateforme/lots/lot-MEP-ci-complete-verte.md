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
| `jump/e2e/plateformes.spec.ts:184` › « un morceau à presse » (**WebKit seulement**, deux essais sur deux ; run complet 40413669420) | `footprint` valait encore `0.08` (repos). `__jump.presses.warn` (`apps/jump/src/main.ts:2269`) est celui de la **simulation** et écrase celui du dessin : le `waitForFunction` du test était vrai dès la fin de `advance`, sans qu'aucune image n'ait été dessinée, et la lecture suivante tombait avant le dessin. Course entre dessin et lecture, jamais vue sous Chromium et Firefox (les images y arrivent plus vite) ; pas un défaut du jeu | le test attend aussi `footprint > 0.08` (l'état que le dessin pose et que l'assertion lit) ; assertions inchangées. Chromium : 3 passages ; **WebKit non reproduit ici** (non installé), ligne ajoutée à `e2e/stabilite.json` |
| instable `salon.spec.ts` › « le classement final reste 8 s… » (Chromium) | « images pendant le classement final » = 0 : la fenêtre de contrôle commençait à `fin + écart maximal + 0,6 s` ; avec une image toutes les 2 à 3 s (deux pages en rendu logiciel ; la trace montre 15 s pour noter 6 images) elle pouvait ne contenir aucune image. Ce n'est pas un défaut du Salon | la fenêtre commence à la deuxième image après la fin ; les assertions de fond (identifiant inchangé, classement visible, bascule au même instant) sont inchangées |

## Vrais défauts trouvés
Aucun dans le code des jeux ni du serveur : tous les rouges sont des tests (date en dur, délai, cadence, course dessin / lecture) ou l'infrastructure de CI (apt). Aucun comportement, golden ni jour servi n'a changé. **Une remarque pour Nathan, non corrigée (code du jeu)** : dans `__jump.presses`, `warn` de la simulation écrase celui du dessin, donc l'assertion `expect(mid.warn[0]).toBeCloseTo(0.5)` du spec compare la simulation à elle-même ; elle ne prouve pas que l'annonce dessinée est celle de la simulation. Le corriger demande d'exposer les deux (`simWarn`) : à décider avec le lot Jump.

## Règles ajoutées (`CLAUDE.md` racine, « Tests et CI »)
Un test ne compare jamais à une date écrite en dur (la source : `config/lancement.json`) ; les installations apt de la CI se bornent par la configuration d'apt, jamais en tuant `npx` (verrou dpkg gardé).

## Pour R11 et la suite
`jours-passes.json` est vide : R11 se met à jour après ce lot (la PR « Jours figés » le remplira à la première mise en production).

## Vérifié / non vérifié
- Vérifié en local (`npm run verifier`, vert) : typecheck, unitaires SQLite et libSQL, e2e DailyTrack (21 specs) et DailyJump (5) ; le spec Salon 3 fois de suite sans relance.
- Vérifié en CI : voir « Runs de CI ». **Pas encore vérifié** : la CI complète (trois navigateurs) sur la branche, l'étape apt face à un miroir encore plus lent que 10 min, la CI de `main` après fusion.
- Point de vigilance : une installation apt de 10 min a été observée (limite 15 min) ; un miroir plus lent ferait échouer l'étape.

## Runs de CI
- [40399054124](https://github.com/Nathan-Te/DailyTrack/actions/runs/40399054124) (`main`, a12d0ac) : rouge, analysé ci-dessus.
- [40407200339](https://github.com/Nathan-Te/DailyTrack/actions/runs/40407200339) (PR, 427c082) : rouge — `e2e-pr (3/4)`, `install-deps chromium` : miroir apt lent (≈ 50 ko/s), mon `timeout 300` a tué `npx` mais pas `apt-get` (verrou dpkg), les 2 essais suivants ont échoué ; la construction a été sautée, puis « DailyJump » a échoué en conséquence (`config.webServer` 60 s). Tous les autres jobs verts.
- [40408167715](https://github.com/Nathan-Te/DailyTrack/actions/runs/40408167715) (déclenchement manuel, 427c082) : annulé après ≈ 90 s, aucun test en échec (je ne sais pas qui l'a annulé).
- [40408883311](https://github.com/Nathan-Te/DailyTrack/actions/runs/40408883311) (PR, fce2505, apt réglé par sa configuration) : **annulé à 22:17, pas en échec** — le run 776 (ancien commit) a été relancé à 22:16:51 et, dans le même groupe de concurrence, a annulé celui-ci. Avant l'annulation : `zones`, `scope`, `unit`, `api-image`, `test`, `e2e-pr` 2/4, 3/4 et 4/4 verts ; l'installation apt de 3/4 a pris 3 min 55 s (échec au run précédent), celle de 1/4 **10 min 1 s** (réussie, sous les 15 min), puis ses specs ont été annulés après 7 min sans échec de test.
- [40411837328](https://github.com/Nathan-Te/DailyTrack/actions/runs/40411837328) (PR, c4cfb94) : **vert** (13,4 min) — `zones`, `scope`, `unit`, `e2e-pr` 1/4 à 4/4, `api-image`, `test`, `e2e`.
- [40413669420](https://github.com/Nathan-Te/DailyTrack/actions/runs/40413669420) (CI complète lancée par Nathan, c4cfb94) : **rouge sur un seul job** — `e2e-parts (jump webkit 1/1)`, le test des presses (ligne du tableau). Tout le reste vert : unitaires 3/3, Chromium 8/8, Firefox 2/2 et Jump 1/1, WebKit 2/2 (Track), Jump Chromium 3/3, `api-image`. Les deux jobs WebKit qui bloquaient 29 min sur `main` passent (installation apt courte).
- (à compléter : la CI de la PR et la preuve de stabilité sur la tête de branche, puis une nouvelle CI complète)
