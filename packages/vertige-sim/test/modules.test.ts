import { describe, expect, it } from "vitest";
import { CM, M, ORIENTATIONS, POUSSEE, Partie, REGLAGES_DEFAUT, T_AVANT, T_SAUT, TICKS_PAR_SECONDE, gravite } from "../src/index";
import { MARGE_MILLE, MODULES, analyser, blocsDansUnePoche, commandesDuModule, ecartsHorsJauge, jauges, lireSolution, niveauDuModule, robotDuModule, surfacesMarqueesQuiSeTouchent, commandesDe, type Mecanique, type Module } from "../src/modulesIndex";

// La bibliothèque de modules (lot V2) : chaque module rejoue SA solution, de l'état canonique d'entrée à la capture de sa sortie, et le test échoue EN NOMMANT LE MODULE si une constante de sensation casse une jauge ou une
// solution (règle de `consignes.md`). Les contraintes de niveau (surfaces marquées qui ne se touchent pas, poches vides, une paire de portails par module) et la vérité des étiquettes se vérifient ici ; l'enchaînement
// est dans `enchainement.test.ts`.
const SECONDES = (ticks: number): number => ticks / TICKS_PAR_SECONDE;

describe("le format de module", () => {
  it("chaque module a un identifiant unique, un nom, des blocs, et l'entrée à l'origine, orientation 0", () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    for (const m of MODULES) {
      expect(m.nom.length, m.id).toBeGreaterThan(0);
      expect(m.blocs.length, m.id).toBeGreaterThan(0);
      expect(m.entree, m.id).toEqual({ x: 0, y: 0, z: 0, ori: 0 });
      expect(m.sortie.ori, m.id).toBeGreaterThanOrEqual(0);
      expect(m.sortie.ori, m.id).toBeLessThan(24);
      for (const v of [m.sortie.x, m.sortie.y, m.sortie.z]) expect(Number.isInteger(v), `${m.id} : la sortie est en entiers`).toBe(true);
      for (const b of m.blocs) for (const v of Object.values(b.boite)) expect(Number.isInteger(v), `${m.id} : les blocs sont en entiers`).toBe(true);
    }
  });
  it("les étiquettes : des mécaniques connues, une difficulté de 1 à 3", () => {
    const connues: Mecanique[] = ["course", "saut", "mur", "saut-de-mur", "dash", "gravite", "portail"];
    for (const m of MODULES) {
      expect(m.etiquettes.mecaniques.length, m.id).toBeGreaterThan(0);
      for (const e of m.etiquettes.mecaniques) expect(connues, `${m.id} : ${e}`).toContain(e);
      expect([1, 2, 3], m.id).toContain(m.etiquettes.difficulte);
    }
  });
  it("la bibliothèque compte 12 à 16 modules, et chaque mécanique principale a deux ou trois difficultés", () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(12);
    expect(MODULES.length).toBeLessThanOrEqual(16);
    for (const mecanique of ["saut", "mur", "dash", "gravite", "portail"] as const) {
      const difficultes = new Set(MODULES.filter((m) => m.etiquettes.mecaniques.includes(mecanique)).map((m) => m.etiquettes.difficulte));
      expect(difficultes.size, `${mecanique} : ${[...difficultes].join(",")}`).toBeGreaterThanOrEqual(2);
    }
    // Les combinaisons : mur puis dash, gravité puis portail, un portail qui change la gravité, un portail tourné d'un quart de tour.
    const combine = (a: Mecanique, b: Mecanique): boolean => MODULES.some((m) => m.etiquettes.mecaniques.includes(a) && m.etiquettes.mecaniques.includes(b));
    expect(combine("mur", "dash")).toBe(true);
    expect(combine("gravite", "portail")).toBe(true);
    expect(MODULES.some((m) => m.sortie.ori !== 0 && (m.portails ?? []).length > 0), "un portail qui tourne la sortie").toBe(true);
  });
});

