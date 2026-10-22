// Lot 38 — ce que montre la vitrine : une section par élément (un petit circuit écrit à la main, cadré sur l'élément) et une section par thème
// (le vrai circuit du jour d'une date de ce thème, vu depuis la caméra de poursuite). Outil interne, en français (exempté des catalogues).
import { Vector3 } from "three";
import { CELL, THEME_NAMES, THEMES, daysFromCivil, isCurve, themeForDay, type Block, type PaletteName, type ThemeName, type Track } from "@cdj/sim";
import { CAMERAS } from "../cameras";
import { world } from "../meshKit";
import { onBlock } from "../scene/route";
import { signsFor } from "../signage";

/** Une pose : la voiture (position, cap) et la caméra (position, point visé, champ de vision). */
export interface Pose {
  voiture: { x: number; y: number; z: number; yaw: number };
  camera: Vector3;
  cible: Vector3;
  fov: number;
}

export interface SujetElement {
  type: "element";
  id: string;
  titre: string;
  texte: string;
  spec: string;
  pose(track: Track): Pose;
}

export interface SujetTheme {
  type: "theme";
  id: string;
  theme: ThemeName;
  titre: string;
  texte: string;
  palette: PaletteName;
  /** Le jour dont on montre le circuit (le premier de ce thème à partir du premier jour de production). */
  jour: number;
}

export type Sujet = SujetElement | SujetTheme;

/** La voiture posée sur l'axe d'un bloc droit, à l'avance `q`, dans le sens de la course. */
export function voitureSurBloc(b: Block, q: number, lat = 0): Pose["voiture"] {
  const t = Math.max(0, Math.min(0.99, q / CELL));
  const o = onBlock(b, lat, t, 0);
  const n = onBlock(b, lat, t + 0.01, 0);
  return { x: o[0], y: o[1], z: o[2], yaw: Math.atan2(n[0] - o[0], n[2] - o[2]) };
}

/** La caméra de poursuite du jeu (« proche », à l'arrêt) derrière la voiture. */
export function poursuite(v: Pose["voiture"]): Pose {
  const rig = CAMERAS[0]!;
  const s = Math.sin(v.yaw);
  const c = Math.cos(v.yaw);
  return {
    voiture: v,
    camera: new Vector3(v.x - s * rig.back, v.y + rig.height, v.z - c * rig.back),
    cible: new Vector3(v.x + s * rig.ahead, v.y + rig.lookHeight, v.z + c * rig.ahead),
    fov: rig.fov,
  };
}

/** Une vue de trois quarts sur un point, depuis l'arrière gauche du sens de la course. */
function troisQuarts(v: Pose["voiture"], cible: Vector3, recul: number, hauteur: number, cote = 1, fov = 55): Pose {
  const s = Math.sin(v.yaw);
  const c = Math.cos(v.yaw);
  // Gauche du conducteur : (cos, −sin) quand l'avant est (sin, cos).
  const gx = c * cote;
  const gz = -s * cote;
  return { voiture: v, camera: new Vector3(cible.x - s * recul + gx * recul * 0.55, cible.y + hauteur, cible.z - c * recul + gz * recul * 0.55), cible, fov };
}

const bloc = (t: Track, i: number) => t.blocks[Math.max(0, Math.min(t.blocks.length - 1, i))]!;

