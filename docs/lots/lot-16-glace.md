# Lot 16 — Glace refaite

**Essayer** : https://nathan-te.github.io/DailyTrack/b/lot-16-glace/?scenario=glace — une ligne droite de route (pour comparer), une longue ligne droite de glace, deux virages (gauche puis droite) à prendre en roue libre, puis deux S larges en slalom. Mode démo pour regarder le pilote : ajouter `&demo`.
**Puis avec le panneau de réglages** : https://nathan-te.github.io/DailyTrack/b/lot-16-glace/?scenario=glace&debug&tune (cinq curseurs « Glace : … »).
**Puis deux circuits *Banquise*** (plus de glace) :
- https://nathan-te.github.io/DailyTrack/b/lot-16-glace/?seed=2026-10-24 (quatre zones de glace, dont deux courtes)
- https://nathan-te.github.io/DailyTrack/b/lot-16-glace/?seed=2026-10-26 (trois zones de glace de quatre blocs)

(Si l'environnement impose un autre nom de branche, remplacer `lot-16-glace` dans le lien ; une fois fusionné, les mêmes adresses marchent sur https://nathan-te.github.io/DailyTrack/ et le menu `/admin/` propose « Glace ».)

## Livré
La glace n'est plus « une route avec peu d'adhérence » : elle a trois comportements selon ce que fait le pied (`car.ts`, `SurfaceParams.slick` = 1 sur la glace, 0 ailleurs ; les valeurs sont les clés `ice*` de `CarParams`, donc dans `?debug&tune` et « Copier les réglages »).

| | Accélérateur appuyé | Roue libre | Frein |
|---|---|---|---|
| Adhérence latérale | `grip` 0,3 de la table `SURFACES.ice` : sous-vire et glisse largement | `iceCoastGrip` **0,75** : la voiture pivote volontiers | `iceBrakeGrip` **×0,5** de l'adhérence : part en glisse |
| Vitesse | pointe du plat × `iceTop` **1,2** (57,6 m/s) ; motricité 0,4 (patinage au départ) | décélération × `iceCoast` **0,3** (0,9 m/s² au lieu de 3) ; plus aucun roulement (`rolling` 0,3 → 0) | motricité 0,4 : freinage de 16 m/s² |
| Redirection | — | `iceRealign` **3 /s** : la vitesse latérale s'éteint (le vecteur vitesse se réaligne sur le cap) sans freiner | — |

- **Ligne droite** : résistance au roulement nulle, roue libre presque sans perte, pointe plus haute (`flatTop` remplace `maxSpeed` dans la courbe d'accélération et dans la traînée au-delà de la pointe, pondéré par `slick`). Rien ne change sur les autres revêtements.
- **Pilote** (`autopilot.ts`) : la vitesse de passage sur glace est celle de la **roue libre** (`iceCoastGrip`) ; il **lâche l'accélérateur dès qu'il braque** (|volant| > 0,12) sur glace et le rend en ligne droite (`line.slick`). Il finit `?scenario=glace` aux quatre niveaux d'adhérence, sans reprise.
- **Générateur** : aucune règle ajoutée. Le pilote prenait déjà la glace en roue libre ; le taux de circuits validés de *Banquise* est resté celui d'avant (58 % dans la fenêtre, 98 % de finitions du pilote, voir la mesure). Les signatures et zones de glace n'ont pas bougé.
- **Scénario** `?scenario=glace` (`GLACE_TRACK_SPEC`, `circuits.ts`) et raccourci « Glace » de `/admin/`.
- **Versions** : `SIM_VERSION` **7**, `GENERATOR_VERSION` **7** ; golden (`essai-autopilot.json`, `daily-golden.json`) régénérés, `npm run history:seed` relancé.

## Mesures (`packages/sim/test/glace.test.ts`, route plate)
| | Route | Glace |
|---|---|---|
| Lancée à 30 m/s, plein gaz, 20 s : vitesse / distance | 48,0 m/s / 941 m | **57,3 m/s / 1036 m** |
| 2 s depuis l'arrêt | 32,5 m/s | 16,3 m/s (patinage) |
| Roue libre 3 s depuis 40 m/s | 31,0 m/s | **38,9 m/s** |
| Rayon d'un virage à 30 m/s, volant à fond, gaz | 36 m | **84 m** |
| Rayon du même virage en roue libre | — | **9,5 m** (gaz ÷ roue libre ≈ 8,8) |
| Freinage de 30 m/s | 11,2 m | **28,1 m** (×2,5) et glisse |
| Dérive 0,27 → ½ en roue libre, braquage dans le bon sens | — | **0,12 s**, vitesse 36,4 → 35,1 m/s (−3,6 %) |

Rejeu d'une course d'auteur (`npm run measure:generator`) : **37,9 ms en moyenne** contre **38,3 ms** sur `main` mesuré sur la même machine : aucun surcoût (les 21 ms du lot 15 venaient d'une autre machine ; ne comparer que sur une même machine).

Taux de validation par thème (12 dates × 6 tentatives) : stade 55 %, rallye 57 %, **banquise 58 %** (76 % construit, 98 % de finitions du pilote, 33,0 s en moyenne), nuit 60 %, campagne 54 % — inchangés depuis le lot 15. 60 dates : 60/60 dans [30 ; 40] s, aucun circuit de secours, vitesse max du pilote 84 m/s en moyenne.

## Tests (seuils recopiés de `glace.test.ts` ; s'ils changent, la sensation a changé)
- Droite lancée 30 m/s, 20 s : vitesse et distance de la glace > route ; 2 s depuis l'arrêt : glace < 60 % de la route ; roue libre 3 s depuis 40 m/s : glace > route + 4 m/s.
- Rayon de virage à gaz ≥ **2 ×** le rayon en roue libre ; freinage de 30 m/s sur glace > **2,5 ×** la route.
- Dérive : l'angle est divisé par deux en **moins de 0,6 s**, avec **moins de 10 %** de perte de vitesse.
- Le pilote finit `?scenario=glace` sans reprise (quatre niveaux d'adhérence) et dépasse 48 m/s ; sur glace, **aucun pas braqué avec l'accélérateur**, et il accélère en ligne droite.
- `surfaces.test.ts` (lot 8) : la comparaison des revêtements en virage se fait désormais **accélérateur appuyé** (en roue libre la glace tient plus : c'est le but du lot) ; la table de la route porte `slick: 0`.
- e2e `glace.spec.ts` : le jeu rejoue le pilote au temps de Node.

## Décisions et limites pour Nathan
- **Ressenti non vérifié** : tout est jugé sur des mesures. À essayer à la main : `iceCoastGrip` (0,75) et `iceRealign` (3 /s) font le « gauche-droite en roue libre » ; `iceBrakeGrip` (0,5) la glisse au frein ; `iceTop` (1,2) la vitesse. Le panneau `?debug&tune` les règle en direct.
- **Roue libre = ni gaz ni frein.** Un léger appui sur le frein (ou le gaz) en virage retire le bonus ; sur téléphone l'accélérateur est automatique par défaut : pour utiliser la roue libre sur glace il faut l'accélérateur manuel (bouton gaz) ou que le jeu le lâche tout seul sur glace. **À trancher** : veux-tu que le gaz automatique se coupe sur glace quand on braque ? (non fait : ça change la manière de jouer au doigt.)
- **Pas de capture** jointe : le lot ne crée aucun effet visuel (la glace se reconnaît déjà à sa couleur et à ses éclats).
- Aucun autre revêtement n'a été retouché ; Firefox et WebKit : le déterminisme est éprouvé par la CI.