describe("la solution de chaque module (le robot)", () => {
  for (const m of MODULES) {
    describe(`${m.id} — ${m.nom}`, () => {
      const robot = robotDuModule(m);
      it("arrive à la capture de sa sortie, sans chute, depuis l'état canonique d'entrée", () => {
        expect(robot.arrive, `${m.id} : la solution n'arrive pas (une constante de sensation a changé ?)`).toBe(true);
        expect(robot.partie.chutes, `${m.id} : le robot tombe`).toBe(0);
        expect(robot.partie.captures, m.id).toBe(1);
      });
      it("est écrite au pas près : aucun pas après la capture de la sortie", () => {
        expect(commandesDuModule(m).length, `${m.id} : la solution compte des pas en trop (${commandesDuModule(m).length} écrits, ${robot.ticks} utiles)`).toBe(robot.ticks);
      });
      it("dure de 4 à 8 secondes", () => {
        expect(SECONDES(robot.ticks), `${m.id} : ${SECONDES(robot.ticks).toFixed(2)} s`).toBeGreaterThanOrEqual(4);
        expect(SECONDES(robot.ticks), `${m.id} : ${SECONDES(robot.ticks).toFixed(2)} s`).toBeLessThanOrEqual(8);
      });
      it("termine dans l'état de jonction canonique, exact en entiers", () => {
        const p = robot.partie;
        const sortie = niveauDuModule(m).jonctions![1]!;
        expect(p.pieds(), `${m.id} : les pieds au centre du palier de sortie`).toEqual([sortie.x, sortie.y, sortie.z]);
        expect([p.ori, p.lacet, p.sol, p.coyote, p.tampon, p.dash, p.dashRecharge, p.murVerrou, p.murT, p.surMur, p.basculeVerrou, p.vx, p.vy]).toEqual([sortie.ori, 0, true, 0, 0, 0, 0, 0, 0, false, 0, 0, 0]);
        expect(p.vz).toBe(-REGLAGES_DEFAUT.vitesse * CM);
        expect(p.gravite).toBe(gravite(ORIENTATIONS[sortie.ori]!));
      });
      it("ses écarts sont dans les 85 % des jauges", () => {
        expect(ecartsHorsJauge(analyser(m)), m.id).toEqual([]);
      });
      it("ses étiquettes disent vrai : chaque mécanique annoncée est jouée, et aucune ne manque", () => {
        const a = analyser(m);
        const vues = new Set<Mecanique>(a.phases.flatMap((ph) => ph.mecaniques));
        if (robot.partie.bascules > 0 || robot.partie.gravite !== 3) vues.add("gravite"); // une surface marquée, ou un portail qui change la gravité
        if (robot.partie.traversees > 0) vues.add("portail");
        const dites = new Set<Mecanique>(m.etiquettes.mecaniques);
        dites.delete("course"); // toujours vraie
        for (const v of vues) expect(dites.has(v), `${m.id} : la solution joue « ${v} » sans l'annoncer`).toBe(true);
        for (const d of dites) expect(vues.has(d), `${m.id} : « ${d} » est annoncée mais la solution ne la joue pas`).toBe(true);
      });
    });
  }
});

describe("les contraintes de niveau, module par module", () => {
  for (const m of MODULES) {
    it(`${m.id} : jamais deux surfaces marquées qui se touchent, les poches des portails vides, au plus une paire de portails`, () => {
      const niveau = niveauDuModule(m);
      expect(surfacesMarqueesQuiSeTouchent(niveau.blocs), `${m.id} : des surfaces marquées se touchent`).toEqual([]);
      expect(blocsDansUnePoche(niveau), m.id).toEqual([]);
      expect((m.portails ?? []).length, `${m.id} : plus d'une paire de portails (coût de rendu)`).toBeLessThanOrEqual(1);
    });
  }
});

describe("les jauges", () => {
  const j = jauges();
  it("viennent des constantes : course, hauteur et portée du saut, mur, dash, saut de mur", () => {
    expect(j.course).toBe(REGLAGES_DEFAUT.vitesse * CM);
    expect(j.hauteurSaut).toBeGreaterThan(1.5 * M);
    expect(j.hauteurSaut).toBeLessThan(1.7 * M);
    expect(j.vol(0).distance).toBeGreaterThan(6 * M);
    expect(j.volDash(0).distance).toBeGreaterThan(j.vol(0).distance + 5 * M);
    expect(j.mur.longueur).toBeGreaterThan(15 * M);
    expect(MARGE_MILLE).toBe(850);
    expect(j.permis.ecartSaut(0)).toBe(Math.trunc((j.ecartSaut(0) * 850) / 1000));
  });
  it("coïncident avec le moteur : un vrai saut au bord et un vrai saut avec dash atterrissent là où la jauge le dit (à un pas près)", () => {
    // Le saut : la distance parcourue entre le pas du saut et le retour à la hauteur du départ est celle de la jauge (la simulation entière, pas une copie de ses formules).
    const p = new Partie({ nom: "bac-a-sable", blocs: [{ boite: { x0: -3 * M, y0: -1 * M, z0: -200 * M, x1: 3 * M, y1: 0, z1: 5 * M }, role: "pierre" }], depart: { x: 0, y: POUSSEE, z: 0, lacet: 0, lance: true }, arrivee: null, reprises: [], gemmes: [], chute: -100 * M });
    p.avancer({ k: T_AVANT | T_SAUT, dl: 0, dt: 0 });
    const z0 = p.z;
    let pas = 1;
    while (!p.sol && pas < 300) {
      p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
      pas++;
    }
    const mesure = z0 - p.z;
    const calcule = j.vol(0);
    expect(Math.abs(pas - calcule.pas)).toBeLessThanOrEqual(2);
    expect(Math.abs(-mesure - -calcule.distance)).toBeLessThan(0.2 * M);
  });
  it("une constante de sensation qui change change la jauge (la jauge n'est pas recopiée)", () => {
    const rapide = jauges({ ...REGLAGES_DEFAUT, vitesse: 1200 });
    expect(rapide.vol(0).distance).toBeGreaterThan(j.vol(0).distance + 1 * M);
    const haut = jauges({ ...REGLAGES_DEFAUT, saut: 1100 });
    expect(haut.hauteurSaut).toBeGreaterThan(j.hauteurSaut + 0.3 * M);
  });
});

