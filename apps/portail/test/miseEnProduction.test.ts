import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import {
  ajouterJours,
  baseDe,
  basculeCommencee,
  changesFromLog,
  changesSummary,
  comparerEmpreintes,
  frozenOverlay,
  fusionnerEmpreintes,
  instantDeParis,
  inventaire,
  jourDeBascule,
  jourDeParis,
  latestProdTag,
  lotDe,
  nomDuJour,
  planDesJours,
  prodTag,
  resumeBascule,
  routesDe,
  versionsDe,
  zoneDes,
} from "../../../scripts/mise-en-production.mjs";

// Lot R4 : « Mettre en production » — étiquette, dernière mise en production, liste des changements, jours figés ajoutés au déploiement.

describe("étiquette de mise en production", () => {
  it("prod-AAAA-MM-JJ-HHMM à l'heure de Paris (été et hiver)", () => {
    expect(prodTag(Date.parse("2026-10-20T12:05:00Z"))).toBe("prod-2026-10-20-1405");
    expect(prodTag(Date.parse("2026-10-20T22:30:00Z"))).toBe("prod-2026-10-21-0030");
    expect(prodTag(Date.parse("2026-11-03T08:00:00Z"))).toBe("prod-2026-11-03-0900");
  });

  it("la dernière étiquette, et celle d'avant (retour arrière)", () => {
    const tags = ["v1", "prod-2026-10-21-0030", "prod-2026-10-20-1405", "prod-2026-11-03-0900", "prod-mauvaise", ""];
    expect(latestProdTag(tags)).toBe("prod-2026-11-03-0900");
    expect(latestProdTag(tags, "prod-2026-11-03-0900")).toBe("prod-2026-10-21-0030");
    expect(latestProdTag(["v1"])).toBeNull();
  });
});

describe("changements depuis la dernière mise en production", () => {
  const log = [
    "aaa1111\tp1 p2\tMerge pull request #84 from Nathan-Te/claude/lot-r4",
    "bbb2222\tp3\tLot R4 — workflows",
    "ccc3333\tp4\tCorrige le portail (#85)",
    "ddd4444\tp5 p6\tMerge pull request #84 from Nathan-Te/claude/lot-r4",
    "eee5555\tp7\tJours figés <robot>",
    "",
  ];
  it("PR (fusion ou écrasée, sans doublon) et commits ordinaires (hors fusions)", () => {
    const { prs, commits } = changesFromLog(log);
    expect(prs.map((p: { number: number }) => p.number)).toEqual([84, 85]);
    expect(commits.map((c: { sha: string }) => c.sha)).toEqual(["bbb2222", "ccc3333", "eee5555"]);
  });

  it("résumé lisible, liens vers les PR, sans balise", () => {
    const text = changesSummary({ from: "prod-2026-10-20-1405", to: "abcdef0123", repo: "Nathan-Te/DailyTrack", ...changesFromLog(log) });
    expect(text).toContain("depuis `prod-2026-10-20-1405`");
    expect(text).toContain("[#84](https://github.com/Nathan-Te/DailyTrack/pull/84)");
    expect(text).toContain("`ccc3333` Corrige le portail (#85)");
    expect(text).not.toContain("<robot>");
    expect(changesSummary({ from: null, to: "abc", repo: null, prs: [], commits: [] })).toContain("première mise en production");
  });
});

describe("jours figés avec le code en production", () => {
  it("ajoute les jours absents du commit déployé ; un jour identique ne change rien ; un jour différent est refusé", () => {
    const frozen = { "2026-10-16.json": "a", "2026-10-21.json": "b", "2026-10-22.json": "c", "notes.txt": "x" };
    expect(frozenOverlay(frozen, { "2026-10-16.json": "a" })).toEqual({ add: ["2026-10-21.json", "2026-10-22.json"], conflicts: [] });
    expect(frozenOverlay(frozen, { "2026-10-16.json": "AUTRE" }).conflicts).toEqual(["2026-10-16.json"]);
    expect(frozenOverlay({}, { "2026-10-16.json": "a" })).toEqual({ add: [], conflicts: [] });
  });
});

// ——— Lot R6 : le garde-fou des jours ————————————————————————————————————————————————————————————————————————————————————————

