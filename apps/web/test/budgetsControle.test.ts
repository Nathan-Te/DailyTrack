import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HORS_JOB, artefactDeMain, choisirArtefact, controler, ecart, fmt, lirePlafonds, nomArtefact, tableau, validerMesures } from "../../../scripts/budgets-controle.mjs";

// Lot R17 (plateforme, CI) : le contrôle des budgets. Logique pure (lecture de budgets.md, comparaison, tableau du résumé, choix de l'artefact de main) et, une fois, le vrai programme :
// un dépassement de 1 ko sur une ligne le fait sortir en erreur en nommant la ligne (le « run d'essai rouge » du rapport, sans construire).
const ROOT = join(__dirname, "../../..");
const doc = readFileSync(join(ROOT, "docs/plateforme/budgets.md"), "utf8");

describe("lecture de docs/plateforme/budgets.md", () => {
  it("lit le plafond de chaque ligne, dans le grand tableau comme dans les petits (tower.decors, tower.habits)", () => {
    const p = lirePlafonds(doc);
    expect(p["track.jsCss"]).toBeGreaterThan(290_000);
    expect(p["portail.premier"]).toBeGreaterThan(30_000);
    expect(p["tower.decors"]).toBeGreaterThan(1_000);
    expect(p["tower.habits"]).toBeGreaterThan(1_000);
    expect(p["partage.image"]).toBe(153_600);
    expect(Object.keys(p).length).toBeGreaterThan(30);
  });
  it("un plafond écrit à la française (espaces ordinaires, insécables, fines) est un nombre", () => {
    expect(lirePlafonds("| `a.b` | X | m | 35 200 | 1 | 2 | 3 | t |\n| `c.d` | X | m | 1 000 000 | 1 |")).toEqual({ "a.b": 35_200, "c.d": 1_000_000 });
  });
});

describe("la comparaison", () => {
  const p = { "x.a": 1000, "x.b": 500, "partage.image": 153_600 };
  it("tout tient : l'égalité tient (« tenir dans le plafond »), la marge est plafond − mesure ; la ligne hors job est ignorée", () => {
    const r = controler(p, { "x.a": 1000, "x.b": 100 });
    expect(r.depassements).toEqual([]);
    expect(r.lignes.map((l: { cle: string; marge: number }) => [l.cle, l.marge])).toEqual([["x.a", 0], ["x.b", 400]]);
    expect(r.sansMesure).toEqual([]);
    expect(Object.keys(HORS_JOB)).toEqual(["partage.image"]);
  });
  it("un octet de trop est un dépassement, nommé avec son excédent", () => {
    const r = controler(p, { "x.a": 1001, "x.b": 100 });
    expect(r.depassements.map((l: { cle: string }) => l.cle)).toEqual(["x.a"]);
    expect(tableau(r)).toContain("**1 o de trop**");
    expect(tableau(r)).toContain("⛔ `x.a`");
  });
  it("une ligne du tableau sans mesure, ou une mesure sans ligne, est une erreur de plomberie (jamais un silence)", () => {
    const r = controler(p, { "x.a": 1, "y.z": 5 });
    expect(r.sansMesure).toEqual(["x.b"]);
    expect(r.sansPlafond).toEqual(["y.z"]);
    expect(tableau(r)).toContain("n'a pas de ligne dans budgets.md");
  });
});

describe("le tableau du résumé", () => {
  const p = { "x.a": 1000, "x.b": 500, "x.c": 90_000 };
  const r = controler(p, { "x.a": 990, "x.b": 480, "x.c": 80_000 });
  it("ligne · plafond · mesure · marge · écart avec main, un écart signé, « nouveau » pour une ligne absente de main", () => {
    const t = tableau(r, { sha: "abcdef1234567", mesures: { "x.a": 900, "x.b": 480 } });
    expect(t).toContain("| ligne | plafond (o) | mesure (o) | marge (o) | écart avec main (o) |");
    expect(t).toContain("| `x.a` | 1 000 | 990 | 10 | +90 |");
    expect(t).toContain("| `x.b` | 500 | 480 | 20 | 0 |");
    expect(t).toContain("| `x.c` | 90 000 | 80 000 | 10 000 | nouveau |");
    expect(t).toContain("`abcdef1`");
    expect(t).toContain("✅ Budgets");
  });
  it("sans mesure de main : la colonne dit « — » et pourquoi ; une mesure plus petite a le vrai signe moins", () => {
    expect(tableau(r)).toContain("aucune mesure de `main` disponible");
    expect(tableau(r)).toContain("| `x.a` | 1 000 | 990 | 10 | — |");
    expect(ecart(90, 100)).toBe("−10");
    expect(fmt(-1234)).toBe("−1 234");
  });
  it("quand la mesure de main n'est pas celle du commit dont part la PR, le tableau le dit", () => {
    expect(tableau(r, { sha: "abcdef1", mesures: {} }, { exact: false })).toContain("pas forcément le commit dont part la PR");
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
  function lancer(mesures: Record<string, number>, main?: Record<string, number>) {
    const dir = mkdtempSync(join(tmpdir(), "budgets-"));
    try {
      writeFileSync(join(dir, "mesures.json"), JSON.stringify({ format: 1, sha: "", mesures }));
      const args = ["scripts/budgets-controle.mjs", "controler", "--mesures", join(dir, "mesures.json")];
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

  it("toutes les lignes sous leur plafond : code 0 et le tableau", () => {
    const r = lancer(toutesSousLePlafond());
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("✅ Budgets");
    expect(r.sortie).toContain("`track.jsCss`");
  });
  it("+ 1 ko sur le socle (les lignes qui le chargent dépassent) : code 1, chaque ligne dépassée est nommée avec son excédent, l'écart avec main est dans le tableau", () => {
    const main = toutesSousLePlafond();
    const mesures = { ...main };
    for (const c of ["track.jsCss", "track.js", "jump.jsCss", "tower.jsCss"]) mesures[c] = p[c]! + 600; // le socle pèse 1 ko de plus : les premiers chargements dépassent
    const r = lancer(mesures, main);
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("⛔ Budgets : 4 ligne(s) dépassent leur plafond");
    expect(r.sortie).toContain("::error title=Budget dépassé::track.jsCss : ");
    expect(r.sortie).toContain("**600 o de trop**");
    expect(r.sortie).toContain("| ⛔ `jump.jsCss` |");
    expect(r.sortie).toContain("+610 |");
    expect(r.sortie).toContain("ne relève jamais un plafond");
  });
  it("une ligne du tableau que le job ne mesure pas fait échouer le contrôle", () => {
    const mesures = toutesSousLePlafond();
    delete mesures["track.garage"];
    const r = lancer(mesures);
    expect(r.code).toBe(1);
    expect(r.sortie).toContain("`track.garage` est dans budgets.md mais le job ne la mesure pas");
  });
});
