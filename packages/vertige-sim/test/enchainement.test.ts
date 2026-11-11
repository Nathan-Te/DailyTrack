import { describe, expect, it } from "vitest";
import { MODULES, M, ORDRE_ENCHAINEMENT, Partie, T_REPRISE, T_SAUT, TICKS_PAR_SECONDE, blocsDansUnePoche, blocsQuiSeRecouvrent, decoderRediffusion, distanceMinimaleEntrePaires, enchainement, enregistrerScenario, niveau, rejouerScenario, robotDuModule, surfacesMarqueesQuiSeTouchent, DISTANCE_PAIRES_MIN } from "../src/index";

// L'enchaînement fixe (lot V2) : 6 à 8 modules assemblés à la main, qui préfigurent le niveau du jour. Le test rejoue la solution ENTIÈRE, de bout en bout, sur le niveau assemblé : si une constante de sensation casse
// une solution, il dit lequel des modules ne passe plus. Les paliers sont des points de passage : une chute ramène au dernier, la touche de reprise aussi, le chrono continue.
const e = enchainement();
const modules = ORDRE_ENCHAINEMENT.map((id) => MODULES.find((m) => m.id === id)!);

describe("l'enchaînement", () => {
  it("est fait de 6 à 8 modules de la bibliothèque, tous différents des voisins", () => {
    expect(modules.length).toBeGreaterThanOrEqual(6);
    expect(modules.length).toBeLessThanOrEqual(8);
    for (const m of modules) expect(m).toBeDefined();
    modules.forEach((m, i) => i > 0 && expect(m.id).not.toBe(modules[i - 1]!.id));
  });
  it("le robot rejoue la solution entière, de bout en bout : il arrive, sans chute, en 30 à 45 s", () => {
    const p = new Partie(e.niveau);
    for (const c of e.solution) {
      if (p.finie) break;
      p.avancer(c);
    }
    expect(p.fin, "le robot n'arrive pas : une constante de sensation a changé ?").toBeGreaterThan(0);
    expect(p.chutes).toBe(0);
    expect(p.captures).toBe(modules.length + 1); // le palier de départ et la sortie de chaque module
    expect(e.solution.length).toBe(p.fin); // aucun pas après l'arrivée
    expect(e.arriveeRobot).toBe(p.fin);
    const secondes = p.chrono / TICKS_PAR_SECONDE;
    expect(secondes).toBeGreaterThanOrEqual(30);
    expect(secondes).toBeLessThanOrEqual(45);
  });
  it("le temps de chaque module dans l'enchaînement est celui de son robot seul : les paliers s'enchaînent tels quels (état canonique exact)", () => {
    modules.forEach((m, i) => {
      const dans = e.paliersRobot[i + 1]! - e.paliersRobot[i]!;
      expect(dans, `${m.id} : ${dans} pas dans l'enchaînement, ${robotDuModule(m).ticks} seul`).toBe(robotDuModule(m).ticks);
    });
    const total = e.paliersRobot[0]! + modules.reduce((s, m) => s + robotDuModule(m).ticks, 0);
    expect(e.paliersRobot[modules.length]).toBe(total);
  });
  it("à chaque palier, l'état est canonique : au centre, en course, dans l'axe", () => {
    const p = new Partie(e.niveau);
    let vues = 0;
    for (const c of e.solution) {
      if (p.finie) break;
      p.avancer(c);
      if (p.captures > vues) {
        const j = e.niveau.jonctions![vues]!;
        expect(p.pieds(), `le palier ${vues}`).toEqual([j.x, j.y, j.z]);
        expect([p.lacet, p.vx, p.vy, p.sol, p.dash, p.dashRecharge, p.ori]).toEqual([0, 0, 0, true, 0, 0, j.ori]);
        expect(p.vz).toBe(-9_500_000);
        vues = p.captures;
      }
    }
    expect(vues).toBe(modules.length + 1);
  });
  it("le niveau « enchainement » du jeu est cet enchaînement ; sa rediffusion se rejoue au bit près", () => {
    expect(niveau("enchainement")).toBe(e.niveau);
    const texte = enregistrerScenario("enchainement", e.solution);
    const r = rejouerScenario(texte);
    expect(r.nom).toBe("enchainement");
    expect(r.resultat.arrive).toBe(true);
    expect(r.resultat.ticks).toBe(e.arriveeRobot);
    expect(decoderRediffusion(texte).commandes.length).toBe(e.solution.length);
  });
});

