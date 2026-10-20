import { brotliDecompressSync } from "node:zlib";

// Lecture minimale d'un fichier WOFF2 (lot I1) : les caractères couverts par sa table `cmap` (formats 4 et 12). Sert au test des polices
// (sous-ensemble latin qui couvre le français). Spécification : https://www.w3.org/TR/WOFF2/ (répertoire des tables, flux Brotli).

function base128(buf: Buffer, at: { i: number }): number {
  let v = 0;
  for (let k = 0; k < 5; k++) {
    const b = buf[at.i++]!;
    v = v * 128 + (b & 0x7f);
    if (!(b & 0x80)) return v;
  }
  throw new Error("UIntBase128 trop long");
}

/** Les points de code couverts par la police. */
export function caracteresCouverts(fichier: Buffer): Set<number> {
  if (fichier.toString("latin1", 0, 4) !== "wOF2") throw new Error("pas un fichier WOFF2");
  const numTables = fichier.readUInt16BE(12);
  const compresse = fichier.readUInt32BE(20);
  const at = { i: 48 };
  const tables: { index: number; longueur: number }[] = [];
  for (let n = 0; n < numTables; n++) {
    const flags = fichier[at.i++]!;
    const index = flags & 0x3f;
    if (index === 63) at.i += 4;
    const orig = base128(fichier, at);
    const version = flags >> 6;
    const transforme = index === 10 || index === 11 ? version !== 3 : version !== 0;
    const longueur = transforme ? base128(fichier, at) : orig;
    tables.push({ index, longueur });
  }
  const flux = brotliDecompressSync(fichier.subarray(at.i, at.i + compresse));
  let offset = 0;
  let cmap: Buffer | null = null;
  for (const t of tables) {
    if (t.index === 0) cmap = flux.subarray(offset, offset + t.longueur);
    offset += t.longueur;
  }
  if (!cmap) throw new Error("table cmap absente");
  const codes = new Set<number>();
  const n = cmap.readUInt16BE(2);
  for (let k = 0; k < n; k++) {
    const sub = cmap.readUInt32BE(4 + k * 8 + 4);
    const format = cmap.readUInt16BE(sub);
    if (format === 4) {
      const seg = cmap.readUInt16BE(sub + 6) / 2;
      const ends = sub + 14;
      const starts = ends + seg * 2 + 2;
      const deltas = starts + seg * 2;
      const ranges = deltas + seg * 2;
      for (let s = 0; s < seg; s++) {
        const fin = cmap.readUInt16BE(ends + s * 2);
        const debut = cmap.readUInt16BE(starts + s * 2);
        const delta = cmap.readInt16BE(deltas + s * 2);
        const range = cmap.readUInt16BE(ranges + s * 2);
        for (let c = debut; c <= fin && c !== 0xffff; c++) {
          let glyphe: number;
          if (range === 0) glyphe = (c + delta) & 0xffff;
          else {
            const g = cmap.readUInt16BE(ranges + s * 2 + range + (c - debut) * 2);
            glyphe = g === 0 ? 0 : (g + delta) & 0xffff;
          }
          if (glyphe !== 0) codes.add(c);
        }
      }
    } else if (format === 12) {
      const groupes = cmap.readUInt32BE(sub + 12);
      for (let g = 0; g < groupes; g++) {
        const debut = cmap.readUInt32BE(sub + 16 + g * 12);
        const fin = cmap.readUInt32BE(sub + 20 + g * 12);
        for (let c = debut; c <= fin; c++) codes.add(c);
      }
    }
  }
  return codes;
}
