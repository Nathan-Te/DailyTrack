import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, Vector3, type MeshToonMaterial, type Texture } from "three";
import { CASE, MUR, PONT, SOL, VIDE, Z_ARENE, Z_CHEMIN, Z_PORTE, type Niveau } from "@cdj/rush-sim/niveau";
import { M, RAYON_ARENE } from "@cdj/rush-sim/constantes";
import { piece, plat } from "./cel";
import { monterDecor, nuages, type Decor, type EtatDecor } from "./decor";
import { fabriquer, fondre, hauteurDe, rail, type ContexteFabrique, type Genre } from "./fabrique";
import { aleatoire, bloc, colorier, fusionner, placer, roche, teindre } from "./formes";
import { PALETTES, themeDe as themeDePalette, type PaletteMonde } from "./palette";
import { matiereDuSol } from "./sol";
import { VENT, injecterVent, platVent } from "./vent";

// Le décor du NIVEAU (lots BR1 et BR-A2), construit à partir de la grille de la simulation, **en mètres** (x = unités / 4 096, z = y / 4 096, le sol à y = 0). **Le niveau est un archipel d'îles flottantes** : sous chaque clairière et chaque chemin, une falaise
// (une lèvre d'herbe, des parois de pierre, de gros blocs et des pierres pendantes qui s'effilent vers le vide) ; entre les îles, des ponts de bois ; au loin, d'autres îles, des nuages, une brume. Le SOL est calculé dans le matériau (`sol.ts` : dalles, terre
// battue, herbe) ; les murs bas, les arbres, les buissons, les rochers viennent de la FABRIQUE de pièces (`fabrique.ts`), posées par case.
// Regroupé par MORCEAUX de 16 × 16 cases (32 m) : par morceau, un maillage de SOL (dessus, falaise, blocs dessous), un de RELIEF (murs bas, rochers, ponts : opaque, ombré, contour), un de VÉGÉTATION (buissons, herbes, fleurs : opaque, balancée par le vent)
// et un de HAUTS (les arbres : s'efface devant le chevalier, balancé par le vent) — jamais un maillage par case, chacun d'un seul appel de dessin, coupé hors du champ par le moteur.

/** Le côté d'un morceau, en cases. */
export const PAS_MORCEAU = 16;
const CM = CASE / M; // la case, en mètres (2)
/** Les murs bas ne dépassent jamais cette hauteur (mètres) : on voit par-dessus. */
export const MUR_MAX = 1.3;
/** La profondeur de la paroi d'une case au bord du vide (mètres) : la lèvre d'herbe, puis la pierre ; chaque côté varie un peu. */
const PAROI = 2.4;
const LEVRE = 0.45;

export type ThemeVu = "prairie" | "carriere" | "sousbois";

