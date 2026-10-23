import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { defineConfig, type Plugin } from "vite";

// Lot 38 : la vitrine de la scène (`/track/vitrine/`), un outil interne de la recette et des aperçus. **Une construction à part** (vitrine/construire.mjs,
// après celle du jeu) : son code, sa copie de three.js et ses polices vont dans `dist/vitrine/` et ne touchent jamais au découpage du jeu (une quatrième
// entrée de vite.config.ts aurait fait passer des modules du jeu dans des morceaux partagés, donc changé le premier chargement). Jamais construite en
// production (`VITE_PRODUCTION=1` : construire.mjs s'arrête avant).

/**
 * Le poids de chaque direction (JS compressé, gzip), mesuré à la construction : chaque direction est un morceau chargé à la demande
 * (`import()` dans src/vitrine/vitrine.ts), son poids est celui de son morceau et des morceaux qu'il est seul à demander. Écrit dans
 * `poids.json`, que la page lit.
 */
function poidsDesDirections(): Plugin {
  return {
    name: "poids-des-directions",
    generateBundle(_options, bundle) {
      const morceaux = Object.values(bundle).filter((f) => f.type === "chunk");
      const gz = (code: string) => gzipSync(code).length;
      const poids: Record<string, { fichier: string; octets: number }> = {};
      for (const m of morceaux) {
        const nom = /^assets\/(socle|palier1|finition|matiereDetaillee|matiere|reflets|lumiere3|vie|post)-/.exec(m.fileName)?.[1];
        // Un groupe peut donner plusieurs morceaux : leurs poids s'additionnent.
        const avant = nom ? poids[nom] : undefined;
        if (nom) poids[nom] = { fichier: avant ? `${avant.fichier} + ${m.fileName}` : m.fileName, octets: (avant?.octets ?? 0) + gz(m.code) };
      }
      const three = morceaux.find((m) => m.fileName.startsWith("assets/three-"));
      this.emitFile({ type: "asset", fileName: "poids.json", source: JSON.stringify({ poids, three: three ? gz(three.code) : 0 }, null, 2) });
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL("./vitrine", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [poidsDesDirections()],
  build: {
    target: "es2022",
    outDir: fileURLToPath(new URL("./dist/vitrine", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: "allow-extension",
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        // Le palier 1 et chaque famille de pas dans son propre morceau, le socle commun (route paramétrable, compositeur, outils, décor) dans le sien :
        // le poids de chacun se lit tel quel (lot 44 : les directions du lot 38 sont parties). Sans `includeDependenciesRecursively: false`, le premier groupe emporterait tout ce qu'il importe.
        strictExecutionOrder: true,
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            // Retouche 38b : les passes de post-traitement de three.js vont avec `post.ts` (elles ne sont pas dans le jeu : elles comptent).
            { name: "post", test: /node_modules[\\/]three[\\/]examples[\\/]|src[\\/]scene[\\/]post\.ts$/, priority: 5 },
            { name: "three", test: /node_modules[\\/]three[\\/]/, priority: 4 },
            // Retouche 38b : le palier 1 (compositeur des paliers, direction P) et chaque famille de pas dans leur morceau.
            { name: "palier1", test: /src[\\/]scene[\\/](composerPalier|palier1|memoire)\.ts$/, priority: 3 },
            { name: (id: string) => /src[\\/]scene[\\/](finition|matiereDetaillee|matiere|reflets|lumiere3|vie)\.ts$/.exec(id)?.[1] ?? null, debugName: "pas", priority: 3 },
            { name: "matiere", test: /src[\\/]scene[\\/]bruit\.ts$/, priority: 3 },
            { name: "socle", test: /src[\\/]scene[\\/]/, priority: 2 },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
