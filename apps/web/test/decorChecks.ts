// Vérification de la pose du décor (lot 37), sans rendu : on rejoue la construction d'un circuit avec un relevé (`PoseLog`), puis on regarde chaque
// élément contre la simulation (`trackWorld` : la route, les bas-côtés et les cuves telles que la voiture les touche), pas contre le code qui l'a posé.
// Règles (apps/web/CLAUDE.md, « Décor : règles de pose ») : tout pied a un appui à sa position exacte, rien sur la surface roulante ni dans le
// passage de la voiture, rien au-dessus du vide, une structure tient ensemble, chaque type d'élément a un rôle.
import {
  CELL,
  FALL_DEPTH,
  NO_GROUND,
  SHOULDER_EDGE,
  WALL_HEIGHT,
  blockHalfWidth,
  blockPoint,
  canonP,
  canonQ,
  cellKey,
  createSurface,
  curveCenter,
  dailyCircuit,
  daysFromCivil,
  isCurve,
  trackWorld,
  type Block,
  type PaletteName,
  type ThemeName,
  type Track,
  type World,
} from "@cdj/sim";
import { CHAPEAU, MARGE_PASSAGE, PASSAGE_HAUT, PoseLog, ROLES, TOLERANCE_APPUI, type Pose } from "../src/decorPose";
import { PALETTE_DEFS } from "../src/trackMesh";
import { trackGeometry } from "../src/scene/existant";
import { geometrieP1 } from "../src/scene/composerP1";

export type Regle = "appui" | "vide" | "passage" | "structure" | "role";

export interface Faute {
  regle: Regle;
  kind: Pose["kind"];
  /** Thème du circuit. */
  theme: string;
  /** Style du décor (désert, ville…) ou vide. */
  style: string;
  jour: string;
  block: number;
  /** Élément (structure) en faute : une arche ou un panneau compte pour un, quelles que soient ses pièces. */
  group: number;
  detail: string;
}

export interface Circuit {
  jour: string;
  theme: ThemeName;
  palette: PaletteName;
  track: Track;
}

/** Les circuits du test : des jours consécutifs à partir du 13/10/2026, le thème imposé tourne : chaque thème revient `parTheme` fois (8 thèmes × 8 = 64 jours, jusqu'au 15/12). */
export function circuitsDuTest(themes: readonly ThemeName[], parTheme = 8, premierJour = daysFromCivil(2026, 10, 13)): Circuit[] {
  const out: Circuit[] = [];
  for (let k = 0; k < themes.length * parTheme; k++) {
    const day = premierJour + k;
    const theme = themes[k % themes.length]!;
    const c = dailyCircuit(day, 0, theme);
    out.push({ jour: c.date, theme, palette: c.palette, track: c.track });
  }
  return out;
}

const out = createSurface();

/** Hauteur de ce que la voiture touche en (x, z) (route, bas-côté, paroi de cuve), ou `NO_GROUND`. */
function roulant(world: World, x: number, z: number): number {
  world.sample(x, z, out);
  return out.height;
}

/** Points d'une boîte vue du dessus (le pourtour tous les `pas` m, plus le centre), élargie de `marge`. */
function pointsDuPlan(p: Pose, marge: number, pas = 0.5): [number, number][] {
  const x0 = p.x0 - marge;
  const x1 = p.x1 + marge;
  const z0 = p.z0 - marge;
  const z1 = p.z1 + marge;
  const pts: [number, number][] = [[(x0 + x1) / 2, (z0 + z1) / 2]];
  const nx = Math.max(1, Math.ceil((x1 - x0) / pas));
  const nz = Math.max(1, Math.ceil((z1 - z0) / pas));
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    pts.push([x, z0], [x, z1]);
  }
  for (let j = 1; j < nz; j++) {
    const z = z0 + ((z1 - z0) * j) / nz;
    pts.push([x0, z], [x1, z]);
  }
  return pts;
}

/** Le bloc qui porte la cellule de (x, z). */
const blocAt = (track: Track, x: number, z: number): Block | undefined => track.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));

