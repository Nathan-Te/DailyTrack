import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BUDGET_E2E_S,
  CIBLE_PART_UNITAIRE_S,
  PARTS_E2E_MAX,
  PARTS_UNITAIRES_MAX,
  chargerTable,
  decider,
  docsLusParLesTests,
  dureeE2e,
  dureesUnitaires,
  graphe,
  lister,
  partsE2e,
  partsUnitaires,
  sorties,
  specsDesZones,
  specsDuJeu,
  specsPour,
  testsPour,
  zonesDuFichier,
  type Graphe,
  type Table,
} from "../../../scripts/ci-zones.mjs";

// Lot R10 (plateforme) : la CI de PR courte. La table spec → zones (`e2e/zones.json`) est tenue à jour par ce test : un spec sans zone, une zone sans spec
// ni fichier, un nom inconnu le font échouer. Les sélections (e2e et unitaires) sont vérifiées sur les vrais fichiers du dépôt.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
let table: Table;
let g: Graphe;
beforeAll(() => {
  table = chargerTable(ROOT);
  g = graphe(ROOT);
});
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("la table spec → zones (e2e/zones.json)", () => {
  it("chaque spec de chaque jeu a au moins une zone, et la table ne nomme aucun spec disparu (hors outils : captures et mesures se sautent d'eux-mêmes)", () => {
    for (const jeu of ["web", "jump", "tower"] as const) {
      const specs = specsDuJeu(jeu, ROOT);
      expect(specs.length, jeu).toBeGreaterThan(jeu === "tower" ? 1 : 10); // lot R15 : Tower (3ᵉ jeu) a peu de specs
      const sansZone = specs.filter((s) => (table.specs[`${jeu}/${s}`]?.length ?? 0) === 0);
      expect(sansZone, `spec(s) de ${jeu} sans zone : les déclarer dans e2e/zones.json`).toEqual([]);
      const disparus = Object.keys(table.specs).filter((k) => k.startsWith(`${jeu}/`) && !specs.includes(k.slice(jeu.length + 1)));
      expect(disparus, "entrées de la table pour des specs qui n'existent plus").toEqual([]);
    }
  });

  it("chaque zone citée par un spec existe ; chaque zone sert au moins un spec ; chaque motif de chaque zone désigne au moins un fichier du dépôt", () => {
    const connues = Object.keys(table.zones);
    for (const [spec, zs] of Object.entries(table.specs)) for (const z of zs) expect(connues, `${spec} cite la zone ${z}`).toContain(z);
    const utilisees = new Set(Object.values(table.specs).flat());
    expect(connues.filter((z) => !utilisees.has(z)), "zones qu'aucun spec ne cite").toEqual([]);
    const fichiers = ["apps", "packages", "scripts"].flatMap((d) => lister(ROOT, d));
    fichiers.push("firebase.json", "config/lancement.json"); // lot R8 : la date du lancement (zone core-clock)
    for (const z of connues) {
      for (const [i, re] of table.compilees[z]!.globs.entries()) {
        expect(fichiers.some((f) => re.test(f)), `zone ${z} : le motif « ${table.zones[z]!.globs[i]} » ne désigne aucun fichier`).toBe(true);
      }
    }
  });

  it("la fumée de chaque jeu existe, est courte (ses tests « Essentiel » : la PR ne lance pas les autres), et est liée à une zone du jeu", () => {
    const durees = (jeu: string) => JSON.parse(read(`apps/${jeu}/e2e/durees.json`)).essentiel as Record<string, number>;
    for (const jeu of ["web", "jump", "tower"] as const) {
      const specs = specsDuJeu(jeu, ROOT);
      const total = table.fumee[jeu].reduce((s, f) => s + (durees(jeu)[f] ?? 60), 0);
      for (const f of table.fumee[jeu]) expect(specs, `fumée ${jeu}`).toContain(f);
      expect(total, `fumée ${jeu} : ${total} s`).toBeLessThanOrEqual(120);
    }
  });

  it("lot R13 : la famille « Régression » nomme de vrais specs, jamais la fumée ; chaque spec a sa durée « Essentiel », sauf ceux de la liste", () => {
    for (const jeu of ["web", "jump", "tower"] as const) {
      const specs = specsDuJeu(jeu, ROOT);
      const regression = (table.regression ?? []).filter((x) => x.startsWith(`${jeu}/`)).map((x) => x.slice(jeu.length + 1));
      expect(regression.filter((s) => !specs.includes(s)), "specs « Régression » disparus").toEqual([]);
      for (const f of table.fumee[jeu]) expect(regression, `fumée ${jeu}`).not.toContain(f);
      const essentiel = JSON.parse(read(`apps/${jeu}/e2e/durees.json`)).essentiel as Record<string, number>;
      expect(specs.filter((s) => !regression.includes(s) && !(s in essentiel)), `${jeu} : durée « essentiel » manquante (apps/${jeu}/e2e/durees.json)`).toEqual([]);
      expect(Object.keys(essentiel).filter((s) => regression.includes(s) || !specs.includes(s)), `${jeu} : durée « essentiel » en trop`).toEqual([]);
    }
    for (const f of table.regressionUnitaires ?? []) expect(g.tests, f).toContain(f);
  });

  it("un fichier de code est dans les zones de son jeu : les motifs ne se trompent pas de jeu", () => {
    expect(zonesDuFichier("apps/web/src/salonMode.ts", table)).toEqual(["track-salon"]);
    expect(zonesDuFichier("apps/web/src/garage.css", table)).toEqual(["track-voiture"]);
    expect(zonesDuFichier("apps/jump/src/hud.ts", table)).toEqual(["jump-ui"]);
    expect(zonesDuFichier("apps/tower/src/hud.ts", table)).toEqual(["tower-jeu"]); // lot R15
    expect(zonesDuFichier("apps/tower/src/banc/demo.ts", table)).toEqual(["tower-banc"]);
    expect(zonesDuFichier("apps/tower/src/moteurs.ts", table)).toEqual(["tower-banc"]);
    expect(zonesDuFichier("packages/tower-sim/src/partie.ts", table)).toEqual(["tower-sim"]);
    expect(zonesDuFichier("packages/jump-sim/modules/x.json", table)).toEqual(["jump-modules"]);
    expect(zonesDuFichier("apps/api/src/cdj.ts", table)).toEqual(["api-track"]);
    expect(zonesDuFichier("apps/api/src/identity.ts", table)).toEqual(["api-coeur"]);
    expect(zonesDuFichier("docs/plateforme/synthese.md", table)).toEqual([]);
  });
});

