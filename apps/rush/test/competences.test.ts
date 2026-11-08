import { InstancedMesh } from "three";
import { describe, expect, it } from "vitest";
import { AMELIORATIONS, COMPETENCES, PREMIER_JOUR_RUSH, Partie, REGLAGES_DEFAUT, competenceDe, contenuScenario, dailyRush, entree, GELATON, NB_COMPETENCES } from "@cdj/rush-sim";
import { ACTIONS_RUSH } from "../src/actions";
import { carteVue, competenceVue } from "../src/cartes";
import { CATALOGUE_RUSH } from "../src/catalogue";
import { Gelatons, MAX_GELATONS, attitudeGelaton, formeGelaton } from "../src/gelatons";
import { lireEssai } from "../src/essai";
import { ECLATS_VASE, monterVases } from "../src/vasesVue";

// Lot BR5 — les compétences, les gélatons et les vases, côté vue, sans navigateur : les textes dans les deux langues, la commande, l'adresse d'essai, les tas instanciés.
const traducteur = (langue: "fr" | "en") => (cle: string, params: Readonly<Record<string, string | number>> = {}): string => {
  const brut = (CATALOGUE_RUSH[langue] as Record<string, string>)[cle];
  if (brut === undefined) throw new Error(`clé absente (${langue}) : ${cle}`);
  return brut.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
};

describe("les compétences choisies au départ", () => {
  it("chacune des trois a un nom, un effet et une icône, dans les deux langues, sans paramètre resté en clair", () => {
    expect(NB_COMPETENCES).toBe(3);
    for (const langue of ["fr", "en"] as const) {
      const t = traducteur(langue);
      COMPETENCES.forEach((id, i) => {
        const c = competenceVue(i, REGLAGES_DEFAUT, t);
        expect(c.id).toBe(id);
        expect(c.nom.length).toBeGreaterThan(3);
        expect(c.effet).not.toMatch(/[{}]/);
        expect(c.icone).toMatch(/^M/);
        expect(c.famille).toBe("competence");
      });
    }
  });
  it("l'effet écrit les nombres des réglages (un curseur de `?debug&tune` change le texte)", () => {
    const t = traducteur("fr");
    expect(competenceVue(1, { ...REGLAGES_DEFAUT, bondPortee: 800 }, t).effet).toContain("8 m");
    expect(competenceVue(2, { ...REGLAGES_DEFAUT, bouclierCibles: 5 }, t).effet).toContain("5 ennemis");
    expect(competenceVue(0, { ...REGLAGES_DEFAUT, tourbillonDuree: 120 }, t).effet).toContain("2.0 s");
  });
  it("la carte « Signature » dit son effet pour la compétence choisie, les autres cartes de compétence leurs nombres", () => {
    const i = AMELIORATIONS.findIndex((a) => a.id === "signature");
    for (const langue of ["fr", "en"] as const) {
      const t = traducteur(langue);
      const textes = [0, 1, 2].map((c) => carteVue(i, 0, REGLAGES_DEFAUT, t, -1, c).effet);
      expect(new Set(textes).size).toBe(3);
      for (const x of textes) expect(x).not.toMatch(/[{}]/);
    }
    expect(carteVue(i, 0, REGLAGES_DEFAUT, traducteur("fr"), -1, 1).effet).toContain("1.0 s");
    const t = traducteur("fr");
    for (const id of ["recharge-vive", "maitrise", "echo", "signature"]) {
      const k = AMELIORATIONS.findIndex((a) => a.id === id);
      expect(AMELIORATIONS[k]!.famille).toBe("competence");
      expect(carteVue(k, 0, REGLAGES_DEFAUT, t).effet).not.toMatch(/[{}]/);
    }
    expect(carteVue(AMELIORATIONS.findIndex((a) => a.id === "maitrise"), 0, { ...REGLAGES_DEFAUT, maitriseDegats: 41 }, t).effet).toContain("+41 %");
  });
});

describe("la commande de la compétence", () => {
  it("l'action `competence` est déclarée au kit : E au clavier, RB (b5) à la manette", () => {
    const a = ACTIONS_RUSH.find((x) => x.id === "competence")!;
    expect(a.clavier).toContain("KeyE");
    expect(a.manette).toBe("b5");
  });
  it("l'entrée porte la compétence dans le bit 14, qui laisse la visée intacte", () => {
    const e = entree(3, true, false, 12, true);
    expect(competenceDe(e)).toBe(true);
    expect(competenceDe(entree(3, true, false, 12))).toBe(false);
    expect(e >> 8).toBe(13 | 64);
  });
});

describe("l'adresse d'essai de la compétence", () => {
  it("`&competence=` est lue (une partie d'essai) et ignorée sur la production", () => {
    expect(lireEssai("?scenario=horde&competence=bond", false)).toMatchObject({ scenario: "horde", competence: "bond", essai: true });
    expect(lireEssai("?scenario=horde&competence=bond", true).competence).toBeNull();
    expect(lireEssai("?scenario=arene&monstres=60", false).monstres).toBe(60);
  });
  it("une compétence d'un scénario d'essai est celle de l'adresse ; le jour la laisse à choisir", () => {
    expect(contenuScenario("horde", { competence: 2 }).competence).toBe(2);
    expect(contenuScenario("mannequin", { competence: 9 }).competence).toBe(0);
    expect(dailyRush(PREMIER_JOUR_RUSH).competence).toBe(-1);
    expect(new Partie(dailyRush(PREMIER_JOUR_RUSH)).attenteDepart).toBe(true);
    expect(new Partie(contenuScenario("horde", { competence: 1 })).attenteDepart).toBe(false);
  });
});

