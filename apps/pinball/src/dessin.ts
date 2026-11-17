import { AXE, DROITE, GAUCHE, HAUTEUR, JET_GEYSER, LARGEUR, MISSION_DU_THEME, MODULES_DE_MISSION, MULT_MAX, NORME, RAYON, REGLAGES, TICKS_PAR_SECONDE, UNITE, pointeDuBatteur, type Mission, type Partie, type Porte, type Poser, type Rail, type Table, type ThemePinball } from "@cdj/pinball-sim";
import { modulesAPlat } from "./modeles/plat";
import { echantillons, hauteurRail, type PointRail } from "./rails";
import { COULEURS_INTENTION, angleVise, boutLibre, couleurAiguillage, geoAiguillage, geoPorte, ouverturePorte, rapprocher, sortiePoteau } from "./deblocages";
import { creerIndications } from "./indications";

// Le rendu À PLAT de « Pinball » (lot PB1) : le dessin « Canvas+ » de la maquette (`docs/pinball/maquettes/pinball-maquette-jouable.html`) — rails avec leur ombre, modules communs (lot PBV4 : une icône par thème, `modeles/`), lance-pierres à
// caoutchouc, batteurs, flèches de tir devant chaque module, nom de chaque module, lampes des couloirs et des multiplicateurs. **Écrit pour être gardé comme rendu de secours** (qualité minimale, petits écrans) quand le
// rendu three.js du lot PB2 arrivera : il ne connaît que la partie (`Partie`, en lecture) et un canvas ; aucune entrée, aucun DOM autre que le canvas. Les couleurs sont celles de la maquette (palettes des quatre thèmes) :
// elles passeront aux jetons avec le rendu définitif.
// **Lot PBG1 : les rails** — les rampes et l'orbite à plat (un ruban à l'ombre portée, par thème, cuit une fois dans une image à la taille de l'écran : `dessinerRails`), leurs flèches de tir et leurs bouches en entonnoir (`flechesDesRails`, peintes
// dans le sol, donc aussi en three.js), la bille posée sur un rail (agrandie, son ombre décalée sur le plateau), le mini-batteur, et les noms des rails dans `placerEtiquettes` (les rails et leurs bouches sont des obstacles pour les plaques).
// **Lot PB2 : ce fichier est aussi la source du SOL du rendu three.js** (`dessinerSol` : bandes, lampes, étiquettes, flèches, dans les palettes des quatre thèmes, posé en texture par `corps.ts`) et des pastilles de nom
// (`pastille`) : une seule description du sol pour les deux rendus. Il ne charge ni three.js ni rien d'autre que la simulation (types et constantes).
export const ENCRE = "#2A1E16";
export const PAPIER = "#FFF6E0";
export const MOUTARDE = "#E8B23A";

export interface Palette {
  fond: string;
  fond2: string;
  bumper: string;
  accent: string;
  cible: string;
  sling: string;
  sombre: boolean;
  /** Lot PBV1 : la couleur des bandes lumineuses le long des rails latéraux et celle des petites lampes du décor (arc, lance-pierres). */
  bande: string;
  lampe: string;
}
export const PALETTES: Readonly<Record<ThemePinball, Palette>> = {
  foire: { fond: "#F4D9A0", fond2: "#EFCB86", bumper: "#C2401F", accent: "#3E7CC4", cible: "#E8B23A", sling: "#3E7CC4", sombre: false, bande: "#FFB23E", lampe: "#FFD98A" },
  ocean: { fond: "#BFE3E6", fond2: "#AED8DC", bumper: "#F08A6C", accent: "#2E6E8E", cible: "#F2C94C", sling: "#2E6E8E", sombre: false, bande: "#3FE6F2", lampe: "#C8FBFF" },
  espace: { fond: "#26294A", fond2: "#2E3258", bumper: "#E46FA0", accent: "#5FD3E8", cible: "#E8B23A", sling: "#5FD3E8", sombre: true, bande: "#E46FA0", lampe: "#9FEFFF" },
  // lot PBV2 : le sol du Volcan est une roche sombre craquelée : l'accent (jupe des bumpers, plaque du moulin, anneau des trous) et la cible passent à des tons clairs pour rester lisibles dessus
  volcan: { fond: "#3A2C27", fond2: "#2E221E", bumper: "#C2401F", accent: "#D9A066", cible: "#B8B4C0", sling: "#E8B23A", sombre: false, bande: "#FF7A2E", lampe: "#FFC46B" },
};
/** Le rayon d'un module (px) : la distance où se pose sa flèche et son nom. */
export const RAYON_MODULE: Readonly<Record<string, number>> = { bumpers: 50, mini: 30, cibles: 26, spinner: 40, trou: 22, manege: 60, tourbillon: 64, trouNoir: 26, portailA: 28, portailB: 28, asteroide: 34, geyser: 30, coulee: 56, porte: 16 };
export const TAU = 6.283185307179586;

// --- Lot PB3 : ce qui est commun aux deux rendus pour les éléments des thèmes et la mission (la maquette : `fleche`, `couleurModule`, les lampes de la mission)
/** Un module compte-t-il pour la mission du thème ? (sa flèche clignote tant que la mission n'est pas réussie) */
export const comptePourLaMission = (theme: ThemePinball, type: string): boolean => (MODULES_DE_MISSION[MISSION_DU_THEME[theme]] as readonly string[]).includes(type);
/** Les flèches clignotent deux fois par seconde (150 pas allumée, 150 pas éteinte), en fonction du seul pas. */
export const clignote = (tick: number): boolean => Math.floor(tick / 150) % 2 === 0;
/** La flèche de tir d'un module : où elle se pose (devant lui, sur la ligne qui vient des batteurs) et son angle. */
export function flecheDe(m: { type: string; x: number; y: number }): { x: number; y: number; a: number } {
  const mx = px(m.x);
  const my = px(m.y);
  const dx = mx - AXE;
  const dy = my - 600;
  const d = Math.hypot(dx, dy);
  const r = RAYON_MODULE[m.type] ?? 30;
  return { x: mx - (dx / d) * (r + 18), y: my - (dy / d) * (r + 18), a: Math.atan2(dy, dx) };
}
/** La couleur d'un module sur la table : les bumpers, la cible, les éléments de la mission (moutarde), le reste à l'accent du thème. */
export function couleurModule(P: Palette, theme: ThemePinball, type: string): string {
  if (type === "bumpers" || type === "mini" || type === "asteroide") return P.bumper;
  if (type === "cibles") return P.cible;
  if (comptePourLaMission(theme, type) || type === "trouNoir" || type === "coulee") return MOUTARDE;
  return P.accent;
}
/** L'élément qui porte les lampes de la mission (le premier du thème : le portail A pour l'espace) et leur place : un arc au-dessus de lui, une lampe par pas du but. */
export function lampesMission(table: Table, theme: ThemePinball, but: number): { x: number; y: number }[] {
  const mission: Mission = MISSION_DU_THEME[theme];
  const ancre = table.poses.find((m) => (MODULES_DE_MISSION[mission] as readonly string[]).includes(m.type) && m.type !== "portailB");
  if (!ancre) return [];
  const rr = (RAYON_MODULE[ancre.type] ?? 30) + 9;
  const l: { x: number; y: number }[] = [];
  for (let i = 0; i < but; i++) {
    const a = -Math.PI / 2 + (i - (but - 1) / 2) * 0.32;
    l.push({ x: px(ancre.x) + Math.cos(a) * rr, y: px(ancre.y) + Math.sin(a) * rr });
  }
  return l;
}
export const COULEURS_ELEMENTS = { manegeA: "#C2401F", manegeHub: "#3E7CC4", tourbillon: "#7FC6D2", tourbillonBras: "#2E6E8E", tourbillonCentre: "#16384a", noirCentre: "#0b0918", noirAnneau: "#E8B23A", noirOnde: "167,155,255", portailA: "#5FD3E8", portailB: "#E46FA0", portailFond: "#120f24", geyser: "#8A5632", lave: "#F2894B", chevron: "#FFE08A" } as const;

// --- Lot PBV1 : la recette visuelle commune (lumière, meuble, matériaux, bandes et lampes), dont ce qui se dessine aussi à plat
/** Les bandes lumineuses le long des rails latéraux (px de la table) : `[x du rail, y du haut, y du bas]` ; la couleur est `Palette.bande`. */
export const BANDES: readonly (readonly [number, number, number])[] = [
  [20, 222, 552],
  [348, 272, 552],
];
/** L'arc du haut de la table (le même que la simulation et que `masque`). */
export const ARC_CENTRE = { x: 196.25, y: 205, r: 176.25 } as const;
/** Les petites lampes du décor, allumées : sur les deux flancs de l'arc (au ras du rail, hors des couloirs du haut) et sur le dessus des lance-pierres. `pierre` : posée sur un lance-pierre (en three.js, à sa hauteur). */
export function lampesDecor(): { x: number; y: number; pierre: boolean }[] {
  const l: { x: number; y: number; pierre: boolean }[] = [];
  // lot PBG1 : à 8 px du rail de l'arc (12 avant) : l'orbite, qui le longe à 150–152 px du centre, ne les recouvre pas
  const r = ARC_CENTRE.r - 8;
  for (let k = 0; k < 5; k++) {
    for (const a of [Math.PI + 0.16 + k * 0.2, 2 * Math.PI - 0.16 - k * 0.2]) l.push({ x: ARC_CENTRE.x + Math.cos(a) * r, y: ARC_CENTRE.y + Math.sin(a) * r, pierre: false });
  }
  for (const [x, y] of [[47, 500], [49, 520], [53, 540]] as const) for (const xx of [x, 2 * AXE - x]) l.push({ x: xx, y, pierre: true });
  return l;
}
/** La lueur d'une lampe du décor (de 0,35 à 1) : une vague qui court le long de l'arc, en fonction du seul pas. */
export const lueurLampe = (i: number, tick: number): number => 0.35 + 0.65 * Math.max(0, Math.cos((tick / TICKS_PAR_SECONDE) * 3 - i * 0.7)) ** 2;
/** Le style des étiquettes des modules : des pastilles d'encre (Fête foraine), des plaques de bois (Océan, lot PBV1), de métal rivetées (Espace) et de pierre gravée (Volcan, lot PBV2). */
export type StyleEtiquette = "encre" | "bois" | "metal" | "pierre";
const STYLES: Readonly<Record<ThemePinball, StyleEtiquette>> = { foire: "encre", ocean: "bois", espace: "metal", volcan: "pierre" };
export const styleEtiquette = (theme: ThemePinball): StyleEtiquette => STYLES[theme];

/** Un petit générateur entier (jamais `Math.random` : le sol est le même à chaque chargement), de 0 à 1. */
function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/** Des planches de bois veinées, dans le sens de la longueur (le parquet de la Fête foraine ; le parquet de la pièce et le meuble du rendu three.js). */
export function planches(c: CanvasRenderingContext2D, x0: number, y0: number, l: number, h: number, largeur: number, tons: readonly string[], veine: string, joint: string, graine: number, force = 1): void {
  const r = alea(graine);
  c.save();
  c.beginPath();
  c.rect(x0, y0, l, h);
  c.clip();
  for (let x = x0; x < x0 + l; x += largeur) {
    let y = y0 - r() * 200;
    while (y < y0 + h) {
      const long = 150 + r() * 260;
      c.globalAlpha = 1;
      c.fillStyle = tons[Math.floor(r() * tons.length)]!;
      c.fillRect(x, y, largeur, long);
      c.strokeStyle = veine;
      for (let k = 0; k < 6; k++) {
        const gx = x + 2 + r() * (largeur - 4);
        const amp = 0.4 + r() * 1.6;
        const freq = 0.015 + r() * 0.03;
        const ph = r() * 6;
        c.globalAlpha = Math.min(1, (0.12 + r() * 0.2) * force);
        c.lineWidth = 0.5 + r() * 0.9;
        c.beginPath();
        for (let yy = y; yy <= y + long; yy += 5) c.lineTo(gx + Math.sin(yy * freq + ph) * amp, yy);
        c.stroke();
      }
      if (r() < 0.22) {
        // un nœud
        const nx = x + largeur * (0.3 + r() * 0.4);
        const ny = y + long * (0.2 + r() * 0.6);
        for (let k = 3; k >= 1; k--) {
          c.globalAlpha = Math.min(1, (0.16 + 0.08 * (3 - k)) * force);
          c.lineWidth = 0.8;
          c.beginPath();
          c.ellipse(nx, ny, k * 1.6, k * 3.6, 0, 0, TAU);
          c.stroke();
        }
      }
      c.globalAlpha = Math.min(1, 0.45 * force);
      c.fillStyle = joint;
      c.fillRect(x, y + long - 0.6, largeur, 1.2);
      y += long;
    }
    c.globalAlpha = Math.min(1, 0.5 * force);
    c.fillStyle = joint;
    c.fillRect(x - 0.6, y0, 1.2, h);
  }
  c.restore();
}

/** Une étoile à cinq branches. */
function etoile(c: CanvasRenderingContext2D, x: number, y: number, r: number, couleur: string): void {
  c.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = couleur;
  c.fill();
}

/** La Fête foraine : des planches miel ambré à veinage marqué et joints sombres (lot PBV3, d'après la cible), et le nom du thème PEINT dans le bois en arc, usé (le grain reparaît), entre deux filets, avec ses étoiles. */
function solFoire(c: CanvasRenderingContext2D, titre: string, police: string): void {
  planches(c, 0, 0, LARGEUR, HAUTEUR, 25, ["#E6B068", "#E2AC62", "#E9B66E", "#DFA75E", "#E4AF66", "#E0A960"], "#8E531E", "#6A3812", 7, 1.7);
  // le nom : des lettres rouges peintes à même le bois, qui suivent un arc, deux filets en arc, une étoile dessous ; la peinture est usée (des stries du bois la traversent)
  const texte = titre.toLocaleUpperCase();
  const R = 170;
  const cx = AXE;
  const cy = 520 + R;
  c.save();
  c.font = `700 22px ${police}`;
  const largeurs = [...texte].map((ch) => c.measureText(ch).width + 1);
  const total = largeurs.reduce((a, b) => a + b, 0);
  const demi = (total / 2 + 10) / R;
  c.globalAlpha = 0.78;
  c.strokeStyle = "#B8361A";
  c.lineCap = "round";
  for (const [k, ep] of [[-17, 2.2], [15, 2.2], [19, 1]] as const) {
    c.lineWidth = ep;
    c.beginPath();
    c.arc(cx, cy, R + k, -Math.PI / 2 - demi, -Math.PI / 2 + demi);
    c.stroke();
  }
  c.fillStyle = "#B8361A";
  c.textAlign = "center";
  c.textBaseline = "middle";
  let a = -Math.PI / 2 - total / 2 / R;
  [...texte].forEach((ch, i) => {
    const w = largeurs[i]!;
    const m = a + w / 2 / R;
    c.save();
    c.translate(cx + Math.cos(m) * R, cy + Math.sin(m) * R);
    c.rotate(m + Math.PI / 2);
    c.fillText(ch, 0, 1);
    c.restore();
    a += w / R;
  });
  etoile(c, cx, 551, 7, "#B8361A");
  for (const s of [-1, 1]) {
    const aa = -Math.PI / 2 + s * (demi + 0.03);
    etoile(c, cx + Math.cos(aa) * (R - 1), cy + Math.sin(aa) * (R - 1), 4, "#B8361A");
  }
  // usée : des stries dans le sens des planches, de la couleur du bois, et des grains
  const r = alea(91);
  c.globalAlpha = 0.5;
  c.fillStyle = "#E4AC5E";
  for (let k = 0; k < 60; k++) c.fillRect(cx - total / 2 - 10 + r() * (total + 20), 490 + r() * 70, 0.5 + r() * 0.9, 3 + r() * 14);
  for (let k = 0; k < 160; k++) c.fillRect(cx - total / 2 - 10 + r() * (total + 20), 490 + r() * 70, 0.6 + r() * 1.4, 0.5 + r() * 0.8);
  c.restore();
}