describe("le jour de bascule : le premier jour de Paris qui commence après le déploiement", () => {
  it("un mardi à 10 h → le mercredi ; un lundi à 23 h 30 → le mardi ; à minuit pile → le lendemain du nouveau jour", () => {
    expect(jourDeBascule(instantDeParis("2026-10-27 10:00"))).toBe("2026-10-28");
    expect(nomDuJour(jourDeBascule(instantDeParis("2026-10-27 10:00")))).toBe("mercredi 2026-10-28");
    expect(jourDeBascule(instantDeParis("2026-10-26 23:30"))).toBe("2026-10-27");
    expect(nomDuJour("2026-10-27")).toBe("mardi 2026-10-27");
    expect(jourDeBascule(instantDeParis("2026-10-27 00:00"))).toBe("2026-10-28");
    expect(jourDeBascule(instantDeParis("2026-10-26 23:59"))).toBe("2026-10-27");
  });

  it("le jour de Paris, pas le jour UTC : 23 h 30 à Paris est déjà le lendemain en UTC en été", () => {
    expect(jourDeParis(Date.parse("2026-10-20T22:30:00Z"))).toBe("2026-10-21");
    expect(jourDeBascule(Date.parse("2026-10-20T22:30:00Z"))).toBe("2026-10-22");
  });

  it("la nuit d'un changement d'heure (28/03/2027, 23 h) : le calendrier, jamais des heures de 3 600 s", () => {
    // 01:30 à Paris existe (heure d'hiver) ; 02:30 n'existe pas ; 03:30 est l'heure d'été.
    expect(jourDeBascule(instantDeParis("2027-03-28 01:30"))).toBe("2027-03-29");
    expect(() => instantDeParis("2027-03-28 02:30")).toThrow(/n'existe pas/);
    expect(jourDeBascule(instantDeParis("2027-03-28 03:30"))).toBe("2027-03-29");
    expect(jourDeBascule(instantDeParis("2027-03-27 23:30"))).toBe("2027-03-28");
    // Le jour de bascule du 28/03 (déployé la veille au soir) est un jour de 23 h.
    const debut = instantDeParis("2027-03-28 00:00");
    const fin = instantDeParis("2027-03-29 00:00");
    expect((fin - debut) / 3_600_000).toBe(23);
    // Le 25/10/2026, un jour de 25 h.
    expect((instantDeParis("2026-10-26 00:00") - instantDeParis("2026-10-25 00:00")) / 3_600_000).toBe(25);
    expect(jourDeBascule(instantDeParis("2026-10-25 12:00"))).toBe("2026-10-26");
  });

  it("une heure qui existe deux fois (reculer l'heure, 25/10/2026 à 02:30) prend la première ; « demain 10:00 » est relatif à l'instant donné ; un instant complet est gardé", () => {
    expect(instantDeParis("2026-10-25 02:30")).toBe(Date.parse("2026-10-25T00:30:00Z"));
    const maintenant = Date.parse("2026-10-26T15:00:00Z");
    expect(jourDeBascule(instantDeParis("demain 10:00", maintenant))).toBe("2026-10-28");
    expect(jourDeBascule(instantDeParis("aujourdhui 23:30", maintenant))).toBe("2026-10-27");
    expect(instantDeParis("2026-10-27T08:00:00Z")).toBe(Date.parse("2026-10-27T08:00:00Z"));
    expect(() => instantDeParis("bientôt")).toThrow(/illisible/);
  });

  it("le plan : veille, derniers jours régénérés ; un clic trop vieux (le jour de bascule a commencé) est refusé", () => {
    const plan = planDesJours(instantDeParis("2026-10-27 10:00"), "2026-10-26");
    expect(plan).toMatchObject({ bascule: "2026-10-28", veille: "2026-10-27", premier: "2026-10-26", dernierRegenere: "2026-11-10", jourDeParis: "2026-10-27" });
    expect(basculeCommencee("2026-10-28", instantDeParis("2026-10-27 23:59"))).toBe(false);
    expect(basculeCommencee("2026-10-28", instantDeParis("2026-10-28 00:00"))).toBe(true);
    expect(basculeCommencee("2026-10-28", instantDeParis("2026-10-29 08:00"))).toBe(true);
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("comparer les jours que sert la production et ceux que servira la construction", () => {
  const e = (id: string, h: string, ok = true) => ({ id, h, ok });
  const prod = {
    track: { "2026-10-26": e("t26-g15", "a"), "2026-10-27": e("t27-g15", "b"), "2026-10-28": e("t28-g16", "c"), "2026-10-29": e("t29-g16", "d") },
    jump: { "2026-10-26": e("j26-g10", "a"), "2026-10-27": e("j27-g10", "b"), "2026-10-28": e("j28-g12", "c"), "2026-10-29": e("j29-g12", "d") },
  };

  it("avant la bascule, tout est identique ; à partir d'elle, les jours régénérés sont comptés (validés, changés)", () => {
    const cible = {
      track: { ...prod.track, "2026-10-29": e("t29-g17", "z") },
      jump: { ...prod.jump, "2026-10-28": e("j28-g17", "y"), "2026-10-29": e("j29-g17", "x", false) },
    };
    const c = comparerEmpreintes(prod, cible, "2026-10-28", "2026-10-26");
    expect(c.jeux.track).toMatchObject({ conserves: ["2026-10-26", "2026-10-27"], differences: [], regeneres: ["2026-10-28", "2026-10-29"], valides: 2, changes: ["2026-10-29"] });
    expect(c.jeux.jump).toMatchObject({ conserves: ["2026-10-26", "2026-10-27"], differences: [], valides: 1, invalides: ["2026-10-29"], changes: ["2026-10-28", "2026-10-29"] });
    expect(c.ok).toBe(false); // un jour régénéré qui n'est pas valide arrête aussi
    expect(comparerEmpreintes(prod, { track: prod.track, jump: prod.jump }, "2026-10-28", "2026-10-26").ok).toBe(true);
  });

  it("la moindre différence AVANT la bascule arrête, avec le jour, les deux identifiants et la raison", () => {
    const cible = { track: { ...prod.track, "2026-10-27": e("t27-g15", "AUTRE") }, jump: { ...prod.jump, "2026-10-26": e("j26-g17", "q") } };
    const c = comparerEmpreintes(prod, cible, "2026-10-28", "2026-10-26");
    expect(c.ok).toBe(false);
    expect(c.jeux.track.differences).toEqual([{ date: "2026-10-27", prod: "t27-g15", cible: "t27-g15", raison: "autre contenu, même identifiant" }]);
    expect(c.jeux.jump.differences).toEqual([{ date: "2026-10-26", prod: "j26-g10", cible: "j26-g17", raison: "autre identifiant" }]);
    const manque = comparerEmpreintes(prod, { track: { "2026-10-26": prod.track["2026-10-26"] }, jump: prod.jump }, "2026-10-28", "2026-10-26");
    expect(manque.jeux.track.differences.map((d: { date: string; raison: string }) => [d.date, d.raison])).toEqual([["2026-10-27", "absent de la construction"]]);
  });

  it("les jours d'avant le lancement ne comptent pas", () => {
    const avant = { track: { "2026-10-20": e("x", "1"), ...prod.track }, jump: prod.jump };
    const cible = { track: { "2026-10-20": e("x", "2"), ...prod.track }, jump: prod.jump };
    expect(comparerEmpreintes(avant, cible, "2026-10-28", "2026-10-26").ok).toBe(true);
    expect(comparerEmpreintes(avant, cible, "2026-10-28").ok).toBe(false);
  });

  it("le résumé du run : jour de bascule, jours conservés, jours régénérés, et la liste des jours en cause", () => {
    const plan = planDesJours(instantDeParis("2026-10-27 10:00"), "2026-10-26");
    const bon = resumeBascule({ plan, comparaison: comparerEmpreintes(prod, prod, "2026-10-28", "2026-10-26") });
    expect(bon).toContain("jour de bascule : mercredi 2026-10-28");
    expect(bon).toContain("| DailyTrack | 2 (2026-10-26 → 2026-10-27) | 0 | 2 (2026-10-28 → 2026-10-29) | 2 | 0 |");
    expect(bon).toContain("Aucun jour d'avant la bascule ne change");
    const cible = { track: prod.track, jump: { ...prod.jump, "2026-10-27": e("j27-g17", "zz") } };
    const mauvais = resumeBascule({ plan, comparaison: comparerEmpreintes(prod, cible, "2026-10-28", "2026-10-26"), simulee: true });
    expect(mauvais).toContain("répétition");
    expect(mauvais).toContain("❌ **DailyJump 2026-10-27**");
    expect(mauvais).toContain("La mise en production s'arrête");
  });

  it("les empreintes de jours passés gardées dans le dépôt : un jour nouveau s'ajoute, un jour qui change est refusé", () => {
    const existant = { track: { "2026-10-26": { id: "a", h: "1" } }, jump: { "2026-10-26": { id: "b", h: "2" } } };
    const r = fusionnerEmpreintes(existant, { track: { "2026-10-26": e("a", "1"), "2026-10-27": e("c", "3") }, jump: { "2026-10-27": e("d", "4") } });
    expect(r.conflits).toEqual([]);
    expect(r.ajoutes).toEqual(["track 2026-10-27", "jump 2026-10-27"]);
    expect(r.fusion.track["2026-10-27"]).toEqual({ id: "c", h: "3" }); // `ok` n'est pas gardé : seulement ce qui doit rester vrai
    expect(fusionnerEmpreintes(existant, { track: { "2026-10-26": e("a", "AUTRE") } }).conflits).toEqual(["track 2026-10-26"]);
  });
});

describe("« Ce qui part » : versions, migrations, routes, PR", () => {
  const avant = {
    "packages/jump-sim/src/constants.ts": "export const JUMP_SIM_VERSION = 4;\nexport const JUMP_GENERATOR_VERSION = 12;",
    "packages/sim/src/constants.ts": "export const SIM_VERSION = 14;\nexport const GENERATOR_VERSION = 16;",
    "packages/sim/src/dailyId.ts": "export const BASCULE_LOT_34 = daysFromCivil(2026, 10, 28);",
    "apps/api/src/db.ts": 'export const MIGRATIONS: string[] = [\n  "ALTER TABLE players ADD COLUMN demo INTEGER NOT NULL DEFAULT 0",\n  // note\n  "DROP TABLE IF EXISTS salon_podiums",\n];\n',
    "apps/api/src/jump.ts": '    if (path === "/api/jump/info") {\n    if (path === "/api/jump/submit") {\n  `CREATE TABLE IF NOT EXISTS jump_results (day INTEGER)`',
  };
  const apres = {
    ...avant,
    "packages/jump-sim/src/constants.ts": "export const JUMP_SIM_VERSION = 7;\nexport const JUMP_GENERATOR_VERSION = 17;",
    "packages/sim/src/dailyId.ts": "export const BASCULE_LOT_34 = daysFromCivil(2026, 10, 28);\nexport const BASCULE_LOT_48 = daysFromCivil(2026, 11, 4);",
    "apps/api/src/db.ts": 'export const MIGRATIONS: string[] = [\n  "ALTER TABLE players ADD COLUMN demo INTEGER NOT NULL DEFAULT 0",\n  "DROP TABLE IF EXISTS salon_podiums",\n  "ALTER TABLE results ADD COLUMN inputs_hash TEXT",\n];\n',
    "apps/api/src/jump.ts": '    if (path === "/api/jump/info") {\n    if (path === "/api/jump/vies") {\n  `CREATE TABLE IF NOT EXISTS jump_results (day INTEGER)`\n  `CREATE TABLE IF NOT EXISTS jump_nouveau (x INTEGER)`',
  };

  it("lit les versions, les bascules, les migrations, les tables et les routes d'un état du code", () => {
    expect(versionsDe(avant)).toMatchObject({ JUMP_SIM_VERSION: 4, JUMP_GENERATOR_VERSION: 12, SIM_VERSION: 14, GENERATOR_VERSION: 16, bascules: { BASCULE_LOT_34: "2026-10-28" } });
    expect(versionsDe({}).JUMP_SIM_VERSION).toBeNull();
    expect(baseDe(apres).migrations).toEqual(["ALTER TABLE players ADD COLUMN demo INTEGER NOT NULL DEFAULT 0", "DROP TABLE IF EXISTS salon_podiums", "ALTER TABLE results ADD COLUMN inputs_hash TEXT"]);
    expect(baseDe(apres).tables).toEqual(["jump_nouveau", "jump_results"]);
    expect(routesDe(apres)).toEqual(["/api/jump/info", "/api/jump/vies"]);
  });

  it("l'inventaire : une ligne par PR (titre, lot, zone) et, pour chaque changement, l'effet, le risque, la vérification", () => {
    const prs = [{ number: 156, titre: "Lot 23 — Champignons", branche: "claude/lot-23", lot: "lot 23", zone: "Jump" }];
    const t = inventaire({ de: "prod-2026-10-25-0933", a: "f501bce0000", prs, versionsAvant: versionsDe(avant), versionsApres: versionsDe(apres), baseAvant: baseDe(avant), baseApres: baseDe(apres), routesAvant: routesDe(avant), routesApres: routesDe(apres), repo: "Nathan-Te/DailyTrack" });
    expect(t).toContain("[#156](https://github.com/Nathan-Te/DailyTrack/pull/156) | Lot 23 — Champignons | lot 23 | Jump");
    expect(t).toContain("JUMP_GENERATOR_VERSION : 12 → 17");
    expect(t).toContain("JUMP_SIM_VERSION : 4 → 7");
    expect(t).toContain("BASCULE_LOT_48 : — → 2026-11-04");
    expect(t).toContain("migration : `ALTER TABLE results ADD COLUMN inputs_hash TEXT`");
    expect(t).toContain("nouvelle table `jump_nouveau`");
    expect(t).toContain("route ajoutée `/api/jump/vies`");
    expect(t).toContain("route retirée `/api/jump/submit`");
    expect(t).toMatch(/\| effet pour le joueur \| risque \| comment on le vérifie \|/);
    expect(t).not.toContain("SIM_VERSION : 14"); // inchangée : pas de ligne
    const rien = inventaire({ de: null, a: "abc1234", prs: [], versionsAvant: versionsDe(avant), versionsApres: versionsDe(avant), baseAvant: baseDe(avant), baseApres: baseDe(avant), routesAvant: [], routesApres: [], repo: null });
    expect(rien).toContain("aucune version, migration ni route ne change");
  });

  it("la zone et le lot d'une PR se lisent de ses fichiers, de son titre ou de sa branche", () => {
    expect(zoneDes(["apps/web/src/main.ts", "packages/sim/src/car.ts"])).toBe("Track");
    expect(zoneDes(["apps/jump/src/main.ts", "docs/jump/lots/x.md"])).toBe("Jump");
    expect(zoneDes(["packages/jump-sim/src/daily.ts", "scripts/budgets.mjs"])).toBe("Jump + plateforme");
    expect(zoneDes([".github/workflows/ci.yml"])).toBe("plateforme");
    expect(zoneDes(["apps/api/src/cdj.ts", "apps/api/test/api.test.ts"])).toBe("Track");
    expect(lotDe("Lot R6 (plateforme) — Le garde-fou des jours", "ccr-123")).toBe("lot R6");
    expect(lotDe("Retouche", "claude/lot-23-champignons-vcg9t8")).toBe("lot 23");
    expect(lotDe("Une PR", "main")).toBe("—");
  });
});

describe("les jours que la production sert hors du commit de son étiquette (jours-servis)", () => {
  const CLI = join(__dirname, "../../../scripts/mise-en-production.mjs");
  const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });

  it("remet dans le dossier les jours des PR « Jours figés de la mise en production » fusionnées depuis l'étiquette, et rien d'autre", () => {
    const depot = mkdtempSync(join(tmpdir(), "servis-"));
    const niveaux = join(depot, "apps/jump/public/levels");
    mkdirSync(niveaux, { recursive: true });
    git(depot, "init", "-q", "-b", "main");
    writeFileSync(join(niveaux, "2026-10-23.json"), "{\"v\":\"avant\"}");
    git(depot, "add", "-A");
    git(depot, "commit", "-q", "-m", "code en production");
    git(depot, "tag", "prod-2026-10-25-0933");
    // Une PR « robot » (jours figés avec le code d'avant), puis un lot qui touche un autre fichier.
    writeFileSync(join(niveaux, "2026-10-24.json"), "{\"v\":\"robot\"}");
    git(depot, "add", "-A");
    git(depot, "commit", "-q", "-m", "Jours figés de la mise en production prod-2026-10-25-0933 (code en production)");
    writeFileSync(join(niveaux, "2026-10-30.json"), "{\"v\":\"lot\"}");
    git(depot, "add", "-A");
    git(depot, "commit", "-q", "-m", "Lot 99 : fige à la main");
    const sortie = join(depot, "servis");
    const out = execFileSync("node", [CLI, "jours-servis", "prod-2026-10-25-0933", sortie, "--jusqua", "HEAD"], { cwd: depot, encoding: "utf8" });
    expect(out).toContain("2026-10-24.json");
    expect(readFileSync(join(sortie, "2026-10-24.json"), "utf8")).toBe("{\"v\":\"robot\"}");
    expect(existsSync(join(sortie, "2026-10-30.json"))).toBe(false); // un fichier de lot n'est pas servi par la production
    expect(existsSync(join(sortie, "2026-10-23.json"))).toBe(false); // celui du commit de l'étiquette y est déjà
    // Un fichier déjà présent n'est jamais réécrit.
    writeFileSync(join(sortie, "2026-10-24.json"), "{\"v\":\"deja\"}");
    execFileSync("node", [CLI, "jours-servis", "prod-2026-10-25-0933", sortie, "--jusqua", "HEAD"], { cwd: depot, encoding: "utf8" });
    expect(readFileSync(join(sortie, "2026-10-24.json"), "utf8")).toBe("{\"v\":\"deja\"}");
  });
});
