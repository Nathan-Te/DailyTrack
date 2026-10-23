// Lot 40c — la livrée dans le nuanceur. **Plus aucune texture étirée** : les motifs, le numéro, les lignes de portes, la doublure des passages de roue et
// l'intérieur des vitres sont calculés pour chaque pixel **en coordonnées de la voiture** (mètres : +z devant, +x à gauche, y en haut), par la projection que
// la face regarde (dessus, flancs, arrière, avant). Un motif suit donc la forme d'un panneau à l'autre, sans déformation, et ses bords sont lissés par
// `fwidth` : nets à toute distance. Le numéro est un champ de distance (un atlas de dix chiffres, dessiné une fois et partagé) : net de près comme de loin.
// Rendu seul : rien ici ne touche à la simulation.
import { Color, DataTexture, LinearFilter, RedFormat, UnsignedByteType, Vector2, Vector3, Vector4, type Texture } from "three";
import { motifVersIndice, couleursMotif, type CadreLivree, type MotifLivree } from "./livree";

/** Ce que le nuanceur lit (uniformes) ; `peindre` les met à jour sans rien reconstruire. */
export interface LivreeNuanceur {
  uniforms: Record<string, { value: unknown }>;
  peindre(caisse: number, numero: string, motif: MotifLivree, rangCouleurMotif?: number): void;
  /**
   * Les `#define` du nuanceur : `MOTIF` (le rang du motif : seul son code est compilé) et le nombre de joints de chaque projection (des boucles de la bonne taille).
   * Compiler seulement ce qu'on dessine garde le premier chargement rapide (un nuanceur long coûte cher à compiler, surtout en rendu logiciel).
   */
  defines(): Record<string, string>;
}

const NB_COUPES = 10; // segments de joints : flancs (z, y)
const NB_COUPES_T = 8; // dessus (|x|, z)
const NB_COUPES_R = 6; // arrière (|x|, y)

// --- L'atlas des chiffres (champ de distance) -----------------------------------------------------------------------------------------------

const CASE_L = 80;
const CASE_H = 128;
const ECART = 14; // portée du champ de distance (px)
let atlas: DataTexture | null = null;

/** Distance euclidienne au carré (Felzenszwalb et Huttenlocher), une dimension. */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
}

/** Champ de distance d'une image binaire (`dedans` : 1 dans la forme) : positif dedans, négatif dehors, en pixels. */
function champDeDistance(dedans: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e12;
  const carre = (cible: 0 | 1): Float64Array => {
    const g = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = dedans[i] === cible ? INF : 0;
    const n = Math.max(w, h);
    const f = new Float64Array(n);
    const d = new Float64Array(n);
    const v = new Int32Array(n);
    const z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = g[y * w + x]!;
      edt1d(f, h, d, v, z);
      for (let y = 0; y < h; y++) g[y * w + x] = d[y]!;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = g[y * w + x]!;
      edt1d(f, w, d, v, z);
      for (let x = 0; x < w; x++) g[y * w + x] = d[x]!;
    }
    return g;
  };
  const versDedans = carre(1); // distance au plus proche pixel « dehors » (pour les pixels dedans)
  const versDehors = carre(0);
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = dedans[i] ? Math.sqrt(versDedans[i]!) - 0.5 : -(Math.sqrt(versDehors[i]!) - 0.5);
  return out;
}

/** Les chiffres de 0 à 9 (Barlow Condensed 800 italique, la police du chrono) en champ de distance : une rangée de dix cases, partagée par toutes les voitures. */
export function atlasChiffres(): Texture {
  if (atlas) return atlas;
  const W = CASE_L * 10;
  const H = CASE_H;
  const donnees = new Uint8Array(W * H).fill(0);
  atlas = new DataTexture(donnees, W, H, RedFormat, UnsignedByteType);
  atlas.minFilter = LinearFilter;
  atlas.magFilter = LinearFilter;
  atlas.generateMipmaps = false;
  atlas.flipY = false;
  atlas.unpackAlignment = 1;
  atlas.needsUpdate = true;
  dessinerAtlas();
  // La police du chrono peut arriver après la première voiture : on redessine à son arrivée (sans document, rien à faire).
  if (typeof document !== "undefined" && document.fonts?.load) void document.fonts.load(`italic 800 100px ${POLICE_NUMERO}`).then(dessinerAtlas, () => undefined);
  return atlas;
}