const hash = (i: number, j: number, graine = 0): number => {
  let h = Math.imul((i * 73856093) ^ (j * 19349663) ^ (graine * 83492791), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** Le thème d'une palette (par identité) ; la prairie à défaut. */
export function themeDe(a: PaletteMonde): ThemeVu {
  return themeDePalette(a);
}

// --- Ce que chaque thème pose ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Le mur bas d'une case qui borde le jeu : ce qu'on y pose (genre, variante, échelle). La prairie : le muret de bois (la cible), de la haie de temps en temps ; la carrière : des rochers ; le sous-bois : des haies, des rochers moussus. */
const ECHELLE_ROCHER = 2.1;
interface Mur {
  genre: Genre;
  v: number;
  s: number;
  /** Le poteau d'un muret : il porte des lisses vers ses voisins. */
  poteau: boolean;
}
function murDe(theme: ThemeVu, i: number, j: number, borde: boolean): Mur {
  const r = hash(i, j, 6);
  const v = Math.floor(hash(i, j, 7) * 8);
  if (theme === "prairie") {
    if (borde && r < 0.8) return { genre: "poteau", v, s: 1, poteau: true };
    return { genre: "haie", v, s: 1, poteau: false };
  }
  if (theme === "carriere") {
    if (borde && r > 0.9) return { genre: "poteau", v, s: 1, poteau: true };
    return { genre: "rocher", v, s: ECHELLE_ROCHER * (0.9 + hash(i, j, 8) * 0.3), poteau: false };
  }
  if (r > 0.9 && borde) return { genre: "poteau", v, s: 1, poteau: true };
  if (r < 0.28) return { genre: "rocher", v, s: ECHELLE_ROCHER * (0.85 + hash(i, j, 8) * 0.25), poteau: false };
  return { genre: "haie", v, s: 1, poteau: false };
}
/** La hauteur du sommet le plus haut d'un mur bas d'un thème (mètres, ≤ `MUR_MAX` : on voit toujours par-dessus). */
export function hauteurDesMurs(theme: ThemeVu, a: PaletteMonde = PALETTES[theme]!): number {
  const c: ContexteFabrique = { a, theme };
  let h = 0;
  for (let v = 0; v < 8; v++) {
    const m = murDe(theme, v, 1, true);
    for (const g of [m, { ...m, genre: "haie" as Genre, s: 1 }, { ...m, genre: "rocher" as Genre, s: ECHELLE_ROCHER * 1.2 }].filter((x) => (theme === "prairie" ? x.genre !== "rocher" : theme === "carriere" ? x.genre !== "haie" : true))) h = Math.max(h, hauteurDe(fabriquer(g.genre, c, g.v)) * g.s);
  }
  return h;
}

/** L'habillage d'une case de mur (les bords hors jeu) : de plus en plus petit. Chaque thème a ses grandes pièces (un arbre, une pierre dressée), ses moyennes (buisson, souche) et ses petites (herbe haute, fleurs, champignons, cristaux). */
interface Habille {
  grandes: Genre[];
  moyennes: Genre[];
  petites: Genre[];
}
const HABILLAGE: Record<ThemeVu, Habille> = {
  prairie: { grandes: ["arbre"], moyennes: ["buisson", "buisson", "rocher"], petites: ["herbeHaute", "fleurs", "fleurs", "herbeHaute"] },
  carriere: { grandes: ["pierreDressee", "rocherPointu", "arbre"], moyennes: ["rocher", "caisse", "rocherPointu"], petites: ["cristaux", "herbeHaute", "rocher"] },
  sousbois: { grandes: ["arbre", "arbre", "rocherPointu"], moyennes: ["buisson", "souche", "fougere"], petites: ["fougere", "champignons", "herbeHaute", "fleurs"] },
};
/** Où va une pièce : au vent (végétation basse), grande (arbres : s'efface, vent), ou fixe (relief). */
const CLASSE: Record<Genre, "vent" | "haut" | "fixe"> = {
  rocher: "fixe", poteau: "fixe", haie: "fixe", buisson: "vent", herbeHaute: "vent", fleurs: "vent", arbre: "haut", souche: "fixe", champignons: "fixe", cristaux: "fixe", pilier: "haut", linteau: "haut", planchePont: "fixe", poteauPont: "fixe", caisse: "fixe", fougere: "vent", pierreDressee: "fixe", rocherPointu: "fixe",
};

// --- Les morceaux (sans navigateur : de la géométrie) --------------------------------------------------------------------------------------------------------------------------------------------------
export interface Morceau {
  ci: number;
  cj: number;
  /** Le dessus du sol (calculé dans le matériau), les parois de falaise et les blocs dessous. */
  sol: BufferGeometry | null;
  /** Les murs bas, les rochers et les ponts : opaques. */
  relief: BufferGeometry | null;
  /** La végétation basse (buissons, herbes, fleurs) : opaque, balancée par le vent. */
  vegetation: BufferGeometry | null;
  /** Ce qui est haut (les arbres) : s'efface (transparence) devant le chevalier, balancé par le vent. */
  hauts: BufferGeometry | null;
}
export interface Construit {
  morceaux: Morceau[];
  /** Les nuages (zone en mètres). */
  etendue: { x0: number; x1: number; z0: number; z1: number };
  /** Les cases de mur et ce qu'on y pose (pièces d'habillage), les ponts, et ce qu'il y a d'éléments posés sur une case marchable (doit être 0). */
  stats: { murs: number; decors: number; ponts: number; decorsSurSol: number };
}

function geometrie(positions: number[], couleurs: number[], normales: number[], proc: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(normales), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(couleurs), 3));
  g.setAttribute("proc", new BufferAttribute(new Float32Array(proc), 1));
  return g;
}
/** Un attribut `proc` à 0 sur une forme (une paroi, un bloc : elle garde sa couleur de sommet). */
const sansSol = <T extends BufferGeometry>(g: T): T => {
  g.setAttribute("proc", new BufferAttribute(new Float32Array(g.getAttribute("position").count), 1));
  return g;
};

