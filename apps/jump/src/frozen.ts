// Niveaux figés (lot 10) : `apps/jump/public/levels/AAAA-MM-JJ.json`, écrits par `npm run freeze:days -w @cdj/jump` (tools/freeze-days.ts).
// **Depuis le lot P1 de la plateforme, la règle (format, lecture, vérification, preuve rejouée) vit dans `@cdj/jump-sim`** (`frozen.ts` :
// `thawLevel`, `freezeLevel`…) : le jeu et le serveur (`apps/api/src/jump.ts`) importent la même fonction pure. Ce fichier n'en garde que
// la liste des dates figées publiées avec le jeu, écrite à la construction.
export { FROZEN_FORMAT, decodeAscii, encodeAscii, freezeLevel, frozenJson, rleRow, thawLevel, unrleRow, type FrozenLevel } from "@cdj/jump-sim";

/** Les dates figées publiées avec le jeu (la liste est écrite à la construction par `vite.config.ts`, d'après `public/levels/`). */
declare const __JUMP_FROZEN_DAYS__: readonly string[] | undefined;
export const FROZEN_DAYS: readonly string[] = typeof __JUMP_FROZEN_DAYS__ === "undefined" ? [] : __JUMP_FROZEN_DAYS__;
