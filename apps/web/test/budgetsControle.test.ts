import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AVERTIR, FAMILLES, HORS_JOB, artefactDeMain, avertissements, choisirArtefact, controler, ecart, fmt, fmtKo, lireLignes, lirePlafonds, lireReleves, nomArtefact, plafondKo, proposerRecalage, tableau, texteRecalage, validerMesures } from "../../../scripts/budgets-controle.mjs";

// Lot R17 (plateforme, CI) : le contrôle des budgets. Logique pure (lecture de budgets.md, comparaison, tableau du résumé, choix de l'artefact de main) et, une fois, le vrai programme :
// un dépassement sur une ligne le fait sortir en erreur en nommant la ligne (le « run d'essai rouge » du rapport, sans construire).
// Lot B1 : les plafonds sont en Ko (règle : mesure + 5 % et 2 Ko au moins pour le premier chargement, + 10 % et 1 Ko à la demande, + 10 % polices et images) ; le job n'échoue que sur un dépassement,
// il avertit (sans bloquer) d'une croissance de plus de 3 Ko ou de plus de 1 % par rapport à main ; le recalage est une proposition.
const ROOT = join(__dirname, "../../..");
const doc = readFileSync(join(ROOT, "docs/plateforme/budgets.md"), "utf8");

describe("lecture de docs/plateforme/budgets.md", () => {
  it("lit le plafond de chaque ligne (en octets, écrit en Ko), sa famille et sa mesure à la pose", () => {
    const p = lirePlafonds(doc);
    expect(p["track.jsCss"]).toBeGreaterThan(290_000);
    expect(p["track.jsCss"]! % 1000).toBe(0);
    expect(p["portail.premier"]).toBeGreaterThan(30_000);
    expect(p["tower.decors"]).toBeGreaterThan(1_000);
    expect(p["tower.habits"]).toBeGreaterThan(1_000);
    expect(p["partage.image"]).toBe(48_000);
    expect(Object.keys(p).length).toBeGreaterThan(30);
    const l = lireLignes(doc);
    expect(l["track.jsCss"]!.famille).toBe("premier");
    expect(l["track.admin"]!.famille).toBe("demande");
    expect(l["jump.polices"]!.famille).toBe("police");
    expect(l["jump.jsCss"]!.mesure).toBeGreaterThan(300_000);
  });
  it("une ligne est `| clé | appli | description | famille | N Ko | mesure | marge |` ; les chiffres à la française (espaces ordinaires, insécables, fines) sont des nombres ; le reste est ignoré", () => {
    expect(lireLignes("| `a.b` | X | m | premier | 38 Ko | 35 189 | 2 811 |\n| `c.d` | X | m | demande | 1 055 Ko | 958 766 | 1 |\n| `e.f` | X | m | inconnue | 5 Ko | 1 | 1 |\n| pas une ligne | X |")).toEqual({
      "a.b": { plafond: 38_000, plafondKo: 38, famille: "premier", mesure: 35_189 },
      "c.d": { plafond: 1_055_000, plafondKo: 1_055, famille: "demande", mesure: 958_766 },
    });
    expect(lirePlafonds("| `a.b` | X | m | police | 5 Ko | 4 000 | 1 000 |")).toEqual({ "a.b": 5_000 });
  });
  it("lit les relèvements décidés par Nathan (date, ligne, de, à, raison)", () => {
    expect(lireReleves("| Date | Clé | De | À | Raison |\n|---|---|---:|---:|---|\n| 2026-11-10 | `track.jsCss` | 312 Ko | 330 Ko | le lot X ajoute le Garage au premier écran |")).toEqual({
      "track.jsCss": [{ date: "2026-11-10", de: 312, a: 330, raison: "le lot X ajoute le Garage au premier écran" }],
    });
  });
});

describe("la règle des plafonds (lot B1)", () => {
  it("premier chargement : mesure + 5 % et au moins 2 Ko ; à la demande : + 10 % et au moins 1 Ko ; polices et images : + 10 % ; toujours au Ko supérieur", () => {
    expect(Object.values(FAMILLES).map((f: { pct: number; plancherKo: number }) => [f.pct, f.plancherKo])).toEqual([[5, 2], [10, 1], [10, 0]]);
    expect(plafondKo("premier", 296_956)).toBe(312); // Track
    expect(plafondKo("premier", 382_856)).toBe(402); // Jump
    expect(plafondKo("premier", 35_189)).toBe(38); // portail : 5 % = 1,8 Ko < 2 Ko
    expect(plafondKo("premier", 39_633)).toBe(42); // accueil de Tower
    expect(plafondKo("demande", 149)).toBe(2);
    expect(plafondKo("demande", 958_766)).toBe(1_055);
    expect(plafondKo("police", 116_796)).toBe(129);
  });
});

