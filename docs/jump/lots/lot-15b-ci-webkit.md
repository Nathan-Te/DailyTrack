# Retouche 15b — CI complète verte sur WebKit (plein écran, « Prêt… »)

## Le problème
Depuis la fusion du lot I7 (plein écran, run 39659334235), la CI complète de `main` est rouge, et à chaque fusion depuis (39675677113, 39681125858,
39682594613) : « Mettre en production » refuse tout commit (`scripts/ci-complete.mjs`). Les tests en échec ne tournent sur WebKit qu'en mode complet
(sur une PR, Firefox et WebKit ne lancent que `multi-navigateurs.json`), donc ni le lot I7 ni le lot 15 ne les ont vus échouer avant la fusion.

## Les causes
1. **`apps/jump/e2e/plein-ecran.spec.ts` (lot I7), 6 tests sur WebKit.** Les tests ouvrent un contexte « téléphone » (`isMobile: true`). Dans ce
   mode, le WebKit de Playwright émule un appareil d'Apple : après une vraie navigation, **l'API plein écran n'existe pas** (`document.fullscreenEnabled`
   et `requestFullscreen` sont absents ; mesuré : ils existent sans `isMobile`, ou sur `about:blank`). C'est exactement l'iPhone. `pleinEcranPossible()`
   (`@cdj/ui`) a donc raison de cacher les boutons : **la détection est juste, c'étaient les tests qui supposaient une capacité absente**. Les tests de
   Track ne tournent que sur Chromium (WebGL), d'où la différence.
2. **`apps/jump/e2e/horloge.spec.ts:42` (lot 15), apparu au run 39682594613.** Le test attendait la phase `ready`, puis passait en pas à pas : jusqu'à
   `manual(true)`, la boucle tourne en temps réel et WebKit, plus lent à charger, avait déjà consommé 20 pas du « Prêt… » (`ticks` 100 au lieu de 120).
   C'est une course sur une durée, et non un défaut du jeu.

## La correction (tests de Jump seulement, aucun code de jeu ni de `@cdj/ui` changé)
- `plein-ecran.spec.ts` : `pleinEcranDisponible(page)` lit la capacité dans la page (`fullscreenEnabled === true` et `requestFullscreen` existe). Les tests
  qui ont besoin du bouton (partie, anglais, accueil, axe) font `test.skip` sur cette capacité, avec sa raison, **jamais sur le nom du navigateur**.
  Le test « sans API ou en mode application » et les deux tests « iPhone » tournent toujours sur WebKit, et ils y passent : ils couvrent ce cas.
  Sur Chromium, les sept tests tournent comme avant.
- `horloge.spec.ts:42` : comme le test voisin (« la pause fige tout »), on repart d'un « Prêt… » neuf (`manual(true)` puis `restart()`) avant la
  première lecture. Ce que le test vérifie ne change pas.

## Vérifié
- En local (Playwright 1.63) : `plein-ecran` et `horloge` sur WebKit, 6 tests sautés (motif affiché), les autres verts ; sur Chromium, les 12 verts,
  aucun sauté. Suite WebKit complète de Jump : 146 verts, 1 échec
  `sensations.spec.ts:184`, puis vert 8 fois sur 8 en isolé, avec et sans cette retouche (vert dans les runs de CI cités) : un aléa de charge locale,
  qui n'est pas lié à cette retouche.
- `npm run typecheck` vert. La CI complète est lancée sur la PR par un commit `[ci complet]`.
