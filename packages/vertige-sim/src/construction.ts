import type { BlocNiveau, Role } from "./niveaux";
import type { Dir } from "./orientation";
import { PORTAIL_DEMI_H, PORTAIL_DEMI_L, PORTAIL_PROFONDEUR, boiteRepere, geo, type Portail } from "./portails";

// Les briques de construction des niveaux (lot V2 : sorties de `niveaux.ts`, pour que les modules les utilisent sans cercle d'imports) : des blocs et des points en mètres, le mur d'un portail, une face à plaque marquée.
// (Des littéraux, pas des produits de `M` ou `CM` importés : ces fonctions tournent à l'initialisation de la bibliothèque de modules, et dans le navigateur les paquets de la construction s'importent en cercle — la valeur
// importée serait encore `undefined`, donc `NaN`. Même règle que pour les constantes des portails.)
const MICRO = 1_000_000;
/** Des mètres en micromètres, ENTIERS (un produit flottant comme 1,1 × 10⁶ n'en est pas un : l'état de la simulation n'a que des entiers). */
export const um = (v: number): number => Math.round(v * MICRO);
/** Un bloc par ses bornes, en mètres (x0, y0, z0, x1, y1, z1). */
export const bm = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, role: Role = "pierre", gravite = false): BlocNiveau => ({
  boite: { x0: um(x0), y0: um(y0), z0: um(z0), x1: um(x1), y1: um(y1), z1: um(z1) },
  role,
  ...(gravite ? { gravite: true } : {}),
});
/** Un point en mètres. */
export const pm = (x: number, y: number, z: number): { x: number; y: number; z: number } => ({ x: um(x), y: um(y), z: um(z) });

/** Le mur d'un portail : une dalle de 1,2 m d'épaisseur derrière le plan (face avant sur le plan), percée de l'ouverture sur `PORTAIL_PROFONDEUR` — une poche vide fermée par 0,2 m de pierre. `demi` : demi-largeur du mur, `bas` et `haut` : ce qui reste sous et au-dessus du centre. */
export function murDePortail(p: Portail, demi: number, bas: number, haut: number, role: Role = "pierre"): BlocNiveau[] {
  const g = geo(p);
  const T = PORTAIL_PROFONDEUR + 200_000;
  const hw = PORTAIL_DEMI_L;
  const hh = PORTAIL_DEMI_H;
  const d = um(demi);
  const b = um(bas);
  const h = um(haut);
  const morceaux: [readonly [number, number], readonly [number, number], readonly [number, number]][] = [
    [[-d, -hw], [-b, h], [-T, 0]],
    [[hw, d], [-b, h], [-T, 0]],
    [[-hw, hw], [-b, -hh], [-T, 0]],
    [[-hw, hw], [hh, h], [-T, 0]],
    [[-hw, hw], [-hh, hh], [-T, -PORTAIL_PROFONDEUR]],
  ];
  return morceaux
    .filter(([rr, uu, nn]) => rr[1] > rr[0] && uu[1] > uu[0] && nn[1] > nn[0])
    .map(([rr, uu, nn]) => ({ boite: boiteRepere(g.centre, g.r, g.u, g.n, rr, uu, nn), role }));
}
export const portail = (x: number, y: number, z: number, normale: Dir, haut: Dir): Portail => ({ x: um(x), y: um(y), z: um(z), normale, haut });
export const PX: Dir = 0, MX: Dir = 1, PY: Dir = 2, MY: Dir = 3, PZ: Dir = 4, MZ: Dir = 5;

/** Une face d'une salle : une dalle d'un mètre derrière l'intérieur `interieur` (bornes par axe), faite d'une plaque marquée au milieu et de quatre barres non marquées sur `liseré` de large tout autour. */
export function faceAvecPlaque(axe: 0 | 1 | 2, signe: 1 | -1, interieur: readonly (readonly [number, number])[], lisere: number): BlocNiveau[] {
  const [u, v] = ([0, 1, 2] as const).filter((a) => a !== axe) as [0 | 1 | 2, 0 | 1 | 2];
  const epais: [number, number] = signe > 0 ? [interieur[axe]![1], interieur[axe]![1] + 1] : [interieur[axe]![0] - 1, interieur[axe]![0]];
  const dalle = (a: 0 | 1 | 2): [number, number] => [interieur[a]![0] - 1, interieur[a]![1] + 1];
  const plaque = (a: 0 | 1 | 2): [number, number] => [interieur[a]![0] + lisere, interieur[a]![1] - lisere];
  const boite = (ru: [number, number], rv: [number, number], marque: boolean): BlocNiveau => {
    const lo = [0, 0, 0];
    const hi = [0, 0, 0];
    lo[axe] = epais[0];
    hi[axe] = epais[1];
    [lo[u], hi[u]] = ru;
    [lo[v], hi[v]] = rv;
    return bm(lo[0]!, lo[1]!, lo[2]!, hi[0]!, hi[1]!, hi[2]!, marque ? "rouge" : "pierre", marque);
  };
  const [du, dv, pu, pv] = [dalle(u), dalle(v), plaque(u), plaque(v)];
  return [boite(pu, pv, true), boite([du[0], pu[0]], dv, false), boite([pu[1], du[1]], dv, false), boite(pu, [dv[0], pv[0]], false), boite(pu, [pv[1], dv[1]], false)];
}

