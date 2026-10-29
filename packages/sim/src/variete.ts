import { curveSize, exitDelta, isCurve, parseToken, turnsLeft } from "./track";

// Variété des circuits (lot V2) : ce qui fait qu'un circuit « se joue pareil » qu'un autre, lu dans le texte des blocs seul (pur, sans le générateur ni le pilote).
// Sert au générateur (le motif « boost → longue ligne droite → virage serré », compté en posant chaque figure), à la mesure (`npm run mesure-circuits`) et aux tests.
//
// - **Éléments** : la suite des blocs ramenée à ce que le pilote voit — `boost` (plaque ou super turbo), `droite` (une ou deux droites), `longue` (trois droites ou plus,
//   96 m et plus), `serré` / `large` / `ample` (virages d'une, deux, trois cellules), `relevé`, `montée`, `descente`, `saut` (rampe et vide), `cuve`, `bosse`, `coupé`.
//   Les suites de deux et trois éléments sont les « motifs » (`motifs`) ; une `droite` courte n'est qu'une liaison : elle n'entre pas dans les motifs.
// - **Le motif « boost → longue ligne droite → virage serré »** (`motifsBoostSerre`) : une plaque ou un super turbo, puis au moins trois blocs droits (droites, pentes,
//   d'autres plaques), puis un virage serré. C'est l'enchaînement que les joueurs voyaient revenir.
// - **Profil** (`profilCircuit`) : lignes droites, rayons des virages, largeur de la route, route sans rebords, dénivelé, changements de direction, part de chaque élément ; `distanceProfils` : une distance simple
//   (moyenne des écarts des grandeurs ramenées entre 0 et 1).

export type Element = "boost" | "droite" | "longue" | "serré" | "large" | "ample" | "relevé" | "montée" | "descente" | "saut" | "cuve" | "bosse" | "coupé";
export const ELEMENTS: readonly Element[] = ["boost", "droite", "longue", "serré", "large", "ample", "relevé", "montée", "descente", "saut", "cuve", "bosse", "coupé"];

/** Droites d'affilée (blocs) à partir desquelles une ligne droite est « longue » : 3 blocs = 96 m. */
export const LONGUE = 3;

/** Les blocs d'un texte, sans le départ ni l'arrivée (ce sont des droites qui ne se jouent pas). */
const blocs = (spec: string): string[] => spec.split(" ").filter((t) => t && !t.includes("@start") && !t.includes("@finish"));

/** Un bloc droit au sens de la géométrie : droite (revêtement, largeur, repère compris), plaque, super turbo, pente d'une cellule. */
function droitGeometrique(token: string): boolean {
  const p = parseToken(token);
  return !p.cuve && (p.kind === "straight" || p.kind === "boost" || p.kind === "turbo" || p.kind === "up" || p.kind === "down");
}

/** Nombre de motifs « boost → longue ligne droite → virage serré » d'une suite de blocs (un par virage serré au plus). */
export function motifsBoostSerre(tokens: readonly string[]): number {
  let n = 0;
  // Pour chaque virage serré, on remonte la ligne droite qui le précède : une plaque ou un super turbo, puis au moins `LONGUE` blocs droits jusqu'au virage.
  for (let i = 0; i < tokens.length; i++) {
    const p = parseToken(tokens[i]!);
    if (!isCurve(p.kind) || curveSize(p.kind) !== 1) continue;
    let apres = 0;
    for (let j = i - 1; j >= 0 && droitGeometrique(tokens[j]!); j--) {
      const k = parseToken(tokens[j]!).kind;
      if ((k === "boost" || k === "turbo") && apres >= LONGUE) {
        n++;
        break;
      }
      apres++;
    }
  }
  return n;
}

/** Les éléments d'un texte de circuit (voir l'en-tête). */
export function elementsOf(spec: string): Element[] {
  const out: Element[] = [];
  let droites = 0;
  const finDroite = () => {
    if (droites > 0) out.push(droites >= LONGUE ? "longue" : "droite");
    droites = 0;
  };
  const push = (e: Element) => {
    finDroite();
    // Une pente de plusieurs blocs, un saut (rampe et vide), une cuve : un seul élément.
    if ((e === "montée" || e === "descente" || e === "saut" || e === "cuve") && out[out.length - 1] === e) return;
    out.push(e);
  };
  for (const t of blocs(spec)) {
    const p = parseToken(t);
    if (p.cuve) push("cuve");
    else if (isCurve(p.kind)) push(p.banked ? "relevé" : curveSize(p.kind) === 1 ? "serré" : curveSize(p.kind) === 2 ? "large" : "ample");
    else if (p.kind === "straight") droites++;
    else if (p.kind === "boost" || p.kind === "turbo") push("boost");
    else if (p.kind === "up") push("montée");
    else if (p.kind === "down") push("descente");
    else if (p.kind === "kick" || p.kind === "gap" || p.kind === "jump") push("saut");
    else if (p.kind === "bump") push("bosse");
    else if (p.kind === "cut") push("coupé");
  }
  finDroite();
  return out;
}

/** Les motifs de longueur `n` (2 ou 3) d'un circuit : suites d'éléments sans les droites courtes (`a → b → c`), chacun une fois. */
export function motifs(spec: string, n: number): Set<string> {
  const e = elementsOf(spec).filter((x) => x !== "droite");
  const out = new Set<string>();
  for (let i = 0; i + n <= e.length; i++) out.add(e.slice(i, i + n).join(" → "));
  return out;
}

/** Le motif « boost → longue ligne droite → virage serré » tel que `motifs(…, 3)` l'écrit. */
export const MOTIF_BOOST_SERRE = "boost → longue → serré";