describe("les specs e2e d'une PR", () => {
  // Sans budget : la sélection par zones seule (le budget a ses propres tests plus bas).
  const choix = (files: string[]) => specsPour(files, table, ROOT, { budget: Infinity });

  it("lot R15 : une PR de Tower ne lance que les specs de Tower (jamais ceux de Track ni de Jump), et elles seules", () => {
    const r = choix(["apps/tower/src/hud.ts", "packages/tower-sim/src/partie.ts"]);
    expect(r.web).toEqual([]);
    expect(r.jump).toEqual([]);
    expect(r.tower).toEqual(["classement.spec.ts", "determinisme.spec.ts", "partie.spec.ts", "poids.spec.ts"]); // lot T4 : le classement (le vrai serveur) est un parcours de joueur du jeu
    // Ni une PR de Track, ni une PR de Jump, ni un document de Tower ne lancent Tower.
    expect(choix(["apps/web/src/salonMode.ts", "packages/sim/src/car.ts"]).tower).toEqual([]);
    expect(choix(["apps/jump/src/hud.ts", "packages/jump-sim/src/level.ts"]).tower).toEqual([]);
    expect(choix(["docs/tower/consignes.md", "docs/tower/lots/lot-T1-partie.md"])).toMatchObject({ web: [], jump: [], tower: [] });
    // Un fichier de Tower qu'aucune zone ne nomme ne lance que la fumée de Tower ; un spec modifié se lance lui-même.
    expect(choix(["apps/tower/tools/poids.mjs"])).toMatchObject({ web: [], jump: [], tower: [...table.fumee.tower].sort() });
    expect(choix(["apps/tower/e2e/partie.spec.ts"]).tower).toEqual(["partie.spec.ts"]);
    expect(choix(["apps/tower/playwright.config.ts"])).toMatchObject({ web: [], jump: [], tower: [...table.fumee.tower].sort() });
  });

  it("lot R15 : une zone partagée (ui, profil, core, serveur, workflow) lance aussi la fumée de Tower", () => {
    for (const f of ["packages/ui/src/index.ts", "packages/profile/src/index.ts", "packages/core/src/index.ts", "apps/api/src/server.ts", ".github/workflows/ci.yml"]) {
      expect(choix([f]).tower, f).toEqual(expect.arrayContaining(table.fumee.tower));
    }
    expect(choix(["packages/ui/src/index.ts"]).tower).toContain("partie.spec.ts");
  });

  it("une PR de DailyJump ne lance aucun spec de DailyTrack, et réciproquement", () => {
    const j = choix(["apps/jump/src/hud.ts", "packages/jump-sim/src/level.ts"]);
    expect(j.web).toEqual([]);
    expect(j.jump).toEqual(expect.arrayContaining(["mobile.spec.ts", "dangers.spec.ts", "smoke.spec.ts"]));
    const t = choix(["apps/web/src/salonMode.ts", "packages/sim/src/car.ts"]);
    expect(t.jump).toEqual([]);
    expect(t.web).toEqual(expect.arrayContaining(["salon.spec.ts", "watch-serveur.spec.ts", "daily.spec.ts", "replay.spec.ts"]));
  });

  it("lot R13 : un spec tout entier « Régression » ne tourne pas en PR, sauf s'il est modifié ; il est nommé dans le résumé", () => {
    const r = choix(["apps/web/src/salonMode.ts"]);
    expect(r.web).not.toContain("salon-serveur.spec.ts");
    expect(r.regression).toContain("web/salon-serveur.spec.ts");
    expect(choix(["apps/web/e2e/salon-serveur.spec.ts"]).web).toContain("salon-serveur.spec.ts");
    const u = testsPour(["apps/api/src/portail.ts"], g, { regression: table.regressionUnitaires ?? [] });
    expect(u.fichiers).not.toContain("apps/api/test/portailDemo.test.ts");
    expect(testsPour(["apps/api/test/portailDemo.test.ts"], g, { regression: table.regressionUnitaires ?? [] }).fichiers).toContain("apps/api/test/portailDemo.test.ts");
  });

  it("un fichier ne lance que les specs de ses zones, plus la fumée de son jeu", () => {
    const r = choix(["apps/web/src/admin.ts"]);
    expect(r.web).toEqual([...new Set([...table.fumee.web, "admin-track.spec.ts", "futur.spec.ts", "planning.spec.ts"])].sort()); // admin et demo : « Régression » (lot R13)
    expect(r.web).not.toContain("thumbnails.spec.ts");
  });

  it("un fichier de jeu qu'aucune zone ne nomme ne lance que la fumée de son jeu", () => {
    expect(choix(["apps/web/src/nouveau-fichier.ts"])).toMatchObject({ web: [...table.fumee.web].sort(), jump: [], tower: [] });
    expect(choix(["apps/jump/src/nouveau-fichier.ts"])).toMatchObject({ web: [], jump: [...table.fumee.jump].sort(), tower: [] });
    expect(choix(["apps/tower/src/nouveau-fichier.ts"]).tower).toEqual(expect.arrayContaining([...table.fumee.tower])); // lot R15 (src/* est une zone : lot T4, elle lance aussi le classement)
  });

  it("une zone partagée lance la fumée des deux jeux, et les specs de sa zone", () => {
    const r = choix(["packages/ui/src/index.ts"]);
    expect(r.web).toEqual(expect.arrayContaining(["langue.spec.ts", "portail.spec.ts", ...table.fumee.web]));
    expect(r.jump).toEqual(expect.arrayContaining(["langue.spec.ts", ...table.fumee.jump]));
  });

  it("un spec modifié se lance lui-même ; un outil (captures, mesure) ne se lance jamais", () => {
    expect(choix(["apps/web/e2e/garage.spec.ts"]).web).toEqual(["garage.spec.ts"]);
    expect(choix(["apps/web/e2e/captures-lot49.spec.ts", "apps/jump/e2e/mesure-themes.spec.ts"])).toMatchObject({ web: [], jump: [] });
  });

  it("un utilitaire de test lance ses importeurs (la fumée s'il y en a trop) ; la configuration de Playwright lance la fumée", () => {
    const axe = choix(["apps/web/e2e/axe.ts"]).web;
    expect(axe).toEqual(expect.arrayContaining(["accessibilite.spec.ts"])); // un utilitaire modifié lance ses importeurs, « Régression » compris
    expect(axe.length).toBeLessThanOrEqual(12);
    expect(choix(["apps/web/e2e/fixtures.ts"])).toMatchObject({ web: [...table.fumee.web].sort() });
    expect(choix(["apps/jump/playwright.config.ts"])).toMatchObject({ web: [], jump: [...table.fumee.jump].sort() });
  });

  it("le budget : une PR large reste dans son budget de specs (fumée et specs modifiés en plus), les moins liés sont reportés et nommés", () => {
    // Lot R13 : depuis le tri, l'Essentiel d'une PR large tient dans les 900 s (BUDGET_E2E_S) ; la règle se vérifie avec un budget plus petit.
    const budget = 300;
    const duree = (jeu: "web" | "jump", s: string) => dureeE2e(ROOT, jeu, s);
    const large = ["packages/sim/src/car.ts", "apps/web/src/scene/post.ts", "apps/web/src/hud.css", "apps/web/src/salonMode.ts", "apps/web/src/garage.ts", "packages/ui/src/index.ts", "packages/profile/src/index.ts", "apps/api/src/server.ts", "packages/core/src/index.ts"];
    const sansBudget = specsPour(large, table, ROOT, { budget: Infinity });
    const r = specsPour(large, table, ROOT, { budget });
    expect(specsPour(large, table, ROOT).reportes, `l'Essentiel d'une PR large tient dans ${BUDGET_E2E_S} s`).toEqual([]);
    const fumee = new Set(table.fumee.web);
    const horsFumee = [...r.web.filter((s) => !fumee.has(s)).map((s) => duree("web", s)), ...r.jump.filter((s) => !table.fumee.jump.includes(s)).map((s) => duree("jump", s))];
    expect(horsFumee.reduce((n, s) => n + s, 0)).toBeLessThanOrEqual(budget + Math.max(...horsFumee));
    expect(r.web.length).toBeLessThan(sansBudget.web.length);
    expect(r.reportes!.length).toBe(sansBudget.web.length + sansBudget.jump.length - r.web.length - r.jump.length);
    for (const nom of table.fumee.web) expect(r.web, "la fumée est toujours lancée").toContain(nom);
    // Ce qui est reporté est bien un spec de la sélection complète, jamais l'un de ceux qui restent.
    for (const x of r.reportes!) {
      const [jeu, nom] = x.split("/") as ["web" | "jump", string];
      expect(sansBudget[jeu]).toContain(nom);
      expect(r[jeu]).not.toContain(nom);
    }
  });

  it("un spec modifié par la PR n'est jamais reporté, même seul au-delà du budget", () => {
    const r = specsPour(["apps/web/e2e/thumbnails.spec.ts", "apps/web/e2e/post.spec.ts", "packages/sim/src/car.ts"], table, ROOT, { budget: 100 });
    expect(r.web).toEqual(expect.arrayContaining(["thumbnails.spec.ts", "post.spec.ts"]));
  });

  it("le budget privilégie les specs les plus liés aux fichiers modifiés : deux fichiers de la même zone passent avant un seul", () => {
    const r = specsPour(["apps/web/src/salonMode.ts", "apps/web/src/watch.ts", "packages/sim/src/car.ts"], table, ROOT, { budget: 60 });
    const tous = specsPour(["apps/web/src/salonMode.ts", "apps/web/src/watch.ts", "packages/sim/src/car.ts"], table, ROOT, { budget: Infinity });
    expect(r.web).toContain("watch.spec.ts"); // track-salon deux fois (+ track-sim)
    expect(tous.web.length).toBeGreaterThan(r.web.length);
  });

  it("les documents ne lancent aucun spec", () => {
    expect(choix(["docs/plateforme/synthese.md", "apps/web/CLAUDE.md", "README.md"])).toMatchObject({ web: [], jump: [], tower: [] });
  });

  it("les zones nommées à la main (npm run verifier -- --zones=…) donnent les specs de la table, et signalent les noms inconnus", () => {
    const r = specsDesZones(["track-salon", "zone-fantaisie"], table);
    expect(r.web).toEqual(expect.arrayContaining(["salon.spec.ts", "watch.spec.ts"]));
    expect(r.inconnues).toEqual(["zone-fantaisie"]);
  });
});

