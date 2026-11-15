import { mixSeed, Rng } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION } from "./constantes";
import { themeDuJour, type ThemePinball } from "./themes";

// La table du jour (lot PB1). **Le bas de la table ne change jamais** (deux batteurs, deux lance-pierres, deux couloirs de retour, le couloir du lanceur, les trois couloirs du haut : `table.ts`) ; le haut est tiré
// de la graine du jour : un thème, puis le module de chacun des six emplacements, dans la liste permise de l'emplacement. Le contenu est minuscule (six petits entiers) : le jeu, le serveur et le fichier du jour
// le portent sans coût. **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge. On monte `PINBALL_GENERATOR_VERSION`, jamais une date.

/** Les modules communs (seed « Les modules communs »). Les éléments propres à un thème (manège, tourbillon, trou noir, geyser…) viennent au lot PB3 ; jusque-là, leur emplacement reçoit un module commun. */
export const MODULES = ["bumpers", "mini", "cibles", "spinner", "trou"] as const;
export type Module = (typeof MODULES)[number];

/** Les six emplacements du haut, leur centre (pixels de la maquette) et la liste des modules permis. `S6` est celui de l'élément du thème. */
export const EMPLACEMENTS = [
  { nom: "S1", x: 100, y: 220, permis: ["cibles", "spinner", "mini", "bumpers"] },
  { nom: "S2", x: 184, y: 180, permis: ["bumpers", "mini"] },
  { nom: "S3", x: 270, y: 220, permis: ["cibles", "spinner", "mini"] },
  { nom: "S4", x: 92, y: 385, permis: ["cibles", "trou", "spinner"] },
  { nom: "S5", x: 276, y: 385, permis: ["cibles", "trou", "mini"] },
  { nom: "S6", x: 184, y: 320, permis: ["bumpers", "cibles", "trou", "spinner", "mini"] },
] as const;
export const NB_EMPLACEMENTS = EMPLACEMENTS.length;

export interface Contenu {
  jour: number;
  /** La version du générateur. */
  g: number;
  theme: ThemePinball;
  /** Le module de chaque emplacement, dans l'ordre de `EMPLACEMENTS`. */
  modules: Module[];
  /** Les seuils des médailles figés avec le jour (rempli quand le contenu vient d'un fichier de jour). */
  seuilsFiges?: { bronze: number; silver: number; gold: number; author: number };
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Sel de la graine de Pinball (propre au jeu). */
const SEL = 0x50494e;

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme (ici : la courante seulement). */
export function dailyPinball(jour: number, version: number = PINBALL_GENERATOR_VERSION): Contenu {
  if (version !== PINBALL_GENERATOR_VERSION) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  const theme = themeDuJour(jour);
  const rng = new Rng(mixSeed(jour, SEL));
  // La maquette : S2 est un trio de bumpers trois fois sur quatre, sinon une paire ; les autres piochent dans leur liste, dans l'ordre S1, S3, S4, S5, puis S6.
  const modules: Module[] = Array<Module>(NB_EMPLACEMENTS);
  modules[1] = rng.chance(75) ? "bumpers" : "mini";
  for (const i of [0, 2, 3, 4, 5]) modules[i] = rng.pick<Module>(EMPLACEMENTS[i]!.permis);
  return { jour, g: version, theme, modules };
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, THEMES_INDEX(contenu.theme), ...contenu.modules.map((m) => MODULES.indexOf(m))]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
const THEMES_INDEX = (t: ThemePinball): number => ["foire", "ocean", "espace", "volcan"].indexOf(t);
