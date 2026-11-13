import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { M, Partie, TICKS_PAR_SECONDE, VERTIGE_GENERATOR_VERSION, empreinteContenu, enregistrer, niveauDuContenu, rejouer, scoreParColonnes } from "../src/index";
import {
  CLOTURES,
  DISTANCE_NON_VOISINS_CM,
  MEME_BASE_MAX,
  MODULES_MAX,
  MODULES_MIN,
  OUVERTURES,
  PASSAGES_TOURNES_MAX,
  ROBOT_MAX_S,
  ROBOT_MIN_S,
  assemblerCles,
  clotureDuJour,
  controlerNiveau,
  cycle,
  dailyVertige,
  enchainementDuContenu,
  genererNiveau,
  groupesDeBlocs,
  distanceMinimaleCm,
  gravitesDesPaliers,
  ouvertureDuJour,
  passagesTournes,
  robotDuJour,
  tirer,
  varianteDeCle,
  viderCachesDuGenerateur,
} from "../src/modulesIndex";

// Le générateur du niveau du jour (lot V3) : sur 365 jours à partir du premier jour, chaque niveau rejoue la solution de son robot de bout en bout et respecte TOUTES les règles (`controlerNiveau`) ; les règles de variété se
// vérifient une à une, et un test les voit échouer sur des niveaux fabriqués pour les enfreindre. Les mesures du README (histogramme des temps, fréquences, temps de génération) viennent de `npm run niveaux:vertige`.
const PREMIER = daysFromCivil(2026, 11, 2);
const JOURS = Array.from({ length: 365 }, (_, i) => PREMIER + i);
const niveaux = (): ReturnType<typeof genererNiveau>[] => JOURS.map((j) => genererNiveau(j));
const base = (cle: string): string => varianteDeCle(cle)!.base;
const mods = (cles: readonly string[]) => cles.map((c) => varianteDeCle(c)!.module);

describe("le niveau du jour sur 365 jours", () => {
  it("chaque niveau est valide : toutes les règles, la solution du robot rejouée de bout en bout, un temps de 28 à 38 s", () => {
    for (const g of niveaux()) {
      const cles = g.contenu.modules!;
      const e = assemblerCles(cles);
      const r = controlerNiveau(cles, e, mods(cles));
      expect(r.refus, `jour ${g.contenu.jour} : ${cles.join(" ")}`).toEqual([]);
      expect(r.ticksRobot).toBe(g.contenu.ticksRobot);
      expect(g.contenu.ticksRobot! / TICKS_PAR_SECONDE).toBeGreaterThanOrEqual(ROBOT_MIN_S);
      expect(g.contenu.ticksRobot! / TICKS_PAR_SECONDE).toBeLessThanOrEqual(ROBOT_MAX_S);
      expect(g.secours, `jour ${g.contenu.jour} : le secours a servi`).toBe(false);
    }
  }, 600_000);
  it("le robot arrive, sans chute, en autant de pas que le contenu le dit ; sa rediffusion donne le Diamant par le chemin du serveur (rejouer, puis scoreParColonnes)", () => {
    for (const j of JOURS.filter((_x, i) => i % 15 === 0)) {
      const c = dailyVertige(j);
      const r = rejouer(c, enregistrer(c, robotDuJour(c)));
      expect(r.arrive).toBe(true);
      expect(r.chutes).toBe(0);
      expect(scoreParColonnes(r)).toEqual({ temps: c.ticksRobot });
    }
  }, 120_000);
  it("6 à 8 modules, au moins 3 mécaniques, jamais le même module deux fois de suite, un module de base deux fois au plus", () => {
    for (const g of niveaux()) {
      const cles = g.contenu.modules!;
      expect(cles.length).toBeGreaterThanOrEqual(MODULES_MIN);
      expect(cles.length).toBeLessThanOrEqual(MODULES_MAX);
      const meca = new Set(mods(cles).flatMap((m) => m.etiquettes.mecaniques));
      meca.delete("course");
      expect(meca.size, `jour ${g.contenu.jour}`).toBeGreaterThanOrEqual(3);
      cles.forEach((c, i) => i > 0 && expect(base(c), `jour ${g.contenu.jour}`).not.toBe(base(cles[i - 1]!)));
      for (const b of new Set(cles.map(base))) expect(cles.filter((c) => base(c) === b).length).toBeLessThanOrEqual(MEME_BASE_MAX);
      expect(new Set(cles).size, "une même variante deux fois").toBe(cles.length);
    }
  }, 120_000);
  it("la courbe de difficulté : on commence facile (1), on finit plus dur (2 ou 3), la seconde moitié est plus dure que la première", () => {
    for (const g of niveaux()) {
      const d = mods(g.contenu.modules!).map((m) => m.etiquettes.difficulte);
      const h = Math.floor(d.length / 2);
      const somme = (v: number[]): number => v.reduce((s, x) => s + x, 0);
      expect(d[0], `jour ${g.contenu.jour}`).toBe(1);
      expect(d[d.length - 1]!, `jour ${g.contenu.jour}`).toBeGreaterThanOrEqual(2);
      expect(somme(d.slice(d.length - h)), `jour ${g.contenu.jour} : ${d.join("")}`).toBeGreaterThan(somme(d.slice(0, h)));
    }
  }, 120_000);
  it("au plus 2 passages dans un monde tourné, jamais la gravité vers le haut", () => {
    let avecMondeTourne = 0;
    for (const g of niveaux()) {
      const m = mods(g.contenu.modules!);
      expect(passagesTournes(m).length, `jour ${g.contenu.jour}`).toBeLessThanOrEqual(PASSAGES_TOURNES_MAX);
      expect(gravitesDesPaliers(m)).not.toContain(2);
      if (passagesTournes(m).length > 0) avecMondeTourne++;
    }
    expect(avecMondeTourne, "le monde tourné existe dans le niveau du jour").toBeGreaterThan(20);
  }, 120_000);
  it("placement sûr : les modules non voisins sont à 30 m au moins, aucun bloc de deux modules ne se recouvre", () => {
    for (const g of niveaux().filter((_x, i) => i % 7 === 0)) {
      const m = mods(g.contenu.modules!);
      const e = assemblerCles(g.contenu.modules!);
      const groupes = groupesDeBlocs(e.niveau, m);
      for (let a = 0; a < groupes.length; a++) for (let b = a + 2; b < groupes.length; b++) expect(distanceMinimaleCm(groupes[a]!, groupes[b]!), `jour ${g.contenu.jour} : ${a}-${b}`).toBeGreaterThanOrEqual(DISTANCE_NON_VOISINS_CM);
    }
  }, 120_000);
  it("chaque module dure, dans le niveau, ce qu'il dure seul (les paliers s'enchaînent tels quels)", () => {
    for (const g of niveaux().filter((_x, i) => i % 5 === 0)) {
      const e = enchainementDuContenu(g.contenu);
      expect(e.paliersRobot.length).toBe(g.contenu.modules!.length + 1);
      expect(e.solution.length).toBe(e.arriveeRobot);
    }
  }, 120_000);
});

