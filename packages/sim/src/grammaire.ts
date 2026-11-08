import { reach, type Figure, type FigureContext } from "./figures";
import type { Appel, Approche, Elan, Reception, Sortie, Vol } from "./sautsClasse";

// Lot 57 : la grammaire des sauts et des transitions — les prototypes. Un saut se compose d'une approche, d'un appel, d'un vol, d'une réception
// et d'une sortie (`sautsClasse.ts` les range) ; une transition est un raccord qui demande un geste (crête, creux, dévers, pente en virage…).
// Chaque élément est une figure (même forme que `FIGURES`, `since: 22` : aucun générateur publié ne les tire) jouable seule par
// `?scenario=<nom>` (les noms commencent par `saut-` ou `transition-` ; `createGrammaireTrack`, circuits.ts) et listée par `?scenario=sauts`.
// Ils attendent le choix de Nathan (garder, retoucher, écarter) avant d'entrer dans le générateur.

export interface PartiesSaut {
  approche: Approche;
  appel: Appel;
  vol: Vol;
  reception: Reception[];
  sortie: Sortie;
  vitesse: Elan;
}

export interface ElementGrammaire extends Figure {
  /** `saut` : un saut de la grammaire ; `transition` : un raccord qui demande un geste. */
  genre: "saut" | "transition";
  /** Les cinq parties du saut (absentes pour une transition). */
  parties?: PartiesSaut;
  /** Les thèmes où il irait le mieux (proposition pour les poids par thème, phase 3). */
  themes: readonly string[];
}

/** Dévers vers le côté du premier virage de la figure (`/i` : la route penche vers la gauche, `/j` : vers la droite). */
const vers = (c: FigureContext, token: string, cote: "L" | "R" = c.L) => `${token}/${cote === "L" ? "i" : "j"}`;
const rep = (t: string, n: number) => Array<string>(n).fill(t);

const SINCE = 22;

const saut = (e: Omit<ElementGrammaire, "genre" | "category" | "jump" | "since">): ElementGrammaire => ({ ...e, genre: "saut", category: "saut", jump: true, since: SINCE });
const transition = (e: Omit<ElementGrammaire, "genre" | "since">): ElementGrammaire => ({ ...e, genre: "transition", since: SINCE });

