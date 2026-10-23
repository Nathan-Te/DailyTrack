// Lot 44 — la ligne « décor 3D à la demande » (docs/plateforme/budgets.md) : le décor du palier 1, chargé à la demande thème par thème (`src/scene/decor.ts`).
// Mesuré **comme un navigateur le charge**, sur le jeu construit (`npm run build`) : pour chaque thème, son morceau (`decor/<thème>.ts`) et, de proche en proche,
// les morceaux qu'il importe statiquement et qui ne sont pas déjà dans le premier chargement (le morceau commun `decor/commun.ts`) ; JS compressé (gzip).
// `total` = la réunion des huit (le commun compté une fois). `node apps/web/e2e/mesureDecor.mjs` l'affiche ; `perf.spec.ts` l'impose (16 ko au plus).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { mesureTrack } from "../../../scripts/budgets.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
export const THEMES_DECOR = ["stade", "rallye", "banquise", "nuit", "campagne", "canyon", "col", "ville"];

export function mesureDecor(dist = resolve(ICI, "../dist/assets")) {
  const premier = new Set(mesureTrack(dist).fichiers);
  const fichiers = readdirSync(dist);
  const gz = (f) => gzipSync(readFileSync(join(dist, f))).length;
  const imports = (f) => [...readFileSync(join(dist, f), "utf8").matchAll(/\bfrom\s*"\.\/([^"]+\.js)"|\bimport\s*"\.\/([^"]+\.js)"/g)].map((m) => m[1] ?? m[2]);
  /** Le morceau d'un thème et ce qu'il tire, hors premier chargement. */
  const graphe = (entree) => {
    const vus = new Set();
    const pile = [entree];
    while (pile.length) {
      const f = pile.pop();
      if (vus.has(f) || premier.has(f)) continue;
      vus.add(f);
      pile.push(...imports(f));
    }
    return vus;
  };
  const parTheme = {};
  const tous = new Set();
  for (const t of THEMES_DECOR) {
    const entree = fichiers.find((f) => f.startsWith(`${t}-`) && f.endsWith(".js"));
    if (!entree) throw new Error(`morceau du décor introuvable : ${t}`);
    const g = graphe(entree);
    for (const f of g) tous.add(f);
    parTheme[t] = { seul: gz(entree), avecCommun: [...g].reduce((n, f) => n + gz(f), 0), fichiers: [...g] };
  }
  const commun = fichiers.find((f) => f.startsWith("commun-") && f.endsWith(".js"));
  return { total: [...tous].reduce((n, f) => n + gz(f), 0), commun: commun ? gz(commun) : 0, parTheme, dansPremier: [...premier].filter((f) => f.startsWith("commun-") || THEMES_DECOR.some((t) => f.startsWith(`${t}-`))) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const m = mesureDecor();
  console.log(JSON.stringify({ total: m.total, commun: m.commun, parTheme: Object.fromEntries(Object.entries(m.parTheme).map(([t, v]) => [t, { seul: v.seul, avecCommun: v.avecCommun }])) }, null, 2));
}