export const ELEMENTS: SujetElement[] = [
  {
    type: "element",
    id: "depart",
    titre: "Le portique de départ",
    texte: "La première image de chaque course : le bandeau DÉPART sur ses deux piliers, la ligne au sol, la tribune.",
    spec: "S/n@start S S S L2 S S S@finish",
    pose: (t) => poursuite(voitureSurBloc(bloc(t, 0), 8)),
  },
  {
    type: "element",
    id: "arrivee",
    titre: "L'arrivée",
    texte: "Le portique d'arrivée et son damier, vus en arrivant.",
    spec: "S/n@start S S S S@finish",
    pose: (t) => {
      const v = voitureSurBloc(bloc(t, t.blocks.length - 2), 6);
      return poursuite(v);
    },
  },
  {
    type: "element",
    id: "controle",
    titre: "Le point de contrôle",
    texte: "La porte d'un point de contrôle : on doit la voir de loin et savoir qu'on va la franchir.",
    spec: "S/n@start S S S@cp S S@finish",
    pose: (t) => {
      const b = bloc(t, 3);
      const c = world(b, CELL / 2, CELL / 2, b.y0);
      return troisQuarts(voitureSurBloc(bloc(t, 2), 10), new Vector3(c[0], c[1] + 4, c[2]), 26, 4, 1, 58);
    },
  },
  {
    type: "element",
    id: "plaques",
    titre: "Les plaques : boost et super turbo",
    texte: "Une plaque d'accélération (jaune), puis un super turbo (rouge) : lisibles de loin, sans gêner la trajectoire.",
    spec: "S/n@start S P S S T S S S S@finish",
    pose: (t) => {
      const b = bloc(t, 2);
      const v = voitureSurBloc(bloc(t, 1), 10);
      const c = world(b, CELL / 2, CELL / 2, b.y0);
      return troisQuarts(v, new Vector3(c[0], c[1], c[2]), 22, 11);
    },
  },
  {
    type: "element",
    id: "panneaux",
    titre: "Les panneaux de virage",
    texte: "Avant chaque virage : un panneau du côté extérieur, un chevron par degré (ample, large, serré).",
    spec: "S/n@start S S S R2 S S L S S S@finish",
    pose: (t) => {
      // Trois quarts sur le premier panneau (celui du virage à droite, planté à l'extérieur : à gauche).
      const s = signsFor(t)[0]!;
      const hote = bloc(t, s.block);
      const c = world(hote, CELL / 2 + s.side * s.offset, s.q, hote.y0);
      return troisQuarts(voitureSurBloc(hote, Math.max(2, s.q - 14)), new Vector3(c[0], c[1] + 3, c[2]), 16, 2.5, -s.side, 55);
    },
  },
  {
    type: "element",
    id: "rebords",
    titre: "La bordure et le rebord",
    texte: "Les rebords de la piste, les vibreurs d'un virage, la fin d'un bas-côté et le bord du vide (route sans rebords).",
    spec: "S/n@start S S L2 S/~h S S/~r S S/o S/o S S@finish",
    pose: (t) => {
      const v = voitureSurBloc(bloc(t, 2), 20);
      const b = bloc(t, 3);
      const c = world(b, CELL / 2, CELL / 2, b.y0);
      return troisQuarts(v, new Vector3(c[0], c[1] + 1, c[2]), 30, 14, -1, 58);
    },
  },
];

/** Ce qui fait chaque thème (palette, heure, décor), pour la légende de sa section. */
const TEXTES_THEMES: Record<ThemeName, string> = {
  stade: "Plein jour, pelouse, tribunes et drapeaux : le circuit le plus « course automobile ».",
  rallye: "Désert et terre, soleil franc : cactus, rochers, poussière.",
  banquise: "Jour blanc : neige, glace, sapins, brume laiteuse.",
  nuit: "La nuit : lampadaires, néons au bord du vide, phares.",
  campagne: "Fin d'après-midi dorée : herbe haute, clôtures, foin, arbres.",
  canyon: "Soleil rasant orangé : roche rouge, mesas, sable.",
  col: "Matin clair en montagne : sapins, chalets, glissières, cimes enneigées.",
  ville: "Béton et murs hauts : immeubles, lampadaires, angles droits.",
};

/** Premier jour de production (lot 28) : les jours montrés sont de vrais circuits du jour, déjà joués. */
const PREMIER_JOUR = daysFromCivil(2026, 10, 13);

export const THEMES_VITRINE: SujetTheme[] = THEME_NAMES.map((theme) => {
  let jour = PREMIER_JOUR;
  while (themeForDay(jour).name !== theme) jour++;
  return { type: "theme", id: `theme-${theme}`, theme, titre: THEMES[theme].label, texte: TEXTES_THEMES[theme], palette: THEMES[theme].palette, jour };
});

/** Points de vue d'une section de thème : la poursuite avant le premier virage (comme les captures du lot 23), le départ, une vue d'ensemble. */
export type PointDeVue = "virage" | "depart" | "ensemble" | "asphalte";

export function poseTheme(t: Track, vue: PointDeVue): Pose {
  if (vue === "depart") return poursuite(voitureSurBloc(t.blocks[0]!, 8));
  const virage = t.blocks.find((b, i) => i > 2 && isCurve(b.kind));
  const avant = virage ? t.blocks[virage.index - 1]! : t.blocks[6]!;
  const v = voitureSurBloc(avant, isCurve(avant.kind) ? 16 : 6);
  if (vue === "virage") return poursuite(v);
  const s = Math.sin(v.yaw);
  const c = Math.cos(v.yaw);
  // 38c : l'asphalte de près (la matière), à hauteur d'homme, derrière la voiture et sur le côté, le regard sur la route devant elle.
  if (vue === "asphalte") return { voiture: v, camera: new Vector3(v.x - s * 4 + c * 2.2, v.y + 1.5, v.z - c * 4 - s * 2.2), cible: new Vector3(v.x + s * 6, v.y, v.z + c * 6), fov: 50 };
  const cible = new Vector3(v.x + s * 30, v.y, v.z + c * 30);
  return { voiture: v, camera: new Vector3(v.x - s * 40 + c * 25, v.y + 38, v.z - c * 40 - s * 25), cible, fov: 60 };
}