/**
 * Où se trouve (x, z) par rapport au rebord du bloc `b` : `dehors` = distance au-delà du bord de la route (ou de la bande, avec des bas-côtés),
 * négative si (x, z) est sur la route ; `bord` = hauteur de la route (ou de la bande) au bord.
 */
function auBord(world: World, b: Block, x: number, z: number): { dehors: number; bord: number } {
  const u = x - b.cx * CELL;
  const v = z - b.cz * CELL;
  const p = canonP(b.dir, u, v);
  const q = canonQ(b.dir, u, v);
  const edge = (hw: number) => (b.shoulder ? SHOULDER_EDGE : hw);
  const pt = { x: 0, z: 0 };
  if (isCurve(b.kind)) {
    const c = curveCenter(b.kind);
    const dp = p - c.cp;
    const r = Math.hypot(dp, q) || 1;
    const e = edge(b.w0 / 2);
    const sens = r >= c.r ? 1 : -1;
    const re = c.r + sens * (e - 0.05);
    blockPoint(b, c.cp + (dp / r) * re, (q / r) * re, pt);
    return { dehors: Math.abs(r - c.r) - e, bord: roulant(world, pt.x, pt.z) };
  }
  const lat = p - CELL / 2;
  const e = edge(blockHalfWidth(b, q));
  blockPoint(b, CELL / 2 + Math.sign(lat || 1) * (e - 0.05), q, pt);
  return { dehors: Math.abs(lat) - e, bord: roulant(world, pt.x, pt.z) };
}

/** Rejoue la construction d'un circuit au palier 1 (la scène du jeu, lot 43 : éléments, éclairage de piste, décor d'aujourd'hui) avec un relevé de pose. */
export function releverP1(track: Track, palette: PaletteName): Pose[] {
  const log = new PoseLog();
  geometrieP1(track, palette, { log, headless: true });
  return log.poses;
}

/** Rejoue la construction d'un circuit de l'ancienne scène (palier « existant », à la demande depuis le lot 43) avec un relevé de pose. */
export function relever(track: Track, palette: PaletteName): Pose[] {
  const log = new PoseLog();
  trackGeometry(track, palette, { log, headless: true });
  return log.poses;
}

