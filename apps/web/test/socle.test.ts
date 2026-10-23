import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTrack } from "@cdj/sim";
import { composerP1 } from "../src/scene/composerP1";
import type { TrackScene } from "../src/trackMesh";
import type { TrackSceneOptions } from "../src/trackMesh";
import { GROUPE_VIE_CIEL, PALIER_DEFAUT, PALIER_EXISTANT, PAS_DU_JEU, PAS_DU_PALIER, brancherComposeur, brancherPas, chargerPas, composer, creerReconstructeur, palierBranche, pasVoulus, type Registre } from "../src/scene/socle";

// Lot 39 : le socle par paliers (lot 43 : le palier 1 est la scène du jeu, l'existant se charge à la demande). Ce qui se prouve sans carte graphique : le registre des pas (un `import()` chacun, une fois), le composeur par palier, et le
// reconstructeur (« jamais pendant une course »), avec un pas factice. La scène « existant » elle-même (ciel, textures) se vérifie dans le navigateur :
// `e2e/socle.spec.ts` et `e2e/captures-lot39.spec.ts` (captures avant / après identiques).

const piste = parseTrack("socle-test", "S/n@start S S L2 S S@finish");
const fausseScene = (nom: string) => ({ nom }) as unknown as TrackScene;
const attendre = () => new Promise((r) => setTimeout(r, 0));

describe("le registre des pas", () => {
  it("charge chaque module une seule fois, au moment où on le demande", async () => {
    let imports = 0;
    const registre: Registre = { factice: async () => ({ id: ++imports }) };
    expect(imports).toBe(0); // rien n'est chargé tant qu'on ne le demande pas
    const [a] = await chargerPas(["factice"], registre);
    const [b] = await chargerPas(["factice", "factice"], registre);
    expect(imports).toBe(1);
    expect(a).toEqual({ id: 1 });
    expect(b).toEqual({ id: 1 });
  });

  it("un pas inconnu est une erreur, sans rien charger d'autre", async () => {
    let imports = 0;
    await expect(chargerPas(["inconnu"], { factice: async () => ++imports })).rejects.toThrow("pas inconnu");
    expect(imports).toBe(0);
  });

  it("lot 43 : le palier 1 est la scène par défaut, sans aucun module à charger ; lot 46 : le palier 3 prend la vie, le ciel et les ombres fines, chacun un import()", () => {
    expect(PALIER_DEFAUT).toBe("P1");
    expect(palierBranche("P1")).toBe(true);
    expect(PAS_DU_PALIER.P1).toEqual([]);
    expect(PAS_DU_PALIER.P2).toEqual([]); // la finition du palier 2 : lot 45
    expect(PAS_DU_PALIER.P3).toEqual(["vie", "ciel", "ombres"]);
    expect(GROUPE_VIE_CIEL).toEqual(["vie", "ciel"]); // ce que la règle automatique (lot 45) ajoutera au palier 2 des téléphones récents
    expect(PAS_DU_PALIER[PALIER_EXISTANT]).toEqual(["existant"]);
    for (const id of Object.keys(PAS_DU_JEU)) expect(["existant", "vie", "ciel", "ombres"]).toContain(id);
    // `main.ts` les enregistre, **un `import()` chacun** : aucun pas sans `import()` (le module n'est chargé que si un palier ou l'adresse le demande).
    const main = readFileSync(join(import.meta.dirname, "../src/main.ts"), "utf8");
    expect(main).toContain('PAS_DU_JEU.existant = () => import("./scene/existant")');
    const modules = { vie: "vieJeu", ciel: "cielJeu", ombres: "ombres3" } as const;
    for (const id of new Set([...PAS_DU_PALIER.P3, ...GROUPE_VIE_CIEL])) expect(main).toContain(`PAS_DU_JEU.${id} = () => import("./scene/${modules[id as keyof typeof modules]}")`);
  });

  it("le premier chargement (main.ts, de proche en proche) ne tire ni l'ancienne scène, ni la vitrine, ni un module des pas, ni le décor (lot 44)", () => {
    // Lot 39 puis 43 : le graphe des imports statiques du jeu, à la source (la mesure du premier chargement, `mesureTrack`, le verrait à la fin). Les `import()`
    // (à la demande) ne sont pas suivis ; les imports de types non plus.
    const SRC = join(import.meta.dirname, "../src");
    const interdits = /\/scene\/(finition|drapeaux|matiere|matiereDetaillee|bruit|reflets|lumiere3|themes3|vie|vieJeu|cielJeu|ombres3|post|composerPalier|existant|memoire|paliers)\.ts$|\/scene\/decor\/|\/vitrine\//;
    const vus = new Set<string>();
    const file = [join(SRC, "main.ts")];
    while (file.length) {
      const f = file.pop()!;
      if (vus.has(f)) continue;
      vus.add(f);
      for (const m of readFileSync(f, "utf8").matchAll(/^import\s+(?!type\b)[^;]*?from\s+"(\.{1,2}\/[^"]+)";/gms)) {
        const cible = join(dirname(f), `${m[1]}.ts`);
        if (existsSync(cible)) file.push(cible);
      }
    }
    const tires = [...vus].filter((f) => interdits.test(f)).map((f) => relative(SRC, f));
    expect(tires).toEqual([]);
    expect([...vus].map((f) => relative(SRC, f))).toContain("scene/composerP1.ts");
    // Le registre du décor, lui, est là (quelques lignes) : chaque thème est un `import()` (`scene/decor.ts`).
    expect([...vus].map((f) => relative(SRC, f))).toContain("scene/decor.ts");
  });
});