/** L'Océan : une eau turquoise profond (lot PBV3, d'après la cible) avec les reflets du fond (des caustiques bien visibles), un dégradé vers le sable chaud en bas, des silhouettes de poissons à peine visibles là où la bille passe, le nom en blanc avec une vague. Le décor riche est dans les marges (`margesOcean`). */
function solOcean(c: CanvasRenderingContext2D, titre: string, police: string): void {
  const g = c.createLinearGradient(0, 0, 0, HAUTEUR);
  g.addColorStop(0, "#08688E");
  g.addColorStop(0.3, "#0A85A6");
  g.addColorStop(0.62, "#159FB8");
  g.addColorStop(0.76, "#2FB4B8");
  g.addColorStop(0.83, "#B8BC86");
  g.addColorStop(0.9, "#EBC27E");
  g.addColorStop(1, "#F0C786");
  c.fillStyle = g;
  c.fillRect(0, 0, LARGEUR, HAUTEUR);
  const r = alea(23);
  // le fond : des taches plus profondes, et une clarté au milieu (le soleil dans l'eau)
  for (let k = 0; k < 11; k++) {
    const x = r() * LARGEUR;
    const y = 100 + r() * 460;
    const rg = c.createRadialGradient(x, y, 0, x, y, 40 + r() * 60);
    rg.addColorStop(0, "rgba(6,60,84,.3)");
    rg.addColorStop(1, "rgba(6,60,84,0)");
    c.fillStyle = rg;
    c.fillRect(x - 110, y - 110, 220, 220);
  }
  const clair = c.createRadialGradient(AXE, 330, 10, AXE, 330, 190);
  clair.addColorStop(0, "rgba(120,230,230,.28)");
  clair.addColorStop(1, "rgba(120,230,230,0)");
  c.fillStyle = clair;
  c.fillRect(0, 140, LARGEUR, 380);
  // les caustiques : des boucles claires sur une grille irrégulière, qui s'éteignent vers le sable
  c.strokeStyle = "#C8FCFF";
  c.lineJoin = "round";
  for (let gy = 0; gy < 650; gy += 24) {
    for (let gx = -10; gx < LARGEUR + 20; gx += 26) {
      const x = gx + (gy % 48 ? 13 : 0) + (r() - 0.5) * 16;
      const y = gy + (r() - 0.5) * 16;
      const ext = Math.max(0, 1 - Math.max(0, y - 480) / 170);
      // lot PBL1 : les reflets s'adoucissent là où la bille passe (le décor passe après la bille et les objectifs)
      c.globalAlpha = (0.12 + r() * 0.22) * ext * (0.4 + 0.6 * richesseDuDecor(x, y));
      c.lineWidth = 0.8 + r() * 1.6;
      c.beginPath();
      const n = 9;
      const rr0 = 7 + r() * 7;
      const p0 = r() * TAU;
      const pts: [number, number][] = [];
      for (let k = 0; k < n; k++) {
        const a = p0 + (k / n) * TAU;
        const rr = rr0 * (0.7 + r() * 0.6);
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]);
      }
      // une boucle lissée (des courbes passant par le milieu de chaque côté) : des reflets d'eau, pas des cellules
      for (let k = 0; k <= n; k++) {
        const [ax, ay] = pts[k % n]!;
        const [bx, by] = pts[(k + 1) % n]!;
        if (k === 0) c.moveTo((ax + bx) / 2, (ay + by) / 2);
        else c.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
      }
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  // le sable : des grains, des rides, des cailloux
  for (let k = 0; k < 520; k++) {
    const y = 610 + r() * 150;
    c.globalAlpha = 0.2 + r() * 0.3;
    c.fillStyle = r() < 0.5 ? "#A9834A" : "#FFF0CC";
    c.fillRect(r() * LARGEUR, y, 1.1, 1.1);
  }
  c.globalAlpha = 0.3;
  c.strokeStyle = "#A9834A";
  c.lineWidth = 1;
  for (let k = 0; k < 9; k++) {
    const y = 660 + k * 11 + r() * 5;
    c.beginPath();
    for (let x = 0; x <= LARGEUR; x += 8) c.lineTo(x, y + Math.sin(x * 0.05 + k) * 2.5);
    c.stroke();
  }
  c.globalAlpha = 1;
  // des silhouettes, à peine visibles là où la bille passe
  c.fillStyle = "rgba(4,46,66,.16)";
  for (const [x, y, t, s] of [[120, 300, 1, 1], [270, 238, 0.9, -1], [250, 430, 0.8, -1], [120, 448, 0.75, 1]] as const) poisson(c, x, y, t, s);
  // le nom, en blanc, avec deux vagues
  c.save();
  c.translate(AXE, 512);
  c.font = `700 30px ${police}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "rgba(225,252,255,.62)";
  c.fillText(titre.toLocaleUpperCase(), 0, 0);
  c.strokeStyle = "rgba(225,252,255,.55)";
  c.lineWidth = 2.6;
  c.lineCap = "round";
  for (const [dy, l] of [[21, 70], [28, 50]] as const) {
    c.beginPath();
    for (let x = -l; x <= l; x += 3) c.lineTo(x, dy + Math.sin(x * 0.13) * 3);
    c.stroke();
  }
  c.restore();
}

/** Un poisson (une silhouette, de la couleur courante) ; `s` : son sens. */
function poisson(c: CanvasRenderingContext2D, x: number, y: number, t: number, s: number): void {
  c.save();
  c.translate(x, y);
  c.scale(s * t, t);
  c.beginPath();
  c.ellipse(0, 0, 10, 4.5, 0, 0, TAU);
  c.moveTo(-8, 0);
  c.lineTo(-16, -5);
  c.lineTo(-15, 0);
  c.lineTo(-16, 5);
  c.closePath();
  c.fill();
  c.restore();
}

/** L'Océan, le décor des marges (lot PBV3 : bien plus garni, d'après la cible), là où la bille ne passe jamais — les coins bas sous les couloirs de retour, les bandes le long des rails, les coins du haut — : rochers en volume dessiné
 *  (ombrés, éclairés d'en haut, posés sur leur ombre), touffes d'algues, étoiles de mer, bancs de poissons, méduses qui luisent. Tout est à plat sous les rails et rien n'a l'air d'un obstacle : pas de contour d'encre, rien dans le couloir de la bille. */
function margesOcean(c: CanvasRenderingContext2D): void {
  const r = alea(57);
  const algue = (x: number, y: number, h: number, couleur: string, ep = 3.2): void => {
    c.strokeStyle = couleur;
    c.lineCap = "round";
    c.lineWidth = ep;
    c.beginPath();
    c.moveTo(x, y);
    const ph = r() * 6;
    for (let k = 1; k <= 9; k++) c.lineTo(x + Math.sin(ph + k * 0.8) * 3.5 * (k / 9 + 0.4), y - (h * k) / 9);
    c.stroke();
  };
  const touffe = (x: number, y: number, h: number): void => {
    for (let k = 0; k < 4; k++) algue(x + (k - 1.5) * 3.5, y + r() * 3, h * (0.6 + r() * 0.5), ["#1E6E4E", "#2F8F5B", "#4FAA5E", "#2A7F63"][k]!, 2.4 + r() * 1.4);
  };
  const rocher = (x: number, y: number, rr: number): void => {
    // l'ombre portée, le bloc ombré (éclairé d'en haut à gauche), un liseré clair, une arête
    c.save();
    c.fillStyle = "rgba(10,30,30,.35)";
    c.beginPath();
    c.ellipse(x + rr * 0.25, y + rr * 0.55, rr * 1.15, rr * 0.45, 0, 0, TAU);
    c.fill();
    c.beginPath();
    const pts: [number, number][] = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const d = rr * (0.78 + r() * 0.3);
      pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.72]);
    }
    pts.forEach(([px0, py0], i) => (i ? c.lineTo(px0, py0) : c.moveTo(px0, py0)));
    c.closePath();
    const g = c.createLinearGradient(x - rr, y - rr, x + rr * 0.6, y + rr);
    g.addColorStop(0, "#A7A79C");
    g.addColorStop(0.45, "#77786F");
    g.addColorStop(1, "#3E4442");
    c.fillStyle = g;
    c.fill();
    c.clip();
    c.fillStyle = "rgba(255,240,210,.28)";
    c.beginPath();
    c.ellipse(x - rr * 0.3, y - rr * 0.35, rr * 0.55, rr * 0.25, -0.35, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(30,30,28,.35)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - rr * 0.1, y - rr * 0.6);
    c.lineTo(x + rr * 0.15, y);
    c.lineTo(x + rr * 0.05, y + rr * 0.6);
    c.stroke();
    c.restore();
  };
  const etoileDeMer = (x: number, y: number, rr: number, a: number): void => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    etoile(c, 1, 1.5, rr, "rgba(80,30,10,.35)");
    etoile(c, 0, 0, rr, "#E8673A");
    etoile(c, -rr * 0.08, -rr * 0.1, rr * 0.55, "#F59A62");
    c.fillStyle = "#FFE2C2";
    for (let k = 0; k < 5; k++) {
      const b = -Math.PI / 2 + (k * TAU) / 5;
      c.fillRect(Math.cos(b) * rr * 0.5 - 0.5, Math.sin(b) * rr * 0.5 - 0.5, 1, 1);
    }
    c.restore();
  };
  const banc = (x: number, y: number, n: number, s: number, couleur: string): void => {
    c.fillStyle = couleur;
    for (let k = 0; k < n; k++) poisson(c, x + (r() - 0.5) * 26, y + (r() - 0.5) * 18, 0.45 + r() * 0.2, s);
  };
  const meduse = (x: number, y: number, t: number, rgb: string): void => {
    c.save();
    c.translate(x, y);
    c.scale(t, t);
    const lueur = c.createRadialGradient(0, 2, 0, 0, 2, 20);
    lueur.addColorStop(0, `rgba(${rgb},.35)`);
    lueur.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = lueur;
    c.fillRect(-20, -18, 40, 40);
    c.fillStyle = `rgba(${rgb},.55)`;
    c.beginPath();
    c.arc(0, 0, 8, Math.PI, 0);
    c.quadraticCurveTo(0, 3, -8, 0);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.45)";
    c.beginPath();
    c.ellipse(-2.5, -4, 3, 1.6, -0.4, 0, TAU);
    c.fill();
    c.strokeStyle = `rgba(${rgb},.6)`;
    c.lineWidth = 1.2;
    for (const dx of [-5, -1.5, 2, 5.5]) {
      c.beginPath();
      c.moveTo(dx, 1);
      c.quadraticCurveTo(dx + 3, 8, dx, 16);
      c.stroke();
    }
    c.restore();
  };
  // les coins bas, sous les couloirs de retour : du sable garni (rochers, touffes, étoiles de mer, coquillages)
  for (const s of [1, -1]) {
    const x = (v: number): number => (s > 0 ? v : 2 * AXE - v);
    touffe(x(28), 700, 62);
    touffe(x(92), 738, 36);
    touffe(x(s > 0 ? 60 : 52), 666, 32);
    rocher(x(40), 722, 24);
    rocher(x(80), 748, 16);
    rocher(x(s > 0 ? 24 : 32), 674, 14);
    rocher(x(104), 756, 9);
    c.fillStyle = "#F4E6CF";
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      c.ellipse(x(40 + r() * 70), 690 + r() * 62, 2.2, 1.6, r() * 3, 0, TAU);
      c.fill();
    }
  }
  etoileDeMer(62, 692, 10, 0.4);
  etoileDeMer(2 * AXE - 86, 716, 13, 1.1);
  etoileDeMer(108, 742, 6.5, 0.2);
  etoileDeMer(2 * AXE - 44, 752, 7, 2.2);
  // le long des rails latéraux : des touffes, des rochers à demi cachés sous le rail, des bancs de poissons, des méduses qui luisent
  for (const y of [290, 360, 425, 500]) touffe(r() < 0.5 ? 27 : 31, y + 28, 30 + r() * 18);
  for (const y of [330, 470]) touffe(340, y, 26 + r() * 12);
  for (const [x, y, rr] of [[27, 262, 12], [29, 398, 13], [26, 458, 10], [341, 300, 11], [340, 420, 13], [340, 528, 11]] as const) rocher(x, y, rr);
  etoileDeMer(32, 350, 6.5, 0.6);
  etoileDeMer(336, 384, 6.5, 1.6);
  banc(50, 250, 7, 1, "rgba(6,48,70,.5)");
  banc(316, 470, 7, -1, "rgba(6,48,70,.5)");
  banc(48, 540, 5, 1, "rgba(6,48,70,.45)");
  meduse(48, 404, 1.25, "200,160,255");
  meduse(318, 336, 1.3, "150,235,255");
  // les coins du haut, sous l'arc
  rocher(70, 150, 15);
  rocher(306, 146, 14);
  rocher(90, 170, 9);
  touffe(52, 188, 26);
  touffe(324, 184, 24);
  etoileDeMer(98, 130, 6.5, 0.9);
}


/** Où le décor peut être riche, de 0 (là où la bille passe) à 1 (les marges : la bande le long des rails latéraux, les coins bas sous les couloirs de retour, les coins du haut). Lot PBV2 : l'Espace et le Volcan s'en servent pour mettre
 *  leurs étoiles, leurs nébuleuses, leurs fissures de lave et leurs braises dans les marges, et rester discrets au milieu. */
export function richesseDuDecor(x: number, y: number): number {
  const cote = Math.max(0, (66 - x) / 66, (x - (LARGEUR - 66)) / 66);
  const bas = y > 640 ? Math.min(1, (y - 640) / 50) * Math.min(1, Math.max(0, Math.abs(x - AXE) - 70) / 50) : 0;
  const haut = y < 170 ? Math.min(1, Math.max(0, Math.abs(x - AXE) - 100) / 60) * Math.min(1, (170 - y) / 60) : 0;
  return Math.min(1, Math.max(cote, bas, haut));
}

/** Pose un espacement entre les lettres quand le navigateur le sait (les lettres de néon et la pierre gravée). */
function espacement(c: CanvasRenderingContext2D, pixels: number): void {
  (c as unknown as { letterSpacing: string }).letterSpacing = `${pixels}px`;
}

/** Une planète : un disque ombré (la lumière vient d'en haut à gauche), des bandes, et si on veut un anneau dont la moitié du fond passe derrière. */
function planete(c: CanvasRenderingContext2D, x: number, y: number, rr: number, clair: string, sombre: string, anneau?: { rx: number; ry: number; a: number; couleur: string; ep: number }, bandes = 0): void {
  c.save();
  c.translate(x, y);
  const dessinAnneau = (de: number, a: number): void => {
    if (!anneau) return;
    c.save();
    c.rotate(anneau.a);
    c.strokeStyle = anneau.couleur;
    c.lineWidth = anneau.ep;
    c.beginPath();
    c.ellipse(0, 0, anneau.rx, anneau.ry, 0, de, a);
    c.stroke();
    c.lineWidth = anneau.ep * 0.4;
    c.beginPath();
    c.ellipse(0, 0, anneau.rx * 0.82, anneau.ry * 0.82, 0, de, a);
    c.stroke();
    c.restore();
  };
  dessinAnneau(Math.PI, TAU);
  const g = c.createRadialGradient(-rr * 0.4, -rr * 0.45, rr * 0.1, 0, 0, rr * 1.05);
  g.addColorStop(0, clair);
  g.addColorStop(1, sombre);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, rr, 0, TAU);
  c.fill();
  if (bandes) {
    c.save();
    c.clip();
    c.globalAlpha *= 0.2;
    c.fillStyle = sombre;
    for (let k = 0; k < bandes; k++) c.fillRect(-rr, -rr * 0.6 + k * ((rr * 1.5) / bandes), rr * 2, rr * 0.16);
    c.restore();
  }
  dessinAnneau(0, Math.PI);
  c.restore();
}

/** L'Espace (lot PBV2) : un ciel profond, des étoiles de plusieurs tailles (denses et brillantes dans les marges, de petits points pâles au milieu), des nébuleuses dans les marges, des planètes lointaines et leurs anneaux (riches dans
 *  les coins bas, en silhouettes à 11 % ailleurs : rien n'y a l'air d'un bumper), le nom du thème en lettres de néon. */
function solEspace(c: CanvasRenderingContext2D, titre: string, police: string): void {
  const r = alea(404);
  const g = c.createLinearGradient(0, 0, 0, HAUTEUR);
  g.addColorStop(0, "#080824");
  g.addColorStop(0.5, "#141540");
  g.addColorStop(0.85, "#24194A");
  g.addColorStop(1, "#140E32");
  c.fillStyle = g;
  c.fillRect(0, 0, LARGEUR, HAUTEUR);
  const nebuleuse = (x: number, y: number, rx: number, ry: number, rgb: string, a: number): void => {
    c.save();
    c.translate(x, y);
    c.scale(1, ry / rx);
    const rg = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    rg.addColorStop(0, `rgba(${rgb},${Math.min(1, a * 1.3)})`);
    rg.addColorStop(0.55, `rgba(${rgb},${a * 0.58})`);
    rg.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = rg;
    c.fillRect(-rx, -rx, rx * 2, rx * 2);
    c.restore();
  };
  // dans les marges : de la couleur ; au milieu : un voile à peine visible
  nebuleuse(14, 330, 95, 170, "132,72,214", 0.5);
  nebuleuse(10, 560, 80, 110, "228,111,160", 0.34);
  nebuleuse(362, 250, 95, 160, "60,176,230", 0.42);
  nebuleuse(360, 500, 80, 130, "150,76,210", 0.36);
  nebuleuse(70, 130, 90, 70, "228,111,160", 0.26);
  nebuleuse(318, 120, 90, 70, "90,200,240", 0.24);
  nebuleuse(48, 722, 120, 70, "228,111,160", 0.42);
  nebuleuse(328, 724, 120, 70, "95,211,232", 0.38);
  nebuleuse(AXE, 330, 140, 120, "86,76,190", 0.07);
  nebuleuse(AXE, 700, 150, 60, "240,120,90", 0.16);
  // des planètes lointaines : riches dans les coins bas (sous les couloirs de retour), en silhouettes à peine visibles là où la bille passe
  planete(c, 62, 714, 19, "#9A8AF0", "#2A2870", { rx: 38, ry: 9, a: -0.35, couleur: "rgba(205,210,255,.6)", ep: 3.2 }, 3);
  planete(c, 320, 724, 13, "#EE95BC", "#5E2250", undefined, 3);
  planete(c, 300, 690, 4.5, "#BFD8FF", "#3A4A8A");
  c.globalAlpha = 0.11;
  planete(c, 300, 128, 24, "#9FA8FF", "#6068D8", { rx: 44, ry: 10, a: 0.3, couleur: "rgba(170,180,255,.9)", ep: 2.6 });
  planete(c, 66, 262, 9, "#9FA8FF", "#6068D8");
  c.globalAlpha = 1;
  // les étoiles : trois teintes, quatre tailles
  const teintes = ["255,243,214", "191,216,255", "255,199,224"];
  for (let k = 0; k < 240; k++) {
    const x = r() * LARGEUR;
    const y = r() * HAUTEUR;
    const v = r();
    const teinte = teintes[Math.floor(r() * 3)]!;
    const a0 = r();
    const riche = richesseDuDecor(x, y) > 0.35;
    const taille = riche ? (v < 0.6 ? 0.9 : v < 0.88 ? 1.5 : 2.4) : v < 0.8 ? 0.8 : 1.2;
    const alpha = riche ? 0.35 + a0 * 0.6 : 0.12 + a0 * 0.2;
    if (taille > 2) {
      const rg = c.createRadialGradient(x, y, 0, x, y, 7);
      rg.addColorStop(0, `rgba(${teinte},.35)`);
      rg.addColorStop(1, `rgba(${teinte},0)`);
      c.fillStyle = rg;
      c.fillRect(x - 7, y - 7, 14, 14);
      c.strokeStyle = `rgba(${teinte},.55)`;
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(x - 6, y);
      c.lineTo(x + 6, y);
      c.moveTo(x, y - 6);
      c.lineTo(x, y + 6);
      c.stroke();
    }
    c.fillStyle = `rgba(${teinte},${alpha})`;
    c.beginPath();
    c.arc(x, y, taille / 2 + 0.2, 0, TAU);
    c.fill();
  }
  // le nom, en lettres de néon : une lueur cyan, un trait clair, un filet rose dessous
  c.save();
  c.translate(AXE, 512);
  c.font = `700 28px ${police}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  espacement(c, 5);
  const texte = titre.toLocaleUpperCase();
  c.shadowColor = "#5FD3E8";
  c.shadowBlur = 16;
  c.fillStyle = "rgba(95,211,232,.5)";
  c.fillText(texte, 0, 0);
  c.fillText(texte, 0, 0);
  c.shadowBlur = 0;
  c.lineWidth = 1.5;
  c.strokeStyle = "rgba(226,252,255,.9)";
  c.strokeText(texte, 0, 0);
  c.fillStyle = "rgba(160,235,250,.28)";
  c.fillText(texte, 0, 0);
  c.shadowColor = "#E46FA0";
  c.shadowBlur = 10;
  c.strokeStyle = "rgba(255,150,200,.85)";
  c.lineWidth = 2.4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-58, 25);
  c.lineTo(58, 25);
  c.stroke();
  c.restore();
}

