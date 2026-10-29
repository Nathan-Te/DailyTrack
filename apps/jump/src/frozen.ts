// Niveaux figés (lot 10) : `apps/jump/public/levels/AAAA-MM-JJ.json`, écrits par `npm run freeze:days -w @cdj/jump` (tools/freeze-days.ts).
// **Depuis le lot P1 de la plateforme, la règle (format, lecture, vérification, preuve rejouée) vit dans `@cdj/jump-sim`** (`frozen.ts` :
// `thawLevel`, `freezeLevel`…) : le jeu et le serveur (`apps/api/src/jump.ts`) importent la même fonction pure. Ce fichier n'en garde que
// la liste des dates figées publiées avec le jeu, écrite à la construction.
import { declareOldFrozenDays } from "@cdj/jump-sim";
export { FROZEN_FORMAT, decodeAscii, encodeAscii, freezeLevel, frozenJson, rleRow, thawLevel, thawPublicLevel, unrleRow, type FrozenLevel } from "@cdj/jump-sim";

/** Les dates figées publiées avec le jeu (la liste est écrite à la construction par `vite.config.ts`, d'après `public/levels/`). */
declare const __JUMP_FROZEN_DAYS__: readonly string[] | undefined;
export const FROZEN_DAYS: readonly string[] = typeof __JUMP_FROZEN_DAYS__ === "undefined" ? [] : __JUMP_FROZEN_DAYS__;

/**
 * Lot V1 : les dates des niveaux figés par un générateur d'avant le sac de thèmes (écrites à la construction) sont déclarées à la simulation **dès que ce module est chargé**
 * (la page, le fil du générateur et la page d'outils l'importent) : un jour figé d'avant le sac garde son thème, le premier jour du sac lit celui de la veille.
 */
declare const __JUMP_FROZEN_OLD_DAYS__: readonly string[] | undefined;
export const FROZEN_OLD_DAYS: readonly string[] = typeof __JUMP_FROZEN_OLD_DAYS__ === "undefined" ? [] : __JUMP_FROZEN_OLD_DAYS__;
// Sans la construction (les tests de Node, qui déclarent eux-mêmes ce qu'ils veulent : `test/figesDepot.ts`), rien n'est déclaré.
if (typeof __JUMP_FROZEN_OLD_DAYS__ !== "undefined") declareOldFrozenDays(FROZEN_OLD_DAYS);
