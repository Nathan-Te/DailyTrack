import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  CASE,
  GRAVITY_BOT_VERSION,
  LARGEUR_MORCEAU,
  Partie,
  ROBOT_ECART_MIN,
  ROBOT_FENETRE_MIN,
  ROBOT_HORIZON,
  ROBOT_MAINTIEN_MIN,
  ROBOT_MARGE,
  ROBOT_SANS_BOUCLIER,
  dailyGravity,
  decoderRediffusion,
  enregistrer,
  jouerRobot,
  rejouer,
  terrainDuJour,
  type Terrain,
} from "../src/index";
import { partieSur } from "./aide";
import { classerLesChangements, rejouerLesChangements } from "./aideRobot";

// Le robot (lot GR2) : il joue la vraie simulation comme un humain. Ces tests gardent ses contraintes — les constantes nommées, l'écart entre deux appuis, la fenêtre de réussite, le refus du bouclier —, son
// déterminisme (deux appels, la même partie) et que sa partie est une rediffusion valide, rejouée par le serveur. La franchissabilité de 30 jours est `franchissabilite.test.ts`.
const JOUR = daysFromCivil(2026, 11, 9);
const terrain = (jour = JOUR): Terrain => terrainDuJour(dailyGravity(jour));

describe("les contraintes d'humain du robot sont des constantes nommées", () => {
  it("12 pas entre deux appuis, une fenêtre d'au moins 8 pas (4 de chaque côté), sans bouclier, deux morceaux d'avance", () => {
    expect(ROBOT_ECART_MIN).toBe(12);
    expect(ROBOT_FENETRE_MIN).toBe(8);
    expect(ROBOT_MARGE).toBe(4);
    expect(ROBOT_SANS_BOUCLIER).toBe(true);
    expect(ROBOT_HORIZON).toBe(2);
    expect(ROBOT_MAINTIEN_MIN).toBe(6); // lot GR6 : en avion et en onde, un appui ou un relâché dure au moins 6 pas
    expect(GRAVITY_BOT_VERSION).toBeGreaterThanOrEqual(3);
  });
});

describe("le robot joue comme un humain", () => {
  const r = jouerRobot(terrain(), { maxDistance: 700 });
  const classes = classerLesChangements(terrain(), r.changements);
  it("les contraintes d'humain de chaque mode : 12 pas entre deux appuis en gravité et en ressort, 6 pas par appui ou relâché en avion et en onde, jamais deux changements au même pas", () => {
    expect(r.changements.length).toBeGreaterThan(20);
    expect(new Set(classes.map((c) => c.mode)).size, "la partie du robot doit passer par plusieurs modes").toBeGreaterThan(1);
    for (let i = 1; i < r.changements.length; i++) expect(r.changements[i]! - r.changements[i - 1]!).toBeGreaterThanOrEqual(1);
    const appuisGravite = classes.filter((c) => c.appui && (c.mode === 0 || c.mode === 3));
    for (let i = 1; i < appuisGravite.length; i++) expect(appuisGravite[i]!.tick - appuisGravite[i - 1]!.tick, `appuis du pas ${appuisGravite[i - 1]!.tick} et ${appuisGravite[i]!.tick}`).toBeGreaterThanOrEqual(ROBOT_ECART_MIN);
    for (let i = 1; i < classes.length; i++) {
      const a = classes[i - 1]!;
      const b = classes[i]!;
      if ((a.mode === 1 || a.mode === 2) && (b.mode === 1 || b.mode === 2)) expect(b.tick - a.tick, `changements du pas ${a.tick} et ${b.tick}`).toBeGreaterThanOrEqual(ROBOT_MAINTIEN_MIN);
    }
  });
  it("chaque changement du pilote ou de la recherche a sa fenêtre : au moins 9 pas qui réussissent de suite (4 de chaque côté), et le rapport le dit", () => {
    expect(r.rapport.entorses).toEqual([]);
    expect(r.rapport.appuis.length).toBeGreaterThan(20);
    for (const a of r.rapport.appuis) {
      expect(a.respecte).toBe(true);
      expect(a.fenetre).toBeGreaterThanOrEqual(2 * ROBOT_MARGE + 1);
      expect(a.fenetre).toBeGreaterThanOrEqual(ROBOT_FENETRE_MIN);
    }
  });
  it("chaque appui de gravité est utile : il inverse la gravité (jamais un appui perdu)", () => {
    expect(r.partie.inversions).toBe(classes.filter((c) => c.appui && c.mode === 0).length);
  });
  it("chaque changement tient s'il arrive 4 pas plus tôt ou plus tard : la partie rejouée avec lui décalé reste vivante (80 pas)", () => {
    // On ne décale qu'un changement à la fois (avec son relâché d'un pas en gravité et en ressort), les autres restent à leur pas.
    const t = terrain();
    const echantillon = r.changements.map((_, i) => i).filter((i) => i % 7 === 0).slice(0, 14);
    for (const i of echantillon) {
      for (const d of [-ROBOT_MARGE, ROBOT_MARGE]) {
        const liste = [...r.changements];
        liste[i] = liste[i]! + d;
        if (classes[i + 1] && classes[i]!.appui && classes[i + 1]!.tick - classes[i]!.tick === 1) liste[i + 1] = liste[i + 1]! + d; // le relâché d'un pas suit son appui
        if (liste.some((v, j) => j > 0 && v <= liste[j - 1]!)) continue; // un décalage qui chevauche un voisin n'est pas un décalage : la fenêtre est jugée pour chaque changement par le robot
        const p = rejouerLesChangements(t, liste, r.changements[i]! + 80);
        expect(p.finie, `changement ${r.changements[i]} décalé de ${d}`).toBe(false);
      }
    }
  });
  it("il ne passe jamais par le bouclier : la partie du robot n'en utilise aucun même quand il en ramasse", () => {
    // Un bouclier ramassé n'est jamais consommé : `bouclier` reste vrai à la fin si le robot en a pris un et qu'aucun danger ne l'a touché.
    const long = jouerRobot(terrain(), { maxDistance: 1700 });
    expect(long.partie.finie).toBe(false);
    expect(long.partie.invuln).toBe(0);
  });
  it("une copie de planification n'a ni bouclier, ni ramassage, même si la partie copiée en a un", () => {
    const p = partieSur([]);
    p.bouclier = true;
    p.invuln = 50;
    p.aimant = 100;
    const c = p.copier(true);
    expect({ b: c.bouclier, i: c.invuln, a: c.aimant, r: c.ramasse }).toEqual({ b: false, i: 0, a: 0, r: false });
    const q = p.copier();
    expect({ b: q.bouclier, i: q.invuln, a: q.aimant, r: q.ramasse }).toEqual({ b: true, i: 50, a: 100, r: true });
  });
});