describe("le langage de solution", () => {
  it("compile en commandes entières : cours, attends, saute, dash, tourne", () => {
    const c = commandesDe("cours 3; saute; attends 2 +gauche; dash; tourne 90 4; cours 1 +droite");
    expect(c.length).toBe(3 + 1 + 2 + 1 + 4 + 1);
    expect(c[0]).toEqual({ k: 1, dl: 0, dt: 0 });
    expect(c[3]).toEqual({ k: 1 | 16, dl: 0, dt: 0 });
    expect(c[4]).toEqual({ k: 4, dl: 0, dt: 0 });
    expect(c[6]).toEqual({ k: 4 | 32, dl: 0, dt: 0 });
    expect(c.slice(7, 11).reduce((s, x) => s + x.dl, 0)).toBe(16384); // 90° : un quart de tour exactement
    expect(c[11]).toEqual({ k: 1 | 8, dl: 0, dt: 0 });
  });
  it("un virage de D degrés fait exactement D × 65 536 / 360 (zéro), réparti sans reste perdu", () => {
    for (const [deg, n] of [[90, 12], [-90, 7], [180, 12], [45, 5], [10, 3]] as const) {
      const somme = commandesDe(`tourne ${deg} ${n}`).reduce((s, x) => s + x.dl, 0);
      expect(somme).toBe(Math.trunc((deg * 65536) / 360));
    }
  });
  it("refuse ce qu'il ne comprend pas, en le disant", () => {
    expect(() => lireSolution("cours")).toThrowError(/nombre de pas/);
    expect(() => lireSolution("vole 3")).toThrowError(/inconnue/);
    expect(() => lireSolution("cours 3 +haut")).toThrowError(/touche inconnue/);
    expect(() => lireSolution("saute 2")).toThrowError(/ne prend rien/);
    expect(() => lireSolution("cours 3 trois")).toThrowError(/mot inconnu/);
  });
  it("les commentaires et les lignes se lisent", () => {
    expect(commandesDe("cours 2 # un commentaire\nsaute").length).toBe(3);
  });
});

describe("l'aimantation du palier (l'état de jonction canonique)", () => {
  const m = MODULES.find((x) => x.id === "saut-1")!;
  it("ne touche pas un joueur qui n'est pas dans l'état voulu : trop lent, de côté, ou regard de travers", () => {
    const niveau = niveauDuModule(m);
    const sortie = niveau.jonctions![1]!;
    const robot = robotDuModule(m).commandes;
    // Le même robot, mais qui part du repos plus près : il n'a pas la vitesse au palier de sortie d'entrée ; et un regard tourné de 5° d'un coup au départ.
    const regard = new Partie(niveauDuModule(m, { lance: true }));
    regard.avancer({ k: T_AVANT, dl: 900, dt: 0 });
    for (const c of robot.slice(1)) regard.avancer({ ...c, dl: 0 });
    expect(regard.captures, "un regard de travers n'est jamais ramené").toBe(0);
    const lent = new Partie({ ...niveau, depart: { ...niveau.depart, lance: false } });
    for (const c of robot) lent.avancer(c);
    expect(lent.captures).toBe(0);
    expect(sortie.fin).toBe(true);
  });
  it("une chute ramène au dernier palier, le chrono continue ; sauter après le point revient au palier d'entrée", () => {
    const robot = robotDuModule(m).commandes;
    const sansSaut = robot.map((c) => ({ ...c, k: c.k & ~T_SAUT }));
    const p = new Partie(niveauDuModule(m, { lance: true }));
    for (const c of sansSaut) {
      p.avancer(c);
      if (p.chutes > 0) break;
    }
    expect(p.chutes).toBe(1);
    const entree = niveauDuModule(m).jonctions![0]!;
    expect(p.pieds()).toEqual([entree.x, entree.y, entree.z]); // le dernier palier : celui d'entrée
    expect(p.depart).toBeGreaterThanOrEqual(0);
    expect(p.chrono).toBeGreaterThan(0); // le chrono n'est pas remis à zéro
    expect([p.vx, p.vy, p.vz]).toEqual([0, 0, 0]);
  });
});
