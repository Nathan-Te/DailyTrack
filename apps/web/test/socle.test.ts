import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTrack } from "@cdj/sim";
import type { TrackScene } from "../src/trackMesh";
import { PALIER_EXISTANT, PAS_DU_JEU, PAS_DU_PALIER, brancherComposeur, chargerPas, composer, creerReconstructeur, palierBranche, type Registre } from "../src/scene/socle";

// Lot 39 : le socle par paliers. Ce qui se prouve sans carte graphique : le registre des pas (un `import()` chacun, une fois), le composeur par palier, et le
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

  it("le jeu ne charge aucun pas aujourd'hui : registre et paliers vides", () => {
    expect(Object.keys(PAS_DU_JEU)).toEqual([]);
    expect(PAS_DU_PALIER[PALIER_EXISTANT]).toEqual([]);
  });

  it("le socle et le jeu n'importent jamais un module des pas de façon statique (ils restent hors du premier chargement)", () => {
    const pas = /from "\.\.?\/(scene\/)?(finition|matiere|matiereDetaillee|reflets|lumiere3|vie|post|palier1|paliers|composerPalier|composer|directionA|directionB|directionC|directionM)"/;
    for (const f of ["src/scene/socle.ts", "src/main.ts", "src/thumbnail.ts"]) expect(readFileSync(join(import.meta.dirname, "..", f), "utf8"), f).not.toMatch(pas);
  });
});

describe("le composeur par palier", () => {
  it("un palier pas encore branché est une erreur ; une fois branché par son module, il compose", () => {
    expect(palierBranche("P1")).toBe(false);
    expect(() => composer(piste, "stade", "P1")).toThrow("pas branché");
    brancherComposeur("P1", () => fausseScene("P1"));
    try {
      expect(palierBranche("P1")).toBe(true);
      expect(composer(piste, "stade", "P1")).toEqual({ nom: "P1" });
    } finally {
      brancherComposeur("P1", undefined);
    }
  });
});

describe("le reconstructeur : jamais pendant une course", () => {
  function montage() {
    let hors = false; // « accueil, pause, arrivée, podium »
    const etat = { imports: 0, construit: [] as string[], adopte: [] as string[] };
    const registre: Registre = { factice: async () => (etat.imports++, {}) };
    const r = creerReconstructeur({
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

  it("des pas qui ne se chargent pas : on garde la scène courante", async () => {
    const r = creerReconstructeur({
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