describe("les contraintes de niveau, sur l'enchaînement entier", () => {
  it("jamais deux surfaces marquées qui se touchent, d'un module à l'autre non plus", () => {
    expect(surfacesMarqueesQuiSeTouchent(e.niveau.blocs)).toEqual([]);
  });
  it("les poches des portails sont vides, au plus une paire de portails visible à la fois (deux paires à plus de 40 m l'une de l'autre)", () => {
    expect(blocsDansUnePoche(e.niveau)).toEqual([]);
    expect(e.niveau.portails!.length).toBeGreaterThanOrEqual(1);
    expect(distanceMinimaleEntrePaires(e.niveau.portails!)).toBeGreaterThanOrEqual(DISTANCE_PAIRES_MIN);
    expect(DISTANCE_PAIRES_MIN).toBe(40 * M);
  });
  it("deux modules ne se traversent pas : aucun bloc d'un module ne recouvre ceux d'un autre", () => {
    let debut = 1; // le premier bloc est la dalle de départ
    const groupes = modules.map((m) => {
      const g = e.niveau.blocs.slice(debut, debut + m.blocs.length);
      debut += m.blocs.length;
      return g;
    });
    for (let a = 0; a < groupes.length; a++) for (let b = a + 1; b < groupes.length; b++) expect(blocsQuiSeRecouvrent(groupes[a]!, groupes[b]!), `${modules[a]!.id} et ${modules[b]!.id} se recouvrent`).toEqual([]);
  });
  it("tout est en entiers", () => {
    for (const b of e.niveau.blocs) for (const v of Object.values(b.boite)) expect(Number.isInteger(v)).toBe(true);
    for (const p of e.niveau.portails!) for (const v of [p.a.x, p.a.y, p.a.z, p.b.x, p.b.y, p.b.z]) expect(Number.isInteger(v)).toBe(true);
  });
});

describe("les points de passage", () => {
  it("une chute ramène au dernier palier (orientation comprise), le chrono continue", () => {
    // Le robot sans ses sauts dans le deuxième module : il tombe au premier écart et revient au palier de sortie du premier module.
    const p = new Partie(e.niveau);
    const [a, b] = [e.paliersRobot[1]!, e.paliersRobot[2]!];
    e.solution.forEach((c, i) => {
      if (p.chutes > 0) return;
      p.avancer(i >= a && i < b ? { ...c, k: c.k & ~T_SAUT } : c);
    });
    expect(p.chutes).toBe(1);
    const j = e.niveau.jonctions![1]!;
    expect(p.pieds()).toEqual([j.x, j.y, j.z]);
    expect(p.ori).toBe(j.ori);
    expect(p.chrono).toBeGreaterThan(a); // le chrono n'est pas remis à zéro
    expect(p.depart).toBe(0);
  });
  it("la touche de reprise ramène aussi au dernier palier, sans compter comme une chute de la partie : un compteur à part", () => {
    const p = new Partie(e.niveau);
    const [a, b] = [e.paliersRobot[2]!, e.paliersRobot[3]!];
    e.solution.forEach((c, i) => {
      if (i < a + 100) p.avancer(c);
    });
    const avant = p.chrono;
    p.avancer({ k: T_REPRISE | 1, dl: 0, dt: 0 });
    expect(p.reprises).toBe(1);
    const j = e.niveau.jonctions![2]!;
    expect(p.pieds()).toEqual([j.x, j.y, j.z]);
    expect(p.chrono).toBeGreaterThan(avant);
    void b;
  });
  it("chaque palier est un point de passage : une reprise du dernier palier atteint par le robot, de n'importe quel module", () => {
    modules.forEach((_, i) => {
      const p = new Partie(e.niveau);
      e.solution.forEach((c, k) => {
        if (k < e.paliersRobot[i]! + 5) p.avancer(c);
      });
      p.avancer({ k: T_REPRISE, dl: 0, dt: 0 });
      const j = e.niveau.jonctions![i]!;
      expect(p.pieds(), `le palier ${i}`).toEqual([j.x, j.y, j.z]);
    });
  });
});
