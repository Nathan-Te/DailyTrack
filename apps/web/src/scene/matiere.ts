// Retouche 38b — palier 2, pas « matière » : des textures **calculées au chargement** (aucun fichier), plus fines que le grain du lot 38, avec
// leur relief simulé (cartes de normales tirées d'un champ de hauteurs), leur rugosité variable et leur usure ; et, dessinés en géométrie dans le
// calque de la route (aucun appel de plus), des traces de pneus dans les virages et des marquages au sol avant les virages serrés.
//
// Chaque texture se répète sans couture (bruit périodique) et se multiplie aux couleurs des sommets (elle est presque blanche) : la palette du
// thème reste celle du document de direction. Elles sont dessinées une fois et partagées par toutes les scènes (`memo`).
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType } from "three";
import { CELL, blockHalfWidth, curveSize, isCurve, turnsLeft, type Block, type Track } from "@cdj/sim";
import { shade, type Builder, type V3 } from "../meshKit";
import { onBlock } from "./route";
import { bruit, fractal, graine } from "./bruit";

/** Une matière : couleur (multipliée aux sommets), normales, rugosité ; `echelle` = mètres par répétition, `relief` = force des normales. */
export interface Matiere {
  map: DataTexture;
  normalMap: DataTexture;
  roughnessMap: DataTexture;
  rugosite: number;
  metal: number;
  echelle: number;
  relief: number;
  /** Temps de calcul (ms), la première fois. */
  ms: number;
}

function texture(data: Uint8Array, n: number, couleur: boolean): DataTexture {
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

/** Carte de normales (espace tangent) d'un champ de hauteurs périodique : pentes par différences centrées, `force` = relief. */
export function carteDeNormales(h: Float32Array, n: number, force: number): DataTexture {
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (h[y * n + ((x + 1) % n)]! - h[y * n + ((x - 1 + n) % n)]!) * force;
      const dy = (h[((y + 1) % n) * n + x]! - h[((y - 1 + n) % n) * n + x]!) * force;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      data[i] = Math.round((-dx / l) * 127.5 + 127.5);
      data[i + 1] = Math.round((-dy / l) * 127.5 + 127.5);
      data[i + 2] = Math.round((1 / l) * 127.5 + 127.5);
      data[i + 3] = 255;
    }
  }
  return texture(data, n, false);
}

/** Couleur (gris presque blanc, multiplié aux sommets) et rugosité (canal vert, lu par three.js) d'un champ. */
function cartes(n: number, clair: Float32Array, rugueux: Float32Array): { map: DataTexture; roughnessMap: DataTexture } {
  const c = new Uint8Array(n * n * 4);
  const r = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(clair[i]! * 255)));
    c[i * 4] = c[i * 4 + 1] = c[i * 4 + 2] = v;
    c[i * 4 + 3] = 255;
    const g = Math.max(0, Math.min(255, Math.round(rugueux[i]! * 255)));
    r[i * 4] = r[i * 4 + 1] = r[i * 4 + 2] = g;
    r[i * 4 + 3] = 255;
  }
  return { map: texture(c, n, true), roughnessMap: texture(r, n, false) };
}

/** Trace un trait fin (fissure, rayure) dans un champ, en marche aléatoire ; `valeur` y est écrite (mélangée de `force`). */
function trait(champ: Float32Array, n: number, rnd: () => number, longueur: number, valeur: number, force: number, dir: number | null = null) {
  let x = rnd() * n;
  let y = rnd() * n;
  let a = dir ?? rnd() * Math.PI * 2;
  for (let k = 0; k < longueur; k++) {
    const i = (((Math.floor(y) % n) + n) % n) * n + (((Math.floor(x) % n) + n) % n);
    champ[i] = champ[i]! * (1 - force) + valeur * force;
    a += (rnd() - 0.5) * (dir === null ? 0.9 : 0.15);
    x += Math.cos(a);
    y += Math.sin(a);
  }
}

/** Une tache ronde (rapiéçage, huile, écaillure) : `valeur` mêlée de `force` au centre, s'effaçant au bord. */
function tache(champ: Float32Array, n: number, cx: number, cy: number, r: number, valeur: number, force: number) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d > 1) continue;
      const i = (((y % n) + n) % n) * n + (((x % n) + n) % n);
      const f = force * (1 - d * d);
      champ[i] = champ[i]! * (1 - f) + valeur * f;
    }
  }
}

const memo = new Map<string, Matiere>();
function memoiser(cle: string, f: () => Omit<Matiere, "ms">): Matiere {
  let m = memo.get(cle);
  if (!m) {
    const t0 = performance.now();
    const x = f();
    m = { ...x, ms: performance.now() - t0 };
    memo.set(cle, m);
  }
  return m;
}

/**
 * Asphalte (512 px pour 6 m) : granulats clairs et sombres, rapiéçages, fissures fines, taches d'huile ; relief des granulats, fissures en creux ;
 * rugosité forte, plus lisse sur les taches.
 */
