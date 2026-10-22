import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { graphePremierChargement, mesureTrack } from "../../../scripts/budgets.mjs";

// Lot de plateforme « suites de Track » : **une seule mesure** du premier chargement de Track (`mesureTrack`, scripts/budgets.mjs, importée par apps/web/e2e/perf.spec.ts).
// Elle suit ce que `index.html` demande (entrée, `modulepreload`, feuilles, imports statiques de proche en proche) : un morceau chargé par `import()` n'y compte jamais, la page
// d'admin non plus (ligne à part). Ces tests tournent sur un petit `dist` factice : aucune construction.

let racine: string;
let assets: string;
const gz = (texte: string) => gzipSync(Buffer.from(texte)).length;
/** Un texte de ≈ `n` octets peu compressible (reproductible). */
const bruit = (n: number, graine: number) => Array.from({ length: n }, (_, i) => ((i * 2654435761 + graine * 40503) >>> 0).toString(36)).join("").slice(0, n);
const ecrire = (nom: string, texte: string) => writeFileSync(join(assets, nom), texte);

const FICHIERS = {
  entree: `import{a}from"./vendor-AAA.js";import"./lateral-BBB.js";const lazy=()=>import("./gros-CCC.js");export{a,lazy};//${bruit(900, 1)}`,
  vendor: `export const a=1;//${bruit(700, 2)}`,
  lateral: `export const b=2;//${bruit(500, 3)}`,
  gros: `export const gros=3;//${bruit(2000, 4)}`, // à la demande : son nom ne ressemble à aucun préfixe connu
  admin: `export const admin=4;//${bruit(800, 5)}`,
  fil: `self.onmessage=()=>0;//${bruit(1200, 6)}`,
  anglais: `export default{};//${bruit(300, 7)}`,
  three: `export const THREE=1;//${bruit(1500, 8)}`,
  extra: `export const extra=5;//${bruit(600, 9)}`,
};

beforeEach(() => {
  racine = mkdtempSync(join(tmpdir(), "mesure-track-"));
  assets = join(racine, "assets");
  mkdirSync(assets);
  writeFileSync(
    join(racine, "index.html"),
    `<!doctype html><script type="module" crossorigin src="./assets/main-ENT.js"></script><link rel="modulepreload" crossorigin href="./assets/three-DDD.js"><link rel="stylesheet" crossorigin href="./assets/main-STY.css">`,
  );
  ecrire("main-ENT.js", FICHIERS.entree);
  ecrire("vendor-AAA.js", FICHIERS.vendor);
  ecrire("lateral-BBB.js", FICHIERS.lateral);
  ecrire("gros-CCC.js", FICHIERS.gros);
  ecrire("three-DDD.js", FICHIERS.three);
  ecrire("admin-EEE.js", FICHIERS.admin);
  ecrire("circuitWorker-FFF.js", FICHIERS.fil);
  ecrire("salonWorker-GGG.js", FICHIERS.fil);
  ecrire("catalogue.en-HHH.js", FICHIERS.anglais);
  ecrire("main-STY.css", "body{margin:0}");
});
afterEach(() => rmSync(racine, { recursive: true, force: true }));

describe("mesureTrack : le graphe statique de index.html", () => {
  it("compte l'entrée, les modulepreload et leurs imports statiques ; ni un morceau chargé par import(), ni la page d'admin, ni les fils de travail", () => {
    const m = mesureTrack(assets);
    expect([...m.fichiers].sort()).toEqual(["lateral-BBB.js", "main-ENT.js", "main-STY.css", "three-DDD.js", "vendor-AAA.js"]);
    expect(m.js).toBe(gz(FICHIERS.entree) + gz(FICHIERS.vendor) + gz(FICHIERS.lateral) + gz(FICHIERS.three));
    expect(m.css).toBe(gz("body{margin:0}"));
    expect(m.jsCss).toBe(m.js + m.css);
    expect(m.three).toBe(gz(FICHIERS.three));
    expect(m.horsThree).toBe(m.js - m.three);
    // À la demande ou à part : mesurés, mais hors du premier chargement.
    expect(m.fichiers).not.toContain("gros-CCC.js");
    expect(m.fichiers.some((f: string) => f.startsWith("admin-"))).toBe(false);
    expect(m.admin).toBe(gz(FICHIERS.admin));
    expect(m.miniatures).toBe(gz(FICHIERS.fil));
    expect(m.salon).toBe(gz(FICHIERS.fil));
    expect(m.anglais).toBe(gz(FICHIERS.anglais));
  });

  it("un import statique ajouté au point d'entrée est compté (et un import() ajouté ne l'est pas)", () => {
    const avant = mesureTrack(assets).js;
    ecrire("extra-III.js", FICHIERS.extra);
    ecrire("main-ENT.js", FICHIERS.entree + `;import"./extra-III.js"`);
    const apres = mesureTrack(assets);
    expect(apres.fichiers).toContain("extra-III.js");
    expect(apres.js).toBe(gz(FICHIERS.entree + `;import"./extra-III.js"`) + gz(FICHIERS.extra) + gz(FICHIERS.vendor) + gz(FICHIERS.lateral) + gz(FICHIERS.three));
    expect(apres.js).toBeGreaterThan(avant);
    // Le même fichier, chargé par import() : il ne compte pas.
    ecrire("main-ENT.js", FICHIERS.entree + `;import("./extra-III.js")`);
    const dynamique = mesureTrack(assets);
    expect(dynamique.fichiers).not.toContain("extra-III.js");
    expect(dynamique.js).toBe(gz(FICHIERS.entree + `;import("./extra-III.js")`) + gz(FICHIERS.vendor) + gz(FICHIERS.lateral) + gz(FICHIERS.three));
  });

  it("un import statique de proche en proche, un cycle et un fichier absent de index.html : suivis sans boucle", () => {
    ecrire("vendor-AAA.js", `import"./lateral-BBB.js";import"./main-ENT.js";${FICHIERS.vendor}`); // cycle vers l'entrée
    ecrire("lateral-BBB.js", `import"./profond-JJJ.js";${FICHIERS.lateral}`);
    ecrire("profond-JJJ.js", "export const p=1;");
    expect(graphePremierChargement(assets)).toContain("profond-JJJ.js");
    expect(graphePremierChargement(assets).filter((f: string) => f === "main-ENT.js")).toHaveLength(1);
  });
});
