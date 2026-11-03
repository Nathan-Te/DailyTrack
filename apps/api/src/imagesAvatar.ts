// Lot C1, partie B (plateforme) — le contrôle d'une image d'avatar ou d'emblème **par le serveur**, sans dépendance : il lit lui-même les en-têtes. Une image envoyée est du WebP (RIFF, **un seul segment**
// `VP8 ` ou `VP8L`) ou du JPEG, **sans segment EXIF, XMP ni ICC** (ni aucun autre segment qui porte des métadonnées), de 128 × 128 pixels au plus et de 20 Ko au plus. Pas de SVG, de PNG, de GIF ni de WebP animé
// ou étendu (`VP8X`) : un format qui n'est pas dans cette liste est refusé tel quel. Le navigateur réencode l'image par un canvas avant l'envoi (ce qui retire déjà les métadonnées) ; **le serveur ne lui fait pas
// confiance** et revérifie tout. Fonctions pures : testées octet par octet (`test/avatars.test.ts`).

export const IMAGE_OCTETS_MAX = 20 * 1024;
export const IMAGE_COTE_MAX = 128;
/** Un côté plus petit n'est pas un avatar (et le canvas du navigateur sort toujours du 128 × 128). */
export const IMAGE_COTE_MIN = 16;

export type RaisonImage = "taille" | "format" | "metadonnees" | "dimensions";
export class ImageRefusee extends Error {
  constructor(readonly raison: RaisonImage) {
    super(`image refusée : ${raison}`);
  }
}
export interface ImageControlee {
  mime: "image/webp" | "image/jpeg";
  largeur: number;
  hauteur: number;
}

const u16 = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const le16 = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const le32 = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const texte = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function controlerWebp(b: Uint8Array): { largeur: number; hauteur: number } {
  if (b.length < 20 || texte(b, 0, 4) !== "RIFF" || texte(b, 8, 4) !== "WEBP") throw new ImageRefusee("format");
  if (le32(b, 4) + 8 !== b.length) throw new ImageRefusee("format"); // la taille annoncée est la taille reçue : rien après
  const type = texte(b, 12, 4);
  // Un seul segment d'image. `VP8X` (le WebP étendu) est la porte des métadonnées et de l'animation ; `EXIF`, `XMP `, `ICCP`, `ANIM`, `ANMF`, `ALPH` n'existent qu'avec lui : tout autre segment est refusé.
  if (["VP8X", "EXIF", "XMP ", "ICCP", "ANIM", "ANMF", "ALPH"].includes(type)) throw new ImageRefusee("metadonnees");
  if (type !== "VP8 " && type !== "VP8L") throw new ImageRefusee("format");
  const taille = le32(b, 16);
  const fin = 20 + taille + (taille % 2);
  if (fin !== b.length && 20 + taille !== b.length) throw new ImageRefusee("metadonnees"); // des octets après l'image : un second segment
  const d = b.subarray(20, 20 + taille);
  if (type === "VP8 ") {
    if (d.length < 10 || (d[0]! & 1) !== 0 || d[3] !== 0x9d || d[4] !== 0x01 || d[5] !== 0x2a) throw new ImageRefusee("format");
    return { largeur: le16(d, 6) & 0x3fff, hauteur: le16(d, 8) & 0x3fff };
  }
  if (d.length < 5 || d[0] !== 0x2f) throw new ImageRefusee("format");
  const bits = le32(d, 1);
  return { largeur: (bits & 0x3fff) + 1, hauteur: ((bits >>> 14) & 0x3fff) + 1 };
}

function controlerJpeg(b: Uint8Array): { largeur: number; hauteur: number } {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new ImageRefusee("format");
  let i = 2;
  let dims: { largeur: number; hauteur: number } | null = null;
  let fini = false;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new ImageRefusee("format");
    while (b[i] === 0xff) i++; // octets de remplissage
    const m = b[i++]!;
    if (m === 0xd9) {
      fini = i === b.length; // EOI : le dernier octet
      break;
    }
    if (m === 0x00 || m === 0x01 || m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) throw new ImageRefusee("format");
    if (i + 2 > b.length) throw new ImageRefusee("format");
    const longueur = u16(b, i);
    if (longueur < 2 || i + longueur > b.length) throw new ImageRefusee("format");
    // EXIF et XMP (APP1), ICC (APP2), tout autre APPn (3 à 15) et les commentaires (COM) portent des métadonnées. APP0 (JFIF) seul est permis.
    if ((m >= 0xe1 && m <= 0xef) || m === 0xfe) throw new ImageRefusee("metadonnees");
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
      if (longueur < 8) throw new ImageRefusee("format");
      dims = { hauteur: u16(b, i + 3), largeur: u16(b, i + 5) };
    } else if ((m >= 0xc3 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) || m === 0xc8) {
      throw new ImageRefusee("format"); // sans perte, arithmétique, hiérarchique : pas ce qu'un navigateur encode
    }
    i += longueur;
    if (m === 0xda) {
      // Les données de l'image : jusqu'au prochain marqueur qui n'est ni un octet bourré (FF 00) ni un redémarrage (FF D0 à D7).
      while (i < b.length && !(b[i] === 0xff && b[i + 1] !== 0x00 && !(b[i + 1]! >= 0xd0 && b[i + 1]! <= 0xd7))) i++;
    }
  }
  if (!dims || !fini) throw new ImageRefusee("format");
  return dims;
}

/** Contrôle une image : sa taille, son format, ses segments, ses dimensions. Lève `ImageRefusee` (la `raison` est dite au client). */
export function controlerImage(octets: Uint8Array): ImageControlee {
  if (octets.length === 0 || octets.length > IMAGE_OCTETS_MAX) throw new ImageRefusee("taille");
  const webp = octets.length >= 12 && texte(octets, 0, 4) === "RIFF";
  const jpeg = octets.length >= 2 && octets[0] === 0xff && octets[1] === 0xd8;
  if (!webp && !jpeg) throw new ImageRefusee("format");
  const { largeur, hauteur } = webp ? controlerWebp(octets) : controlerJpeg(octets);
  if (largeur !== hauteur || largeur < IMAGE_COTE_MIN || largeur > IMAGE_COTE_MAX) throw new ImageRefusee("dimensions");
  return { mime: webp ? "image/webp" : "image/jpeg", largeur, hauteur };
}

/** De la base64 (standard, sans espace) aux octets ; `null` si ce n'en est pas. */
export function octetsDeBase64(x: unknown): Uint8Array | null {
  if (typeof x !== "string" || x.length === 0 || x.length > Math.ceil((IMAGE_OCTETS_MAX * 4) / 3) + 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(x) || x.length % 4 !== 0) return null;
  const binaire = atob(x);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}