describe("le robot est déterministe et sa partie est une vraie rediffusion", () => {
  it("deux appels donnent les mêmes appuis, le même score, le même rapport", () => {
    const a = jouerRobot(terrain(), { maxDistance: 400 });
    const b = jouerRobot(terrain(), { maxDistance: 400 });
    expect(b.changements).toEqual(a.changements);
    expect(b.partie.score).toBe(a.partie.score);
    expect(b.rapport).toEqual(a.rapport);
  });
  it("le serveur rejoue ses changements : même score, même pas ; la rediffusion se décode ; il ramasse bien plus que la distance", () => {
    const c = dailyGravity(JOUR);
    const { changements: appuis, partie } = jouerRobot(terrainDuJour(c), { maxDistance: 600 });
    const lus = decoderRediffusion(enregistrer(c, appuis)).changements;
    expect(lus).toEqual(appuis);
    const rejeu = rejouerLesChangements(terrainDuJour(c), lus, partie.tick);
    expect(rejeu.resultat()).toEqual(partie.resultat());
    expect(rejouer(c, enregistrer(c, appuis)).score).toBeGreaterThanOrEqual(partie.score); // le serveur va jusqu'à la mort
    expect(partie.pieces).toBeGreaterThan(100);
    expect(partie.multMax).toBeGreaterThanOrEqual(3);
    expect(partie.score).toBeGreaterThan(partie.distance * 3);
  });
  it("il garde le multiplicateur et ne lâche que ce qu'il doit : plus de 80 % des pièces des morceaux traversés sont prises", () => {
    const { rapport, partie } = jouerRobot(terrain(), { maxDistance: 600 });
    const total = rapport.piecesPrises + rapport.piecesLachees;
    expect(total).toBeGreaterThan(150);
    expect(rapport.piecesPrises / total).toBeGreaterThan(0.8);
    expect(partie.pieces).toBe(rapport.piecesPrises);
  });
  it("il joue la boucle des cinq thèmes en moins de 3 secondes (le budget du robot, lot GR6 : 2 s avant les modes de vol)", () => {
    const t0 = performance.now();
    const { partie } = jouerRobot(terrainDuJour(dailyGravity(JOUR + 3)), { maxDistance: 5 * 19 * LARGEUR_MORCEAU });
    const ms = performance.now() - t0;
    expect(partie.distance).toBeGreaterThanOrEqual(1520);
    // Mesuré : ~1 s sous Node sur la machine du lot ; la marge couvre les machines lentes de la CI (le budget est vérifié par `npm run robot:gravity`, qui rend le temps de chaque jour).
    expect(ms).toBeLessThan(6000);
  });
  it("il s'arrête où on le lui demande : `maxTicks` et `maxDistance`", () => {
    const a = jouerRobot(terrain(), { maxTicks: 1000 });
    expect(a.partie.tick).toBe(1000);
    const b = jouerRobot(terrain(), { maxDistance: 100 });
    expect(b.partie.distance).toBeGreaterThanOrEqual(100);
    expect(b.partie.distance).toBeLessThan(110);
    void CASE;
  });
});