/** Les cellules d'une roche craquelée : un diagramme de Voronoï de graines jitterées sur une grille de `pas` px (chaque cellule est coupée par la médiatrice de ses voisines). */
function cellules(r: () => number, pas: number): { poly: [number, number][] }[] {
  const graines: [number, number][] = [];
  for (let gy = -1; gy * pas < HAUTEUR + pas; gy++) for (let gx = -1; gx * pas < LARGEUR + pas; gx++) graines.push([gx * pas + 8 + r() * (pas - 16), gy * pas + 8 + r() * (pas - 16)]);
  return graines.map(([sx, sy]) => {
    let poly: [number, number][] = [[sx - pas * 2, sy - pas * 2], [sx + pas * 2, sy - pas * 2], [sx + pas * 2, sy + pas * 2], [sx - pas * 2, sy + pas * 2]];
    for (const [nx, ny] of graines) {
      if ((nx === sx && ny === sy) || Math.hypot(nx - sx, ny - sy) > pas * 2.9) continue;
      const a = 2 * (nx - sx);
      const b = 2 * (ny - sy);
      const k = nx * nx + ny * ny - sx * sx - sy * sy;
      const sortie: [number, number][] = [];
      poly.forEach((p, i) => {
        const q = poly[(i + 1) % poly.length]!;
        const dp = a * p[0] + b * p[1] - k;
        const dq = a * q[0] + b * q[1] - k;
        if (dp <= 0) sortie.push(p);
        if (dp <= 0 !== dq <= 0) {
          const t = dp / (dp - dq);
          sortie.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      });
      poly = sortie;
      if (poly.length < 3) break;
    }
    return { poly };
  });
}

/** Le Volcan (lot PBV2) : une roche sombre craquelée, des fissures de lave qui luisent dans les marges (et seulement là : au milieu les fissures restent sombres, le geyser et la coulée sont les éléments les plus vifs de la table), des cendres,
 *  des braises, et le nom du thème comme gravé dans la pierre. */
function solVolcan(c: CanvasRenderingContext2D, titre: string, police: string): void {
  const r = alea(131);
  const g = c.createLinearGradient(0, 0, 0, HAUTEUR);
  g.addColorStop(0, "#1E1513");
  g.addColorStop(0.35, "#36261F");
  g.addColorStop(0.75, "#30211A");
  g.addColorStop(1, "#1A1210");
  c.fillStyle = g;
  c.fillRect(0, 0, LARGEUR, HAUTEUR);
  // les dalles
  const tons = ["#3E2C24", "#30221B", "#47332A", "#2A1D18", "#3A2820"];
  const aretes = new Map<string, [number, number, number, number]>();
  for (const { poly } of cellules(r, 54)) {
    if (poly.length < 3) continue;
    c.beginPath();
    poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = tons[Math.floor(r() * tons.length)]!;
    c.globalAlpha = 0.8;
    c.fill();
    c.globalAlpha = 1;
    poly.forEach(([ax, ay], i) => {
      const [bx, by] = poly[(i + 1) % poly.length]!;
      const cle = ax < bx || (ax === bx && ay < by) ? `${ax.toFixed(1)},${ay.toFixed(1)}|${bx.toFixed(1)},${by.toFixed(1)}` : `${bx.toFixed(1)},${by.toFixed(1)}|${ax.toFixed(1)},${ay.toFixed(1)}`;
      aretes.set(cle, [ax, ay, bx, by]);
    });
  }
  // du grain : des taches sombres, des éclats clairs
  for (let k = 0; k < 520; k++) {
    c.globalAlpha = 0.07 + r() * 0.13;
    c.fillStyle = r() < 0.6 ? "#000000" : "#FFE2C4";
    c.fillRect(r() * LARGEUR, r() * HAUTEUR, 0.8 + r() * 1.8, 0.8 + r() * 1.4);
  }
  c.globalAlpha = 1;
  // les fissures : sombres partout, avec un liseré clair du côté éclairé (relief) ; de la lave qui luit dans les marges
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const [ax, ay, bx, by] of aretes.values()) {
    // lot PBL1 : les fissures sont moins marquées là où la bille passe (45 % de leur contraste au milieu, tout dans les marges)
    c.strokeStyle = `rgba(0,0,0,${0.6 * (0.45 + 0.55 * richesseDuDecor((ax + bx) / 2, (ay + by) / 2))})`;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(bx, by);
    c.stroke();
    c.strokeStyle = "rgba(255,206,160,.07)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(ax - 1, ay - 1);
    c.lineTo(bx - 1, by - 1);
    c.stroke();
  }
  for (const [ax, ay, bx, by] of aretes.values()) {
    const w = richesseDuDecor((ax + bx) / 2, (ay + by) / 2);
    if (w < 0.1) continue;
    const a = w * w;
    for (const [ep, couleur, al] of [[6, "255,90,30", 0.2], [2.8, "255,138,46", 0.55], [1, "255,214,122", 0.95]] as const) {
      c.strokeStyle = `rgba(${couleur},${al * a})`;
      c.lineWidth = ep;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
    }
  }
  // des mares de lave dans les coins et le long des rails
  const lueur = (x: number, y: number, rx: number, ry: number, a: number): void => {
    c.save();
    c.translate(x, y);
    c.scale(1, ry / rx);
    const rg = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    rg.addColorStop(0, `rgba(255,104,30,${Math.min(1, a * 1.35)})`);
    rg.addColorStop(1, "rgba(255,110,40,0)");
    c.fillStyle = rg;
    c.fillRect(-rx, -rx, rx * 2, rx * 2);
    c.restore();
  };
  lueur(44, 726, 100, 60, 0.4);
  lueur(332, 728, 100, 60, 0.4);
  lueur(4, 430, 50, 190, 0.26);
  lueur(372, 300, 50, 170, 0.26);
  lueur(60, 120, 70, 60, 0.18);
  lueur(322, 116, 70, 60, 0.18);
  // les cendres (très pâles au milieu) et les braises (dans les marges seulement)
  for (let k = 0; k < 280; k++) {
    const x = r() * LARGEUR;
    const y = r() * HAUTEUR;
    const p = richesseDuDecor(x, y);
    c.globalAlpha = p > 0.3 ? 0.1 + r() * 0.22 : 0.03 + r() * 0.07;
    c.fillStyle = "#D8CEC8";
    c.fillRect(x, y, 0.8 + r() * 1.4, 0.8 + r() * 1.2);
  }
  c.globalAlpha = 1;
  for (let k = 0; k < 70; k++) {
    const x = r() * LARGEUR;
    const y = r() * HAUTEUR;
    const p = richesseDuDecor(x, y);
    if (p < 0.5) continue;
    c.fillStyle = `rgba(255,${130 + Math.floor(r() * 80)},60,${0.5 + r() * 0.45})`;
    c.beginPath();
    c.arc(x, y, 0.8 + r() * 1.0, 0, TAU);
    c.fill();
  }
  // le nom, comme gravé dans la pierre : la lèvre éclairée sous le creux, une fissure qui le traverse
  c.save();
  c.translate(AXE, 512);
  c.font = `700 28px ${police}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  espacement(c, 4);
  const texte = titre.toLocaleUpperCase();
  c.fillStyle = "rgba(255,206,160,.2)";
  c.fillText(texte, 0.8, 1.7);
  c.fillStyle = "rgba(12,8,7,.8)";
  c.fillText(texte, 0, 0);
  c.strokeStyle = "rgba(0,0,0,.45)";
  c.lineWidth = 0.9;
  c.strokeText(texte, -0.3, -0.4);
  c.strokeStyle = "rgba(12,8,7,.55)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-50, -14);
  c.lineTo(-30, -2);
  c.lineTo(-38, 9);
  c.lineTo(-22, 18);
  c.stroke();
  c.fillStyle = "rgba(12,8,7,.6)";
  c.fillRect(-58, 25, 116, 2);
  c.fillStyle = "rgba(255,206,160,.16)";
  c.fillRect(-58, 27, 116, 1);
  c.restore();
}

/** Ce qu'il faut savoir d'une partie pour dessiner son sol : le thème (palette), la table (les modules posés, les couloirs du haut), le nom du thème peint sur la table et la police du jeu. */
export interface DonneesSol {
  theme: ThemePinball;
  table: Table;
  titre: string;
  police: string;
  /** Hors de la table (au-dessus de l'arc) : l'encre pour le rendu à plat ; le bois de la caisse pour le rendu three.js. */
  hors?: string;
  /** Lot PBV2 : ne pas cuire la lueur des bandes dans le sol (le rendu three.js la pose à part, pour que le curseur « Lueur des bandes » la règle) ; lot PBV3 : ni celle des lampes. */
  sansLueurBandes?: boolean;
  /** Lot PBV3 : la force de l'occlusion et du vignettage cuits dans le sol (1 : la recette ; les curseurs de `?debug&tune` les changent). */
  occlusion?: number;
  vignettage?: number;
}

// --- Lot PBV3 : la lumière des cibles, cuite dans le sol (les deux rendus) — l'occlusion autour de ce qui est posé sur la table, le vignettage dans la table, la lueur des lampes ; et l'étalonnage chaud du rendu de secours
/** La couleur des ombres de chaque thème (r, g, b) : ambrées sur le bois et la roche, bleu-vert dans l'eau, bleu nuit dans l'espace. */
const OMBRE: Readonly<Record<ThemePinball, string>> = { foire: "60,24,4", ocean: "8,40,56", espace: "4,2,22", volcan: "14,5,2" };
/** **L'occlusion cuite** : une ombre de contact sombre et douce autour de chaque module, bumper, poteau, rail, lance-pierre et pivot de batteur (`force` : 0 sans, 1 la recette, jusqu'à 2) ; puis le **vignettage dans la table** : les bords
 *  le long des rails, le haut de l'arc et le bas plus sombres que le centre (`vignettage`, de même). Ne dépend que de la table : se cuit une fois avec le sol. */
export function ombresDeContact(c: CanvasRenderingContext2D, t: Table, theme: ThemePinball, force: number, vignettage: number): void {
  const o = OMBRE[theme];
  c.save();
  const halo = (x: number, y: number, r0: number, r1: number, a: number): void => {
    if (a <= 0) return;
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    g.addColorStop(0, `rgba(${o},${Math.min(1, a)})`);
    g.addColorStop(1, `rgba(${o},0)`);
    c.fillStyle = g;
    c.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
  };
  if (force > 0) {
    // les murs, les lance-pierres et les cibles : trois traits doux superposés
    c.lineCap = "round";
    c.lineJoin = "round";
    for (const [ep, a] of [[16, 0.07], [9, 0.1], [4, 0.16]] as const) {
      c.strokeStyle = `rgba(${o},${Math.min(1, a * force)})`;
      c.lineWidth = ep;
      c.beginPath();
      for (const m of t.murs) {
        c.moveTo(px(m.ax), px(m.ay));
        c.lineTo(px(m.bx), px(m.by));
      }
      c.stroke();
    }
    for (const m of t.poses) {
      const r = RAYON_MODULE[m.type] ?? 30;
      halo(px(m.x), px(m.y), r * 0.45, r * 1.15, 0.3 * force);
    }
    for (const b of t.bumpers) halo(px(b.x), px(b.y), px(b.r) * 0.9, px(b.r) * 1.7 + 4, 0.42 * force);
    for (const p of t.poteaux) halo(px(p.x), px(p.y), px(p.r), px(p.r) + 9, 0.45 * force);
    for (const x of [112, 2 * AXE - 112]) halo(x, 640, 8, 26, 0.35 * force);
    // lot PBG1 : le mini-batteur, et l'ombre de contact de chaque rail (discrète : les rails en volume ou à plat ont la leur)
    if (t.mini) halo(px(t.mini.cote === 0 ? t.mini.x : 2 * AXE * UNITE - t.mini.x), px(t.mini.y), 6, 22, 0.35 * force);
    for (const rail of t.rails) {
      const pts = echantillons(rail, 8);
      for (const [ep, a] of [[largeurDuRail(rail) + 12, 0.02], [largeurDuRail(rail) + 4, 0.03]] as const) {
        c.strokeStyle = `rgba(${o},${Math.min(1, a * force)})`;
        c.lineWidth = ep;
        c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.stroke();
      }
    }
  }
  if (vignettage > 0) {
    const v = (a: number): string => `rgba(${o},${Math.min(1, a * vignettage)})`;
    const rg = c.createRadialGradient(AXE, 440, 130, AXE, 470, 470);
    rg.addColorStop(0, v(0));
    rg.addColorStop(1, v(0.72));
    c.fillStyle = rg;
    c.fillRect(0, 0, LARGEUR, HAUTEUR);
    const lin = (x0: number, y0: number, x1: number, y1: number, a: number): void => {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, v(a));
      g.addColorStop(1, v(0));
      c.fillStyle = g;
      c.fillRect(0, 0, LARGEUR, HAUTEUR);
    };
    lin(0, 20, 0, 230, 0.55);
    lin(20, 0, 80, 0, 0.32);
    lin(LARGEUR - 27, 0, LARGEUR - 87, 0, 0.32);
    lin(0, HAUTEUR, 0, HAUTEUR - 80, theme === "ocean" ? 0.18 : 0.32);
  }
  c.restore();
}
/** La lueur que chaque petite lampe du décor pose sur le sol autour d'elle (cuite dans le sol du rendu de secours ; le rendu three.js la pose à part, réglée par le curseur « Lueur des bandes »). */
export function lueursLampes(c: CanvasRenderingContext2D, couleur: string, force = 1): void {
  c.save();
  for (const l of lampesDecor()) {
    const r = l.pierre ? 15 : 20;
    const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
    g.addColorStop(0, couleur);
    g.addColorStop(1, `${couleur}00`);
    c.globalAlpha = 0.5 * force;
    c.fillStyle = g;
    c.fillRect(l.x - r, l.y - r, r * 2, r * 2);
  }
  c.restore();
}
/** **L'étalonnage chaud**, le même que la passe de couleur de la haute qualité (`corps.ts`, `ETALONNAGE`), cuit dans une image (le sol du rendu de secours, une fois par taille d'écran : rien par image) : un peu de contraste, la saturation
 *  plus forte, les ombres un peu ambrées, les hautes lumières dorées. `chaleur` : 1 la recette ; `saturation` et `exposition` : des facteurs. */
export function etalonner(c: CanvasRenderingContext2D, largeur: number, hauteur: number, chaleur = 1, saturation = 1.25, exposition = 1): void {
  const img = c.getImageData(0, 0, largeur, hauteur);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = (d[i]! / 255) * exposition;
    let g = (d[i + 1]! / 255) * exposition;
    let b = (d[i + 2]! / 255) * exposition;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = l + (r - l) * saturation;
    g = l + (g - l) * saturation;
    b = l + (b - l) * saturation;
    // une courbe en S douce autour de 0,45
    const s = (x: number): number => x + (x - 0.45) * 0.12 * (1 - Math.abs(x - 0.45) * 1.4);
    const haut = Math.min(1, Math.max(0, (l - 0.15) / 0.75)) * chaleur;
    const bas = Math.max(0, 1 - l / 0.35) * chaleur;
    d[i] = (s(r) * (1 + 0.05 * haut) + 0.02 * bas) * 255;
    d[i + 1] = (s(g) * (1 + 0.005 * haut) + 0.008 * bas) * 255;
    d[i + 2] = (s(b) * (1 - 0.1 * haut) - 0.004 * bas) * 255;
  }
  c.putImageData(img, 0, 0);
}

/** Une flèche de tir, à `(x, y)`, tournée de `a`. Lot PBV3 : une flèche franche, comme sur les cibles — blanche, cernée d'encre, posée sur sa petite ombre. */
function fleche(c: CanvasRenderingContext2D, P: Palette, x: number, y: number, a: number, allumee?: string, k = 1): void {
  const forme = (dx: number, dy: number): void => {
    c.save();
    c.translate(x + dx, y + dy);
    c.rotate(a);
    c.scale(k, k);
    c.beginPath();
    c.moveTo(13, 0);
    c.lineTo(-7, -11);
    c.lineTo(-3, 0);
    c.lineTo(-7, 11);
    c.closePath();
    c.restore();
  };
  c.save();
  forme(1.2, 1.8);
  c.fillStyle = "rgba(0,0,0,.32)";
  c.fill();
  forme(0, 0);
  c.fillStyle = allumee ?? (P.sombre ? "rgba(255,246,224,.82)" : "#FFFCF2");
  c.fill();
  c.lineWidth = 2.6;
  c.lineJoin = "round";
  c.strokeStyle = ENCRE;
  c.stroke();
  c.restore();
}

/** Lot PBL1 : une flèche **éteinte**, discrète, peinte au sol : un peu plus petite que les flèches d'avant, translucide, sans ombre ni cerne d'encre (un filet seulement). Elle est cuite dans le sol (`dessinerSol`). */
export function flecheEteinte(c: CanvasRenderingContext2D, P: Palette, x: number, y: number, a: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(0.85, 0.85);
  c.beginPath();
  c.moveTo(13, 0);
  c.lineTo(-7, -11);
  c.lineTo(-3, 0);
  c.lineTo(-7, 11);
  c.closePath();
  c.fillStyle = P.sombre ? "rgba(255,246,224,.2)" : "rgba(255,252,242,.36)";
  c.fill();
  c.lineWidth = 1.3;
  c.lineJoin = "round";
  c.strokeStyle = P.sombre ? "rgba(255,246,224,.32)" : "rgba(42,30,22,.32)";
  c.stroke();
  c.restore();
}
/** Lot PBL1 : une flèche **vive** : la couleur de son intention (`COULEURS_INTENTION`), plus grande, cernée d'encre, dans un halo doux de la même couleur. */
export function flecheVive(c: CanvasRenderingContext2D, P: Palette, x: number, y: number, a: number, couleur: string): void {
  c.save();
  c.globalAlpha = 0.3;
  c.beginPath();
  c.arc(x, y, 19, 0, TAU);
  c.fillStyle = couleur;
  c.fill();
  c.globalAlpha = 0.5;
  c.beginPath();
  c.arc(x, y, 13, 0, TAU);
  c.fill();
  c.restore();
  fleche(c, P, x, y, a, couleur, 1.25);
}

/** Lot PBV2 : la largeur et la hauteur d'une plaque d'étiquette (px de la table, à l'échelle 1), pour la placer sans que deux étiquettes se touchent. La largeur du texte est une **estimation prudente** (jamais plus petite que la
 *  mesure du navigateur, pour la police du jeu comme pour la police de repli) : la mise en place est la même, au pixel près, dans le navigateur, dans le rendu à plat et dans le test. */
export const HAUTEUR_PLAQUE = 16;
/** Une plaque à deux lignes (un nom long coupé à une espace ou à un trait d'union) est plus haute de 10 px par ligne en plus. */
export const hauteurPlaque = (lignes: number): number => HAUTEUR_PLAQUE + (lignes - 1) * 10;
/** Lot PBV3 : le texte des plaques est plus grand, comme sur les cibles (10 px au lieu de 9, la plaque garde sa hauteur et serre le texte : des marges plus étroites) ; `pastille` le dessine à cette taille, la mise en place compte avec. */
export const AGRANDI_TEXTE = 9.8 / 9;
const MARGE_PLAQUE: Readonly<Record<StyleEtiquette, number>> = { encre: 7, bois: 11, metal: 13, pierre: 11 };
const ETROITS = " I'’.,!:;1l|";
const LARGES = "MW";
export function largeurTexte(texte: string): number {
  let w = 0;
  for (const ch of texte) w += ETROITS.includes(ch) ? 4.4 : LARGES.includes(ch) ? 9.4 : 7.2;
  return w;
}
/** La largeur d'une plaque : la plus longue de ses lignes (`\n` les sépare), plus la marge du style. */
export const largeurPlaque = (texte: string, style: StyleEtiquette): number => Math.ceil(Math.max(...texte.split("\n").map(largeurTexte)) * AGRANDI_TEXTE + MARGE_PLAQUE[style]);
/** Les façons de couper un nom long en deux lignes (à une espace ou après un trait d'union) : la plus équilibrée d'abord. Un nom d'un seul mot n'en a pas. */
export function coupures(texte: string): string[] {
  const l: string[] = [];
  for (let i = 1; i < texte.length - 1; i++) {
    const ch = texte[i]!;
    if (ch === " ") l.push(`${texte.slice(0, i)}\n${texte.slice(i + 1)}`);
    else if (ch === "-") l.push(`${texte.slice(0, i + 1)}\n${texte.slice(i + 1)}`);
  }
  return l.sort((a, b) => largeurPlaque(a, "encre") - largeurPlaque(b, "encre"));
}

/** Un trait arrondi aux coins coupés : la pierre taillée. */
function pierreTaillee(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number): void {
  c.beginPath();
  c.moveTo(x + k, y);
  c.lineTo(x + w - k * 0.6, y);
  c.lineTo(x + w, y + k * 0.8);
  c.lineTo(x + w, y + h - k);
  c.lineTo(x + w - k, y + h);
  c.lineTo(x + k * 0.7, y + h);
  c.lineTo(x, y + h - k * 0.7);
  c.lineTo(x, y + k);
  c.closePath();
}

/** Une pastille de texte (le nom d'un module, « Bille sauvée ! ») : `echelle` la grossit autour de son centre, pour les étiquettes du haut que la perspective rapetisse (lot PB2). Lot PBV1 : `style` « bois » en fait une
 *  plaque de bois veinée, clouée (les étiquettes de l'Océan). Lot PBV2 : « metal » une plaque de métal brossé rivetée (l'Espace), « pierre » une plaque de pierre taillée et gravée (le Volcan). */
export interface ExtraPastille {
  /** Lot PBL1 : la largeur minimale de la plaque (px de plaque) : une plaque qui change de mot garde sa taille. */
  largeur?: number;
  /** Une plaque **éteinte** (le verrou qui n'est pas allumé) : assombrie et pâle. */
  eteinte?: boolean;
  /** Une plaque **allumée** : le texte et le filet prennent la couleur de l'intention (`COULEURS_INTENTION`), dans une lueur. */
  allumee?: string;
  /** La pointe qui relie la plaque à son élément : l'angle (radians, y vers le bas) de la plaque vers lui, et la longueur du trait (px de plaque ; `POINTE_PLAQUE` par défaut). */
  pointe?: number;
  portee?: number;
}
const COULEUR_POINTE: Readonly<Record<StyleEtiquette, string>> = { encre: "#2A1E16", bois: "#74492A", metal: "#4A5270", pierre: "#5A524C" };
export function pastille(c: CanvasRenderingContext2D, police: string, x: number, y: number, texte: string, echelle = 1, style: StyleEtiquette = "encre", ex?: ExtraPastille): void {
  c.save();
  c.translate(x, y);
  c.scale(echelle, echelle);
  c.font = `700 9.8px ${police}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  const lignes = texte.split("\n");
  const e = (lignes.length - 1) * 10; // la hauteur en plus d'une plaque à deux lignes
  const w = Math.max(Math.max(...lignes.map((l) => c.measureText(l).width)) + MARGE_PLAQUE[style], ex?.largeur ?? 0);
  if (style === "bois") {
    c.beginPath();
    c.roundRect(-w / 2, -7.5 - e / 2, w, 15 + e, 2.5);
    c.fillStyle = "#74492A";
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = "#4E2F18";
    c.lineWidth = 0.6;
    for (const [dy0, ph] of [[-4.2, 0.3], [-0.6, 2.1], [3.4, 4]] as const) {
      const dy = dy0 * (1 + e / 15);
      c.globalAlpha = 0.55;
      c.beginPath();
      for (let k = -w / 2; k <= w / 2; k += 3) c.lineTo(k, dy + Math.sin(k * 0.21 + ph) * 0.7);
      c.stroke();
    }
    c.restore();
    c.lineWidth = 1.3;
    c.strokeStyle = "#2E1C10";
    c.stroke();
    c.fillStyle = "#C9CED6";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(s * (w / 2 - 3.2), 0, 1.1, 0, TAU);
      c.fill();
    }
  } else if (style === "metal") {
    // une plaque de métal brossé, un liseré clair sur l'arête haute, quatre rivets
    c.beginPath();
    c.roundRect(-w / 2, -8 - e / 2, w, 16 + e, 2.5);
    const mg = c.createLinearGradient(0, -8 - e / 2, 0, 8 + e / 2);
    mg.addColorStop(0, "#7B84A0");
    mg.addColorStop(0.45, "#4A5270");
    mg.addColorStop(1, "#343A55");
    c.fillStyle = mg;
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = "#FFFFFF";
    c.lineWidth = 0.4;
    for (const [dy0, a] of [[-5.4, 0.1], [-2.6, 0.06], [0.4, 0.09], [3.1, 0.05], [5.6, 0.08]] as const) {
      const dy = dy0 * (1 + e / 16);
      c.globalAlpha = a;
      c.beginPath();
      c.moveTo(-w / 2, dy);
      c.lineTo(w / 2, dy);
      c.stroke();
    }
    c.restore();
    c.lineWidth = 1.2;
    c.strokeStyle = "#161A33";
    c.stroke();
    c.beginPath();
    c.roundRect(-w / 2 + 0.9, -7.1 - e / 2, w - 1.8, 14.2 + e, 2);
    c.lineWidth = 0.7;
    c.strokeStyle = "rgba(200,210,240,.55)";
    c.stroke();
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const rx = sx * (w / 2 - 3.4);
        const ry = sy * (4.9 + e / 2);
        c.beginPath();
        c.arc(rx, ry, 1.35, 0, TAU);
        c.fillStyle = "#161A33";
        c.fill();
        c.beginPath();
        c.arc(rx - 0.2, ry - 0.25, 0.95, 0, TAU);
        c.fillStyle = "#C9CFDE";
        c.fill();
      }
    }
  } else if (style === "pierre") {
    // une plaque de pierre taillée : le haut et la gauche éclairés, le bas et la droite dans l'ombre, une fissure, des grains
    pierreTaillee(c, -w / 2, -7.5 - e / 2, w, 15 + e, 2.6);
    const pg = c.createLinearGradient(0, -7.5 - e / 2, 0, 7.5 + e / 2);
    pg.addColorStop(0, "#6E665F");
    pg.addColorStop(1, "#4A4440");
    c.fillStyle = pg;
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = "rgba(20,14,12,.55)";
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(-w / 2 + w * 0.62, -7.5 - e / 2);
    c.lineTo(-w / 2 + w * 0.6, -2.5);
    c.lineTo(-w / 2 + w * 0.67, 1.5);
    c.lineTo(-w / 2 + w * 0.64, 7.5 + e / 2);
    c.stroke();
    c.fillStyle = "rgba(255,235,210,.16)";
    for (let k = 0; k < 9; k++) c.fillRect(-w / 2 + ((k * 37 + 11) % Math.floor(w)), -6 - e / 2 + ((k * 53) % (12 + e)), 0.9, 0.9);
    c.strokeStyle = "rgba(255,232,205,.42)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-w / 2, 7.5 + e / 2);
    c.lineTo(-w / 2, -7.5 - e / 2);
    c.lineTo(w / 2, -7.5 - e / 2);
    c.stroke();
    c.strokeStyle = "rgba(0,0,0,.5)";
    c.beginPath();
    c.moveTo(w / 2, -7.5 - e / 2);
    c.lineTo(w / 2, 7.5 + e / 2);
    c.lineTo(-w / 2, 7.5 + e / 2);
    c.stroke();
    c.restore();
    pierreTaillee(c, -w / 2, -7.5 - e / 2, w, 15 + e, 2.6);
    c.lineWidth = 1.2;
    c.strokeStyle = "#1D1613";
    c.stroke();
    // le texte est gravé : un creux sombre décalé, puis la lettre claire
    c.fillStyle = "rgba(10,6,5,.6)";
    lignes.forEach((l, k) => c.fillText(l, 0.5, (k - (lignes.length - 1) / 2) * 10 + 1.1));
  } else {
    // lot PBV3 : une plaque d'encre comme sur les cibles — sombre, posée sur son ombre, une arête claire en haut, un filet sombre autour
    c.beginPath();
    c.roundRect(-w / 2 + 0.6, -6.2 - e / 2, w, 14 + e, 3);
    c.fillStyle = "rgba(0,0,0,.35)";
    c.fill();
    c.beginPath();
    c.roundRect(-w / 2, -7 - e / 2, w, 14 + e, 3);
    const eg = c.createLinearGradient(0, -7 - e / 2, 0, 7 + e / 2);
    eg.addColorStop(0, "#4A3628");
    eg.addColorStop(0.5, ENCRE);
    eg.addColorStop(1, "#1A110B");
    c.fillStyle = eg;
    c.fill();
    c.lineWidth = 0.8;
    c.strokeStyle = "#120B06";
    c.stroke();
    c.beginPath();
    c.moveTo(-w / 2 + 2.5, -6.2 - e / 2);
    c.lineTo(w / 2 - 2.5, -6.2 - e / 2);
    c.lineWidth = 0.7;
    c.strokeStyle = "rgba(255,226,190,.32)";
    c.stroke();
  }
  const demiH = 7.5 + e / 2;
  // lot PBL1 : la pointe vers l'élément : un trait qui part du bord de la plaque, tourné vers lui, que termine un petit triangle
  if (ex?.pointe !== undefined) {
    const ca = Math.cos(ex.pointe);
    const sa = Math.sin(ex.pointe);
    const t = Math.min(Math.abs(ca) < 1e-6 ? Infinity : w / 2 / Math.abs(ca), Math.abs(sa) < 1e-6 ? Infinity : demiH / Math.abs(sa));
    const portee = ex.portee ?? POINTE_PLAQUE;
    const tete = Math.min(portee, 7);
    c.lineJoin = "round";
    c.lineCap = "round";
    if (portee > tete + 1) {
      c.beginPath();
      c.moveTo(ca * (t - 0.4), sa * (t - 0.4));
      c.lineTo(ca * (t + portee - tete), sa * (t + portee - tete));
      c.lineWidth = 2.6;
      c.strokeStyle = "#120B06";
      c.stroke();
      c.lineWidth = 1.2;
      c.strokeStyle = COULEUR_POINTE[style];
      c.stroke();
    }
    const bx = ca * (t + portee - tete);
    const by = sa * (t + portee - tete);
    c.beginPath();
    c.moveTo(bx - sa * 4.4, by + ca * 4.4);
    c.lineTo(ca * (t + portee), sa * (t + portee));
    c.lineTo(bx + sa * 4.4, by - ca * 4.4);
    c.closePath();
    c.fillStyle = COULEUR_POINTE[style];
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = "#120B06";
    c.stroke();
  }
  if (ex?.eteinte) {
    // éteinte : la plaque s'assombrit
    c.beginPath();
    c.roundRect(-w / 2, -demiH, w, 2 * demiH, 3);
    c.fillStyle = "rgba(8,6,12,.5)";
    c.fill();
  }
  if (ex?.allumee) {
    // allumée : un filet et une lueur de la couleur de l'intention
    c.save();
    c.shadowColor = ex.allumee;
    c.shadowBlur = 7;
    c.beginPath();
    c.roundRect(-w / 2, -demiH, w, 2 * demiH, 3);
    c.lineWidth = 1.8;
    c.strokeStyle = ex.allumee;
    c.stroke();
    c.restore();
  }
  c.fillStyle = ex?.allumee ?? (ex?.eteinte ? "rgba(255,253,246,.5)" : "#FFFDF6");
  lignes.forEach((l, k) => c.fillText(l, 0, (k - (lignes.length - 1) / 2) * 10 + 0.5));
  c.restore();
}

