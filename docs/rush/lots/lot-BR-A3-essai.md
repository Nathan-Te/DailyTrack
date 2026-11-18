# Lot BR-A3 — Rush : essai de style (modèles tiers « cute », caméra, lumière, contour)

Session locale (machine de Nathan : les packs de l'Asset Store, Blender 5.1). Aucun changement de la simulation : `packages/rush-sim` n'est pas touché, le golden est identique (tests de `rush-sim` verts).

## 0. Le dépôt est PUBLIC : les modèles convertis sont commités sur décision de Nathan
`gh repo view --json visibility` → `PUBLIC`. Décision de Nathan (en séance) : d'abord **essai local, rien commité** ; puis, l'essai fait, **les quatre `.glb` compressés (`apps/rush/public/modeles-tiers/`, 437 Ko) sont ajoutés à la branche pour l'aperçu en ligne de la PR, le dépôt devant passer privé sous peu**. Les fichiers bruts des packs et les intermédiaires restent ignorés (`apps/rush/modeles-tiers/.brut/`, `build/`). Sans les `.glb`, le jeu garde ses formes procédurales ; en production il ne les charge jamais. Un fichier poussé sur un dépôt public reste dans l'historique et les copies déjà faites, même après le passage en privé (`docs/rush/licences-tiers.md`).
**Avant toute mise en production** (`docs/rush/licences-tiers.md`) : rendre le dépôt privé, ou brancher un stockage privé hors dépôt au déploiement (un seau non public que la construction de la mise en production télécharge avec un secret de la CI).

## 1. Licences et inventaire
- 8 packs vérifiés sur leur page : **tous « Standard Unity Asset Store EULA »**, aucun « Restricted Asset ». L'EULA permet de modifier et d'embarquer dans un jeu, y compris hors Unity ; elle interdit de redistribuer les fichiers seuls. → `docs/rush/licences-tiers.md`.
- Inventaire (les trois Meshtint « Cute Series » créature par créature, Dungeon Mason, KayKit, le décor repéré) et **correspondance** pour les 7 monstres, les 5 boss, le chevalier, les vases et le décor → `docs/rush/assets-inventaire.md`. Constats : **pas de gelée, de golem ni de hibou chez Meshtint** ; le bundle **Dungeon Mason** a la gelée, le golem et la chauve-souris dans le style exact de la cible (un seul atlas de couleur pour tout le pack) ; le **Treant Forest** de Meshtint est un vieux chêne idéal ; **KayKit Knight** est le héros mignon le plus proche de la cible.

## 2. La chaîne de conversion (`apps/rush/modeles-tiers/`, `npm run modeles-tiers -w @cdj/rush`)
`extraire.py` (lit le tar gz du `.unitypackage`, n'écrit que les fichiers voulus, refuse tout chemin hors du dossier) → `construire.py` + un script par modèle (`golem.py`, `gelee.py`, `chauve_souris.py`, `chevalier.py` ; le commun dans `commun.py`) dans Blender en arrière-plan → gltfpack 1.1.0 (`-cc`). Chaque script dit : le maillage, les pièces gardées, les accessoires (épée et bouclier rendus « skinnés » sur un os de la main), les clips **renommés par état de la sim**, le rayon de la sim, la recoloration (une table couleur → couleur sur la palette du pack, ou un déplacement d'UV vers une autre case de la palette : l'armure du chevalier passe au jaune, son casque au blanc), la lueur (les yeux du golem), les couleurs dominantes (lues par le test de lisibilité). Tout se fond en **un maillage, une texture** (64 × 64 au plus proche ; 256 pour le chevalier). `--vignettes` écrit une planche par modèle (chaque clip, trois images). `planche.py` compose avant / après / cible ; `mesure_contour.py` mesure le trait.
- **Échelle** : l'empreinte au sol = le rayon de la sim, mesurée sur le **corps** dans la pose d'attente (sans bras, mains, ailes, armes : le golem procédural débordait déjà de son disque). Golem ×1,99 → 4,52 m ; gelée 0,81 m ; chauve-souris 0,87 m ; chevalier 1,38 m.
- **Orientation** : face à −Y dans Blender (+Z dans le glTF, le cap de la vue). Pas de « root motion » (la sim déplace l'acteur).
- **Limite** : la version WASI de gltfpack ne compresse pas les textures (pas de KTX2) ; elles restent en PNG, minuscules.

## 3. Dans le jeu
- `tiers.ts` (morceau à part, 21,6 Ko gzip : GLTFLoader, décodeur meshopt, SkeletonUtils), chargé à la demande hors production ; `&modeles=0` l'éteint. Un acteur = une copie du squelette, son `AnimationMixer`, sa matière (l'éclair blanc d'un coup ne touche que lui) ; les monstres sortis du champ rendent leur acteur à une réserve.
- `clipsTiers.ts` : la **table état → clip**, pure. Les états à durée (annonce du golem, coups, esquive, bond de la gelée, plongeon) **imposent le temps du clip** : l'impact du clip tombe sur l'impact de la sim. Fondu de 0,05 à 0,25 s.
- Matière `peau` (`cel.ts`) : la rampe toon et le liseré sur la texture, la lueur ×2,4 (bloom), et une **marque dans l'alpha** de l'image de la scène : le post-traitement n'y trace que la silhouette. Coque **skinnée** en basse qualité (`coqueSkinnee`), jamais en même temps que le post-traitement.
- Seul le golem est converti parmi les boss ; gélatons, cracheurs, chamans, totems, porte-boucliers et vases gardent leur forme.

## 4. Caméra, lumière, couleurs, contour
- **Caméra** : 41° / 34 m / 25° → **33° / 19 m / 35°** (`CAMERA_DEFAUT`) : le chevalier fait ~11 % de la hauteur (cible ~12 %), le golem sa taille de la cible, on voit le décor au-delà du muret et le ciel. Les curseurs de `?debug&tune` restent. Tests de caméra récrits sur ce cadrage (`test/camera.test.ts`, `test/bosses.test.ts` : le champ du bestiaire suit `CAMERA_DEFAUT`).
- **Prairie** : sable chaud (`sol` 0xf0d6a2 / `sol2` 0xe2c08a, au lieu de 0xf8e8c4 / 0xecd5a4), ciel bleu saturé, soleil 2,5 et ambiance 1,15 bleutée (ombres marquées), saturation 1,12. **Occlusion de contact** : les disques d'ombre restent en haute qualité, serrés sous les pieds (rien sous ce qui vole). Cercle d'annonce plus soutenu (fond 0,26 → 0,34). Les autres thèmes ne sont pas retouchés (lot suivant).
- **Le bug du contour** — mesuré, pas supposé (`mesure_contour.py`, la zone du chevalier, trait en pixels ramenés à 1 080) :

  | définition | DPR | avant (tour 3) | après |
  |---|---|---|---|
  | 1280 × 720 | 1 | 3,62 | 3,11 |
  | 1280 × 720 | 2 | 3,80 | 2,48 |
  | 1920 × 1080 | 1 | 2,30 | 2,22 |
  | 1920 × 1080 | 2 | 2,56 | 2,52 |
  | 2560 × 1440 | 1 | 3,81 | 2,89 |
  | 2560 × 1440 | 2 | 2,90 | 2,87 |

  Cause trouvée : la profondeur se lisait **au texel le plus proche**, donc le décalage du filtre (1,25 px à 1 080, 1,67 à 1 440) s'arrondissait : +65 % d'épaisseur à 1 440 pixels physiques de haut, le cas du plein écran 2560 × 1440 et du 1280 × 720 à DPR 2 ; plus un plancher d'un pixel sous 864 de haut. Correction : 1/z **interpolé entre deux texels** (`invX`, `invY`), plus de plancher, le texel ajouté par l'interpolation retiré de la demi-largeur (`demiLargeurContour`, `traitContour` : 2,5 px à 1 080 partout, testé) ; profondeur en **flottant 32 bits** (pas de bruit de quantification sur un grand écran). Écart restant ±20 % (anticrénelage, mesure approximative). Planche : `bra3-contour-avant-apres.png` ; plein écran : `bra3-t4-contour-2560x1440-dpr1.png`.
- **Lisibilité** : « ΔE ≥ 40 de la dominante » → **« ΔE ≥ 25 ET contour ET ombre portée »** (`test/lisibilite.test.ts`) : l'encre ≥ 50 sur chaque sol, l'ombre portée assombrit chaque sol d'au moins 15, les dominantes des modèles tiers ≥ 25. Pourquoi : 40 contre deux tons de sable forçait le sol vers le blanc — le voile pâle de BR-A1 / BR-A2 ; sur la cible, un personnage se lit par sa couleur, son trait et son ombre ensemble. La prairie a dû séparer la terre du chemin des dalles (`terre` plus sombre : écart ≥ 12 gardé).

## 5. Boucle de comparaison (4 tours, `bra3-tN-comparaison.png` : avant / après / cible)
1. Golem trop orangé et rayé, sol et ciel délavés (la vitrine prenait le thème du jour : les captures imposent la prairie), caméra trop haute → palette, caméra 35° / 24 m.
2. Caméra encore lointaine, golem orangé, cercle pâle → 33° / 19 m, golem gris-brun, yeux lumineux, chauve-souris penchée vers la caméra.
3. Dalles trop orangées et contrastées, ombres dures → sable plus clair, ambiance plus forte, cercle plus soutenu.
4. Contour corrigé ; captures finales `bra3-t4-*` (vitrine, basse, `boss&boss=golem`, `bestiaire-monstres`).
**Écarts restants** : gelées et chauves-souris plus petites que sur la cible (la règle « empreinte = rayon » les fixe ; la cible les dessine ~1,5× plus grosses) ; la gelée a un gros œil (deux points sur la cible) ; ailes de la chauve-souris repliées dans tous ses clips ; golem penché, « robot » plus que tas de roches ; HUD de la plateforme (bande du kit). Captures regardées par l'agent : 5 (règle R10) ; **les `bra3-t4-*` finales sont à regarder par Nathan**.

## 6. Mesures (`bra3-mesures.json`, 1920 × 1080, Chromium de Playwright sans réglage du GPU : chiffres relatifs)
| scène | appels | triangles | SkinnedMesh | ms par image (tick + dessin) |
|---|---|---|---|---|
| vitrine, modèles | 34 | 86 096 | 8 | 2,3 |
| vitrine, procédural | 62 | 110 816 | 0 | 1,7 |
| vitrine basse, modèles | 30 | 109 752 | 8 | 1,0 |
| arène, 24 monstres animés | 68 | 154 000 | 25 | 2,5 |
| arène, procédural | 27 | 137 290 | 0 | 1,4 |

Modèles (gzip) : golem 70,0 Ko (2 658 triangles, 56 os, 8 clips), gelée 16,0 Ko, chauve-souris 33,2 Ko, chevalier 82,1 Ko (6 300 triangles, 11 clips) : **201 Ko pour quatre**. Une journée entièrement convertie (le chevalier, le boss du jour seul, 7 monstres, 3 vases) : **~350 à 400 Ko gzip**, à la demande (charger le boss du jour seulement, comme la branche de BR-A1). Les os terminaux gardés (`_end`) et les clips non joués (`reveil`, `victoire`) pèsent encore : à retirer.
**Horde de 40 gélatons animés** : mesuré ~0,05 ms de CPU et ~1,7 appel (ombre comprise) par acteur skinné → +2 ms et +70 appels : ça tient sous 200, juste. **Proposition (non faite)** : pour les gélatons et les gelées, l'**animation cuite en texture** (les sommets de chaque clip échantillonnés dans une texture flottante, un `InstancedMesh`, le temps de chaque instance en attribut) : 1 appel + 1 ombre pour toute la horde, CPU nul ; le skinning reste pour le chevalier, le boss et les élites.

## 7. Tests et vérifications
- `test/clipsTiers.test.ts` (nouveau : la table des clips, chaque clip demandé existe dans chaque script, l'impact du clip sur l'impact de la sim ; le contour proportionnel à la hauteur), `test/lisibilite.test.ts` (règle révisée), `test/camera.test.ts`, `test/bosses.test.ts` : **576 tests de `apps/rush` et `rush-sim` verts** ; `packages/rush-sim/test/purete.test.ts` ne se charge pas sous Windows (chemin `C:\C:\…`, connu, sans rapport).
- e2e `modeles-tiers.spec.ts` (nouveau, déclaré dans la fiche et `durees.json`) : le chargement suit les fichiers servis (vérifié **avec** les modèles et **sans**, dossier retiré), `&modeles=0`, le golem joue « annonce » pendant une annonce, le chevalier « coup1 » puis « attente ». Avec `monde`, `boss`, `determinisme`, `poids`, `partie` : **34 tests verts en local**. CI non lancée par l'agent.
- Captures : `CAPTURES=1 TOUR=n npx playwright test captures-lot-br-a3` (vitrine avant / après, basse, golem, bestiaire, contour à 6 définitions, mesures).

## 8. Scénarios (après `npm run modeles-tiers -w @cdj/rush` et `npm run build -w @cdj/rush`, `npx vite preview --port 4181` dans `apps/rush`)
- http://localhost:4181/?scenario=vitrine&theme=prairie — et `&modeles=0` pour l'avant
- http://localhost:4181/?scenario=boss&boss=golem&theme=prairie
- http://localhost:4181/?scenario=bestiaire-monstres&theme=prairie (gelée et chauve-souris converties, les cinq autres procédurales)

## 9. Recommandation
**Oui, convertir ainsi** : le saut de qualité est net (formes rondes, animations, golem crédible) pour 200 Ko et moins d'appels de dessin que le procédural. Il faut d'abord : (1) **trancher dépôt privé ou stockage privé** (rien ne part aux joueurs sans) ; (2) décider si l'apparence peut dépasser le rayon de la sim (gelées, chauves-souris plus grosses que leur collision, comme la cible) ; (3) l'animation cuite en texture pour les hordes. **Plan proposé** : BR-A4 — stockage, chargement du boss du jour seulement, les 7 monstres (Dungeon Mason et Meshtint, essayer la Cyclops Bat), VAT des gélatons ; BR-A5 — les quatre autres boss (Treant Forest, tortue roulée, chauve-souris mage, reine gelée couronnée) ; BR-A6 — le décor (inventaire de *Low Poly Fantasy Arena* et *Toon Adventure Island*, vases) et les thèmes carrière et sous-bois ; un lot de la plateforme pour le HUD de la cible.

## Pour les joueurs
rien (jeu `off` ; modèles jamais chargés en production ; la caméra, la palette de la prairie et le contour changent pour l'essai, à valider par Nathan avant toute publication)
