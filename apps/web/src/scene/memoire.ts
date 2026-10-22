// Retouche 38b — la mémoire qu'une scène tient sur la carte graphique : les textures qu'elle a dessinées (canvas, données : ciel, sol, bandeaux,
// atlas, matières, nuages, écrans) et ses cibles de rendu (cartes d'ombres, carte d'environnement). Une estimation : RGBA 8 bits par pixel pour
// une texture (mipmaps comprises), 8 octets (demi-flottants) pour une cible PMREM, 4 octets par pixel pour une carte d'ombres.
import { Texture, type Light, type Material, type Mesh, type Scene } from "three";

/** Octets d'une texture dessinée (RGBA 8 bits, mipmaps comprises). */
export function octetsTexture(t: Texture): number {
  const img = t.image as { width?: number; height?: number } | null;
  const w = img?.width ?? 0;
  const h = img?.height ?? 0;
  return Math.round(w * h * 4 * (t.generateMipmaps ? 4 / 3 : 1));
}

/** Toutes les textures d'une scène (une fois chacune) : fond, environnement, cartes des matériaux, textures des uniformes. */
export function texturesDe(scene: Scene): Texture[] {
  const vues = new Map<string, Texture>();
  const ajoute = (t: unknown) => {
    if (t instanceof Texture && !vues.has(t.uuid)) vues.set(t.uuid, t);
  };
  ajoute(scene.background);
  ajoute(scene.environment);
  scene.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      for (const v of Object.values(mat)) ajoute(v);
      const u = (mat as { uniforms?: Record<string, { value: unknown }> }).uniforms;
      if (u) for (const x of Object.values(u)) ajoute(x.value);
    }
  });
  return [...vues.values()];
}

export interface MemoireScene {
  /** Textures dessinées par la scène (octets). */
  generees: number;
  /** Cibles de rendu : cartes d'ombres et d'environnement (octets). */
  cibles: number;
  /** Nombre de textures dessinées. */
  textures: number;
}

export function memoireScene(scene: Scene): MemoireScene {
  let generees = 0;
  let cibles = 0;
  let textures = 0;
  for (const t of texturesDe(scene)) {
    if (t.isRenderTargetTexture) {
      const img = t.image as { width: number; height: number };
      cibles += img.width * img.height * 8;
    } else {
      generees += octetsTexture(t);
      textures++;
    }
  }
  scene.traverse((o) => {
    const l = o as Light & { shadow?: { mapSize: { x: number; y: number } } };
    if (l.isLight && l.castShadow && l.shadow) cibles += l.shadow.mapSize.x * l.shadow.mapSize.y * 4;
  });
  return { generees, cibles, textures };
}
