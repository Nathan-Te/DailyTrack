// Lot 43 — **les sponsors fictifs de la scène, tous ici** (décision de Nathan du 23/10/2026 : « oui, discrets »). Des noms inventés, sans ressemblance
// voulue avec une marque réelle (une quincaillerie, un marchand de pneus, un café, une huile, un garage, une limonade, une gomme, un bidon), dessinés en
// sobres logos-textes dans **une seule texture générée au chargement** (aucun fichier, un seul appel de rendu pour toutes les affiches). Posés sur les
// socles des portiques, la banderole des portes et quelques rebords du départ et de l'arrivée ; **jamais plus lisibles que les panneaux de course** :
// des couleurs éteintes, petits, bas. Ce fichier est exempté du test des chaînes en dur (`packages/ui/test/applications.ts`) : ce sont des noms
// propres fictifs peints dans le décor, pas du texte d'interface ; ils ne se traduisent pas.
import { CanvasTexture, SRGBColorSpace } from "three";
import type { PaletteName } from "@cdj/sim";

export interface Sponsor {
  /** Le nom peint (logo-texte). */
  nom: string;
  /** Une ligne de plus, plus petite (ou rien). */
  sous?: string;
  fond: number;
  encre: number;
}

/** Les sponsors fictifs (8, la décision dit « 6 à 10 au plus »). Couleurs éteintes, loin de l'orange de la voiture (test `scene.test.ts`). */
export const SPONSORS: readonly Sponsor[] = [
  { nom: "BOULON & FILS", sous: "QUINCAILLERIE", fond: 0x3a3f4d, encre: 0xd8dde4 },
  { nom: "PNEUS GRAVILLON", fond: 0x2a2e36, encre: 0xe9e4d6 },
  { nom: "CAFÉ DU VIRAGE", fond: 0x5b3a24, encre: 0xf2e2c4 },
  { nom: "VROMBEX", sous: "HUILES", fond: 0x1f3f5f, encre: 0xdfe8f0 },
  { nom: "TOUR DE CLÉ", sous: "GARAGE", fond: 0xe9e4d6, encre: 0x2a1e16 },
  { nom: "PISTALO", sous: "LIMONADE", fond: 0x2f4a3a, encre: 0xe8eadf },
  { nom: "GOMMIRA", fond: 0x4a3a52, encre: 0xece4f0 },
  { nom: "BIDONIX", sous: "JERRICANS", fond: 0xd8dde4, encre: 0x1f3f5f },
];

/** Cases de l'atlas : 4 colonnes × 2 rangées de 256 × 96 px (texture de 1024 × 192 : un bandeau bas, comme les affiches). */
const COLONNES = 4;
const RANGEES = 2;
const W = 256;
const H = 96;

/** Le rectangle [u0, v0, u1, v1] d'un sponsor dans l'atlas (v = 1 en haut : flipY de three.js). */
export function rectSponsor(i: number): [number, number, number, number] {
  const k = ((i % SPONSORS.length) + SPONSORS.length) % SPONSORS.length;
  const cx = k % COLONNES;
  const cy = Math.floor(k / COLONNES);
  return [cx / COLONNES + 0.003, 1 - (cy + 1) / RANGEES + 0.01, (cx + 1) / COLONNES - 0.003, 1 - cy / RANGEES - 0.01];
}

/** Les sponsors d'un thème, dans l'ordre où on les pose : le même pour tout le monde (tiré du nom du thème, pas du hasard). */
export function sponsorsDuTheme(palette: PaletteName): number[] {
  let h = 0;
  for (let i = 0; i < palette.length; i++) h = (h * 31 + palette.charCodeAt(i)) >>> 0;
  return SPONSORS.map((_, i) => (i + h) % SPONSORS.length);
}

const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Part du fond mêlée à l'encre d'un sponsor : ses lettres sont moins contrastées que les glyphes des panneaux de course (test `palier1.test.ts`). */
export const ATTENUATION = 0.45;
/** L'encre d'un sponsor telle qu'elle est peinte (atténuée vers son fond). */
export function encreDe(s: Sponsor): number {
  const ch = (k: number) => Math.round(((s.encre >> k) & 255) * (1 - ATTENUATION) + ((s.fond >> k) & 255) * ATTENUATION);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

let atlas: CanvasTexture | null = null;
/** L'atlas des sponsors, dessiné une fois au premier besoin (Barlow Condensed 800 italique, la police des bandeaux, déjà chargée par le jeu). */
export function atlasSponsors(): CanvasTexture {
  if (atlas) return atlas;
  const canvas = document.createElement("canvas");
  canvas.width = W * COLONNES;
  canvas.height = H * RANGEES;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  SPONSORS.forEach((s, i) => {
    const x = (i % COLONNES) * W;
    const y = Math.floor(i / COLONNES) * H;
    ctx.fillStyle = css(s.fond);
    ctx.fillRect(x, y, W, H);
    // Un filet de l'encre en haut et en bas : un logo sobre, pas une publicité criarde.
    ctx.fillStyle = css(encreDe(s));
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x + 10, y + 8, W - 20, 3);
    ctx.fillRect(x + 10, y + H - 11, W - 20, 3);
    ctx.globalAlpha = 1;
    ctx.font = `italic 800 ${s.sous ? 40 : 46}px 'Barlow Condensed', 'Archivo', sans-serif`;
    ctx.fillText(s.nom, x + W / 2, y + (s.sous ? 40 : H / 2 + 2), W - 24);
    if (s.sous) {
      ctx.font = "700 17px 'Archivo', sans-serif";
      ctx.fillText(s.sous, x + W / 2, y + 70, W - 40);
    }
  });
  atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  atlas.anisotropy = 4;
  return atlas;
}
