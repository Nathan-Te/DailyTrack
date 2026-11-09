# Lot BR-A1 — Rush : les modèles (Blender → glTF)

Session locale (Blender 5.1 sur la machine). **Aucun changement de la simulation** : aucun fichier de `packages/rush-sim` touché, golden identique (tests de `packages/rush-sim` verts). La règle « DA figée » est levée : on vise `docs/rush/maquettes/cible-ia.png`. Le lot parallèle BR-A2 (niveau, lumière, rendu, caméra, HUD) n'est pas touché : les matériaux passent par l'API existante (`piece`, `plat`, `coqueInstanciee` de `cel.ts`) sans la modifier ; **rien ne m'a manqué dans cette API**. **Pour les joueurs : rien** (jeu `off`).

## 1. Ce qui est livré
- **19 modèles**, chacun construit par **son script Blender** (`apps/rush/modeles/<nom>.py`, briques communes `commun.py`, ordre `construire.py`, source `rush-modeles.blend`) : le chevalier, les 5 boss (golem, reine gelée, grand-duc, bélier, vieux chêne), les 7 monstres (gelée, gélaton, chauve-souris, cracheur, chaman, totem, porte-bouclier), la couronne des élites (une pièce à part, posée sur n'importe quel monstre, avec le halo et l'échelle ×1,5 du code), la jarre, le tonneau et la caisse **avec 4 éclats chacun**, le projectile du cracheur, le bouclier lancé.
- `npm run modeles -w @cdj/rush [-- noms] [-- --vignettes] [-- --blend]` : Blender (`BLENDER`, sinon le chemin habituel) puis **gltfpack 1.1.0** par `npx` (`-cc -kn -km` : meshopt + quantification ; la version du décodeur de Three.js ; aucune dépendance ajoutée au dépôt) → `apps/rush/public/modeles/<nom>.glb`. **Reproductible à l'octet près** (vérifié : trois constructions complètes, mêmes empreintes MD5 ; deux compressions, mêmes octets). Deux pièges trouvés en chemin : les opérateurs de bmesh effacent les marques `tag` et rangent leurs résultats selon des adresses en mémoire — chaque partie se construit donc dans son propre bmesh et le maillage est rangé dans un ordre canonique avant l'export.
- **Le lecteur** `apps/rush/src/modeles.ts` (sans GLTFLoader : GLB, meshopt, quantification, nœuds nommés) et **le passage des acteurs aux modèles** (`acteurs.ts`, `bosses.ts`, `ennemisVue.ts`, `vasesVue.ts`, `competencesVue.ts`) : chaque pièce prend la géométrie du modèle (`forme(modele, piece, repli)`), **la forme procédurale d'avant reste le repli** (Node, réseau coupé, `&modeles=0`).
- **La casse des vases** : les éclats modélisés jaillissent de leur place, tournoient, rebondissent et s'enfoncent (`EclatsDeVases`) ; les particules ne gardent que la poussière.

## 2. Le contrat technique
- **Pièces nommées** (`PIECES` de `modeles.ts`) = les groupes que l'animation du code anime aujourd'hui, **origine au pivot du groupe**, hiérarchie reprise (`avant_bras_g` sous `bras_g`, `yeux` sous `tete`) : chevalier `corps tete yeux plume arme bouclier pied_g pied_d` ; golem `corps tete bras_g/d avant_bras_g/d jambe_g/d` ; reine `corps couronne yeux` ; grand-duc `corps tete yeux ailes_g/d` ; bélier `corps tete yeux patte_ag/ad/rg/rd` ; chêne `corps cime bras_g/d` ; chauve-souris `corps yeux ailes_g/d` ; porte-bouclier `corps bouclier` ; vases `corps eclat_1…4` ; les autres `corps`. **L'animation n'est pas réécrite.** Adaptations minimales : le code n'applique plus les échelles qui ajustaient une forme procédurale (dôme de la reine ×4, ailes du grand-duc ×0,82, bottes du chevalier, gélaton ×0,62) — le modèle est à sa taille ; le projectile devient un tas allumé (au rayon de sa collision, tourné dans le sens de sa course). Restent du code : les yeux lumineux du golem et du chêne (aplats > 1 et halos), l'orbe du chaman, la lueur du totem, les étoiles du bélier, la pierre qui tombe du golem.
- **Chargement** : `contenuDuJour` (partie à la demande) charge les modèles communs tout de suite puis ceux du jour (`modelesDuContenu`) ; une demande n'est jamais refaite ; 8 s au plus. Mêmes modèles en `?qualite=basse` (les mesures n'ont pas demandé de version allégée).

