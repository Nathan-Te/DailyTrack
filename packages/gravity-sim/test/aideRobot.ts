import { expect } from "vitest";
import { MORCEAUX_PAR_BOUCLE, ROBOT_ECART_MIN, ROBOT_FENETRE_MIN, ROBOT_MAINTIEN_MIN, Partie, dailyGravity, jouerRobot, terrainDuJour, type Terrain } from "../src/index";

// Ce qu'on exige du robot sur un jour (lot GR2) : `franchissabilite.test.ts` (un échantillon) et `franchissabilite-30-jours.test.ts` (les trente jours du lot).
/** La première boucle des cinq thèmes (1 520 m) et la moitié de la seconde. */
export const DISTANCE_DU_TEST = Math.trunc(MORCEAUX_PAR_BOUCLE * 16 * 1.5);

/** Rejoue une liste de changements du bouton (appui, relâché…) jusqu'au pas `jusqua` (ou la mort) : la partie. */
export function rejouerLesChangements(terrain: Terrain, changements: readonly number[], jusqua: number, sansRamassage = false): Partie {
  const p = new Partie(terrain);
  p.ramasse = !sansRamassage;
  let k = 0;
  while (p.tick < jusqua && !p.finie) {
    while (k < changements.length && changements[k]! <= p.tick) {
      if (changements[k] === p.tick) {
        if (p.bouton) p.relacher();
        else p.appuyer();
      }
      k++;
    }
    p.avancer();
  }
  return p;
}

/** Chaque changement avec le mode où il a lieu et son sens : `appui` vrai (le doigt se pose) ou faux (il se lève). */
export function classerLesChangements(terrain: Terrain, changements: readonly number[]): { tick: number; mode: number; appui: boolean }[] {
  const p = new Partie(terrain);
  const sortie: { tick: number; mode: number; appui: boolean }[] = [];
  let k = 0;
  while (k < changements.length && !p.finie) {
    if (changements[k] === p.tick) {
      sortie.push({ tick: p.tick, mode: p.mode, appui: !p.bouton });
      if (p.bouton) p.relacher();
      else p.appuyer();
      k++;
    }
    p.avancer();
  }
  return sortie;
}

/** Joue un jour en strict et vérifie tout ce qu'on exige. */
export function verifierLeJour(jour: number): void {
  const terrain = terrainDuJour(dailyGravity(jour));
  const r = jouerRobot(terrain, { maxDistance: DISTANCE_DU_TEST, strict: true });
  const dit = `jour ${jour}`;
  expect(r.partie.finie, `${dit} : le robot est mort à ${r.partie.distance} m (morceau ${Math.trunc(r.partie.x / (16 * 4096))}, ${terrain.morceau(Math.trunc(r.partie.x / (16 * 4096))).motif})`).toBe(false);
  expect(r.partie.distance).toBeGreaterThanOrEqual(DISTANCE_DU_TEST);
  expect(r.rapport.entorses, `${dit} : des passages sans fenêtre`).toEqual([]);
  for (const a of r.rapport.appuis) {
    expect(a.respecte, `${dit} : l'appui du pas ${a.tick} (morceau ${a.morceau}, ${a.motif}) n'a pas sa fenêtre`).toBe(true);
    expect(a.fenetre, `${dit} : la fenêtre du pas ${a.tick} (morceau ${a.morceau}, ${a.motif})`).toBeGreaterThanOrEqual(ROBOT_FENETRE_MIN);
  }
  // Les contraintes d'humain de chaque mode (lot GR6) : 12 pas entre deux appuis en gravité et en ressort, 6 pas par appui ou relâché en avion et en onde.
  const classes = classerLesChangements(terrain, r.changements);
  const appuisGravite = classes.filter((c) => c.appui && (c.mode === 0 || c.mode === 3));
  for (let i = 1; i < appuisGravite.length; i++) expect(appuisGravite[i]!.tick - appuisGravite[i - 1]!.tick, `${dit} : appuis du pas ${appuisGravite[i - 1]!.tick} et ${appuisGravite[i]!.tick}`).toBeGreaterThanOrEqual(ROBOT_ECART_MIN);
  for (let i = 1; i < classes.length; i++) {
    const a = classes[i - 1]!;
    const b = classes[i]!;
    if ((a.mode === 1 || a.mode === 2) && (b.mode === 1 || b.mode === 2)) expect(b.tick - a.tick, `${dit} : changements du pas ${a.tick} et ${b.tick}`).toBeGreaterThanOrEqual(ROBOT_MAINTIEN_MIN);
  }
  // Les trois modes ont été traversés.
  expect(new Set(classes.map((c) => c.mode)), `${dit} : les modes traversés`).toEqual(new Set([0, 1, 2, 3]));
  // Toujours sans bouclier : la même partie, sans ramassage (donc sans bouclier), va aussi loin.
  const sans = rejouerLesChangements(terrain, r.changements, r.partie.tick, true);
  expect(sans.finie, `${dit} : la partie sans ramassage (donc sans bouclier) meurt`).toBe(false);
  expect(sans.distance).toBe(r.partie.distance);
}