describe("le composeur par palier", () => {
  it("un palier pas encore branché est une erreur ; une fois branché par son module, il compose", () => {
    // Lot 46 : les paliers 1, 2 et 3 sont branchés (le palier 1 et leurs pas) ; l'existant se branche en chargeant son module.
    expect(palierBranche(PALIER_EXISTANT)).toBe(false);
    expect(() => composer(piste, "stade", PALIER_EXISTANT)).toThrow("pas branché");
    brancherComposeur(PALIER_EXISTANT, () => fausseScene("existant"));
    try {
      expect(palierBranche(PALIER_EXISTANT)).toBe(true);
      expect(composer(piste, "stade", PALIER_EXISTANT)).toEqual({ nom: "existant" });
    } finally {
      brancherComposeur(PALIER_EXISTANT, undefined);
    }
  });

  it("lot 46 : un palier reçoit ses pas et ceux demandés en plus, moins ceux coupés ; un pas pas branché est une erreur", () => {
    const vus: (readonly string[] | undefined)[] = [];
    brancherComposeur("P3", (_t, _p, o: TrackSceneOptions) => (vus.push(o.pas?.map((x) => x.id)), fausseScene("P3")));
    brancherComposeur("P2", (_t, _p, o: TrackSceneOptions) => (vus.push(o.pas?.map((x) => x.id)), fausseScene("P2")));
    try {
      expect(() => composer(piste, "stade", "P3")).toThrow("pas branché"); // ses modules ne sont pas chargés
      for (const id of ["vie", "ciel", "ombres"]) brancherPas(id, { id });
      composer(piste, "stade", "P3");
      composer(piste, "stade", "P3", { coupes: ["ombres"] });
      composer(piste, "stade", "P2", {}, GROUPE_VIE_CIEL);
      composer(piste, "stade", "P2");
      expect(vus).toEqual([["vie", "ciel", "ombres"], ["vie", "ciel"], ["vie", "ciel"], undefined]);
      expect(pasVoulus("P2", ["vie", "ciel"], ["ciel"])).toEqual(["vie"]);
    } finally {
      for (const id of ["vie", "ciel", "ombres"]) brancherPas(id, undefined);
      brancherComposeur("P3", composerP1);
      brancherComposeur("P2", composerP1);
    }
  });
});

