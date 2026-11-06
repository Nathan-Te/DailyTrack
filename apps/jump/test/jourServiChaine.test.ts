import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import {
  BASCULE_MAX_JOURS,
  ajouterJours,
  calendrierDesBascules,
  comparerAuServi,
  dernierJourAFiger,
  generateurDuDepot,
  installerOutilDeFigeage,
  joursSansFichier,
  lireNiveauxServis,
  verifierBascules,
} from "../../../scripts/mise-en-production.mjs";

// Lot 33 (incident du 06/11/2026) : les pièces de « Mettre en production » qui garantissent qu'un jour déjà servi de Jump ne change jamais (`scripts/mise-en-production.mjs`).
// Ce fichier est dans la zone de Jump : le lot est une PR de jeu (les fichiers de la chaîne sont l'exception accordée par Nathan).


describe("lot 33 — figer tous les jours manquants, refuser s'il en reste un", () => {
  it("joursSansFichier : un jour servi sans fichier est trouvé, de la première date à la dernière", () => {
    expect(joursSansFichier({ du: "2026-11-01", au: "2026-11-07", fichiers: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"] })).toEqual([]);
    expect(joursSansFichier({ du: "2026-11-01", au: "2026-11-07", fichiers: ["2026-11-01", "2026-11-02", "2026-11-04", "2026-11-07"] })).toEqual(["2026-11-03", "2026-11-05", "2026-11-06"]);
  });

  it("dernierJourAFiger : demain au moins, la veille de la bascule si elle est plus loin, la veille de la plus lointaine bascule du générateur", () => {
    expect(dernierJourAFiger({ veille: "2026-11-06", demain: "2026-11-07" })).toBe("2026-11-07");
    expect(dernierJourAFiger({ veille: "2026-11-07", demain: "2026-11-07" })).toBe("2026-11-07");
    // clic après 22 h : bascule au surlendemain, la veille (demain) est figée aussi
    expect(dernierJourAFiger({ veille: "2026-11-08", demain: "2026-11-07" })).toBe("2026-11-08");
    expect(dernierJourAFiger({ veille: "2026-11-06", demain: "2026-11-07", nouvelles: [{ generateur: 27, depuis: "2026-11-10" }] })).toBe("2026-11-09");
  });

  it("comparerAuServi : un fichier qui n'est pas le niveau que le serveur sert est dit, jour par jour", () => {
    const attendus = { "2026-11-03": { id: "jour-2026-11-03-g26", hash: "be47f97c" }, "2026-11-04": { id: "jour-2026-11-04-g26", hash: "3c564234" } };
    expect(comparerAuServi(attendus, { ...attendus })).toEqual([]);
    const diffs = comparerAuServi(attendus, { "2026-11-03": { id: "jour-2026-11-03-g26", hash: "a1ecd408" } });
    expect(diffs).toHaveLength(2);
    expect(diffs[0]).toContain("be47f97c");
    expect(diffs[0]).toContain("a1ecd408");
    expect(diffs[1]).toContain("ne sert aucun niveau");
  });

  it("lireNiveauxServis : GET en lecture seule, identifiant et empreinte ; un serveur qui répond mal arrête", async () => {
    const appels: string[] = [];
    const fetchImpl = async (url: string, init: { method: string }) => {
      appels.push(`${init.method} ${url}`);
      return { status: 200, headers: new Headers(), json: async () => ({ id: "jour-2026-11-03-g26", hash: "be47f97c" }) };
    };
    const servis = await lireNiveauxServis("https://playdujour.com/", ["2026-11-03"], { fetchImpl: fetchImpl as never });
    expect(servis).toEqual({ "2026-11-03": { id: "jour-2026-11-03-g26", hash: "be47f97c" } });
    expect(appels).toEqual(["GET https://playdujour.com/api/jump/day/2026-11-03"]);
    const mauvais = async () => ({ status: 200, headers: new Headers(), json: async () => ({ erreur: 1 }) });
    await expect(lireNiveauxServis("https://x", ["2026-11-03"], { fetchImpl: mauvais as never })).rejects.toThrow(/réponse inattendue/);
    const ko = async () => ({ status: 403, headers: new Headers(), json: async () => ({}) });
    await expect(lireNiveauxServis("https://x", ["2026-11-03"], { fetchImpl: ko as never })).rejects.toThrow(/403/);
  });
});

describe("lot 33 — une bascule du générateur fixée à aujourd'hui ou avant est refusée", () => {
  const prod = { bascules: [{ depuis: "2026-10-16", generateur: 26 }] };
  const avecG27 = (depuis: string) => ({ bascules: [...prod.bascules, { depuis, generateur: 27 }] });

  it("sans nouveau générateur : rien à dire (le premier déploiement du lot, où la production n'a pas de calendrier, aussi)", () => {
    expect(verifierBascules({ avant: prod, apres: prod, generateurAvant: 26, generateurApres: 26, bascule: "2026-11-07" })).toEqual({ nouvelles: [], problemes: [] });
    expect(verifierBascules({ avant: null, apres: prod, generateurAvant: 26, generateurApres: 26, bascule: "2026-11-07" })).toEqual({ nouvelles: [], problemes: [] });
  });

  it("g27 à partir du jour de bascule ou après : accepté", () => {
    for (const depuis of ["2026-11-07", "2026-11-08", "2026-11-14"]) {
      const r = verifierBascules({ avant: prod, apres: avecG27(depuis), generateurAvant: 26, generateurApres: 27, bascule: "2026-11-07" });
      expect(r.problemes, depuis).toEqual([]);
      expect(r.nouvelles).toEqual([{ depuis, generateur: 27 }]);
    }
  });

  it("g27 fixé à aujourd'hui ou avant (avant le jour de bascule = demain au plus tôt) : refusé, avec le jour à choisir", () => {
    for (const depuis of ["2026-11-06", "2026-11-05", "2026-10-01"]) {
      const r = verifierBascules({ avant: prod, apres: avecG27(depuis), generateurAvant: 26, generateurApres: 27, bascule: "2026-11-07" });
      expect(r.problemes, depuis).toHaveLength(1);
      expect(r.problemes[0]).toContain("DEMAIN au plus tôt");
      expect(r.problemes[0]).toContain("2026-11-07");
    }
  });

  it("g27 trop lointain, générateur qui change sans entrée au calendrier, ou code sans calendrier : refusés", () => {
    const loin = ajouterJours("2026-11-07", BASCULE_MAX_JOURS + 1);
    expect(verifierBascules({ avant: prod, apres: avecG27(loin), generateurAvant: 26, generateurApres: 27, bascule: "2026-11-07" }).problemes[0]).toContain("plus de");
    expect(verifierBascules({ avant: prod, apres: prod, generateurAvant: 26, generateurApres: 27, bascule: "2026-11-07" }).problemes.length).toBeGreaterThan(0);
    expect(verifierBascules({ avant: prod, apres: null, generateurAvant: 26, generateurApres: 27, bascule: "2026-11-07" }).problemes[0]).toContain("pas de calendrier");
  });

  it("lit le calendrier et le générateur d'un dépôt d'après la fiche (bascules.json à côté du fichier de versions)", () => {
    const racine = join(import.meta.dirname, "../../..");
    const jump = { versions: { generateur: "packages/jump-sim/src/constants.ts:JUMP_GENERATOR_VERSION" } };
    const cal = calendrierDesBascules(jump, racine);
    expect(cal.bascules.at(-1).generateur).toBe(generateurDuDepot(jump, racine));
  });
});

describe("lot 33 — l'outil de figeage est celui d'aujourd'hui, installé dans le code en production", () => {
  it("copie le fichier d'entrée du script npm de la fiche (freeze-days.ts) du dépôt des outils dans le dépôt visé, qui peut être plus ancien", () => {
    const dossier = mkdtempSync(join(tmpdir(), "outil-figeage-"));
    try {
      const prod = join(dossier, "prod");
      mkdirSync(join(prod, "apps/jump/tools"), { recursive: true });
      writeFileSync(join(prod, "apps/jump/package.json"), JSON.stringify({ name: "@cdj/jump" }));
      writeFileSync(join(prod, "apps/jump/tools/freeze-days.ts"), "// ancien outil, sans la déclaration\n");
      const installe = installerOutilDeFigeage({ figer: { paquet: "@cdj/jump", script: "freeze:days" } }, prod);
      expect(installe).toBe(join("apps/jump", "tools/freeze-days.ts"));
      const texte = readFileSync(join(prod, "apps/jump/tools/freeze-days.ts"), "utf8");
      expect(texte).toContain("declareFrozenGenerators");
      expect(texte).not.toContain("ancien outil");
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