/** Rayon d'axe (m) d'un virage serré, large, ample. */
const RAYON: Record<1 | 2 | 3, number> = { 1: 16, 2: 48, 3: 80 };

export interface ProfilCircuit {
  /** Longueur moyenne et plus longue des lignes droites (blocs droits d'affilée : droites, plaques, pentes), en blocs. */
  droiteMoyenne: number;
  droiteMax: number;
  /** Part des lignes droites de trois blocs ou plus. */
  partLongues: number;
  /** Rayon moyen des virages (m) et part des virages serrés, larges, amples. */
  rayonMoyen: number;
  partSerres: number;
  partLarges: number;
  partAmples: number;
  virages: number;
  /** Dénivelé (m, du point le plus bas au plus haut) et montée cumulée (m). */
  denivele: number;
  montee: number;
  /** Part des blocs sans rebords (modificateur `o`, ou au bord du vide `~v`). */
  ouverte: number;
  /** Largeur moyenne de la route (m, 14 à 26). */
  largeur: number;
  /** Changements de direction : un virage qui tourne dans l'autre sens que le précédent. */
  changements: number;
  /** Part des blocs de chaque élément (les droites comptées bloc par bloc). */
  parts: Record<Element, number>;
  blocs: number;
}

/** Le profil d'un circuit (voir `ProfilCircuit`). */
export function profilCircuit(spec: string): ProfilCircuit {
  const tokens = blocs(spec);
  const runs: number[] = [];
  let run = 0;
  const radii: number[] = [];
  const tailles = { 1: 0, 2: 0, 3: 0 };
  let sens: boolean | null = null;
  let changements = 0;
  let y = 0;
  let hi = 0;
  let lo = 0;
  let montee = 0;
  let w = 14;
  let largeurs = 0;
  let bord: string | undefined;
  let ouverts = 0;
  const comptes = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  for (const t of tokens) {
    const p = parseToken(t);
    largeurs += p.width ? (p.width.w0 + p.width.w1) / 2 : w;
    if (p.width) w = p.width.w1;
    if (p.edge) bord = p.edge;
    if (p.open || bord === "void") ouverts++;
    if (droitGeometrique(t)) run++;
    else {
      if (run > 0) runs.push(run);
      run = 0;
    }
    if (isCurve(p.kind) && !p.cuve) {
      const s = curveSize(p.kind);
      radii.push(RAYON[s]);
      tailles[s]++;
      const gauche = turnsLeft(p.kind);
      if (sens !== null && gauche !== sens) changements++;
      sens = gauche;
    }
    const dy = exitDelta(p.kind, p.rise);
    if (dy > 0) montee += dy;
    y += dy;
    hi = Math.max(hi, y);
    lo = Math.min(lo, y);
    const e = p.cuve ? "cuve" : isCurve(p.kind) ? (p.banked ? "relevé" : curveSize(p.kind) === 1 ? "serré" : curveSize(p.kind) === 2 ? "large" : "ample") : p.kind === "straight" ? "droite" : p.kind === "boost" || p.kind === "turbo" ? "boost" : p.kind === "up" ? "montée" : p.kind === "down" ? "descente" : p.kind === "bump" ? "bosse" : p.kind === "cut" ? "coupé" : "saut";
    comptes[e]++;
  }
  if (run > 0) runs.push(run);
  const n = Math.max(1, tokens.length);
  const v = Math.max(1, radii.length);
  for (const e of ELEMENTS) comptes[e] /= n;
  return {
    droiteMoyenne: runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 0,
    droiteMax: runs.length ? Math.max(...runs) : 0,
    partLongues: runs.length ? runs.filter((r) => r >= LONGUE).length / runs.length : 0,
    rayonMoyen: radii.length ? radii.reduce((a, b) => a + b, 0) / radii.length : 0,
    partSerres: tailles[1] / v,
    partLarges: tailles[2] / v,
    partAmples: tailles[3] / v,
    virages: radii.length,
    denivele: hi - lo,
    montee,
    largeur: largeurs / n,
    ouverte: ouverts / n,
    changements,
    parts: comptes,
    blocs: tokens.length,
  };
}

/**
 * Les grandeurs d'un profil ramenées entre 0 et 1 (bornes choisies sur la mesure : une ligne droite de 12 blocs, un dénivelé de 48 m, 12 changements de direction, la route de 14 à 26 m…),
 * plus le temps de l'auteur (30 à 40 s) s'il est donné.
 */
export function vecteurProfil(p: ProfilCircuit, authorMs?: number): number[] {
  const c = (x: number) => Math.max(0, Math.min(1, x));
  const v = [
    c(p.droiteMoyenne / 6),
    c(p.droiteMax / 12),
    p.partLongues,
    c((p.rayonMoyen - 16) / 64),
    p.partSerres,
    p.partAmples,
    c(p.denivele / 48),
    c(p.montee / 64),
    c(p.changements / 12),
    c((p.largeur - 14) / 12),
    c(p.ouverte * 3),
    c(p.parts.boost * 8),
    c(p.parts.saut * 8),
    c(p.parts.cuve * 8),
    c((p.parts.montée + p.parts.descente) * 3),
  ];
  if (authorMs !== undefined) v.push(c((authorMs - 30_000) / 10_000));
  return v;
}

/** Distance de deux profils (vecteurs de `vecteurProfil`) : la moyenne des écarts absolus, de 0 (identiques) à 1. */
export function distanceProfils(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - (b[i] ?? 0));
  return s / Math.max(1, a.length);
}
