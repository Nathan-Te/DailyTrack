import { formatDay } from "@cdj/core";
import { CASE, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, LARGEUR_MORCEAU, NB_THEMES, TAILLE } from "./constantes";
import { dailyGravity, terrainDuJour, type Contenu } from "./generateur";
import { figerJour, type JourFige } from "./jours";
import { jouerRobot } from "./robot";

// **La préparation des jours à l'avance** (lot GR5, `jours.fabrication.preparer` de la fiche, comme Tower et Pinball) : `npm run preparer:gravity` écrit les jours à venir **avec leurs seuils** pour qu'aucun navigateur ni
// serveur ne fasse tourner le robot sur un jour servi, **et fait passer le robot sur chaque jour qu'il prépare** : un jour qui n'est pas franchissable avec les contraintes d'humain (12 pas entre deux appuis, 8 pas de
// fenêtre, jamais le bouclier : `robot.ts`) **fait échouer la préparation**, et la sortie dit le jour, le morceau et le motif. C'était la question du lot GR2 : « un jour futur peut échouer, la mise en production ne le sait pas ».
// **Un jour infranchissable se corrige dans le générateur** (on monte `GRAVITY_GENERATOR_VERSION`), jamais en assouplissant le robot ni en sautant le jour.

/** Jusqu'où le robot joue pour prouver un jour : la première boucle des cinq thèmes et la moitié de la seconde (2 280 m), comme `test/franchissabilite-30-jours.test.ts`. */
export const distanceDeLaPreuve = (morceauxParTheme: number): number => Math.trunc((morceauxParTheme * NB_THEMES * LARGEUR_MORCEAU * 3) / 2);

/** Un passage qu'un humain ne franchit pas : où (morceau, motif) et pourquoi. */
export interface DefautDeJour {
  morceau: number;
  motif: string;
  /** `sans-fenetre` : aucun appui n'avait la fenêtre d'un humain (au pas `pas`) ; `mort` : le robot est mort là (à `distance` mètres). */
  raison: "sans-fenetre" | "mort";
  pas?: number;
  distance?: number;
  /** Une mort contre un mur : le morceau qui est juste devant le joueur quand il meurt, s'il n'est pas celui où il meurt (le mur est le premier de ses colonnes). */
  devant?: { morceau: number; motif: string };
}
export interface VerdictDeJour {
  jour: number;
  /** Les mètres que le robot devait jouer, et ceux qu'il a joués. */
  distance: number;
  joues: number;
  defauts: DefautDeJour[];
  ok: boolean;
}

/** Une phrase par défaut : « morceau 12 (etages) : aucun appui n'avait la fenêtre d'un humain (pas 3400) » ou « morceau 6 (pilier) : mort à 96 m ». */
export const phraseDuDefaut = (d: DefautDeJour): string =>
  `morceau ${d.morceau} (${d.motif}) : ${d.raison === "mort" ? `le robot meurt à ${d.distance} m${d.devant ? `, devant le morceau ${d.devant.morceau} (${d.devant.motif})` : ""}` : `aucun appui n'a la fenêtre d'un humain (pas ${d.pas})`}`;

/** Le robot joue le jour (mode diagnostic : tous les passages sans fenêtre sont listés, pas seulement le premier) et dit si un humain le franchit. */
export function verifierFranchissable(contenu: Contenu, distance?: number): VerdictDeJour {
  const terrain = terrainDuJour(contenu);
  const voulue = distance ?? distanceDeLaPreuve(terrain.regles!.morceauxParTheme);
  const r = jouerRobot(terrain, { maxDistance: voulue, strict: false });
  const p = r.partie;
  const defauts: DefautDeJour[] = r.rapport.entorses.map((e) => ({ morceau: e.morceau, motif: e.motif, raison: "sans-fenetre", pas: e.tick }));
  if (p.finie && p.distance < voulue) {
    const morceau = Math.trunc(p.x / (LARGEUR_MORCEAU * CASE));
    const devant = Math.trunc((p.x + TAILLE + 1) / (LARGEUR_MORCEAU * CASE));
    defauts.push({ morceau, motif: terrain.morceau(morceau).motif, raison: "mort", distance: p.distance, ...(devant !== morceau ? { devant: { morceau: devant, motif: terrain.morceau(devant).motif } } : {}) });
  }
  return { jour: contenu.jour, distance: voulue, joues: p.distance, defauts, ok: defauts.length === 0 };
}

/** La préparation d'un jour a échoué : il n'est pas franchissable. Porte le verdict (le jour, les passages) ; le message le dit en clair. */
export class ErreurDePreparation extends Error {
  constructor(readonly verdict: VerdictDeJour) {
    super(`${formatDay(verdict.jour)} : jour infranchissable avec les contraintes d'humain — ${verdict.defauts.map(phraseDuDefaut).join(" ; ")}`);
    this.name = "ErreurDePreparation";
  }
}

/**
 * Prépare un jour : le fait passer au robot (`verifierFranchissable`), puis le fige avec ses seuils (`figerJour`). Lève `ErreurDePreparation` si le jour n'est pas franchissable. `version` et `sim` : le générateur et la simulation
 * (les courants par défaut) ; `distance` : ce que le robot doit jouer (la preuve : 2 280 m).
 */
export function preparerJour(jour: number, options: { version?: number; sim?: number; distance?: number } = {}): JourFige {
  const contenu = dailyGravity(jour, options.version ?? GRAVITY_GENERATOR_VERSION, options.sim ?? GRAVITY_SIM_VERSION);
  const verdict = verifierFranchissable(contenu, options.distance);
  if (!verdict.ok) throw new ErreurDePreparation(verdict);
  return figerJour(jour, undefined, contenu.g, contenu.sim);
}