describe("les gélatons (un tas instancié)", () => {
  it("leur forme est légère (dôme et yeux fusionnés : moins de 500 triangles)", () => {
    const g = formeGelaton();
    const n = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    expect(n).toBeLessThan(500);
  });
  it("le tas pose jusqu'à 96 gélatons dans UN seul maillage instancié (et un pour la coque de contour)", () => {
    const g = new Gelatons();
    g.debut();
    const a = attitudeGelaton({ t: 0, gel: 0, age: 0 }, 0, 100, { gelatonAnnonce: 18, gelatonBond: 14, gelatonCycle: 38 });
    for (let i = 0; i < 120; i++) g.poser(i, 0, 0, a, 0, 0);
    g.fin();
    expect(g.corps).toBeInstanceOf(InstancedMesh);
    expect(g.corps.count).toBe(MAX_GELATONS);
    expect(g.coque.count).toBe(MAX_GELATONS);
  });
  it("l'attitude suit la simulation : écrasé à l'annonce, en l'air au bond, apparition qui grandit", () => {
    const d = { gelatonAnnonce: 18, gelatonBond: 14, gelatonCycle: 38 };
    const repos = attitudeGelaton({ t: 0, gel: 0, age: 0 }, 0, 100, d);
    const annonce = attitudeGelaton({ t: 17, gel: 0, age: 0 }, 0, 100, d);
    const bond = attitudeGelaton({ t: 25, gel: 0, age: 0 }, 0, 100, d);
    const neuf = attitudeGelaton({ t: 0, gel: 0, age: 100 }, 0, 105, d);
    expect(annonce.sy).toBeLessThan(repos.sy);
    expect(bond.y).toBeGreaterThan(0.5);
    expect(repos.y).toBe(0);
    expect(neuf.pop).toBeLessThan(1);
    expect(repos.pop).toBe(1);
  });
  it("le monstre de la simulation s'appelle GELATON (2)", () => {
    expect(GELATON).toBe(2);
  });
});

describe("les vases (trois tas instanciés)", () => {
  it("un tas par genre : tous les vases du jour y sont posés, les brisés disparaissent", () => {
    const p = new Partie(dailyRush(PREMIER_JOUR_RUSH + 3));
    const v = monterVases();
    v.maj(p.vases, 0);
    expect(v.compte().reduce((a, b) => a + b, 0)).toBe(p.vases.length);
    expect(p.vases.length).toBeGreaterThanOrEqual(20);
    expect(v.groupe.children.filter((c) => c instanceof InstancedMesh)).toHaveLength(6); // trois corps, trois coques de contour
    const avant = p.vases.length;
    p.vases[0]!.id = -1 - p.vases[0]!.id; // brisé
    v.maj(p.vases, 0.1);
    expect(v.compte().reduce((a, b) => a + b, 0)).toBe(avant - 1);
  });
  it("les voisins d'un vase brisé sursautent (ils s'élèvent un instant, puis retombent)", () => {
    const p = new Partie(dailyRush(PREMIER_JOUR_RUSH + 3));
    const v = monterVases();
    const [a, b] = [p.vases[0]!, p.vases.find((q) => q !== p.vases[0] && Math.hypot(q.x - p.vases[0]!.x, q.y - p.vases[0]!.y) < 4096 * 1.2)];
    expect(b, "le groupe a un voisin à 1,2 m").toBeDefined();
    v.maj(p.vases, 0);
    v.secouer(a.x / 4096, a.y / 4096, 1);
    v.maj(p.vases, 1.1);
    const haut = (): number => {
      let max = 0;
      for (const m of v.groupe.children) if (m instanceof InstancedMesh && m.layers.mask === 1) for (let i = 0; i < m.count; i++) max = Math.max(max, m.instanceMatrix.array[i * 16 + 13]!);
      return max;
    };
    expect(haut()).toBeGreaterThan(0.02);
    v.maj(p.vases, 3);
    expect(haut()).toBe(0);
  });
  it("chaque genre a ses éclats (terre cuite pour la jarre, bois pour les autres)", () => {
    expect(ECLATS_VASE).toEqual(["jarre", "bois", "planche"]);
  });
});

describe("l'écran de fin dit la compétence choisie", () => {
  it("une ligne « Compétence : … » dans les deux langues, absente sans compétence", async () => {
    const { lignesDeFin } = await import("../src/fin");
    const p = AMELIORATIONS.map(() => 0);
    expect(lignesDeFin({ boss: 0, paliers: p, competence: 1 }, { t: traducteur("fr"), langue: "fr" }).competence).toBe("Compétence : Bond écrasant");
    expect(lignesDeFin({ boss: 0, paliers: p, competence: 2 }, { t: traducteur("en"), langue: "en" }).competence).toBe("Skill: Shield throw");
    expect(lignesDeFin({ boss: 0, paliers: p }, { t: traducteur("fr"), langue: "fr" }).competence).toBeNull();
  });
});
