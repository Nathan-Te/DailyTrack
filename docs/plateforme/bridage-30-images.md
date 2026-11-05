# Appareil bridé à 30 images par seconde (lot Q1)

Un iPhone en mode économie d'énergie, Chrome en « Économiseur d'énergie » sur batterie plafonnent `requestAnimationFrame` à 30 images/s, **quelle que soit la puissance de l'appareil**. L'intervalle entre images vaut alors ~33 ms alors que le fil principal n'a presque rien à faire : **ce n'est pas un appareil lent**. Un jeu ne doit ni alléger sa scène (le décor disparaissait, Track) ni lui reprocher sa lenteur ; il doit **le dire au joueur**.

## La détection (commune, pure)
`@cdj/core/bridage` (`packages/core/src/bridage.ts`, testée sous Node : `packages/core/test/bridage.test.ts`) :
- `bridePar30(images)` : sur **2 s** de rendu (`BRIDAGE_FENETRE_MS`), **intervalle médian entre 31 et 36 ms** et **travail moyen par image sous 10 ms** → vrai. Sinon faux (moins de 2 s, 60 images/s, 20 images/s, 33 ms avec un fil principal chargé : lent, pas bridé).
- `DetecteurBridage` : `observe(intervalleMs, travailMs)` à chaque image (une image de plus de 250 ms n'est pas une mesure), `bride` suit l'appareil (il redevient faux 2 s après la fin du mode économie d'énergie), `reset()`.
- Le **travail** est celui du fil principal pour dessiner l'image (Track : `renderer.render`, `travailImage` ; Jump : pas + dessin, `frameWork`). Une image sautée (accueil de Track) compte 0.
- Module à part (`@cdj/core/bridage`) : un jeu ne le charge que s'il s'en sert.

## Le dire au joueur (Track et Jump ; les jeux suivants le reprennent)
- Texte : clé **`reglages.bridage`** de chaque jeu (fr + en) : « Ton appareil limite l'affichage à 30 images par seconde (économie d'énergie). Le jeu est plus fluide sans. » / “Your device is limiting the display to 30 frames per second (power saving). The game runs smoother without it.”
- **À l'accueil, une fois par session** (une ligne `note` discrète, `#home-bridage`, `homeUi.bridage(bool)` / `home.bridage(bool)`) : montrée à l'ouverture de l'accueil si le verdict est vrai et qu'elle ne l'a pas encore été, cachée à sa fermeture, **ne revient pas** (même si le verdict reste vrai).
- **Dans les Réglages, tant que c'est vrai** (`#settings-bridage` : Track sous la « Qualité graphique », Jump sous les effets visuels de Sensations).
- **Jamais de bandeau en partie** (charte § 9).
- Rien n'est enregistré ni envoyé : un verdict en mémoire, aucune donnée gardée (`mentions-legales` inchangées).
