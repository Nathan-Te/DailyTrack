// Retouche 38b, refaite à la 38c — palier 2, pas « matière » : la **matière sobre**. Décision de Nathan (38c) : un cran au-dessus du grain du
// palier 1, **rien qui imite une photo** (ni rapiéçages, ni fissures, ni taches d'huile, ni granulats visibles un à un). Depuis la caméra de
// poursuite en mouvement, la matière doit se sentir, pas se remarquer. Ce qu'elle ajoute au grain du palier 1 :
//   - un grain plus fin (256 px pour 4 m au lieu de 128) et moins contrasté, sur un bruit moyen très doux ;
//   - une **variation de teinte à grande échelle** (≈ 50 m : une ligne droite n'est plus uniforme), rangée dans le canal alpha de la même texture
//     et lue une seconde fois à l'échelle large (`teinteLarge` : un remplacement du morceau `map_fragment` de three.js) ;
//   - aucune carte de normales ni de rugosité (le relief ne se voyait pas depuis la poursuite ; la rugosité vient du pas « reflets »).
// Dans le même module, en géométrie dans le calque de la route (aucun appel de plus), les **traces** de pneus et de freinage (pas « traces »).
//
// Chaque texture se répète sans couture (bruit périodique) et se multiplie aux couleurs des sommets (elle est presque blanche) : la palette du
// thème reste celle du document de direction. Elles sont dessinées une fois et partagées par toutes les scènes (`memoiser`). L'ancienne matière
// (« détaillée ») est dans `matiereDetaillee.ts`, pour la comparaison seulement.
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";
import { CELL, blockHalfWidth, curveSize, isCurve, turnsLeft, type Block, type Track } from "@cdj/sim";
import { shade, type Builder, type V3 } from "../meshKit";
import { onBlock } from "./route";
import { bruit, fractal, graine } from "./bruit";

/**
 * Une matière : couleur (multipliée aux sommets) ; normales et rugosité (matière détaillée seulement) ; `echelle` = mètres par répétition,
 * `relief` = force des normales, `teinte` = force de la variation à grande échelle (canal alpha de `map`, 0 : aucune).
 */
export interface Matiere {
  map: DataTexture;
  normalMap: DataTexture | null;
  roughnessMap: DataTexture | null;
  rugosite: number;
  metal: number;
  echelle: number;
  relief: number;
  teinte: number;
  /** Temps de calcul (ms), la première fois. */
  ms: number;
}

/** Une texture de matière : répétée, filtrée, mipmaps. */
export function texture(data: Uint8Array, n: number, couleur: boolean): DataTexture {
  const t = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = couleur ? SRGBColorSpace : NoColorSpace;
  t.needsUpdate = true;
  return t;
}

const memo = new Map<string, Matiere>();
export function memoiser(cle: string, f: () => Omit<Matiere, "ms">): Matiere {
  let m = memo.get(cle);
  if (!m) {
    const t0 = performance.now();
    const x = f();
    m = { ...x, ms: performance.now() - t0 };
    memo.set(cle, m);
  }
  return m;
}

/** Champ dans [0, 1] étiré sur toute la plage (la variation large se dose ensuite par `teinte`). */
function etirer(c: Float32Array): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of c) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const out = new Float32Array(c.length);
  for (let i = 0; i < c.length; i++) out[i] = (c[i]! - lo) / Math.max(1e-6, hi - lo);
  return out;
}

/** Réglages d'une matière sobre : amplitudes du grain (par pixel) et du bruit moyen, sa maille, un brossé éventuel (métal). */
interface Sobre {
  graine: number;
  fin: number;
  moyen: number;
  cellules: number;
  brosse?: number;
}

/**
 * La texture d'une matière sobre (256 px) : en couleur, un gris presque blanc centré sur celui du grain du palier 1 (0,955 : les couleurs du
 * thème ne bougent pas) ; dans l'alpha, un bruit très large et doux (deux mailles par côté), étiré sur toute la plage.
 */
