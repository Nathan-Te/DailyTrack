import { curveSize, isCurve, parseToken } from "./track";

// Ressemblance entre deux circuits (lot 49) : la mesure qui dit si deux circuits « se ressemblent » au volant. Pure, sans dépendance au
// générateur (elle lit le texte des blocs et les noms des figures), pour la mesure (`IDENTITE=1 npm run measure:generator`) et les tests.
//
// Deux parts, chacune un indice de Jaccard (taille de l'intersection ÷ taille de la réunion, de 0 à 1) :
// - **les figures** : les suites de deux figures consécutives partagées (« bigrammes » : `saut-simple → plaque-virage`), plus les figures
//   elles-mêmes ; deux circuits qui enchaînent les mêmes figures dans le même ordre se jouent pareil ;
// - **les blocs** : les suites de quatre blocs consécutifs (forme seulement : droite, taille de virage et sens relatif au précédent, pente,
//   rampe, vide, plaque, cuve, revêtement), ce qui compte aussi les liaisons et ce que les figures ont en commun sans porter le même nom.
// Ressemblance = la moyenne des deux. Un circuit comparé à lui-même vaut 1 ; deux thèmes sans rien en commun, près de 0.

/** Forme d'un bloc, sans largeur, repère, bas-côté ni sens absolu : `S`, `S:t`, `V2+` (virage large dans le même sens que le précédent)… */
export function blockShape(token: string, previousTurnLeft: boolean | null): { shape: string; left: boolean | null } {
  const p = parseToken(token);
  const surface = p.surface === "road" ? "" : `:${p.surface}`;
  if (isCurve(p.kind)) {
    const left = p.kind.endsWith("L");
    const turn = previousTurnLeft === null ? "" : left === previousTurnLeft ? "+" : "-";
    return { shape: `V${curveSize(p.kind)}${p.banked ? "b" : ""}${p.cuve ? "c" : ""}${turn}${surface}`, left };
  }
  const rise = p.rise !== undefined ? `${Math.round(p.rise / 4)}` : "";
  const letter = p.cuve ? "M" : p.kind === "straight" ? "S" : p.kind;
  return { shape: `${letter}${rise}${surface}`, left: previousTurnLeft };
}

/** Formes des blocs d'un texte de circuit. */
export function shapesOf(spec: string): string[] {
  const out: string[] = [];
  let left: boolean | null = null;
  for (const t of spec.split(" ")) {
    const s = blockShape(t, left);
    out.push(s.shape);
    left = s.left;
  }
  return out;
}

const grams = (items: readonly string[], n: number): Set<string> => {
  const out = new Set<string>();
  for (let i = 0; i + n <= items.length; i++) out.add(items.slice(i, i + n).join(" "));
  return out;
};

/** Indice de Jaccard de deux ensembles (1 s'ils sont vides tous les deux). */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Ce qu'il faut d'un circuit pour le comparer : son texte et les noms de ses figures, dans l'ordre. */
export interface Comparable {
  spec: string;
  figures: readonly string[];
}

/** Empreinte d'un circuit (calculée une fois pour beaucoup de comparaisons). */
export interface Empreinte {
  figures: Set<string>;
  blocs: Set<string>;
}

/** Les figures et leurs enchaînements (bigrammes, marqués `→`), puis les suites de quatre formes de blocs. */
export function empreinte(c: Comparable): Empreinte {
  const figures = new Set<string>(c.figures);
  for (let i = 0; i + 1 < c.figures.length; i++) figures.add(`${c.figures[i]}→${c.figures[i + 1]}`);
  return { figures, blocs: grams(shapesOf(c.spec), 4) };
}

/** Ressemblance de deux circuits, de 0 à 1, et ses deux parts. */
export function ressemblance(a: Empreinte, b: Empreinte): { total: number; figures: number; blocs: number } {
  const figures = jaccard(a.figures, b.figures);
  const blocs = jaccard(a.blocs, b.blocs);
  return { total: (figures + blocs) / 2, figures, blocs };
}

/** Enchaînements de figures (bigrammes) partagés par deux suites de noms. */
export function enchainementsCommuns(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set<string>();
  for (let i = 0; i + 1 < b.length; i++) set.add(`${b[i]}→${b[i + 1]}`);
  const out: string[] = [];
  for (let i = 0; i + 1 < a.length; i++) {
    const k = `${a[i]}→${a[i + 1]}`;
    if (set.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}
