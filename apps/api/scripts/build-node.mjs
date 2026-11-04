// Paquet unique du serveur Node (`dist/server.mjs`), celui de l'image Docker. Le client HTTP de libSQL (Turso) est embarqué ; le client
// natif (`file:`, développement et tests) ne l'est pas : il est chargé à la demande (voir src/libsql-open.ts) et n'est pas dans l'image.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";

// Lot K4e : **les jours figés de chaque jeu viennent des fiches** (`config/jeux/projections/serveur.json`, écrite par `npm run fiches`) : `jours.dossier` de chaque jeu à fichiers (Jump : `apps/jump/public/levels`,
// ses niveaux, lot P0 ; Tower : `apps/tower/public/jours`, lot TP, **preuve comprise** : elle reste dans l'image, le serveur la rejoue, et ne sort jamais ; un jeu neuf : les siens). Un fichier `AAAA-MM-JJ.json`
// par jour, lu tel quel ; le serveur calcule le contenu d'une date par la même règle que le jeu (le fichier figé d'abord). Un dossier qui n'existe pas (aucun jour encore) est vide ; un fichier illisible
// arrête la construction. Le résultat est `{ <jeu>: { <date>: contenu } }`, posé dans le paquet comme `__JOURS_FIGES__` (`server.ts` en tire les options de chaque jeu).
const racine = new URL("../../../", import.meta.url);
const fiches = JSON.parse(readFileSync(new URL("config/jeux/projections/serveur.json", racine), "utf8")).jeux;
const joursFiges = {};
for (const f of fiches) {
  if (!f.jours.dossier) continue;
  const dossier = new URL(`${f.jours.dossier}/`, racine);
  joursFiges[f.id] = {};
  if (!existsSync(dossier)) continue;
  for (const nom of readdirSync(dossier).sort()) {
    const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(nom)?.[1];
    if (date) joursFiges[f.id][date] = JSON.parse(readFileSync(new URL(nom, dossier), "utf8"));
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

// Lot TP : le script du fil de calcul d'un jeu (fiche `rejeu.fil` : Tower), empaqueté à part (un `worker_threads` charge un fichier) et posé à côté de `server.mjs` : le Dockerfile copie les deux.
// Lot K4e : `src/<id>FilTravail.ts` → `dist/<id>-fil.mjs`, pour chaque fiche qui le demande.
for (const f of fiches.filter((x) => x.rejeu.fil)) await build({ ...commun, entryPoints: [`src/${f.id}FilTravail.ts`], outfile: `dist/${f.id}-fil.mjs` });

// Lot D3 (C9) : le fil de calcul des niveaux du jour (Jump, Track), commun à la plateforme : `dist/niveaux-fil.mjs`, posé à côté de `server.mjs`.
await build({ ...commun, entryPoints: ["src/niveauxFilTravail.ts"], outfile: "dist/niveaux-fil.mjs" });

await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/server.mjs",
  // Le client HTTP de libSQL tire `ws`, écrit en CommonJS : dans un paquet ESM il lui faut un `require`.
  banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" },
  define: { __JOURS_FIGES__: JSON.stringify(joursFiges) },
  legalComments: "none",
  logLevel: "warning",
});