## 3. Les modèles (mesures de `npm run modeles`, empreinte = moyenne des demi-largeurs x et z du `corps` à l'échelle du code)
| modèle | triangles (budget) | compressé | gzip | rayon de collision | empreinte |
|---|---|---|---|---|---|
| chevalier | 2 634 (3 000) | 28,0 Ko | 18,0 Ko | 0,42 m | 0,43 m |
| golem | 5 632 (8 000) | 93,4 Ko | 72,4 Ko | 1,70 m | 1,56 m (les bras dépassent) |
| reine gelée | 2 512 (8 000) | 19,1 Ko | 13,4 Ko | 2,00 m | 2,01 m |
| grand-duc | 2 718 (8 000) | 28,5 Ko | 19,6 Ko | 1,40 m | 1,15 m (sans les ailes) |
| bélier | 3 060 (8 000) | 49,5 Ko | 36,8 Ko | 1,80 m | 1,92 m |
| vieux chêne | 2 124 (8 000) | 43,2 Ko | 33,6 Ko | 2,00 m | 2,55 m (les racines) |
| gelée | 536 (1 500) | 5,7 Ko | 3,6 Ko | 0,48 m | 0,57 m |
| gélaton | 436 (1 500) | 4,9 Ko | 3,0 Ko | 0,30 m | 0,35 m |
| chauve-souris | 704 (1 500) | 10,4 Ko | 6,3 Ko | 0,36 m | 0,31 m (le corps ; elle vole) |
| cracheur | 1 068 (1 500) | 9,6 Ko | 7,1 Ko | 0,40 m | 0,49 m |
| chaman | 1 092 (1 500) | 10,9 Ko | 8,0 Ko | 0,40 m | 0,48 m (le bâton) |
| totem | 756 (1 500) | 11,0 Ko | 7,8 Ko | 0,55 m | 0,54 m |
| porte-bouclier | 1 420 (1 500) | 17,1 Ko | 11,7 Ko | 0,60 m | 0,57 m |
| couronne d'élite | 550 (1 500) | 6,6 Ko | 4,4 Ko | — | — |
| jarre (+4 éclats) | 240 + 4 × 28 | 8,0 Ko | 3,8 Ko | 0,30 m | 0,30 m |
| tonneau (+4 éclats) | 228 + 3 × 24 + 20 | 9,3 Ko | 4,5 Ko | 0,38 m | 0,37 m |
| caisse (+4 éclats) | 216 + 3 × 24 + 12 | 7,8 Ko | 3,2 Ko | 0,34 m | 0,33 m |
| projectile | 244 (1 500) | 4,7 Ko | 3,2 Ko | 0,26 m | dessiné au rayon 1, mis à 0,26 m |
| bouclier lancé | 388 (1 500) | 7,0 Ko | 4,5 Ko | 0,60 m de large | 0,52 m |
| **total** | | **~389 Ko** | **264,9 Ko** (≤ ~400) | | |

**Une journée** charge 15 modèles : 2026-11-06 (grand-duc) 170 Ko / **109 Ko gzip** ; 07 (reine) 102 Ko gzip ; 08 (bélier) 126 ; 09 (golem, le plus lourd) **161** ; 10 (chêne) 123. **Tous les jours réels contiennent les sept types de monstres** (la courbe de BR6 les met tous) : l'économie réelle est celle des quatre autres boss. Le premier chargement (`rush.jsCss`) ne bouge pas : tout est dans `corps-`, qui grossit d'~10 Ko gzip (le décodeur meshopt de Three.js, 7,8 Ko, et le lecteur ; `corps-` mesuré à 221 Ko gzip après le lot).