export function champsSobres(o: Sobre): { couleur: Float32Array; large: Float32Array; n: number } {
  const n = 256;
  const rnd = graine(o.graine);
  const moyen = fractal(n, o.cellules, 2, rnd);
  const large = etirer(fractal(n, 2, 3, rnd));
  const lignes = o.brosse ? bruit(n, 64, rnd) : null;
  const couleur = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const brosse = lignes ? (lignes[y * n + (x >> 4)]! - 0.5) * o.brosse! : 0;
      couleur[i] = 0.955 + (rnd() - 0.5) * o.fin + (moyen[i]! - 0.5) * o.moyen + brosse;
    }
  }
  return { couleur, large, n };
}

function sobre(cle: string, o: Sobre, reste: { metal: number; teinte: number }): Matiere {
  return memoiser(cle, () => {
    const { couleur, large, n } = champsSobres(o);
    const data = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      const v = Math.max(0, Math.min(255, Math.round(couleur[i]! * 255)));
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = Math.round(large[i]! * 255);
    }
    return { map: texture(data, n, true), normalMap: null, roughnessMap: null, rugosite: 1, metal: reste.metal, echelle: 4, relief: 0, teinte: reste.teinte };
  });
}

/** Asphalte : grain fin, un bruit moyen à peine visible ; la variation large la plus nette (une ligne droite n'est pas uniforme). */
export const matiereAsphalte = () => sobre("asphalte", { graine: 381, fin: 0.06, moyen: 0.035, cellules: 16 }, { metal: 0, teinte: 0.1 });
/** Béton peint des rebords : grain plus doux encore. */
export const matiereBeton = () => sobre("beton", { graine: 512, fin: 0.045, moyen: 0.04, cellules: 12 }, { metal: 0, teinte: 0.07 });
/** Métal des portiques et panneaux : un brossé à peine marqué, pas de variation large (des pièces courtes). */
export const matiereMetal = () => sobre("metal", { graine: 77, fin: 0.025, moyen: 0.015, cellules: 8, brosse: 0.03 }, { metal: 0.35, teinte: 0 });
/** Le décor : grain et bruit moyen un peu plus présents (bois, roche, crépi selon les couleurs), variation large. */
export const matiereDecor = () => sobre("decor", { graine: 903, fin: 0.05, moyen: 0.06, cellules: 8 }, { metal: 0, teinte: 0.12 });

/** Période de la variation large, en répétitions de la texture (4 m chacune) : ≈ 48 m. */
export const PERIODE_TEINTE = 12;

/** Remplace la lecture de `map` : la couleur du grain (sans son alpha), multipliée par la variation large lue dans l'alpha à l'échelle large. */
const TEINTE_FRAG = `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  float teinteLarge = ( texture2D( map, vMapUv * uTeinteEchelle ).a - 0.5 ) * uTeinteForce;
  diffuseColor.rgb *= sampledDiffuseColor.rgb * ( 1.0 + teinteLarge * vec3( 1.15, 1.0, 0.8 ) );
#endif`;

/**
 * La variation de teinte à grande échelle d'une matière sobre (plus claire et un peu plus chaude par endroits, plus sombre et plus froide
 * ailleurs) : un remplacement du morceau `map_fragment` (une lecture de texture de plus par pixel, aucune texture de plus). Se combine avec la
 * brume de profondeur (qui enchaîne le `onBeforeCompile` d'avant).
 */