describe("la comparaison", () => {
  const p = { "x.a": 1000, "x.b": 500, "partage.image": 48_000 };
  it("tout tient : l'égalité tient (« tenir dans le plafond »), la marge est plafond − mesure ; la ligne hors job est ignorée", () => {
    const r = controler(p, { "x.a": 1000, "x.b": 100 });
    expect(r.depassements).toEqual([]);
    expect(r.lignes.map((l: { cle: string; marge: number }) => [l.cle, l.marge])).toEqual([["x.a", 0], ["x.b", 400]]);
    expect(r.sansMesure).toEqual([]);
    expect(Object.keys(HORS_JOB)).toEqual(["partage.image"]);
  });
  it("un octet de trop est un dépassement, nommé avec son excédent (en Ko et en octets)", () => {
    const r = controler(p, { "x.a": 1001, "x.b": 100 });
    expect(r.depassements.map((l: { cle: string }) => l.cle)).toEqual(["x.a"]);
    expect(tableau(r)).toContain("**0,00 Ko de trop** (1 o)");
    expect(tableau(r)).toContain("⛔ `x.a`");
  });
  it("une ligne du tableau sans mesure, ou une mesure sans ligne, est une erreur de plomberie (jamais un silence)", () => {
    const r = controler(p, { "x.a": 1, "y.z": 5 });
    expect(r.sansMesure).toEqual(["x.b"]);
    expect(r.sansPlafond).toEqual(["y.z"]);
    expect(tableau(r)).toContain("n'a pas de ligne dans budgets.md");
  });
});

describe("le tableau du résumé (en Ko)", () => {
  const p = { "x.a": 312_000, "x.b": 38_000, "x.c": 90_000 };
  const r = controler(p, { "x.a": 296_956, "x.b": 35_189, "x.c": 80_000 });
  it("ligne · plafond · mesure · marge · écart avec main, en Ko, un écart signé, « nouveau » pour une ligne absente de main", () => {
    const t = tableau(r, { sha: "abcdef1234567", mesures: { "x.a": 296_900, "x.b": 35_189 } });
    expect(t).toContain("| ligne | plafond (Ko) | mesure (Ko) | marge (Ko) | écart avec main (Ko) |");
    expect(t).toContain("| `x.a` | 312,00 | 296,96 | 15,04 | +0,06 |");
    expect(t).toContain("| `x.b` | 38,00 | 35,19 | 2,81 | 0 |");
    expect(t).toContain("| `x.c` | 90,00 | 80,00 | 10,00 | nouveau |");
    expect(t).toContain("`abcdef1`");
    expect(t).toContain("✅ Budgets");
  });
  it("sans mesure de main : la colonne dit « — » et pourquoi ; une mesure plus petite a le vrai signe moins", () => {
    expect(tableau(r)).toContain("aucune mesure de `main` disponible");
    expect(tableau(r)).toContain("| `x.a` | 312,00 | 296,96 | 15,04 | — |");
    expect(ecart(90_000, 100_000)).toBe("−10,00");
    expect(fmt(-1234)).toBe("−1 234");
    expect(fmtKo(-1234)).toBe("−1,23");
    expect(fmtKo(1_054_639)).toBe("1 054,64");
  });
  it("quand la mesure de main n'est pas celle du commit dont part la PR, le tableau le dit", () => {
    expect(tableau(r, { sha: "abcdef1", mesures: {} }, { exact: false })).toContain("pas forcément le commit dont part la PR");
  });
});