describe("les tests unitaires d'une PR (graphe des imports)", () => {
  it("une PR de DailyJump (apps/jump) ne lance ni la simulation de Track, ni celle de Jump, ni le serveur : moins d'une minute de tests", () => {
    const r = testsPour(["apps/jump/src/hud.ts"], g);
    expect(r.fichiers.length).toBeGreaterThan(0);
    expect(r.fichiers.some((f) => f.startsWith("packages/sim/") || f.startsWith("packages/jump-sim/") || f.startsWith("apps/web/test/g"))).toBe(false);
    const durees = dureesUnitaires(ROOT);
    expect(r.fichiers.reduce((s, f) => s + (durees[f] ?? 5), 0)).toBeLessThanOrEqual(60);
  });

  it("la simulation de Track atteint ses tests, ceux du jeu et ceux du serveur (qui la rejoue), pas ceux de DailyJump", () => {
    const r = testsPour(["packages/sim/src/car.ts"], g).fichiers;
    expect(r.some((f) => f.startsWith("packages/sim/test/"))).toBe(true);
    expect(r.some((f) => f.startsWith("apps/api/test/"))).toBe(true);
    expect(r.some((f) => f.startsWith("packages/jump-sim/test/"))).toBe(false);
  });

  it("la configuration racine lance tout ; un fichier inconnu ou une liste vide : le doute", () => {
    expect(testsPour(["package-lock.json"], g)).toMatchObject({ tous: true });
    expect(testsPour([], g)).toMatchObject({ tous: true });
    expect(testsPour(["x"], g, { complet: true }).fichiers).toEqual(g.tests);
  });

  it("docs seuls : aucun test, sauf ceux qui lisent ces documents — qui sont listés ici", () => {
    expect(testsPour(["docs/lots/lot-1.md"], g)).toMatchObject({ docsSeuls: true });
    const lus = docsLusParLesTests(g);
    // Les documents que des tests lisent vraiment (et qu'un changement de document peut donc rendre rouges).
    const attendu: Record<string, string> = {
      "docs/plateforme/effacement.md": "apps/portail/test/mentions.test.ts",
      "docs/plateforme/budgets.md": "apps/portail/test/budgets.test.ts",
      "docs/plateforme/traductions.md": "packages/ui/test/traductions.test.ts",
      "docs/orchestration.md": "apps/web/test/quarantaine.test.ts",
    };
    for (const [doc, test] of Object.entries(attendu)) {
      expect(lus.get(doc), `${doc} lu par ${test}`).toContain(test);
      expect(testsPour([doc], g).fichiers, doc).toContain(test);
    }
  });

  it("un workflow lance les tests qui le lisent", () => {
    const r = testsPour([".github/workflows/ci.yml"], g).fichiers;
    expect(r).toEqual(expect.arrayContaining(["apps/web/test/e2eParts.test.ts", "apps/jump/test/ciE2e.test.ts", "apps/tower/test/ciE2e.test.ts", "apps/web/test/ciZones.test.ts"]));
  });
});

