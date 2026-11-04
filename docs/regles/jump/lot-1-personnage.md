# Lot 1 — personnage

> Déplacé **mot pour mot** de `apps/jump/CLAUDE.md` (lot T1, économie de jetons) : rien n'est réécrit, les règles sont en vigueur. Le renvoi est dans [`apps/jump/CLAUDE.md`](../../../apps/jump/CLAUDE.md).

## Lot 1 — personnage
- **Une session aux réglages modifiés (`tuned`) n'est jamais enregistrée** (`JumpSession.tuned`, vrai dès qu'un pas a été joué avec d'autres réglages que les défauts ; « recommencer » aux défauts l'efface). Panneau `?debug&tune` (`tune.ts`) : un curseur par réglage, en unités humaines avec la valeur entière, « Copier les valeurs » (JSON), « Réinitialiser », mémorisé dans `jump:tune` (seulement en mode `tune`), badge « réglages modifiés ».
- **Tout nouveau paramètre d'adresse rejoint `apps/jump/src/urlOptions.ts`** (`URL_OPTIONS` : nom, description, valeurs ; `readUrlOptions` est le seul lecteur de l'adresse, un test le vérifie). La page d'admin de DailyJump lira cette liste.
- **Jeu** (`apps/jump`) : boucle à pas fixe (`loop.ts`, `FixedStepper`, au plus 30 pas par image), rendu interpolé entre `session.prev` et `session.state` ; entrées (`input.ts`) : clavier par `KeyboardEvent.code` (flèches, `KeyA`/`KeyD`, saut `Space`/`ArrowUp`/`KeyW`, R), manette (stick avec zone morte, croix, A/B saut, Start/Select recommencer), **aucun appui de saut perdu** (`JumpLatch`) ; caméra (`camera.ts`, affichage seul : avance, lissage, zone morte verticale, bornée au niveau) ; allure (`look.ts` : écrasement, étirement, regard — affichage seul).
- **`window.__jump`** (avec `?debug`) : `phase` (`ready` au chargement et après « recommencer », `playing` dès la première commande non nulle), `player` (tuiles, tuiles/s, `mode`, compteurs, `raw`), `params` (l'objet en vigueur), `tuned`, `ticks`, `manual(on)`, `advance(n)` (joue `n` pas **tout de suite, sans rendu**, renvoie `player`), `input(bits | null)`, `restart()`, `probe()`.
- **Tests de jeu en pas à pas** (`manual(true)` + `input` / `advance`), **jamais sur une durée** (`e2e/smoke.spec.ts`).
- **Zones partagées, en plus de la liste du `CLAUDE.md`** : `packages/clock` et `apps/api/Dockerfile`.