// --- Lot PBG1 : les rails (les rampes et l'orbite) du rendu à plat. **Au-dessus du sol** : un ruban à l'ombre portée sur le sol (d'autant plus décalée que le rail est haut), des rebords, une bouche en entonnoir et sa flèche de
// tir ; habillé par thème avec les mêmes idées que le rendu three.js (foire : rails rouge et blanc à traverses ; océan : gouttière turquoise ; espace : tube néon cyan ; volcan : rail de fer sur traverses et lueur orange).
// **Tout est cuit une fois** (`dessinerRails`, dans une image à la taille de l'écran) : le rendu à plat n'y dessine rien par image que la bille posée sur un rail.
/** La largeur du ruban d'un rail (px de la table) : celle d'une rampe ; l'orbite, qui longe l'arc et ses lampes, est un peu plus étroite. **Lot PBL1 : des rails plus fins** (22 et 20 px avant ; la bille, de 18 px, roule dessus, la voie de la simulation n'a pas bougé). */
export const largeurDuRail = (rail: Pick<Rail, "genre">): number => (rail.genre === "orbite" ? 16 : 18);
/** À quelle distance avant sa bouche la flèche de tir d'un rail se pose (px) : devant l'entonnoir. */
const RECUL_FLECHE_RAIL = 26;
export interface FlecheDeRail {
  x: number;
  y: number;
  /** L'angle de la flèche : celui de l'entrée dans la bouche. */
  a: number;
  rail: number;
  bout: 0 | 1;
}
/** Les flèches de tir des rails, une par bouche : devant la bouche, tournée dans le sens de l'entrée (l'orbite en a deux). Communes aux deux rendus (le sol les peint, le rendu à plat les fait clignoter). */
export function flechesDesRails(table: Table): FlecheDeRail[] {
  return table.portes.map((g) => {
    const ux = g.ux / NORME;
    const uy = g.uy / NORME;
    return { x: g.x / UNITE - ux * RECUL_FLECHE_RAIL, y: g.y / UNITE - uy * RECUL_FLECHE_RAIL, a: Math.atan2(uy, ux), rail: g.rail, bout: g.bout };
  });
}
// --- Lot PBL1 : les flèches au sol — celles qui disent quoi viser maintenant. Toutes peintes au sol, éteintes et discrètes (`flecheEteinte`, cuites dans le sol) ; `indications.ts` dit lesquelles s'allument, dans quelle couleur.
/** Une flèche au sol : l'élément de la mission, le verrou, une bouche de rail ou la porte. `rang` : le rang du module dans `table.poses`, ou celui du rail ; `id` est stable (le rendu en garde une par id). */
export interface FlecheAuSol {
  id: string;
  x: number;
  y: number;
  a: number;
  cible: "element" | "verrou" | "rail" | "porte";
  rang: number;
}
/** Les flèches au sol d'une table : devant chaque module qui compte pour la mission, devant le verrou, devant la bouche de chaque rail et dans le passage de la porte. **Plus aucune flèche devant les autres modules** (bumpers, cibles, spinner, trou simple, éléments sans mission) : les flèches blanches partout ne disaient pas quoi viser. */
export function flechesAuSol(table: Table, theme: ThemePinball): FlecheAuSol[] {
  const sortie: FlecheAuSol[] = [];
  table.poses.forEach((m, i) => {
    if (comptePourLaMission(theme, m.type)) sortie.push({ id: `m${i}`, ...flecheDe(m), cible: "element", rang: i });
  });
  if (table.verrou >= 0) {
    const v = table.trous[table.verrou]!;
    sortie.push({ id: "v", ...flecheDe({ type: "trou", x: v.x, y: v.y }), cible: "verrou", rang: table.verrou });
  }
  for (const f of flechesDesRails(table)) sortie.push({ id: `r${f.rail}.${f.bout}`, x: f.x, y: f.y, a: f.a, cible: "rail", rang: f.rail });
  const porte = geoPorte(table);
  if (porte) sortie.push({ id: "p", x: porte.fleche.x, y: porte.fleche.y, a: porte.fleche.a, cible: "porte", rang: 0 });
  return sortie;
}

