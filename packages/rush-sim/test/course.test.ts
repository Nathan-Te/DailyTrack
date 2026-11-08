import { describe, expect, it } from "vitest";
import {
  ALERTE_GELEE,
  BORNES,
  GELEE,
  PREMIER_JOUR_RUSH,
  MONSTRE_NEUTRE,
  Partie,
  REGLAGES_DEFAUT,
  contenuScenario,
  cm,
  dailyRush as dailyRushReel,
  distance,
  entree,
  idiv,
  reglagesDe,
  type Monstre,
  type Reglages,
  type Contenu,
} from "../src/index";

// Lot BR5 : le jour demande de choisir une compétence au départ ; ces essais jouent la première (le tourbillon) sans écran de choix.
const dailyRush = (jour: number, version?: number): Contenu => ({ ...dailyRushReel(jour, version), competence: 0 });

// La course hors combat (lot BR1b ; lot BR5 : elle part après 0,7 s et monte en 0,2 s) : ×1,6 la marche après ~0,7 s sans frapper, sans être touché et sans ennemi alerté à moins de 10 m ; coupée au premier coup, à la première alerte, au premier dégât ; jamais dans l'arène.
const J0 = PREMIER_JOUR_RUSH;
const VIT = idiv(cm(REGLAGES_DEFAUT.vitesse), 60);

/** Une partie du jour, le chevalier au centre du départ : à chaque tick on le ramène à sa place pour mesurer son pas sans qu'il quitte la clairière. */
function sur(reglages: Reglages = REGLAGES_DEFAUT, jour = J0): { p: Partie; pas: (e: number) => number; x0: number; y0: number } {
  const p = new Partie(dailyRush(jour), reglages);
  const x0 = p.c.x;
  const y0 = p.c.y;
  const pas = (e: number): number => {
    p.c.x = x0;
    p.c.y = y0;
    p.avancer(e);
    const d = distance(p.c.x, p.c.y, x0, y0);
    p.c.x = x0;
    p.c.y = y0;
    return d;
  };
  return { p, pas, x0, y0 };
}
const MARCHE = entree(8);
/** Un monstre posé n'importe où, immobile (étourdi) ou non. */
const monstre = (x: number, y: number, o: Partial<Monstre> = {}): Monstre => ({ id: 900, type: GELEE, x, y, kx: 0, ky: 0, hp: 30, flash: 0, etat: 0, t: 0, age: 0, a: 0, sens: 1, cx: 0, cy: 0, gel: 0, duree: 999, coup: 0, hx: x, hy: y, alerte: 0, laisse: 0, ra: 0, sbire: 0, ...MONSTRE_NEUTRE, ...o });

