import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

// Le premier chargement d'un jeu ne reçoit du kit que `stockage` et `branche` (lot K3) : tout le reste (l'interrupteur, le message en direct, la suite du jour, le cadre des écrans, la fiche) est un `import()`
// ou n'est importé que par des morceaux à la demande. Mesuré sur le code lui-même (esbuild, minifié, gzip), comme `packages/musique/test/poids.test.ts`.
const ROOT = join(__dirname, "../../..");
const BUDGET_BRANCHEMENT = 800; // octets compressés : `branche.ts` + `stockage.ts`

async function fichiersDuPremierChargement(entree: string): Promise<{ chemins: string[]; gz: number }> {
  const r = await build({ entryPoints: [join(ROOT, entree)], bundle: true, minify: true, format: "esm", target: "es2022", write: false, outdir: "out", logLevel: "silent", splitting: true, metafile: true });
  const sortie = Object.entries(r.metafile.outputs).find(([, o]) => o.entryPoint)!;
  const chemins = Object.keys(sortie[1].inputs);
  const octets = r.outputFiles.find((f) => sortie[0].endsWith(f.path.split("/").pop()!))!.contents;
  return { chemins, gz: gzipSync(octets, { level: 9 }).length };
}

describe("ce que le kit met dans le premier chargement", () => {
  it("le branchement n'embarque ni l'interrupteur, ni le message, ni la suite, ni la fiche", async () => {
    const { chemins, gz } = await fichiersDuPremierChargement("packages/kit/src/branche.ts");
    const kit = chemins.filter((c) => c.includes("packages/kit/")).map((c) => c.split("/").pop());
    expect(kit.sort()).toEqual(["branche.ts", "stockage.ts"]);
    expect(gz, `branchement : ${gz} o compressés`).toBeLessThanOrEqual(BUDGET_BRANCHEMENT);
  });
  it("chaque brique à la demande ne se tire pas les autres", async () => {
    for (const [entree, attendu] of [
      ["interrupteur.ts", ["interrupteur.ts"]],
      ["suite.ts", ["suite.ts"]],
      ["message.ts", ["message.ts"]],
      ["ecrans.ts", ["ecrans.ts"]],
    ] as const) {
      const { chemins } = await fichiersDuPremierChargement(`packages/kit/src/${entree}`);
      expect(chemins.filter((c) => c.includes("packages/kit/")).map((c) => c.split("/").pop())).toEqual(attendu);
    }
  });
  it("aucune source du kit ne touche une simulation ni ne nomme un jeu", () => {
    for (const f of ["branche", "stockage", "interrupteur", "suite", "message", "fantome", "partage", "jour", "ecrans"]) {
      const src = readFileSync(join(ROOT, "packages/kit/src", `${f}.ts`), "utf8").split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
      expect(src, `${f}.ts`).not.toMatch(/@cdj\/(sim|jump-sim|tower-sim)\b|apps\/(web|jump|tower)\//);
      expect(src, `${f}.ts`).not.toMatch(/\b(track|jump|tower)\b/i);
    }
  });
});