/** Ce que les plaques des modules ne doivent pas recouvrir : le tracé épaissi de chaque rail (un disque tous les 10 px), chaque bouche avec son entonnoir et chaque flèche de bouche. */
export function disquesDesRails(table: Table): { x: number; y: number; r: number }[] {
  const d: { x: number; y: number; r: number }[] = [];
  for (const rail of table.rails) for (const p of echantillons(rail, 10)) d.push({ x: p.x, y: p.y, r: largeurDuRail(rail) / 2 + 3.5 });
  for (const g of table.portes) d.push({ x: g.x / UNITE - (g.ux / NORME) * 8, y: g.y / UNITE - (g.uy / NORME) * 8, r: g.l / UNITE + 10 });
  for (const f of flechesDesRails(table)) d.push({ x: f.x, y: f.y, r: 10 });
  return d;
}

/** Lot PBG1 : la place que balaie le mini-batteur (du repos à la levée) : un disque tous les 8 px de sa longueur, à cinq angles. Les plaques ne la recouvrent pas. */
export function disquesDuMini(table: Table): { x: number; y: number; r: number }[] {
  const m = table.mini;
  if (!m) return [];
  const x0 = px(m.cote === GAUCHE ? m.x : 2 * AXE * UNITE - m.x);
  const y0 = px(m.y);
  const lg = px(m.longueur);
  const sens = m.cote === GAUCHE ? 1 : -1;
  const d: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k <= 4; k++) {
    const a = (REGLAGES.batteurHaut + ((REGLAGES.batteurRepos - REGLAGES.batteurHaut) * k) / 4) / 1000;
    for (let u = 0; u <= lg; u += 8) d.push({ x: x0 + sens * Math.cos(a) * u, y: y0 + Math.sin(a) * u, r: 11 });
  }
  return d;
}

interface XY {
  x: number;
  y: number;
}
/** Le tracé décalé de `d` px sur le côté (la normale du tracé). */
const decaler = (pts: readonly PointRail[], d: number): XY[] => pts.map((p) => ({ x: p.x - p.dy * d, y: p.y + p.dx * d }));
function ligne(c: CanvasRenderingContext2D, pts: readonly XY[]): void {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
}
/** Des traverses : un petit trait en travers du ruban tous les `pas` échantillons. */
function traverses(c: CanvasRenderingContext2D, pts: readonly PointRail[], demi: number, pas: number, couleur: string, epaisseur: number, alpha = 1): void {
  c.beginPath();
  for (let i = 1; i < pts.length - 1; i += pas) {
    const p = pts[i]!;
    c.moveTo(p.x - p.dy * demi, p.y + p.dx * demi);
    c.lineTo(p.x + p.dy * demi, p.y - p.dx * demi);
  }
  c.globalAlpha = alpha;
  c.strokeStyle = couleur;
  c.lineWidth = epaisseur;
  c.stroke();
  c.globalAlpha = 1;
}
/** Des chevrons dans le sens de la marche (une rampe se prend dans un seul sens) : un tous les 45 px. */
function chevrons(c: CanvasRenderingContext2D, pts: readonly PointRail[], couleur: string, alpha: number): void {
  c.beginPath();
  for (let i = 6; i < pts.length - 6; i += 9) {
    const p = pts[i]!;
    const nx = -p.dy;
    const ny = p.dx;
    c.moveTo(p.x - p.dx * 3 + nx * 5, p.y - p.dy * 3 + ny * 5);
    c.lineTo(p.x + p.dx * 3, p.y + p.dy * 3);
    c.lineTo(p.x - p.dx * 3 - nx * 5, p.y - p.dy * 3 - ny * 5);
  }
  c.globalAlpha = alpha;
  c.strokeStyle = couleur;
  c.lineWidth = 2.4;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.stroke();
  c.globalAlpha = 1;
  c.lineCap = "butt";
}
/** Les couleurs de l'entonnoir d'une bouche et des chevrons, par thème. */
const COULEURS_RAILS: Readonly<Record<ThemePinball, { entonnoir: string; chevron: string; alpha: number; bord: string }>> = {
  foire: { entonnoir: "#C2401F", chevron: "#2A1E16", alpha: 0.55, bord: "#FFB23E" },
  ocean: { entonnoir: "#2E6E8E", chevron: "#FFFFFF", alpha: 0.8, bord: "#3FE6F2" },
  espace: { entonnoir: "#26436e", chevron: "#E8FDFF", alpha: 0.8, bord: "#5FD3E8" },
  volcan: { entonnoir: "#6b6770", chevron: "#D8CFC4", alpha: 0.8, bord: "#B9B5C0" },
};
/** La couleur du bord de l'entonnoir d'un rail et de sa flèche qui clignote : celle du rail du thème (le rendu three.js peut la reprendre). */
export const couleurDeBouche = (theme: ThemePinball): string => COULEURS_RAILS[theme].bord;

/** Le ruban d'un rail, habillé par thème (le tracé `pts` : échantillons de 5 px, de l'entrée à la sortie). **Lot PBL1 : des rails qui ne cachent rien** — fins (18 px au plus), moins saturés, **en partie translucides** (un fond de verre ou de plexi à 12-30 %, des filets
 *  fins au lieu de rubans pleins), sans cerne d'encre épais et **sans lueur** ; un module sous un rail se lit à travers. */
function ruban(c: CanvasRenderingContext2D, rail: Rail, pts: readonly PointRail[], theme: ThemePinball): void {
  const W = largeurDuRail(rail);
  const demi = W / 2;
  c.save();
  c.lineCap = "butt";
  c.lineJoin = "round";
  const tracer = (couleur: string, largeur: number, alpha = 1): void => {
    ligne(c, pts);
    c.globalAlpha = alpha;
    c.strokeStyle = couleur;
    c.lineWidth = largeur;
    c.stroke();
    c.globalAlpha = 1;
  };
  const filet = (cote: number, decalage: number, couleur: string, largeur: number, alpha = 1): void => {
    ligne(c, decaler(pts, cote * decalage));
    c.globalAlpha = alpha;
    c.strokeStyle = couleur;
    c.lineWidth = largeur;
    c.stroke();
    c.globalAlpha = 1;
  };
  if (theme === "foire") {
    // des montagnes russes en plexi : un fond sable très clair, deux filets rouge et blanc, des traverses fines et rares
    tracer("#E8D3AC", W, 0.26);
    traverses(c, pts, demi, 5, "#8A5632", 1.6, 0.55);
    for (const s of [-1, 1]) {
      filet(s, demi - 1.2, "#B9564B", 2.4, 0.9);
      c.setLineDash([6, 6]);
      filet(s, demi - 1.2, "#F3EBDC", 2.4, 0.9);
      c.setLineDash([]);
    }
  } else if (theme === "ocean") {
    // une gouttière de verre bleuté : l'eau à peine teintée, deux filets d'écume
    tracer("#8FE3EA", W, 0.24);
    for (const s of [-1, 1]) filet(s, demi - 0.8, "#E6FBFD", 1.8, 0.9);
    c.setLineDash([3, 11]);
    tracer("#FFFFFF", 1.4, 0.7);
    c.setLineDash([]);
  } else if (theme === "espace") {
    // un tube de verre : un fond à peine sombre, deux filets néon fins, des anneaux rares
    tracer("#9FD8E8", W, 0.16);
    traverses(c, pts, demi, 9, "#6FD3E6", 1.2, 0.4);
    for (const s of [-1, 1]) {
      filet(s, demi - 1, "#5FD3E8", 1.8, 0.8);
      filet(s, demi - 1, "#E8FDFF", 0.7, 0.9);
    }
  } else {
    // un rail de fer sur quelques traverses, un fond de verre fumé : **pas de lueur de lave**
    tracer("#8A8590", W, 0.2);
    traverses(c, pts, demi, 6, "#2A1E1A", 2.2, 0.7);
    for (const s of [-1, 1]) filet(s, demi - 1.5, "#B9B5C0", 2, 0.95);
  }
  if (rail.genre === "rampe") chevrons(c, pts, COULEURS_RAILS[theme].chevron, Math.min(0.5, COULEURS_RAILS[theme].alpha * 0.6));
  c.restore();
}

/** La bouche d'un rail : un entonnoir évasé vers l'extérieur (le ruban, puis le bord large qui accueille la bille), cerné d'encre. */
function entonnoir(c: CanvasRenderingContext2D, g: Porte, theme: ThemePinball): void {
  const ux = g.ux / NORME;
  const uy = g.uy / NORME;
  const nx = -uy;
  const ny = ux;
  const l = g.l / UNITE;
  const mx = g.x / UNITE;
  const my = g.y / UNITE;
  const coin = (a: number, b: number): [number, number] => [mx + ux * a + nx * b, my + uy * a + ny * b];
  c.save();
  c.beginPath();
  c.moveTo(...coin(0, l));
  c.lineTo(...coin(-12, l + 8));
  c.lineTo(...coin(-12, -(l + 8)));
  c.lineTo(...coin(0, -l));
  c.closePath();
  c.globalAlpha = 0.4;
  c.fillStyle = COULEURS_RAILS[theme].entonnoir;
  c.fill();
  c.globalAlpha = 0.75;
  c.lineWidth = 1.4;
  c.lineJoin = "round";
  c.strokeStyle = ENCRE;
  c.stroke();
  c.globalAlpha = 1;
  // le bord large, éclairé de la couleur du rail du thème
  c.beginPath();
  c.moveTo(...coin(-11, l + 7));
  c.lineTo(...coin(-11, -(l + 7)));
  c.strokeStyle = COULEURS_RAILS[theme].bord;
  c.globalAlpha = 0.8;
  c.lineWidth = 1.6;
  c.lineCap = "round";
  c.stroke();
  c.restore();
}

/** Les rails à plat, sur un canvas transparent à l'échelle de la table (375 × 760) : d'abord leurs ombres sur le sol (décalées d'autant plus que le rail est haut), puis les rubans du plus bas au plus haut, puis les entonnoirs. */
export function dessinerRails(c: CanvasRenderingContext2D, table: Table, theme: ThemePinball): void {
  if (table.rails.length === 0) return;
  const o = OMBRE[theme];
  const ordre = table.rails.map((rail, i) => ({ rail, i, pts: echantillons(rail, 5) })).sort((a, b) => a.rail.hauteur - b.rail.hauteur || a.i - b.i);
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const { rail, pts } of ordre) {
    const W = largeurDuRail(rail);
    const ombre = pts.map((p) => ({ x: p.x + p.h * 0.22, y: p.y + p.h * 0.32 }));
    for (const [w, a] of [[W + 6, 0.03], [W - 4, 0.09]] as const) {
      ligne(c, ombre);
      c.strokeStyle = `rgba(${o},${a})`;
      c.lineWidth = w;
      c.stroke();
    }
  }
  for (const { rail, pts } of ordre) ruban(c, rail, pts, theme);
  for (const g of table.portes) entonnoir(c, g, theme);
  c.restore();
}

// --- Lot PBV2 : la mise en place des étiquettes des modules, commune aux deux rendus et gardée par `test/etiquettes.test.ts`
/** De combien les plaques sont grossies à l'écran par défaut (la taille « 140 % » du curseur des étiquettes, plus la perspective : la caméra est plus près du bas de la table que du haut, de moins de 4 %). */
export const GROSSISSEMENT_ETIQUETTE = 1.4 * 1.04;
/** Ce qu'une étiquette ne doit pas recouvrir : un disque autour d'un module (85 % de son rayon de nom : ce que le module occupe vraiment ; l'astéroïde : son bumper de 16 px, son nom se pose au-dessus de sa course) ; la boîte de l'étiquette y est tangente au plus. */
export const empreinteDuModule = (type: string): number => (type === "asteroide" ? 19 : (RAYON_MODULE[type] ?? 30) * 0.85);
export type RoleEtiquette = "mission" | "verrou" | "porte";
/** **Lot PBL1 : une plaque ne nomme que ce qui compte.** `mission` : l'élément de la mission (son nom ; « JACKPOT » pendant la multibille), `verrou` : le verrou (éteinte, puis allumée et qui clignote quand il est allumé), `porte` : la porte (affichée seulement quand elle est ouverte). */
export interface Etiquette {
  /** Le module que la plaque nomme (son type : `trou` pour le verrou) et son rôle. */
  module: string;
  role: RoleEtiquette;
  /** Le texte de base, déjà en capitales, et tous les mots que la plaque peut dire (le texte de base compris : « JACKPOT » sur la plaque de la mission) ; **la plaque a la taille du plus large**. */
  texte: string;
  mots: string[];
  /** Le centre de la plaque sur la table (px). */
  x: number;
  y: number;
  /** Une plaque est réduite quand elle ne tient nulle part à sa taille : 1 (entière) à 0,68 (la plus petite). */
  taille: number;
  /** La boîte de la plaque à l'écran, en px de la table (grossissement compris). */
  l: number;
  h: number;
  /** Ce que la plaque nomme, sur la table : le centre du module (la porte : son milieu, puis sa flèche). */
  ancres: readonly { x: number; y: number }[];
  /** **Collée à son élément** : l'angle (radians, y vers le bas) de la pointe, de la plaque vers l'élément, et l'écart (px) entre la boîte et ce que la plaque nomme. */
  pointe: number;
  /** La longueur du trait de la plaque à son élément, en px de plaque (avant le grossissement) : `POINTE_PLAQUE` au moins. */
  portee: number;
  ecart: number;
  /** Une plaque permanente est toujours à l'écran (la mission et le verrou) ; celle de la porte ne l'est que porte ouverte. */
  permanente: boolean;
  /** Dernier recours : la plaque n'a trouvé de place que sur un rail (le test les compte : un emplacement à déplacer, voir le README du lot PBL1). */
  surUnRail: boolean;
}
export const boiteDeLEtiquette = (e: Pick<Etiquette, "x" | "y" | "l" | "h">): { x0: number; y0: number; x1: number; y1: number } => ({ x0: e.x - e.l / 2, y0: e.y - e.h / 2, x1: e.x + e.l / 2, y1: e.y + e.h / 2 });
/** Une boîte et un disque se recouvrent-ils ? */
export function boiteTouche(b: { x0: number; y0: number; x1: number; y1: number }, cx: number, cy: number, r: number): boolean {
  const dx = cx - Math.min(b.x1, Math.max(b.x0, cx));
  const dy = cy - Math.min(b.y1, Math.max(b.y0, cy));
  return dx * dx + dy * dy < r * r;
}
/** Deux boîtes se recouvrent-elles (à `ecart` px près) ? */
export const boitesSeRecouvrent = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }, ecart = 0): boolean => a.x0 < b.x1 + ecart && b.x0 < a.x1 + ecart && a.y0 < b.y1 + ecart && b.y0 < a.y1 + ecart;
/** Les limites de la table pour une étiquette : entre les rails (24 à 344 px), sous les couloirs du haut, au-dessus des lance-pierres, et dans l'arc quand elle est en haut. */
function dansLaTable(b: { x0: number; y0: number; x1: number; y1: number }): boolean {
  if (b.x0 < 24 || b.x1 > 344 || b.y0 < 118 || b.y1 > 470) return false;
  if (b.y0 < ARC_CENTRE.y) {
    const demi = Math.sqrt(Math.max(0, ARC_CENTRE.r * ARC_CENTRE.r - (ARC_CENTRE.y - b.y0) ** 2)) - 8;
    if (b.x0 < ARC_CENTRE.x - demi || b.x1 > ARC_CENTRE.x + demi) return false;
  }
  return true;
}
/** Lot PBL1 : jusqu'où une plaque peut être de son élément (px entre sa boîte et ce qu'elle nomme). Au-delà de `POINTE_PLAQUE` px de plaque (8 × 1,4 ≈ 11 px de table) un **trait** relie la plaque à son élément, que sa pointe termine : une plaque ne flotte jamais seule. */
export const ECART_MAX_PLAQUE = 44;
/** La longueur de la pointe d'une plaque, en px de plaque (avant le grossissement). */
export const POINTE_PLAQUE = 8;
/** La distance d'un point à une boîte (0 : dedans). */
const distanceBoite = (b: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number): number => Math.hypot(x - Math.min(b.x1, Math.max(b.x0, x)), y - Math.min(b.y1, Math.max(b.y0, y)));
/** **La règle des plaques (lot PBL1).** Seules trois choses sont nommées : **l'élément de la mission** (le manège, le tourbillon, le portail A — « Portails » —, le geyser ; « JACKPOT » pendant la multibille), **le verrou** (éteint, puis allumé qui
 *  clignote) et **la porte** (quand elle est ouverte) ; ni les bumpers, ni les cibles, ni le spinner, ni le trou simple, ni les rails n'ont de plaque (leurs noms restent dans le panneau « Aujourd'hui » et le « Comment jouer »).
 *  **Chaque plaque est collée à son élément** : on cherche, autour de lui, la plus petite distance entre sa boîte et lui (au plus `ECART_MAX_PLAQUE` px) à une place qui ne recouvre rien de fixe — ni un autre module, ni un poteau, ni
 *  une lampe, **ni un rail, une bouche ou le mini-batteur**, ni une flèche au sol, ni la porte, ni une autre plaque — avec une préférence pour le dessous de l'élément (la table est penchée : le texte s'y lit mieux) ; la plaque
 *  grandit par défaut et se réduit (jusqu'à 68 %) seulement si elle ne tient pas. **Une pointe** (`pointe`) la relie à son élément. Déterministe : ne dépend que de la table et des textes.
 *  *Pourquoi les plaques s'empilaient au centre (Volcan × doublette, avant ce lot) :* chaque module avait sa plaque, la table était pleine d'obstacles (rails épais, tracé épaissi de 7 px de chaque côté) : la plus proche place libre
 *  d'un module caché sous un rail était le milieu de la table, loin de lui, et rien n'imposait une distance maximale. Ici la distance est une règle dure, et il n'y a que deux ou trois plaques. */
