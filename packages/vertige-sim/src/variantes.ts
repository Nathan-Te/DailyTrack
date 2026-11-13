import { MODULES } from "./bibliotheque";
import { bm, um } from "./construction";
import { dallePalier, ENTREE, palier, type Module } from "./modules";
import { miroir } from "./miroir";
import { piloterAvecRaison, texteDesCommandes, type ActionPilote, type Etape } from "./pilote";

// Les variantes de modules (lot V3) : de quoi multiplier les 14 modules de la bibliothèque sans en écrire de nouveaux. Deux variantes, toutes deux **vérifiées comme un module de la bibliothèque** (`controlesDuModule` : la solution
// arrive, au pas près, dans les jauges, les étiquettes disent vrai, 4 à 8 s) :
//   · **le miroir gauche / droite** (`miroir.ts`) : la géométrie, les portails, la sortie et la solution (`tourne −D`, les touches de côté inversées). Un module symétrique (`saut-1`, `dash-1`, `portail-1`…) est son propre miroir : il n'est
//     PAS compté comme une variante de plus ;
//   · **les longueurs ajustées** (`« /c »` court, `« /l »` long) des quatre modules à plateformes (`saut-1`, `saut-2`, `dash-1`, `dash-2`) : les écarts et les longueurs de plateformes changent, **l'écart reste au plus à 85 % de la portée**
//     (c'est la vérification des jauges, qui mesure le niveau et non l'intention), et la solution est RECALCULÉE par le pilote (`pilote.ts`) — jamais retouchée à la main. Un module long est plus dur d'un cran (3 au plus), un court plus facile (1 au moins).
// Les clés : `saut-1` (la base), `saut-1/l` (longueurs), `mur-1~` (miroir), `portail-quart~`. L'identifiant de BASE (`saut-1`) est celui des règles de variété du générateur (« jamais le même module deux fois de suite »).
export type Forme = "base" | "court" | "long";
export interface VarianteDeModule {
  cle: string;
  /** L'identifiant du module de la bibliothèque dont elle vient. */
  base: string;
  forme: Forme;
  miroir: boolean;
  module: Module;
  /** 1 à 3 : celle du module, plus un cran pour un module long, moins un pour un court. */
  difficulte: 1 | 2 | 3;
}

interface Famille {
  base: string;
  /** La demi-largeur des plateformes (m), le dessus de chacune (m), la hauteur du palier de sortie (m) et l'action prise à chaque bord (le bord de la dalle d'entrée, puis celui de chaque plateforme). */
  demiLargeur: number;
  dessus: readonly number[];
  sortieY: number;
  actions: readonly ActionPilote[];
  /** Les écarts (m) : un par action, le dernier jusqu'à la dalle du palier de sortie ; les longueurs (m) des plateformes. */
  forme: Record<Forme, { ecarts: readonly number[]; longueurs: readonly number[] }>;
}

// Les valeurs de la forme « base » sont celles des modules écrits à la main (`bibliotheque.ts`) : un test vérifie que le constructeur les refait au bloc près. Les formes court et long sont dites ici en mètres, en entiers de dixièmes : jamais un produit flottant.
const FAMILLES: readonly Famille[] = [
  {
    base: "saut-1",
    demiLargeur: 3,
    dessus: [0, 0],
    sortieY: 0,
    actions: ["saut", "saut", "saut"],
    forme: { base: { ecarts: [3.5, 4.5, 5], longueurs: [9, 9] }, court: { ecarts: [2.5, 3, 3.5], longueurs: [10, 8] }, long: { ecarts: [4.5, 5.5, 5.9], longueurs: [8, 11] } },
  },
  {
    base: "saut-2",
    demiLargeur: 2,
    dessus: [1, -0.5],
    sortieY: 0.7,
    actions: ["saut", "saut", "saut"],
    forme: { base: { ecarts: [4.5, 6.5, 4], longueurs: [8, 8] }, court: { ecarts: [3.5, 5, 3], longueurs: [9, 7] }, long: { ecarts: [4.8, 6.9, 4.5], longueurs: [7, 9] } },
  },
  {
    base: "dash-1",
    demiLargeur: 3,
    dessus: [0, 0],
    sortieY: 0,
    actions: ["saut+dash", "saut+dash", "saut+dash"],
    forme: { base: { ecarts: [8, 9.5, 11], longueurs: [14, 14] }, court: { ecarts: [6.5, 8, 9], longueurs: [15, 13] }, long: { ecarts: [9, 11, 12.2], longueurs: [13, 16] } },
  },
  {
    base: "dash-2",
    demiLargeur: 2,
    dessus: [0, 0],
    sortieY: 0,
    actions: ["saut+dash", "dash", "saut+dash"],
    forme: { base: { ecarts: [10, 3.5, 11], longueurs: [14, 8] }, court: { ecarts: [8, 2.5, 9.5], longueurs: [15, 9] }, long: { ecarts: [11, 3.8, 12.2], longueurs: [13, 7] } },
  },
];

