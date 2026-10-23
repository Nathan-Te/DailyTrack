# Le standard des voitures de Track (lot 40c)

La règle du lot 42 (nouvelles voitures) et de toute voiture future. La référence vivante est la **Sparrow** (`apps/web/src/voiture/modeleCivile.ts`) ; la vitrine `/track/vitrine/?planche=voiture` la montre sous tous les angles. Tout est construit par le code (aucun fichier de modèle, aucune texture) et **purement cosmétique** : mêmes `CarParams`, même boîte, mêmes points de contact, golden et rediffusions inchangés.

## 1. Construire une caisse (de la tôle, pas des polygones)

- **Des sections** : un plan donne des clés (`cle()` / `pont()` de `forme.ts` : neuf points d'un demi-profil à une avance z). Le constructeur ajoute les deux encadrements de la vitre (profil à **onze points**, `profilTole`), interpole (1 section par clé au palier 1, 3 aux paliers 2 et 3) et coupe aux limites des vitres.
- **Des coins arrondis, des arêtes vives** (`RAYONS_TOLE`, un rayon par point du profil) : un rayon > 0 arrondit le coin (arc de Bézier, nombre de pas décidé par le virage le plus grand sur toutes les sections : mêmes sommets partout) ; un rayon nul garde l'arête vive. Vives : **la ceinture de caisse** (flanc → biseau), **le bord de capot**, **le pied de vitre** et les encadrements. Arrondis : le bas de caisse, le flanc, le bord du toit.
- **Des bouts arrondis en plan** (`boutArriere`, `boutAvant` : longueur du quart d'ellipse en m ; 0,34 et 0,4 pour une compacte). Plus de coin vertical coupé net.
- **Lissage** : les normales se moyennent **dans un même groupe** (la peinture, la vitre, la garniture ont chacune le leur) pour les faces qui font moins de **42°** entre elles, pondérées par l'aire. Une arête plus vive reste vive : une boîte garde ses angles. Au palier 1, c'est l'ombrage propre ; aux paliers 2 et 3, les reflets continus de la peinture à deux couches glissent sur la caisse.
- **Plus aucune facette parasite sur les grandes surfaces** : on lit de la tôle. Un plan qui montre des facettes sur le capot ou le toit a trop peu de sections ou un coin sans rayon.

## 1 bis. Le capot et les ailes (retour de Nathan sur la Sparrow, 23/10/2026)

- **Un capot presque plat**, bombé d'un centimètre, qui finit sur un museau haut et franc (`capotPlat` dans `modeleCivile.ts`) : pas de capot qui plonge vers un nez bas. Référence : le capot d'une compacte carrée type « Fennec » de Rocket League, cohérent de l'aile au museau.
- **La roue ne traverse jamais le capot** : l'aile (la ceinture vive du capot au-dessus de la roue) est **au moins 7 cm au-dessus du haut de la roue** (haut de la roue : 0,76 m ; aile de la Sparrow : 0,835 m), et la lèvre d'arche s'arrête là où la tôle de l'aile s'arrête (`levre(…, ymax)`).
- **L'œil de la vue capot est propre à chaque voiture** (`PlanVoiture.vueCapot: { dy, dz }`, relatif à `HOOD_MOUNT`, lu par `main.ts` et par `test/hoodView.test.ts`) : un capot haut demande un œil plus haut (la Sparrow : +0,08 m) pour garder `HOOD_CLEARANCE` quand la caméra roule ou pique. Un modèle à capot bas garde l'œil par défaut.

## 2. Les détails obligatoires

- **Lignes de portes, de capot, de hayon** : des joints de 7 mm **dessinés dans le nuanceur** (`cadre.joints` : segments en z/y sur les flancs, |x|/z sur le dessus, |x|/y à l'arrière) ; ils suivent la caisse, sans relief ni texture.
- **Vitrage** : encadrements sombres (le profil à onze points + un liseré de 3,5 cm aux limites de chaque vitre), montants sombres, vitres teintées **opaques** et réfléchissantes (palier 2 : la carte d'environnement du thème ; palier 1 : un reflet du ciel et du sol du thème), la **silhouette des sièges à peine suggérée** (`cadre.interieur` : avance des sièges, hauteur des têtes). Aucune transparence.
- **Rétroviseurs attachés par leur pied** à la portière, au coin de la vitre (un pied + une coque `ellipsoide` + une glace), à la bonne place ; jamais une boîte posée sur l'aile.
- **Phares et feux construits** : boîtier sombre, glace, une **signature lumineuse propre au modèle** (traits de jour, ronds, barres…). Ils épousent le coin arrondi par `coque.ruban(…)` (une bande qui suit le bout de la caisse à plat puis autour du coin) ; ils sont dans le maillage des feux (sans éclairage : lisibles la nuit, ×1,6 à la Nuit).
- **Calandre et prises d'air** avec une grille suggérée (ailettes de 1 cm devant un fond sombre) ; **échappements creux** (`echappement` : tube, lèvre, intérieur sombre en retrait) ; **plaques vierges** ; **bas de caisse** en plastique gris sous un filet net ; **poignées** avec leur fond.
- **Passages de roue** : une **lèvre** peinte (`levre`, qui s'arrête là où la tôle de l'aile s'arrête) et une **doublure** dessinée dans le nuanceur (`cadre.arches` : z, y, rayon) sombre mais lisible, jamais un trou noir.
- Chaque modèle a sa signature : une silhouette, un dessin de jante, un dessin de phares et de feux qui ne ressemblent à aucun modèle réel (ni marque, ni logo, ni calandre ou phare reconnaissable).

## 3. Les roues

Une roue complète par maillage (quatre roues = deux géométries, un matériau, un angle partagé) :

- **Jante claire et lisible** (métal clair ou peinte selon le modèle), **branches nettes** (face claire, deux flancs biseautés, `dessin` : `lames`, `larges`, `doubles`, `y`), lèvre, **fût sombre** derrière, cache-moyeu (et cinq écrous aux paliers 2 et 3).
- **Pneu** à flancs arrondis : bande de roulement, épaules, flancs, **liseré clair** au milieu du flanc extérieur (palier 2 et 3).
- **Disque de frein** (sombre, derrière les branches : c'est lui qui fait lire les fenêtres de la jante) et **étrier** vivement coloré (palier 2 et 3).
- Le tout tourne **dans le nuanceur** (un angle commun), sauf le disque et l'étrier ; braquage et débattement = position et rotation du maillage. **Les roues sont aux points de contact** (`HALF_TRACK`, `AXLE_FRONT`, `AXLE_REAR`), jamais ailleurs.
- Segments : 12 au palier 1, 30 aux paliers 2 et 3.

## 4. Les plafonds

| | palier 1 | paliers 2 et 3 |
|---|---|---|
| triangles (voiture complète) | **≤ 4 000** | **≤ 12 000** |
| maillages | 6 (8 au plus si c'est justifié, appels mesurés) | 6 |
| fantôme simple | ≈ 400 triangles, **un** maillage, translucide, liseré, sans livrée | idem |

Les six maillages : la caisse (peinture, vitres, garnitures : une géométrie, la matière par sommet), les feux, une roue par roue. Un élément de plus entre dans l'un d'eux, jamais dans un maillage de plus. Rien ne sort de la silhouette (**|x| ≤ 1,06 m**, longueur ≤ 4,75 m, hauteur ≤ 1,4 m).

## 5. Les motifs et le numéro

- **Jamais de texture étirée** : motifs, numéro, joints, doublures et intérieur des vitres sont calculés **par pixel dans le nuanceur, en coordonnées de la voiture** (mètres : +z devant, +x à gauche, y en haut), par la projection que la face regarde (dessus, flancs, arrière, avant). Les bords sont lissés par `fwidth` : nets à toute distance. Un motif suit la forme d'un panneau à l'autre sans déformation.
- **Le cadre du modèle** (`CadreLivree`) dit où sont les bandes, les plaques, le pavé des flancs, la ligne de toit du bicolore, le filet, les joints. C'est tout ce qu'un modèle écrit pour avoir ses motifs.
- **Le numéro** : une plaque sur chaque portière et une sur le hayon (champ de distance : un atlas de dix chiffres, Barlow Condensed 800 italique, partagé par toutes les voitures, net de près comme de loin, **dès le palier 1**).
- **Huit motifs** : double bande de course (capot, toit, hayon), flancs à rayures obliques à 115° (la charte), filet, bicolore (toit et montants), chevrons sur le capot, damier en bout d'aile, numéro en rond (à l'ancienne), unie. Chacun reste lisible en poursuite et sur les quatre silhouettes (captures : `apres-motifs-*.jpg`).
- **Couleur du motif** : automatique (crème ou asphalte selon la caisse) ou une teinte (`TEINTES_MOTIF` : crème, asphalte, lagon) ; une teinte dont le **contraste** (WCAG) avec la caisse est < 2,1 retombe sur l'automatique (testé sur chaque couleur de la palette).
- **La Nuit** : motifs, plaques et numéro légèrement lumineux (`gLiv` × `uNuit`), feux ×1,6.
- Anciens choix du Garage : `bande` devient `course`, `flancs` et `unie` restent (`motifLu`).

## 6. La Nuit, la vue capot, le fantôme

- **La Nuit** : voir ci-dessus ; un modèle doit rester lisible sur la route du Canyon et la nuit (couleurs de la palette vérifiées par ΔE 2000 contre chaque élément de piste).
- **Vue capot** : `test/hoodView.test.ts` vérifie, pour chaque modèle et chaque palier, qu'aucune surface n'est à moins de `HOOD_CLEARANCE` de l'œil. Tout nouvel élément posé sur le capot ou le pare-brise se vérifie là.
- **Fantôme simple** : `construireFantome(plan, teinte)` ; ≈ 400 triangles, un maillage, il se distingue toujours de ta voiture (translucide, teinte unie éclaircie, liseré lumineux, aucune livrée). Il garde ce qui fait lire la voiture à 50 m (becquet, aileron, dérive).

## 7. Vérifier

- **Tests** : `test/voitureQualite.test.ts` (plafonds et maillages de chaque voiture, motifs construits sans texture, contraste de chaque teinte sur chaque couleur, reprise des anciens choix, caisse tôle et lissage), `test/voitureModeles.test.ts` (roues aux points de contact, silhouette, fantôme, vue capot, palette), `test/hoodView.test.ts`, `test/voitureJeu.test.ts` (chaque fiche du catalogue se construit), `e2e/vitrine-voiture.spec.ts`, `e2e/garage.spec.ts`.
- **Captures** (hors CI) : `CAPTURES=1 LABEL=avant|apres npx playwright test captures-lot40c` (`-g "sparrow : quatre"`, `"detail : la"`, `"quatre : les"`, `"motifs : la"`, `"garage : la"`, `"poursuite : la"`), dans `docs/lots/lot-40c-voitures-qualite/`. Une voiture neuve passe par : quatre voitures × quatre angles aux paliers 1 et 2, les gros plans (portière, museau, poupe, roue), la planche des motifs, le Garage (ordinateur et téléphone), la poursuite sur Stade, Nuit et Canyon.
- **Mesure** : le temps d'image en poursuite, profil téléphone, avant / après (`MESURE=1 … mesure-lot40`) et le compteur de `?debug` sur le téléphone.
- **Budget** : seule la Sparrow au palier 1 (et le dessin des motifs) est dans le premier chargement ; son palier 2 et les autres voitures sont à la demande, **≤ 4 ko compressés chacune** (`vitrine/poids-parties.mjs`).
