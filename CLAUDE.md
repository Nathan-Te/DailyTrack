# Circuit du Jour

Jeu web quotidien : un circuit court par jour, identique pour tous, classement validé par rediffusion. Source de vérité : `docs/seed.md` (ne pas modifier, c'est Nathan qui le fait). Réponses et docs en français.

## Structure
- `packages/sim` — simulation pure (physique, blocs, chrono, générateur, bot). **Aucune dépendance** au DOM, à Three.js ou à Node.
- `apps/web` — le jeu (Vite + Three.js) ; affiche ce que calcule `sim`.
- `apps/api` — classement (lot 5) ; importe le même `sim` pour rejouer les courses.
- `docs/lots/` — un README d'une page par lot.

## Commandes
- `npm install` · `npm run dev` · `npm test` (Vitest) · `npm run typecheck` · `npm run build`

## Règles de la simulation (déterminisme)
- Pas fixe (`TICK_RATE` = 120 Hz), jamais de `dt` variable ; interpolation à l'affichage seulement.
- Pas de moteur physique externe. Pas de `Math.sin/cos/exp/pow/…` dans `sim` : implémentations maison ou tables.
- Commandes de la voiture = entiers (`makeInput`) ; l'état de référence de `car.test.ts` ne change que si la physique change volontairement.
- Pas de `Math.random` ni `Date` dans `sim` : PRNG à graine explicite.
- Une course = la suite des commandes du joueur ; le même code la rejoue côté serveur.

## Méthode
- Un lot = une session = une branche = une PR. L'agent s'arrête quand les critères du lot sont verts.
- Tout code de `sim` est testé par Vitest en ligne de commande.
