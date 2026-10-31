// Lot T2 — les jours figés de Tower : un fichier par jour, `apps/tower/public/jours/AAAA-MM-JJ.json`, écrit par `npm run figer:tower -w @cdj/tower-sim` (tools/figer.ts) — jamais
// par un lot de jeu ni à la main, et jamais réécrit : un jour figé ne change plus. Il garde le contenu du jour TEL QU'IL A ÉTÉ SERVI avec les versions qui l'ont produit
// (`g`, le générateur ; `sim`, la simulation), de sorte que changer le générateur ne change pas un jour déjà servi. Lot T3 : un jour PRÉPARÉ (`npm run preparer:tower`, `bot/preparer.ts`) a en
// plus ses `medailles` (les seuils en millimètres, le Diamant étant la clé `auteur`) et la `preuve` de l'auteur, la rediffusion du bot : **la preuve ne quitte jamais le serveur** (règle R9) — la
// construction de production du jeu la retire de tout fichier publié (`apps/tower/preuves.ts`). Un jour seulement figé (`npm run figer:tower`) a `medailles: null` et pas de preuve.
// Le branchement à « Mettre en production » est un lot de la plateforme (T4) : ni le serveur ni les workflows ne lisent ces fichiers au lot T2.
//
// Fonctions PURES (aucune lecture de fichier : on leur passe le JSON) : l'outil d'écriture, le jeu et les tests les partagent.
import { formatDay, parseDay } from "@cdj/core";
import { PIECE_KINDS, type PieceKind } from "../lab/interface";
import { type Contenu, dailyTower, GENERATEUR_TIRAGE, TOWER_GENERATOR_VERSION, VERSIONS_GENERATEUR } from "./generateur";
import { type Medailles } from "./medailles";
import { EFFETS, type Effet } from "./paliers";
import { THEMES_TOWER, type ThemeTower } from "./themes";
import { TOWER_SIM_VERSION } from "./constantes";
import { TIRAGES_MAX } from "./tirage";

export const FORMAT_JOUR_FIGE = 1;

/** Le fichier d'un jour figé. */
export interface JourFige {
  format: number;
  jeu: "tower";
  /** AAAA-MM-JJ. */
  date: string;
  /** La version du générateur qui a produit ce jour. */
  g: number;
  /** Lot T3b (générateur 3) : le tirage du contenu du jour (0 à TIRAGES_MAX − 1), celui que la préparation a retenu ; absent des fichiers des générateurs 1 et 2. */
  tirage?: number;
  /** La version de la simulation sous laquelle il a été figé. */
  sim: number;
  contenu: {
    /** La suite de pièces, une lettre par tétromino. */
    pieces: string;
    plateformeDemi8: number;
    paliers: { metres: number; effet: Effet }[];
    ventSens: 1 | -1;
    theme: ThemeTower;
  };
  /** Les médailles du jour (lot T3), ou `null` : un jour seulement figé, dont les médailles sont alors estimées (provisoires). */
  medailles: Medailles | null;
  /** La rediffusion du bot de l'auteur (texte `base64url`), absente d'un fichier publié en production (règle R9). */
  preuve?: string;
}

/** Fige un jour : le contenu que le générateur de la version `g` (la courante par défaut) donne, au tirage `tirage` (0 par défaut ; les versions 1 et 2 n'en ont pas). */
export function figerJour(jour: number, g: number = TOWER_GENERATOR_VERSION, tirage = 0): JourFige {
  const c = dailyTower(jour, g, tirage);
  return {
    format: FORMAT_JOUR_FIGE,
    jeu: "tower",
    date: formatDay(jour),
    g,
    ...(g >= GENERATEUR_TIRAGE ? { tirage } : {}),
    sim: TOWER_SIM_VERSION,
    contenu: { pieces: c.pieces.join(""), plateformeDemi8: c.plateformeDemi8, paliers: c.paliers.map((p) => ({ ...p })), ventSens: c.ventSens, theme: c.theme },
    medailles: null,
  };
}

/** Le texte d'un fichier figé : toujours le même pour le même contenu (une ligne par champ, fin de ligne finale). */
export function jsonJourFige(f: JourFige): string {
  const { contenu: c, medailles: m } = f;
  const medailles = m ? `{ "auteur": ${m.auteur}, "or": ${m.or}, "argent": ${m.argent}, "bronze": ${m.bronze} }` : "null";
  return (
    `{\n  "format": ${f.format},\n  "jeu": "tower",\n  "date": ${JSON.stringify(f.date)},\n  "g": ${f.g},\n${f.g >= GENERATEUR_TIRAGE ? `  "tirage": ${f.tirage ?? 0},\n` : ""}  "sim": ${f.sim},\n` +
    `  "contenu": {\n    "pieces": ${JSON.stringify(c.pieces)},\n    "plateformeDemi8": ${c.plateformeDemi8},\n    "paliers": ${JSON.stringify(c.paliers)},\n    "ventSens": ${c.ventSens},\n    "theme": ${JSON.stringify(c.theme)}\n  },\n` +
    `  "medailles": ${medailles}${f.preuve === undefined ? "" : `,\n  "preuve": ${JSON.stringify(f.preuve)}`}\n}\n`
  );
}