/** Le décor de toutes les cases, par morceaux. */
export function construireNiveau(n: Niveau, a: PaletteMonde, theme: ThemeVu = themeDe(a)): Construit {
  const ox = n.ox / M;
  const oy = n.oy / M;
  const ctx: ContexteFabrique = { a, theme };
  const cTranche = new Color(a.tranche);
  const cRoche = [new Color(a.falaise), new Color(a.falaise2)];
  const cLevre = new Color(a.herbe);
  const cBlanc = new Color(1, 1, 1);
  const cBois = [new Color(a.bois), new Color(a.bois2)];
  const zone = (i: number, j: number): number => (i < 0 || j < 0 || i >= n.l || j >= n.h ? 0 : n.zones[j * n.l + i]!);
  const type = (i: number, j: number): number => (i < 0 || j < 0 || i >= n.l || j >= n.h ? VIDE : n.cases[j * n.l + i]!);
  const marchable = (i: number, j: number): boolean => type(i, j) === SOL || type(i, j) === PONT;
  const voisin8 = (i: number, j: number, z: readonly number[]): boolean => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && z.includes(zone(i + di, j + dj))) return true;
    return false;
  };
  const borde8 = (i: number, j: number): boolean => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && marchable(i + di, j + dj)) return true;
    return false;
  };
  const nx = Math.ceil(n.l / PAS_MORCEAU);
  const ny = Math.ceil(n.h / PAS_MORCEAU);
  interface Tas {
    pos: number[];
    col: number[];
    nor: number[];
    proc: number[];
    sous: BufferGeometry[];
    relief: BufferGeometry[];
    veg: BufferGeometry[];
    hauts: BufferGeometry[];
  }
  const tas: Tas[] = Array.from({ length: nx * ny }, () => ({ pos: [], col: [], nor: [], proc: [], sous: [], relief: [], veg: [], hauts: [] }));
  const dans = (x: number, z: number): Tas => tas[Math.min(ny - 1, Math.max(0, Math.floor((z - oy) / CM / PAS_MORCEAU))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - ox) / CM / PAS_MORCEAU)))]!;
  const stats = { murs: 0, decors: 0, ponts: 0, decorsSurSol: 0 };
  /** Pose une pièce de la fabrique dans le bon maillage du morceau où tombe (x, z). */
  const poser = (genre: Genre, v: number, x: number, z: number, o: { y?: number; ry?: number; s?: number | readonly [number, number, number] } = {}): void => {
    const T = dans(x, z);
    const g = placer(fabriquer(genre, ctx, v).clone(), { x, y: o.y ?? 0, z, ry: o.ry ?? 0, s: o.s ?? 1 });
    (CLASSE[genre] === "vent" ? T.veg : CLASSE[genre] === "haut" ? T.hauts : T.relief).push(g);
  };

  for (let j = 0; j < n.h; j++) {
    for (let i = 0; i < n.l; i++) {
      const t = type(i, j);
      const z = zone(i, j);
      const x0 = ox + i * CM;
      const z0 = oy + j * CM;
      const x1 = x0 + CM;
      const z1 = z0 + CM;
      const cx = x0 + CM / 2;
      const cz = z0 + CM / 2;
      const T = tas[Math.floor(j / PAS_MORCEAU) * nx + Math.floor(i / PAS_MORCEAU)]!;
      const quad = (p: number[][], nxx: number, nyy: number, nzz: number, c: Color, proc = 0): void => {
        for (const k of [0, 1, 2, 0, 2, 3]) {
          T.pos.push(...p[k]!);
          T.nor.push(nxx, nyy, nzz);
          T.col.push(c.r, c.g, c.b);
          T.proc.push(proc);
        }
      };
      /** La paroi d'un côté ouvert sur le vide : la lèvre d'herbe, puis la pierre ; sa profondeur varie d'un côté à l'autre (une falaise rongée). */
      const flancs = (ouvert: (di: number, dj: number) => boolean): void => {
        const cotes: [number, number, number][] = [[0, -1, 1], [0, 1, 2], [-1, 0, 3], [1, 0, 4]];
        for (const [di, dj, s] of cotes) {
          if (!ouvert(di, dj)) continue;
          const prof = PAROI * (0.8 + hash(i, j, 30 + s) * 0.55);
          const clair = cTranche.clone().multiplyScalar(0.86 + hash(i, j, 40 + s) * 0.2);
          const sombre = cTranche.clone().multiplyScalar(0.72);
          const p = (u: number, y: number): number[] =>
            di === 0 ? [dj < 0 ? x0 + u * CM : x1 - u * CM, y, dj < 0 ? z0 : z1] : [di < 0 ? x0 : x1, y, di < 0 ? z1 - u * CM : z0 + u * CM];
          const nn: [number, number, number] = [di, 0, dj];
          // la lèvre d'herbe, la pierre claire, puis la pierre dans l'ombre (le bas de la paroi)
          quad([p(0, 0), p(1, 0), p(1, -LEVRE), p(0, -LEVRE)], nn[0], nn[1], nn[2], cLevre);
          quad([p(0, -LEVRE), p(1, -LEVRE), p(1, -prof * 0.6), p(0, -prof * 0.6)], nn[0], nn[1], nn[2], clair);
          quad([p(0, -prof * 0.6), p(1, -prof * 0.6), p(1, -prof), p(0, -prof)], nn[0], nn[1], nn[2], sombre);
        }
      };
      if (t === SOL) {
        // Le plateau de l'arène est dessiné par `monterDecor` ; ses cases ne le sont que là où elles touchent le chemin (pas de trou entre le plateau et le chemin qui y entre).
        if (z === Z_ARENE && !voisin8(i, j, [Z_CHEMIN, Z_PORTE])) continue;
        // les cases d'arène qui touchent le chemin sont à peine sous le plateau (qui les recouvre : pas de scintillement, pas de trou)
        const yy = z === Z_ARENE ? -0.04 : 0;
        quad([[x0, yy, z1], [x1, yy, z1], [x1, yy, z0], [x0, yy, z0]], 0, 1, 0, cBlanc, 1);
        flancs((di, dj) => type(i + di, j + dj) === VIDE);
      } else if (t === MUR) {
        // Un mur bas a son pan de rocher et sa lèvre (le mur ne flotte pas au-dessus du vide) et il se tient sur l'herbe.
        if (!voisin8(i, j, [Z_ARENE]) || voisin8(i, j, [Z_CHEMIN, Z_PORTE])) {
          quad([[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], 0, 1, 0, cBlanc, 1);
          flancs((di, dj) => type(i + di, j + dj) === VIDE);
          stats.murs++;
          const borde = borde8(i, j);
          const mur = murDe(theme, i, j, borde);
          const jx = (hash(i, j, 12) - 0.5) * 0.3;
          const jz = (hash(i, j, 13) - 0.5) * 0.3;
          const ry = hash(i, j, 14) * 6.28;
          poser(mur.genre, mur.v, cx + jx, cz + jz, { ry: mur.poteau ? (hash(i, j, 15) - 0.5) * 0.3 : ry, s: mur.s === 1 ? [0.95 + hash(i, j, 8) * 0.15, 1, 0.95 + hash(i, j, 9) * 0.15] : [mur.s, mur.s * (0.85 + hash(i, j, 16) * 0.3), mur.s] });
          // le muret de bois : des lisses jusqu'aux poteaux voisins (devant, à droite, en diagonale)
          if (mur.poteau) {
            for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) {
              if (type(i + di, j + dj) !== MUR || !murDe(theme, i + di, j + dj, borde8(i + di, j + dj)).poteau) continue;
              const L = Math.hypot(di, dj) * CM;
              T.relief.push(placer(rail(ctx, L - 0.7).clone(), { x: cx + (di * CM) / 2, z: cz + (dj * CM) / 2, ry: -Math.atan2(dj, di) }));
            }
          }
          // l'habillage : de grandes pièces (arbres, pierres dressées), des moyennes (buissons, souches), des petites (herbes, fleurs) — un bord hors jeu dense, jamais sur le sol marchable
          const hab = HABILLAGE[theme];
          const pick = (l: readonly Genre[], r: number): Genre => l[Math.floor(r * l.length) % l.length]!;
          let poses = 0;
          if (hash(i, j, 21) < (borde ? 0.1 : 0.2)) {
            const g = pick(hab.grandes, hash(i, j, 22));
            poser(g, Math.floor(hash(i, j, 23) * 4), cx + (hash(i, j, 24) - 0.5) * 0.8, cz + (hash(i, j, 25) - 0.5) * 0.8, { ry: ry, s: 0.9 + hash(i, j, 26) * 0.35 });
            poses++;
          }
          if (hash(i, j, 31) < (borde ? 0.3 : 0.55)) {
            const g = pick(hab.moyennes, hash(i, j, 32));
            const d = 0.5 + hash(i, j, 33) * 0.5;
            const t2 = hash(i, j, 34) * 6.28;
            poser(g, Math.floor(hash(i, j, 35) * 4), cx + Math.cos(t2) * d, cz + Math.sin(t2) * d, { ry: ry, s: 0.85 + hash(i, j, 36) * 0.4 });
            poses++;
          }
          for (let k = 0; k < 2; k++) {
            if (hash(i, j, 41 + k) < 0.5) {
              const g = pick(hab.petites, hash(i, j, 43 + k));
              const d = 0.4 + hash(i, j, 45 + k) * 0.7;
              const t2 = hash(i, j, 47 + k) * 6.28;
              poser(g, Math.floor(hash(i, j, 49 + k) * 4), cx + Math.cos(t2) * d, cz + Math.sin(t2) * d, { y: 0, ry: t2 * 3, s: 0.9 + hash(i, j, 51 + k) * 0.4 });
              poses++;
            }
          }
          stats.decors += poses;
        }
      } else if (t === PONT) {
        stats.ponts++;
        // Un pont : des planches en travers, deux longerons dessous, des poteaux de rambarde du côté du vide et une corde, un pilier de temps en temps.
        const dX = marchable(i - 1, j) || marchable(i + 1, j); // le pont court selon x
        const dZ = marchable(i, j - 1) || marchable(i, j + 1);
        const alongX = dX && !(dZ && !dX);
        const planche = fabriquer("planchePont", ctx, 0);
        for (let k = 0; k < 4; k++) {
          const o = -0.75 + k * 0.5;
          const col = cBois[(k + i + j) % 2]!.getHex();
          T.relief.push(colorier(placer(planche.clone(), { x: cx + (alongX ? o : 0), y: -0.06, z: cz + (alongX ? 0 : o), ry: alongX ? 0 : Math.PI / 2 }), [col, cBois[(k + i + j + 1) % 2]!.getHex()], i * 7 + j * 3 + k));
        }
        for (const s of [-0.62, 0.62]) T.relief.push(teindre(placer(new BoxGeometry(alongX ? CM : 0.2, 0.18, alongX ? 0.2 : CM), { x: cx + (alongX ? 0 : s), y: -0.2, z: cz + (alongX ? s : 0) }), a.bois2));
        for (const s of [-1, 1]) {
          const di = alongX ? 0 : s;
          const dj = alongX ? s : 0;
          if (type(i + di, j + dj) !== VIDE) continue;
          const px = cx + di * (CM / 2 - 0.1);
          const pz = cz + dj * (CM / 2 - 0.1);
          T.relief.push(placer(fabriquer("poteauPont", ctx, 0).clone(), { x: px, z: pz }));
          T.relief.push(teindre(placer(new BoxGeometry(alongX ? CM : 0.08, 0.08, alongX ? 0.08 : CM), { x: px, y: 0.8, z: pz }), a.bois));
          T.relief.push(teindre(placer(new BoxGeometry(alongX ? CM : 0.06, 0.06, alongX ? 0.06 : CM), { x: px, y: 0.45, z: pz }), a.bois2));
        }
        if ((i + j) % 3 === 0) T.relief.push(teindre(placer(new BoxGeometry(0.34, 6, 0.34), { x: cx, y: -3.2, z: cz }), a.bois2));
      }
    }
  }

  // Sous chaque clairière : de gros blocs rocheux qui rétrécissent vers le bas, des pierres PENDANTES (l'île flotte) ; sous un chemin, des blocs tous les ~7 m et une pierre pendante.
  const rnd = aleatoire(77);
  const roc = (x: number, z: number, taille: number, creux: number, graine: number): void => {
    const k = 0.8 + rnd() * 0.4;
    dans(x, z).sous.push(sansSol(placer(bloc(taille * k * 1.3, taille * k * 1.5, taille * k * 1.3, { couleur: cRoche[graine % 2]!.getHex(), dessus: a.falaise2, variation: 0.12, graine, rayon: taille * 0.3, irregulier: 0.1, segments: 1 }), { x, y: -PAROI * 0.7 - creux - taille * 0.6, z, ry: rnd() * 3 })));
  };
  const pendante = (x: number, z: number, taille: number, creux: number, graine: number): void => {
    dans(x, z).sous.push(sansSol(colorier(placer(roche(taille, graine, { detail: 1, bruit: 0.2, etire: [0.75, 1.9, 0.75] }), { x, y: -PAROI * 0.8 - creux - taille * 1.4, z, ry: rnd() * 3 }), [a.falaise, a.falaise2, a.tranche], graine)));
  };
  n.clairieres.forEach((c, ci) => {
    if (c.genre === "arene") return;
    const r = c.r / M;
    const x = c.x / M;
    const z = c.y / M;
    roc(x, z, r * 0.55, 0.0, 600 + ci * 7);
    for (let k = 0; k < 4; k++) {
      const t = ((k + rnd() * 0.6) / 4) * Math.PI * 2;
      roc(x + Math.cos(t) * r * 0.55, z + Math.sin(t) * r * 0.55, r * 0.34, 0.1 + rnd() * 0.5, 610 + ci * 7 + k);
      pendante(x + Math.cos(t + 0.4) * r * 0.8, z + Math.sin(t + 0.4) * r * 0.8, r * 0.14, rnd() * 0.5, 800 + ci * 11 + k);
    }
    roc(x + (rnd() - 0.5) * r * 0.4, z + (rnd() - 0.5) * r * 0.4, r * 0.3, r * 0.5, 650 + ci);
    pendante(x, z, r * 0.2, r * 0.6, 900 + ci);
  });
  for (const l of n.liens) {
    if (l.pont) continue;
    const A = n.clairieres[l.a]!;
    const B = n.clairieres[l.b]!;
    const L = Math.hypot(B.x - A.x, B.y - A.y) / M;
    for (let s = 5; s < L - 5; s += 7) {
      const u = s / L;
      roc((A.x + (B.x - A.x) * u) / M, (A.y + (B.y - A.y) * u) / M, 2.0, 0, 700 + Math.round(s));
      if (Math.round(s) % 2 === 0) pendante((A.x + (B.x - A.x) * u) / M + (rnd() - 0.5) * 1.5, (A.y + (B.y - A.y) * u) / M + (rnd() - 0.5) * 1.5, 0.9, 0.4, 1000 + Math.round(s));
    }
  }

  const morceaux: Morceau[] = [];
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  tas.forEach((T, k) => {
    const sol = T.pos.length > 0 || T.sous.length > 0 ? fusionner([...(T.pos.length > 0 ? [geometrie(T.pos, T.col, T.nor, T.proc)] : []), ...T.sous]) : null;
    const relief = T.relief.length > 0 ? fondre(T.relief) : null;
    const vegetation = T.veg.length > 0 ? fondre(T.veg) : null;
    const hauts = T.hauts.length > 0 ? fondre(T.hauts) : null;
    if (!sol && !relief && !hauts && !vegetation) return;
    const ci = k % nx;
    const cj = Math.floor(k / nx);
    x0 = Math.min(x0, ox + ci * PAS_MORCEAU * CM);
    x1 = Math.max(x1, ox + (ci + 1) * PAS_MORCEAU * CM);
    z0 = Math.min(z0, oy + cj * PAS_MORCEAU * CM);
    z1 = Math.max(z1, oy + (cj + 1) * PAS_MORCEAU * CM);
    morceaux.push({ ci, cj, sol, relief, vegetation, hauts });
  });
  return { morceaux, etendue: { x0, x1, z0, z1 }, stats };
}