describe("l'avertissement de croissance (lot B1) : plus de 3 Ko ou plus de 1 % par rapport à main, jamais bloquant", () => {
  const p = { "g.a": 400_000, "g.b": 100_000, "g.c": 9_000, "g.d": 3_000 };
  const main = (m: Record<string, number>) => ({ sha: "abcdef1", mesures: m });
  it("+3,5 Ko sur un gros jeu (moins de 1 %) : avertissement ; +1,2 % sur une petite ligne : avertissement ; +0,9 % et sous 3 Ko : rien", () => {
    const base = { "g.a": 300_000, "g.b": 50_000, "g.c": 5_000, "g.d": 2_000 };
    const r = controler(p, { "g.a": 303_500, "g.b": 50_600, "g.c": 5_300, "g.d": 2_010 });
    const a = avertissements(r, main(base));
    expect(a.map((x: { cle: string }) => x.cle)).toEqual(["g.a", "g.b", "g.c"]); // g.a : +3,5 Ko (1,17 %) ; g.b : +1,2 % ; g.c : +6 % ; g.d : +10 o, sous le plancher
    expect(AVERTIR).toEqual({ ko: 3, pct: 1, plancher: 200 });
    const rien = controler(p, { "g.a": 302_900, "g.b": 50_400, "g.c": 5_000, "g.d": 2_000 }); // +0,97 % et +2,9 Ko ; +0,8 %
    expect(avertissements(rien, main(base))).toEqual([]);
  });
  it("une ligne qui rapetisse n'avertit pas ; sans mesure de main, rien ; une grosse croissance reste sous le plafond sans faire échouer le contrôle", () => {
    const r = controler(p, { "g.a": 290_000, "g.b": 50_000, "g.c": 5_000, "g.d": 2_000 });
    expect(avertissements(r, main({ "g.a": 300_000 }))).toEqual([]);
    expect(avertissements(r, null)).toEqual([]);
    const grossit = controler(p, { "g.a": 340_000, "g.b": 50_000, "g.c": 5_000, "g.d": 2_000 });
    expect(grossit.depassements).toEqual([]);
    const t = tableau(grossit, main({ "g.a": 300_000 }));
    expect(t).toContain("✅ Budgets");
    expect(t).toContain("⚠️ Croissance par rapport à `main`");
    expect(t).toContain("⚠️ `g.a` grossit de **+40,00 Ko** (+13,3 %) : 300,00 → 340,00 Ko");
  });
});

describe("le recalage proposé (lot B1) : jamais appliqué", () => {
  const lignes = lireLignes("| `a.p` | X | m | premier | 312 Ko | 296 956 | 15 044 |\n| `b.d` | X | m | demande | 20 Ko | 18 000 | 2 000 |\n| `c.i` | X | m | police | 129 Ko | 116 796 | 12 204 |");
  it("propose pour les lignes dont la mesure a baissé de plus que sa marge ; ni pour une marge entamée, ni pour une mesure inchangée", () => {
    const p = proposerRecalage(lignes, { "a.p": 296_956, "b.d": 12_000, "c.i": 116_000 });
    expect(p.map((x: { cle: string; plafondKo: number; propose: number }) => [x.cle, x.plafondKo, x.propose])).toEqual([["b.d", 20, 14]]);
    expect(proposerRecalage(lignes, { "a.p": 250_000, "b.d": 18_000, "c.i": 100_000 }).map((x: { cle: string }) => x.cle)).toEqual(["a.p", "c.i"]);
    expect(texteRecalage(p)).toContain("| `b.d` | à la demande | 12,00 | 20 | 14 |");
    expect(texteRecalage(p)).toContain("rien n'est modifié");
    expect(texteRecalage([])).toContain("Aucun recalage à proposer");
  });
});

describe("les mesures de main (artefact)", () => {
  it("accepte le format du job, refuse le reste, ne garde que des nombres", () => {
    expect(validerMesures({ format: 1, sha: "abcdef1", mesures: { "x.a": 5, "y.b": "5", "z!": 3, "w.c": -1 } })).toEqual({ sha: "abcdef1", mesures: { "x.a": 5 } });
    expect(validerMesures({ format: 2, mesures: {} })).toBeNull();
    expect(validerMesures("n'importe quoi")).toBeNull();
    expect(validerMesures(null)).toBeNull();
  });
  const art = (sha: string, id: number, date: string, extra = {}) => ({ name: nomArtefact(sha), created_at: date, expired: false, workflow_run: { id, head_branch: "main" }, ...extra });
  it("choisit l'artefact du commit dont part la PR ; sinon le plus récent de main ; ignore les expirés, les autres noms et les autres branches", () => {
    const liste = [
      art("aaa1111", 3, "2026-11-03T10:00:00Z"),
      art("bbb2222", 2, "2026-11-02T10:00:00Z"),
      art("ccc3333", 9, "2026-11-04T10:00:00Z", { expired: true }),
      { name: "durees-e2e", created_at: "2026-11-05T10:00:00Z", expired: false, workflow_run: { id: 8, head_branch: "main" } },
      art("ddd4444", 7, "2026-11-06T10:00:00Z", { workflow_run: { id: 7, head_branch: "claude/une-pr" } }),
    ];
    expect(choisirArtefact(liste, "bbb2222")).toEqual({ run: "2", nom: "budgets-bbb2222", exact: true });
    expect(choisirArtefact(liste, "zzz9999")).toEqual({ run: "3", nom: "budgets-aaa1111", exact: false });
    expect(choisirArtefact([], "bbb2222")).toBeNull();
    expect(choisirArtefact(undefined, "")).toBeNull();
  });
  it("interroge l'API avec le nom exact, puis la liste récente", async () => {
    const appels: string[] = [];
    const lire = async (chemin: string) => {
      appels.push(chemin);
      return { artifacts: chemin.includes("&name=") ? [] : [art("aaa1111", 3, "2026-11-03T10:00:00Z")] };
    };
    expect(await artefactDeMain("o/d", "bbb2222", "jeton", lire)).toEqual({ run: "3", nom: "budgets-aaa1111", exact: false });
    expect(appels[0]).toContain("/repos/o/d/actions/artifacts?per_page=100&name=budgets-bbb2222");
  });
});