export const SAUTS_LOT57: readonly ElementGrammaire[] = [
  saut({
    name: "saut-biais",
    label: "Saut en biais",
    off: 0.6,
    variants: 2,
    themes: ["stade", "nuit"],
    parties: { approche: "droite", appel: "devers", vol: "tournant", reception: ["decalee", "basse"], sortie: "droite", vitesse: "elan" },
    // La route s'élargit, penche vers un côté, et la rampe aussi : on décolle de travers (roulis, un peu de dérive) ; variante 0 : réception en
    // dévers du même côté (elle suit la caisse), variante 1 : réception à plat (figer la caisse en l'air).
    build: (c) => [...reach(c.width, "l"), "S", vers(c, "S"), vers(c, "K"), "GD", c.variant === 0 ? vers(c, "S") : "S", "S", "S", "S"],
  }),
  saut({
    name: "saut-angle",
    label: "Réception en angle",
    off: 1.2,
    variants: 1,
    themes: ["stade", "canyon"],
    parties: { approche: "virage", appel: "virage", vol: "tournant", reception: ["angle", "basse"], sortie: "droite", vitesse: "elan" },
    // On décolle à la fin d'un virage ample (virage-tremplin) : la caisse tourne encore ; la piste d'arrivée tourne du même côté. Laisser
    // tourner la caisse en l'air jusqu'à l'axe de la réception, puis figer (frein).
    build: (c) => [...reach(c.width, "l"), "S", `${c.L}3/k`, "GD", `${c.L}3`, "S"],
  }),
  saut({
    name: "saut-courbe",
    label: "Saut dans un virage",
    off: 1.0,
    variants: 2,
    themes: ["stade", "rallye", "col"],
    parties: { approche: "virage", appel: "virage", vol: "tournant", reception: ["decalee", "basse"], sortie: "droite", vitesse: "elan" },
    // L'appel est lui-même en courbe : on décolle en tournant et on retombe décalé sur une route large ; variante 1 : chute de deux niveaux
    // (on vole plus longtemps : plus de dérive). Le virage large (L2) a été essayé : sa fenêtre ne tient que de 30 à 37 m/s (mesuré), trop étroite.
    build: (c) => [...reach(c.width, "l"), "S", ...(c.variant === 0 ? [`${c.L}3/k`, "GD"] : [`${c.L}3/k`, "GD2", "D"]), "S", "S", "S"],
  }),
  saut({
    name: "saut-reception-relevee",
    label: "Réception dans un virage relevé",
    off: 0.8,
    variants: 2,
    themes: ["stade", "nuit"],
    parties: { approche: "virage", appel: "plat", vol: "axe", reception: ["virage", "basse"], sortie: "droite", vitesse: "elan" },
    // Élan d'un virage, rampe, et on retombe au début d'un virage relevé : la pente aide à tenir la corde dès le contact.
    build: (c) => [`${c.R}2`, "S", "S", "K", "GD", c.variant === 0 ? `${c.L}2/b` : `${c.L}3/b`, "S"],
  }),
  saut({
    name: "saut-drop",
    label: "Saut en contrebas, à l'élan",
    off: 1.0,
    variants: 1,
    themes: ["canyon", "col"],
    parties: { approche: "virage", appel: "plat", vol: "axe", reception: ["basse"], sortie: "virage", vitesse: "elan" },
    // Deux niveaux plus bas, sans plaque : l'élan d'un virage suffit ; on retombe loin et il faut freiner pour le virage qui suit.
    build: (c) => ["S", `${c.L}2`, "S", "S", "S", "K", "GD2", "D", "S", "S", `${c.R}2`, "S"],
  }),
  saut({
    name: "saut-step-up",
    label: "Saut vers plus haut",
    off: 0.4,
    variants: 2,
    themes: ["stade", "col"],
    parties: { approche: "descente", appel: "bosse", vol: "axe", reception: ["haute"], sortie: "droite", vitesse: "elan" },
    // Le bord d'en face est plus haut : il faut assez d'élan. Variante 0 : l'élan d'une descente et une crête raide (aucune plaque) ;
    // variante 1 : une plaque et la rampe.
    build: (c) => (c.variant === 0 ? ["S", "D", "D", "D", "U3", "GU", "S", "S", "S"] : ["S", "P", "S", "K", "GU", "S", "S", "S", "S"]),
  }),
  saut({
    name: "saut-elan",
    label: "Saut à l'élan, sans freiner",
    off: 0.8,
    variants: 1,
    themes: ["rallye", "campagne"],
    parties: { approche: "chicane", appel: "plat", vol: "axe", reception: ["axe"], sortie: "droite", vitesse: "elan" },
    // Un vide au même niveau sans plaque : la sortie de chicane doit être propre et le pied au plancher ; freiner avant la rampe, c'est tomber court.
    build: (c) => ["S", `${c.L}2`, `${c.R}2`, "S", "S", "S", "K", "G", "D", "S", "S", "S"],
  }),
  saut({
    name: "saut-double",
    label: "Double saut enchaîné",
    off: 0.4,
    variants: 1,
    themes: ["canyon", "rallye"],
    parties: { approche: "droite", appel: "plat", vol: "axe", reception: ["axe"], sortie: "droite", vitesse: "elan" },
    // On retombe sur la pente qui mène au second appel : une réception trop longue ou de travers fait rater le second saut.
    build: () => ["S", "S", "S", "K", "G", "D", "K", "GD", "S", "S", "S"],
  }),
  saut({
    name: "saut-bosse",
    label: "Appel sur une crête",
    off: 0.5,
    variants: 2,
    themes: ["rallye", "campagne"],
    parties: { approche: "droite", appel: "bosse", vol: "axe", reception: ["basse"], sortie: "droite", vitesse: "elan" },
    // Pas de tremplin : c'est le haut d'une montée raide qui fait décoller ; variante 1 : on retombe sur la terre.
    build: (c) => ["S", "S", "S", "U2", "GD", ...(c.variant === 0 ? ["D", "S", "S", "S"] : ["D/t", "S/t", "S/t", "S/t", "S"])],
  }),
  saut({
    name: "saut-herbe",
    label: "Réception sur l'herbe de course",
    off: 0.8,
    variants: 2,
    themes: ["campagne", "rallye"],
    parties: { approche: "droite", appel: "plat", vol: "axe", reception: ["basse", "surface"], sortie: "virage", vitesse: "elan" },
    // On retombe sur un autre revêtement et on tourne dessus : l'herbe de course (variante 0) ou la terre (variante 1).
    build: (c) => {
      const s = c.variant === 0 ? "z" : "t";
      return ["S", "S", "S", "K", "GD", ...rep(`S/${s}`, 3), `${c.L}2/${s}`, "S"];
    },
  }),
  saut({
    name: "saut-chicane",
    label: "Saut, puis chicane",
    off: 1.4,
    variants: 2,
    themes: ["ville", "canyon"],
    parties: { approche: "droite", appel: "plat", vol: "axe", reception: ["basse"], sortie: "chicane", vitesse: "elan" },
    // Une chute de deux niveaux, puis tout de suite une chicane (variante 0) ou un virage serré (variante 1) : freiner dès les roues au sol.
    build: (c) => ["S", "S", "S", "K", "GD2", "D", "S", "S", ...(c.variant === 0 ? [`${c.L}2`, `${c.R}2`] : [c.L]), "S"],
  }),
];