// --- Le fondu des éléments entre la caméra et le chevalier --------------------------------------------------------------------------------------------------------------------------
/** Ce qui s'efface : tout ce qui est HAUT (les arbres) et à moins de `RAYON_FONDU` mètres du segment caméra → chevalier, plus près de la caméra que lui, tombe à `OPACITE_FONDU` d'opacité. */
export const RAYON_FONDU = 1.7;
export const OPACITE_FONDU = 0.25;

interface UniformsFondu {
  uChev: { value: Vector3 };
  uCam: { value: Vector3 };
}

/** Le matériau de ce qui est HAUT (les arbres, les piliers, les bannières) : un toon à couleurs par sommet, transparent, dont l'opacité tombe à `OPACITE_FONDU` s'il est entre la caméra et le chevalier, balancé par le vent. Une vraie transparence (la profondeur est
 * écrite : le contour par la profondeur cerne la silhouette de l'arbre, sans semer l'image de points d'encre). (Un tramage de Bayer par `discard` a été essayé : avec le contour par la profondeur il donne un nuage de points d'encre.) */
export function matiereHauts(u: UniformsFondu): MeshToonMaterial {
  const m = plat(0xffffff, true, 0);
  m.transparent = true;
  m.depthWrite = true;
  m.onBeforeCompile = (sh) => {
    injecterVent(sh);
    sh.uniforms.uChev = u.uChev;
    sh.uniforms.uCam = u.uCam;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vMonde;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vMonde; uniform vec3 uChev; uniform vec3 uCam;").replace(
      "#include <opaque_fragment>",
      `{
          vec3 ab = uChev - uCam; float L = length(ab); vec3 d = ab / L;
          float s = dot(vMonde - uCam, d);
          float r = length(vMonde - uCam - d * s);
          float proche = 1.0 - smoothstep(L - 1.6, L - 0.6, s);
          float dans = (1.0 - smoothstep(${RAYON_FONDU.toFixed(2)} - 0.5, ${RAYON_FONDU.toFixed(2)}, r)) * proche * step(0.0, s);
          diffuseColor.a *= mix(1.0, ${OPACITE_FONDU.toFixed(2)}, dans);
        }
        #include <opaque_fragment>`,
    );
  };
  m.customProgramCacheKey = () => "rush-hauts-fondu-vent";
  return m;
}

