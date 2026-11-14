// PROVISOIRE, remplacé par @cdj/visuels au GR3 : ce fichier porte le dessin canvas de la maquette (`docs/gravity/maquettes/gravity-maquette-jouable.html`) tel quel — fonds par thème, cases, piques, pièces, gemmes, bonus,
// cube à bandeau, particules. Aucune nouvelle DA dans le lot GR1 ; les couleurs ci-dessous sont celles de la maquette (palettes de Jump) et seront remplacées par les jetons et les dessinateurs communs du module `@cdj/visuels`.
//
// **De l'affichage et des entrées seulement** : la partie est `Partie` de `@cdj/gravity-sim` (entière, 120 pas par seconde). Le rendu interpole entre l'état d'avant le dernier pas et l'état d'après. Une entrée (toucher,
// clic, Espace, flèches, W, S, A à la manette — le kit route les touches par `DefinitionJeu.actions`) est un appui daté **au pas de la simulation** : la rediffusion est la liste de ces pas. Les particules sont mises à jour
// à chaque pas (donc figées pendant la pause) avec un petit générateur entier à elles, jamais `Math.random`.
import {
  CASE,
  CLIGNOTANT_ALLUME,
  CLIGNOTANT_AVERTISSEMENT,
  CLIGNOTANT_CYCLE,
  EV_ATTERRISSAGE,
  EV_BONUS,
  EV_BOUCLIER,
  EV_GEMME,
  EV_INVERSEUR,
  EV_INVERSION,
  EV_MORT,
  EV_PIECE,
  LARGEUR_MORCEAU,
  LIGNES,
  MAX_APPUIS,
  MORCEAUX_PAR_THEME,
  MORT_BORD,
  MORT_PIQUE,
  MORT_TEMPS,
  MORT_VIDE,
  NB_THEMES,
  Partie,
  TAILLE,
  TICKS_PAR_SECONDE,
  VARIANTE,
  caseDe,
  decoderRediffusion,
  enregistrer,
  solide,
  terrainDuJour,
  type Contenu,
  type ThemeGravity,
} from "@cdj/gravity-sim";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";

interface Palette {
  fond: string;
  face: string;
  remplissage: string;
  bordHaut: string;
  bordCote: string;
  bordBas: string;
  piece: string;
  loin: string;
  pres: string;
  forme: "collines" | "cheminees" | "montagnes" | "skyline";
  /** La couleur de l'étiquette du thème (bandeau de changement de thème). */
  etiquette: string;
}
const PALETTES: Record<ThemeGravity, Palette> = {
  foret: { fond: "#070f0d", face: "#2a4426", remplissage: "#1f3420", bordHaut: "#8fc46a", bordCote: "#456d3a", bordBas: "#33522d", piece: "#F4EFE2", loin: "#0d1a1c", pres: "#10201f", forme: "collines", etiquette: "#456d3a" },
  usine: { fond: "#07090c", face: "#363b44", remplissage: "#2a2e36", bordHaut: "#aab4c0", bordCote: "#59616d", bordBas: "#454b55", piece: "#F4EFE2", loin: "#0f1218", pres: "#101218", forme: "cheminees", etiquette: "#59616d" },
  glace: { fond: "#050c18", face: "#1c3e58", remplissage: "#18374f", bordHaut: "#dff4ff", bordCote: "#4f86a8", bordBas: "#2f5c7c", piece: "#F4EFE2", loin: "#0b1630", pres: "#0e1c3a", forme: "montagnes", etiquette: "#4f86a8" },
  nuit: { fond: "#04060e", face: "#2b3260", remplissage: "#20264a", bordHaut: "#9fb0ff", bordCote: "#46508c", bordBas: "#363f74", piece: "#F0F2FF", loin: "#0a0e1e", pres: "#0d1226", forme: "collines", etiquette: "#46508c" },
  neon: { fond: "#07020f", face: "#40306e", remplissage: "#2f2252", bordHaut: "#5ff3ff", bordCote: "#7a2fa0", bordBas: "#5a2078", piece: "#FFF6E0", loin: "#120a24", pres: "#1a0e34", forme: "skyline", etiquette: "#7a2fa0" },
};
const DANGER = "#FF3B3B";
const DANGER_BORD = "#1a0408";
const JOUEUR = "#FFD23F";
const ENCRE = "#2A1E16";
const PAPIER = "#FFF6E0";
const DIAMANT = "#4FC3DC";

interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  couleur: string;
  r: number;
}

/** Les textes de mort du catalogue, par cause. */
const CLE_MORT: Record<number, string> = { [MORT_VIDE]: "vide", [MORT_PIQUE]: "pique", [MORT_BORD]: "bord", [MORT_TEMPS]: "temps" };
/** Combien de temps (ms) la mort se montre avant l'écran de fin ; rien avec « réduire les animations ». */
const DELAI_MORT_MS = 900;
/** Combien de pas le nom du thème reste affiché (1,8 s). */
const THEME_AFFICHE = 216;

/** Le rendu et les entrées d'une partie. `?theme=<id>` (hors production) : la partie d'essai commence sur ce thème, la touche T saute au suivant — jamais classées (le kit ne les envoie pas). */
export function nouvellePartieGravity(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const terrain = terrainDuJour(contenu);
  const partie = new Partie(terrain);
  const appuis: number[] = [];
  const canvas = document.createElement("canvas");
  canvas.className = "gravity-plateau";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", o.libelle);
  hote.append(canvas);
  hote.style.touchAction = "none";
  hote.style.padding = "0"; // le monde occupe tout le cadre sous le HUD du kit
  hote.style.userSelect = "none";
  const g = canvas.getContext("2d")!;
  // Le thème d'essai : `?theme=` hors production (le kit refuse déjà de classer une telle page).
  const essaiDeTheme = import.meta.env.VITE_PRODUCTION !== "1" && new URLSearchParams(location.search).has("theme");
  const police = getComputedStyle(hote).getPropertyValue("--jeu-police").trim() || "sans-serif";

  let L = 1; // largeur et hauteur du dessin en pixels CSS ; T : la taille d'une case en pixels
  let H = 1;
  let T = 1;
  /** En portrait le monde (12 cases) est plus bas que l'écran : il est centré, les fonds remplissent tout. */
  let dy = 0;
  const redimensionner = (): void => {
    const r = hote.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cs = getComputedStyle(hote);
    L = Math.max(1, Math.floor(r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    H = Math.max(1, Math.floor(r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)));
    canvas.width = Math.floor(L * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${L}px`;
    canvas.style.height = `${H}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    T = H / LIGNES;
    if (L / T < 14) T = L / 14; // jamais plus de 14 cases en largeur : en portrait, le monde rétrécit
    dy = Math.max(0, (H - LIGNES * T) / 2);
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  redimensionner();

  // --- Les entrées : un appui daté au pas de la simulation ---
  const toucher = (): void => {
    if (partie.finie || appuis.length >= MAX_APPUIS || appuis[appuis.length - 1] === partie.tick) return;
    appuis.push(partie.tick);
    partie.appuyer();
  };
  const surPointeur = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest("button")) return; // le HUD du kit a ses propres boutons
    e.preventDefault();
    toucher();
  };
  hote.addEventListener("pointerdown", surPointeur);
  const surTouche = (e: KeyboardEvent): void => {
    if (e.code === "KeyT" && essaiDeTheme && !e.repeat) partie.sauterAuThemeSuivant();
  };
  addEventListener("keydown", surTouche);

  // --- L'état du rendu ---
  let particules: Particule[] = [];
  let graine = 0x9e3779b1;
  const alea = (): number => {
    graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0;
    return graine / 4294967296;
  };
  const etincelles = (x: number, y: number, couleur: string, n = 8, vitesse = 5): void => {
    for (let i = 0; i < n; i++) {
      const a = alea() * Math.PI * 2;
      particules.push({ x, y, vx: Math.cos(a) * vitesse, vy: Math.sin(a) * vitesse, vie: 0.45, couleur, r: 0.07 });
    }
  };
  const poussiere = (x: number, y: number, n: number): void => {
    for (let i = 0; i < n; i++) particules.push({ x, y, vx: (alea() - 0.5) * 4, vy: (alea() - 0.5) * 2, vie: 0.4, couleur: PAPIER, r: 0.06 + alea() * 0.06 });
  };
  const themeDe = (cx: number): ThemeGravity => contenu.ordre[Math.trunc(Math.trunc(cx / LARGEUR_MORCEAU) / MORCEAUX_PAR_THEME) % NB_THEMES]!;
  let themeVu: ThemeGravity | null = null;
  let themeDepuis = -1000;
  let ecrase = 0;
  let tMort = 0;
  let mortVue = false;
  let tDernierPas = performance.now();

  function evenements(): void {
    const ev = partie.ev;
    const cx = (partie.x + TAILLE / 2) / CASE;
    const cy = (partie.y + TAILLE / 2) / CASE;
    if (ev & EV_INVERSION) poussiere(cx, partie.g > 0 ? partie.y / CASE : (partie.y + TAILLE) / CASE, 6);
    if (ev & EV_ATTERRISSAGE) {
      ecrase = 17;
      poussiere(cx, partie.g > 0 ? (partie.y + TAILLE) / CASE : partie.y / CASE, 5);
    }
    if (ev & EV_INVERSEUR) poussiere(cx, cy, 8);
    if (ev & EV_PIECE) etincelles(cx, cy, PALETTES[themeDe(Math.trunc(cx))].piece);
    if (ev & EV_GEMME) etincelles(cx, cy, DIAMANT, 18);
    if (ev & EV_BONUS) etincelles(cx, cy, PAPIER, 16);
    if (ev & EV_BOUCLIER) etincelles(cx, cy, DIAMANT, 22);
    if (ev & EV_MORT) {
      for (let i = 0; i < 26; i++) particules.push({ x: cx, y: cy, vx: (alea() - 0.5) * 12, vy: (alea() - 0.5) * 12, vie: 0.9, couleur: alea() < 0.6 ? JOUEUR : ENCRE, r: 0.12 + alea() * 0.12 });
    }
  }

  // --- Le rendu (maquette : `dessiner`) ---
  /** Un nombre de pas en secondes de jeu : toute l'animation suit les pas (la pause la fige). */
  const temps = (): number => partie.tick / TICKS_PAR_SECONDE;
  function fondTheme(p: Palette, x0: number, x1: number, cam: number): void {
    g.fillStyle = p.fond;
    g.fillRect(x0, 0, x1 - x0, H);
    for (const [couleur, f, haut, base] of [[p.loin, 0.15, 0.32, 0.72], [p.pres, 0.35, 0.22, 0.86]] as const) {
      g.fillStyle = couleur;
      g.beginPath();
      g.moveTo(x0, H);
      for (let sx = x0; sx <= x1 + 8; sx += 8) {
        const wx = (sx / T + cam * f) * 0.5;
        let h: number;
        if (p.forme === "cheminees" || p.forme === "skyline") h = Math.floor(wx) % 3 === 0 ? 0.9 : Math.floor(wx * 1.7) % 2 ? 0.55 : 0.35;
        else if (p.forme === "montagnes") h = Math.abs((wx * 0.6) % 2 - 1);
        else h = 0.5 + 0.5 * Math.sin(wx * 0.9) * Math.sin(wx * 0.37);
        g.lineTo(sx, H * base - h * H * haut);
      }
      g.lineTo(x1 + 8, H);
      g.closePath();
      g.fill();
    }
  }

  function dessinerCase(type: number, sx: number, sy: number, p: Palette, gx: number, gy: number, decalage: number): void {
    const s = T;
    const tick = partie.tick;
    if (type === 9) {
      // le vent : des traits qui montent
      g.fillStyle = "rgba(200,255,190,0.07)";
      g.fillRect(sx, sy, s, s);
      g.strokeStyle = "rgba(220,255,200,0.45)";
      g.lineWidth = 2;
      const dec = ((temps() * 3 + gx * 0.37) % 1) * s;
      g.beginPath();
      g.moveTo(sx + s * 0.3, sy + s - dec);
      g.lineTo(sx + s * 0.3, sy + s - dec - s * 0.3);
      g.moveTo(sx + s * 0.7, sy + ((s - dec + s / 2) % s));
      g.lineTo(sx + s * 0.7, sy + ((s - dec + s / 2) % s) - s * 0.3);
      g.stroke();
      return;
    }
    if (type === 2) {
      // le pique, pointe vers la surface en face
      const dessous = caseDe(terrain, gx, gy + 1);
      const bas = dessous !== 0 && dessous !== 2 && dessous !== 9;
      g.fillStyle = DANGER;
      g.strokeStyle = DANGER_BORD;
      g.lineWidth = Math.max(1.5, s * 0.06);
      for (let k = 0; k < 2; k++) {
        const ax = sx + (k * s) / 2;
        g.beginPath();
        if (bas) {
          g.moveTo(ax + s * 0.04, sy + s);
          g.lineTo(ax + s * 0.25, sy + s * 0.25);
          g.lineTo(ax + s * 0.46, sy + s);
        } else {
          g.moveTo(ax + s * 0.04, sy);
          g.lineTo(ax + s * 0.25, sy + s * 0.75);
          g.lineTo(ax + s * 0.46, sy);
        }
        g.closePath();
        g.fill();
        g.stroke();
      }
      return;
    }
    const actif = solide(type, tick, decalage);
    let face = p.face;
    let bord = p.bordHaut;
    if (type === 3) [face, bord] = ["#0b0e13", "#e6eef2"];
    if (type === 4) [face, bord] = ["#0a2238", "#dff8ff"];
    if (type === 6) [face, bord] = ["#0f3a44", "#5ff3ff"];
    if (type === 7) [face, bord] = ["#46153c", "#ff6ad5"];
    if (type === 8) [face, bord] = ["#3a3550", PAPIER];
    if (type === 5) [face, bord] = ["#3b4380", "#e8ecff"];
    if ((type === 5 || type === 6 || type === 7) && !actif) {
      g.strokeStyle = bord;
      g.globalAlpha = 0.55;
      g.lineWidth = 2;
      g.setLineDash([5, 5]);
      g.strokeRect(sx + 3, sy + 3, s - 6, s - 6);
      g.setLineDash([]);
      g.globalAlpha = 1;
      return;
    }
    g.fillStyle = type === 1 ? p.remplissage : face;
    g.fillRect(sx, sy, s + 0.5, s + 0.5);
    if (type === 1) {
      g.fillStyle = p.face;
      g.fillRect(sx + s * 0.08, sy + s * 0.08, s * 0.84, s * 0.84);
    }
    const vide = (dx: number, dy: number): boolean => {
      const c = caseDe(terrain, gx + dx, gy + dy);
      return !(c === 1 || (c >= 3 && c <= 8));
    };
    const e = Math.max(3, s * 0.13);
    g.fillStyle = type === 1 ? p.bordHaut : bord;
    if (vide(0, -1)) g.fillRect(sx, sy, s + 0.5, e);
    g.fillStyle = type === 1 ? p.bordBas : bord;
    if (vide(0, 1)) g.fillRect(sx, sy + s - e, s + 0.5, e);
    g.fillStyle = type === 1 ? p.bordCote : bord;
    if (vide(-1, 0)) g.fillRect(sx, sy, e, s);
    if (vide(1, 0)) g.fillRect(sx + s - e, sy, e, s);
    if (type === 3) {
      g.strokeStyle = "#e6eef2";
      g.lineWidth = 2;
      const dec = ((temps() * 4) % 1) * (s / 2);
      for (let k = -1; k < 2; k++) {
        const ax = sx + dec + (k * s) / 2 + s * 0.15;
        g.beginPath();
        g.moveTo(ax, sy + s * 0.35);
        g.lineTo(ax + s * 0.15, sy + s * 0.5);
        g.lineTo(ax, sy + s * 0.65);
        g.stroke();
      }
    }
    if (type === 5) {
      // la lampe du bloc clignote juste avant qu'il s'éteigne
      const reste = CLIGNOTANT_ALLUME - ((tick + decalage) % CLIGNOTANT_CYCLE);
      const prevenir = reste < CLIGNOTANT_AVERTISSEMENT && Math.floor(tick / 6) % 2 === 0;
      g.fillStyle = prevenir ? "#3b4380" : "#e8ecff";
      g.fillRect(sx + s * 0.38, sy + s * 0.38, s * 0.24, s * 0.24);
    }
    if (type === 4) {
      g.fillStyle = "rgba(244,253,255,.35)";
      g.beginPath();
      g.moveTo(sx + s * 0.2, sy + s * 0.75);
      g.lineTo(sx + s * 0.45, sy + s * 0.3);
      g.lineTo(sx + s * 0.55, sy + s * 0.3);
      g.lineTo(sx + s * 0.3, sy + s * 0.75);
      g.fill();
    }
    if (type === 8) {
      g.strokeStyle = PAPIER;
      g.lineWidth = Math.max(2, s * 0.08);
      g.beginPath();
      g.moveTo(sx + s / 2, sy + s * 0.2);
      g.lineTo(sx + s / 2, sy + s * 0.8);
      g.moveTo(sx + s * 0.32, sy + s * 0.36);
      g.lineTo(sx + s / 2, sy + s * 0.2);
      g.lineTo(sx + s * 0.68, sy + s * 0.36);
      g.moveTo(sx + s * 0.32, sy + s * 0.64);
      g.lineTo(sx + s / 2, sy + s * 0.8);
      g.lineTo(sx + s * 0.68, sy + s * 0.64);
      g.stroke();
    }
  }

  function dessinerJoueur(cam: number, x: number, y: number): void {
    if (partie.mort !== 0) return;
    const s = T * (TAILLE / CASE);
    const sx = (x - cam) * T;
    const sy = y * T;
    const ec = ecrase > 0 ? ecrase / 17 : 0;
    g.save();
    g.translate(sx + s / 2, sy + s / 2);
    if (partie.g < 0) g.scale(1, -1);
    g.scale(1 + ec * 0.18, 1 - ec * 0.18);
    const r = s * 0.16;
    const lw = Math.max(2, s * 0.09);
    g.beginPath();
    g.roundRect(-s / 2, -s / 2, s, s, r);
    g.fillStyle = JOUEUR;
    g.fill();
    g.lineWidth = lw;
    g.strokeStyle = ENCRE;
    g.stroke();
    // le bandeau d'encre et ses deux pans qui flottent
    g.fillStyle = ENCRE;
    g.fillRect(-s / 2 - lw * 0.3, -s * 0.28, s + lw * 0.6, s * 0.16);
    const f = Math.sin(temps() * 18) * s * 0.06;
    g.beginPath();
    g.moveTo(-s / 2, -s * 0.24);
    g.lineTo(-s * 0.95, -s * 0.36 + f);
    g.lineTo(-s * 0.9, -s * 0.18 + f);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-s / 2, -s * 0.18);
    g.lineTo(-s * 0.85, -s * 0.06 - f);
    g.lineTo(-s * 0.78, 0);
    g.closePath();
    g.fill();
    for (const ex of [0.08, 0.3]) {
      g.fillStyle = PAPIER;
      g.beginPath();
      g.arc(ex * s, -s * 0.02, s * 0.12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ENCRE;
      g.beginPath();
      g.arc(ex * s + s * 0.04, 0, s * 0.06, 0, Math.PI * 2);
      g.fill();
    }
    if (partie.sol) {
      const p = Math.sin((x * 3.2) / 1) * s * 0.12;
      g.fillStyle = ENCRE;
      g.fillRect(-s * 0.3 + p, s / 2, s * 0.2, s * 0.1);
      g.fillRect(s * 0.1 - p, s / 2, s * 0.2, s * 0.1);
    }
    g.restore();
  }

  function dessinerBandeauTheme(): void {
    const age = partie.tick - themeDepuis;
    if (themeVu === null || age < 0 || age > THEME_AFFICHE) return;
    const opacite = Math.min(1, Math.min(age, THEME_AFFICHE - age) / 30);
    const p = PALETTES[themeVu];
    g.save();
    g.globalAlpha = opacite;
    g.translate(L / 2, dy + LIGNES * T * 0.3);
    g.rotate(-0.035);
    const nom = o.t(`theme.${themeVu}`);
    const meca = o.t(`theme.${themeVu}.meca`);
    g.font = `${Math.max(22, T * 0.8)}px ${police}`;
    const w = Math.max(g.measureText(nom).width, (g.font = `600 ${Math.max(12, T * 0.34)}px ${police}`, g.measureText(meca).width)) + T;
    const h = T * 1.9;
    g.fillStyle = ENCRE;
    g.fillRect(-w / 2 + 4, -h / 2 + 4, w, h);
    g.fillStyle = PAPIER;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.lineWidth = 3;
    g.strokeStyle = ENCRE;
    g.strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle = p.etiquette;
    g.fillRect(-w / 2 + 3, -h / 2 + 3, 10, h - 6);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = ENCRE;
    g.font = `${Math.max(22, T * 0.8)}px ${police}`;
    g.fillText(nom, 0, -T * 0.25);
    g.font = `600 ${Math.max(12, T * 0.34)}px ${police}`;
    g.fillText(meca, 0, T * 0.5);
    g.restore();
  }

  function dessinerEtatsDuJoueur(cam: number, x: number, y: number): void {
    if (partie.mort !== 0) return;
    const px = ((x + TAILLE / 2) / CASE - cam) * T;
    const py = ((y + TAILLE / 2) / CASE) * T;
    if (partie.bouclier || partie.invuln > 0) {
      g.strokeStyle = DIAMANT;
      g.lineWidth = Math.max(2, T * 0.08);
      g.globalAlpha = partie.invuln > 0 ? 0.4 + 0.4 * Math.sin(temps() * 30) : 0.85;
      g.beginPath();
      g.arc(px, py, T * 0.62, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    if (partie.aimant > 0) {
      g.strokeStyle = PAPIER;
      g.lineWidth = 2;
      g.globalAlpha = 0.18 + 0.1 * Math.sin(temps() * 6);
      g.setLineDash([6, 8]);
      g.beginPath();
      g.arc(px, py, T * 3.5, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }
  }

  function dessiner(): void {
    const maintenant = performance.now();
    const a = Math.max(0, Math.min(1, (maintenant - tDernierPas) / (1000 / TICKS_PAR_SECONDE)));
    const camU = partie.precCam + (partie.cam - partie.precCam) * a;
    const xU = partie.precX + (partie.x - partie.precX) * a;
    const yU = partie.precY + (partie.y - partie.precY) * a;
    const cam = camU / CASE;
    const x = xU;
    const y = yU / CASE;
    g.clearRect(0, 0, L, H);
    // les fonds, un par thème (frontière nette au changement)
    const c0 = Math.max(0, Math.floor(cam) - 1);
    const c1 = Math.ceil(cam + L / T) + 1;
    let debut = c0;
    let courant = themeDe(c0);
    for (let c = c0; c <= c1 + 1; c++) {
      const th = themeDe(c);
      if (th !== courant || c === c1 + 1) {
        fondTheme(PALETTES[courant], Math.max(0, (debut - cam) * T), Math.min(L, (c - cam) * T), cam);
        debut = c;
        courant = th;
      }
    }
    // le monde, centré verticalement
    g.save();
    g.translate(0, dy);
    // les cases
    for (let c = c0; c <= c1; c++) {
      const k = Math.trunc(c / LARGEUR_MORCEAU);
      const morceau = terrain.morceau(k);
      const p = PALETTES[themeDe(c)];
      for (let r = 0; r < LIGNES; r++) {
        const type = morceau.cases[(c - k * LARGEUR_MORCEAU) * LIGNES + r]!;
        if (type) dessinerCase(type, (c - cam) * T, r * T, p, c, r, morceau.decalage);
      }
    }
    // les pièces, les gemmes, les bonus
    const k0 = Math.max(0, Math.trunc(cam / LARGEUR_MORCEAU) - 1);
    const k1 = Math.trunc((cam + L / T) / LARGEUR_MORCEAU) + 1;
    for (let k = k0; k <= k1; k++) {
      const charge = partie.charge(k);
      const morceau = terrain.morceau(k);
      for (const pc of charge.pieces) {
        if (pc.etat !== 0) continue;
        const px = (pc.x / CASE - cam) * T;
        if (px < -T || px > L + T) continue;
        const w = Math.abs(Math.cos(temps() * 3 + pc.x / CASE)) * T * 0.22 + T * 0.06;
        g.fillStyle = PALETTES[themeDe(k * LARGEUR_MORCEAU)].piece;
        g.strokeStyle = ENCRE;
        g.lineWidth = Math.max(1.5, T * 0.06);
        g.beginPath();
        g.ellipse(px, (pc.y / CASE) * T, w, T * 0.24, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      morceau.gemmes.forEach((gm, i) => {
        if (charge.gemmes[i]) return;
        const sx = (gm.x / CASE - cam) * T;
        const sy = (gm.y / CASE) * T + Math.sin(temps() * 3) * T * 0.08;
        const kk = T * 0.32;
        g.fillStyle = DIAMANT;
        g.strokeStyle = ENCRE;
        g.lineWidth = Math.max(2, T * 0.07);
        g.beginPath();
        g.moveTo(sx, sy - kk);
        g.lineTo(sx + kk * 0.8, sy);
        g.lineTo(sx, sy + kk);
        g.lineTo(sx - kk * 0.8, sy);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = "#E8FBFF";
        g.beginPath();
        g.moveTo(sx - kk * 0.2, sy - kk * 0.45);
        g.lineTo(sx + kk * 0.15, sy - kk * 0.2);
        g.lineTo(sx - kk * 0.25, sy - kk * 0.1);
        g.fill();
      });
      morceau.bonus.forEach((b, i) => {
        if (charge.bonus[i]) return;
        const sx = (b.x / CASE - cam) * T;
        const sy = (b.y / CASE) * T + Math.sin(temps() * 2.5) * T * 0.1;
        const kk = T * 0.36;
        g.lineWidth = Math.max(2, T * 0.07);
        g.strokeStyle = ENCRE;
        g.fillStyle = PAPIER;
        g.beginPath();
        g.arc(sx, sy, kk, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = DIAMANT;
        if (b.type === "bouclier") {
          g.beginPath();
          g.moveTo(sx, sy - kk * 0.6);
          g.lineTo(sx + kk * 0.5, sy - kk * 0.35);
          g.lineTo(sx + kk * 0.4, sy + kk * 0.25);
          g.lineTo(sx, sy + kk * 0.6);
          g.lineTo(sx - kk * 0.4, sy + kk * 0.25);
          g.lineTo(sx - kk * 0.5, sy - kk * 0.35);
          g.closePath();
          g.fill();
          g.stroke();
        } else {
          g.lineWidth = kk * 0.32;
          g.strokeStyle = DIAMANT;
          g.beginPath();
          g.arc(sx, sy - kk * 0.05, kk * 0.38, Math.PI, 0);
          g.moveTo(sx - kk * 0.38, sy - kk * 0.05);
          g.lineTo(sx - kk * 0.38, sy + kk * 0.4);
          g.moveTo(sx + kk * 0.38, sy - kk * 0.05);
          g.lineTo(sx + kk * 0.38, sy + kk * 0.4);
          g.stroke();
        }
      });
    }
    dessinerEtatsDuJoueur(cam, xU, yU);
    dessinerJoueur(cam, x / CASE, y);
    for (const p of particules) {
      g.globalAlpha = Math.max(0, p.vie * 2);
      g.fillStyle = p.couleur;
      g.fillRect((p.x - cam) * T - (p.r * T) / 2, p.y * T - (p.r * T) / 2, p.r * T, p.r * T);
    }
    g.globalAlpha = 1;
    g.restore();
    dessinerBandeauTheme();
    if (partie.mort !== 0) {
      const cause = CLE_MORT[partie.mort] ?? "vide";
      g.font = `${Math.max(18, T * 0.6)}px ${police}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 4;
      g.strokeStyle = ENCRE;
      g.fillStyle = PAPIER;
      const texte = o.t(`mort.${cause}`);
      g.strokeText(texte, L / 2, dy + LIGNES * T * 0.45);
      g.fillText(texte, L / 2, dy + LIGNES * T * 0.45);
    }
  }

  /** Les particules, au pas : elles suivent la simulation (la pause les fige). */
  function avancerParticules(): void {
    const dt = 1 / TICKS_PAR_SECONDE;
    for (const p of particules) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vie -= dt;
    }
    particules = particules.filter((p) => p.vie > 0);
    if (ecrase > 0) ecrase--;
  }

  return {
    avancer() {
      if (partie.finie) return;
      partie.avancer();
      tDernierPas = performance.now();
      if (partie.finie && !mortVue) {
        mortVue = true;
        tMort = tDernierPas;
      }
      // le thème traversé : son nom s'affiche quand il change (et au départ)
      const th = themeDe(Math.trunc(partie.x / CASE));
      if (th !== themeVu) {
        themeVu = th;
        themeDepuis = partie.tick;
      }
      evenements();
      avancerParticules();
    },
    // L'écran de fin attend un instant : on voit la mort et sa cause (rien avec « réduire les animations »).
    finie: () => partie.finie && (o.reduit || performance.now() - tMort > DELAI_MORT_MS),
    finEnCours: () => partie.finie,
    action(id) {
      if (id === "toucher") toucher();
    },
    hud: () => ({ principal: VARIANTE.formatScore([partie.score], o.langue), secondaire: o.t("hud.detail", { m: partie.distance, mult: partie.mult }) }),
    resultat: () => ({ score: VARIANTE.score(partie.resultat()), rediffusion: enregistrer(contenu, appuis) }),
    fantome(r) {
      // Pas de fantôme en GR1 (`sansFantome`) ; la rediffusion d'un autre jour ou abîmée ne se lit pas.
      if (r) {
        try {
          decoderRediffusion(r);
        } catch {
          /* ignorée */
        }
      }
    },
    dessiner,
    detruire() {
      observateur.disconnect();
      removeEventListener("keydown", surTouche);
      hote.removeEventListener("pointerdown", surPointeur);
      canvas.remove();
    },
  };
}