/** Le module à plateformes d'une forme : sa géométrie, les étapes du pilote, et la solution que le pilote écrit (ou `null` s'il n'arrive pas). */
export function moduleAPlateformes(f: Famille, forme: Forme): { module: Module | null; raison: string } {
  const { ecarts, longueurs } = f.forme[forme];
  const etapes: Etape[] = [];
  let z = -6;
  const blocs = [];
  for (let i = 0; i <= longueurs.length; i++) {
    const bord = z;
    z -= ecarts[i]!;
    if (i === longueurs.length) {
      // La dalle du palier de sortie : on se pose avant le centre du palier (1,2 m au moins de course sur la dalle ; le pilote vérifie ensuite que l'état est canonique au passage du plan).
      etapes.push({ bord: um(bord), action: f.actions[i]!, atterrissage: [um(z - 0.25), um(z - 5 + 1.2)] });
      break;
    }
    const y = f.dessus[i]!;
    blocs.push(bm(-f.demiLargeur, y - 1, z - longueurs[i]!, f.demiLargeur, y, z));
    etapes.push({ bord: um(bord), action: f.actions[i]!, atterrissage: [um(z - 0.25), um(z - longueurs[i]! + 1)] });
    z -= longueurs[i]!;
  }
  const sortie = palier(0, f.sortieY, z - 5);
  const nu: Module = {
    id: forme === "base" ? f.base : `${f.base}/${forme === "court" ? "c" : "l"}`,
    nom: nomDe(f.base),
    blocs: [...blocs, dallePalier(sortie)],
    entree: ENTREE,
    sortie,
    etiquettes: etiquettesDe(f.base, forme),
    solution: "",
  };
  const { commandes, raison } = piloterAvecRaison(nu, etapes);
  return { module: commandes ? { ...nu, solution: texteDesCommandes(commandes) } : null, raison };
}

const original = (id: string): Module => MODULES.find((m) => m.id === id)!;
const nomDe = (base: string): string => original(base).nom;
const etiquettesDe = (base: string, forme: Forme): Module["etiquettes"] => {
  const e = original(base).etiquettes;
  const d = forme === "long" ? Math.min(3, e.difficulte + 1) : forme === "court" ? Math.max(1, e.difficulte - 1) : e.difficulte;
  return { mecaniques: e.mecaniques, difficulte: d as 1 | 2 | 3 };
};

/** Deux modules qui disent la même chose (les mêmes blocs, quel que soit leur ordre, les mêmes portails, paliers et solution) : le miroir d'un module symétrique est lui-même. */
const ensemble = (m: Module): string => JSON.stringify([m.blocs.map((b) => JSON.stringify(b)).sort(), (m.portails ?? []).map((p) => JSON.stringify(p)).sort(), m.entree, m.sortie, m.solution]);
const memeModule = (a: Module, b: Module): boolean => ensemble(a) === ensemble(b);

let CACHE: readonly VarianteDeModule[] | null = null;
/**
 * Toutes les variantes, dans un ordre fixe (celui de la bibliothèque, la forme base, court, long, puis le miroir de chacune quand il diffère) : construites une fois. **L'ordre fait partie du contenu du jour** (le générateur tire dans cette
 * liste) : l'allonger ou le changer monte `VERTIGE_GENERATOR_VERSION`.
 */
export function variantes(): readonly VarianteDeModule[] {
  if (CACHE) return CACHE;
  const out: VarianteDeModule[] = [];
  const ajouter = (m: Module, base: string, forme: Forme): void => {
    out.push({ cle: m.id, base, forme, miroir: false, module: m, difficulte: m.etiquettes.difficulte });
    const mi = miroir({ ...m, id: m.id });
    if (!memeModule(m, mi)) out.push({ cle: mi.id, base, forme, miroir: true, module: mi, difficulte: m.etiquettes.difficulte });
  };
  for (const m of MODULES) {
    ajouter(m, m.id, "base");
    const famille = FAMILLES.find((f) => f.base === m.id);
    if (!famille) continue;
    for (const forme of ["court", "long"] as const) {
      const v = moduleAPlateformes(famille, forme);
      if (!v.module) throw new Error(`variante ${m.id}/${forme} : ${v.raison} (une constante de sensation a changé ?)`);
      ajouter(v.module, m.id, forme);
    }
  }
  CACHE = out;
  return out;
}

export const varianteDeCle = (cle: string): VarianteDeModule | undefined => variantes().find((v) => v.cle === cle);
export const FAMILLES_A_PLATEFORMES: readonly string[] = FAMILLES.map((f) => f.base);
/** Le constructeur d'une forme à plateformes sous sa forme de base (les tests le comparent à la bibliothèque écrite à la main). */
export const refaireDeBase = (base: string): { module: Module | null; raison: string } => {
  const f = FAMILLES.find((x) => x.base === base)!;
  return moduleAPlateformes(f, "base");
};
export const construireForme = (base: string, forme: Forme): { module: Module | null; raison: string } => moduleAPlateformes(FAMILLES.find((x) => x.base === base)!, forme);
