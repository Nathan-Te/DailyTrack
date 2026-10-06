# Lot 0 — Le socle

**Livré** : monorepo npm (workspaces), `packages/sim` (constantes de pas fixe + tests Vitest), `apps/web` (Vite + Three.js, cube qui tourne), CI GitHub Actions, aperçu par branche (Cloudflare Pages), `CLAUDE.md`.

**À tester** : ouvrir l'aperçu en ligne de la branche (commentaire de la PR) → un cube jaune tourne sur fond bleu nuit, le HUD affiche « sim 120 Hz ».

**Localement** : `npm install && npm test && npm run dev`.

**Aperçu par branche** : le workflow `.github/workflows/preview.yml` déploie sur Cloudflare Pages. Il demande, dans *Settings → Secrets and variables → Actions* : `CLOUDFLARE_API_TOKEN` (droit *Pages: Edit*), `CLOUDFLARE_ACCOUNT_ID`, et la variable `CLOUDFLARE_PAGES_PROJECT` (nom du projet Pages). Sans eux, le déploiement est simplement ignoré.

**Critères** : `npm test`, `npm run typecheck` et `npm run build` verts en CI.
