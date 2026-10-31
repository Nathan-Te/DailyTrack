import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

// Les poids de la musique, mesurés sur le code lui-même (esbuild, minifié, gzip : un proxy fidèle, sans construire les jeux) :
//   - le branchement (`branche.ts`), seul code de la musique dans le premier chargement d'un jeu : ≤ 0,5 ko ;
//   - le lecteur et le panneau des réglages, à la demande : la ligne `musique.lecteur` de docs/plateforme/budgets.md.
// Les chiffres mesurés dans les vraies constructions (Vite) sont dans le rapport du lot et dans `node scripts/budgets.mjs`.
const ROOT = join(__dirname, "../../..");
export const BUDGET_BRANCHEMENT = 500;
export const BUDGET_LECTEUR = 8_000;

/** `seul` : ne compter que le fichier de l'entrée (les `import()` deviennent des morceaux à part, comme à la construction d'un jeu). */
async function pese(entree: string, seul = false): Promise<{ js: number; css: number }> {
  const r = await build({ entryPoints: [join(ROOT, entree)], bundle: true, minify: true, format: "esm", target: "es2022", write: false, outdir: "out", loader: { ".css": "css" }, logLevel: "silent", splitting: seul });
  const nom = entree.split("/").pop()!.replace(/\.ts$/, "");
  const taille = (ext: string) => r.outputFiles.filter((f) => f.path.endsWith(ext) && (!seul || f.path.split("/").pop()!.startsWith(nom))).reduce((n, f) => n + gzipSync(f.contents, { level: 9 }).length, 0);
  return { js: taille(".js"), css: taille(".css") };
}

describe("les poids de la musique", () => {
  it("le branchement d'un jeu : au plus 0,5 ko dans le premier chargement", async () => {
    const { js } = await pese("packages/musique/src/branche.ts", true);
    expect(js, `branchement : ${js} o compressés`).toBeLessThanOrEqual(BUDGET_BRANCHEMENT);
  });

  it("le lecteur et le panneau des réglages, à la demande, tiennent dans la ligne musique.lecteur", async () => {
    const lecteur = await pese("packages/musique/src/demarrage.ts");
    const panneau = await pese("packages/ui/src/panneauMusique.ts");
    const total = lecteur.js + lecteur.css + panneau.js + panneau.css;
    expect(total, `lecteur ${lecteur.js} + panneau ${panneau.js} + feuille ${panneau.css} o`).toBeLessThanOrEqual(BUDGET_LECTEUR);
    expect(lecteur.js).toBeGreaterThan(1500); // le test mesure bien quelque chose
  });
});
