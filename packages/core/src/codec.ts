// Codage d'octets partagé par les formats de rediffusion : octets ↔ base64url, et entiers de longueur variable (séries compressées).
// Le contenu d'une rediffusion (champs d'une série, bornes, version) reste propre à chaque jeu ; ici, seulement les octets.

/** Erreur de lecture d'un texte ou d'un flux d'octets (le jeu la traduit dans son propre message d'erreur). */
export class CodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodecError";
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toBase64Url(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2]!;
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b !== undefined) out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c !== undefined) out += B64[c & 63]!;
  }
  return out;
}

/** Texte base64url (sans remplissage) → octets. `CodecError` : « caractère invalide » ou « longueur invalide ». */
export function fromBase64Url(text: string): number[] {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < text.length; i++) {
    const v = B64.indexOf(text[i]!);
    if (v < 0) throw new CodecError("caractère invalide");
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
      acc &= (1 << bits) - 1;
    }
  }
  if (bits >= 6) throw new CodecError("longueur invalide");
  return bytes;
}

/** Ajoute `n` (entier ≥ 0) en entier de longueur variable : 7 bits par octet, bit 7 = « suite ». */
export function pushVarint(bytes: number[], n: number): void {
  while (n >= 0x80) {
    bytes.push((n & 0x7f) | 0x80);
    n >>= 7;
  }
  bytes.push(n);
}

/**
 * Lit un entier de longueur variable avec `next()` (un octet à la fois). Au plus `maxShift / 7 + 1` octets : `CodecError` « entier trop long »
 * au-delà (le texte vient du réseau).
 */
export function readVarint(next: () => number, maxShift = 21): number {
  let value = 0;
  let shift = 0;
  for (;;) {
    const b = next();
    value += (b & 0x7f) * (1 << shift);
    if ((b & 0x80) === 0) return value;
    shift += 7;
    if (shift > maxShift) throw new CodecError("entier trop long");
  }
}