/** La police des chiffres (celle du chrono). */
export const POLICE_NUMERO = "'Barlow Condensed', 'Arial Narrow', sans-serif";

function dessinerAtlas() {
  if (!atlas || typeof document === "undefined") return;
  const W = CASE_L * 10;
  const H = CASE_H;
  const toile = document.createElement("canvas");
  toile.width = W;
  toile.height = H;
  const x = toile.getContext("2d", { willReadFrequently: true });
  if (!x) return;
  x.fillStyle = "#000";
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  const taille = Math.round(CASE_H - 2 * ECART - 6);
  x.font = `italic 800 ${taille}px ${POLICE_NUMERO}`;
  for (let i = 0; i < 10; i++) x.fillText(String(i), CASE_L * i + CASE_L / 2, ECART + taille * 0.78 + 2, CASE_L - 2 * ECART + 6);
  const px = x.getImageData(0, 0, W, H).data;
  const dedans = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) dedans[i] = px[i * 4]! > 127 ? 1 : 0;
  const champ = champDeDistance(dedans, W, H);
  const out = atlas.image.data as Uint8Array;
  // Le canvas a sa première ligne en haut ; la texture (flipY faux) a la sienne en bas : on retourne les lignes.
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) out[(H - 1 - y) * W + xx] = Math.max(0, Math.min(255, Math.round(128 + (champ[y * W + xx]! / ECART) * 127)));
  atlas.needsUpdate = true;
}

// --- Les uniformes -----------------------------------------------------------------------------------------------------------------------

const lin = (hex: number) => new Color(hex);

/** Les uniformes d'une voiture : le cadre du modèle (où sont les bandes, les plaques, les joints…) et l'état de la livrée (couleur, motif, numéro). */
export function creerLivree(cadre: CadreLivree): LivreeNuanceur {
  const [a0, b0] = cadre.bandes[0] ?? [0, 0];
  const [a1, b1] = cadre.bandes[1] ?? [0, 0];
  const j = cadre.joints;
  const segs = (liste: readonly (readonly [number, number, number, number])[] | undefined, n: number) => Array.from({ length: n }, (_, i) => (liste?.[i] ? new Vector4(...liste[i]!) : new Vector4(0, 0, 0, 0)));
  const arches = Array.from({ length: 2 }, (_, i) => (cadre.arches?.[i] ? new Vector3(...cadre.arches[i]!) : new Vector3(0, 0, 0)));
  const [fz0, fz1] = cadre.flancs.z;
  const [fy0, fy1] = cadre.flancs.y;
  const u: LivreeNuanceur["uniforms"] = {
    uCaisse: { value: new Color() },
    uC1: { value: new Color() },
    uC2: { value: new Color() },
    uPlaque: { value: new Color() },
    uChiffres: { value: new Color() },
    uNum: { value: new Vector4(-1, -1, -1, 0) },
    uBandes: { value: new Vector4(a0, b0, a1, b1) },
    uGeo: { value: new Vector4(cadre.largeurBande / 2, cadre.toit ?? 0.95, cadre.filet ?? (fy0 + fy1) / 2, 0) },
    uPortiere: { value: new Vector3(cadre.portiere.z, cadre.portiere.y, cadre.portiere.h) },
    uArriere: { value: new Vector2(cadre.arriere.y, cadre.arriere.h) },
    uFlancs: { value: new Vector4(fz0, fz1, fy0, fy1) },
    uArches: { value: arches },
    uJC: { value: segs(j?.flanc, NB_COUPES) },
    uJT: { value: segs(j?.dessus, NB_COUPES_T) },
    uJR: { value: segs(j?.arriere, NB_COUPES_R) },
    uInt: { value: new Vector4(cadre.interieur?.[0] ?? 0, cadre.interieur?.[1] ?? 0, cadre.interieur?.[2] ?? 0, cadre.interieur ? 1 : 0) },
    uAtlas: { value: atlasChiffres() },
    uNuit: { value: 0 },
  };
  const val = <T>(k: string) => u[k]!.value as T;
  const compte = (l: readonly unknown[] | undefined) => String(l?.length ?? 0);
  let motifCourant = 0;
  return {
    uniforms: u,
    defines: () => ({ MOTIF: String(motifCourant), NJC: compte(j?.flanc), NJT: compte(j?.dessus), NJR: compte(j?.arriere) }),
    peindre(caisse, numero, motif, rang = 0) {
      const c = couleursMotif(caisse, rang);
      val<Color>("uCaisse").set(lin(caisse));
      val<Color>("uC1").set(lin(c.c1));
      val<Color>("uC2").set(lin(c.c2));
      val<Color>("uPlaque").set(lin(c.plaque));
      val<Color>("uChiffres").set(lin(c.chiffres));
      motifCourant = motifVersIndice(motif);
      const chiffres = numero.replace(/\D/g, "").slice(0, 3);
      val<Vector4>("uNum").set(Number(chiffres[0] ?? -1), Number(chiffres[1] ?? -1), Number(chiffres[2] ?? -1), chiffres.length);
    },
  };
}

