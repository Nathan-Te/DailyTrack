import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categoriesOf } from "../../../scripts/ci-scope.mjs";
import { EXCEPTIONS, JEUX, ZONES, horsZones, jeuDeLaPr, verifierZones } from "../../../scripts/zones-jeu.mjs";

// Retouche du lot I6 — « Lots en parallèle » (docs/orchestration.md) : une PR de jeu ne sort pas de ses zones.
const racine = new URL("../../../", import.meta.url);

describe("le jeu d'une PR", () => {
  it("par l'étiquette, qui l'emporte sur la branche", () => {
    expect(jeuDeLaPr({ etiquettes: ["jeu:jump"], branche: "claude/lot-9-track" }).jeu).toBe("jump");
    expect(jeuDeLaPr({ etiquettes: ["documentation", "jeu:track"] }).jeu).toBe("track");
  });

  it("deux étiquettes de jeu : refus", () => {
    expect(jeuDeLaPr({ etiquettes: ["jeu:track", "jeu:jump"] }).erreur).toBeTruthy();
    expect(verifierZones({ etiquettes: ["jeu:track", "jeu:jump"], fichiers: ["apps/web/src/main.ts"] }).ok).toBe(false);
  });

  it("par un morceau du nom de branche (coupé sur / - _)", () => {
    expect(jeuDeLaPr({ branche: "claude/lot-14-jump-vent" }).jeu).toBe("jump");
    expect(jeuDeLaPr({ branche: "claude/track_lot-32" }).jeu).toBe("track");
    expect(jeuDeLaPr({ branche: "Claude/Lot-14-JUMP" }).jeu).toBe("jump");
  });

  it("un faux ami dans le nom de branche n'est pas un jeu : plateforme", () => {
    for (const branche of ["claude/jolly-dirac-n7c6cs", "claude/jumper-x", "claude/racetrack", "claude/dailytrack-lot", ""]) expect(jeuDeLaPr({ branche }).jeu, branche).toBeNull();
  });

  it("les deux jeux dans le nom de branche : plateforme, sans garde", () => {
    const v = verifierZones({ branche: "claude/lot-I9-track-jump", fichiers: ["packages/ui/src/socle.css"] });
    expect(v).toMatchObject({ ok: true, jeu: null });
  });
});

describe("les zones", () => {
  it("une PR Track dans ses zones passe", () => {
    const fichiers = ["apps/web/src/main.ts", "apps/web/e2e/durees.json", "packages/sim/src/car.ts", "apps/api/src/cdj.ts", "apps/api/src/salon.ts", "apps/api/test/salon.test.ts", "docs/lots/lot-32-x.md", "docs/orchestration.md"];
    expect(verifierZones({ etiquettes: ["jeu:track"], fichiers }).ok).toBe(true);
  });

  it("une PR Jump dans ses zones passe", () => {
    const fichiers = ["apps/jump/src/main.ts", "apps/jump/e2e/durees.json", "packages/jump-sim/src/level.ts", "apps/api/src/jump.ts", "apps/api/src/jumpLives.ts", "apps/api/test/jumpBoard.test.ts", "apps/api/scripts/jump-seed.ts", "docs/jump/synthese.md"];
    expect(verifierZones({ etiquettes: ["jeu:jump"], fichiers }).ok).toBe(true);
  });

  it("les exceptions tolérées, et rien d'autre", () => {
    for (const jeu of JEUX) expect(horsZones(jeu, EXCEPTIONS), jeu).toEqual([]);
    expect(EXCEPTIONS.sort()).toEqual(["docs/plateforme/budgets.md", "docs/plateforme/traductions.md", "packages/ui/test/applications.ts"]);
  });

  it("une zone partagée fait échouer une PR de jeu, avec la liste des fichiers", () => {
    const partages = [
      "packages/ui/src/socle.css", "packages/ui/src/catalogue.ts", "packages/profile/src/index.ts", "packages/core/src/index.ts", "packages/clock/src/index.ts",
      "apps/portail/src/portail.ts", "apps/api/src/games.ts", "apps/api/src/api.ts", "apps/api/src/portail.ts", "apps/api/src/codesErreur.ts", "apps/api/src/history.ts",
      "apps/api/test/api.test.ts", "scripts/ci-scope.mjs", ".github/workflows/ci.yml", "firebase.json", "docs/plateforme/identite.md", "docs/seed.md",
      "docs/jump/../seed.md", "docs/plateforme/lots/lot-I6-finitions.md", "CLAUDE.md", "package.json", "package-lock.json",
    ];
    for (const jeu of JEUX) {
      const v = verifierZones({ etiquettes: [`jeu:${jeu}`], fichiers: ["", ...partages] });
      expect(v.ok, jeu).toBe(false);
      expect(v.hors.length, jeu).toBe(partages.length);
      expect(v.texte).toContain("lot de la plateforme");
    }
  });

  it("un jeu ne touche pas les zones de l'autre", () => {
    expect(horsZones("track", ["apps/jump/src/main.ts", "apps/api/src/jump.ts", "docs/jump/synthese.md"])).toHaveLength(3);
    expect(horsZones("jump", ["apps/web/src/main.ts", "apps/api/src/cdj.ts", "docs/lots/lot-1.md", "docs/orchestration.md"])).toHaveLength(4);
  });

  it("normalise ./ et les séparateurs Windows", () => {
    expect(horsZones("jump", ["./apps/jump/src/a.ts", "apps\\jump\\src\\b.ts"])).toEqual([]);
  });

  it("une PR de la plateforme n'a pas de garde", () => {
    expect(verifierZones({ branche: "claude/jolly-dirac-n7c6cs", fichiers: ["packages/ui/src/socle.css", "apps/web/src/main.ts"] }).ok).toBe(true);
  });
});

describe("cohérence avec la portée de la CI (scripts/ci-scope.mjs)", () => {
  it("chaque fichier nommé d'une zone existe (une liste fermée ne garde pas de fantôme)", () => {
    for (const jeu of JEUX)
      for (const g of ZONES[jeu].filter((g) => !g.includes("*"))) expect(existsSync(new URL(g, racine)), g).toBe(true);
  });

  it("dans apps/api, une zone de jeu n'est jamais une zone « les trois » de la CI : seulement ce jeu et la plateforme", () => {
    for (const jeu of JEUX)
      for (const g of ZONES[jeu].filter((g) => g.startsWith("apps/api/"))) {
        const exemple = g.replace("*", "Exemple");
        expect(categoriesOf(exemple).sort(), g).toEqual([jeu, "plateforme"].sort());
      }
  });

  it("hors apps/api, une zone de jeu ne lance que les e2e de ce jeu", () => {
    for (const jeu of JEUX)
      for (const g of ZONES[jeu].filter((g) => !g.startsWith("apps/api/"))) expect(categoriesOf(g.replace("**", "a/b.ts")), g).toEqual([jeu]);
  });
});
