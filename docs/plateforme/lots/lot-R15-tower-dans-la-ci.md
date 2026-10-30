# Lot R15 — Tower dans la CI

**Pour les joueurs : rien.** Aucun code de jeu modifié, golden inchangés, aucune dépendance ajoutée. PR brouillon : [#199](https://github.com/Nathan-Te/DailyTrack/pull/199).

## Ce qui est branché
- **Zones et étiquette** (`scripts/zones-jeu.mjs`, `ci-scope.mjs`) : `apps/tower/**`, `packages/tower-sim/**`, `apps/api/src/tower*.ts` (+ tests et `scripts/tower-*.ts`), `docs/tower/**` ; étiquette `jeu:tower` (ou `tower` dans la branche). Exceptions tolérées : celles des autres jeux.
- **Specs** (`e2e/zones.json`, `scripts/ci-zones.mjs`, `apps/tower/e2e/durees.json`) : zones `tower-sim`, `tower-jeu`, `tower-banc` ; fumée `tower` = les trois specs. Projet Playwright `tower-<navigateur>`.
- **`ci.yml`** : Tower dans `e2e-pr`, une part Chromium dans la CI complète, une étape « Tower, petit ensemble » dans les jobs Firefox et WebKit. **`tower-essai.yml` supprimé** ; `npm run verifier` lance aussi Tower.

## Classement des specs (`docs/tests.md`)
| Spec | Famille | Durée CI |
|---|---|---|
| `determinisme` (4 tests, dont 2 `@navigateurs`) | Essentiel | 2–3 s |
| `partie` (une partie complète) | Essentiel | 1 s |
| `poids` (budget, sans navigateur) | Essentiel (fumée) | < 1 s |
Aucun « Régression » ni « Outil » : j'ai laissé les 2 tests de démonstration du banc dans l'Essentiel (≈ 1 s chacun, et ajouter `@regression` modifierait un test de Tower).

## Petit ensemble
Firefox : 2 tests `determinisme` (moteurs A et B) verts, 7 s. WebKit : verts, 3 s. Chromium (main) : les 3 specs verts.

## Budget (`apps/tower/e2e/poids.spec.ts` lit `budgets.md`)
Tower **n'avait aucun budget chiffré** (le lot T1 le disait) : **je les ai posés, à valider par Nathan** — aucun chiffre existant n'est relevé. Mesure `mesureTower` (gzip par défaut, comme Track et Jump) :
| Ligne | Budget | Mesuré | Marge |
|---|---|---|---|
| `tower.jsCss` (page du jeu) | 160 000 | 157 670 | 2 330 (1,5 %) |
| `tower.physique` (Rapier + `.wasm`, à la demande) | 1 000 000 (le « ≈ 1 Mo » accepté au T0) | 959 781 | 40 219 |
| `tower.anglais` / `tower.polices` | 8 000 / 153 600 (comme Track et Jump) | 2 424 / 77 688 | 5 576 / 75 912 |
Ce qui coûte : le JavaScript du jeu (three.js compris, ≈ 147 ko) pour le premier chargement ; ensuite la physique, dont le `.wasm` seul pèse 924 543 o (96 % de la ligne).

## Durées
- **PR de Tower seule** (`node scripts/ci-zones.mjs` sur `apps/tower/src/jeu.ts`, `hud.ts`) : 3 specs (≈ 4 s), 1 part e2e, 8 fichiers de tests unitaires (≈ 8 s estimés). **Non mesuré sur une PR de Tower seule** (la sortie de `ci-zones` est ci-dessous) ; cette PR touche des zones partagées : 4,7 min de mur, run 41079254451, dont l'étape Tower = 6 s. Le plafond de 6 min tient avec ample marge.
- **Unitaires** : `banc.test.ts` (59 s en local, ≈ 30 s en CI estimés) pesait 5 s par défaut dans les parts ; durées de Tower ajoutées à `scripts/unit-durees.json` (ces tests tournaient déjà).
- **Mode `main`** (forcé une fois sur la PR, run 41080224473, puis retiré) : 62 min de jobs, 10 min de mur, contre 55 min / 8,9 min pour le `main` voisin (41080005402) : **+7 min de jobs**, dont les specs de Tower ≈ 16 s ; le reste, c'est le **job Chromium de Tower** (≈ 1 min de mise en place par run) et la variance des runs. Pour le retirer : plier l'étape Tower dans le job Jump (+10 s de mur) — à décider.

## Protection de `main`
Rien à changer : les statuts requis restent `test` et `e2e` (`CLAUDE.md`) ; `tower-essai.yml` se disait « non requis » et plus aucun fichier ne le cite. **Non vérifié** : je ne lis pas les réglages GitHub — vérifier dans Settings › Branches qu'aucun contrôle `determinisme (…)` n'est requis.

## Vérifié / non vérifié
- **Vérifié** : `npm run verifier` vert en local (412 s, dont Tower) ; tests de plomberie (`ciZones`, `e2eParts`, `ciE2e` de Jump et de Tower, `zonesJeu`, `ciScope`, `budgets`) verts ; `node scripts/securite-workflows.mjs` : 0 écart ; CI de PR verte (run 41079254451).
- **Run « main » forcé : rouge, hors zone.** Le seul échec est `web/iphone.spec.ts` (« Retrouver mon profil », Firefox, `@navigateurs`) dans le job « e2e-parts (firefox, petit ensemble) » ; **le même job est rouge sur les 4 derniers runs de `main`** (dont ceux des fusions des lots T0 et T1). Tower y est vert partout. Règle d'arrêt : non corrigé ici, Nathan tranche.
- **Non vérifié** : CI de PR d'un lot de Tower seul (estimée) ; protection de `main` ; budgets (valeurs à valider).

## Scénario pour Nathan (2 clics)
1. `printf 'apps/tower/src/jeu.ts\napps/tower/src/hud.ts\n' | node scripts/ci-zones.mjs 2>&1 >/dev/null` :
```
Mode pr
Tests unitaires : 8 fichier(s), 1 part(s) 8 s
e2e (Chromium) : 0 spec(s) DailyTrack, 0 spec(s) DailyJump, 3 spec(s) Tower, 1 part(s) 4 s
  · tower/determinisme.spec.ts · tower/partie.spec.ts · tower/poids.spec.ts
```
Aucun spec de Track ni de Jump.
2. Actions › le run de la PR : `e2e-pr` a un pas « Tests e2e Tower (Chromium) » ; Actions › le run 41080224473 (mode `main`, forcé) : « e2e-parts (firefox / webkit, petit ensemble) » ont un pas « Tests e2e Tower, petit ensemble » ; plus de workflow « Tower — essai de la physique ».
