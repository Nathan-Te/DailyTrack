# Lot 26 — Ponts à interrupteur (nuit) et équilibre des mécaniques (DailyJump)

Versions : `JUMP_SIM_VERSION` **10** (nouvelle : v3 à v9 se jouent toujours, chaque niveau porte sa version) · `JUMP_GENERATOR_VERSION` **20** (identifiants `…-g20`, `BRIDGE_GENERATOR`) · `VARIETY_DAYS` **4** (inchangé). Branche `claude/clever-turing-ybia1h`, PR brouillon `jeu:jump`. Règles : `packages/jump-sim/CLAUDE.md` (« Ponts à interrupteur (lot 26) », « Variété ») et `apps/jump/CLAUDE.md` (« Ponts à interrupteur (lot 26) »).

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté sur la PR) ; en local : `npm run dev:jump`. (`&solution` et `?semaine` ne fonctionnent que hors production.)

1. **Un pont coudé, à l'arrêt** : `<aperçu>?module=pont-coude&variante=0&entree=arret` (une rangée de tuiles qui se redresse en pilier : on se pose sur l'interrupteur à gauche, le pont s'allume, il faut le longer puis escalader le pilier avant que la vague d'extinction n'arrive) ; `&debug` ajoute `__jump.bridges` ; `&solution` rejoue la solution enregistrée. **En marches** : `<aperçu>?module=pont-marches&variante=0&entree=arret`. La galerie : `<aperçu>?modules` (étiquette « pont », sept morceaux).
2. **Un jour de nuit g20 qui contient deux morceaux à ponts** : `2026-12-17` (`pont-clignotant-relais` : un pont suivi de blocs clignotants, et `pont-clignotant-escalier`) :
   - **sans `&debug`** : `<aperçu>?seed=2026-12-17` ; **avec** : `<aperçu>?seed=2026-12-17&debug` (limites des morceaux, `__jump.bridges`, trajets des voies lentes) ; `&solution` rejoue la preuve de l'auteur ;
   - autres jours à deux ponts : `2026-11-27` (`pont-coude` et `pont-marches`, deux ponts non droits), `2026-12-01` (relais et `pont-etroit`), `2026-12-26`, `2027-01-03` ; la semaine d'un coup : `<aperçu>?semaine=2026-12-14&debug`.

## 1. Simulation (v10) — ce qui a été retenu

| point | valeur retenue |
|---|---|
| pont | annexe `pont <id> <délai> <col,rangée> <tuiles>…` : l'interrupteur (un `#` du sol) puis les tuiles dans l'ordre d'extinction (`c,r`, `c0-c1,r`, `c,r0-r1`) ; au plus 24 tuiles, toutes vides dans la grille ; hors horloge |
| **allumage** | le pas où le personnage **se pose** sur l'interrupteur (au sol, la tuile sous ses pieds, absent de l'interrupteur au pas d'avant : y marcher depuis le sol voisin compte, rester debout dessus non) : âge 1, tout le pont plein |
| **délai** | **au moins 120 pas (1 s)**, au plus 1 200 ; la tuile de rang `k` reste pleine pour l'âge de 1 à `délai + 16 k` (testé au pas près) |
| **vitesse d'extinction** | **`BRIDGE_STEP` = 16 pas par tuile = 7,5 tuiles/s = 68 % de la course** (11 tuiles/s) : « environ 70 % », constante de la simulation (15 pas aurait donné 74 %) |
| chute, rallumage | une tuile qui s'éteint sous le personnage le laisse tomber ; se poser de nouveau remet l'âge à 1 (tout se rallume, le délai repart) ; règle de sortie des clignotants (jamais coincé dans une tuile qui se rallume) |
| reprise | tout éteint à la mort, comme les friables ; le pont continue de s'éteindre pendant l'attente (affichage) |

Golden v3 à v9 **identiques au bit** (`daily-golden*.json`, `replay-golden*.json`) ; un niveau sans pont est identique en v9 et en v10 sur 1 500 pas ; références `…-v10.json` (jour : 17/12/2026).

### Règles du générateur (`ponts.ts`)
Dans son morceau ; **aucun point de passage ni départ sur un pont ou un interrupteur** ; un interrupteur où l'on se tient (plein, deux tuiles libres au-dessus, rien de mortel) ; **un pont droit reste court** (12 tuiles au plus à la même rangée) ; **poursuite franche, vérifiée dans la vraie simulation** : la solution de chaque entrée est rejouée avec les extinctions **48 pas (0,4 s) plus tôt** et doit arriver au même pas ; **le pont est nécessaire** (la solution n'arrive pas sans lui). Toutes les règles existantes s'appliquent (solveur, attente ≤ 12 s, lot 8c, `voies:modules` : 0 variante fermée, plats, W = 4, reprise près d'une voie lente). La plus longue course sans saut reste la règle d'avant (moyenne 1,3 s, 2 s au plus).

