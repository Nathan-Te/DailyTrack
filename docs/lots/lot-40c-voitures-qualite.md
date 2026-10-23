# Lot 40c — Track : un vrai cran de qualité pour les voitures, et des motifs refaits

Branche `claude/lot-40c-voitures-qualite-gmy88b` (le prompt dit `lot-40c-voitures-qualite` ; la session impose celle-ci). Pars de `main` avec la 40b et le lot 41 fusionnés. Lire : `lot-40-vehicule.md`, `lot-40b-voitures-en-jeu.md`, `lot-41-garage.md`. **Le standard** (la règle du lot 42) : [`lot-40c-voitures-qualite/standard.md`](lot-40c-voitures-qualite/standard.md).

## Où en est le lot : point d'arrêt n° 1 (la Sparrow)

Le prompt demande de **s'arrêter après la Sparrow** et d'attendre la validation de Nathan avant de passer aux trois autres. C'est l'état de cette PR :

| | fait | reste (après validation) |
|---|---|---|
| Sparrow (la civile) | caisse tôle, détails, roues, joints, phares et feux, rétroviseurs, échappements, motifs, numéro, Nuit | — |
| Moteur commun | nuanceur de la livrée (8 motifs), couleur du motif, caisse tôle (`surfaces.ts`), roue refaite (toutes les voitures en profitent), plafonds relevés, lissage | — |
| Garage | lumière de présentation, plateau qui reflète, vignettes dessinées des 8 motifs, reprise des anciens choix | couleur du motif (selon la décision de Nathan) |
| Weasel, Moray, Dragonfly | gardent leur caisse à facettes (elles profitent déjà de la roue, des motifs, du numéro net, du lissage) | refonte de leur caisse, de leurs phares, de leurs feux au standard |
| Captures « avant / après » | Sparrow ; motifs ; Garage ; poursuite Stade, Nuit, Canyon | les trois autres voitures × quatre angles × paliers 1 et 2 |
| Mesures | triangles, maillages, poids | temps d'image en poursuite profil téléphone avant / après (les quatre voitures) |

## Ce que Nathan a vu (capture de la Sparrow au Garage) et ce qui a été fait