export function teinteLarge(m: MeshStandardMaterial, force: number): void {
  if (force <= 0) return;
  const u = { uTeinteForce: { value: force }, uTeinteEchelle: { value: 1 / PERIODE_TEINTE } };
  const avant = m.onBeforeCompile;
  m.onBeforeCompile = (s: WebGLProgramParametersWithUniforms, r) => {
    avant.call(m, s, r);
    Object.assign(s.uniforms, u);
    s.fragmentShader = s.fragmentShader.replace("#include <map_pars_fragment>", "#include <map_pars_fragment>\nuniform float uTeinteForce;\nuniform float uTeinteEchelle;").replace("#include <map_fragment>", TEINTE_FRAG);
  };
  const cle = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${cle()}|teinte38c`;
  m.needsUpdate = true;
}

/** Toutes les textures de matière déjà dessinées, sobres et détaillées (la vitrine compte leur mémoire et leur temps de calcul). */
export function matieresDessinees(): readonly Matiere[] {
  return [...memo.values()];
}

// --- Traces de pneus et marquages au sol (géométrie, dans le calque de la route) ------------------------------------------------------

/** Hachage d'un entier : des traces irrégulières mais les mêmes pour tout le monde. */
const h01 = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** Une bande sombre le long d'un chemin `(lat(t), t)` du bloc, de `t0` à `t1`, en `n` morceaux dont certains manquent (trace usée). */
function bande(g: Builder, b: Block, lat: (t: number) => number, t0: number, t1: number, n: number, larg: number, couleur: number, graineTrace: number) {
  for (let i = 0; i < n; i++) {
    if (h01(graineTrace * 131 + i) < 0.18) continue;
    const ta = t0 + ((t1 - t0) * i) / n;
    const tb = t0 + ((t1 - t0) * (i + 1)) / n;
    const la = lat(ta);
    const lb = lat(tb);
    const p: V3[] = [onBlock(b, la - larg / 2, ta, 0.022), onBlock(b, la + larg / 2, ta, 0.022), onBlock(b, lb + larg / 2, tb, 0.022), onBlock(b, lb - larg / 2, tb, 0.022)];
    g.quad(p[0]!, p[1]!, p[2]!, p[3]!, couleur);
  }
}

/** Les traces : la couleur de la route assombrie de 15 % (38c : discrètes ; 30 % au 38b). */
export const TRACES_SOMBRE = 0.85;

/**
 * Traces de pneus et marquages : dans chaque virage sur route, la trajectoire (extérieur, corde, extérieur) usée en deux traces sombres ; avant un
 * virage serré, des traces de freinage droites et deux barres de repère peintes sur la moitié extérieure. Ni cuve, ni bas-côté, ni saut.
 */
export function tracesEtMarquages(g: Builder, track: Track, couleurRoute: (b: Block) => number, peinture: number, sombreur = TRACES_SOMBRE) {
  for (const b of track.blocks) {
    if (b.cuve || b.surface !== "road" || b.kind === "gap" || b.kind === "jump" || b.kind === "kick") continue;
    const sombre = shade(couleurRoute(b), sombreur);
    if (isCurve(b.kind)) {
      // Dans `onBlock`, `lat` > 0 est à gauche de l'axe : l'intérieur d'un virage à gauche.
      const dedans = turnsLeft(b.kind) ? 1 : -1;
      const hw = b.w0 / 2;
      const ligne = (t: number) => dedans * hw * (-0.35 + 0.9 * Math.sin(Math.PI * t));
      const n = curveSize(b.kind) === 1 ? 8 : curveSize(b.kind) === 2 ? 14 : 20;
      for (const roue of [-0.8, 0.8]) bande(g, b, (t) => ligne(t) + roue, 0.05, 0.95, n, 0.28, sombre, b.index * 2 + (roue > 0 ? 1 : 0));
      continue;
    }
    const suivant = track.blocks[b.index + 1];
    if (!suivant || !isCurve(suivant.kind) || curveSize(suivant.kind) !== 1 || suivant.cuve) continue;
    // Avant un virage serré : traces de freinage (deux roues, un peu décalées vers l'extérieur du virage) et barres de repère.
    const dehors = turnsLeft(suivant.kind) ? -1 : 1;
    const hw = blockHalfWidth(b, CELL / 2);
    for (const roue of [-0.8, 0.8]) bande(g, b, () => dehors * hw * 0.3 + roue, 0.35, 0.98, 6, 0.26, sombre, b.index * 7 + (roue > 0 ? 1 : 0));
    for (const t of [0.35, 0.68]) {
      const l0 = dehors > 0 ? 0.4 : -hw + 0.6;
      const l1 = dehors > 0 ? hw - 0.6 : -0.4;
      g.quad(onBlock(b, l0, t, 0.03), onBlock(b, l1, t, 0.03), onBlock(b, l1, t + 0.025, 0.03), onBlock(b, l0, t + 0.025, 0.03), peinture);
    }
  }
}