export const TRANSITIONS_LOT57: readonly ElementGrammaire[] = [
  transition({
    name: "transition-crete",
    label: "Crête qui allège",
    category: "technique",
    off: 0.5,
    variants: 1,
    relief: true,
    themes: ["campagne", "rallye"],
    // Le virage commence au sommet : la voiture est légère au moment de braquer, elle glisse si l'on entre trop vite.
    build: (c) => ["S", "U", "U", `${c.L}2/-`, "D", "S"],
  }),
  transition({
    name: "transition-compression",
    label: "Compression au creux",
    category: "technique",
    off: 0.3,
    variants: 1,
    relief: true,
    themes: ["col", "canyon"],
    // Le virage commence au creux : la voiture écrase ses ressorts et tient mieux ; on peut y entrer plus vite.
    build: (c) => ["S", "D", "D", `${c.L}2/+`, "U", "S"],
  }),
  transition({
    name: "transition-devers",
    label: "Dévers qui naît et meurt",
    category: "technique",
    off: 0.6,
    variants: 2,
    themes: ["col", "nuit"],
    // La route penche peu à peu (un bloc pour s'incliner, un pour se redresser) : vers l'intérieur du virage qui suit (variante 0, elle aide) ou
    // vers l'extérieur (variante 1, le contre-dévers pousse dehors).
    build: (c) => ["S", vers(c, "S", c.variant === 0 ? c.L : c.R), vers(c, "S", c.variant === 0 ? c.L : c.R), "S", `${c.L}2`, "S"],
  }),
  transition({
    name: "transition-pente",
    label: "Virages en montée et en descente",
    category: "relief",
    off: 0.5,
    variants: 2,
    relief: true,
    themes: ["col", "campagne"],
    // Le virage lui-même monte ou descend (la pente naît et meurt avec l'arc) ; variante 1 : deux niveaux dans un virage ample.
    build: (c) => (c.variant === 0 ? ["S", "U", `${c.L}2/+`, "U", "S", `${c.R}2/-`, "D", "S"] : ["S", `${c.L}3/++`, "S", `${c.R}3/--`, "S"]),
  }),
  transition({
    name: "transition-esse",
    label: "S relevé en descente",
    category: "technique",
    off: 0.5,
    variants: 1,
    relief: true,
    banked: true,
    themes: ["col", "stade"],
    // Deux virages relevés qui descendent : le relevé change de côté pendant que la route plonge.
    build: (c) => ["S", "D", `${c.L}2/b-`, `${c.R}2/b-`, "D", "S"],
  }),
  transition({
    name: "transition-retrecissement",
    label: "Rétrécissement sur une crête",
    category: "technique",
    off: 1.0,
    variants: 1,
    relief: true,
    themes: ["campagne", "ville"],
    // La route se resserre en montant, et un virage serré attend derrière la crête.
    build: (c) => (c.width === "e" ? null : ["S", "U", ...reach(c.width, "e").map((t) => t.replace(/^S/, "U")), "S", c.L, "S"]),
  }),
  transition({
    name: "transition-appui",
    label: "Changement de revêtement en appui",
    category: "technique",
    off: 1.5,
    variants: 2,
    themes: ["banquise", "campagne"],
    // Un long virage dont la seconde moitié passe sur la glace (variante 0) ou l'herbe de course (variante 1) : lever le pied en appui.
    build: (c) => {
      const s = c.variant === 0 ? "g" : "z";
      return ["S", `${c.L}3`, `${c.L}2/${s}`, `S/${s}`, "S"];
    },
  }),
];

export const GRAMMAIRE_LOT57: readonly ElementGrammaire[] = [...SAUTS_LOT57, ...TRANSITIONS_LOT57];
const PAR_NOM = new Map(GRAMMAIRE_LOT57.map((e) => [e.name, e] as const));
export const elementGrammaire = (nom: string | null | undefined): ElementGrammaire | null => (nom ? (PAR_NOM.get(nom) ?? null) : null);
