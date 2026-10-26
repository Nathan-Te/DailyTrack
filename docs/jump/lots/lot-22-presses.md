# Lot 22 — Presses (DailyJump, thème usine)

Versions : `JUMP_SIM_VERSION` **6** (nouvelle : v3, v4 et v5 se jouent toujours, chaque niveau porte sa version) · `JUMP_GENERATOR_VERSION` **16** (identifiants `…-g16`, `PRESS_GENERATOR`) · `W` (délai de variété) reste **3**. Consignes : `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`, sections « Presses (lot 22) ». Tout est dans les zones de Jump ; seules exceptions tolérées : la ligne de Jump de `docs/plateforme/budgets.md` et `e2e/zones.json` (ligne du nouveau spec).

Images : `img/lot-22-annonce.png` (`?module=presse-couloir&variante=0&entree=arret&debug`, la presse de droite est en bas), `img/lot-22-impact.png` (l'impact de celle de gauche : face rouge, poussières), `img/lot-22-semaine-g16.png` (`?semaine=2026-11-15` : la miniature du 17/11 montre ses presses en rouge).

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté par `apercu.yml` sur la PR) ; en local : `npm run dev:jump`.

1. **Le premier morceau à presse, seul** (`presse-promenade`, la respiration : deux presses lentes, trois marches) :
   - `<aperçu>?module=presse-promenade&variante=0&entree=arret`
   - avec la surimpression : `…&debug` (`__jump.presses` : position dessinée, annonce, empreinte, poussières). `&solution` rejoue la solution gardée. Le premier de la galerie par ordre alphabétique est `presse-couloir` (`?module=presse-couloir&variante=0&entree=arret`) ; la galerie qui les filtre : `<aperçu>?modules` puis l'étiquette « presse » (7 morceaux).
2. **Un jour d'usine g16 qui contient au moins deux morceaux à presse** : `2026-11-17` (`presse-tapis-lance` v2 + `presse-ilot` v2, 3 presses) ou, plus dense, `2026-11-23` (4 morceaux, 7 presses) :
   - `<aperçu>?seed=2026-11-17` · `<aperçu>?seed=2026-11-17&debug` (limites des morceaux, `__jump.presses`, trajets de la voie lente) · `&solution` rejoue la preuve de l'auteur ;
   - la semaine d'un coup : `<aperçu>?semaine=2026-11-15&debug`.

## 1. Le profil de la presse

Un bloc de 2 ou 3 tuiles de large sur 2 de haut, qui descend de 2 à 8 tuiles et remonte. Annexe : `presse <id> <largeur> <col,rangée> <course> <attente> <chute> <pause> <remontée>`. Position `f(t + phase)` entière : la chute lit la table `k²` (65 entiers, chute libre), la remontée la table de ralenti du lot 20 à l'envers. **Toute la presse tue au contact** (`DEATH_PRESS`), on ne monte pas dessus.

| phase | borne de la règle | profil type du catalogue | valeurs du catalogue |
|---|---|---|---|
| attente en haut | 120 à 600 pas (≥ 1 s) | 240 pas (2 s) | 120 à 360 |
| chute rapide | 18 à 60 pas | 30 pas (0,25 s) : ≈ 1 080 u/pas à la fin pour 4 tuiles, jamais 3/4 de tuile par pas (`MAX_PRESS_STEP`) | 24 ou 30 |
| pause en bas | 30 à 240 pas | 60 pas (0,5 s) | 60 à 120 |
| remontée lente | ≥ 3 × la chute, ≤ 600 pas | 150 pas (1,25 s) : au plus ≈ 160 u/pas, 6,6 fois moins vite que la chute | 72 à 300 |

Cycle du profil type : 480 pas (4 s). **Annonce** (affichage) : 0,5 s (60 pas) avant que la chute parte.

## 2. Règles du générateur (`presses.ts`, `presseProblems`)

Sol plein dessous · place sûre pour attendre devant (4 colonnes, ni scie ni autre presse à aucun pas) · ni tapis qui porte vers elle (il finit à plus de 2 colonnes) ni vent à moins de 3 colonnes · rien dans sa course (scie, plateforme) · aucun point de passage dessous ni dans sa course, **sûr à toute phase** (`respawnProblems`, `palierProblems`) · à une colonne des bords de sa section. Toutes les règles existantes s'appliquent (solveur, 8 phases avec attente ≤ 12 s, règle du lot 8c, `voies:modules`, reprise près d'une voie lente). **Plusieurs presses d'un morceau ont le même cycle** (attentes différentes) : voir « variantes refusées ».

