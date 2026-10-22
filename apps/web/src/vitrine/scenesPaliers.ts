// Retouche 38b — les colonnes de la planche des paliers : l'existant (la vraie scène du jeu), les paliers 1, 2 et 3, et « à la carte » (les pas
// cochés en tête de page). Chargé à la demande (`import()`) : le compositeur des paliers, ses pas et les passes de post-traitement.
import type { PaletteName, Track } from "@cdj/sim";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { composerPalier, type ScenePalier } from "../scene/composerPalier";
import { ChainePost } from "../scene/post";
import type { Reglages } from "../scene/paliers";

export { composerPalier };

const chaines = new WeakMap<WebGLRenderer, ChainePost>();
/** La chaîne de post-traitement d'un moteur (une par moteur, créée à la première image qui en demande). */
export function chaineDe(r: WebGLRenderer): ChainePost {
  let c = chaines.get(r);
  if (!c) chaines.set(r, (c = new ChainePost(r)));
  return c;
}

/** Libère la chaîne d'un moteur (vue en mouvement fermée). */
export function libererChaine(r: WebGLRenderer) {
  chaines.get(r)?.dispose();
  chaines.delete(r);
}

/**
 * Dessine une scène de palier : prépare ce qui demande le moteur (carte d'environnement), anime (temps `t`), puis dessine directement à l'écran
 * (MSAA du moteur, comme le jeu) ou par la chaîne de post-traitement. Rend la mémoire des cibles de la chaîne (octets, 0 sans chaîne).
 */
export function rendrePalier(ts: ScenePalier, r: WebGLRenderer, camera: PerspectiveCamera, w: number, h: number, t: number): number {
  ts.preparer(r);
  ts.animer(t, camera, h);
  const post = ts.post();
  if (!post) {
    r.toneMappingExposure = ts.look.exposure;
    r.render(ts.scene as Scene, camera);
    return 0;
  }
  const chaine = chaineDe(r);
  chaine.rendre(ts.scene, camera, w, h, post);
  return chaine.octets(post);
}

/** Construit une scène de palier (fabrique d'une colonne). */
export function fabriquePalier(reglages: () => Reglages) {
  return (track: Track, palette: PaletteName): ScenePalier => composerPalier(track, palette, reglages());
}