describe("les parts", () => {
  it("unitaires : chaque fichier dans une seule part, au plus 4 parts, durées égales à un fichier près", () => {
    const fichiers = Array.from({ length: 40 }, (_, i) => `t/${i}.test.ts`);
    const durees = Object.fromEntries(fichiers.map((f, i) => [f, 10 + (i % 7) * 20]));
    const parts = partsUnitaires(fichiers, durees);
    expect(parts.length).toBeLessThanOrEqual(PARTS_UNITAIRES_MAX);
    expect(parts.flatMap((p) => p.fichiers).sort()).toEqual([...fichiers].sort());
    const charges = parts.map((p) => p.secondes);
    expect(Math.max(...charges) - Math.min(...charges)).toBeLessThanOrEqual(130);
    expect(partsUnitaires([], {})).toEqual([]);
    expect(partsUnitaires(["a.test.ts"], { "a.test.ts": 2 })).toHaveLength(1);
  });

  it("unitaires : une charge qui tient en une cible tient en une part", () => {
    const parts = partsUnitaires(["a", "b", "c"], { a: 40, b: 40, c: 40 });
    expect(parts).toHaveLength(Math.ceil(120 / CIBLE_PART_UNITAIRE_S));
  });

  it("e2e : au plus 4 parts, chaque spec une seule fois, les jeux peuvent partager une part", () => {
    const web = specsDuJeu("web", ROOT).slice(0, 25);
    const jump = specsDuJeu("jump", ROOT).slice(0, 10);
    const tower = specsDuJeu("tower", ROOT);
    const parts = partsE2e({ web, jump, tower }, ROOT);
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.length).toBeLessThanOrEqual(PARTS_E2E_MAX);
    expect(parts.flatMap((p) => p.web).sort()).toEqual([...web].sort());
    expect(parts.flatMap((p) => p.jump).sort()).toEqual([...jump].sort());
    expect(parts.flatMap((p) => p.tower).sort()).toEqual([...tower].sort()); // lot R15
    expect(partsE2e({ web: [], jump: [], tower: [] }, ROOT)).toEqual([]);
  });
});

