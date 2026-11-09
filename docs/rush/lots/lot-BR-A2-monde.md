# Lot BR-A2 — Rush : le niveau, la lumière et l'ambiance

Passe artistique, côté **scène** (le lot parallèle BR-A1 fait les **acteurs** : modèles de Blender). Cible : `docs/rush/maquettes/cible-ia.png`. **Aucun changement de la simulation ni du générateur** (`packages/rush-sim` n'est pas touché : golden identique, voir §4). Jeu `off`. **Pour les joueurs : rien** (jeu `off`).

## 1. Ce qui a changé
- **Un archipel** : falaises (lèvre d'herbe, paroi de pierre, blocs, pierres pendantes) sous chaque clairière et chaque chemin, **ponts de bois**, **îles lointaines**, nuages ombrés à la main (sans contour), ciel en dégradé, brume par thème (`niveauVue.ts`, `decor.ts`).
- **Le sol est calculé** (`sol.ts`) : **dalles** de 2 m (joints, biseau, fêlures, grains) dans l'arène et la salle d'épreuve, **terre battue** sur les chemins, **herbe** sur les bords et le dessus des murs, mélangées par un masque d'un texel par case, filtré et déformé : transitions douces.
- **Murs bas** (≤ 1,3 m) : **muret de bois à gros poteaux** et lisses (prairie), rochers (carrière), haies et rochers moussus (sous-bois). **Habillage des bords hors jeu** dense (arbres, buissons, herbes hautes, rochers, fleurs, champignons, fougères) **balancé par le vent** (`vent.ts`).
- **La fabrique de pièces** (`fabrique.ts`) : 18 genres, des variantes, `fabriquer(genre, contexte, variante)` ; **`brancher(genre, constructeur)`** y met un modèle plus tard sans toucher à la pose, au regroupement, au fondu ni au vent.
- **Arène du boss** : lèvre d'herbe, entrée marquée (**deux piliers à brasier et un linteau**), **couleurs du boss** (bannières, anneau et encoches incrustés au sol ; jamais de rouge). **Salle d'épreuve** : dalles, portes, **cercle au sol de trois anneaux qui s'allument à chaque vague**.
- **Lumière et ambiance par thème** (`palette.ts`, `ambiance.ts`) : prairie (jour doux et chaud, pollen), carrière (ocre, soleil plus dur, poussière), sous-bois (vert ombragé, rais de lumière, brume basse, lucioles) — soleil, brume, étalonnage (teinte, saturation, contraste, vignettage, bloom) ; **trois appels de dessin** pour toute l'ambiance.
- **Rendu** (`rendu.ts`) : toujours **une seule passe de composition** ; **deux traits** (silhouette pleine, **traits intérieurs** à 55 % qui s'éteignent avec la distance : pas de bruit sur le décor dense) ; étalonnage par thème (saturation, contraste).
- **HUD** (`rush.css`) : pastilles à bord de 4 px, cœurs plus gros, « Compétence » ronde au-dessus de « Coup » et « Esquive » (plus de chevauchement). La bande du kit reste.
- **Tests** : `test/fabrique.test.ts`, `test/sol.test.ts`, `test/lisibilite.test.ts` (terre, herbe), `test/niveauVue.test.ts` (adapté) ; `e2e/monde.spec.ts` (appels < 200 partout, les deux qualités, tous les thèmes et les cinq arènes). Captures : `e2e/captures-lot-br-a2.spec.ts`.

## 2. Partage des fichiers (rappel du prompt, écrit dans `apps/rush/CLAUDE.md`)
**Acteurs = modèles** (BR-A1 : `acteurs.ts`, `bosses.ts`, `ennemisVue.ts`, `vasesVue.ts`, `gelatons.ts`, `modeles/`) ; **scène = rendu** (ce lot). Je n'ai touché aucun fichier d'acteur. **L'API des matériaux est restée stable** (`cel.ts` : aucune signature changée ; le contour et le toon n'ont rien reçu de plus que ce que `rendu.ts` fait). Un seul croisement à surveiller à la fusion : `corps.ts` (BR-A1 y branche ses acteurs ; ce lot y branche la scène, la lumière, l'ambiance et deux outils de mesure de la porte d'essai) et `config/jeux/rush.json` (une ligne de spec).

## 3. La boucle de comparaison (3 tours, captures dans `docs/rush/lots/`)
Avant : `br-a2-avant-*.png` (le jour, la salle d'épreuve, le boss, la vitrine ; pastilles de brique, nuages cernés de facettes, sol plat). Chaque tour : vitrine 1920 × 1080 des trois thèmes, chemin, camp, entrée de l'arène, salle d'épreuve, arène du boss. Le dernier tour, **côte à côte avec la cible** : `br-a2-comparaison-cible-prairie.png`, `br-a2-comparaison-cible-themes.png` ; haute et basse : `br-a2-haute-basse-prairie.png`.
| tour | planches / images | écarts relevés contre la cible → corrections |
|---|---|---|
| 0 (avant) | `br-a2-avant-*` | sol et murs en aplats ; nuages cernés de facettes ; peu de profondeur ; sans ambiance |
| 1 | `br-a2-tour1-planche-{a,b,vitrines}.png` | **carrière** : sol presque blanc, soleil trop dur ; **sous-bois** : lavé, sans ombre ni brume ; peu d'îles lointaines ; cercle de l'épreuve trop pâle ; encoches de l'anneau du boss trop larges ; entrée de l'arène hors champ dans la capture → sol de la carrière plus gris-bleu (`lisibilite` ≥ 40 gardé), soleil de la carrière à 2,0 ; sous-bois : soleil 1,75, ambiance 1,05, étalonnage sombre et frais (teinte 0,9 / 0,99 / 0,88), vignettage 0,42, brume plus verte ; 2,6 fois plus d'îles ; cercle plus sombre ; encoches fines ; capture à 9 m de l'arène |
| 2 | `br-a2-tour2-planche-{a,b,vitrines}.png` | brins d'herbe réduits à des pointes noires par le contour ; herbe du sous-bois trop sombre ; damier de la prairie trop pâle et sans contraste entre dalles → brins larges et moins nombreux, fleurs plus grosses, herbe du sous-bois plus claire, contraste du damier dans le matériau, sable de la prairie plus chaud (limité par la tête du golem : ΔE ≥ 40) |
| 3 | `br-a2-t3-*.png` (18 images) et les comparaisons | écarts restants : §5 |

## 4. Mesures
**Golden** : `packages/rush-sim` non modifié ; `npx vitest run --project sqlite packages/rush-sim` (dont le golden et le déterminisme) vert, golden inchangé au bit près. **Tests** : `apps/rush` (unitaires : 213 tests) vert ; **les 51 tests e2e de Rush (Chromium, en local) verts**, dont `monde.spec.ts` ; `packages/rush-sim` : 358 tests verts, aucun fichier du paquet modifié. `npm run consignes`, `npm run fiches` à jour.

**Dessin** (`?debug&fps`, swiftshader : les **appels** et les **triangles** sont exacts, les ms ne disent rien ; image 1280 × 720, une image entière : ombres, scène, passes) — **jamais plus de 89 appels** :
| scène | appels (haute) | triangles (haute) | appels (basse) | triangles (basse) |
|---|---|---|---|---|
| prairie · chemin | 68 | 198 k | 61 | 194 k |
| prairie · camp | 82 | 176 k | 81 | 206 k |
| prairie · entrée de l'arène | 88 | 192 k | 80 | 199 k |
| prairie · salle d'épreuve en pleine vague | 82 | 231 k | 79 | 262 k |
| carrière · chemin / camp / entrée / épreuve | 64 / 83 / 87 / 81 | 166 / 176 / 188 / 213 k | 59 / 81 / 79 / 65 | 157 / 197 / 192 / 231 k |
| sous-bois · chemin / camp / entrée / épreuve | 66 / 82 / 89 / 81 | 169 / 172 / 191 / 213 k | 60 / 81 / 80 / 65 | 163 / 199 / 194 / 237 k |
| arène du golem (prairie) / reine (carrière) / grand-duc (sous-bois) / bélier (prairie) / chêne (carrière) | 53 / 37 / 41 / 46 / 27 | 100 / 69 / 97 / 88 / 97 k | 34 / 18 / 22 / 42 / 23 | 114 / 83 / 111 / 111 / 120 k |
| vitrine (les trois thèmes) | 61 | 110 k | 58 | 135 k |
Avant le lot : 57 à 65 appels et 142 k triangles sur le jour (haute), 58 appels et 134 k sur la vitrine. En basse, plus de triangles qu'en haute : la coque du contour double les formes ; **en basse : pas d'ombres portées, pas de post-traitement, pas de vent** (`e2e/monde.spec.ts` le vérifie). Un morceau de 32 m pèse au plus 26 k triangles (la limite du test : 30 k).

**Poids** : **premier chargement `rush.jsCss` = 45,24 Ko pour 46 Ko : inchangé** (tout est dans la partie à la demande). **Partie à la demande** (`corps-`, gzip) : **222,4 Ko de JavaScript** + 3,1 Ko de CSS, contre 212,3 + 3,1 avant (+ 10 Ko : fabrique, sol, ambiance, décor plus riche).

## 5. Écarts restants avec la cible
- **Le sable de la prairie est plus pâle** que celui de la cible : le réchauffer fait passer la tête du golem sous ΔE 40 (`test/lisibilite.test.ts`) ; le golem de la cible est une roche en plaques (BR-A1) — la couleur du sol se rouvrira avec lui.
- **Les ombres et l'ombrage peint** (reflets, textures de bois et de pierre) de la cible ne se font pas sans asset : nous avons un toon à cinq paliers, un liseré, un bloom et des traits intérieurs.
- **Le muret** : la cible a des poteaux de bois taillés, aux arêtes écaillées ; les nôtres sont des blocs arrondis (la fabrique est faite pour qu'un modèle les remplace).
- **La bande du haut** est celle du kit (pas de pastille « RUSH · DAILY RUN », ni de chrono en pastille) ; les boutons du téléphone n'ont pas les icônes pleines de la cible. Lot de plateforme à venir.
- **Peu de nuages proches** et pas de lumières dorées sur le chemin (les gemmes de la cible) : les gemmes viennent de BR2.

## 6. Ce qui n'est pas vérifié
- **Aucun téléphone réel** : appels et triangles sont mesurés, pas les images par seconde ni la chaleur ; le vent est un calcul de sommet, les particules un `Points` de 260 points : légers, mais **à essayer sur un vrai appareil**. Le passage automatique en basse (30 i/s) reste actif.
- **Le vent animé** et les **particules animées** : jugés sur images fixes seulement.
- **Les deuxième et troisième vagues** de la salle d'épreuve (anneaux 2 et 3 allumés) : le code est le même que celui de la première, vu à la vague 1 seulement dans les captures du lot.
- **Safari / iPhone** : aucun essai ; les shaders ajoutés n'emploient que du GLSL ES 3.0 de base.
- La **vitrine** n'a pas d'accent de boss ni d'entrée (elle reproduit la cible).

## 7. Questions pour Nathan
1. **Sable de la prairie** : le garder pâle (lisibilité du golem actuel) ou le réchauffer à la cible quand BR-A1 aura recoloré le golem ?
2. **Les piliers et le linteau de l'entrée de l'arène** : le linteau (4,2 m) cache un peu l'arène vue de loin, il s'efface seulement devant le chevalier. Un portique plus bas, ou des piliers seuls ?
3. **Rais de lumière** : très discrets en prairie (25 %) et carrière (15 %), marqués dans le sous-bois (90 %) : bon ?
4. **Basse qualité sans vent** : voulu ? (le contour par coque ne suit pas le balancement ; l'ajouter coûte un appel de plus par morceau.)

## 8. Liens (deux clics ; en local : `npm run dev -w @cdj/rush`, `http://localhost:5173/`, ou l'aperçu de la PR sous `/rush/` ; ajouter `&debug&fps` pour les chiffres)
- Vitrine : `?scenario=vitrine` (`&theme=prairie|carriere|sousbois`, `&qualite=basse`)
- Le jour : `?scenario=jour&theme=prairie`, `…&theme=carriere`, `…&theme=sousbois` (`&qualite=basse`)
- Salle d'épreuve : `?scenario=epreuve&theme=sousbois` (`&qualite=basse`)
- Arène d'un boss : `?scenario=boss&boss=golem|reine|grand-duc|belier|chene&theme=…` (`&qualite=basse`)