## 3. Les 7 morceaux (tous `theme: usine`, réservés à la v6 : `pressModuleIds()`)

Notes de jouabilité humaine de `solutions.json` : un chiffre par variante, en entrée à l'arrêt puis en élan. Toutes les variantes passent `solve:modules`, `phases:modules` (8 phases, attente ≤ 12 s : sortie de 2,1 à 7,9 s), `voies:modules` (aucune voie parasite fermée) et la règle du lot 8c ; aucune au pas près gardée.

| morceau | idée | étiquettes | variantes | arrêt | élan |
|---|---|---|---|---|---|
| `presse-promenade` | deux presses lentes, trois marches espacées (respiration) | respiration | 8 | 11111111 | 11111111 |
| `presse-couloir` | un couloir sous deux presses qui ne tombent pas ensemble | — | 7 | 3233521 | 4514411 |
| `presse-marche` | une estrade basse de plafond, la presse accrochée dessus | vertical | 5 | 11111 | 11111 |
| `presse-tapis-contre` | un tapis qui recule jusqu'à une presse, un pic, une seconde presse | **tapis**, précision | 7 | 2215351 | 1513241 |
| `presse-tapis-lance` | une presse, puis un tapis qui lance vers un fossé | **tapis** | 4 | 1111 | 1111 |
| `presse-rythme` | trois presses au même cycle, décalées | précision | 8 | 11424443 | 11311454 |
| `presse-ilot` | d'îlot en îlot au-dessus du vide, une presse sur chacun | précision | 7 | 1134112 | 1151123 |

- **1 respiration** : `presse-promenade` (note 1 partout, au moins 3 appuis de saut à chaque entrée, test).
- **2 portions dures (une variante notée 4 ou 5) et plus** : `presse-couloir` (v0, v1, v3, v4), `presse-rythme` (v2, v4 à v7), `presse-tapis-contre` (v1, v3, v5), `presse-ilot` (v2, v3).
- **2 morceaux qui combinent presses et tapis** : `presse-tapis-contre`, `presse-tapis-lance`. **Les presses sont le second élément de l'usine** : un morceau `presse` compte comme un morceau à tapis pour le quota de signature (20 à 40 % du temps) ; la part de la mécanique des jours d'usine passe de 28 % à 36 % en moyenne (g15 : 20 à 40 %, g16 : 32 à 40 %).

## 4. Variantes et idées refusées (une ligne chacune)

- Plusieurs presses de cycles différents (330, 360, 390 mêlés) : périodes de section de 34 576 pas et attentes de 125 s à la validation toutes phases ; **cycles égaux imposés**, un décalage par l'attente en haut.
- `presse-ilot` (3,3,390,180,150,60) : refusée aux phases 0, 97 et 146 ; remplacée sur place. `presse-ilot` (4,4,450,240,150,90) et `presse-tapis-contre` (10 tuiles, cycle 420, attentes 240 et 120) : « au pas près » (note 0), remplacées sur place.
- `presse-promenade` d'abord avec `+hausse:1` (marches de 2 tuiles) puis avec des marches proches : deux appuis seulement (une respiration en veut trois) ; refaite avec trois marches à 8 colonnes l'une de l'autre et deux presses.
- `presse-promenade` (attentes 240 et 180) : note 3 à l'arrêt (au plus 2 pour une respiration), remplacée.
- Un tapis qui porte vers une presse, même loin : refusé tant qu'il finit à moins de 2 colonnes de sa course (règle) ; les morceaux à tapis n'ont que des tapis qui reculent (`contre`) ou qui lancent **après** la presse (`lance`).
- Compter les presses seules hors du quota de l'usine : cassait l'équivalence « thème = mécanique » des tests de `themes.test.ts` ; on a étendu l'usine à deux éléments plutôt que d'affaiblir le test.
- Une secousse de caméra à l'impact : refusée par la règle du lot 14 (une presse tombe toutes les quelques secondes).

## 5. Mesures (120 dates du 16/10/2026 au 12/02/2027, comparées au § 3 du lot 20)

Chiffres du lot 20 (g15) relus dans son README ; la référence g15 relancée par le code actuel (`-- --generateur=15`) redonne ses chiffres au bit près (162 tirages validés, 0 secours).

