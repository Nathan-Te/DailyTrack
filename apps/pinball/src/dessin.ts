import { AXE, DROITE, GAUCHE, HAUTEUR, JET_GEYSER, LARGEUR, MISSION_DU_THEME, MODULES_DE_MISSION, MULT_MAX, RAYON, TICKS_PAR_SECONDE, UNITE, pointeDuBatteur, type Mission, type Partie, type Table, type ThemePinball } from "@cdj/pinball-sim";

// Le rendu À PLAT de « Pinball » (lot PB1) : le dessin « Canvas+ » de la maquette (`docs/pinball/maquettes/pinball-maquette-jouable.html`) — rails avec leur ombre, bumpers à jupe et à yeux, cibles debout, lance-pierres à
// caoutchouc, batteurs, flèches de tir devant chaque module, nom de chaque module, lampes des couloirs et des multiplicateurs. **Écrit pour être gardé comme rendu de secours** (qualité minimale, petits écrans) quand le
// rendu three.js du lot PB2 arrivera : il ne connaît que la partie (`Partie`, en lecture) et un canvas ; aucune entrée, aucun DOM autre que le canvas. Les couleurs sont celles de la maquette (palettes des quatre thèmes) :
// elles passeront aux jetons avec le rendu définitif.
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
}
export const PALETTES: Readonly<Record<ThemePinball, Palette>> = {
  foire: { fond: "#F4D9A0", fond2: "#EFCB86", bumper: "#C2401F", accent: "#3E7CC4", cible: "#E8B23A", sling: "#3E7CC4", sombre: false },
  ocean: { fond: "#BFE3E6", fond2: "#AED8DC", bumper: "#F08A6C", accent: "#2E6E8E", cible: "#F2C94C", sling: "#2E6E8E", sombre: false },
  espace: { fond: "#26294A", fond2: "#2E3258", bumper: "#E46FA0", accent: "#5FD3E8", cible: "#E8B23A", sling: "#5FD3E8", sombre: true },
  volcan: { fond: "#E8C6A8", fond2: "#E0B796", bumper: "#C2401F", accent: "#5A3A22", cible: "#4A4A52", sling: "#E8B23A", sombre: false },
};
/** Le rayon d'un module (px) : la distance où se pose sa flèche et son nom. */
export const RAYON_MODULE: Readonly<Record<string, number>> = { bumpers: 50, mini: 30, cibles: 26, spinner: 40, trou: 22, manege: 60, tourbillon: 64, trouNoir: 26, portailA: 28, portailB: 28, asteroide: 34, geyser: 30, coulee: 56 };
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
export const COULEURS_ELEMENTS = { manegeA: "#C2401F", manegeHub: "#3E7CC4", tourbillon: "#7FC6D2", tourbillonBras: "#2E6E8E", tourbillonCentre: "#16384a", noirCentre: "#0b0918", noirAnneau: "#E8B23A", noirOnde: "167,155,255", portailA: "#5FD3E8", portailB: "#E46FA0", portailFond: "#120f24", geyser: "#5A3A22", lave: "#F2894B", chevron: "#FFE08A" } as const;

/** Ce qu'il faut savoir d'une partie pour dessiner son sol : le thème (palette), la table (les modules posés, les couloirs du haut), le nom du thème peint sur la table et la police du jeu. */
export interface DonneesSol {
  theme: ThemePinball;
  table: Table;
  titre: string;
  police: string;
  /** Hors de la table (au-dessus de l'arc) : l'encre pour le rendu à plat ; le bois de la caisse pour le rendu three.js. */
  hors?: string;
}

/** Une flèche de tir, à `(x, y)`, tournée de `a`. */
function fleche(c: CanvasRenderingContext2D, P: Palette, x: number, y: number, a: number, allumee?: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.beginPath();
  c.moveTo(13, 0);
  c.lineTo(-7, -11);
  c.lineTo(-3, 0);
  c.lineTo(-7, 11);
  c.closePath();
  c.fillStyle = allumee ?? (P.sombre ? "rgba(255,246,224,.14)" : "rgba(255,255,255,.55)");
  c.fill();
  c.lineWidth = 2.5;
  c.strokeStyle = ENCRE;
  c.stroke();
  c.restore();
}

