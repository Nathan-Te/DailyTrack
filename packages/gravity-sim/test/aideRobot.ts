import { expect } from "vitest";
import { MORCEAUX_PAR_BOUCLE, ROBOT_FENETRE_MIN, dailyGravity, jouerRobot, terrainDuJour } from "../src/index";

// Ce qu'on exige du robot sur un jour (lot GR2) : `franchissabilite.test.ts` (un échantillon) et `franchissabilite-30-jours.test.ts` (les trente jours du lot).
/** La première boucle des cinq thèmes (1 520 m) et la moitié de la seconde. */
export const DISTANCE_DU_TEST = Math.trunc(MORCEAUX_PAR_BOUCLE * 16 * 1.5);

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
  expect(r.partie.inversions).toBe(r.appuis.length);
}