| mesure | g15 (lot 20) | g16 |
|---|---|---|
| niveaux avec au moins une presse | 0 | **14** (33 morceaux ; 14 des 16 jours d'usine) |
| tirages validés · des composés | 162 (19,0 %) · 26,6 % | 179 (20,9 %) · 29,0 % |
| **niveau de secours utilisé** | **0** | **0** |
| temps de l'auteur (min · moyenne · max) | 28,07 · 29,62 · 31,85 s | 28,02 · 29,72 · 31,99 s |
| morceaux par niveau · exigence par minute | 10,7 · 491,4 | 10,7 · 490,8 |
| exigence du morceau le plus exigeant | 4,8 | 4,9 |
| voies lentes par niveau · cages montées | 1,9 · 20/223 | 1,9 · 23/232 |
| morceaux en commun entre deux jours consécutifs | 0,02 (max 2) | 0,03 (max 4 : le 25 et le 26/10, avant l'origine de la règle, deux jours figés en production) |
| un même morceau sur 7 jours glissants (au plus) | 3 | 3 |
| morceaux de base employés sur 365 jours | 91 sur 91 | **98 sur 98** |
| écart entre deux apparitions : minimum · moyenne · médiane | 3 · 8,26 · 6 j | 3 · 8,79 · 6 j |
| distincts sur 7 / 30 jours glissants (moyenne) | 58,3 / 86,1 | 58,9 / 90,8 |
| retours avant 4 / 5 / 7 jours | 19,0 / 34,9 / 57,4 % | 18,6 / 33,3 / 55,5 % |
| génération d'un niveau : moyenne · max (même machine, relancé, au calme) | 135,5 · 540,7 ms | 167,0 · 657,8 ms (+23 %) |
| génération à froid (48 dates) : moyenne · max | 0,45 · 1,00 s | 0,57 · 1,24 s (sous les 2 s) |

## 6. Réserve de l'usine (méthode du lot 19, seuil = la plus petite réserve de g14 à W = 3 ; `npm run variete:jump`, 365 dates)

| thème | seuil | W = 4 | W = 5 | W = 7 |
|---|---|---|---|---|
| usine | 12 | **0 · 0** (2 · 5 au lot 20) | **4 · 9** (10 · 15 au lot 20) | 15 · 23 (21 · 25) |

(jour moyen · pire jour ; nombre de morceaux de base à ajouter.) Les 7 morceaux comblent la réserve de l'usine : **W = 4 n'y manque plus de rien**, W = 5 manque encore 4 morceaux le jour moyen, 9 le pire jour. Mais la règle vaut pour tous les thèmes : forêt 5 · 10 / 14 · 22, glace 4 · 10 / 14 · 20, nuit 3 · 8 / 12 · 19, néon 2 · 8 / 12 · 18 : **pour W = 5 il manque encore ≈ 22 morceaux communs** (le pire jour du pire thème, la forêt ; 19 au lot 20), 10 pour W = 4. W reste à 3 (hors périmètre).

## 7. Décisions, vérifié, non vérifié

- **Jours** : g16 commence le 27/10/2026 ; **aucun jour public ni figé touché** (`apps/jump/public/levels/` n'a pas bougé, `figes:jump` n'a rien à refaire : aucun nouveau jour figé). La démonstration `public/demo/` est régénérée (`jump:seed`).
- **Budget** : Jump 327 459 → 332 291 o (+4 832 sur `main` à jour, plafond 378 490, marge 46 199) ; `docs/plateforme/budgets.md` mis à jour. Le catalogue n'est pas dans le premier chargement.
- **Golden** : v3, v4 et **v5 intacts** (`daily-golden*.json`, `replay-golden*.json`, test « un niveau sans presse est identique en v5 et en v6 ») ; nouvelles références v6 (`daily-golden-v6.json`, `replay-golden-v6.json`, jour de référence le 03/12 : deux presses et des morts avant et sur un point de passage).
- **Zones partagées non touchées** (à faire par un lot de la plateforme) : l'index du `CLAUDE.md` racine (« Presses (lot 22) » sous `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`). Étiquette de PR : `jeu:jump`.
- **À trancher par Nathan** : la fréquence des presses (14 jours d'usine sur 16, un à quatre morceaux ; la part de mécanique des jours d'usine monte à 36 % en moyenne, 40 % au plus) ; si un joueur trouve trop facile une presse dont l'attente en haut dure 2 s, raccourcir l'attente (minimum 1 s) est un changement de catalogue (g17).
- **Vérifié localement** : voir le rapport de la PR (tests unitaires de `jump-sim` et `apps/jump`, `npm run verifier`, e2e `presses.spec.ts` et `plateformes.spec.ts` en Chromium, captures ci-dessus). **Non vérifié** : Firefox et WebKit (la CI de la PR est en Chromium seulement), un carnage complet avec presses en conditions réelles (le facteur 35 % est testé en unitaire), la génération à froid sur une machine dédiée (le maximum de 1,24 s reste sous le seuil de 2 s de l'outil).
