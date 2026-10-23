// Lot 40 — la livrée de Track et sa palette. La couleur de la caisse est un paramètre du modèle ; les bandes, la plaque du numéro et le pourtour
// des feux s'y adaptent pour rester lisibles (bandes crème sur une caisse sombre, asphalte sur une caisse claire, les deux sur une caisse de
// clarté moyenne comme l'orange). La livrée est **une texture dessinée au chargement** (aucun fichier) : le dessus (bandes obliques à 115° de la
// charte sur le capot et le toit), les deux flancs (le numéro du jour sur les portières, en Barlow Condensed 800 italique, la police du chrono)
// et l'arrière (le numéro, en grand). Changer de couleur redessine la texture : la géométrie ne bouge pas.
// Retouche 40b : trois motifs (`bande` : la bande centrale ; `flancs` : un pavé de rayures sur chaque flanc, comme le bord de l'étiquette Track ;
// `unie` : sans rayures ; le numéro reste toujours), et un **masque de nuit** dans l'alpha de la texture : les rayures, la plaque et le numéro y
// valent 0,5 (le reste 1) ; la Nuit, le matériau les rend légèrement lumineux (`uNuit`, pieces.ts) pour que la voiture se lise.
import { CanvasTexture, SRGBColorSpace } from "three";

/** Couleurs de la marque (jetons `--track-*` et `--dj-*` de packages/ui/src/jetons.ts, recopiés en nombres : le rendu 3D ne lit pas le CSS). */
export const LIVREE = { orange: 0xe8552d, creme: 0xede3cf, asphalte: 0x1e1b19 } as const;

/** Le motif de la livrée (personnalisation du Garage, lot 41). */
export type MotifLivree = "bande" | "flancs" | "unie";
export const MOTIFS: readonly MotifLivree[] = ["bande", "flancs", "unie"];

/** Une couleur de la palette : identifiant, nom (vitrine, outil interne en français), valeur. */
export interface CouleurVoiture {
  id: string;
  nom: string;
  hex: number;
}

/**
 * La palette proposée (8 couleurs, orange de Track par défaut). Chacune s'écarte de tout élément de piste de chaque thème (route, rebords,
 * vibreurs, plaques, portes, sol : `ecartCouleurs`, ΔE 2000, test `voitureLivree.test.ts`) et reste assez claire pour la Nuit (clarté L* ≥ 35).
 * Écartées : crème et blanc (rebords et neige), asphalte et noir (rebords noirs, la Nuit), bleu (rebords du Stade, portes), jaune (plaques
 * d'accélération), rouge (vibreurs, super turbo), vert vif (pelouse), turquoise (portes et accent du Canyon), argent et gris (route, Ville), et
 * les teintes sombres (bordeaux, sapin, pétrole foncé : invisibles la nuit et sur la route du Canyon, planche du README). Le README a la planche.
 */
export const PALETTE: readonly CouleurVoiture[] = [
  { id: "orange", nom: "Orange Track", hex: LIVREE.orange },
  { id: "grenat", nom: "Grenat", hex: 0xa3264f },
  { id: "fuchsia", nom: "Fuchsia", hex: 0xd63aa6 },
  { id: "glycine", nom: "Glycine", hex: 0xc9a0dc },
  { id: "petrole", nom: "Pétrole", hex: 0x2e86a6 },
  { id: "lagon", nom: "Lagon", hex: 0x7fd6e0 },
  { id: "olive", nom: "Olive", hex: 0x7d8a2e },
  { id: "poudre", nom: "Rose poudré", hex: 0xe0a3a0 },
];

/** Luminance relative (0 à 1) d'une couleur sRGB. */
export function luminance(hex: number): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((hex >> 16) & 255) + 0.7152 * lin((hex >> 8) & 255) + 0.0722 * lin(hex & 255);
}