/** Une pastille de texte (le nom d'un module, « Bille sauvée ! ») : `echelle` la grossit autour de son centre, pour les étiquettes du haut que la perspective rapetisse (lot PB2). */
export function pastille(c: CanvasRenderingContext2D, police: string, x: number, y: number, texte: string, echelle = 1): void {
  c.save();
  c.translate(x, y);
  c.scale(echelle, echelle);
  c.font = `700 9px ${police}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  const w = c.measureText(texte).width + 10;
  c.fillStyle = ENCRE;
  c.beginPath();
  c.roundRect(-w / 2, -7, w, 14, 3);
  c.fill();
  c.fillStyle = PAPIER;
  c.fillText(texte, 0, 0.5);
  c.restore();
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

/** Où se pose le nom d'un module sur la table (px) : au-dessous de lui, sans jamais passer sous les lance-pierres. */
export function placeDuNom(m: { type: string; x: number; y: number }): { x: number; y: number } {
  const r = RAYON_MODULE[m.type] ?? 30;
  // l'astéroïde va et vient au-dessus d'un petit bumper : son nom se pose au-dessus de lui ; les autres, au-dessous
  const y = m.type === "asteroide" ? px(m.y) - r - 4 : m.type === "cibles" ? px(m.y) + 22 : px(m.y) + r * (m.type === "bumpers" ? 0.95 : 0.9) + 4;
  return { x: px(m.x), y: Math.min(y, 470) };
}

/** Le sol : tout ce qui ne bouge pas et se dessine à plat (bandes, zone des batteurs, nom du thème, flèches, lampes éteintes). Sur un canvas dont l'unité est le pixel de la table (375 × 760). */
export function dessinerSol(c: CanvasRenderingContext2D, d: DonneesSol): void {
  const { theme, table: t, titre, police } = d;
  const P = PALETTES[theme];
  c.fillStyle = P.fond;
  c.fillRect(0, 0, LARGEUR, HAUTEUR);
  c.save();
  c.globalAlpha = 0.45;
  c.strokeStyle = P.fond2;
  c.lineWidth = 14;
  for (let k = -HAUTEUR; k < LARGEUR + HAUTEUR; k += 36) {
    c.beginPath();
    c.moveTo(k, 0);
    c.lineTo(k - HAUTEUR, HAUTEUR);
    c.stroke();
  }
  c.restore();
  if (theme === "espace") {
    c.fillStyle = "#EDE3CF";
    let a = 12345; // des étoiles qui ne bougent pas : un petit générateur entier, jamais Math.random
    for (let i = 0; i < 70; i++) {
      a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
      const x = (a >>> 8) % LARGEUR;
      a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
      c.globalAlpha = 0.25 + ((a >>> 8) % 50) / 100;
      c.fillRect(x, (a >>> 4) % HAUTEUR, 1.6, 1.6);
    }
    c.globalAlpha = 1;
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
  c.fillStyle = P.sombre ? "rgba(0,0,0,.28)" : "rgba(42,30,22,.09)";
  c.fill();
  c.fillStyle = "#1a120c";
  c.beginPath();
  c.ellipse(AXE, HAUTEUR - 4, 46, 20, 0, 0, TAU);
  c.fill();
  // le nom du thème, peint sur la table
  c.save();
  c.translate(AXE, 512);
  c.rotate(-0.06);
  c.font = `700 28px ${police}`;
  c.textAlign = "center";
  c.fillStyle = P.sombre ? "rgba(255,246,224,.12)" : "rgba(42,30,22,.10)";
  c.fillText(titre.toLocaleUpperCase(), 0, 0);
  c.restore();
  // une flèche de tir devant chaque module (sauf le trou noir, qui n'est pas une cible), qui pointe vers lui depuis les batteurs
  for (const m of t.poses) {
    if (m.type === "trouNoir") continue;
    const f = flecheDe(m);
    fleche(c, P, f.x, f.y, f.a);
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
  gains: readonly { x: number; y: number; points: number; vie: number }[];
  /** La part de pas écoulée depuis le dernier pas joué, de 0 à 1 (interpolation de la bille). */
  alpha: number;
  /** Lot PB3 : l'éclat de la mission réussie, de 0 à 1 (1 : vient d'être réussie) ; sur la table, un éclat doré (et, en three.js seulement, une brève secousse de caméra). */
  eclat: number;
}

export interface Rendu {
  /** La taille du canvas en pixels CSS, à chaque changement. */
  redimensionner(largeur: number, hauteur: number): void;
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
  const angles = t.spinners.map(() => 0);

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
  const yeux = (x: number, y: number, r: number): void => {
    const dx = px(partie.x) - x;
    const dy = px(partie.y) - y;
    const d = Math.hypot(dx, dy) || 1;
    const ex = (dx / d) * r * 0.08;
    const ey = (dy / d) * r * 0.08;
    for (const s of [-1, 1]) {
      rond(x + s * r * 0.3, y - r * 0.1, r * 0.22, PAPIER, 1.5);
      g.beginPath();
      g.arc(x + s * r * 0.3 + ex, y - r * 0.1 + ey, r * 0.11, 0, TAU);
      g.fillStyle = ENCRE;
      g.fill();
    }
  };
  function noms(c: CanvasRenderingContext2D): void {
    for (const m of t.poses) {
      const n = nom(m.type);
      if (!n) continue;
      const p = placeDuNom(m);
      pastille(c, police, p.x, p.y, n.toLocaleUpperCase());
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
    // la flèche d'un module qui compte pour la mission clignote tant qu'elle n'est pas réussie
    if (!partie.missionFaite && clignote(tick)) {
      for (const m of t.poses) {
        if (!comptePourLaMission(theme, m.type)) continue;
        const f = flecheDe(m);
        fleche(g, P, f.x, f.y, f.a, couleurModule(P, theme, m.type));
      }
    }
  }

  function redimensionner(largeur: number, hauteur: number): void {
    L = Math.max(1, Math.floor(largeur));
    H = Math.max(1, Math.floor(hauteur));
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.floor(L * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${L}px`;
    canvas.style.height = `${H}px`;
    echelle = Math.min(L / LARGEUR, H / HAUTEUR);
    ox = (L - LARGEUR * echelle) / 2;
    oy = (H - HAUTEUR * echelle) / 2;
    const o = document.createElement("canvas");
    o.width = Math.ceil(LARGEUR * echelle * dpr);
    o.height = Math.ceil(HAUTEUR * echelle * dpr);
    const oc = o.getContext("2d")!;
    oc.setTransform(o.width / LARGEUR, 0, 0, o.height / HAUTEUR, 0, 0);
    dessinerSol(oc, { theme, table: t, titre, police });
    sol = o;
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
    // les trous
    for (const tr of t.trous) {
      ombre(() => rond(px(tr.x), px(tr.y), px(tr.r) + 6, ENCRE, 0));
      rond(px(tr.x), px(tr.y), px(tr.r) + 6, P.accent, 3);
      rond(px(tr.x), px(tr.y), px(tr.r) - 1, "#120C08", 2.5);
    }
    portailsEtFleches(s.tick);
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
    for (const p of t.poteaux) {
      ombre(() => rond(px(p.x), px(p.y), px(p.r) + 1, ENCRE, 0));
      rond(px(p.x), px(p.y), px(p.r) + 1, PAPIER, 2.5);
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
    // les spinners (roues vues de profil)
    t.spinners.forEach((c, i) => {
      angles[i] = (angles[i]! + (partie.spin[i]! / 1000) * 0.016) % TAU;
      g.save();
      g.translate(px(c.x), px(c.y));
      const k = Math.abs(Math.cos(angles[i]!));
      const l = px(c.l);
      g.fillStyle = P.accent;
      g.strokeStyle = ENCRE;
      g.lineWidth = 2.5;
      g.fillRect(-l + 4, -8 * k, (l - 4) * 2, 16 * k + 0.5);
      g.strokeRect(-l + 4, -8 * k, (l - 4) * 2, 16 * k + 0.5);
      g.restore();
    });
    // les cibles : des blocs debout, ou une trace pointillée quand elles sont tombées
    t.murs.forEach((m, i) => {
      if (m.type !== 2) return;
      if (partie.bas[i]) {
        g.beginPath();
        g.moveTo(px(m.ax), px(m.ay));
        g.lineTo(px(m.bx), px(m.by));
        g.setLineDash([3, 4]);
        g.strokeStyle = "rgba(42,30,22,.45)";
        g.lineWidth = 3;
        g.stroke();
        g.setLineDash([]);
        return;
      }
      const trait = (couleur: string, largeur: number, dy = 0): void => {
        g.beginPath();
        g.moveTo(px(m.ax), px(m.ay) + dy);
        g.lineTo(px(m.bx), px(m.by) + dy);
        g.strokeStyle = couleur;
        g.lineWidth = largeur;
        g.stroke();
      };
      ombre(() => trait(ENCRE, 12));
      trait(ENCRE, 12);
      trait(theme === "volcan" ? "#8a8a94" : P.cible, 6.5);
      trait("rgba(255,255,255,.55)", 2, -1.5);
    });
    // les bumpers : jupe, corps, chapeau, yeux ; une onde au contact
    t.bumpers.forEach((b, i) => {
      const eclat = partie.choc[i]! / 40;
      const k = 1 + eclat * 0.12;
      const x = px(b.x);
      const y = px(b.y);
      const r = px(b.r);
      ombre(() => rond(x, y, r * 1.22, ENCRE, 0));
      rond(x, y, r * 1.22, P.accent, 3);
      rond(x, y, r * k, eclat > 0.4 ? MOUTARDE : b.mobile ? "#9AA3B5" : P.bumper, 3); // l'astéroïde est gris
      rond(x, y - 1.5, r * 0.62 * k, PAPIER, 2.5);
      if (eclat > 0) {
        g.beginPath();
        g.arc(x, y, r * (1.3 + (1 - eclat) * 0.9), 0, TAU);
        g.strokeStyle = `rgba(232,178,58,${eclat})`;
        g.lineWidth = 3;
        g.stroke();
      }
      yeux(x, y - 1.5, r * 0.62 * k * 1.6);
    });
    noms(g);
    // les batteurs : corps clair, caoutchouc d'encre
    for (const i of [GAUCHE, DROITE]) {
      const { px: bx, py: by, tx, ty } = pointeDuBatteur(i, partie.a[i]!);
      const a = Math.atan2(px(ty) - px(by), px(tx) - px(bx));
      const x0 = px(bx);
      const y0 = px(by);
      const x1 = px(tx);
      const y1 = px(ty);
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
    // la bille : chrome, avec son ombre (cachée quand un trou la garde)
    if (!partie.finie && partie.captif === 0) {
      const a = s.alpha;
      const bx = px(partie.px) + (px(partie.x) - px(partie.px)) * a;
      const by = px(partie.py) + (px(partie.y) - px(partie.py)) * a;
      g.fillStyle = "rgba(0,0,0,.28)";
      g.beginPath();
      g.ellipse(bx + 3.5, by + 5, RAYON, RAYON * 0.8, 0, 0, TAU);
      g.fill();
      rond(bx, by, RAYON, "#C9CED6", 2);
      g.beginPath();
      g.arc(bx, by, RAYON - 1, 0.2, Math.PI - 0.2);
      g.fillStyle = "#9AA1AC";
      g.fill();
      g.beginPath();
      g.arc(bx - 3, by - 3.5, 3.2, 0, TAU);
      g.fillStyle = "#fff";
      g.fill();
    }
    masque(g, ENCRE);
    if (s.eclat > 0) {
      // la mission réussie : un éclat doré sur toute la table
      g.fillStyle = `rgba(232,178,58,${s.eclat * 0.42})`;
      g.fillRect(0, 0, LARGEUR, HAUTEUR);
    }
    if (s.sauvee > 0) {
      g.globalAlpha = Math.min(1, s.sauvee * 2);
      pastille(g, police, AXE, 520 - (1 - s.sauvee) * 16, s.texteSauvee.toLocaleUpperCase());
      g.globalAlpha = 1;
    }
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
    g.strokeStyle = "#00FF66";
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
    g.beginPath();
    g.arc(px(partie.x), px(partie.y), RAYON, 0, TAU);
    g.stroke();
    g.font = `700 11px ${police}`;
    g.textAlign = "left";
    g.fillStyle = "#FFFF00";
    g.fillText(`pas ${s.tick}`, 26, 222);
    g.textAlign = "center";
    for (const gain of s.gains) {
      g.globalAlpha = gain.vie;
      g.fillStyle = "#FFFFFF";
      g.fillText(`+${gain.points}`, px(gain.x), px(gain.y) - 14 - (1 - gain.vie) * 18);
    }
    g.globalAlpha = 1;
  }

  return { redimensionner, dessiner };
}