/** Les fautes de pose d'un circuit, par règle. */
export function verifier(c: Circuit, poses: Pose[]): Faute[] {
  const { track, palette, theme, jour } = c;
  const world = trackWorld(track);
  const floorY = track.voidY - FALL_DEPTH;
  const hauteurRebord = PALETTE_DEFS[palette].wallHeight ?? WALL_HEIGHT;
  const fautes: Faute[] = [];
  const faute = (p: Pose, regle: Regle, detail: string) => fautes.push({ regle, kind: p.kind, theme, style: p.style, jour, block: p.block, group: p.group, detail });

  for (const p of poses) {
    if (!ROLES[p.kind]) faute(p, "role", "type sans rôle");
    if (p.part === "pied") {
      if (p.appui === "sol") {
        const ecart = p.y0 - floorY;
        if (ecart > TOLERANCE_APPUI) faute(p, "vide", `base à ${ecart.toFixed(2)} m au-dessus du sol`);
        else if (ecart < -TOLERANCE_APPUI) faute(p, "appui", `base à ${(-ecart).toFixed(2)} m sous le sol`);
      } else {
        const b = track.blocks[p.block];
        const cx = (p.x0 + p.x1) / 2;
        const cz = (p.z0 + p.z1) / 2;
        if (!b) faute(p, "appui", "bloc inconnu");
        else if (b.kind === "gap") faute(p, "vide", "posé sur un vide de saut");
        else if (b.open && !b.shoulder) faute(p, "vide", "bloc sans rebords : rien sous le pied");
        else if (b.cuve) faute(p, "appui", "dans la paroi d'une cuve");
        else {
          // Le pied tient tout entier sur le chapeau du rebord : au-delà du bord, pas plus loin que `CHAPEAU`.
          const coins = [[p.x0, p.z0], [p.x1, p.z0], [p.x0, p.z1], [p.x1, p.z1]] as const;
          const d = coins.map(([x, z]) => auBord(world, blocAt(track, x, z) ?? b, x, z).dehors);
          const { bord } = auBord(world, b, cx, cz);
          if (Math.min(...d) < -MARGE_PASSAGE) faute(p, "passage", `sur la surface roulante (${(-Math.min(...d)).toFixed(2)} m en dedans du bord)`);
          else if (Math.max(...d) > CHAPEAU + TOLERANCE_APPUI) faute(p, "vide", `${Math.max(...d).toFixed(2)} m au-delà du bord : hors du chapeau du rebord`);
          else if (bord === NO_GROUND) faute(p, "appui", "pas de route au bord");
          else {
            const ecart = p.y0 - (bord + hauteurRebord);
            if (Math.abs(ecart) > TOLERANCE_APPUI) faute(p, ecart > 0 ? "vide" : "appui", `base ${ecart > 0 ? "au-dessus" : "sous"} le chapeau de ${Math.abs(ecart).toFixed(2)} m`);
          }
        }
      }
      // Un pied ne se pose jamais sur la route ni sur un bas-côté (la voiture y roule).
      if (p.appui === "sol") {
        const dedans = pointsDuPlan(p, MARGE_PASSAGE).filter(([x, z]) => roulant(world, x, z) !== NO_GROUND).length;
        if (dedans > 0) faute(p, "passage", `${dedans} points de son plan sur la surface roulante`);
      }
    } else {
      // Surplomb : au-dessus de la route, à `PASSAGE_HAUT` au moins ; et tenu par un pied de sa structure.
      let pire = Infinity;
      for (const [x, z] of pointsDuPlan(p, 0, 1)) {
        const h = roulant(world, x, z);
        if (h !== NO_GROUND) pire = Math.min(pire, p.y0 - h);
      }
      if (pire < PASSAGE_HAUT) faute(p, "passage", `à ${pire.toFixed(2)} m au-dessus de la route (passage : ${PASSAGE_HAUT} m)`);
      const tient = poses.some((q) => q.group === p.group && q.part === "pied" && q.x0 <= p.x1 + 0.1 && q.x1 >= p.x0 - 0.1 && q.y0 <= p.y1 + 0.1 && q.y1 >= p.y0 - 0.1 && q.z0 <= p.z1 + 0.1 && q.z1 >= p.z0 - 0.1);
      if (!tient) faute(p, "structure", "aucun pied ne le touche");
    }
  }
  return fautes;
}

/** Nombre d'éléments distincts (circuit, structure) en faute, par type puis par thème. */
export function compter(fautes: Faute[]): Record<string, Record<string, number>> {
  const vus = new Set<string>();
  const t: Record<string, Record<string, number>> = {};
  for (const f of fautes) {
    const cle = `${f.jour}|${f.theme}|${f.kind}|${f.group}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    t[f.kind] ??= {};
    t[f.kind]![f.theme] = (t[f.kind]![f.theme] ?? 0) + 1;
  }
  return t;
}

/** Nombre d'éléments distincts d'une liste de poses, par type. */
export function elements(poses: Pose[]): Record<string, number> {
  const t: Record<string, Set<number>> = {};
  for (const p of poses) (t[p.kind] ??= new Set()).add(p.group);
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.size]));
}

/** Inventaire d'un relevé : par type, le nombre d'éléments (structures) et de triangles. */
export function inventaire(poses: Pose[]): Record<string, { elements: number; tris: number }> {
  const groupes: Record<string, Set<number>> = {};
  const t: Record<string, { elements: number; tris: number }> = {};
  for (const p of poses) {
    (groupes[p.kind] ??= new Set()).add(p.group);
    t[p.kind] ??= { elements: 0, tris: 0 };
    t[p.kind]!.tris += p.tris;
  }
  for (const k of Object.keys(t)) t[k]!.elements = groupes[k]!.size;
  return t;
}