describe("le reconstructeur : jamais pendant une course", () => {
  function montage() {
    let hors = false; // « accueil, pause, arrivée, podium »
    const etat = { imports: 0, construit: [] as string[], adopte: [] as string[] };
    const registre: Registre = { factice: async () => (etat.imports++, {}) };
    const r = creerReconstructeur({
      palier: PALIER_EXISTANT,
      peutReconstruire: () => hors,
      construire: (p) => (etat.construit.push(p), fausseScene(p)),
      adopter: (_s, p) => etat.adopte.push(p),
      pas: { existant: [], P1: ["factice"], P2: ["factice"], P3: ["factice"] },
      registre,
    });
    return { r, etat, hors: (v: boolean) => (hors = v) };
  }

  it("en course : le palier demandé charge ses pas mais la scène ne change pas", async () => {
    const { r, etat } = montage();
    r.demander("P1");
    await attendre();
    expect(etat.imports).toBe(1); // les pas se chargent, hors du chemin critique
    expect(r.enAttente()).toBe(true);
    expect(await r.essayer()).toBe(false);
    expect(etat.construit).toEqual([]);
    expect(r.palier()).toBe("existant");
  });

  it("à l'arrêt : la scène est reconstruite une fois, puis plus rien n'est en attente", async () => {
    const { r, etat, hors } = montage();
    r.demander("P1");
    hors(true);
    expect(await r.essayer()).toBe(true);
    expect(etat.construit).toEqual(["P1"]);
    expect(etat.adopte).toEqual(["P1"]);
    expect(r.palier()).toBe("P1");
    expect(r.enAttente()).toBe(false);
    expect(await r.essayer()).toBe(false);
    expect(etat.construit).toHaveLength(1);
  });

  it("une course qui commence pendant le chargement des pas : on attend le prochain arrêt", async () => {
    let hors = true;
    const construit: string[] = [];
    let ouvrir!: () => void;
    const r = creerReconstructeur({
      palier: PALIER_EXISTANT,
      peutReconstruire: () => hors,
      construire: (p) => (construit.push(p), fausseScene(p)),
      adopter: () => {},
      pas: { existant: [], P1: ["lent"], P2: [], P3: [] },
      registre: { lent: () => new Promise((fin) => (ouvrir = () => fin({}))) },
    });
    r.demander("P1");
    const essai = r.essayer();
    hors = false; // le joueur lance sa course pendant que les pas se chargent
    ouvrir();
    expect(await essai).toBe(false);
    expect(construit).toEqual([]);
    hors = true; // pause : cette fois la scène est reconstruite
    expect(await r.essayer()).toBe(true);
    expect(construit).toEqual(["P1"]);
  });

  it("lot 46 : un palier et des pas en plus (le groupe « vie et ciel ») : chargés ensemble, reconstruits ensemble hors course", async () => {
    const charges: string[] = [];
    const construits: [string, readonly string[]][] = [];
    const r = creerReconstructeur({
      palier: "P1",
      peutReconstruire: () => true,
      construire: (p, plus) => (construits.push([p, plus]), fausseScene(p)),
      adopter: () => {},
      pas: { existant: [], P1: [], P2: [], P3: ["vie", "ciel", "ombres"] },
      registre: { vie: async () => charges.push("vie"), ciel: async () => charges.push("ciel"), ombres: async () => charges.push("ombres") },
    });
    r.demander("P2", GROUPE_VIE_CIEL);
    expect(await r.essayer()).toBe(true);
    expect(charges).toEqual(["vie", "ciel"]);
    expect(construits).toEqual([["P2", GROUPE_VIE_CIEL]]);
    expect([r.palier(), r.plus()]).toEqual(["P2", GROUPE_VIE_CIEL]);
    r.demander("P2", ["vie", "ciel"]); // le même : rien à faire
    expect(r.enAttente()).toBe(false);
    r.demander("P3");
    expect(await r.essayer()).toBe(true);
    expect(charges).toEqual(["vie", "ciel", "ombres"]);
    expect([r.palier(), r.plus()]).toEqual(["P3", []]);
  });

  it("des pas qui ne se chargent pas : on garde la scène courante", async () => {
    const r = creerReconstructeur({
      palier: PALIER_EXISTANT,
      peutReconstruire: () => true,
      construire: () => fausseScene("jamais"),
      adopter: () => {
        throw new Error("ne doit pas arriver");
      },
      pas: { existant: [], P1: ["casse"], P2: [], P3: [] },
      registre: { casse: () => Promise.reject(new Error("réseau")) },
    });
    r.demander("P1");
    await attendre();
    expect(await r.essayer()).toBe(false);
    expect(r.palier()).toBe("existant");
    expect(r.enAttente()).toBe(false);
  });

  it("redemander le palier courant annule la demande", () => {
    const { r } = montage();
    r.demander("P2");
    expect(r.enAttente()).toBe(true);
    r.demander("existant");
    expect(r.enAttente()).toBe(false);
  });
});
