// Paquet unique du serveur Node (`dist/server.mjs`), celui de l'image Docker. Le client HTTP de libSQL (Turso) est embarqué ; le client
// natif (`file:`, développement et tests) ne l'est pas : il est chargé à la demande (voir src/libsql-open.ts) et n'est pas dans l'image.
import { build } from "esbuild";

await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/server.mjs",
  // Le client HTTP de libSQL tire `ws`, écrit en CommonJS : dans un paquet ESM il lui faut un `require`.
  banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" },
  legalComments: "none",
  logLevel: "warning",
});
