// Lot T2 — les jours figés de Tower : un fichier par jour, `apps/tower/public/jours/AAAA-MM-JJ.json`, écrit par `npm run figer:tower -w @cdj/tower-sim` (tools/figer.ts) — jamais
// par un lot de jeu ni à la main, et jamais réécrit : un jour figé ne change plus. Il garde le contenu du jour TEL QU'IL A ÉTÉ SERVI avec les versions qui l'ont produit
// (`g`, le générateur ; `sim`, la simulation), de sorte que changer le générateur ne change pas un jour déjà servi. Le champ `medailles` est `null` (le lot T3 le remplira).
// Le branchement à « Mettre en production » est un lot de la plateforme (T4) : ni le serveur ni les workflows ne lisent ces fichiers au lot T2.
//
// Fonctions PURES (aucune lecture de fichier : on leur passe le JSON) : l'outil d'écriture, le jeu et les tests les partagent.
import { formatDay, parseDay } from "@cdj/core";
import { PIECE_KINDS, type PieceKind } from "../lab/interface";
import { type Contenu, dailyTower, TOWER_GENERATOR_VERSION, VERSIONS_GENERATEUR } from "./generateur";
import { EFFETS, type Effet } from "./paliers";
import { TOWER_SIM_VERSION } from "./constantes";

export const FORMAT_JOUR_FIGE = 1;

/** Le fichier d'un jour figé. */
export interface JourFige {
  format: number;
  jeu: "tower";
  /** AAAA-MM-JJ. */
  date: string;
  /** La version du générateur qui a produit ce jour. */
  g: number;
  /** La version de la simulation sous laquelle il a été figé. */
  sim: number;
  contenu: {
    /** La suite de pièces, une lettre par tétromino. */
    pieces: string;
    plateformeDemi8: number;
    paliers: { metres: number; effet: Effet }[];
    ventSens: 1 | -1;
    theme: "port";
  };
  /** Les médailles du jour : `null` jusqu'au lot T3. */
  medailles: null;
}

/** Fige un jour : le contenu que le générateur de la version `g` (la courante par défaut) donne. */
export function figerJour(jour: number, g: number = TOWER_GENERATOR_VERSION): JourFige {
  const c = dailyTower(jour, g);
  return {
    format: FORMAT_JOUR_FIGE,
    jeu: "tower",
    date: formatDay(jour),
    g,
    sim: TOWER_SIM_VERSION,
    contenu: { pieces: c.pieces.join(""), plateformeDemi8: c.plateformeDemi8, paliers: c.paliers.map((p) => ({ ...p })), ventSens: c.ventSens, theme: c.theme },
    medailles: null,
  };
}

/** Le texte d'un fichier figé : toujours le même pour le même contenu (une ligne par champ, fin de ligne finale). */
export function jsonJourFige(f: JourFige): string {
  const { contenu: c } = f;
  return (
    `{\n  "format": ${f.format},\n  "jeu": "tower",\n  "date": ${JSON.stringify(f.date)},\n  "g": ${f.g},\n  "sim": ${f.sim},\n` +
    `  "contenu": {\n    "pieces": ${JSON.stringify(c.pieces)},\n    "plateformeDemi8": ${c.plateformeDemi8},\n    "paliers": ${JSON.stringify(c.paliers)},\n    "ventSens": ${c.ventSens},\n    "theme": ${JSON.stringify(c.theme)}\n  },\n` +
    `  "medailles": ${JSON.stringify(f.medailles)}\n}\n`
  );
}

/** Le contenu d'un fichier figé, ou le motif du refus (texte). Le fichier n'est cru qu'après vérification : format, jeu, date, versions, forme de chaque champ. */
export function lireJourFige(json: unknown, jour: number): Contenu | string {
  if (typeof json !== "object" || json === null) return "pas un objet";
  const f = json as Partial<JourFige>;
  if (f.format !== FORMAT_JOUR_FIGE) return "format inconnu";
  if (f.jeu !== "tower") return "ce n'est pas un jour de Tower";
  if (f.date !== formatDay(jour) || parseDay(f.date) !== jour) return "la date ne correspond pas";
  if (typeof f.g !== "number" || !VERSIONS_GENERATEUR.includes(f.g)) return `générateur inconnu : ${String(f.g)}`;
  if (f.sim !== TOWER_SIM_VERSION) return `simulation ${String(f.sim)} : ce code joue la ${TOWER_SIM_VERSION}`;
  const c = f.contenu;
  if (typeof c !== "object" || c === null) return "contenu manquant";
  if (typeof c.pieces !== "string" || c.pieces.length === 0 || ![...c.pieces].every((k) => (PIECE_KINDS as readonly string[]).includes(k))) return "suite de pièces illisible";
  if (!Number.isInteger(c.plateformeDemi8) || c.plateformeDemi8 < 8 || c.plateformeDemi8 > 64) return "plateforme illisible";
  if (c.ventSens !== 1 && c.ventSens !== -1) return "sens du vent illisible";
  if (c.theme !== "port") return "thème inconnu";
  if (!Array.isArray(c.paliers) || !c.paliers.every((p) => p && Number.isInteger(p.metres) && p.metres > 0 && (EFFETS as readonly string[]).includes(p.effet))) return "paliers illisibles";
  return {
    nom: formatDay(jour),
    jour,
    g: f.g,
    theme: c.theme,
    pieces: [...c.pieces] as PieceKind[],
    plateformeDemi8: c.plateformeDemi8,
    paliers: c.paliers.map((p) => ({ metres: p.metres, effet: p.effet })),
    ventSens: c.ventSens,
  };
}
