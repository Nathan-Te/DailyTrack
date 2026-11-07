// Lot C1, partie B — le recadrage de l'avatar, la logique pure (testée : `test/avatar.test.ts`). Le navigateur recadre l'image choisie en **carré**, la redimensionne à 256 × 256 (lot U4 : 128 avant, trop flou sur le podium d'un écran Retina) et la réencode par un canvas
// (WebP, sinon JPEG si le navigateur n'encode pas le WebP) : ce réencodage retire aussi les métadonnées (position, appareil). Le serveur revérifie tout.

export const COTE_SORTIE = 256;
export const OCTETS_MAX = 40 * 1024;
export const ZOOM_MAX = 4;
/** Les qualités essayées, de la meilleure à la plus faible, jusqu'à passer sous `OCTETS_MAX`. */
export const QUALITES = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3] as const;

export interface Cadrage {
  /** 1 = le plus grand carré qui tient dans l'image ; jusqu'à `ZOOM_MAX` (on resserre). */
  zoom: number;
  /** Le centre du carré, en part de l'image (0 à 1) : 0,5 / 0,5 = le milieu. */
  cx: number;
  cy: number;
}
export const CADRAGE_INITIAL: Cadrage = { zoom: 1, cx: 0.5, cy: 0.5 };

/** Le carré à découper dans une image de `largeur × hauteur` : toujours **dans** l'image (le centre est ramené si le carré dépasserait). */
export function carreDeRecadrage(largeur: number, hauteur: number, c: Cadrage): { sx: number; sy: number; cote: number } {
  const zoom = Math.min(ZOOM_MAX, Math.max(1, Number.isFinite(c.zoom) ? c.zoom : 1));
  const cote = Math.max(1, Math.floor(Math.min(largeur, hauteur) / zoom));
  const borne = (centre: number, total: number) => Math.min(total - cote, Math.max(0, Math.round((Number.isFinite(centre) ? centre : 0.5) * total - cote / 2)));
  return { sx: borne(c.cx, largeur), sy: borne(c.cy, hauteur), cote };
}

/** Déplacer le cadrage de `dx`, `dy` pixels d'écran sur un aperçu de `apercu` pixels de côté (le doigt tire l'image : le carré va dans l'autre sens). */
export function deplacer(c: Cadrage, largeur: number, hauteur: number, dx: number, dy: number, apercu: number): Cadrage {
  const { cote } = carreDeRecadrage(largeur, hauteur, c);
  const k = cote / apercu; // pixels d'image par pixel d'aperçu
  return { zoom: c.zoom, cx: c.cx - (dx * k) / largeur, cy: c.cy - (dy * k) / hauteur };
}

/** Le type de sortie : WebP si le navigateur l'a encodé, sinon JPEG (un navigateur qui ne sait pas encoder le WebP rend du PNG). */
export function typeDeSortie(typeObtenu: string): "image/webp" | "image/jpeg" | null {
  return typeObtenu === "image/webp" ? "image/webp" : typeObtenu === "image/jpeg" ? "image/jpeg" : null;
}

/** De la base64 d'octets (par morceaux : jamais un appel avec 40 000 arguments). */
export function versBase64(octets: Uint8Array): string {
  let s = "";
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Ce que le navigateur a encodé, **assaini** avant l'envoi : le serveur refuse tout ce qui n'est pas une image nue (pas d'EXIF, de XMP, de profil ICC ni d'animation), or certains navigateurs
 * (Chromium) écrivent un WebP étendu `VP8X` avec un profil ICC. On en retire tout sauf le segment d'image (`VP8 ` ou `VP8L`) ; pour un JPEG on retire les segments d'application `APP1`…`APP15`
 * et les commentaires (le `JFIF` en `APP0` reste). Rend `null` si l'image n'est pas lisible ou a de la transparence (`ALPH`) ou une animation : l'appelant essaie une autre qualité ou refuse.
 */
export function assainirImage(octets: Uint8Array, type: "image/webp" | "image/jpeg"): Uint8Array | null {
  return type === "image/webp" ? assainirWebp(octets) : assainirJpeg(octets);
}
const mot = (o: Uint8Array, i: number): string => String.fromCharCode(o[i]!, o[i + 1]!, o[i + 2]!, o[i + 3]!);
const entier32 = (o: Uint8Array, i: number): number => (o[i]! | (o[i + 1]! << 8) | (o[i + 2]! << 16) | (o[i + 3]! << 24)) >>> 0;
function assainirWebp(o: Uint8Array): Uint8Array | null {
  if (o.length < 20 || mot(o, 0) !== "RIFF" || mot(o, 8) !== "WEBP") return null;
  let image: Uint8Array | null = null;
  for (let i = 12; i + 8 <= o.length; ) {
    const type = mot(o, i);
    const taille = entier32(o, i + 4);
    const fin = i + 8 + taille;
    if (fin > o.length) return null;
    if (type === "ALPH" || type === "ANIM" || type === "ANMF") return null;
    if (type === "VP8 " || type === "VP8L") {
      if (image) return null;
      image = o.subarray(i, fin + (taille % 2));
    }
    i = fin + (taille % 2);
  }
  if (!image) return null;
  const corps = image.length + 4; // « WEBP » + le segment
  const sortie = new Uint8Array(12 + image.length);
  sortie.set([0x52, 0x49, 0x46, 0x46, corps & 255, (corps >> 8) & 255, (corps >> 16) & 255, (corps >>> 24) & 255, 0x57, 0x45, 0x42, 0x50]);
  sortie.set(image, 12);
  return sortie;
}
function assainirJpeg(o: Uint8Array): Uint8Array | null {
  if (o.length < 4 || o[0] !== 0xff || o[1] !== 0xd8) return null;
  const morceaux: Uint8Array[] = [o.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= o.length) {
    if (o[i] !== 0xff) return null;
    const marqueur = o[i + 1]!;
    if (marqueur === 0xda) {
      morceaux.push(o.subarray(i)); // le début du balayage : tout le reste est de l'image
      i = o.length;
      break;
    }
    const taille = (o[i + 2]! << 8) | o[i + 3]!;
    if (taille < 2 || i + 2 + taille > o.length) return null;
    const retire = (marqueur >= 0xe1 && marqueur <= 0xef) || marqueur === 0xfe;
    if (!retire) morceaux.push(o.subarray(i, i + 2 + taille));
    i += 2 + taille;
  }
  if (i < o.length) return null;
  const sortie = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
  let p = 0;
  for (const m of morceaux) {
    sortie.set(m, p);
    p += m.length;
  }
  return sortie;
}
