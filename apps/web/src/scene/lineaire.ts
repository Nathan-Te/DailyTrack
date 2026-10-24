// Lot 47 — les nuanceurs qui écrivent des couleurs **d'écran** (`gl_FragColor = vec4(c, a);` sans les morceaux de colorimétrie de three.js : les halos de
// `halo.ts`, les particules de `fx.ts`) vus par la chaîne de post-traitement, qui dessine la scène en lumière **linéaire** puis fait elle-même la tonalité
// et le passage à l'espace de l'écran (`OutputPass`). Sans ce passage en linéaire, un halo sortirait en gros disque pâle (corrigé et testé au 38b).
// Deux modes : à la construction (la vitrine : `lineariser`), ou à la volée sur une scène vivante (le jeu : `adapter`, puis `restituer` quand la chaîne
// s'éteint — perte de contexte, palier qui change). Module minuscule, à la demande avec la chaîne ; la vitrine le prend aussi.
import type { Material, Object3D, ShaderMaterial } from "three";

/** Passe en lumière linéaire un nuanceur qui écrit des couleurs d'écran (`gl_FragColor = vec4(c, a);`) : pour la chaîne de post-traitement. */
export function lineariser(m: ShaderMaterial) {
  m.fragmentShader = m.fragmentShader.replace(/gl_FragColor\s*=\s*vec4\(([^;]*),\s*([^,;]*)\);/, "gl_FragColor = vec4(pow(max($1, vec3(0.0)), vec3(2.2)), $2);");
  m.needsUpdate = true;
}

/** Le nuanceur d'origine des matériaux adaptés (pour les rendre à l'écran direct). */
const originaux = new WeakMap<ShaderMaterial, string>();

const materiaux = (o: Object3D): Material[] => {
  const m = (o as { material?: Material | Material[] }).material;
  return m ? (Array.isArray(m) ? m : [m]) : [];
};

/**
 * Adapte à la chaîne tout nuanceur de la scène qui écrit des couleurs d'écran (ceux qui incluent `colorspace_fragment` s'adaptent seuls) ; à chaque image :
 * un effet ou un décor posé après coup (les halos refaits à la pose du décor, les effets d'une scène adoptée) est repris, un matériau déjà adapté est ignoré.
 */
export function adapter(scene: Object3D) {
  scene.traverse((o) => {
    for (const m of materiaux(o)) {
      const s = m as ShaderMaterial;
      if (s.isShaderMaterial && !originaux.has(s) && !s.fragmentShader.includes("colorspace_fragment")) {
        originaux.set(s, s.fragmentShader);
        lineariser(s);
      }
    }
  });
}

/** Rend à l'écran direct ce que `adapter` a passé en linéaire (la chaîne s'éteint). */
export function restituer(scene: Object3D) {
  scene.traverse((o) => {
    for (const m of materiaux(o)) {
      const s = m as ShaderMaterial;
      const avant = originaux.get(s);
      if (avant !== undefined) {
        s.fragmentShader = avant;
        s.needsUpdate = true;
        originaux.delete(s);
      }
    }
  });
}

/** Linéarise les halos (`Points` de `halo.ts`) d'une liste d'objets : ceux de l'éclairage de piste de la Nuit, construits à part (la vitrine). */
export function lineariserHalos(objets: readonly Object3D[]) {
  for (const o of objets) if ((o as { isPoints?: boolean }).isPoints) lineariser((o as unknown as { material: ShaderMaterial }).material);
}
