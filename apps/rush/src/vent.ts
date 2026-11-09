import type { MeshToonMaterial } from "three";
import { plat } from "./cel";

// Le balancement du vent (lot BR-A2) : les pièces de végétation de la fabrique (`fabrique.ts`) portent un attribut `vent` (0 au pied, 1 à la pointe) ; le sommet de leur matériau décale la pointe d'un ou deux centimètres, à une phase qui dépend de la
// position dans le monde (un champ d'herbe ondule, il ne tremble pas d'un bloc). **Un seul temps pour tout le décor** : `VENT.temps` (secondes de jeu) ; `VENT.force` (0 : immobile, la basse qualité ; 1 : le vent léger).
export const VENT = { temps: { value: 0 }, force: { value: 1 } };

/** Le code injecté dans le sommet d'un matériau toon : déclare l'attribut et décale `transformed`. */
export function injecterVent(sh: { vertexShader: string; uniforms: Record<string, { value: unknown }> }): void {
  sh.uniforms.uTemps = VENT.temps;
  sh.uniforms.uForce = VENT.force;
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float vent; uniform float uTemps; uniform float uForce;").replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
     {
       vec4 mw = modelMatrix * vec4(transformed, 1.0);
       float ph = mw.x * 0.31 + mw.z * 0.23;
       float s = sin(uTemps * 1.6 + ph) + 0.5 * sin(uTemps * 2.9 + ph * 1.7);
       transformed.x += vent * s * 0.07 * uForce;
       transformed.z += vent * cos(uTemps * 1.25 + ph * 1.3) * 0.05 * uForce;
     }`,
  );
}

/** Un matériau toon à couleurs par sommet dont les pièces bougent au vent (le décor : feuillages, herbes, fleurs). */
export function platVent(): MeshToonMaterial {
  const m = plat(0xffffff, true, 0);
  m.onBeforeCompile = (sh) => injecterVent(sh);
  m.customProgramCacheKey = () => "rush-vent";
  return m;
}