describe("d'un jour à l'autre", () => {
  it("le premier module et le dernier ne sont jamais ceux de la veille, par construction (les cycles)", () => {
    for (let j = PREMIER - 400; j < PREMIER + 2000; j++) {
      expect(ouvertureDuJour(j + 1), `jour ${j}`).not.toBe(ouvertureDuJour(j));
      expect(clotureDuJour(j + 1), `jour ${j}`).not.toBe(clotureDuJour(j));
      expect(OUVERTURES).toContain(ouvertureDuJour(j));
      expect(CLOTURES).toContain(clotureDuJour(j));
    }
  });
  it("chaque module d'ouverture et de clôture sert aussi souvent que les autres (une permutation par bloc de jours)", () => {
    for (const [pool, f] of [[OUVERTURES, ouvertureDuJour], [CLOTURES, clotureDuJour]] as const) {
      const compte = new Map<string, number>();
      for (let j = PREMIER; j < PREMIER + pool.length * 40; j++) compte.set(f(j), (compte.get(f(j)) ?? 0) + 1);
      for (const b of pool) expect(compte.get(b), b).toBe(40);
    }
  });
  it("le cycle est une fonction du seul numéro de jour, et le premier d'un bloc n'est jamais le dernier du bloc d'avant", () => {
    expect(cycle(["a", "b", "c", "d"], 10, 1)).toBe(cycle(["a", "b", "c", "d"], 10, 1));
    const pool = ["a", "b", "c"];
    for (let bloc = 0; bloc < 500; bloc++) expect(cycle(pool, 3 * bloc + 3, 7)).not.toBe(cycle(pool, 3 * bloc + 2, 7));
  });
  it("sur 365 jours, aucune suite de modules ne revient, et deux jours qui se suivent ne partagent ni leur premier ni leur dernier module", () => {
    const vus = new Set<string>();
    const n = niveaux();
    n.forEach((g, i) => {
      const cles = g.contenu.modules!;
      expect(vus.has(cles.map(base).join(">")), `jour ${g.contenu.jour} : la même suite que plus tôt`).toBe(false);
      vus.add(cles.map(base).join(">"));
      if (i > 0) {
        const avant = n[i - 1]!.contenu.modules!;
        expect(base(cles[0]!)).not.toBe(base(avant[0]!));
        expect(base(cles[cles.length - 1]!)).not.toBe(base(avant[avant.length - 1]!));
      }
    });
    expect(new Set(n.map((g) => g.contenu.modules!.join(">"))).size).toBe(365);
  }, 120_000);
});