export function matiereAsphalte(): Matiere {
  return memoiser("asphalte", () => {
    const n = 512;
    const rnd = graine(381);
    const base = fractal(n, 16, 5, rnd);
    const fin = bruit(n, 256, rnd);
    const haut = new Float32Array(n * n);
    const clair = new Float32Array(n * n);
    const rug = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const g = fin[i]!;
      haut[i] = base[i]! * 0.35 + g * 0.65;
      clair[i] = 0.86 + (base[i]! - 0.5) * 0.12 + (g > 0.82 ? 0.1 : g < 0.12 ? -0.1 : 0);
      rug[i] = 0.9 + (g - 0.5) * 0.08;
    }
    for (let k = 0; k < 7; k++) tache(clair, n, rnd() * n, rnd() * n, 18 + rnd() * 40, 0.8, 0.6); // rapiéçages
    for (let k = 0; k < 5; k++) {
      const x = rnd() * n;
      const y = rnd() * n;
      const r = 8 + rnd() * 18;
      tache(clair, n, x, y, r, 0.66, 0.5); // huile
      // Un peu plus lisse, pas un miroir : sous les phares de la Nuit, une tache trop lisse brillait comme une flaque.
      tache(rug, n, x, y, r, 0.74, 0.8);
    }
    for (let k = 0; k < 6; k++) {
      const l = 60 + rnd() * 160;
      const g = graine(Math.floor(rnd() * 1e9));
      trait(clair, n, g, l, 0.62, 0.8);
      trait(haut, n, graine(Math.floor(rnd() * 1e9)), l, 0, 0.9);
    }
    return { ...cartes(n, clair, rug), normalMap: carteDeNormales(haut, n, 2.2), rugosite: 1, metal: 0, echelle: 6, relief: 0.55 };
  });
}

/** Béton peint des rebords (256 px pour 3 m) : écaillures, coulures verticales, éraflures sombres (les touchettes). */
export function matiereBeton(): Matiere {
  return memoiser("beton", () => {
    const n = 256;
    const rnd = graine(512);
    const base = fractal(n, 8, 5, rnd);
    const haut = new Float32Array(base);
    const clair = new Float32Array(n * n);
    const rug = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      clair[i] = 0.9 + (base[i]! - 0.5) * 0.14;
      rug[i] = 0.62 + (base[i]! - 0.5) * 0.2;
    }
    for (let k = 0; k < 26; k++) {
      const x = rnd() * n;
      const y = rnd() * n;
      const r = 2 + rnd() * 6;
      tache(clair, n, x, y, r, 1, 0.5); // écaillure : le béton clair sous la peinture
      tache(haut, n, x, y, r, 0.2, 0.7);
      tache(rug, n, x, y, r, 0.9, 0.7);
    }
    for (let k = 0; k < 10; k++) trait(clair, n, graine(Math.floor(rnd() * 1e9)), 40 + rnd() * 80, 0.72, 0.35, Math.PI / 2); // coulures
    for (let k = 0; k < 8; k++) trait(clair, n, graine(Math.floor(rnd() * 1e9)), 30 + rnd() * 60, 0.35, 0.55, (rnd() - 0.5) * 0.3); // éraflures de pneus
    return { ...cartes(n, clair, rug), normalMap: carteDeNormales(haut, n, 1.6), rugosite: 1, metal: 0, echelle: 3, relief: 0.45 };
  });
}

/** Métal peint des portiques et panneaux (256 px pour 2 m) : brossé, rayures fines, quelques coups. Plus lisse : il brille. */
export function matiereMetal(): Matiere {
  return memoiser("metal", () => {
    const n = 256;
    const rnd = graine(77);
    const brosse = new Float32Array(n * n);
    // Brossé : un bruit étiré dans un seul sens (lignes horizontales).
    const lignes = bruit(n, 64, rnd);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) brosse[y * n + x] = lignes[y * n + Math.floor(x / 16)]!;
    const haut = new Float32Array(brosse);
    const clair = new Float32Array(n * n);
    const rug = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      clair[i] = 0.93 + (brosse[i]! - 0.5) * 0.06;
      rug[i] = 0.42 + (brosse[i]! - 0.5) * 0.12;
    }
    for (let k = 0; k < 14; k++) {
      const g = graine(Math.floor(rnd() * 1e9));
      trait(clair, n, g, 20 + rnd() * 50, 1, 0.4, rnd() * Math.PI);
      trait(rug, n, graine(Math.floor(rnd() * 1e9)), 20 + rnd() * 50, 0.25, 0.6, rnd() * Math.PI);
    }
    for (let k = 0; k < 6; k++) tache(haut, n, rnd() * n, rnd() * n, 3 + rnd() * 5, 0, 0.6);
    return { ...cartes(n, clair, rug), normalMap: carteDeNormales(haut, n, 1.2), rugosite: 1, metal: 0.35, echelle: 2, relief: 0.3 };
  });
}

/** Le décor (256 px pour 4 m) : un grain fin à deux échelles et du relief doux (bois, roche, crépi selon la couleur des sommets). */
export function matiereDecor(): Matiere {
  return memoiser("decor", () => {
    const n = 256;
    const rnd = graine(903);
    const haut = fractal(n, 8, 6, rnd);
    const clair = new Float32Array(n * n);
    const rug = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      clair[i] = 0.84 + haut[i]! * 0.16;
      rug[i] = 0.85 + (haut[i]! - 0.5) * 0.2;
    }
    return { ...cartes(n, clair, rug), normalMap: carteDeNormales(haut, n, 3), rugosite: 1, metal: 0, echelle: 4, relief: 0.6 };
  });
}

/** Toutes les textures de matière déjà dessinées (la vitrine compte leur mémoire et leur temps de calcul). */
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

/**
 * Traces de pneus et marquages : dans chaque virage sur route, la trajectoire (extérieur, corde, extérieur) usée en deux traces sombres ; avant un
 * virage serré, des traces de freinage droites et deux barres de repère peintes sur la moitié extérieure. Ni cuve, ni bas-côté, ni saut.
 */
export function tracesEtMarquages(g: Builder, track: Track, couleurRoute: (b: Block) => number, peinture: number) {
  for (const b of track.blocks) {
    if (b.cuve || b.surface !== "road" || b.kind === "gap" || b.kind === "jump" || b.kind === "kick") continue;
    const sombre = shade(couleurRoute(b), 0.7);
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