export function placerEtiquettes(table: Table, theme: ThemePinball, nom: (module: string) => string | null): Etiquette[] {
  const style = styleEtiquette(theme);
  type Disque = { x: number; y: number; r: number };
  const obstacles: Disque[] = table.poses.map((m) => ({ x: px(m.x), y: px(m.y), r: empreinteDuModule(m.type) }));
  for (const p of table.poteaux) obstacles.push({ x: px(p.x), y: px(p.y), r: px(p.r) + 3 });
  for (const v of table.voies) obstacles.push({ x: px(v.x), y: px(v.y) + 24, r: 7.5 });
  // les lampes de la mission, en arc au-dessus de l'élément du thème (de trois à cinq : les buts par défaut ; l'arc de cinq contient celui de trois)
  for (const but of [4, 5]) for (const l of lampesMission(table, theme, but)) obstacles.push({ x: l.x, y: l.y, r: 5.5 });
  // la porte : ses deux murs et son battant (un disque tous les 7 px)
  const porte = geoPorte(table);
  const disquesPorte: Disque[] = [];
  if (porte) {
    const trait = (x0: number, y0: number, x1: number, y1: number): void => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 7));
      for (let k = 0; k <= n; k++) disquesPorte.push({ x: x0 + ((x1 - x0) * k) / n, y: y0 + ((y1 - y0) * k) / n, r: 9 });
    };
    trait(porte.a.x, porte.a.y, porte.b.x, porte.b.y);
    for (const m of porte.murs) trait(m.x0, m.y0, m.x1, m.y1);
    obstacles.push(...disquesPorte);
  }
  // les rails, leurs bouches et leurs flèches, le mini-batteur et **toutes les flèches au sol** : une plaque ne les recouvre jamais
  const rails: Disque[] = [...disquesDesRails(table), ...disquesDuMini(table)];
  const disquesRails = new Set<Disque>(rails);
  obstacles.push(...rails);
  for (const f of flechesAuSol(table, theme)) obstacles.push({ x: f.x, y: f.y, r: 11.5 });
  const CASE = 16;
  const cases = new Map<number, Disque[]>();
  for (const d of obstacles) {
    for (let cx = Math.floor((d.x - d.r) / CASE); cx <= Math.floor((d.x + d.r) / CASE); cx++) {
      for (let cy = Math.floor((d.y - d.r) / CASE); cy <= Math.floor((d.y + d.r) / CASE); cy++) {
        const k = cx * 4096 + cy;
        const l = cases.get(k);
        if (l) l.push(d);
        else cases.set(k, [d]);
      }
    }
  }
  /** `propres` : les disques de l'élément que la plaque nomme, qu'elle peut recouvrir par le bord (`creux` de leur rayon : dernier recours des éléments que les rails et les voisins enserrent) ; tout le reste est dur. */
  const toucheUnObstacle = (b: { x0: number; y0: number; x1: number; y1: number }, propres?: readonly Disque[], creux = 0, sansRails = false): boolean => {
    for (let cx = Math.floor(b.x0 / CASE); cx <= Math.floor(b.x1 / CASE); cx++) {
      for (let cy = Math.floor(b.y0 / CASE); cy <= Math.floor(b.y1 / CASE); cy++) {
        const l = cases.get(cx * 4096 + cy);
        if (l && l.some((d) => !(sansRails && disquesRails.has(d)) && boiteTouche(b, d.x, d.y, propres?.includes(d) ? d.r * (1 - creux) : d.r))) return true;
      }
    }
    return false;
  };
  const posees: Etiquette[] = [];
  /** Pose la plaque d'un élément : `empreinte` ce qu'elle nomme (des disques), `centre` d'où chercher (le milieu de l'élément) et `rayon` jusqu'où il s'étend de là. */
  const poser = (module: string, role: RoleEtiquette, mots: string[], empreinte: readonly Disque[], centre: { x: number; y: number }, rayon: number, ancres: { x: number; y: number }[], permanente: boolean): void => {
    const texte = mots[0]!;
    const large = mots.reduce((a, b) => (largeurPlaque(b, style) > largeurPlaque(a, style) ? b : a));
    type Candidat = { x: number; y: number; ecart: number; cout: number; taille: number; l: number; h: number };
    let meilleur = null as Candidat | null;
    let surUnRail = false;
    // quatre passes : (1) des places libres, la plaque réduite jusqu'à 68 % ; (2) jusqu'à 52 % ; (3) en dernier recours, la plaque mord de 55 % du rayon sur son propre élément (un élément enserré par des rails et des voisins) ; (4) **le tout dernier** : sur un rail (`surUnRail` : une table dont l'emplacement est à déplacer, voir le README du lot PBL1) — jamais sur un autre module ni une flèche
    for (const [tailles, creux, sansRails] of [[[1, 0.92, 0.84, 0.76, 0.68], 0, false], [[1, 0.92, 0.84, 0.76, 0.68, 0.6], 0, false], [[1, 0.92, 0.84, 0.76, 0.68, 0.6], 0.55, false], [[1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52], 0.55, true]] as const) {
      for (const taille of tailles) {
        const l = largeurPlaque(large, style) * taille * GROSSISSEMENT_ETIQUETTE;
        const h = hauteurPlaque(1) * taille * GROSSISSEMENT_ETIQUETTE;
        for (let a = 0; a < 360; a += 10) {
          const cosA = Math.cos((a * Math.PI) / 180);
          const sinA = Math.sin((a * Math.PI) / 180);
          // la distance du centre de la plaque à son bord, le long de cette direction : le centre est posé à `rayon + g + cette distance` du centre de l'élément (l'écart réel est mesuré ensuite sur la boîte)
          const demi = Math.min(Math.abs(cosA) < 1e-9 ? Infinity : l / 2 / Math.abs(cosA), Math.abs(sinA) < 1e-9 ? Infinity : h / 2 / Math.abs(sinA));
          for (let g = Math.round(-creux * rayon); g <= 40; g++) {
            const d = rayon + g + demi;
            const x = centre.x + cosA * d;
            const y = centre.y + sinA * d;
            const b = { x0: x - l / 2, y0: y - h / 2, x1: x + l / 2, y1: y + h / 2 };
            if (!dansLaTable(b) || toucheUnObstacle(b, empreinte, creux, sansRails) || posees.some((q) => boitesSeRecouvrent(b, boiteDeLEtiquette(q), 3))) continue;
            let ecart = Infinity;
            for (const e of empreinte) ecart = Math.min(ecart, distanceBoite(b, e.x, e.y) - e.r);
            if (ecart > ECART_MAX_PLAQUE) continue;
            // le moindre écart d'abord ; une plaque réduite coûte cher (jusqu'à 70 : un écart de 28 px) : mieux vaut une plaque lisible un peu plus loin, reliée par son trait ; au-dessous de l'élément de préférence (la table est penchée), puis de côté, le dessus en dernier
            const cout = Math.max(0, ecart) * 2.5 + (1 - taille) * 220 + (sinA < -0.4 ? 9 : 0) + (sinA > 0.4 ? 0 : 3) + Math.abs(cosA) * 0.5;
            if (!meilleur || cout < meilleur.cout - 1e-9) {
              meilleur = { x, y, ecart, cout, taille, l, h };
              surUnRail = sansRails;
            }
            break; // les écarts suivants de cette direction sont plus loin
          }
        }
      }
      if (meilleur) break;
    }
    if (meilleur) {
      const ap = ancres[0]!;
      posees.push({ module, role, texte, mots, x: meilleur.x, y: meilleur.y, taille: meilleur.taille, l: meilleur.l, h: meilleur.h, ancres, pointe: Math.atan2(ap.y - meilleur.y, ap.x - meilleur.x), portee: Math.max(POINTE_PLAQUE, meilleur.ecart / (meilleur.taille * 1.4) + 1), ecart: Math.max(0, meilleur.ecart), permanente, surUnRail });
      return;
    }
    // aucune place : l'endroit habituel, au-dessous, à la plus petite taille (ne devrait pas arriver : le test le garde)
    const taille = 0.68;
    const ap = ancres[0]!;
    const l = largeurPlaque(large, style) * taille * GROSSISSEMENT_ETIQUETTE;
    const h = hauteurPlaque(1) * taille * GROSSISSEMENT_ETIQUETTE;
    const y = centre.y + rayon + h / 2 + 2;
    posees.push({ module, role, texte, mots, x: centre.x, y, taille, l, h, ancres, pointe: Math.atan2(ap.y - y, ap.x - centre.x), portee: POINTE_PLAQUE, ecart: 2, permanente, surUnRail: true });
  };
  // 1. l'élément de la mission (le portail A pour l'espace, qui compte pour les deux portails : « Portails »)
  const element = table.poses.find((m) => comptePourLaMission(theme, m.type) && m.type !== "portailB");
  const jackpot = nom("jackpot");
  if (element) {
    const n = element.type === "portailA" ? nom("portails") : nom(element.type);
    if (n) {
      const c = { x: px(element.x), y: px(element.y) };
      poser(element.type, "mission", [n.toLocaleUpperCase(), ...(jackpot ? [jackpot.toLocaleUpperCase()] : [])], [obstacles[table.poses.indexOf(element)]!], c, empreinteDuModule(element.type), [c], true);
    }
  }
  // 2. le verrou : le trou du deuxième emplacement du plan (il n'y en a pas sur le plan d'essai)
  const nomVerrou = nom("verrou");
  if (table.verrou >= 0 && nomVerrou) {
    const v = table.trous[table.verrou]!;
    const c = { x: px(v.x), y: px(v.y) };
    poser("trou", "verrou", [nomVerrou.toLocaleUpperCase()], [obstacles[table.poses.findIndex((m) => m.type === "trou" && m.x === v.x && m.y === v.y)]!], c, empreinteDuModule("trou"), [c], true);
  }
  // 3. la porte (sa plaque ne s'affiche que porte ouverte, mais sa place est prise une fois pour toutes)
  const nomPorte = nom("porte");
  if (porte && table.passage && nomPorte) {
    const milieu = { x: porte.x - porte.ux * px(table.passage.profondeur) * 0.5, y: porte.y - porte.uy * px(table.passage.profondeur) * 0.5 };
    poser("porte", "porte", [nomPorte.toLocaleUpperCase()], disquesPorte, milieu, px(table.passage.profondeur) * 0.5 + 9, [{ x: porte.x, y: porte.y }, { x: porte.fleche.x, y: porte.fleche.y }], false);
  }
  return posees;
}

/** Au-dessus de l'arc : hors de la table. */
function masque(c: CanvasRenderingContext2D, couleur: string): void {
  c.save();
  c.beginPath();
  c.rect(0, 0, LARGEUR, 205);
  c.moveTo(20, 205);
  c.arc(196.25, 205, 176.25, Math.PI, 0, false);
  c.closePath();
  c.fillStyle = couleur;
  c.fill("evenodd");
  c.restore();
}