// --- Les îles lointaines ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Les îles lointaines d'un bloc de 64 m : un plateau d'herbe, de la roche dessous qui s'effile, un arbre ou un rocher ; elles évitent le niveau (rien à moins de 14 m d'une case). Même hasard à chaque lancement (graine du bloc). */
function ilesDuBloc(a: PaletteMonde, theme: ThemeVu, zone: { x0: number; x1: number; z0: number; z1: number }, graine: number, occupe: (x: number, z: number) => boolean): BufferGeometry | null {
  const rnd = aleatoire(graine);
  const ctx: ContexteFabrique = { a, theme };
  const formes: BufferGeometry[] = [];
  const n = Math.max(1, Math.round(((zone.x1 - zone.x0) * (zone.z1 - zone.z0)) / 2600));
  for (let k = 0; k < n; k++) {
    const x = zone.x0 + rnd() * (zone.x1 - zone.x0);
    const z = zone.z0 + rnd() * (zone.z1 - zone.z0);
    const r = 3.4 + rnd() * 4.6;
    const y = -9 - rnd() * 26;
    if (occupe(x, z)) continue;
    formes.push((placer(bloc(r * 2, 1.5, r * 2, { couleur: a.herbe, dessus: a.herbe2, variation: 0.1, graine: 1500 + k, rayon: 0.65, irregulier: 0.05, segments: 2 }), { x, y, z })));
    formes.push((placer(bloc(r * 1.7, r * 1.3, r * 1.7, { couleur: a.falaise, dessus: a.falaise2, variation: 0.1, graine: 1550 + k, rayon: r * 0.5, irregulier: 0.08, segments: 2 }), { x, y: y - 0.75 - r * 0.65, z })));
    formes.push((placer(bloc(r * 0.9, r * 1.2, r * 0.9, { couleur: a.falaise2, dessus: a.falaise2, graine: 1570 + k, rayon: r * 0.3, segments: 2 }), { x: x + r * 0.1, y: y - 1.3 - r * 1.4, z: z - r * 0.1 })));
    const dr = rnd();
    const g: Genre = dr < 0.55 ? "arbre" : dr < 0.8 ? "buisson" : "rocher";
    formes.push(placer(fabriquer(g, ctx, Math.floor(rnd() * 3)).clone(), { x: x + (rnd() - 0.5) * r * 0.7, y: y + 0.75, z: z + (rnd() - 0.5) * r * 0.7, ry: rnd() * 6, s: 0.8 + rnd() * 0.5 }));
  }
  return formes.length > 0 ? fondre(formes) : null;
}