// --- Le nuanceur --------------------------------------------------------------------------------------------------------------------------

export const GLSL_LIVREE_PARS = /* glsl */ `
uniform vec3 uCaisse; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uPlaque; uniform vec3 uChiffres;
uniform vec4 uNum; uniform vec4 uBandes; uniform vec4 uGeo; uniform vec3 uPortiere; uniform vec2 uArriere; uniform vec4 uFlancs;
uniform vec3 uArches[2]; uniform vec4 uJC[${NB_COUPES}]; uniform vec4 uJT[${NB_COUPES_T}]; uniform vec4 uJR[${NB_COUPES_R}]; uniform vec4 uInt;
uniform sampler2D uAtlas; uniform float uNuit;
varying vec3 vOP; varying vec3 vON; varying float vLivree;
#if MOTIF == 7
#define ROND 1
#else
#define ROND 0
#endif
float gLiv = 0.0;
// Taille d'un pixel (m), mesurée une fois hors de toute branche (les dérivées ne se prennent pas dans un if propre à chaque pixel) ; tous les bords s'en servent.
float gPx = 1e-3;
float aaL(float d) { return clamp(0.5 - d / gPx, 0.0, 1.0); }
float segL(vec2 p, vec4 s) { vec2 pa = p - s.xy; vec2 ba = s.zw - s.xy; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
float boiteL(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// Le numéro : p en mètres, centré sur le numéro (x à droite du lecteur, y en haut), h la hauteur des chiffres ; la couverture (0 à 1).
float chiffresL(vec2 p, float h) {
  float n = uNum.w;
  if (n < 0.5) return 0.0;
  float dw = h * 0.52;
  float tot = n * dw;
  float cov = 0.0;
  for (int i = 0; i < 3; i++) {
    if (float(i) >= n) break;
    float dig = uNum[i];
    float u = (p.x + tot * 0.5 - float(i) * dw) / dw;
    float v = p.y / h + 0.5;
    if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) continue;
    // La case est plus large que le chiffre (marge du champ de distance) : on la lit tout entière.
    vec2 uv = vec2((dig + (u * 0.96 + 0.02)) / 10.0, v * 0.84 + 0.08);
    float s = texture2D(uAtlas, uv).r;
    float fw = max(gPx * 3.8 / h, 0.004);
    cov = max(cov, clamp((s - 0.5) / fw + 0.5, 0.0, 1.0));
  }
  return cov;
}
float damierL(vec2 p, float cell) {
  vec2 c = p / cell; vec2 w = vec2(max(gPx / cell, 1e-4));
  vec2 i = 2.0 * (abs(fract((c - 0.5 * w) * 0.5) - 0.5) - abs(fract((c + 0.5 * w) * 0.5) - 0.5)) / w;
  return 0.5 - 0.5 * i.x * i.y;
}
`;