/** Ce qu'on lit d'un jour : son contenu, ses médailles et sa preuve (`null` si le fichier n'en a pas). */
export interface JourLu {
  contenu: Contenu;
  medailles: Medailles | null;
  preuve: string | null;
}

/** Les médailles d'un fichier : quatre entiers positifs dans l'ordre (Bronze ≤ Argent ≤ Or ≤ Diamant), ou le motif du refus. */
function lireMedailles(m: unknown): Medailles | null | string {
  if (m === null) return null;
  if (typeof m !== "object" || m === undefined) return "médailles illisibles";
  const { auteur, or, argent, bronze } = m as Partial<Medailles>;
  const v = [bronze, argent, or, auteur];
  if (!v.every((x) => Number.isInteger(x) && x! >= 0 && x! <= 1_000_000)) return "médailles illisibles";
  for (let i = 1; i < v.length; i++) if (v[i]! < v[i - 1]!) return "médailles dans le désordre";
  return { auteur: auteur!, or: or!, argent: argent!, bronze: bronze! };
}

/** Le jour d'un fichier, ou le motif du refus (texte). Le fichier n'est cru qu'après vérification : format, jeu, date, versions, forme de chaque champ. */
export function lireJour(json: unknown, jour: number): JourLu | string {
  if (typeof json !== "object" || json === null) return "pas un objet";
  const f = json as Partial<JourFige>;
  if (f.format !== FORMAT_JOUR_FIGE) return "format inconnu";
  if (f.jeu !== "tower") return "ce n'est pas un jour de Tower";
  if (f.date !== formatDay(jour) || parseDay(f.date) !== jour) return "la date ne correspond pas";
  if (typeof f.g !== "number" || !VERSIONS_GENERATEUR.includes(f.g)) return `générateur inconnu : ${String(f.g)}`;
  // Lot T3b : dès le générateur 3 le fichier nomme son tirage (0 à TIRAGES_MAX − 1) ; avant, il n'en a pas (le champ y est ignoré : le garde-fou voit un fichier qui ne se régénère pas).
  const tirage = f.tirage!;
  if (f.g >= GENERATEUR_TIRAGE && !(Number.isInteger(tirage) && tirage >= 0 && tirage < TIRAGES_MAX)) return "tirage illisible";
  if (f.sim !== TOWER_SIM_VERSION) return `simulation ${String(f.sim)} : ce code joue la ${TOWER_SIM_VERSION}`;
  const c = f.contenu;
  if (typeof c !== "object" || c === null) return "contenu manquant";
  if (typeof c.pieces !== "string" || c.pieces.length === 0 || ![...c.pieces].every((k) => (PIECE_KINDS as readonly string[]).includes(k))) return "suite de pièces illisible";
  if (!Number.isInteger(c.plateformeDemi8) || c.plateformeDemi8 < 8 || c.plateformeDemi8 > 64) return "plateforme illisible";
  if (c.ventSens !== 1 && c.ventSens !== -1) return "sens du vent illisible";
  if (!(THEMES_TOWER as readonly string[]).includes(c.theme)) return "thème inconnu";
  if (!Array.isArray(c.paliers) || !c.paliers.every((p) => p && Number.isInteger(p.metres) && p.metres > 0 && (EFFETS as readonly string[]).includes(p.effet))) return "paliers illisibles";
  const medailles = lireMedailles(f.medailles === undefined ? null : f.medailles);
  if (typeof medailles === "string") return medailles;
  if (f.preuve !== undefined && (typeof f.preuve !== "string" || !/^[A-Za-z0-9_-]{1,60000}$/.test(f.preuve))) return "preuve illisible";
  return {
    contenu: {
      nom: formatDay(jour),
      jour,
      g: f.g,
      ...(f.g >= GENERATEUR_TIRAGE ? { tirage } : {}),
      theme: c.theme,
      pieces: [...c.pieces] as PieceKind[],
      plateformeDemi8: c.plateformeDemi8,
      paliers: c.paliers.map((p) => ({ metres: p.metres, effet: p.effet })),
      ventSens: c.ventSens,
    },
    medailles,
    preuve: f.preuve ?? null,
  };
}

/** Le contenu d'un fichier figé, ou le motif du refus (texte). */
export function lireJourFige(json: unknown, jour: number): Contenu | string {
  const lu = lireJour(json, jour);
  return typeof lu === "string" ? lu : lu.contenu;
}
