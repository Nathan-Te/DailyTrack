// Moteur A — collision boîte contre boîte, par axes séparateurs puis découpe de l'arête incidente (variante de « Box2D-lite » d'Erin Catto, en virgule fixe Q16).
// Entrée : deux boîtes orientées (centre, demi-dimensions, cosinus et sinus de l'angle du corps). Sortie : jusqu'à 2 contacts (position, normale de A vers B,
// séparation ≤ 0, identifiant de « feature » pour retrouver le contact d'un pas à l'autre et garder son impulsion cumulée).
import { abs, div, mul, mulDiv } from "./fixe";

export interface Contact {
  px: number;
  py: number;
  nx: number;
  ny: number;
  sep: number;
  feature: number;
  // Impulsions cumulées (gardées d'un pas à l'autre : démarrage à chaud)
  pn: number;
  pt: number;
  // Préparées à chaque pas
  r1x: number;
  r1y: number;
  r2x: number;
  r2y: number;
  massNormal: number;
  massTangent: number;
  bias: number;
}

export function newContact(): Contact {
  return { px: 0, py: 0, nx: 0, ny: 0, sep: 0, feature: 0, pn: 0, pt: 0, r1x: 0, r1y: 0, r2x: 0, r2y: 0, massNormal: 0, massTangent: 0, bias: 0 };
}

// Arêtes : 0 = aucune, 1..4 = les quatre arêtes d'une boîte.
interface ClipV {
  x: number;
  y: number;
  in1: number;
  out1: number;
  in2: number;
  out2: number;
}
const nv = (): ClipV => ({ x: 0, y: 0, in1: 0, out1: 0, in2: 0, out2: 0 });
const inc = [nv(), nv()];
const clip1 = [nv(), nv()];
const clip2 = [nv(), nv()];

const REL_TOL = 62259; // 0,95
const ABS_TOL = 655; // 0,01

function setV(d: ClipV, s: ClipV): void {
  d.x = s.x;
  d.y = s.y;
  d.in1 = s.in1;
  d.out1 = s.out1;
  d.in2 = s.in2;
  d.out2 = s.out2;
}

function incidentEdge(hx: number, hy: number, px: number, py: number, c: number, s: number, fnx: number, fny: number): void {
  // normale de la boîte de référence, dans le repère de la boîte incidente, retournée
  const nx = -(mul(c, fnx) + mul(s, fny));
  const ny = -(mul(-s, fnx) + mul(c, fny));
  const ax = abs(nx);
  const ay = abs(ny);
  let v0x: number, v0y: number, v1x: number, v1y: number;
  const [a, b] = inc as [ClipV, ClipV];
  a.in1 = a.out1 = b.in1 = b.out1 = 0;
  if (ax > ay) {
    if (nx > 0) {
      v0x = hx; v0y = -hy; a.in2 = 3; a.out2 = 4;
      v1x = hx; v1y = hy; b.in2 = 4; b.out2 = 1;
    } else {
      v0x = -hx; v0y = hy; a.in2 = 1; a.out2 = 2;
      v1x = -hx; v1y = -hy; b.in2 = 2; b.out2 = 3;
    }
  } else if (ny > 0) {
    v0x = hx; v0y = hy; a.in2 = 4; a.out2 = 1;
    v1x = -hx; v1y = hy; b.in2 = 1; b.out2 = 2;
  } else {
    v0x = -hx; v0y = -hy; a.in2 = 2; a.out2 = 3;
    v1x = hx; v1y = -hy; b.in2 = 3; b.out2 = 4;
  }
  a.x = px + mul(c, v0x) - mul(s, v0y);
  a.y = py + mul(s, v0x) + mul(c, v0y);
  b.x = px + mul(c, v1x) - mul(s, v1y);
  b.y = py + mul(s, v1x) + mul(c, v1y);
}

function clipSegment(out: ClipV[], vin: ClipV[], nx: number, ny: number, offset: number, clipEdge: number): number {
  let n = 0;
  const v0 = vin[0]!;
  const v1 = vin[1]!;
  const d0 = mul(nx, v0.x) + mul(ny, v0.y) - offset;
  const d1 = mul(nx, v1.x) + mul(ny, v1.y) - offset;
  if (d0 <= 0) setV(out[n++]!, v0);
  if (d1 <= 0) setV(out[n++]!, v1);
  if ((d0 > 0 && d1 < 0) || (d0 < 0 && d1 > 0)) {
    const o = out[n]!;
    const den = d0 - d1;
    o.x = v0.x + mulDiv(v1.x - v0.x, d0, den);
    o.y = v0.y + mulDiv(v1.y - v0.y, d0, den);
    if (d0 > 0) {
      o.in1 = clipEdge; o.out1 = v0.out1; o.in2 = 0; o.out2 = v0.out2;
    } else {
      o.in1 = v1.in1; o.out1 = clipEdge; o.in2 = v1.in2; o.out2 = 0;
    }
    n++;
  }
  return n;
}