## 4. Le style et les tours de corrections (captures dans `docs/rush/lots/bra1-*.png`)
- **Vignettes Blender avant intégration** : `bra1-vignettes-chevalier-boss.png`, `bra1-vignettes-monstres-vases.png` (caméra du jeu, 41°).
- **Avant** (formes procédurales, `&modeles=0`) : `bra1-t1-vitrine-avant.png`, `bra1-t1-bestiaire-prairie-avant.png`, `bra1-t1-monstres-prairie-avant.png`.
- **Tour 1** (`bra1-t1-vitrine.png`, `bra1-t1-monstres-prairie.png`), écarts à la cible : visière sombre du chevalier en « lunettes », crête dorée et rebord qui chargent la tête, épée à gorge sombre (une règle vue d'en haut) ; gélaton pâle et anguleux ; gelée trop haute ; ailes du grand-duc en planches ; cornes du bélier peu visibles ; fissures du golem en flèches ; la capture de la horde ne cassait aucun vase. **Tests** : gelée ΔE 31 sur le sous-bois, dos du cracheur ΔE 33 sur la prairie, porte-bouclier 1 640 triangles.
- **Tour 2** (`bra1-t2-*`) : chevalier refait (casque crème, fente fine, crête rouge en lame comme la cible, épée large et claire, écu brun) ; gelée vert menthe 0x35B09A et plus plate ; gélaton plus bleu et plus lisse ; couvertures du grand-duc en plaques effilées ; cornes plus grandes ; fissures fines ; cracheur au dos plus sombre ; porte-bouclier allégé ; la horde éclate (les éclats de bois volent). Restait : le golem fait de « caisses » à côté des rochers de la cible.
- **Tour 3** (`bra1-t3-*`) : les gros blocs du golem deviennent des **rochers** (un icosaèdre taillé de grands plans), les détails (sourcils, phalanges, mâchoire) restent des blocs taillés ; deux pierres du dos qui faisaient des oreilles retirées. Bestiaire des boss sur les trois thèmes, vitrine, horde, combat du golem ; combats des quatre autres boss : `bra1-t2-combat-*`.
- **Écarts restants à la cible** : les personnages paraissent plus petits que dans la cible (la caméra et le cadrage sont à BR-A2 ; les tailles suivent les collisions) ; la gelée est vert menthe et non vert franc (le vert franc n'atteint pas ΔE 40 sur le sous-bois) ; le grand-duc posé, ailes repliées, fait une masse grise (son animation de repos replie de grandes plaques).

## 5. Vérifié
- `apps/rush/test/modeles.test.ts` (22 tests) : pièces, normales et couleurs ; **pivots des modèles = pivots des acteurs** ; budgets ; empreintes entre 0,8 et 1,35 fois la collision ; gabarits de BR0b (golem 4,5-7,4 m, poings plus gros que la tête) ; **couleur dominante ΔE ≥ 40 sur les deux sols des trois thèmes** pour le chevalier, les 5 boss et les 7 monstres ; chargement (une seule demande par modèle, repli sur un 404) ; animation de chaque état sans valeur folle ; tas et éclats. Tous les tests de `apps/rush` et `packages/rush-sim` verts (dont `lisibilite.test.ts`, inchangé).
- E2e `modeles.spec.ts` (5 tests) : le jour 2026-11-06 ne charge **que** ses 15 modèles (aucun autre boss) ; bestiaires < 200 appels ; **horde au tourbillon** (≥ 30 monstres, des vases cèdent) < 200 appels en haute ET basse ; **60 monstres** < 200 appels en haute et basse ; réseau coupé : le jeu se joue. Suite e2e complète de Rush : voir §7.
- **Mesures `?debug&fps`** en temps réel, 1920 × 1080, Chromium sur le GPU (ANGLE/D3D11, Radeon RX 7800 XT) — outil `e2e/captures-lot-br-a1-mesures.spec.ts` :

| scénario | haute | basse |
|---|---|---|
| horde (tourbillon, 40 monstres) | 60 i/s · 0,5 ms · 37 appels · 134 k triangles | 60 i/s · 0,4 ms · 21 appels · 154 k |
| golem / reine / grand-duc | 60 · 48 / 33 / 37 appels · 87-91 k | 60 · 47 / 32 / 35 appels · 110-115 k |
| bélier / chêne | 60 · 43 / 37 appels · 87-88 k | 60 · 42 / 36 appels · 111-112 k |
| arène, 60 monstres | 60 · 39 appels · 113 k | 60 · 23 appels · 132 k |

## 6. Ce qui n'est pas vérifié
- **Aucune mesure sur téléphone** : 60 i/s ci-dessus est le plafond de la synchronisation sur une carte de bureau puissante ; le poids en triangles (90 à 150 k par image) n'a pas été jugé sur un appareil modeste.
- Le ressenti en main (la casse des vases, la lecture des ennemis en mouvement) : rien n'a été joué à la main.
- Firebase sert-il les `.glb` compressés en gzip/brotli ? Non vérifié : les tailles « compressé » (sans gzip) sont celles à retenir si ce n'est pas le cas.
- `packages/rush-sim/test/purete.test.ts` échoue **sur cette machine Windows** (chemin `C:\C:\…`), sans rapport avec le lot ; `npm run verifier` ne lance pas `npm` sous Windows : ses étapes ont été faites à la main.

## 7. Suite e2e de Rush (cette machine, Windows)
- Deux passages complets : **48 puis 49 sur 51**. Échouent en suite complète, passent isolés : `classement.spec` (au second appareil, la copie : le formulaire du pseudo n'apparaît pas en 20 s) et `choix.spec` « 844 × 390 » (une fois aussi `competences.spec` « bond », par délai). **Les mêmes échouent sur `main` sans le lot** (suite complète rejouée sur `main` : 44 passés, `classement` et `choix 844 × 390` en échec) : ce n'est pas ce lot ; la CI dira ce qu'il en est sous Linux.
- `npx tsc -b` (tout le dépôt) : propre. `npm run consignes` : dans les plafonds.

## 8. Questions pour Nathan
1. **La gelée en vert menthe** (0x35B09A) au lieu du vert de la palette : seul moyen trouvé pour ΔE ≥ 40 sur le sous-bois. Garder, ou accepter ΔE ~30 pour un vert plus franc comme la cible ?
2. **Les tailles suivent les collisions** (la gelée 0,57 m de rayon au lieu de 0,75 m avant) : elles paraissent petites dans la caméra actuelle ; à revoir avec BR-A2 (caméra) plutôt qu'en grossissant les modèles ?
3. Le golem est le plus lourd (72 Ko gzip, 5 600 triangles) : on le garde ainsi, ou une version plus légère ?
4. Les éclats des vases : 4 par vase, 1,5 s de vie ; plus, moins, plus longtemps ?