## 2. Les 7 morceaux de la nuit (28 variantes, `theme: nuit`, réservés à la v10)

Note = la plus haute des deux entrées, dans l'ordre des variantes ; **avance** = ce que la solution la plus juste laisse sur l'extinction (exigé : 48 pas), mesurée par `npm run ponts:modules -w @cdj/jump-sim`.

| morceau | idée | notes | délais (pas) · avance min |
|---|---|---|---|
| `pont-ilots` | **respiration** : quatre îlots au-dessus des pics, trois sauts | 2 2 1 1 | 270–360 · 193 |
| `pont-marches` | **non droit** : quatre marches qui montent | 2 3 2 5 | 135–180 · 65 |
| `pont-coude` | **non droit, portion dure** : une rangée, puis un pilier de trois tuiles à escalader | **4 4 2 4** | 165–240 · 121 |
| `pont-etroit` | **portion dure** : îlots d'une tuile en zigzag | 3 **4 4 4** | 170–215 · 50 |
| `pont-vertige` | cinq marches isolées vers une corniche | 1 3 **4** 1 | 135–180 · 81 |
| `pont-clignotant-relais` | **pont + clignotants** : le pont, puis des blocs `b` / `d` | 2 3 2 1 | 240–300 · 207 |
| `pont-clignotant-escalier` | **pont + clignotants** : marches de pont, puis marches clignotantes | 2 **5** 2 2 | 240–300 · 168 |

Demande : 1 respiration (✓ note ≤ 2, trois sauts, délai généreux, testé) · 2 portions dures (✓ cinq morceaux ont au moins une variante à 4 ou 5, aucune fermée par `voies:modules` ; les « dures » de référence : `pont-coude`, `pont-etroit`) · 2 ponts non droits (✓ marches, coude) · 2 combinaisons avec les clignotants (✓).

## 3. Variantes et idées refusées (une ligne chacune)