describe("la course hors combat (lot BR1b)", () => {
  it("les réglages par défaut (lot BR5) : 0,7 s de calme, 0,2 s de montée, ×1,6, rayon de 10 m ; les curseurs de ?debug&tune ont des bornes", () => {
    expect(REGLAGES_DEFAUT.courseDelai).toBe(42);
    expect(REGLAGES_DEFAUT.courseMontee).toBe(12);
    expect(REGLAGES_DEFAUT.courseFacteur).toBe(160);
    expect(REGLAGES_DEFAUT.courseRayon).toBe(1000);
    for (const k of ["courseDelai", "courseMontee", "courseFacteur", "courseRayon"] as const) {
      expect(BORNES[k][0]).toBeLessThan(REGLAGES_DEFAUT[k]);
      expect(BORNES[k][1]).toBeGreaterThan(REGLAGES_DEFAUT[k]);
    }
    expect(reglagesDe({ courseFacteur: 9999 }).courseFacteur).toBe(BORNES.courseFacteur[1]);
    expect(reglagesDe({}).courseDelai).toBe(42);
  });

  it("la marche pendant 0,7 s, puis la vitesse monte en 0,2 s jusqu'à ×1,6 et y reste", () => {
    const { pas } = sur();
    const pasN: number[] = [];
    const D = REGLAGES_DEFAUT.courseDelai;
    const M = REGLAGES_DEFAUT.courseMontee;
    for (let t = 1; t <= 140; t++) pasN.push(pas(MARCHE));
    for (let t = 0; t < D; t++) expect(pasN[t]).toBeLessThanOrEqual(VIT + 1); // la marche (468 cm/s)
    for (let t = D; t < D + M - 1; t++) {
      expect(pasN[t]).toBeGreaterThan(pasN[t - 1]! - 1); // elle monte
      expect(pasN[t]).toBeGreaterThan(VIT + 1);
      expect(pasN[t]).toBeLessThan(Math.trunc(VIT * 1.6));
    }
    for (let t = D + M; t < 140; t++) {
      expect(pasN[t]).toBeGreaterThanOrEqual(Math.trunc(VIT * 1.6) - 2);
      expect(pasN[t]).toBeLessThanOrEqual(Math.trunc(VIT * 1.6) + 2);
    }
  });

  it("elle ne monte qu'en marchant, et la vue la lit : `course` va de 0 à 100", () => {
    const { p, pas } = sur();
    for (let t = 0; t < 200; t++) pas(0); // 200 ticks à l'arrêt : calme, mais pas de montée
    expect(p.c.elan).toBe(0);
    expect(p.course).toBe(0);
    pas(MARCHE);
    expect(p.c.elan).toBe(1);
    for (let t = 0; t < 40; t++) pas(MARCHE);
    expect(p.c.elan).toBe(REGLAGES_DEFAUT.courseMontee);
    expect(p.course).toBe(100);
  });

  it("un coup donné la coupe aussitôt, et il faut de nouveau 0,7 s de calme (après le coup)", () => {
    const { p, pas } = sur();
    for (let t = 0; t < 130; t++) pas(MARCHE);
    expect(p.c.elan).toBe(REGLAGES_DEFAUT.courseMontee);
    pas(entree(8, true));
    expect(p.c.elan).toBe(0);
    expect(p.c.calme).toBe(0);
    // tant que le coup dure, jamais de course
    for (let t = 0; t < 29; t++) {
      pas(entree(8, false));
      expect(p.c.elan).toBe(0);
    }
    // le coup fini, la marche, puis `courseDelai` ticks plus tard la course repart
    let premier = -1;
    for (let t = 0; t < 400 && premier < 0; t++) {
      pas(MARCHE);
      if (p.c.elan > 0) premier = t;
    }
    expect(premier).toBeGreaterThanOrEqual(REGLAGES_DEFAUT.courseDelai - 2);
    expect(premier).toBeLessThanOrEqual(REGLAGES_DEFAUT.courseDelai + 8);
  });

  it("un dégât la coupe aussitôt", () => {
    const { p, pas, x0, y0 } = sur();
    for (let t = 0; t < 130; t++) pas(MARCHE);
    expect(p.c.elan).toBeGreaterThan(0);
    // une gelée qui n'est pas alertée (elle n'interdit pas la course d'avance) arrive sur le chevalier
    p.monstres.push(monstre(x0, y0, { t: 30 })); // lot BR6 : une gelée ne blesse que pendant son bond (elle s'écrase 30 ticks avant)
    const coeurs = p.c.coeurs;
    p.avancer(MARCHE);
    expect(p.c.coeurs).toBe(coeurs - 1);
    expect(p.c.elan).toBe(0);
    expect(p.c.calme).toBe(0);
  });

  it("un ennemi qui s'alerte empêche d'en commencer une (calme remis à zéro) mais ne coupe PAS la course lancée : c'est ce qui rend le coup d'élan utile (lot BR5 ; au BR1b il la coupait aussitôt)", () => {
    const p = new Partie(dailyRush(J0), REGLAGES_DEFAUT, true);
    const g = p.monstres.find((m) => m.type === GELEE)!;
    // il fait calme et le chevalier court : on l'amène à la lisière du rayon d'alerte de la gelée
    p.c.calme = REGLAGES_DEFAUT.courseDelai;
    p.c.elan = REGLAGES_DEFAUT.courseMontee;
    p.c.x = g.x + ALERTE_GELEE - cm(50);
    p.c.y = g.y;
    p.c.degat = 9999;
    p.avancer(MARCHE);
    expect(g.alerte).toBe(1);
    expect(p.evenements.some((e) => e.k === "alerte")).toBe(true);
    expect(p.c.elan).toBe(REGLAGES_DEFAUT.courseMontee); // elle continue
    expect(p.c.calme).toBe(0); // mais il faudra de nouveau du calme pour en recommencer une
  });

  it("un ennemi déjà alerté à moins de 10 m l'interdit ; à plus de 10 m non ; le rayon est un réglage", () => {
    for (const [ecart, rayon, court] of [[cm(900), 1000, false], [cm(1100), 1000, true], [cm(900), 800, true], [cm(900), 1000, false]] as const) {
      const { p, pas, x0, y0 } = sur({ ...REGLAGES_DEFAUT, courseRayon: rayon });
      // une gelée alertée, étourdie (elle ne bouge pas), à `ecart` du chevalier
      p.monstres.push(monstre(x0 + ecart, y0, { alerte: 1, gel: 99999, laisse: cm(5000) }));
      for (let t = 0; t < 200; t++) pas(MARCHE);
      expect(p.c.elan > 0).toBe(court);
    }
  });

  it("pas de course dans l'arène : la barrière fermée la coupe, et elle ne revient pas", () => {
    const p = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    const n = p.niveau!;
    p.c.calme = 500;
    p.c.elan = REGLAGES_DEFAUT.courseMontee;
    p.c.x = n.arene.x;
    p.c.y = n.arene.y;
    p.avancer(0);
    expect(p.barriere).toBeGreaterThan(0);
    p.avancer(MARCHE);
    expect(p.c.elan).toBe(0);
    for (let t = 0; t < 300; t++) {
      p.c.coeurs = 3;
      p.avancer(entree(0));
      expect(p.c.elan).toBe(0);
    }
  });

  it("pas de course dans les scénarios d'essai (pas de niveau)", () => {
    const p = new Partie(contenuScenario("boss"), REGLAGES_DEFAUT);
    for (let t = 0; t < 300; t++) {
      p.c.coeurs = 3;
      p.avancer(entree(8));
      expect(p.c.elan).toBe(0);
    }
  });

  it("l'esquive est inchangée : la même course, calme ou en pleine course", () => {
    const dodge = (preparer: boolean): number => {
      const { p, pas, x0, y0 } = sur();
      if (preparer) for (let t = 0; t < 130; t++) pas(MARCHE);
      expect(p.c.elan > 0).toBe(preparer);
      p.c.x = x0;
      p.c.y = y0;
      p.avancer(entree(8, false, true)); // le premier des 12 ticks de l'esquive
      for (let t = 0; t < 11; t++) p.avancer(entree(8));
      return distance(p.c.x, p.c.y, x0, y0);
    };
    expect(dodge(true)).toBe(dodge(false));
  });

  it("les réglages la règlent : facteur 100 = pas de course ; délai 0 = tout de suite ; montée 1 = d'un coup", () => {
    const sans = sur({ ...REGLAGES_DEFAUT, courseFacteur: 100 });
    for (let t = 0; t < 200; t++) expect(sans.pas(MARCHE)).toBeLessThanOrEqual(VIT + 1);
    const vite = sur({ ...REGLAGES_DEFAUT, courseDelai: 0, courseMontee: 1, courseFacteur: 200 });
    vite.pas(MARCHE);
    expect(vite.pas(MARCHE)).toBeGreaterThanOrEqual(VIT * 2 - 2);
  });

  it("elle est déterministe : deux parties aux mêmes entrées ont la même empreinte à chaque tick", () => {
    const a = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    const b = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    for (let t = 0; t < 900; t++) {
      const e = entree(((t >> 6) * 5) % 32, t % 211 === 0, t % 331 === 0);
      a.c.coeurs = b.c.coeurs = 3;
      a.avancer(e);
      b.avancer(e);
      expect(a.empreinte()).toBe(b.empreinte());
    }
  });
});