describe("le contenu : une fonction de (jour, version), pure et stable", () => {
  it("le même jour donne le même niveau, même après avoir vidé les caches", () => {
    const a = dailyVertige(PREMIER + 40);
    viderCachesDuGenerateur();
    const b = dailyVertige(PREMIER + 40);
    expect(b).toEqual(a);
    expect(empreinteContenu(b)).toBe(empreinteContenu(a));
    expect(a.g).toBe(VERTIGE_GENERATOR_VERSION);
    expect(a.niveau).toBe("jour");
  });
  it("deux jours différents ont des empreintes différentes ; la version 1 reste appelable (le parcours), une version inconnue est refusée", () => {
    expect(new Set(JOURS.slice(0, 60).map((j) => empreinteContenu(dailyVertige(j)))).size).toBe(60);
    expect(dailyVertige(PREMIER, 1)).toEqual({ jour: PREMIER, g: 1, niveau: "parcours" });
    expect(() => dailyVertige(PREMIER, 99)).toThrowError(/version de générateur inconnue/);
  });
  it("un niveau du jour se retrouve par son contenu (`niveauDuContenu`), et le tirage est une suite de clés connues", () => {
    const c = dailyVertige(PREMIER + 3);
    expect(niveauDuContenu(c)).toBe(assemblerCles(c.modules!).niveau);
    expect(niveauDuContenu(c).nom).toBe("jour");
    const t = tirer(PREMIER + 3, 0);
    expect(t === null || t.every((k) => varianteDeCle(k) !== undefined)).toBe(true);
  });
  it("la partie du jour se joue depuis le départ : le joueur est au repos, 9 m avant le premier palier", () => {
    const n = niveauDuContenu(dailyVertige(PREMIER));
    const p = new Partie(n);
    expect(p.tick).toBe(0);
    expect(n.depart.z - n.jonctions![0]!.z).toBe(9 * M);
  });
});

describe("les règles se voient échouer sur des niveaux fabriqués pour les enfreindre", () => {
  const verifier = (cles: string[]): string[] => controlerNiveau(cles, assemblerCles(cles), mods(cles)).refus;
  it("le même module deux fois de suite, trop peu de mécaniques, le mauvais départ ou la mauvaise fin sont refusés", () => {
    expect(verifier(["saut-1", "saut-1/c", "saut-2", "saut-1/l", "saut-2/l", "saut-1"]).join()).toMatch(/deux fois de suite/);
    expect(verifier(["saut-1", "saut-2", "saut-1/l", "saut-2/l", "saut-1/c", "saut-2/c"]).join()).toMatch(/mécaniques/);
    expect(verifier(["saut-2", "mur-1", "dash-1", "gravite-1", "portail-1", "mur-dash"]).join()).toMatch(/premier module/);
    expect(verifier(["saut-1", "mur-1", "dash-1", "gravite-1", "portail-1", "saut-1/c"]).join()).toMatch(/dernier module/);
  });
  it("trop de passages dans un monde tourné sont refusés", () => {
    const trois = ["portail-gravite", "portail-gravite-retour", "saut-1", "portail-gravite", "portail-gravite-retour", "saut-2", "portail-gravite", "portail-gravite-retour"];
    expect(passagesTournes(mods(trois)).length).toBeGreaterThan(2);
    expect(verifier(trois).join()).toMatch(/passages dans un monde tourné/);
  });
  it("un niveau qui revient près de lui-même (des virages qui bouclent) est refusé : l'arrivée n'exige pas d'avoir passé les paliers", () => {
    const boucle = ["portail-quart", "portail-quart", "portail-quart", "saut-2", "mur-dash", "saut-1/c"];
    expect(verifier(boucle).join()).toMatch(/non voisins|se recouvrent/);
  });
  it("le temps du robot hors de 28 à 38 s est refusé", () => {
    expect(verifier(["saut-1/c", "saut-2/c", "saut-1/c", "saut-2/c", "saut-1/c", "saut-2/c"]).join()).toMatch(/le robot met/);
  });
});