describe("la décision d'une PR", () => {
  it("docs seuls : ni vérification ni construction, ni spec ; les tests qui lisent le document, seuls", () => {
    const d = decider(["docs/plateforme/budgets.md"], { racine: ROOT });
    expect(d).toMatchObject({ docsSeuls: true, e2eParts: [] });
    expect(d.unitParts.flatMap((p) => p.fichiers)).toContain("apps/portail/test/budgets.test.ts");
    expect(d.unitParts.flatMap((p) => p.fichiers).length).toBeLessThanOrEqual(4);
    const out = sorties(d);
    expect(out).toContain("docs_seuls=true");
    const m = JSON.parse(/unit_matrice=(.*)/.exec(out)![1]!);
    expect(m.include.every((p: { verif: boolean }) => !p.verif)).toBe(true);
  });

  it("hors docs seuls, une première part vérifie toujours (typecheck, construction), même sans test unitaire", () => {
    const d = decider(["apps/web/index.html"], { racine: ROOT });
    expect(d.docsSeuls).toBe(false);
    const m = JSON.parse(/unit_matrice=(.*)/.exec(sorties(d))![1]!);
    expect(m.include.length).toBeGreaterThan(0);
    expect(m.include[0].verif).toBe(true);
    expect(m.include.slice(1).every((p: { verif: boolean }) => !p.verif)).toBe(true);
  });

  it("une PR de DailyJump : une CI courte (quelques specs de DailyJump, au plus 4 parts e2e et 4 parts unitaires)", () => {
    const d = decider(["apps/jump/src/hud.ts", "apps/jump/e2e/hud-compact.spec.ts"], { racine: ROOT });
    expect(d.e2e.web).toEqual([]);
    expect(d.e2eParts.length).toBeLessThanOrEqual(PARTS_E2E_MAX);
    expect(d.unitParts.length).toBeLessThanOrEqual(PARTS_UNITAIRES_MAX);
  });

  it("lot R15 : une PR de Tower seule : une CI courte (une part e2e de quelques dizaines de secondes, rien de Track ni de Jump)", () => {
    const d = decider(["apps/tower/src/hud.ts", "apps/tower/src/jeu.ts"], { racine: ROOT });
    expect(d.e2e).toMatchObject({ web: [], jump: [] });
    expect(d.e2e.tower.length).toBeGreaterThan(0);
    expect(d.e2eParts).toHaveLength(1);
    expect(d.e2eParts[0]!.secondes).toBeLessThanOrEqual(120);
    const m = JSON.parse(/e2e_pr_matrice=(.*)/.exec(sorties(d))![1]!);
    expect(m.include[0]).toMatchObject({ web: "", jump: "", tower: "classement.spec.ts determinisme.spec.ts partie.spec.ts poids.spec.ts" });
  });

  it("CI complète (main, nuit) : tous les tests unitaires en 3 parts, aucune part e2e de PR (la matrice complète est celle du workflow)", () => {
    const d = decider([], { mode: "complet", racine: ROOT });
    expect(d.unitParts.length).toBeLessThanOrEqual(3);
    expect(d.unitParts.flatMap((p) => p.fichiers).sort()).toEqual([...g.tests].sort());
    expect(d.e2eParts).toEqual([]);
    expect(decider([], { mode: "nuit", racine: ROOT }).docsSeuls).toBe(false);
  });
});