describe("le programme (lot R17 : « le run d'essai rouge », sans construire)", () => {
  function lancer(mesures: Record<string, number>, main?: Record<string, number>, commande = "controler") {
    const dir = mkdtempSync(join(tmpdir(), "budgets-"));
    try {
      writeFileSync(join(dir, "mesures.json"), JSON.stringify({ format: 1, sha: "", mesures }));
      const args = ["scripts/budgets-controle.mjs", commande, "--mesures", join(dir, "mesures.json")];
      if (main) {
        writeFileSync(join(dir, "main.json"), JSON.stringify({ format: 1, sha: "abcdef1", mesures: main }));
        args.push("--main", join(dir, "main.json"));
      }
      const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
      return { code: r.status, sortie: r.stdout + r.stderr };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const p = lirePlafonds(doc) as Record<string, number>;
  const toutesSousLePlafond = () => Object.fromEntries(Object.entries(p).filter(([c]) => !(c in HORS_JOB)).map(([c, v]) => [c, v - 10]));

  it("toutes les lignes sous leur plafond : code 0 et le tableau en Ko", () => {
    const r = lancer(toutesSousLePlafond());
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("✅ Budgets");
    expect(r.sortie).toContain("`track.jsCss`");
    expect(r.sortie).toContain("| ligne | plafond (Ko) | mesure (Ko) | marge (Ko) | écart avec main (Ko) |");
  });
  it("+ 1 Ko au-delà du plafond sur le socle : code 1, chaque ligne dépassée est nommée avec son excédent, l'écart avec main est dans le tableau", () => {
    const main = toutesSousLePlafond();
    const mesures = { ...main };
    for (const c of ["track.jsCss", "track.js", "jump.jsCss", "tower.jsCss"]) mesures[c] = p[c]! + 600; // les premiers chargements dépassent
    const r = lancer(mesures, main);
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("⛔ Budgets : 4 ligne(s) dépassent leur plafond");
    expect(r.sortie).toContain("::error title=Budget dépassé::track.jsCss : ");
    expect(r.sortie).toContain("**0,60 Ko de trop** (600 o)");
    expect(r.sortie).toContain("| ⛔ `jump.jsCss` |");
    expect(r.sortie).toContain("+0,61 |");
    expect(r.sortie).toContain("ne relève jamais un plafond");
  });
  it("une croissance de plus de 3 Ko qui tient dans le plafond : code 0, un avertissement visible (résumé et annotation)", () => {
    const main = toutesSousLePlafond();
    main["track.jsCss"] = p["track.jsCss"]! - 6_000;
    const mesures = { ...main, "track.jsCss": p["track.jsCss"]! - 100 }; // +5,9 Ko par rapport à main, sous le plafond
    const r = lancer(mesures, main);
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("✅ Budgets");
    expect(r.sortie).toContain("::warning title=Budget : la ligne grossit::track.jsCss grossit de +5,90 Ko");
    expect(r.sortie).toContain("⚠️ `track.jsCss` grossit de **+5,90 Ko**");
  });
  it("une ligne du tableau que le job ne mesure pas fait échouer le contrôle", () => {
    const mesures = toutesSousLePlafond();
    delete mesures["track.garage"];
    const r = lancer(mesures);
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("`track.garage` est dans budgets.md mais le job ne la mesure pas");
  });
  it("`recaler` : une proposition, jamais une écriture (budgets.md reste tel quel)", () => {
    const avant = readFileSync(join(ROOT, "docs/plateforme/budgets.md"), "utf8");
    const mesures = toutesSousLePlafond();
    mesures["track.garage"] = 1_000; // la mesure a beaucoup baissé
    const r = lancer(mesures, undefined, "recaler");
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("| `track.garage` | à la demande |");
    expect(r.sortie).toContain("rien n'est modifié");
    expect(readFileSync(join(ROOT, "docs/plateforme/budgets.md"), "utf8")).toBe(avant);
  });
});
