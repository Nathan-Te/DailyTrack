// Paquet unique du serveur Node (`dist/server.mjs`), celui de l'image Docker. Le client HTTP de libSQL (Turso) est embarqué ; le client
// natif (`file:`, développement et tests) ne l'est pas : il est chargé à la demande (voir src/libsql-open.ts) et n'est pas dans l'image.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";

// Lot P0 (plateforme) : les niveaux figés de DailyJump (`apps/jump/public/levels/AAAA-MM-JJ.json`) entrent dans le paquet, tels quels : le
// serveur calcule le niveau d'une date par la même règle que le jeu (le fichier figé d'abord). Un fichier illisible arrête la construction.
const levelsDir = new URL("../../jump/public/levels/", import.meta.url);
const frozen = {};
for (const f of readdirSync(levelsDir).sort()) {
  const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
  if (date) frozen[date] = JSON.parse(readFileSync(new URL(f, levelsDir), "utf8"));
}

// Lot TP : les jours de Tower (`apps/tower/public/jours/AAAA-MM-JJ.json`), **preuve comprise** : elle reste dans l'image (le serveur la rejoue, `examinerJourPrepare`) et ne sort jamais (le site publié, lui,
// la perd : `apps/tower/preuves.ts`). Le dossier peut ne pas exister (aucun jour préparé encore) ; un fichier illisible arrête la construction.
const joursTower = new URL("../../tower/public/jours/", import.meta.url);
const towerFrozen = {};
if (existsSync(joursTower)) {
  for (const f of readdirSync(joursTower).sort()) {
    const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
    if (date) towerFrozen[date] = JSON.parse(readFileSync(new URL(f, joursTower), "utf8"));
  }
}

const commun = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "none",
  logLevel: "warning",
};

// Lot TP : le script du fil de calcul de Tower, empaqueté à part (un `worker_threads` charge un fichier) et posé à côté de `server.mjs` : le Dockerfile copie les deux.
await build({ ...commun, entryPoints: ["src/towerFilTravail.ts"], outfile: "dist/tower-fil.mjs" });

await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/server.mjs",
  // Le client HTTP de libSQL tire `ws`, écrit en CommonJS : dans un paquet ESM il lui faut un `require`.
  banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" },
  define: { __JUMP_FROZEN_LEVELS__: JSON.stringify(frozen), __TOWER_JOURS__: JSON.stringify(towerFrozen) },
  legalComments: "none",
  logLevel: "warning",
});