/** Remplit `out` (au moins 2 contacts alloués) ; rend le nombre de contacts (0, 1 ou 2). */
export function collideBoxes(
  out: Contact[],
  pax: number, pay: number, hax: number, hay: number, ca: number, sa: number,
  pbx: number, pby: number, hbx: number, hby: number, cb: number, sb: number,
): number {
  const dpx = pbx - pax;
  const dpy = pby - pay;
  const dAx = mul(ca, dpx) + mul(sa, dpy);
  const dAy = mul(-sa, dpx) + mul(ca, dpy);
  const dBx = mul(cb, dpx) + mul(sb, dpy);
  const dBy = mul(-sb, dpx) + mul(cb, dpy);
  const cosd = mul(ca, cb) + mul(sa, sb);
  const sind = mul(ca, sb) - mul(sa, cb);
  const ac = abs(cosd);
  const as = abs(sind);
  const faceAx = abs(dAx) - hax - (mul(ac, hbx) + mul(as, hby));
  if (faceAx > 0) return 0;
  const faceAy = abs(dAy) - hay - (mul(as, hbx) + mul(ac, hby));
  if (faceAy > 0) return 0;
  const faceBx = abs(dBx) - (mul(ac, hax) + mul(as, hay)) - hbx;
  if (faceBx > 0) return 0;
  const faceBy = abs(dBy) - (mul(as, hax) + mul(ac, hay)) - hby;
  if (faceBy > 0) return 0;

  // Meilleur axe (avec une préférence pour les faces de A, comme Box2D-lite)
  let axis = 0;
  let sep = faceAx;
  let nx = dAx > 0 ? ca : -ca;
  let ny = dAx > 0 ? sa : -sa;
  if (faceAy > mul(REL_TOL, sep) + mul(ABS_TOL, hay)) {
    axis = 1; sep = faceAy;
    nx = dAy > 0 ? -sa : sa;
    ny = dAy > 0 ? ca : -ca;
  }
  if (faceBx > mul(REL_TOL, sep) + mul(ABS_TOL, hbx)) {
    axis = 2; sep = faceBx;
    nx = dBx > 0 ? cb : -cb;
    ny = dBx > 0 ? sb : -sb;
  }
  if (faceBy > mul(REL_TOL, sep) + mul(ABS_TOL, hby)) {
    axis = 3; sep = faceBy;
    nx = dBy > 0 ? -sb : sb;
    ny = dBy > 0 ? cb : -cb;
  }

  let fnx: number, fny: number, front: number, snx: number, sny: number, negSide: number, posSide: number, negEdge: number, posEdge: number;
  if (axis === 0) {
    fnx = nx; fny = ny;
    front = mul(pax, fnx) + mul(pay, fny) + hax;
    snx = -sa; sny = ca;
    const side = mul(pax, snx) + mul(pay, sny);
    negSide = -side + hay; posSide = side + hay; negEdge = 3; posEdge = 1;
    incidentEdge(hbx, hby, pbx, pby, cb, sb, fnx, fny);
  } else if (axis === 1) {
    fnx = nx; fny = ny;
    front = mul(pax, fnx) + mul(pay, fny) + hay;
    snx = ca; sny = sa;
    const side = mul(pax, snx) + mul(pay, sny);
    negSide = -side + hax; posSide = side + hax; negEdge = 2; posEdge = 4;
    incidentEdge(hbx, hby, pbx, pby, cb, sb, fnx, fny);
  } else if (axis === 2) {
    fnx = -nx; fny = -ny;
    front = mul(pbx, fnx) + mul(pby, fny) + hbx;
    snx = -sb; sny = cb;
    const side = mul(pbx, snx) + mul(pby, sny);
    negSide = -side + hby; posSide = side + hby; negEdge = 3; posEdge = 1;
    incidentEdge(hax, hay, pax, pay, ca, sa, fnx, fny);
  } else {
    fnx = -nx; fny = -ny;
    front = mul(pbx, fnx) + mul(pby, fny) + hby;
    snx = cb; sny = sb;
    const side = mul(pbx, snx) + mul(pby, sny);
    negSide = -side + hbx; posSide = side + hbx; negEdge = 2; posEdge = 4;
    incidentEdge(hax, hay, pax, pay, ca, sa, fnx, fny);
  }

  if (clipSegment(clip1, inc, -snx, -sny, negSide, negEdge) < 2) return 0;
  if (clipSegment(clip2, clip1, snx, sny, posSide, posEdge) < 2) return 0;

  let count = 0;
  for (let i = 0; i < 2; i++) {
    const v = clip2[i]!;
    const separation = mul(fnx, v.x) + mul(fny, v.y) - front;
    if (separation <= 0) {
      const c = out[count]!;
      c.sep = separation;
      c.nx = nx;
      c.ny = ny;
      c.px = v.x - mul(separation, fnx);
      c.py = v.y - mul(separation, fny);
      const flip = axis >= 2;
      c.feature = flip
        ? v.in2 + (v.out2 << 3) + (v.in1 << 6) + (v.out1 << 9)
        : v.in1 + (v.out1 << 3) + (v.in2 << 6) + (v.out2 << 9);
      count++;
    }
  }
  return count;
}
// `div` est réexporté pour que le solveur n'importe qu'un module
export { div };