/** Ce que la livrée dessine pour une couleur de caisse. */
export interface Livree {
  caisse: number;
  /** Couleurs des bandes, en alternance (une ou deux). */
  bandes: readonly number[];
  /** Plaque du numéro et chiffres. */
  plaque: number;
  chiffres: number;
  /** Clarté de la caisse : sombre (bandes crème), moyenne (crème et asphalte), claire (asphalte). */
  clarte: "sombre" | "moyenne" | "claire";
}

/** La livrée d'une couleur de caisse : bandes et numéro qui restent lisibles. */
export function livreeDe(caisse: number): Livree {
  const y = luminance(caisse);
  const clarte = y < 0.11 ? "sombre" : y > 0.36 ? "claire" : "moyenne";
  const bandes = clarte === "sombre" ? [LIVREE.creme] : clarte === "claire" ? [LIVREE.asphalte] : [LIVREE.creme, LIVREE.asphalte];
  const claire = clarte === "claire";
  return { caisse, bandes, plaque: claire ? LIVREE.asphalte : LIVREE.creme, chiffres: claire ? LIVREE.creme : LIVREE.asphalte, clarte };
}

// --- Écart entre deux couleurs (CIEDE2000) : la palette ne se confond avec aucun élément de piste ----------------------------------------

function lab(hex: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((hex >> 16) & 255);
  const g = lin((hex >> 8) & 255);
  const b = lin(hex & 255);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** Écart perçu entre deux couleurs (ΔE 2000 : sous 10, on les confond de loin ; au-dessus de 20, elles se séparent nettement). */
export function ecartCouleurs(a: number, b: number): number {
  const [L1, a1, b1] = lab(a);
  const [L2, a2, b2] = lab(b);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1 = ((Math.atan2(b1, a1p) / rad) % 360 + 360) % 360;
  const h2 = ((Math.atan2(b2, a2p) / rad) % 360 + 360) % 360;
  const dL = L2 - L1;
  const dC = C2p - C1p;
  let dh = h2 - h1;
  if (C1p * C2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lb = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  const hb = C1p * C2p === 0 ? h1 + h2 : Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dth = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dth * rad) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

// --- La texture de la livrée ---------------------------------------------------------------------------------------------------------

/** Où la livrée est posée sur un modèle (mètres, repère de la voiture : +z vers l'avant, +x à gauche). */
export interface CadreLivree {
  /** Étendue en long (arrière, avant) et demi-largeur couverte par la projection du dessus. */
  z: [number, number];
  demiLargeur: number;
  /** Hauteur couverte par les flancs et l'arrière. */
  hauteur: number;
  /** Zones des bandes (capot, toit…), en long : la bande centrale de rayures obliques. */
  bandes: [number, number][];
  /** Largeur de la bande centrale (m). */
  largeurBande: number;
  /** Le numéro sur les portières : centre (z, y), hauteur des chiffres (m). */
  portiere: { z: number; y: number; h: number };
  /** Le numéro à l'arrière : centre (x = 0, y), hauteur des chiffres (m). */
  arriere: { y: number; h: number };
  /** Le pavé de rayures du motif `flancs` : étendue en long (arrière, avant) et en hauteur (m). */
  flancs: { z: [number, number]; y: [number, number] };
}

/** Régions de la texture (u0, v0, u1, v1) : le dessus, le flanc gauche (+x), le flanc droit, l'arrière. */
const REGIONS = { dessus: [0, 0, 0.5, 1], gauche: [0.5, 0.625, 1, 1], droit: [0.5, 0.25, 1, 0.625], arriere: [0.5, 0, 1, 0.25] } as const;

type UV6 = [number, number, number, number, number, number];
type P3 = readonly [number, number, number];

/** Coordonnées de livrée d'un triangle peint, selon sa normale : dessus, flancs, arrière (l'avant prend le fond du dessus, sans dessin). */
export function projectionLivree(c: CadreLivree): (s: [P3, P3, P3], n: P3) => UV6 {
  const [z0, z1] = c.z;
  const map = (r: readonly [number, number, number, number], u: number, v: number): [number, number] => [r[0] + (r[2] - r[0]) * Math.min(1, Math.max(0, u)), r[1] + (r[3] - r[1]) * Math.min(1, Math.max(0, v))];
  return (s, n) => {
    const out: number[] = [];
    for (const p of s) {
      let uv: [number, number];
      if (n[1] > 0.5) uv = map(REGIONS.dessus, (p[0] + c.demiLargeur) / (2 * c.demiLargeur), (p[2] - z0) / (z1 - z0));
      else if (n[0] > 0.45) uv = map(REGIONS.gauche, (z1 - p[2]) / (z1 - z0), p[1] / c.hauteur);
      else if (n[0] < -0.45) uv = map(REGIONS.droit, (p[2] - z0) / (z1 - z0), p[1] / c.hauteur);
      else if (n[2] < -0.5) uv = map(REGIONS.arriere, (c.demiLargeur - p[0]) / (2 * c.demiLargeur), p[1] / c.hauteur);
      else uv = map(REGIONS.dessus, 0.02, 0.02);
      out.push(uv[0], uv[1]);
    }
    return out as UV6;
  };
}

const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
/** La police des chiffres (celle du chrono). */
export const POLICE_NUMERO = "'Barlow Condensed', 'Arial Narrow', sans-serif";

/** La livrée dessinée : la texture et de quoi la redessiner (autre couleur, autre numéro, autre motif). */
export interface TextureLivree {
  texture: CanvasTexture;
  peindre(caisse: number, numero: string, motif?: MotifLivree): void;
  dispose(): void;
}

/** Dessine la livrée d'un modèle (`largeur` px : 512 au palier 1, 1024 aux paliers 2 et 3). */
export function textureLivree(c: CadreLivree, largeur: number, caisse: number, numero: string, motif: MotifLivree = "bande"): TextureLivree {
  // Sans document (tests en Node), une toile vide : la géométrie se construit, rien n'est dessiné.
  const canvas: HTMLCanvasElement = typeof document === "undefined" ? ({ width: largeur, height: largeur, getContext: () => null } as unknown as HTMLCanvasElement) : document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = largeur;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  let motifCourant = motif;
  const peindre = (couleur: number, num: string, motifVoulu: MotifLivree = motifCourant) => {
    motifCourant = motifVoulu;
    const x = canvas.getContext("2d");
    if (!x) return;
    const L = livreeDe(couleur);
    const W = canvas.width;
    const H = canvas.height;
    x.globalCompositeOperation = "source-over";
    x.fillStyle = css(L.caisse);
    x.fillRect(0, 0, W, H);
    // Repère d'une région : (u, v) de la texture → pixels du canvas (le haut du canvas est v = 1).
    const px = (r: readonly number[], u: number, v: number): [number, number] => [(r[0]! + (r[2]! - r[0]!) * u) * W, (1 - (r[1]! + (r[3]! - r[1]!) * v)) * H];
    const [z0, z1] = c.z;
    const longueur = z1 - z0;
    const d = REGIONS.dessus;
    const mx = (m: number) => px(d, (m + c.demiLargeur) / (2 * c.demiLargeur), 0)[0];
    const mz = (m: number) => px(d, 0, (m - z0) / (z1 - z0))[1];
    const pxParM = (mx(1) - mx(0)) || 1;
    const pas = 0.24 * pxParM; // une rayure de 0,13 m et 0,11 m de vide, mesurés en travers
    const epaisseur = 0.13 * pxParM;
    /** Le filet qui borde un pavé de rayures : asphalte (crème sur une caisse sombre). */
    const filet = css(L.clarte === "sombre" ? LIVREE.creme : LIVREE.asphalte);
    // Deux passes : la peinture, puis le masque de nuit (les mêmes formes, qui ôtent la moitié de l'alpha : la Nuit les allume).
    for (const masque of [false, true]) {
      if (masque) {
        x.globalCompositeOperation = "destination-out";
        x.fillStyle = "rgba(0, 0, 0, 0.5)";
      }
      const remplir = (style: string) => {
        if (!masque) x.fillStyle = style;
      };
      /** Un pavé de rayures obliques à 115° (charte) dans le rectangle (x, y, l, h) du canvas, bordé d'un filet sur ses côtés `bords`. */
      const rayures = (rx: number, ry: number, rl: number, rh: number, bords: "cotes" | "hautBas", finesse = 1) => {
        x.save();
        x.beginPath();
        x.rect(rx, ry, rl, rh);
        x.clip();
        x.translate(rx + rl / 2, ry + rh / 2);
        x.rotate(((115 - 90) * Math.PI) / 180);
        const etendue = Math.hypot(rl, rh) + pas * 2;
        let k = 0;
        for (let t = -etendue; t < etendue; t += pas * finesse, k++) {
          remplir(css(L.bandes[k % L.bandes.length]!));
          x.fillRect(t, -etendue, epaisseur * finesse, etendue * 2);
        }
        x.restore();
        // Un filet borde le pavé : il se lit même vu de loin.
        remplir(filet);
        const f = Math.max(2, 0.025 * pxParM);
        if (bords === "cotes") {
          x.fillRect(rx - f, ry, f, rh);
          x.fillRect(rx + rl, ry, f, rh);
        } else {
          x.fillRect(rx, ry - f, rl, f);
          x.fillRect(rx, ry + rh, rl, f);
        }
      };
      // `bande` : la bande centrale de rayures sur le capot et le toit.
      if (motifCourant === "bande") for (const [a, b] of c.bandes) rayures(mx(-c.largeurBande / 2), mz(b), mx(c.largeurBande / 2) - mx(-c.largeurBande / 2), mz(a) - mz(b), "cotes");
      // `flancs` : un pavé de rayures à l'arrière de chaque flanc, comme le bord de l'étiquette Track.
      if (motifCourant === "flancs") {
        for (const cote of ["gauche", "droit"] as const) {
          const r = REGIONS[cote];
          const u = (zz: number) => (cote === "gauche" ? (z1 - zz) / longueur : (zz - z0) / longueur);
          const [xa, ya] = px(r, u(c.flancs.z[0]), c.flancs.y[1] / c.hauteur);
          const [xb, yb] = px(r, u(c.flancs.z[1]), c.flancs.y[0] / c.hauteur);
          rayures(Math.min(xa, xb), ya, Math.abs(xb - xa), yb - ya, "hautBas", 0.62); // plus serrées : le bord de l'étiquette
        }
      }
      // Le numéro : une plaque arrondie sur chaque portière, et en grand à l'arrière (dans les trois motifs).
      const plaque = (r: readonly number[], u: number, v: number, hu: number, hv: number) => {
        const [cx, cy] = px(r, u, v);
        const w = hu * (r[2]! - r[0]!) * W;
        const h = hv * (r[3]! - r[1]!) * H;
        remplir(css(L.plaque));
        x.beginPath();
        x.roundRect(cx - w / 2, cy - h / 2, w, h, h * 0.22);
        x.fill();
        if (masque) return; // la plaque entière est déjà dans le masque
        remplir(css(L.chiffres));
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.font = `italic 800 ${Math.round(h * 0.86)}px ${POLICE_NUMERO}`;
        x.fillText(num, cx, cy + h * 0.04, w * 0.9);
      };
      const largeurPlaque = (h: number) => Math.max(h * 0.9, h * (0.35 + 0.42 * num.length));
      for (const cote of ["gauche", "droit"] as const) {
        const r = REGIONS[cote];
        const u = cote === "gauche" ? (z1 - c.portiere.z) / longueur : (c.portiere.z - z0) / longueur;
        plaque(r, u, c.portiere.y / c.hauteur, largeurPlaque(c.portiere.h) / longueur, (c.portiere.h * 1.25) / c.hauteur);
      }
      plaque(REGIONS.arriere, 0.5, c.arriere.y / c.hauteur, largeurPlaque(c.arriere.h) / (2 * c.demiLargeur), (c.arriere.h * 1.2) / c.hauteur);
    }
    x.globalCompositeOperation = "source-over";
    texture.needsUpdate = true;
  };
  peindre(caisse, numero, motif);
  return { texture, peindre, dispose: () => texture.dispose() };
}
