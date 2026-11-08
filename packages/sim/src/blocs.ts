import type { FigureContext } from "./figures";
import type { ElementGrammaire } from "./grammaire";

// Lot 58 : des blocs plus complexes, à la Trackmania — **les idées seulement, jamais les fichiers, les modèles ni les noms** : tout est construit par le
// code, avec nos noms. Les prototypes des familles nouvelles (blocs à effet, route bombée, virage très relevé ; le propulseur et l'eau écartés par
// Nathan le 08/11/2026), même forme qu'une figure (`since:
// 22` : aucun générateur publié ne les tire), jouables seuls par `?scenario=bloc-<nom>` (`&v=1`, `&m=1` ; `createFigureTrack`, circuits.ts) et listés
// par `?scenario=blocs`. Ils attendent le choix de Nathan (garder, retoucher, écarter) avant d'entrer dans le générateur.

export interface ElementBloc extends ElementGrammaire {
  /** La famille du catalogue (README du lot 58) : effet, bombee, releve. */
  famille: "effet" | "bombee" | "releve";
}

const SINCE = 22;
const bloc = (e: Omit<ElementBloc, "genre" | "since" | "category"> & { category?: ElementBloc["category"] }): ElementBloc => ({ category: "technique", ...e, genre: "transition", since: SINCE });
const s = (c: FigureContext, n: string) => `${c.L}${n}`;
const o = (c: FigureContext, n: string) => `${c.R}${n}`;

export const BLOCS_LOT58: readonly ElementBloc[] = [
  bloc({
    name: "bloc-direction",
    label: "Direction bloquée",
    famille: "effet",
    off: 0.2,
    variants: 2,
    themes: ["stade", "nuit"],
    // Le portique violet bloque le volant 1,5 s : les roues reviennent droites. Variante 0 : il attend à la sortie d'un virage (être aligné avant la bande) ;
    // variante 1 : on saute volant bloqué.
    build: (c) => (c.variant === 0 ? ["S", s(c, "2"), "Ed", "S", "S", "S", o(c, "2"), "S"] : ["S", "S", "Ed", "S", "K", "GD", "S", "S"]),
  }),
  bloc({
    name: "bloc-freins",
    label: "Freins coupés",
    famille: "effet",
    off: 0.8,
    variants: 2,
    themes: ["stade", "canyon"],
    // Plus de frein pendant 3 s : on lève le pied tôt. Variante 0 : une descente puis un virage large ; variante 1 : deux virages larges enchaînés.
    build: (c) => (c.variant === 0 ? ["S", "S", "Ef", "S", "D", s(c, "2"), "S"] : ["S", "Ef", "S", "S", s(c, "2"), o(c, "2"), "S"]),
  }),
  bloc({
    name: "bloc-regulateur",
    label: "Régulateur",
    famille: "effet",
    off: 0.2,
    variants: 2,
    themes: ["stade", "ville"],
    // La voiture garde 4 s la vitesse qu'elle avait à la bande, gaz et frein sans effet ; on ne fait que tourner. Variante 0 : à pleine vitesse, un virage
    // large et une bosse ; variante 1 : à la sortie d'un virage serré (qui sort lentement reste lent).
    build: (c) => (c.variant === 0 ? ["S", "S", "Er", "S", s(c, "2"), "S", "U", "D", "S"] : [s(c, ""), "S", "Er", "S", "S", o(c, "2"), "S"]),
  }),
  bloc({
    name: "bloc-fragile",
    label: "Voiture fragile",
    famille: "effet",
    category: "saut",
    jump: true,
    off: 0.3,
    variants: 2,
    themes: ["rallye", "canyon"],
    // 8 s de voiture fragile : une réception brutale ou de travers la casse (retour au point de contrôle). Sauts et bosses à poser bien à plat, puis la
    // remise à zéro. Variante 1 : sur la tôle ondulée.
    build: (c) => (c.variant === 0 ? ["S", "Ex", "S", "K", "GD", "S", "S", "U", "D", "S", "J", "S", "E0", "S"] : ["S", "Ex", "S/u", "S/u", "J", "S", "U", "D", "S", "E0", "S"]),
  }),
  bloc({
    name: "bloc-remise",
    label: "Remise à zéro",
    famille: "effet",
    off: 0.6,
    variants: 1,
    themes: ["stade", "canyon"],
    // Freins coupés, puis le portique blanc de la remise à zéro les rend juste avant un virage serré : on freine après lui, pas avant.
    build: (c) => ["S", "Ef", "S", "E0", "S", s(c, ""), "S"],
  }),
  bloc({
    name: "bloc-bombee",
    label: "Route bombée",
    famille: "bombee",
    off: 0.5,
    variants: 2,
    themes: ["nuit", "stade"],
    // Une chaussée arrondie, sans rebords : le sommet porte, les côtés font glisser vers le vide. Variante 0 : un virage large ; variante 1 : un ample puis
    // un large de l'autre côté.
    build: (c) => (c.variant === 0 ? ["S", "S/a", "S/a", s(c, "2/a"), "S/a", "S/a", "S"] : ["S", "S/a", "S/a", s(c, "3/a"), "S/a", o(c, "2/a"), "S/a", "S"]),
  }),
  bloc({
    name: "bloc-releve-fort",
    label: "Virage relevé à 45°",
    famille: "releve",
    off: 0.1,
    variants: 2,
    banked: true,
    themes: ["stade", "nuit", "canyon"],
    // Un virage ample relevé à 45° : il se prend à fond, plaqué (seulement l'ample : sur un large, le relevé monte trop vite et la voiture décolle).
    // Variante 0 : un ample puis un ample de l'autre côté ; variante 1 : un S relevé de deux amples, sans droite entre eux.
    build: (c) => (c.variant === 0 ? ["S", s(c, "3/f"), "S", o(c, "3/f"), "S"] : ["S", s(c, "3/f"), o(c, "3/f"), "S"]),
  }),
];

const PAR_NOM = new Map(BLOCS_LOT58.map((e) => [e.name, e] as const));
export const elementBloc = (nom: string | null | undefined): ElementBloc | null => (nom ? (PAR_NOM.get(nom) ?? null) : null);
