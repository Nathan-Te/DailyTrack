import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { COURBE_DOUCE, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, MORCEAUX_PAR_THEME, Partie, REGLES_COURANTES, dailyGravity, distancesDArret, empreinteContenu, reglesDe, reglesDuContenu, seuilsDuRobot, terrainDuJour, vitesseCamera } from "../src/index";

// Lot GR5 — les réglages d'essai du côté de la simulation : un contenu qui porte des `reglages` joue sous d'autres règles (caméra, gravité, longueur d'un thème, pourcentage des médailles) ; **sans réglage, rien ne
// change** (le golden le dit : `golden.test.ts`), et deux jeux de règles ne partagent ni leur terrain gardé ni leurs seuils gardés.
const JOUR = daysFromCivil(2026, 11, 9);

describe("les règles d'un contenu", () => {
  it("sans réglage : celles de la version courante, celles que les fonctions prennent par défaut", () => {
    const c = dailyGravity(JOUR);
    expect(c.reglages).toBeUndefined();
    expect(reglesDuContenu(c)).toEqual(REGLES_COURANTES);
    expect(REGLES_COURANTES).toMatchObject({ sim: GRAVITY_SIM_VERSION, vitesseBase: 32768, vitesseMax: 51200, distanceParCran: 122, courbe: COURBE_DOUCE, gravite: 1570, ventGravite: 628, morceauxParTheme: MORCEAUX_PAR_THEME });
    expect(c.g).toBe(GRAVITY_GENERATOR_VERSION);
  });
  it("des réglages remplacent ce qu'ils nomment, le reste est de la version ; la gravité du vent suit la gravité (2/5)", () => {
    const r = reglesDe(GRAVITY_SIM_VERSION, 19, { vitesseBase: 36864, gravite: 1800, morceauxParTheme: 8 });
    expect(r).toMatchObject({ vitesseBase: 36864, vitesseMax: 51200, distanceParCran: 122, courbe: COURBE_DOUCE, gravite: 1800, ventGravite: 720, morceauxParTheme: 8 });
    expect(vitesseCamera(0, r)).toBe(36864);
    expect(vitesseCamera(0)).toBe(32768);
  });
  it("un contenu à réglages a son propre terrain : la partie lit la gravité, la caméra et la longueur du thème de l'essai", () => {
    const normal = dailyGravity(JOUR);
    const essai = dailyGravity(JOUR, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, { vitesseBase: 36864, gravite: 1200, morceauxParTheme: 6 });
    const a = new Partie(terrainDuJour(normal));
    const b = new Partie(terrainDuJour(essai));
    for (let i = 0; i < 60; i++) {
      a.avancer();
      b.avancer();
    }
    expect(b.regles).toMatchObject({ vitesseBase: 36864, gravite: 1200, morceauxParTheme: 6 });
    expect(b.cam).toBeGreaterThan(a.cam); // la caméra de l'essai part plus vite
    expect(empreinteContenu(essai)).not.toBe(empreinteContenu(normal)); // les surfaces suivent la vitesse : le niveau n'est plus le même
    expect(terrainDuJour(essai)).not.toBe(terrainDuJour(normal)); // aucun terrain gardé n'est partagé entre deux jeux de règles
    expect(new Partie(terrainDuJour(dailyGravity(JOUR))).regles).toEqual(REGLES_COURANTES); // et le terrain normal reste le normal après l'essai
  });
  it("la longueur d'un thème règle aussi les distances où les seuils sont lus", () => {
    expect(distancesDArret({ morceauxParTheme: 19 })).toEqual({ bronze: 304, silver: 608, gold: 912, author: 1520 });
    expect(distancesDArret({ morceauxParTheme: 10 })).toEqual({ bronze: 160, silver: 320, gold: 480, author: 800 });
  });
  it("le pourcentage des médailles change les seuils (et leur mémoire : aucun seuil d'un autre pourcentage n'est resservi)", () => {
    const jour = JOUR + 3;
    const normal = seuilsDuRobot(dailyGravity(jour));
    const moitie = seuilsDuRobot(dailyGravity(jour, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, { pourcent: 30 }));
    // 30 % au lieu de 60 % du même score du robot : la moitié, à 10 près (arrondis) — jamais les mêmes
    for (const k of ["bronze", "silver", "gold", "author"] as const) expect(Math.abs(moitie[k] * 2 - normal[k]), k).toBeLessThanOrEqual(20);
    expect(moitie.author).toBeLessThan(normal.author);
    expect(seuilsDuRobot(dailyGravity(jour))).toEqual(normal);
  });
});
