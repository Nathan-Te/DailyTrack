# Lot 1b — mobile

> Déplacé **mot pour mot** de `apps/jump/CLAUDE.md` (lot T1, économie de jetons) : rien n'est réécrit, les règles sont en vigueur. Le renvoi est dans [`apps/jump/CLAUDE.md`](../../../apps/jump/CLAUDE.md).

## Lot 1b — mobile
> **Lot I5 : l'interface a changé** — voir « Interface Du Jour (lot I5) » plus bas, qui remplace la bande haute de boutons (recommencer, ⚙, plein écran : dans la pause) et la place des boutons dessinés (aux bords) ; **les zones du lot 1b changent peu : seule la frontière ← / → suit les flèches (voir « Commandes tactiles »)**.
- **Toute nouvelle commande a son équivalent tactile** (et reste dans `Controls` : le tactile ne produit que les mêmes 3 bits, rien dans la simulation). Un bouton de plus = une zone ou un bouton dessiné, une entrée dans `touch.ts`, un test.
- **Les zones restent sans trou, la logique reste pure et testée** : `apps/jump/src/touch.ts` (zones `zoneSpans`, `zoneAt`, `TouchPad`, `buttonRects`, aucun DOM) ; `touchUi.ts` ne fait que brancher le DOM (pointer events, boutons dessinés). Le toucher se décide par la **zone**, jamais par le bouton dessiné ; la bande haute (`BAND_PX`, recommencer, ⚙, plein écran) est exclue des zones de jeu. `?touch=1` force le tactile (la souris simule le doigt), `?touch=0` le coupe, `?zones=1` dessine zones et doigts.
- **Cibles ≥ 44 px, vérifiées en portrait et en paysage** (`e2e/mobile.spec.ts` : téléphone émulé, boutons, panneau de réglages et curseurs compris) ; un nouvel élément cliquable passe par ce test. Cadrage : `viewHeightTiles` (`camera.ts`), 18 tuiles de haut au poste, 13 sur téléphone en paysage, jamais moins de 10 tuiles de large.
- **Page** : `touch-action: none`, `overscroll-behavior: none`, corps fixe `100dvh`, `viewport-fit=cover`, marges `safe-area-inset-*` ; rien ne défile, ne se sélectionne, ne se zoome.
- **Lot 29 : l'état des commandes se déduit des doigts posés et de leur position** (voir « Commandes tactiles fiables (lot 29) » : un doigt change de commande en changeant de zone, tout est lâché à l'annulation, au focus, à la visibilité…).
- **Tests de navigateur tactiles** : doigts posés par `Input.dispatchTouchEvent` (Chromium) ou par pointer events sur la couche `#touch` (Firefox, WebKit), toujours en pas à pas.
