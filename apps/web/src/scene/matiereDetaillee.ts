// Retouche 38b, puis 38c — l'**ancienne** matière du palier 2 (« matière détaillée ») : asphalte 512 px avec granulats, rapiéçages, fissures et
// taches d'huile, béton écaillé, métal brossé et rayé, relief simulé (cartes de normales) et rugosité variable. **Décision de Nathan (38c)** : elle
// fait « texture générée » et jure avec une scène taillée nette ; remplacée par la matière sobre (`matiere.ts`). Gardée dans la vitrine sous une
// case coupée par défaut, pour comparer, **à retirer au lot de mise en œuvre**.
import type { DataTexture } from "three";
import { bruit, fractal, graine } from "./bruit";
import { memoiser, texture, type Matiere } from "./matiere";

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

/**
 * Asphalte (512 px pour 6 m) : granulats clairs et sombres, rapiéçages, fissures fines, taches d'huile ; relief des granulats, fissures en creux ;
 * rugosité forte, plus lisse sur les taches.
 */
export function detailleeAsphalte(): Matiere {
  return memoiser("detaillee:asphalte", () => {
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
    return { ...cartes(n, clair, rug), normalMap: carteDeNormales(haut, n, 2.2), rugosite: 1, metal: 0, echelle: 6, relief: 0.55, teinte: 0 };
  });
}

/** Béton peint des rebords (256 px pour 3 m) : écaillures, coulures verticales, éraflures sombres (les touchettes). */
export function detailleeBeton(): Matiere {
  return memoiser("detaillee:beton", () => {
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
    return { ...cartes(n, clair, rug), normalMap: carteDeNormales(haut, n, 1.6), rugosite: 1, metal: 0, echelle: 3, relief: 0.45, teinte: 0 };
  });
}

/** Métal peint des portiques et panneaux (256 px pour 2 m) : brossé, rayures fines, quelques coups. Plus lisse : il brille. */
export function detailleeMetal(): Matiere {
  return memoiser("detaillee:metal", () => {
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
    return { ...cartes(n, clair, rug), normalMap: carteDeNormales(haut, n, 1.2), rugosite: 1, metal: 0.35, echelle: 2, relief: 0.3, teinte: 0 };
  });
}

/** Le décor (256 px pour 4 m) : un grain fin à deux échelles et du relief doux (bois, roche, crépi selon la couleur des sommets). */
export function detailleeDecor(): Matiere {
  return memoiser("detaillee:decor", () => {
    const n = 256;
    const rnd = graine(903);
    const haut = fractal(n, 8, 6, rnd);
    const clair = new Float32Array(n * n);
    const rug = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      clair[i] = 0.84 + haut[i]! * 0.16;
      rug[i] = 0.85 + (haut[i]! - 0.5) * 0.2;
    }
    return { ...cartes(n, clair, rug), normalMap: carteDeNormales(haut, n, 3), rugosite: 1, metal: 0, echelle: 4, relief: 0.6, teinte: 0 };
  });
}