describe("le workflow (ci.yml)", () => {
  const ci = read(".github/workflows/ci.yml");
  const code = ci.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");

  it("la PR lit la matrice du job de portée ; la CI complète garde sa matrice ; les statuts requis `test` et `e2e` sont toujours rapportés", () => {
    expect(code).toContain("fromJSON(needs.scope.outputs.unit_matrice)");
    expect(code).toContain("fromJSON(needs.scope.outputs.e2e_pr_matrice)");
    expect(code).toMatch(/^  test:\n    needs: \[scope, unit, zones\]\n    if: always\(\)/m);
    expect(code).toMatch(/^  e2e:\n    needs: \[scope, e2e-parts, e2e-pr\]\n    if: always\(\)/m);
    // Pas de filtre de chemins au niveau du workflow : un statut requis qui ne se rapporte pas bloquerait la fusion d'une PR de documentation.
    expect(code).not.toMatch(/paths(-ignore)?:/);
  });

  it("plus d'étiquette `[ci complet]` : la CI complète est celle de main, de la nuit et du lancement à la main", () => {
    expect(code).not.toContain("[ci complet]");
    expect(code).toContain("workflow_dispatch:");
    expect(code).toMatch(/schedule:/);
    expect(code).toMatch(/branches: \[main\]/);
  });

  it("une poussée annule la CI de la précédente (jamais sur main, jamais celle du bouton « Mettre en production »), et la PR ne lance que Chromium", () => {
    expect(code).toContain("cancel-in-progress: ${{ github.ref != 'refs/heads/main' && github.workflow == 'CI' }}");
    const pr = code.slice(code.indexOf("  e2e-pr:"), code.indexOf("  e2e:\n"));
    expect(pr).toContain("--project=chromium");
    expect(pr).toContain("--project=jump-chromium");
    expect(pr).toContain("--project=tower-chromium"); // lot R15
    expect(pr).not.toMatch(/firefox|webkit/);
    expect(existsSync(join(ROOT, "e2e/zones.json"))).toBe(true);
  });
});