// --- La salle d'épreuve : le cercle au sol --------------------------------------------------------------------------------------------------------------------------------------------------------
/** Le cercle de la salle d'épreuve : trois anneaux incrustés dans le sol (de l'intérieur vers l'extérieur : un par vague) qui s'allument un à un (violet et or : jamais de rouge) ; la vague en cours pulse ; l'épreuve finie, tous restent allumés. */
function cercleDeLEpreuve(r: number): { maillage: Mesh; maj(vague: number, etat: number, temps: number): void; detruire(): void } {
  const matiere = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: DoubleSide,
    uniforms: { uVague: { value: 0 }, uTemps: { value: 0 }, uFini: { value: 0 } },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec2 vP; uniform float uVague; uniform float uTemps; uniform float uFini;
      float anneau(float rho, float c, float l){ return 1.0 - smoothstep(l, l + 0.012, abs(rho - c)); }
      void main(){
        float rho = length(vP) / ${r.toFixed(3)};
        if (rho > 1.0) discard;
        float ang = atan(vP.y, vP.x);
        vec3 violet = vec3(0.56, 0.44, 0.84); vec3 dore = vec3(1.0, 0.86, 0.42);
        vec3 col = vec3(0.0); float alpha = 0.0;
        // l'incrustation sombre (toujours là) : trois anneaux, douze encoches sur le dernier
        float incr = 0.0; float lum = 0.0; float halo = 0.0;
        for (int k = 0; k < 3; k++) {
          float c = 0.32 + 0.27 * float(k) + 0.015 * float(k / 2);
          float a = anneau(rho, c, 0.018);
          float allume = clamp(uVague - float(k), 0.0, 1.0);
          if (uFini > 0.5) allume = 1.0;
          bool courant = (uFini < 0.5) && (uVague > float(k)) && (uVague <= float(k) + 1.0);
          float pulse = courant ? 0.75 + 0.25 * sin(uTemps * 5.0) : 1.0;
          incr = max(incr, a);
          lum = max(lum, a * allume * pulse);
          halo = max(halo, (1.0 - smoothstep(0.018, 0.075, abs(rho - c))) * allume * pulse * 0.5);
        }
        float tick = (1.0 - smoothstep(0.02, 0.05, abs(fract(ang / 6.28318 * 12.0) - 0.5))) * step(0.9, rho) * (1.0 - step(0.97, rho));
        incr = max(incr, tick);
        float lumTick = tick * clamp(uVague - 2.0, 0.0, 1.0);
        vec3 inlay = vec3(0.22, 0.16, 0.1);
        col = mix(inlay, mix(violet, dore, 0.5 + 0.5 * sin(uTemps * 2.0)), clamp(lum + lumTick, 0.0, 1.0)) * 1.0;
        alpha = max(incr * 0.4, clamp(lum + lumTick, 0.0, 1.0) * 0.92);
        col = mix(col, dore * 1.35, clamp(halo, 0.0, 1.0) * 0.6 * (1.0 - alpha));
        alpha = max(alpha, halo * 0.55);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  // le plan est couché après coup : `vP` (position.xy du plan debout) est le point du sol (x, −z), le cercle est symétrique
  const plan = new PlaneGeometry(2 * r, 2 * r);
  const m = new Mesh(plan, matiere);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.025;
  m.renderOrder = 1;
  m.frustumCulled = true;
  return {
    maillage: m,
    maj(vague, etat, temps) {
      matiere.uniforms.uVague!.value = etat === 1 ? vague : 0;
      matiere.uniforms.uFini!.value = etat === 2 ? 1 : 0;
      matiere.uniforms.uTemps!.value = temps;
    },
    detruire() {
      plan.dispose();
      matiere.dispose();
    },
  };
}

export interface NiveauVu {
  groupe: Group;
  /** La texture du ciel (`scene.background`). */
  ciel: Texture;
  /** À chaque image : le chevalier et la caméra (mètres) pour le fondu des éléments entre eux, et la fermeture de la barrière (0 ouverte, 1 fermée). */
  /** `fermeture` : la barrière de l'arène (0 à 1) ; `fermetureEpreuve` (lot BR6) : les deux portes de la salle d'épreuve (0 ouvertes, 1 fermées) ; `etat` (lot BR-A2) : le temps (le vent), la vague et l'état de l'épreuve, la qualité. */
  maj(chevalier: { x: number; z: number }, camera: Vector3, fermeture: number, fermetureEpreuve?: number, etat?: EtatDecor): void;
  detruire(): void;
}

export interface OptionsNiveauVu {
  /** L'indice du boss du jour : l'arène porte ses couleurs (bannières, anneau au sol). */
  boss?: number;
}

export function monterNiveauVu(n: Niveau, a: PaletteMonde, theme: ThemeVu = themeDe(a), opt: OptionsNiveauVu = {}): NiveauVu {
  const groupe = new Group();
  const c = construireNiveau(n, a, theme);
  const uniforms: UniformsFondu = { uChev: { value: new Vector3() }, uCam: { value: new Vector3(0, 100, 100) } };
  const mRelief = plat(0xffffff, true, 0);
  const mHauts = matiereHauts(uniforms);
  const sol = matiereDuSol(a, n);
  const mSol = sol.matiere;
  const mVeg = platVent();
  const geos: BufferGeometry[] = [];
  for (const m of c.morceaux) {
    if (m.sol) {
      geos.push(m.sol);
      const s = new Mesh(m.sol, mSol);
      s.receiveShadow = true;
      groupe.add(s);
    }
    if (m.relief) {
      geos.push(m.relief);
      const p = piece(m.relief, 0xffffff, true, true, mRelief);
      p.corps.castShadow = true;
      p.corps.receiveShadow = true;
      groupe.add(p.groupe);
    }
    if (m.vegetation) {
      geos.push(m.vegetation);
      const v = piece(m.vegetation, 0xffffff, true, true, mVeg);
      v.corps.castShadow = false;
      v.corps.receiveShadow = true;
      groupe.add(v.groupe);
    }
    if (m.hauts) {
      geos.push(m.hauts);
      const h = new Mesh(m.hauts, mHauts);
      h.castShadow = true;
      h.receiveShadow = true;
      h.renderOrder = 2;
      groupe.add(h);
    }
  }
  // Les îles lointaines et les nuages : sur toute l'étendue du niveau, par blocs de 64 m (chacun son maillage : le moteur coupe ceux qui sortent du champ), à peu de triangles.
  const marge = 70;
  const BLOC = 64;
  const etendue = { x0: c.etendue.x0 - marge, x1: c.etendue.x1 + marge, z0: c.etendue.z0 - marge, z1: c.etendue.z1 + marge };
  const mNuage = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.96, depthWrite: false });
  const mIle = platVent();
  const occupe = (x: number, z: number): boolean => {
    const i0 = Math.floor((x - n.ox / M) / CM);
    const j0 = Math.floor((z - n.oy / M) / CM);
    const r = 8;
    for (let dj = -r; dj <= r; dj += 2) for (let di = -r; di <= r; di += 2) {
      const i = i0 + di;
      const j = j0 + dj;
      if (i >= 0 && j >= 0 && i < n.l && j < n.h && n.cases[j * n.l + i] !== VIDE) return true;
    }
    return false;
  };
  for (let bz = etendue.z0, k = 0; bz < etendue.z1; bz += BLOC) {
    for (let bx = etendue.x0; bx < etendue.x1; bx += BLOC, k++) {
      const zone = { x0: bx, x1: Math.min(etendue.x1, bx + BLOC), z0: bz, z1: Math.min(etendue.z1, bz + BLOC) };
      const gn = nuages(a, zone, 13 + k);
      geos.push(gn);
      const nu = new Mesh(gn, mNuage);
      nu.renderOrder = -1;
      groupe.add(nu);
      const gi = ilesDuBloc(a, theme, zone, 2000 + k, occupe);
      if (gi) {
        geos.push(gi);
        const ile = new Mesh(gi, mIle);
        groupe.add(ile);
      }
    }
  }
  // La barrière de l'arène : une palissade de pieux pointus en travers de la porte, qui sort du sol quand elle se referme.
  const porte = new Group();
  const ax = n.arene.x / M;
  const az = n.arene.y / M;
  const dirA = (n.arene.dir * Math.PI * 2) / 128;
  const R = RAYON_ARENE / M;
  porte.position.set(ax + Math.cos(dirA) * (R + 0.5), 0, az + Math.sin(dirA) * (R + 0.5));
  porte.rotation.y = -dirA;
  const pieux: BufferGeometry[] = [];
  for (let k = 0; k < 8; k++) {
    const h = 1.9 + (k % 2) * 0.4;
    const z = (k - 3.5) * 0.92;
    pieux.push(teindre(placer(new BoxGeometry(0.62, h, 0.62), { x: 0, y: h / 2, z }), k % 2 ? a.bois : a.bois2), teindre(placer(new ConeGeometry(0.44, 0.7, 4), { x: 0, y: h + 0.35, z, ry: Math.PI / 4 }), a.bois2));
  }
  pieux.push(teindre(placer(new BoxGeometry(0.4, 0.3, 7.6), { x: 0.3, y: 0.7 }), a.bois), teindre(placer(new BoxGeometry(0.4, 0.3, 7.6), { x: 0.3, y: 1.4 }), a.bois));
  const gPorte = fusionner(pieux);
  geos.push(gPorte);
  // La palissade reste OPAQUE (elle doit se lire) ; basse de deux mètres, on voit par-dessus.
  const palissade = piece(gPorte, 0xffffff, true, true, mRelief);
  palissade.corps.castShadow = true;
  porte.add(palissade.groupe);
  porte.visible = false;
  groupe.add(porte);
  // Lot BR6 : les deux portes de la salle d'épreuve : la même palissade, en travers de chacun des deux liens du chemin principal qui touchent la salle, à 2 m du bord de la salle.
  const portesEpreuve: Group[] = [];
  const E = n.epreuve;
  for (const k of n.liens) {
    if (!k.principal || (k.a !== E.clairiere && k.b !== E.clairiere)) continue;
    const autre = n.clairieres[k.a === E.clairiere ? k.b : k.a]!;
    const dir = Math.atan2(autre.y - E.y, autre.x - E.x);
    const g = new Group();
    g.position.set(E.x / M + Math.cos(dir) * (E.r / M + 2.2), 0, E.y / M + Math.sin(dir) * (E.r / M + 2.2));
    g.rotation.y = -dir;
    g.scale.z = Math.max(0.6, (2 * k.l) / M / 7.6);
    const pal = piece(gPorte, 0xffffff, true, true, mRelief);
    pal.corps.castShadow = true;
    g.add(pal.groupe);
    g.visible = false;
    groupe.add(g);
    portesEpreuve.push(g);
  }
  // Lot BR-A2 : le cercle au sol de la salle d'épreuve (trois anneaux qui s'allument à chaque vague).
  const cercle = cercleDeLEpreuve((E.r / M) * 0.95);
  cercle.maillage.position.x = E.x / M;
  cercle.maillage.position.z = E.y / M;
  groupe.add(cercle.maillage);
  // L'arène : plateau, muret OUVERT à l'entrée (l'angle de la porte), entrée marquée de deux piliers, bannières du boss, île.
  const decor: Decor = monterDecor(R, a, { niveau: true, ouverture: { angle: dirA, largeur: 7.4 }, boss: opt.boss, hauts: mHauts, centre: { x: ax, z: az }, origine: { x: n.ox / M, z: n.oy / M } });
  decor.groupe.position.set(ax, 0, az);
  groupe.add(decor.groupe);
  return {
    groupe,
    ciel: decor.ciel,
    maj(chev, cam, fermeture, fermetureEpreuve = 0, etat) {
      uniforms.uChev.value.set(chev.x, 0.9, chev.z);
      uniforms.uCam.value.copy(cam);
      porte.visible = fermeture > 0.01;
      porte.scale.y = Math.max(0.01, Math.min(1, fermeture));
      for (const g of portesEpreuve) {
        g.visible = fermetureEpreuve > 0.01;
        g.scale.y = Math.max(0.01, Math.min(1, fermetureEpreuve));
      }
      if (etat) {
        VENT.temps.value = etat.temps;
        VENT.force.value = etat.qualite === "haute" ? 1 : 0;
        cercle.maj(etat.vague, etat.epreuve, etat.temps);
      }
      decor.maj?.(chev, cam, fermeture, fermetureEpreuve, etat);
    },
    detruire() {
      for (const g of geos) g.dispose();
      mRelief.dispose();
      mHauts.dispose();
      mNuage.dispose();
      mVeg.dispose();
      mIle.dispose();
      sol.detruire();
      cercle.detruire();
      decor.detruire();
    },
  };
}

/** Pour les tests : le thème de chaque palette connue. */
export const THEMES_VUS: readonly ThemeVu[] = ["prairie", "carriere", "sousbois"];
