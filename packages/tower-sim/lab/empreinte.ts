// Lot T0 — l'empreinte d'un état : deux hachages FNV-1a de 32 bits (graines différentes) sur les OCTETS exacts de chaque nombre (float64, petit-boutiste) ;
// un -0 ou un dernier bit différents donnent une autre empreinte. Aucune dépendance (identique sur Node et dans les trois navigateurs).
import type { Snapshot } from "./interface";

const buf = new DataView(new ArrayBuffer(8));

export class Hasher {
  private a = 0x811c9dc5;
  private b = 0x9747b28c;

  byte(v: number): void {
    this.a = Math.imul(this.a ^ v, 0x01000193) >>> 0;
    this.b = Math.imul(this.b ^ (v + 0x5b), 0x01000193) >>> 0;
  }

  int(v: number): void {
    for (let i = 0; i < 4; i++) this.byte((v >>> (8 * i)) & 0xff);
  }

  /** float64 exact ; tous les NaN comptent pour un seul. */
  float(v: number): void {
    buf.setFloat64(0, v !== v ? NaN : v, true);
    for (let i = 0; i < 8; i++) this.byte(buf.getUint8(i));
  }

  hex(): string {
    return this.a.toString(16).padStart(8, "0") + this.b.toString(16).padStart(8, "0");
  }
}

/** Empreinte d'un instantané : tick, puis pour chaque pièce son id, x, y, angle et son drapeau « perdue ». */
export function empreinte(s: Snapshot): string {
  const h = new Hasher();
  h.int(s.tick);
  for (const p of s.pieces) {
    h.int(p.id);
    h.float(p.x);
    h.float(p.y);
    h.float(p.angle);
    h.byte(p.lost ? 1 : 0);
  }
  return h.hex();
}

/** Empreinte d'un texte (pour figer la suite de commandes du banc). */
export function empreinteTexte(t: string): string {
  const h = new Hasher();
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h.byte(c & 0xff);
    h.byte(c >>> 8);
  }
  return h.hex();
}
