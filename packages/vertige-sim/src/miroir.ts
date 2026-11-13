import type { BlocNiveau, Boite } from "./niveaux";
import { numeroOrientation, ORIENTATIONS, type Dir, type Mat } from "./orientation";
import type { Paire, Portail } from "./portails";
import { lireSolution, type Instruction } from "./solution";
import type { Module, Palier } from "./modules";

// Le miroir gauche / droite d'un module (lot V3) : la symétrie x → −x de sa géométrie, de ses portails, de son palier de sortie et de sa solution. **Une variante peu coûteuse** : elle double la bibliothèque sans
// écrire un module de plus. Le miroir n'est jamais « admis sur parole » : le générateur rejoue la solution du module miroir (`variantes.ts`) comme celle de n'importe quel module, et elle doit arriver, dans les jauges.
// La simulation est symétrique par construction (divisions entières vers zéro, aucun test d'ordre sur le signe), mais seul le rejeu le prouve.

const SYM_X: Mat = [-1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Une orientation vue dans le miroir : S · M · S, où S est la symétrie x → −x (c'est encore une rotation : le déterminant est (−1)² = 1). */
export function orientationMiroir(ori: number): number {
  const m = ORIENTATIONS[ori]!;
  const r = m.map((v, k) => {
    const i = Math.floor(k / 3);
    const j = k % 3;
    const s = (i === 0 ? -1 : 1) * (j === 0 ? -1 : 1);
    return v * s + 0;
  });
  return numeroOrientation(r);
}

const miroirBoite = (b: Boite): Boite => ({ x0: -b.x1 + 0, y0: b.y0, z0: b.z0, x1: -b.x0 + 0, y1: b.y1, z1: b.z1 });
const miroirBloc = (b: BlocNiveau): BlocNiveau => ({ ...b, boite: miroirBoite(b.boite) });
/** Une direction vue dans le miroir : +x et −x s'échangent, les autres ne bougent pas. */
const miroirDir = (d: Dir): Dir => (d === 0 ? 1 : d === 1 ? 0 : d);
const miroirPortail = (p: Portail): Portail => ({ x: -p.x + 0, y: p.y, z: p.z, normale: miroirDir(p.normale), haut: miroirDir(p.haut) });
const miroirPalier = (p: Palier): Palier => ({ x: -p.x + 0, y: p.y, z: p.z, ori: orientationMiroir(p.ori) });

/** Le texte d'une solution vue dans le miroir : `+gauche` ↔ `+droite`, `tourne D` → `tourne −D`. */
export function solutionMiroir(texte: string): string {
  const inverse = (i: Instruction): string => {
    const t = i.texte.replace(/\+gauche|\+droite/g, (m) => (m === "+gauche" ? "+droite" : "+gauche"));
    if (i.nom !== "tourne") return t;
    return t.replace(/^tourne\s+(-?\d+)/, (_m, d: string) => `tourne ${-Number(d) + 0}`);
  };
  return lireSolution(texte).map(inverse).join("; ");
}

/** Le module vu dans le miroir. Son id porte le suffixe `~` (« saut-1~ ») ; une seconde symétrie rend l'original. */
export function miroir(m: Module): Module {
  const base = m.id.endsWith("~") ? m.id.slice(0, -1) : `${m.id}~`;
  return {
    id: base,
    nom: m.nom,
    blocs: m.blocs.map(miroirBloc),
    ...(m.portails ? { portails: m.portails.map((p): Paire => ({ a: miroirPortail(p.a), b: miroirPortail(p.b) })) } : {}),
    entree: miroirPalier(m.entree),
    sortie: miroirPalier(m.sortie),
    etiquettes: m.etiquettes,
    solution: solutionMiroir(m.solution),
  };
}
