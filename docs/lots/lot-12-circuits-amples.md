# Lot 12 — Circuits plus amples : durée et largeurs

**Essayer** : https://nathan-te.github.io/DailyTrack/b/lot-12-circuits-amples/?scenario=largeurs — trois largeurs de route (14, 20, 26 m), des transitions, une courbe ample (`R3`), un S large, un rétrécissement juste avant un virage serré.
**Puis un circuit du jour par thème** (même base, `?seed=` ; touche **T** pour le thème suivant, **N** pour une date au hasard) :
- Stade (trois largeurs, deux courbes amples) : https://nathan-te.github.io/DailyTrack/b/lot-12-circuits-amples/?seed=2026-11-13
- Rallye (trois largeurs, onze virages larges) : https://nathan-te.github.io/DailyTrack/b/lot-12-circuits-amples/?seed=2026-10-15
- Banquise (trois largeurs, un virage serré) : https://nathan-te.github.io/DailyTrack/b/lot-12-circuits-amples/?seed=2026-11-18
- Nuit (quatre courbes amples) : https://nathan-te.github.io/DailyTrack/b/lot-12-circuits-amples/?seed=2026-10-12
- Campagne (étranglement : la route se resserre à 14 m avant un virage serré sur la terre) : https://nathan-te.github.io/DailyTrack/b/lot-12-circuits-amples/?seed=2026-10-16

