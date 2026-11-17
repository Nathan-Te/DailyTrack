import type { Module } from "@cdj/pinball-sim";

// Le nom d'un module dans le vocabulaire du thème (lots PB3 et PB5b) : les modules communs ont un nom par thème (`module.bumpers.foire` : « Pommes d'amour »), les éléments des thèmes un nom à eux (`module.manege`). **Un seul
// endroit** pour la table (`scene.ts`, les plaques du rendu) et pour le panneau « Aujourd'hui » (`panneau.ts`) : les deux disent la même chose.
const COMMUNS: readonly string[] = ["bumpers", "cibles", "spinner", "trou"];
/** Lot PBG1 : les rails ont un nom par thème, comme les modules communs (`module.rampe.foire` : « Montagnes russes »). */
const RAILS: readonly string[] = ["rampe", "orbite"];
const DE_THEME: readonly string[] = ["porte", "manege", "tourbillon", "trouNoir", "portailA", "portailB", "asteroide", "geyser", "coulee"];

/** Le nom lu d'un module (`t` : le traducteur du jeu), ou `null` pour un module sans nom (rien n'est alors écrit sur la table). `mini` (la paire de bumpers) prend le nom des bumpers. */
export function nomDuModule(t: (cle: string) => string, theme: string, module: Module | string): string | null {
  if (module === "mini") return t(`module.bumpers.${theme}`);
  if (COMMUNS.includes(module)) return t(`module.${module}.${theme}`);
  if (RAILS.includes(module)) return t(`module.${module}.${theme}`);
  if (DE_THEME.includes(module)) return t(`module.${module}`);
  return null;
}