export const GLSL_LIVREE_COULEUR = /* glsl */ `
#ifdef USE_LIVREE
gPx = max(0.0004, max(fwidth(vOP.x), max(fwidth(vOP.y), fwidth(vOP.z))));
if (vLivree > 0.5) {
  vec3 P = vOP;
  vec3 Nn = normalize(vON);
  vec3 aN = abs(Nn);
  float mx = max(aN.x, max(aN.y, aN.z));
  bool cote = aN.x >= mx;
  bool dessus = !cote && aN.y >= mx && Nn.y > 0.0;
  bool arriere = !cote && !dessus && aN.z >= mx && Nn.z < 0.0;
  bool avant = !cote && !dessus && !arriere && aN.z >= mx && Nn.z > 0.0;
  float ax = abs(P.x);
  float z = P.z;
  float y = P.y;
  if (vLivree < 1.5) {
    // ---- La peinture : le motif, les plaques et le numéro ----
    float m1 = 0.0; float m2 = 0.0; float mp = 0.0; float md = 0.0; float mo = 0.0;
    // Où sont les bandes en long (distance signée, négative dedans).
    float dz = min(max(uBandes.x - z, z - uBandes.y), max(uBandes.z - z, z - uBandes.w));
#if MOTIF == 1
    {
      // 1 : double bande de course, capot - toit - hayon (une large, un filet).
      if (dessus || avant || arriere) {
        float hl = uGeo.x; float g = 0.04; float pin = 0.03; float gap = 0.022; float w = min(0.14, max(0.05, hl - g - pin - gap));
        float d1 = abs(ax - (g + w * 0.5)) - w * 0.5;
        float d2 = abs(ax - (g + w + gap + pin * 0.5)) - pin * 0.5;
        m1 = aaL(max(d1, dz)); m2 = aaL(max(d2, dz));
      }
    }
#elif MOTIF == 2
    {
      // 2 : flancs, un pavé de rayures obliques à 115° (la charte) bordé d'un filet.
      if (cote) {
        vec2 q = vec2(z, y);
        vec2 c = vec2(uFlancs.x + uFlancs.y, uFlancs.z + uFlancs.w) * 0.5; vec2 h = vec2(uFlancs.y - uFlancs.x, uFlancs.w - uFlancs.z) * 0.5;
        float dr = boiteL(q, c, h, 0.0);
        float s = (q.x * -0.4226 + q.y * 0.9063) / 0.1; float f = fract(s);
        float ds = (abs(f - 0.5) - 0.27) * 0.1;
        m1 = aaL(max(dr, ds));
        m2 = aaL(abs(dr + 0.009) - 0.009);
      }
    }
#elif MOTIF == 3
    {
      // 3 : un filet de flanc, une ligne et sa jumelle fine.
      if (cote) {
        m1 = aaL(abs(y - uGeo.z) - 0.026);
        m2 = aaL(abs(y - uGeo.z - 0.062) - 0.009);
      }
    }
#elif MOTIF == 4
    {
      // 4 : bicolore, le toit et les montants (tout ce qui est peint au-dessus de la ligne de vitrage).
      float d = uGeo.y - y;
      m1 = aaL(d);
      m2 = aaL(abs(d) - 0.007) * (1.0 - m1);
    }
#elif MOTIF == 5
    {
      // 5 : chevrons sur le capot, pointe vers l'avant.
      if (dessus || avant) {
        float s = (z + 1.1 * ax) / 0.17; float f = fract(s);
        float ds = (abs(f - 0.5) - 0.2) * 0.17;
        float dzh = max(uBandes.x + 0.16 - z, z - (uBandes.y - 0.1));
        m1 = aaL(max(max(ds, ax - 0.6), dzh));
      }
    }
#elif MOTIF == 6
    {
      // 6 : damier en bout d'aile (deux rangées).
      if (cote) {
        vec2 q = vec2(z, y);
        float y1 = uFlancs.w; float y0 = y1 - 0.12;
        vec2 c = vec2(uFlancs.x + uFlancs.y, y0 + y1) * 0.5; vec2 h = vec2(uFlancs.y - uFlancs.x, y1 - y0) * 0.5;
        float dr = boiteL(q, c, h, 0.0);
        float k = damierL(q - vec2(uFlancs.x, y0), 0.06);
        float r = aaL(dr);
        m1 = r * (1.0 - k); m2 = r * k;
      }
    }
#endif
    // 7 : « numéro en rond », à l'ancienne : un disque sur chaque portière et sur le capot (le numéro est dedans).
    float rond = 0.0;
    float hp = uPortiere.z;
#if MOTIF == 7
    {
      float R = hp * 0.8;
      if (cote) {
        float hc = P.x > 0.0 ? uPortiere.x - z : z - uPortiere.x;
        vec2 p = vec2(hc, y - uPortiere.y);
        float d = length(p) - R;
        rond = aaL(d);
        m1 = rond; m2 = aaL(abs(d + R * 0.1) - R * 0.05) * rond;
        md = chiffresL(p, hp * 1.05) * rond;
      } else if (dessus) {
        float zc = (uBandes.x + uBandes.y) * 0.5;
        vec2 p = vec2(-P.x, z - zc);
        float d = length(p) - R;
        rond = aaL(d);
        m1 = rond; m2 = aaL(abs(d + R * 0.1) - R * 0.05) * rond;
        md = chiffresL(p, hp * 1.05) * rond;
      }
    }
#endif
    // Les plaques de numéro : une sur chaque portière, une sur le hayon (sauf là où un disque porte déjà le numéro).
    float lp = max(hp * 0.9, hp * (0.35 + 0.42 * uNum.w));
    float hh = hp * 1.25;
    if (cote && ROND == 0) {
      float hc = P.x > 0.0 ? uPortiere.x - z : z - uPortiere.x;
      vec2 p = vec2(hc, y - uPortiere.y);
      float dp = boiteL(p, vec2(0.0), vec2(lp, hh) * 0.5, hh * 0.22);
      mp = aaL(dp);
      md = chiffresL(p, hp) * mp;
      mo = aaL(dp - 0.012) - mp;
    }
    if (arriere) {
      float ha = uArriere.y;
      float la = max(ha * 0.9, ha * (0.35 + 0.42 * uNum.w));
      vec2 p = vec2(-P.x, y - uArriere.x);
      float dp = boiteL(p, vec2(0.0), vec2(la, ha * 1.2) * 0.5, ha * 1.2 * 0.22);
      mp = aaL(dp);
      md = chiffresL(p, ha) * mp;
      mo = aaL(dp - 0.012) - mp;
    }
    vec3 col = uCaisse;
    col = mix(col, uC1, m1);
    col = mix(col, uC2, m2);
    col = mix(col, uChiffres, clamp(mo, 0.0, 1.0));
    col = mix(col, uPlaque, mp);
    col = mix(col, uChiffres, md);
    // Les joints : lignes de portes, de capot, de hayon (un trait sombre de 7 mm).
    float joint = 0.0;
    if (cote) { for (int i = 0; i < NJC; i++) { if (dot(uJC[i], uJC[i]) < 0.0001) break; joint = max(joint, aaL(segL(vec2(z, y), uJC[i]) - 0.0035)); } }
    else if (dessus || avant) { for (int i = 0; i < NJT; i++) { if (dot(uJT[i], uJT[i]) < 0.0001) break; joint = max(joint, aaL(segL(vec2(ax, z), uJT[i]) - 0.0035)); } }
    else if (arriere) { for (int i = 0; i < NJR; i++) { if (dot(uJR[i], uJR[i]) < 0.0001) break; joint = max(joint, aaL(segL(vec2(ax, y), uJR[i]) - 0.0035)); } }
    col *= 1.0 - 0.72 * joint;
    // La doublure des passages de roue : sombre, mais lisible (jamais un trou noir).
    if (cote) {
      for (int i = 0; i < 2; i++) {
        vec3 ar = uArches[i];
        if (ar.z > 0.0) {
          float d = length(vec2(z, y) - ar.xy) - ar.z;
          float in_ = aaL(d);
          vec3 doublure = vec3(0.032, 0.034, 0.04) * (0.7 + 0.9 * smoothstep(-0.16, 0.0, d));
          col = mix(col, doublure, in_);
          md *= 1.0 - in_; mp *= 1.0 - in_;
        }
      }
    }
    diffuseColor.rgb *= col;
    gLiv = clamp(max(max(m1, m2), max(mp, md)), 0.0, 1.0);
  } else {
    // ---- Les vitres : teinte sombre, et à peine suggérée, la silhouette des sièges (opaques, aucune transparence) ----
    vec3 g = vec3(0.0);
    if (uInt.w > 0.5) {
      float s = 0.0;
      if (cote) {
        for (int i = 0; i < 2; i++) {
          float zc = i == 0 ? uInt.x : uInt.y;
          vec2 q = (vec2(z, y) - vec2(zc, uInt.z)) / vec2(0.1, 0.13);
          s = max(s, smoothstep(1.0, 0.55, length(q)));
          // Le dossier, plus large, sous la tête.
          vec2 r = (vec2(z, y) - vec2(zc, uInt.z - 0.3)) / vec2(0.2, 0.26);
          s = max(s, 0.7 * smoothstep(1.0, 0.7, length(r)));
        }
      }
      g += vec3(0.05, 0.06, 0.075) * s;
      // Un reflet de ciel en haut de la vitre, plus clair : la vitre se lit comme du verre teinté.
      g += vec3(0.012, 0.016, 0.022) * smoothstep(0.0, 1.0, (y - 0.8) * 2.2);
    }
    diffuseColor.rgb += g;
  }
}
#endif`;
