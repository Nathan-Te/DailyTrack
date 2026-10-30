// Les polices de la charte (docs/plateforme/identite.md, § 4), hébergées sur le site (lot I1 de la plateforme) :
//   node packages/ui/scripts/polices.mjs            → récupère les paquets @fontsource (versions épinglées ci-dessous) avec `npm pack`,
//                                                     copie les fichiers woff2 du sous-ensemble latin et les licences OFL dans packages/ui/polices/,
//                                                     et écrit packages/ui/polices/sources.json (paquet, version, fichier, taille, SHA-256).
// Les fichiers sont gardés dans le dépôt (aucune dépendance npm ajoutée) ; le test packages/ui/test/polices.test.ts vérifie leurs empreintes,
// leur taille et qu'ils couvrent le français (accents, œ, « », espaces insécables). Changer de version = relancer ce script et relire le test.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../polices");

/** Paquet @fontsource, version, fichiers du sous-ensemble latin (graisse-style). */
export const POLICES = [
  { paquet: "archivo-black", famille: "Archivo Black", version: "5.3.0", fichiers: ["400-normal"] },
  { paquet: "archivo", famille: "Archivo", version: "5.3.0", fichiers: ["400-normal", "600-normal", "700-normal"] },
  { paquet: "jetbrains-mono", famille: "JetBrains Mono", version: "5.3.0", fichiers: ["500-normal", "700-normal"] },
  { paquet: "barlow-condensed", famille: "Barlow Condensed", version: "5.3.0", fichiers: ["600-normal", "700-italic", "800-italic"] },
  { paquet: "lilita-one", famille: "Lilita One", version: "5.3.0", fichiers: ["400-normal"] },
  { paquet: "rubik-mono-one", famille: "Rubik Mono One", version: "5.3.0", fichiers: ["400-normal"] },
];

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const tmp = mkdtempSync(join(tmpdir(), "polices-"));
  const sources = [];
  try {
    mkdirSync(OUT, { recursive: true });
    for (const p of POLICES) {
      const spec = `@fontsource/${p.paquet}@${p.version}`;
      const tgz = execFileSync("npm", ["pack", spec, "--silent", "--pack-destination", tmp], { encoding: "utf8" }).trim().split("\n").pop();
      const dir = join(tmp, p.paquet);
      mkdirSync(dir);
      execFileSync("tar", ["xzf", join(tmp, tgz), "-C", dir]);
      copyFileSync(join(dir, "package/LICENSE"), join(OUT, `${p.paquet}-OFL.txt`));
      for (const f of p.fichiers) {
        const name = `${p.paquet}-latin-${f}.woff2`;
        copyFileSync(join(dir, "package/files", name), join(OUT, name));
        const data = readFileSync(join(OUT, name));
        sources.push({ fichier: name, famille: p.famille, paquet: spec, licence: `${p.paquet}-OFL.txt`, octets: data.length, sha256: createHash("sha256").update(data).digest("hex") });
      }
    }
    writeFileSync(join(OUT, "sources.json"), JSON.stringify(sources, null, 2) + "\n");
    console.log(`${sources.length} fichiers de polices dans ${OUT}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