| Retour | Réponse |
|---|---|
| Caisse en polygones bruts, facettes dures, pas de tôle | `surfaces.ts` : profil à onze points, **coins arrondis** (arcs de Bézier), **arêtes vives** là où la tôle plie (ceinture, bord de capot, pied de vitre), **bouts arrondis en plan**, **normales adoucies par groupe** (42°, pondérées par l'aire) au palier 1 comme aux paliers 2 et 3. Reflets continus au palier 2 (la carte d'environnement du thème), faux reflets du ciel et du sol du thème au palier 1. |
| Motifs étirés, flous, crénelés ; bande qui ne suit pas le capot | **Plus aucune texture** : les motifs sont calculés dans le nuanceur, en coordonnées de la voiture, par projection (dessus, flancs, arrière, avant), bords lissés par `fwidth`. |
| Numéro pixelisé | Champ de distance (atlas de dix chiffres partagé) : une plaque par portière et une sur le hayon, nettes de près comme de loin, **dès le palier 1**. |
| Rétroviseurs : cubes orange qui flottent | Un pied sombre fixé sur la portière au coin de la vitre, une coque ovale peinte (`ellipsoide`), la glace. |
| Roues presque noires, trou sombre | Jante claire à branches biseautées devant un fût et un disque sombres (les fenêtres se lisent), pneu à flancs arrondis et liseré, cache-moyeu, étrier ; **doublure de passage de roue** dessinée dans le nuanceur (sombre mais lisible) et lèvre qui s'arrête où la tôle s'arrête. |
| Feux : carrés blancs, ni lignes de porte ni vitrage, vitres en masse noire | Phares et feux **construits** (boîtier, glace, signature : trait de jour qui remonte vers l'aile ; trois barres de feux de dos) qui épousent le coin arrondi (`coque.ruban`) ; **joints** de portes, de capot, de hayon dans le nuanceur ; encadrements sombres de vitres, montant central noir ; vitres teintées opaques avec la **silhouette des sièges** à peine suggérée ; calandre à ailettes, entrée d'air à grille, échappements creux, plaques vierges, bas de caisse. |

## Retours de Nathan après l'aperçu (à retenir pour la suite)

- **Capot trop pentu et bizarre, la roue avant traverse le capot** (capture sur téléphone, 23/10/2026 ; la Sparrow a « une idée de Fennec » de Rocket League, dont le capot est bien plus cohérent). **Fait** : capot presque plat à hauteur d'aile, museau haut et franc, aile 7 cm au-dessus de la roue, lèvre d'arche limitée à la tôle ; **l'œil de la vue capot est maintenant propre à chaque voiture** (`vueCapot`, la Sparrow : +0,08 m), vérifié pour chaque modèle et palier par `hoodView.test.ts`. **À appliquer aux trois autres voitures** (Weasel, Moray, Dragonfly) et à toute voiture du lot 42 : un capot cohérent de l'aile au museau, la roue sous l'aile, l'œil réglé au besoin (règle dans `standard.md`, § 1 bis).

## Les huit motifs (bibliothèque)

`course` (double bande de course capot - toit - hayon ; le défaut), `flancs` (rayures obliques à 115°, la charte), `filet`, `bicolore` (toit et montants), `chevrons` (capot), `damier` (en bout d'aile), `rond` (numéro en rond, à l'ancienne), `unie`. Planches : `apres-motifs-orange.jpg`, `apres-motifs-petrole.jpg`, `apres-motifs-glycine.jpg` (chaque motif vu de trois quarts arrière et avant), et le Garage (vignettes dessinées de chaque motif, tuiles à la place du choix segmenté).

**Couleur du motif : proposition (Nathan tranche).** `TEINTES_MOTIF` : l'automatique (comme avant : crème ou asphalte selon la caisse) et **trois teintes** — crème, asphalte, lagon. Le contraste (WCAG) entre la teinte et la caisse est calculé : sous 2,1 elle retombe sur l'automatique (testé sur chacune des 8 couleurs × 4 choix). Chaque teinte reste choisissable sur au moins 5 des 8 couleurs. Le moteur, le choix enregistré (`teinteMotif` sous `cdj:track:garage`), `?teinte=<n>` (recette) et la page d'admin sont prêts ; **l'interface du Garage pour la choisir n'est pas montée** tant que Nathan n'a pas dit oui (et quelles teintes).

## Garage : la voiture mise en valeur

`src/garageStudio.ts` (à la demande, avec le Garage ; monté à l'ouverture, retiré à la fermeture : **en course, la lumière reste celle du thème**) : une lumière principale chaude de trois quarts avant, un contour froid de derrière, un plateau sombre de 3,3 m avec un liseré crème dont le sol reflète un peu la voiture (`Reflector`, 512 × 512). Les vignettes des cartes et du choix de motif sont dessinées par le code (`garageMotifs.ts` : la voiture de dessus avec son motif, aux couleurs de la charte). Textes au catalogue fr + en (`motif.*`), `npm run traductions` passé.

**Choix déjà enregistrés** : `bande` → `course`, `flancs` → `flancs`, `unie` → `unie` (`motifLu`), une teinte absente → automatique ; la voiture, la couleur et les déblocages gardés dans la clé ne bougent pas (test de reprise).

## Mesures

| | avant (`main`) | après (Sparrow) | plafond |
|---|---|---|---|
| Sparrow, triangles, palier 1 | ≈ 2 100 | **3 794** | ≤ 4 000 |
| Sparrow, triangles, palier 2 | ≈ 4 500 | **8 652** | ≤ 12 000 |
| maillages | 6 | 6 | 6 (8 si justifié) |
| fantôme simple | ≈ 400, 1 maillage | inchangé | ≈ 400, 1 maillage |
| Weasel, Moray, Dragonfly, palier 1 | ≈ 2 100 à 2 400 | ≈ 3 100 (la roue refaite) | ≤ 4 000 |

Les plafonds du lot 40b (≤ 2 600 et ≤ 6 000) sont relevés à ≤ 4 000 et ≤ 12 000 dans `voitureModeles.test.ts`, `voitureJeu.test.ts`, `e2e/vitrine-voiture.spec.ts`.

### Budget (à valider par Nathan)

**Premier chargement : +6 399 o** (JS + CSS 276 952 → 283 351 o, `main` lot 44 compris ; marge sous le plafond 14 648 → 8 249 o) — **au-dessus de la cible de +4 ko du prompt**. Par module, compressé (`vitrine/poids-parties.mjs`) :

| module | poids | à quoi il sert |
|---|---|---|
| `nuanceurLivree.ts` | 5,3 ko | les 8 motifs, le numéro (atlas en champ de distance), les joints, la doublure des arches, l'intérieur des vitres : ce qui remplace la texture de livrée |
| `surfaces.ts` | 2,4 ko | caisse tôle, bouts arrondis, coque (phares et feux sur les coins), ellipsoïdes, échappements |
| `pieces.ts` | +1,6 ko | groupes de lissage, vitres, reflets du palier 1 |
| roue, plan de la Sparrow, palette et motifs | le reste | la roue refaite (disque, étrier, liseré, branches biseautées), les joints et les feux du plan, `couleursMotif` |

Le Garage (studio, reflet plan, vignettes de motifs) est à la demande : garage-*.js 6,5 → 8,1 ko ; `Reflector` rangé dans son morceau (`vite.config.ts`), aucune géométrie de three de plus au premier chargement (three.js +43 o). **Pistes si Nathan veut revenir vers 4 ko** : charger à la demande le GLSL des motifs autres que la double bande (≈ 1 ko, mais le motif choisi doit être prêt avant la première voiture : un rendu différé), générer l'atlas des chiffres sans champ de distance (≈ 0,5 ko, des bords moins nets de près), retirer les détails de palier 2 (écrous, étrier) du code commun vers `materiaux2` (≈ 0,6 ko). Les trois autres voitures restent à la demande (≤ 4 ko compressés chacune : à vérifier à la refonte).

### Coût de compilation du nuanceur (trouvé par la CI)

La première version du nuanceur de la livrée compilait les huit motifs et 24 joints à chaque chargement de page : en rendu logiciel, le test `profil.spec.ts › un pseudo appartient…` (une vingtaine de chargements de page) passait de 2,8 min (`main`) à 3,1 min en local et dépassait ses 4 min en CI. Remède : **seul le code du motif choisi est compilé** (`#define MOTIF`, programme recompilé une fois par motif changé, mis en cache), les boucles de joints ont la taille du plan (`NJC`, `NJT`, `NJR`), la taille d'un pixel est mesurée une fois hors de toute branche (`gPx`). Résultat : 2,8 min, comme `main` ; poids −475 o. À retenir pour les voitures suivantes : un nuanceur de voiture se juge aussi à son temps de compilation, pas seulement à son poids.

## Captures (`docs/lots/lot-40c-voitures-qualite/`)

Outil : `CAPTURES=1 LABEL=avant|apres npx playwright test captures-lot40c` (`-g "sparrow : quatre"`, `"detail : la"`, `"motifs : la"`, `"garage : la"`, `"poursuite : la"`, `"quatre : les"`).

- `avant-sparrow-p1.jpg`, `avant-sparrow-p2.jpg` / `apres-sparrow-p1.jpg`, `apres-sparrow-p2.jpg` : quatre angles (en haut) et quatre gros plans (portière, museau, poupe, roue), paliers 1 et 2 ;
- `apres-detail-p2.jpg` : quatre gros plans 1 800 × 1 120 ;
- `avant-motifs.jpg` (les 3 anciens) / `apres-motifs-*.jpg` ;
- `avant-garage-*` / `apres-garage-*` : bureau (1 280 × 720) et téléphone (844 × 390), Sparrow et Weasel ;
- `avant-poursuite-*` / `apres-poursuite-*` : Stade, Nuit, Canyon.

## Vérifié / non vérifié

**Vérifié** : `npm test` (2 755 tests : plafonds et maillages de chaque voiture, motifs construits sans texture ni attribut d'image, contraste de chaque teinte sur chaque couleur, reprise des anciens choix, caisse tôle et lissage, roues aux points de contact, vue capot, fantôme) ; typecheck ; `npm run traductions` ; captures ci-dessus au rendu logiciel (Chromium, SwiftShader) ; budgets remesurés.
**Non vérifié** : le rendu sur un vrai téléphone et le temps d'image réel (le compteur de `?debug` donnera le vrai chiffre) ; la mesure « avant / après » du temps d'image en poursuite (prévue avec les quatre voitures) ; Firefox et WebKit.

## Décisions pour Nathan

1. **La Sparrow et les motifs te conviennent-ils** (vitrine `/track/vitrine/?planche=voiture`, Garage) ? Retouches avant les trois autres voitures.
2. **Couleur du motif** : oui / non, et quelles teintes (proposition : crème, asphalte, lagon).
3. **Budget** : +6,4 ko au premier chargement (cible 4 ko) — l'accepter, ou lequel des trois leviers tirer.
4. Le nom de branche : `claude/lot-40c-voitures-qualite-gmy88b` (imposé par la session).

## À tester (aperçu de la PR, au téléphone)

- `/track/vitrine/?planche=voiture` : la Sparrow et les motifs (pastilles de motif, de teinte, de couleur) ;
- `/track/?api=demo` puis Garage : fais tourner la voiture, essaie chaque motif ; lance une course pour la voir en poursuite, avec `?debug` pour les images par seconde.