/** Le sol : tout ce qui ne bouge pas et se dessine à plat (bandes, zone des batteurs, nom du thème, flèches, lampes éteintes). Sur un canvas dont l'unité est le pixel de la table (375 × 760). */
export function dessinerSol(c: CanvasRenderingContext2D, d: DonneesSol): void {
  const { theme, table: t, titre, police } = d;
  const P = PALETTES[theme];
  if (theme === "foire") solFoire(c, titre, police);
  else if (theme === "ocean") solOcean(c, titre, police);
  else if (theme === "espace") solEspace(c, titre, police);
  else solVolcan(c, titre, police);
  // lot PBV1 : la lueur des bandes lumineuses sur le sol, le long des rails latéraux (un dégradé de la couleur du thème, du rail vers l'intérieur)
  for (const [x, y0, y1] of d.sansLueurBandes ? [] : BANDES) {
    const s = x < AXE ? 1 : -1;
    const g = c.createLinearGradient(x, 0, x + s * 18, 0);
    g.addColorStop(0, P.bande);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.save();
    c.globalAlpha = 0.32;
    c.fillStyle = g;
    c.fillRect(Math.min(x, x + s * 18), y0, 18, y1 - y0);
    c.restore();
  }
  // la zone des batteurs : un sol plus sombre, le danger est en bas
  c.beginPath();
  c.moveTo(20, 560);
  c.lineTo(118, 634);
  c.lineTo(AXE, 690);
  c.lineTo(2 * AXE - 118, 634);
  c.lineTo(348, 560);
  c.lineTo(348, HAUTEUR);
  c.lineTo(20, HAUTEUR);
  c.closePath();
  c.fillStyle = P.sombre ? "rgba(0,0,0,.28)" : theme === "volcan" ? "rgba(0,0,0,.22)" : "rgba(42,30,22,.09)";
  c.fill();
  c.fillStyle = "#1a120c";
  c.beginPath();
  c.ellipse(AXE, HAUTEUR - 4, 46, 20, 0, 0, TAU);
  c.fill();
  if (theme === "ocean") margesOcean(c);
  ombresDeContact(c, t, theme, d.occlusion ?? 1, d.vignettage ?? 1);
  if (!d.sansLueurBandes) lueursLampes(c, P.lampe);
  // le nom du thème est peint par le sol de chaque thème (la bannière, le nom blanc et sa vague, les lettres de néon, la gravure)
  // lot PBL1 : les flèches au sol, **éteintes et discrètes** : devant l'élément de la mission, le verrou, chaque bouche de rail et dans le passage de la porte (rien devant les autres modules) ; `indications.ts` allume celles qui comptent
  for (const f of flechesAuSol(t, theme)) flecheEteinte(c, P, f.x, f.y, f.a);
  // lot PBG3 : les lampes éteintes des couloirs de retour, le socle du poteau sauveur entre les batteurs, le pivot de l'aiguillage
  for (const l of t.sauveur.lampes) {
    c.beginPath();
    c.arc(px(l.x), px(l.y), 6, 0, TAU);
    c.fillStyle = P.sombre ? "rgba(255,246,224,.15)" : "rgba(255,255,255,.55)";
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = ENCRE;
    c.stroke();
  }
  c.beginPath();
  c.ellipse(px(t.sauveur.x), px(t.sauveur.y), 10, 8, 0, 0, TAU);
  c.fillStyle = "#1a120c";
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = ENCRE;
  c.stroke();
  const aiguillage = geoAiguillage(t);
  if (aiguillage) {
    c.beginPath();
    c.arc(aiguillage.x, aiguillage.y, 5, 0, TAU);
    c.fillStyle = "#1a120c";
    c.fill();
  }
  // les multiplicateurs, au-dessus du trou
  c.font = `700 10px ${police}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (let k = 2; k <= MULT_MAX; k++) {
    const x = AXE + (k - 4) * 26;
    c.beginPath();
    c.roundRect(x - 11, 590, 22, 16, 4);
    c.fillStyle = P.sombre ? "rgba(255,246,224,.12)" : "rgba(255,255,255,.5)";
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = ENCRE;
    c.stroke();
    c.fillStyle = ENCRE;
    c.fillText(`×${k}`, x, 598.5);
  }
  // les lampes des couloirs du haut, éteintes
  for (const v of t.voies) {
    c.beginPath();
    c.arc(px(v.x), px(v.y) + 24, 6, 0, TAU);
    c.fillStyle = P.sombre ? "rgba(255,246,224,.15)" : "rgba(255,255,255,.55)";
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = ENCRE;
    c.stroke();
  }
  masque(c, d.hors ?? ENCRE);
}

export interface Surimpression {
  /** Le pas de la simulation (le compteur de `?debug`). */
  tick: number;
  /** Les contours de collision, le compteur de pas et le score de chaque contact (`?debug`). */
  debug: boolean;
  /** Le fondu de « Bille sauvée ! » de 0 à 1 (1 : vient d'arriver). */
  sauvee: number;
  /** Le texte de « Bille sauvée ! » (déjà traduit). */
  texteSauvee: string;
  /** Les points marqués récemment (`?debug`) : où, combien, et leur vie restante de 0 à 1. */
  gains: readonly { x: number; y: number; points: number; vie: number; texte?: string }[];
  /** La part de pas écoulée depuis le dernier pas joué, de 0 à 1 (interpolation de la bille). */
  alpha: number;
  /** Lot PB3 : l'éclat de la mission réussie, de 0 à 1 (1 : vient d'être réussie) ; sur la table, un éclat doré (et, en three.js seulement, une brève secousse de caméra). */
  eclat: number;
  /** Lot PBG2 : l'éclat du départ de la multibille, de 1 (elle vient de partir) à 0 ; un éclat sur la table, comme `eclat` (et la secousse de caméra en three.js seulement). */
  multi: number;
  /** Lot PBG2 : un message court au milieu de la table (« MULTIBILLE ! », « VERROU ALLUMÉ », « BILLE VERROUILLÉE »…, déjà traduit), sa vie de 1 à 0 ; `null` : aucun. */
  message: { texte: string; vie: number } | null;
  /** Lot PBG2 : la secousse de caméra de 1 à 0 (three.js seulement, jamais avec le mouvement réduit : la scène donne 0). */
  secousse: number;
}

/** Lot PB5b : la zone du canvas où la table doit tenir en entier, en pixels CSS depuis son coin haut gauche — **entre les deux bandes du HUD en surimpression** (`hud.ts`), marges de sécurité comprises. Le canvas, lui, garde tout l'écran : le décor passe sous le HUD. */
export interface Libre {
  x: number;
  y: number;
  l: number;
  h: number;
}

export interface Rendu {
  /** La taille du canvas en pixels CSS, à chaque changement, et la zone libre où la table doit tenir (absente : tout le canvas). */
  redimensionner(largeur: number, hauteur: number, libre?: Libre): void;
  dessiner(s: Surimpression): void;
  /** Libère ce que le rendu tient (le rendu three.js : ses géométries, ses textures, son contexte WebGL). Absent du rendu à plat. */
  detruire?(): void;
}

export const px = (u: number): number => u / UNITE;

/** Crée le rendu à plat d'une partie. `nom(module)` : le nom du module sur la table (déjà traduit, ou null) ; `titre` : le nom du thème peint sur la table ; `police` : la famille du jeu. */
export function creerRendu(canvas: HTMLCanvasElement, partie: Partie, theme: ThemePinball, nom: (module: string) => string | null, titre: string, police: string): Rendu {
  const P = PALETTES[theme];
  const g = canvas.getContext("2d")!;
  const t = partie.table;
  let L = 1;
  let H = 1;
  let echelle = 1;
  let dpr = 1;
  let ox = 0;
  let oy = 0;
  let sol: HTMLCanvasElement | null = null;
  /** Lot PBG1 : les rails, cuits une fois à la taille de l'écran (leur ombre sur le sol, les rubans, les entonnoirs) : rien par image que la bille qui roule dessus. */
  let rails: HTMLCanvasElement | null = null;
  const modules = modulesAPlat(theme, partie);
  const decor = lampesDecor();
  const etiquettes = placerEtiquettes(t, theme, nom);
  const indications = creerIndications(partie, flechesAuSol(t, theme));

  const rond = (x: number, y: number, r: number, fill: string | null, trait = 3): void => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (trait) {
      g.lineWidth = trait;
      g.strokeStyle = ENCRE;
      g.stroke();
    }
  };
  const ombre = (f: () => void): void => {
    g.save();
    g.translate(3.5, 4.5);
    g.globalAlpha = 0.22;
    f();
    g.restore();
  };
  const styleDesPlaques = styleEtiquette(theme);
  /** Lot PBG2 : le trou-verrou (null : le plan n'en a pas). */
  const verrou = t.verrou >= 0 ? t.trous[t.verrou]! : null;
  const enMajuscules = (texte: string): string => texte.toLocaleUpperCase();
  function noms(c: CanvasRenderingContext2D, s: Surimpression): void {
    // lot PBL1 : trois plaques au plus, **collées à leur élément** (une pointe les y relie). La mission : son nom, « JACKPOT » pendant la multibille (allumée, qui clignote) ; le verrou : éteinte, puis allumée qui clignote ; la porte : seulement ouverte.
    const fort = clignote(s.tick);
    for (const e of etiquettes) {
      let texte = e.texte;
      const extra: ExtraPastille = { pointe: e.pointe, portee: e.portee, largeur: largeurPlaque(e.mots.reduce((a, b) => (largeurPlaque(b, styleDesPlaques) > largeurPlaque(a, styleDesPlaques) ? b : a)), styleDesPlaques) };
      if (e.role === "porte") {
        if (partie.passageOuvert <= 0 || partie.passageServi) continue;
        extra.largeur = undefined;
        if (fort) extra.allumee = COULEURS_INTENTION.mission;
      } else if (e.role === "verrou") {
        if (partie.verrouAllume) {
          if (fort) extra.allumee = COULEURS_INTENTION.verrou;
        } else extra.eteinte = true;
      } else if (partie.multibille) {
        texte = e.mots[1] ?? e.texte;
        if (fort) extra.allumee = COULEURS_INTENTION.jackpot;
      }
      pastille(c, police, e.x, e.y, texte, e.taille * 1.4, styleDesPlaques, extra);
    }
  }

  /** Lot PB3 : les éléments des thèmes, dessinés sous la bille, tous animés en fonction du seul pas (`tick`) ; puis les lampes de la mission. */
  function elements(tick: number): void {
    const C = COULEURS_ELEMENTS;
    const sec = tick / TICKS_PAR_SECONDE;
    for (const z of t.plateaux) {
      // le manège : un plateau de huit parts qui tourne contre les aiguilles, un moyeu bleu
      const x = px(z.x);
      const y = px(z.y);
      const r = px(z.r);
      ombre(() => rond(x, y, r, ENCRE, 0));
      rond(x, y, r, MOUTARDE, 3.5);
      g.save();
      g.translate(x, y);
      g.rotate(-sec * 1.6);
      for (let k = 0; k < 8; k++) {
        g.rotate(Math.PI / 4);
        g.fillStyle = k % 2 ? C.manegeA : PAPIER;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, r - 7, 0, Math.PI / 4);
        g.closePath();
        g.fill();
      }
      g.restore();
      rond(x, y, r - 7, null, 2.5);
      rond(x, y, 10, C.manegeHub, 3);
    }
    for (const z of t.tourbillons) {
      // le tourbillon : trois bras en spirale qui tournent
      const x = px(z.x);
      const y = px(z.y);
      const r = px(z.r);
      rond(x, y, r, C.tourbillon, 3.5);
      g.save();
      g.translate(x, y);
      g.rotate(sec * 4.8);
      g.strokeStyle = C.tourbillonBras;
      g.lineWidth = 4;
      for (let k = 0; k < 3; k++) {
        g.rotate(2.094);
        g.beginPath();
        for (let a = 0; a < 5; a += 0.2) g.lineTo(Math.cos(a) * (r - 5 - a * 9), Math.sin(a) * (r - 5 - a * 9));
        g.stroke();
      }
      g.restore();
      rond(x, y, 9, C.tourbillonCentre, 3);
    }
    for (const z of t.trousNoirs) {
      // le trou noir : des anneaux en pointillés qui tournent vers lui, un cœur sombre, un anneau d'or
      const x = px(z.x);
      const y = px(z.y);
      for (let k = 4; k >= 1; k--) {
        g.beginPath();
        g.arc(x, y, (px(z.r) * k) / 4, 0, TAU);
        g.strokeStyle = `rgba(${C.noirOnde},${0.22 + (4 - k) * 0.14})`;
        g.lineWidth = 2.5;
        g.setLineDash([6, 6]);
        g.lineDashOffset = -sec * 20 * k;
        g.stroke();
      }
      g.setLineDash([]);
      rond(x, y, 16, C.noirCentre, 3);
      g.beginPath();
      g.ellipse(x, y, 28, 8, -0.3, 0, TAU);
      g.strokeStyle = C.noirAnneau;
      g.lineWidth = 4;
      g.stroke();
    }
    t.geysers.forEach((z, i) => {
      // le geyser : un cratère, de la lave qui rougit quand il est prêt, un jet de bulles qui monte quand il part
      const x = px(z.x);
      const y = px(z.y);
      const prete = partie.geyserAttente[i]! <= 0;
      ombre(() => rond(x, y, px(z.r), ENCRE, 0));
      rond(x, y, px(z.r), C.geyser, 3.5);
      rond(x, y, px(z.r) - 8, prete ? C.lave : C.geyser, 2.5);
      const j = partie.geyserJet[i]! / JET_GEYSER;
      if (j > 0) for (let k = 0; k < 6; k++) rond(x + Math.sin(sec * 20 + k) * 8, y - 18 - k * 16 * (1 - j * 0.5), 8 - k, PAPIER, 2);
    });
    for (const z of t.coulees) {
      // la coulée : un couloir de lave dont les chevrons montent
      const x = px(z.x);
      const y = px(z.y);
      const l = px(z.l);
      const h = px(z.h) * 2;
      g.fillStyle = C.lave;
      g.fillRect(x - l, y - h / 2, l * 2, h);
      g.strokeStyle = C.chevron;
      g.lineWidth = 4;
      for (let k = 0; k < 4; k++) {
        const yy = y + h / 2 - ((sec * 60 + k * 24) % h);
        g.beginPath();
        g.moveTo(x - 9, yy + 7);
        g.lineTo(x, yy);
        g.lineTo(x + 9, yy + 7);
        g.stroke();
      }
    }
    // les lampes de la mission, autour de l'élément du thème : une allumée par pas de réussi
    lampesMission(t, theme, partie.but).forEach((l, i) => rond(l.x, l.y, 5.5, i < partie.compteur ? MOUTARDE : P.sombre ? "#3a3d66" : PAPIER, 2));
  }
  /** Les portails et les flèches qui clignotent, par-dessus les trous. */
  function portailsEtFleches(tick: number): void {
    const C = COULEURS_ELEMENTS;
    const sec = tick / TICKS_PAR_SECONDE;
    for (const p of t.portails) {
      const x = px(p.x);
      const y = px(p.y);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x, y, px(p.r) + 5 + k * 5 + Math.sin(sec * 4 + k) * 1.5, 0, TAU);
        g.strokeStyle = k % 2 ? C.portailB : C.portailA;
        g.lineWidth = 3.5;
        g.stroke();
      }
      rond(x, y, px(p.r), C.portailFond, 2.5);
      g.fillStyle = PAPIER;
      g.font = `700 12px ${police}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(p.id === 0 ? "A" : "B", x, y + 1);
    }
    // lot PBL1 : les flèches au sol qui disent quoi viser maintenant — trois au plus, dans la couleur de leur intention, qui clignotent ; les autres restent éteintes (peintes dans le sol)
    const allumees = indications.maj(); // à chaque image : le suivi du dernier rail réussi ne saute aucun pas
    if (clignote(tick)) for (const a of allumees) flecheVive(g, P, a.fleche.x, a.fleche.y, a.fleche.a, COULEURS_INTENTION[a.intention]);
  }

  /** Lot PBG2 : les billes à l'image — celles de la table (la principale, si elle n'est pas absente, puis `partie.autres`), chacune à sa place interpolée, à sa hauteur au-dessus du plateau (px : celle du rail sur lequel elle roule)
   *  et à son grossissement. Une bille gardée par un trou ou un tourbillon n'est pas à voir. Les objets sont réutilisés d'une image à l'autre (rien n'est alloué par image). */
  const billes: { x: number; y: number; h: number; k: number }[] = [];
  let nbBilles = 0;
  function ajouterBille(ax: number, ay: number, x: number, y: number, couche: number, rang: number, s: number, alpha: number): void {
    const rail = couche === 1 ? t.rails[rang] : undefined;
    // lot PBG3 : la bille dérivée par l'aiguillage (`rang` < 0) vole à 30 px au-dessus de la table
    const h = rail ? hauteurRail(rail, s) : couche === 1 ? 30 : 0;
    const b = (billes[nbBilles] ??= { x: 0, y: 0, h: 0, k: 1 });
    nbBilles++;
    b.x = px(ax) + (px(x) - px(ax)) * alpha;
    b.y = px(ay) + (px(y) - px(ay)) * alpha;
    b.h = h;
    b.k = 1 + h / 160;
  }
  function billesDeLImage(alpha: number): void {
    nbBilles = 0;
    if (partie.finie) return;
    if (!partie.vide && partie.captif === 0) ajouterBille(partie.px, partie.py, partie.x, partie.y, partie.couche, partie.rail, partie.railS, alpha);
    for (const b of partie.autres) if (b.captif === 0) ajouterBille(b.px, b.py, b.x, b.y, b.couche, b.rail, b.railS, alpha);
  }
  /** L'ombre de la bille sur le plateau : décalée d'autant plus qu'elle est haute (la lumière vient du haut gauche). */
  function ombreBille(b: { x: number; y: number; h: number }): void {
    g.fillStyle = "rgba(0,0,0,.28)";
    g.beginPath();
    g.ellipse(b.x + 3.5 + b.h * 0.22, b.y + 5 + b.h * 0.32, RAYON, RAYON * 0.8, 0, 0, TAU);
    g.fill();
  }
  /** Un batteur (le grand ou le mini) : de son pivot (x0, y0) à sa pointe (x1, y1). */
  function batteur(x0: number, y0: number, x1: number, y1: number): void {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const forme = (): void => {
      g.beginPath();
      g.moveTo(x0 + nx * 9, y0 + ny * 9);
      g.lineTo(x1 + nx * 5.5, y1 + ny * 5.5);
      g.arc(x1, y1, 5.5, a + Math.PI / 2, a - Math.PI / 2, true);
      g.lineTo(x0 - nx * 9, y0 - ny * 9);
      g.arc(x0, y0, 9, a - Math.PI / 2, a + Math.PI / 2, true);
      g.closePath();
    };
    ombre(() => {
      forme();
      g.fillStyle = ENCRE;
      g.fill();
    });
    forme();
    g.fillStyle = P.sombre ? MOUTARDE : PAPIER;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = ENCRE;
    g.stroke();
    rond(x0, y0, 4, P.bumper, 2);
  }

  /** Lot PBG2 : l'élément du thème (ce qui rapporte un jackpot pendant la multibille) : ses disques sur la table. */
  const elementsDuTheme: { x: number; y: number; r: number }[] = [];
  for (const [type, liste] of [["manege", t.plateaux], ["tourbillon", t.tourbillons], ["portailA", t.portails], ["geyser", t.geysers]] as const) {
    if (comptePourLaMission(theme, type)) for (const z of liste) elementsDuTheme.push({ x: px(z.x), y: px(z.y), r: px(z.r) });
  }
  /** Un halo qui clignote autour d'un disque : `fort` allumé (le clignotement des flèches, `clignote`), sinon une trace pour qu'on le retrouve. Deux anneaux, aucune ombre portée : rien de coûteux. */
  function halo(x: number, y: number, r: number, fort: boolean, couleur: string, remplir: boolean): void {
    if (remplir) {
      g.globalAlpha = fort ? 0.4 : 0.1;
      rond(x, y, r, couleur, 0);
    }
    g.strokeStyle = couleur;
    g.globalAlpha = fort ? 0.95 : 0.3;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, r + 4, 0, TAU);
    g.stroke();
    g.globalAlpha = fort ? 0.4 : 0.1;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(x, y, r + 10, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }
  /** Lot PBG2 : le trou-verrou clignote tant qu'il est allumé ; l'élément du thème clignote pendant la multibille (le jackpot). */
  /** Lot PBG3 : la porte, le poteau sauveur et l'aiguillage, à plat. Tout est fonction du pas (`deblocages.ts`, commun aux deux rendus) ; la lame de l'aiguillage se tourne de 0,06 rad par pas vers son angle visé. */
  const porte = geoPorte(t);
  const aiguillage = geoAiguillage(t);
  let lame = aiguillage?.defaut ?? 0;
  let tickLame = 0;
  function deblocages(tick: number): void {
    const fort = clignote(tick);
    // la porte : le battant pivote contre le mur quand elle s'ouvre ; ouverte, le passage s'éclaire (une flèche moutarde qui clignote)
    if (porte) {
      const k = ouverturePorte(partie);
      const b = boutLibre(porte, k);
      g.lineCap = "round";
      for (const [couleur, largeur] of [[ENCRE, 8], [k > 0 ? MOUTARDE : "#C0452F", 4.5]] as const) {
        g.beginPath();
        g.moveTo(porte.a.x, porte.a.y);
        g.lineTo(b.x, b.y);
        g.strokeStyle = couleur;
        g.lineWidth = largeur;
        g.stroke();
      }
      rond(porte.a.x, porte.a.y, 4, "#AEB4BC", 2);
    }
    // les lampes des couloirs de retour et le poteau : sorti, un plot d'acier cerné d'une lueur qui clignote quand il est armé
    t.sauveur.lampes.forEach((l, i) => {
      if (partie.lampes[i]) rond(px(l.x), px(l.y), 6, MOUTARDE, 2);
    });
    const sortie = sortiePoteau(partie);
    if (sortie > 0) {
      const x = px(t.sauveur.x);
      const y = px(t.sauveur.y);
      const r = px(t.sauveur.r) * (0.4 + 0.6 * sortie);
      if (partie.sauveurArme && fort) {
        g.globalAlpha = 0.55;
        rond(x, y, r + 6, null, 4);
        g.globalAlpha = 1;
      }
      ombre(() => rond(x, y, r + 1, ENCRE, 0));
      rond(x, y, r + 1, "#AEB4BC", 2.5);
      rond(x - 1, y - 1, r * 0.45, partie.sauveurArme ? MOUTARDE : "#E9ECEF", 0);
    }
    // l'aiguillage : la lame bascule vers ce qu'il mène, et la flèche de sa rampe prend la couleur du trajet
    if (aiguillage) {
      const vers = partie.aiguillageVers;
      lame = rapprocher(lame, angleVise(aiguillage, vers), 0.06 * Math.max(1, Math.min(30, tick - tickLame)));
      tickLame = tick;
      const couleur = couleurAiguillage(vers);
      const l = 11;
      g.lineCap = "round";
      for (const [c2, largeur] of [[ENCRE, 8], [couleur ?? PAPIER, 4.5]] as const) {
        g.beginPath();
        g.moveTo(aiguillage.x - Math.cos(lame) * l, aiguillage.y - Math.sin(lame) * l);
        g.lineTo(aiguillage.x + Math.cos(lame) * l, aiguillage.y + Math.sin(lame) * l);
        g.strokeStyle = c2;
        g.lineWidth = largeur;
        g.stroke();
      }
      rond(aiguillage.x, aiguillage.y, 3.5, "#AEB4BC", 1.5);
    }
  }
  function halos(tick: number): void {
    const fort = clignote(tick);
    if (verrou && partie.verrouAllume) halo(px(verrou.x), px(verrou.y), px(verrou.r), fort, COULEURS_INTENTION.verrou, true);
    if (partie.multibille) for (const z of elementsDuTheme) halo(z.x, z.y, z.r, fort, COULEURS_INTENTION.jackpot, false);
  }
  /** Lot PBG2 : les billes verrouillées (0 à 2), au fond du trou-verrou : de petites billes d'acier côte à côte. Elles disparaissent quand le trou les lâche. */
  function billesVerrouillees(): void {
    const n = partie.verrouillees;
    if (!verrou || n <= 0) return;
    const x = px(verrou.x);
    const y = px(verrou.y);
    for (let k = 0; k < n; k++) {
      const bx = n === 1 ? x : x + (k === 0 ? -5.6 : 5.6);
      rond(bx, y, 5.2, "#C9CED6", 1.6);
      g.beginPath();
      g.arc(bx - 1.5, y - 1.8, 1.7, 0, TAU);
      g.fillStyle = "#fff";
      g.fill();
    }
  }
  /** Lot PBG2 : un message court au milieu de la table, en fondu (« MULTIBILLE ! »…) : grand, mais jamais plus large que la table. */
  function message(m: { texte: string; vie: number }): void {
    const texte = enMajuscules(m.texte);
    const k = Math.min(2.3, 292 / largeurPlaque(texte, "encre"));
    g.globalAlpha = Math.min(1, m.vie * 2.5);
    pastille(g, police, AXE, 296 - (1 - m.vie) * 22, texte, k);
    g.globalAlpha = 1;
  }
  /** Lot PBG2 : un gain qui a un texte (« JACKPOT +7 500 ») : toujours dessiné, il flotte vers le haut en s'effaçant, au point de la prise ; le texte reste dans la table. */
  function gainAvecTexte(gain: { x: number; y: number; vie: number; texte?: string }): void {
    const texte = gain.texte!;
    const demi = (largeurTexte(texte) * 1.5) / 2 + 4;
    const x = Math.min(344 - demi, Math.max(24 + demi, px(gain.x)));
    g.globalAlpha = Math.min(1, gain.vie * 2.5);
    g.font = `800 15px ${police}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = 4.5;
    g.strokeStyle = ENCRE;
    const y = px(gain.y) - 18 - (1 - gain.vie) * 46;
    g.strokeText(texte, x, y);
    g.fillStyle = MOUTARDE;
    g.fillText(texte, x, y);
    g.globalAlpha = 1;
  }

  function redimensionner(largeur: number, hauteur: number, libre?: Libre): void {
    L = Math.max(1, Math.floor(largeur));
    H = Math.max(1, Math.floor(hauteur));
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.floor(L * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${L}px`;
    canvas.style.height = `${H}px`;
    // lot PB5b : la table tient, centrée, dans la zone libre (entre les bandes du HUD) ; sans zone, dans tout le canvas
    const z = libre ?? { x: 0, y: 0, l: L, h: H };
    echelle = Math.max(0.01, Math.min(z.l / LARGEUR, z.h / HAUTEUR));
    ox = z.x + (z.l - LARGEUR * echelle) / 2;
    oy = z.y + (z.h - HAUTEUR * echelle) / 2;
    const o = document.createElement("canvas");
    o.width = Math.ceil(LARGEUR * echelle * dpr);
    o.height = Math.ceil(HAUTEUR * echelle * dpr);
    const oc = o.getContext("2d")!;
    oc.setTransform(o.width / LARGEUR, 0, 0, o.height / HAUTEUR, 0, 0);
    // lot PBV3 : sans lumière, le sol à plat garde un vignettage plus léger (la haute qualité a en plus la lumière du soleil au centre) ; l'étalonnage chaud de la haute qualité y est cuit une fois (rien par image)
    dessinerSol(oc, { theme, table: t, titre, police, vignettage: 0.6 });
    etalonner(oc, o.width, o.height, 1, 1.15, 1.08);
    sol = o;
    // lot PBG1 : les rails, à la même échelle que le sol, sur un fond transparent
    if (t.rails.length > 0) {
      const r = document.createElement("canvas");
      r.width = o.width;
      r.height = o.height;
      const rc = r.getContext("2d")!;
      rc.setTransform(r.width / LARGEUR, 0, 0, r.height / HAUTEUR, 0, 0);
      dessinerRails(rc, t, theme);
      rails = r;
    } else rails = null;
  }

  function dessiner(s: Surimpression): void {
    if (!sol) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = ENCRE;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(sol, Math.round(ox * dpr), Math.round(oy * dpr), Math.round(LARGEUR * echelle * dpr), Math.round(HAUTEUR * echelle * dpr));
    g.setTransform(echelle * dpr, 0, 0, echelle * dpr, ox * dpr, oy * dpr);
    g.save();
    g.beginPath();
    g.rect(0, 0, LARGEUR, HAUTEUR);
    g.clip();
    // les lampes allumées : les multiplicateurs atteints, les couloirs du haut
    g.font = `700 10px ${police}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let k = 2; k <= partie.mult && k <= MULT_MAX; k++) {
      const x = AXE + (k - 4) * 26;
      g.beginPath();
      g.roundRect(x - 11, 590, 22, 16, 4);
      g.fillStyle = MOUTARDE;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = ENCRE;
      g.stroke();
      g.fillStyle = ENCRE;
      g.fillText(`×${k}`, x, 598.5);
    }
    t.voies.forEach((v, i) => {
      if (partie.voiesAllumees[i]) rond(px(v.x), px(v.y) + 24, 6, MOUTARDE, 2);
    });
    elements(s.tick);
    modules.trous(g, s.tick); // lot PBV4 : les trous du thème (`modeles/plat.ts`)
    portailsEtFleches(s.tick);
    halos(s.tick); // lot PBG2 : le verrou allumé et l'élément du thème en jackpot clignotent
    // les murs : des rails, avec leur ombre
    g.lineCap = "round";
    const tracer = (couleur: string, largeur: number, filtre: (i: number) => boolean = () => true): void => {
      t.murs.forEach((m, i) => {
        if (m.type === 2 || !filtre(i)) return;
        g.beginPath();
        g.moveTo(px(m.ax), px(m.ay));
        g.lineTo(px(m.bx), px(m.by));
        g.strokeStyle = couleur;
        g.lineWidth = largeur;
        g.stroke();
      });
    };
    ombre(() => tracer(ENCRE, 8));
    tracer(ENCRE, 7);
    tracer(P.sombre ? "#6a6f9a" : "#8a6a52", 2);
    // lot PBV1 : les bandes lumineuses sur les rails latéraux, dans la couleur du thème (une lueur, puis le tube)
    for (const [x, y0, y1] of BANDES) {
      for (const [l, a] of [[4, 0.35], [2.4, 1]] as const) {
        g.globalAlpha = a;
        g.beginPath();
        g.moveTo(x, y0);
        g.lineTo(x, y1);
        g.strokeStyle = P.bande;
        g.lineWidth = l;
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    // les poteaux, en métal brossé
    for (const p of t.poteaux) {
      ombre(() => rond(px(p.x), px(p.y), px(p.r) + 1, ENCRE, 0));
      rond(px(p.x), px(p.y), px(p.r) + 1, "#AEB4BC", 2.5);
      rond(px(p.x) - 1, px(p.y) - 1, px(p.r) * 0.45, "#E9ECEF", 0);
    }
    // les lance-pierres, avec leur caoutchouc
    for (const sens of [1, -1]) {
      const x = (v: number): number => (sens > 0 ? v : 2 * AXE - v);
      const eclat = partie.chocSling[sens > 0 ? 0 : 1]! / 40;
      const tri = (): void => {
        g.beginPath();
        g.moveTo(x(42), 468);
        g.lineTo(x(42), 546);
        g.lineTo(x(92), 574);
        g.closePath();
      };
      ombre(() => {
        tri();
        g.fillStyle = ENCRE;
        g.fill();
      });
      tri();
      g.fillStyle = P.sling;
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = ENCRE;
      g.stroke();
      g.beginPath();
      g.moveTo(x(44), 472);
      g.lineTo(x(89), 568);
      g.strokeStyle = eclat > 0 ? MOUTARDE : PAPIER;
      g.lineWidth = 5;
      g.stroke();
    }
    // lot PBV1 : les petites lampes du décor, allumées (une vague court le long de l'arc)
    decor.forEach((l, i) => {
      g.globalAlpha = lueurLampe(i, s.tick);
      rond(l.x, l.y, 3.2, P.lampe, 1.2);
    });
    g.globalAlpha = 1;
    modules.dessus(g); // lot PBV4 : les spinners, les cibles et les bumpers du thème (`modeles/plat.ts`)
    deblocages(s.tick); // lot PBG3 : la porte, le poteau sauveur et l'aiguillage
    // lot PBG1 : les rails passent par-dessus le sol et les modules ; la bille qui roule dessus a son ombre portée sur le plateau, sous eux
    billesDeLImage(s.alpha);
    for (let i = 0; i < nbBilles; i++) if (billes[i]!.h > 0) ombreBille(billes[i]!);
    if (rails) g.drawImage(rails, 0, 0, LARGEUR, HAUTEUR);
    noms(g, s);
    // les batteurs : corps clair, caoutchouc d'encre ; lot PBG1 : le mini-batteur, plus court, suit l'angle du batteur du même côté
    for (const i of [GAUCHE, DROITE]) {
      const { px: bx, py: by, tx, ty } = pointeDuBatteur(i, partie.a[i]!);
      batteur(px(bx), px(by), px(tx), px(ty));
    }
    if (t.mini) {
      const { px: bx, py: by, tx, ty } = pointeDuBatteur(t.mini.cote, partie.a[t.mini.cote]!);
      const d = Math.hypot(tx - bx, ty - by);
      const x0 = px(t.mini.cote === GAUCHE ? t.mini.x : 2 * AXE * UNITE - t.mini.x);
      const y0 = px(t.mini.y);
      const lg = px(t.mini.longueur);
      batteur(x0, y0, x0 + ((tx - bx) / d) * lg, y0 + ((ty - by) / d) * lg);
    }
    // le lanceur : le ressort se comprime avec la charge
    const ressort = 709 + (partie.charge * 22) / 1000;
    g.fillStyle = P.sombre ? "#3a3d66" : "rgba(42,30,22,.3)";
    g.fillRect(351, ressort, 19, 718 - ressort);
    g.strokeStyle = ENCRE;
    g.lineWidth = 2;
    for (let y = ressort + 3; y < 716; y += 4) {
      g.beginPath();
      g.moveTo(353, y);
      g.lineTo(368, y);
      g.stroke();
    }
    // les billes verrouillées dans le trou-verrou (lot PBG2) : de petites billes d'acier au fond du trou, sous les billes qui roulent
    if (verrou) billesVerrouillees();
    // les billes : chrome, avec leur ombre (cachée quand un trou les garde) ; lot PBG1 : posée sur un rail, une bille est dessinée par-dessus les rails et les modules, un peu plus grande, son ombre décalée sur le plateau ; lot PBG2 : toutes les billes de la table
    for (let i = 0; i < nbBilles; i++) {
      const bille = billes[i]!;
      if (bille.h === 0) ombreBille(bille);
      g.save();
      g.translate(bille.x, bille.y);
      g.scale(bille.k, bille.k);
      rond(0, 0, RAYON, "#C9CED6", 2);
      g.beginPath();
      g.arc(0, 0, RAYON - 1, 0.2, Math.PI - 0.2);
      g.fillStyle = "#9AA1AC";
      g.fill();
      g.beginPath();
      g.arc(-3, -3.5, 3.2, 0, TAU);
      g.fillStyle = "#fff";
      g.fill();
      g.restore();
    }
    masque(g, ENCRE);
    if (s.eclat > 0) {
      // la mission réussie : un éclat doré sur toute la table
      g.fillStyle = `rgba(232,178,58,${s.eclat * 0.42})`;
      g.fillRect(0, 0, LARGEUR, HAUTEUR);
    }
    if (s.multi > 0) {
      // lot PBG2 : le départ de la multibille : un éclat clair sur toute la table (sans secousse : celle-ci est réservée au rendu three.js) et une onde qui part du trou-verrou
      g.fillStyle = `rgba(150,230,255,${s.multi * 0.4})`;
      g.fillRect(0, 0, LARGEUR, HAUTEUR);
      if (verrou) {
        g.beginPath();
        g.arc(px(verrou.x), px(verrou.y), 10 + (1 - s.multi) * 240, 0, TAU);
        g.strokeStyle = MOUTARDE;
        g.globalAlpha = s.multi;
        g.lineWidth = 6;
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    if (s.sauvee > 0) {
      g.globalAlpha = Math.min(1, s.sauvee * 2);
      pastille(g, police, AXE, 520 - (1 - s.sauvee) * 16, s.texteSauvee.toLocaleUpperCase());
      g.globalAlpha = 1;
    }
    if (s.message && s.message.vie > 0) message(s.message);
    for (const gain of s.gains) if (gain.texte) gainAvecTexte(gain);
    if (s.debug) debogage(s);
    g.restore();
  }

  /** `?debug` : les contours de collision (murs, cercles, capsules des batteurs, rayon de la bille), le compteur de pas et le score de chaque contact. */
  function debogage(s: Surimpression): void {
    g.lineWidth = 1;
    g.strokeStyle = "#FF00AA";
    g.lineCap = "butt";
    for (const m of t.murs) {
      g.beginPath();
      g.moveTo(px(m.ax), px(m.ay));
      g.lineTo(px(m.bx), px(m.by));
      g.stroke();
    }
    g.strokeStyle = "#00D0FF";
    for (const c of [...t.poteaux, ...t.bumpers]) {
      g.beginPath();
      g.arc(px(c.x), px(c.y), px(c.r), 0, TAU);
      g.stroke();
    }
    for (const tr of t.trous) {
      g.beginPath();
      g.arc(px(tr.x), px(tr.y), px(tr.r), 0, TAU);
      g.stroke();
    }
    for (const z of [...t.plateaux, ...t.tourbillons, ...t.trousNoirs, ...t.geysers, ...t.portails]) {
      g.beginPath();
      g.arc(px(z.x), px(z.y), px(z.r), 0, TAU);
      g.stroke();
    }
    for (const c of t.coulees) g.strokeRect(px(c.x) - px(c.l), px(c.y) - px(c.h), px(c.l) * 2, px(c.h) * 2);
    for (const c of t.spinners) {
      g.strokeRect(px(c.x) - px(c.l), px(c.y) - 1, px(c.l) * 2, 2);
    }
    // lot PBG1 : le tracé de chaque rail, sa bouche (le mur que la bille lente rencontre) et le mini-batteur
    g.strokeStyle = "#FF9900";
    for (const rail of t.rails) {
      g.beginPath();
      rail.x.forEach((x, i) => (i ? g.lineTo(px(x), px(rail.y[i]!)) : g.moveTo(px(x), px(rail.y[i]!))));
      g.stroke();
    }
    for (const gg of t.portes) {
      g.beginPath();
      g.moveTo(px(gg.seg.ax), px(gg.seg.ay));
      g.lineTo(px(gg.seg.bx), px(gg.seg.by));
      g.stroke();
    }
    g.strokeStyle = "#00FF66";
    if (t.mini) {
      const { px: bx, py: by, tx, ty } = pointeDuBatteur(t.mini.cote, partie.a[t.mini.cote]!);
      const d = Math.hypot(tx - bx, ty - by);
      const x0 = px(t.mini.cote === GAUCHE ? t.mini.x : 2 * AXE * UNITE - t.mini.x);
      const y0 = px(t.mini.y);
      const lg = px(t.mini.longueur);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + ((tx - bx) / d) * lg, y0 + ((ty - by) / d) * lg);
      g.stroke();
    }
    for (const i of [GAUCHE, DROITE]) {
      const { px: bx, py: by, tx, ty } = pointeDuBatteur(i, partie.a[i]!);
      for (const [x, y, r] of [[px(bx), px(by), 8], [px(tx), px(ty), 5]] as const) {
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(px(bx), px(by));
      g.lineTo(px(tx), px(ty));
      g.stroke();
    }
    g.strokeStyle = "#FFFF00";
    for (const b of partie.billesDeLaTable()) {
      g.beginPath();
      g.arc(px(b.x), px(b.y), RAYON, 0, TAU);
      g.stroke();
    }
    g.font = `700 11px ${police}`;
    g.textAlign = "left";
    g.fillStyle = "#FFFF00";
    g.fillText(`pas ${s.tick}`, 26, 222);
    g.textAlign = "center";
    for (const gain of s.gains) {
      if (gain.texte) continue; // dessiné par `gainAvecTexte`, toujours
      g.globalAlpha = gain.vie;
      g.fillStyle = "#FFFFFF";
      g.fillText(`+${gain.points}`, px(gain.x), px(gain.y) - 14 - (1 - gain.vie) * 18);
    }
    g.globalAlpha = 1;
  }

  return { redimensionner, dessiner };
}