(Si l'environnement impose un autre nom de branche, remplacer `lot-12-circuits-amples` dans le lien ; une fois fusionné, les mêmes adresses marchent sur https://nathan-te.github.io/DailyTrack/ et le menu `/admin/` propose « Largeurs de route ».)

## Livré
- **Trois largeurs de route**, attribut de bloc : `e` étroite **14 m** (la largeur d'avant : les circuits écrits à la main et la rediffusion de référence sont **inchangés au bit près**), `n` normale **20 m**, `l` large **26 m**, dans une cellule de 32 m. Notation `S/n`, `L2/l`, `L3/lb`. Chaînée comme les hauteurs : un bloc sans largeur garde celle du précédent (14 m au départ) ; une largeur écrite doit la prolonger exactement, sinon `parseTrack` refuse (« marche de largeur »).
- **Blocs de transition** : une droite dont la largeur change (`S/e>n`, `S/n>l`, …) avec un lissage cubique (pente nulle aux deux bouts, 0,28 au plus pour 14 → 26 m) : rebords continus, sans marche ni angle vif. `world.sample` suit la demi-largeur ; `collide` incline la normale du rebord (la formule d'avant reste exacte quand la largeur est constante). Le générateur ne fait qu'un cran à la fois (14 ↔ 20 ↔ 26).
- **Départ, arrivée, portes et effets** : `Gate.halfWidth` (la tolérance de franchissement suit la route) ; plaques d'accélération et super turbo à la **moitié** de la largeur (3,5 m de demi-largeur sur 14 m, comme avant) ; damier, portes, bande de moteur coupé, marques de tremplin, sillons et lignes de rive suivent la largeur (`trackMesh.ts`).
- **Revêtements et effets dans chaque largeur** : tout est possible dans les trois largeurs (route, terre, glace, herbe ; plaque, super turbo, moteur coupé, tremplin, bosse). **Ce qui ne l'est pas** : une *transition* ne porte ni effet ni repère (elle reste une droite ordinaire, route ou revêtement) et un *virage* ne change pas de largeur. **Le virage serré en large** est géométriquement possible (rayon intérieur 3 m à 26 m) mais le générateur ne l'y met pas.
- **Courbes amples** : le **virage ample `L3` / `R3`** (3 × 3 cellules, rayon d'axe 80 m ; 8 cellules réservées, le coin intérieur n'étant jamais touché par la route) s'ajoute aux virages larges `L2` / `R2` ; le générateur en fait la base : S larges (`L2 R2`), demi-tours larges (`L2 L2`), virages relevés.
- **Virages serrés limités** : **au plus 2 par circuit** (passage signature compris), **jamais deux de suite**, jamais sur la route large.
- **Générateur** : 5 à 7 créneaux calme + virage ; **au moins deux largeurs** par circuit (sinon la tentative échoue) ; largeur de départ et changements tirés selon le thème : *Stade* et *Banquise* plutôt larges, *Rallye* et *Campagne* plutôt étroits, *Nuit* mélangé. **Signatures** : *Banquise* = chicane large sur glace ; *Campagne* = **étranglement** (la route se resserre à 14 m puis un virage serré sur la terre, puis s'élargit) ; les autres inchangées (la signature `dirtHairpin` devient `dirtPinch`).
- **Durée** : fenêtre du temps de l'auteur **30–40 s** (`AUTHOR_MIN_MS` / `AUTHOR_MAX_MS`, était 28–48 s) : une course correcte (or ×1,08 → 32–43 s) tient en 30–45 s.
- **Pilote** : l'écart latéral permis est `demi-largeur − 3,6 m` en chaque point : la corde s'ouvre avec la largeur (3,4 m de jeu à 14 m, 9,4 m à 26 m) ; un virage large se prend en 5,51 s à 14 m, 5,32 s à 26 m. **Marge aux rebords conservée à 3,6 m** (non retouchée : elle est déjà relative à la largeur, puisque le jeu permis grandit avec la route ; vérifié par test que la trajectoire reste à plus de 3,4 m des rebords à chaque largeur, et par le pilote qui finit 100 % des circuits sans reprise).
- **Scénario `?scenario=largeurs`** (`LARGEURS_TRACK_SPEC`, 29 blocs, ≈ 26 s) et raccourci de `/admin/`.
- **Script de mesure** `npm run measure:generator` (`apps/api/scripts/measure-generator.ts`, `FAST=1` pour aller vite).
- **Versions** : `SIM_VERSION` **5**, `GENERATOR_VERSION` **5** ; golden et `daily-golden.json` régénérés ; `npm run history:seed` relancé (les 14 jours de démonstration ont de nouveaux circuits, auteur 32,7–37,9 s).

## Mesures (`npm run measure:generator`, 60 dates depuis le 06/10/2026)
| | Avant (v4, fenêtre 28–48 s) | Après (v5, fenêtre 30–40 s) |
|---|---|---|
| Temps d'auteur min / moyen / max | 31,4 / 41,4 / 47,8 s | **30,5 / 35,2 / 39,7 s** |
| Dans [30 ; 40] s | 25 / 60 | **60 / 60** |
| Largeurs par circuit | 1 (14 m) | **≥ 2 : 60 / 60** (14, 20 et 26 m vus) |
| Virages serrés : moyenne / max / deux d'affilée | 8,6 / 12 / 53 circuits | **0,3 / 2 / 0** |
| Blocs / virages larges (`L2` `R2`) par circuit | 46,3 / 2,2 | 33,9 / 7,4 (+ amples `L3` `R3`) |
| Tentative retenue (moyenne / max) | 1,4 / 9 | 1,2 / 5 |
| Génération (moyenne / max) | 84 / 254 ms | **105 / 365 ms** |
| Rejeu d'une course d'auteur (moyenne / max) | 35 / 51 ms | 32 / 50 ms |
| Circuits de secours | 0 | 0 |

Répartition des temps d'auteur (tranches de 2 s) : 30–32 s : 9 · 32–34 s : 12 · 34–36 s : 15 · 36–38 s : 12 · 38–40 s : 12.

**Taux de validation par thème** (12 dates × 6 tentatives, thème forcé ; « construit » : le générateur a posé tous les blocs ; les deux autres colonnes sont des parts des circuits construits) :

| Thème | construit | pilote finit (avant → après) | dans la fenêtre (avant, 28–48 s → après, 30–40 s) | durée moyenne (après) | génération par tentative |
|---|---|---|---|---|---|
| Stade | 56 → 69 % | 100 → **100 %** | 55 → 70 % | 35,5 s | 47 ms |
| Rallye | 38 → 72 % | 96 → **100 %** | 96 → 73 % | 33,9 s | 46 ms |
| Banquise | 40 → 69 % | 90 → **100 %** | 83 → 56 % | 38,3 s | 47 ms |
| Nuit | 49 → 71 % | 100 → **100 %** | 71 → 53 % | 35,5 s | 44 ms |
| Campagne | 26 → 79 % | 100 → **100 %** | 100 → 74 % | 32,4 s | 42 ms |

Pas de chute silencieuse : le pilote finit **tous** les circuits construits, dans tous les thèmes (c'était 90–100 %). La part « dans la fenêtre » baisse parce que la fenêtre est deux fois plus étroite (10 s au lieu de 20 s), pas parce que les circuits sont plus difficiles ; elle reste ≥ 53 %, donc au plus quelques tentatives (au plus 6 essais sur les 60 dates). Le coût de génération monte un peu (+ 20 ms en moyenne) : plus de tentatives écartées pour leur durée.

Le rejeu d'une course (≈ 32 ms ici, Node) reste **bien au-dessus** des 10 ms de calcul de l'offre gratuite de Cloudflare Workers : la décision d'hébergement (Docker ou Workers payant) est inchangée.

## Tests
- Vitest `packages/sim/test/largeurs.test.ts` (19) : notation des largeurs et refus d'une marche, transition (rebords tangents, pente = dérivée, sol limité à la demi-largeur, normale inclinée du rebord), identité avec l'ancien contact à largeur constante, plaques proportionnelles, portes, virage ample (8 cellules, sortie, route dans ses cellules à toute largeur, raccord), scénario `largeurs` (largeurs, transition avant le virage serré, pilote sans reprise, rejeu exact), pilote (corde plus ouverte sur la route large, marge conservée).
- Vitest `generator.test.ts` (nouveau bloc, 120 dates) : au moins deux largeurs parmi 14 / 20 / 26 m, aucune marche, transitions seulement sur des droites et d'un cran, ≤ 2 virages serrés, jamais deux de suite ni sur la route large, courbes larges et amples très majoritaires, largeur dominante par thème, étranglement de *Campagne* ; règles précédentes adaptées (cellules par bloc, passage marquant).
- `golden.test.ts` / `golden-daily.test.ts` : références régénérées ; la rediffusion de l'essai n'a changé que de numéro de version (même temps, mêmes intermédiaires : la route de 14 m n'a pas bougé).
- e2e `largeurs.spec.ts` (Chromium) : `?scenario=largeurs` se charge, ses largeurs et ses portes sont celles de Node, la rediffusion du pilote donne **le même temps qu'en Node**. Le déterminisme des circuits du jour (largeurs comprises) dans Chromium, Firefox et WebKit est celui de `daily.spec.ts` (le générateur et le pilote tournent dans le navigateur ; les références contiennent des largeurs et des courbes amples).
- `admin.test.ts` : l'adresse `?scenario=largeurs`.
- Vérifié sur **captures** (Chromium, rendu logiciel) : transition 14 → 20 m, virage ample sur 26 m, porte de point de contrôle sur 26 m.

## Décisions pour Nathan
- **Médailles** (non appliqué, pour le calibrage) : avec un auteur moyen de 35 s, le bronze ×1,40 donne **49 s en moyenne et dépasse 45 s sur 51 circuits sur 60**. Part des circuits dont la médaille tient en 45 s : ×1,40 : 15 % · ×1,30 : 38 % · ×1,25 : 60 % · ×1,20 : 75 % · ×1,15 : 93 % · ×1,10 : 100 %. L'or ×1,08 tient toujours (32–43 s). **Proposition** : or ×1,08 (inchangé), argent ×1,15, bronze ×1,25 (≤ 45 s pour un auteur de 36 s ou moins, 60 % des circuits), à confirmer sur de vraies courses.
- **Virages serrés rares** (0,3 par circuit) : c'est le sens du retour (« moins serrés ») ; si le jeu paraît trop doux, relever la chance dans `composeSpec` (`roll < 25`) ou le budget.
- **Route large à 26 m** : très ample ; si c'est trop, `ROAD_WIDTHS.l` se règle (et touche aux versions).

## Limites / non vérifié
- Non vérifié sur un **vrai téléphone** (lisibilité d'une route de 26 m en vue basse) et **Firefox / WebKit** n'ont pas tourné ici (seul Chromium est installé) : la CI les lance ; seul `sqrt` s'ajoute aux opérations de `sim`, déjà permis.
- Les **miniatures** (lot 13) et le panneau d'admin (lot 14) viendront ensuite ; le calibrage des médailles aussi.