- **`pont-etroit` avec un délai de 120 à 140 pas** : la solution n'avait que 4 à 31 pas d'avance (poursuite franche refusée) ; délais portés à 170–215.
- **`pont-clignotant-relais`, premier dessin** : les blocs clignotants à 7 tuiles de la rive se franchissaient d'un bond, le pont ne servait à rien (avance « infinie ») ; écart porté à 9 tuiles, et la règle « le pont est nécessaire » est née.
- **`pont-coude`, rive d'arrivée de 9 tuiles** : plat sans défi de plus de 6 tuiles (règle des plats) ; rive ramenée à 6.
- **`pont-vertige` dans une grille de 12 rangées** : corniche sous la 4e rangée (palier sans 4 rangées libres) ; grille de 14.
- **Limite connue, rien d'écrit** : une plage `repeter` ne sait pas multiplier les tuiles d'un pont (l'annexe les énumère) : les variantes d'un morceau à pont ne varient que par leurs délais et leurs cycles.

## 4. Équilibre des mécaniques : part des jours qui contiennent l'élément (365 dates, du 27/10/2026)

Règle (v10) : au plus 2 morceaux à l'élément du lot par jour, au moins 1 morceau d'origine sans l'élément ; **un jour sur quatre sans élément** (`ELEMENT_DAY_PERMILLE` = 750, tiré de la date seule ; un jour à élément en a 1 ou 2).

| thème · élément | avant (g19) | après (g20) | jours à plus de 2 éléments avant → après | sans morceau d'origine seul avant → après |
|---|---|---|---|---|
| forêt · champignon | 81 % | **72 %** | 8 → 0 | 2 → 0 |
| usine · presse | 94 % | **70 %** | 17 → 0 | 2 → 0 |
| glace · stalactite | 82 % | **81 %** | 7 → 0 | 1 → 0 |
| **nuit · pont** | 0 % (pas encore de pont) | **80 %** | — | 0 → 0 |
| néon · laser | **96 %** (23 jours sur 23 sur les 120 premières dates) | **68 %** | 21 → 0 | 4 → 0 |

Les cinq thèmes sont dans la cible de 60 à 85 %. Sur 120 dates l'échantillon est plus bruité (usine 56 %, néon 61 %) : la part visée est de 75 %.

## 5. Mesures, g20 contre g19 (120 dates du 16/10/2026 au 12/02/2027, `measure:jump`)

| mesure | g19 (lot 25) | g20 |
|---|---|---|
| tirages validés · des composés | 173 (17,2 %) · 30,9 % | 169 (13,7 %) · 27,3 % |
| **niveau de secours utilisé** | **0** | **0** |
| tirage retenu (moyenne · max) | 4,66 · 40 | 6,72 · 71 |
| temps de l'auteur (min · moyenne · max) | 27,98 · 29,49 · 31,97 s | 28,01 · 29,58 · 31,94 s |
| morceaux par niveau · exigence par minute | 10,3 · 490,8 | 10,6 · 492,2 |
| voies lentes par niveau · cages montées | 1,9 · 16/225 | 1,8 · 22/214 |
| morceaux en commun entre deux jours consécutifs (moyenne · max) | 0,03 · 2 | 0,03 · 2 (les jours d'avant le 27/10, hors règle) |
| **plus longue course au sol sans saut** (moyenne · max) | 1,25 s · 2,00 s | **1,18 s** · 1,86 s |
| génération d'un niveau, tirages et rejeux compris (moyenne · max) | 78,3 · 397,9 ms | 69,0 · 461,6 ms |
| budget Jump (JS + CSS, premier chargement) | 352 182 o | 358 034 o (+5 852, marge 20 456) |

La règle d'équilibre rend la composition plus étroite (moins de tirages validés, un jour a demandé 71 tirages) mais aucune mesure ne sort de ses cibles ; la plus longue course moyenne (1,18 s) est **sous** la cible de 1,3 s.

## 6. W = 4 sur 365 dates, et mesure de W = 5

- **W = 4 tient** (`variete:jump`, 365 dates du 27/10/2026) : **0 secours, aucun retour avant 4 jours** (écart minimal 4, moyenne 11,09, médiane 7) ; 125 morceaux de base employés sur 125 (les 7 ponts compris) ; distincts sur 7 / 30 jours glissants : 65,0 / 107,4. **Génération à froid (48 dates, dépendances comprises) : 0,21 s en moyenne, 0,74 s au plus**, aucune au-dessus de 1,5 s.
- **W = 5, une seule passe, sans l'activer** (`VARIETY_DAYS` posé à 5 le temps de la mesure, `figes:jump` relancé, puis tout rétabli : `src/figes.ts` et la constante sont ceux de `main`, `figes:jump -- --verifier` à jour) : **36 secours sur 365 dates (9,9 %)**, des retours avant 5 jours à cause d'eux ; génération à froid (48 dates) 0,25 s en moyenne, 0,68 s au plus. **Réserve** (méthode du lot 19, seuil de g14) : il manque encore **≈ 18 morceaux communs** pour W = 5 (le pire jour du pire thème ; ≈ 25 au lot 25, ≈ 21 à W = 3 avec g18) : les sept ponts et l'équilibre ont rapproché W = 5 mais il reste hors de portée.

## 7. Décisions, vérifié, non vérifié

- **À décider (Nathan)** : (1) `ELEMENT_DAY_PERMILLE` = 750 (cinq thèmes entre 68 et 81 % sur 365 dates ; 700 ou 800 se règle en une constante) ; (2) la vitesse d'extinction (68 % de la course) et l'avance de 0,4 s : des constantes (`BRIDGE_STEP`, `BRIDGE_CHASE_MARGIN`) ; (3) les délais des morceaux de la nuit (certains à 1,1 s d'avance seulement) ; (4) **index du `CLAUDE.md` racine** (zone partagée, non touchée) : y ajouter « Ponts à interrupteur (lot 26) » sous `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`. (5) **À signaler (hors périmètre, serveur)** : `apps/api/src/jumpLives.ts` compte les morts par cause sur six cases (`causes: [0, 0, 0, 0, 0, 0]`) : la cause « laser » (6, lot 25) n'y a pas de case (elle compte dans le total).
- **Jours** : g20 commence au jour de bascule choisi par « Mettre en production » ; **aucun jour public ni figé touché** (`figes:jump -- --verifier` à jour). Démonstration `public/demo/` régénérée (`jump:seed`).
- **Tests corrigés avec leur raison** : versions attendues (`constants`, `rediffusion`, `smoke.spec`, `horloge`) ; références v10 nouvelles ; `blocks.test.ts` et `themes.test.ts` (la nuit a deux mécaniques) ; `EVENT_KINDS` passe à 32 (`pontAllume`) ; `plateformes.spec.ts` (durée 19 → 22 s) ; `apps/api/test/jumpLives.test.ts` : les vies fictives d'un jour de g20 attendent parfois longtemps (une horloge à aligner) et un lot de 25 dépassait les 5 minutes rejouées par lot : on garde les morts de moins de 15 s (70 essais au lieu de 40).
- **Vérifié** : tests unitaires (jump-sim, apps/jump, apps/api sur SQLite), e2e Chromium de `plateformes` (dont les deux nouveaux : pont coudé pas à pas, jour de nuit à deux ponts), construction, typecheck, 365 dates sans secours, captures du pont (éteint, allumé, jauge, vague d'extinction, voisinage des blocs clignotants : regardées en local). **Non vérifié** : Firefox et WebKit (la CI complète de `main`), le rendu sur téléphone, la fluidité à ×4, libSQL (la CI).
