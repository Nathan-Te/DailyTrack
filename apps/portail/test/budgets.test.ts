import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { POIDS_MAX } from "../../../scripts/images-partage.mjs";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { LIGNES_TOWER } from "../../../scripts/budgets.mjs";

// Lot I6 (plateforme) : docs/plateforme/budgets.md est la référence des budgets. Ce test vérifie qu'il dit les **mêmes limites** que les tests qui les
// imposent (une limite changée dans un test sans le tableau, ou l'inverse, échoue), et que chaque ligne est cohérente (marge = budget − après).
const ROOT = join(__dirname, "../../..");
const lire = (f: string) => readFileSync(join(ROOT, f), "utf8");
const nombre = (s: string) => Number(s.replace(/[\s ]/g, ""));

const doc = lire("docs/plateforme/budgets.md");
const lignes = new Map(
  [...doc.matchAll(/^\| `([a-z.A-Z0-9]+)` \| [^|]+\| [^|]+\| ([\d\s]+) \| [^|]+\| ([\d\s]+)[^|]*\| ([\d\s]+) \|/gm)].map((m) => [m[1]!, { budget: nombre(m[2]!), apres: nombre(m[3]!), marge: nombre(m[4]!) }]),
);

/** La limite qu'un test impose, lue dans son source. */
function limite(fichier: string, motif: RegExp): number {
  const m = motif.exec(lire(fichier));
  if (!m) throw new Error(`limite introuvable dans ${fichier} : ${motif}`);
  return m.slice(1).reduce((n, x) => n + Number(x.replace(/_/g, "")), 0);
}

const CONSTRUCTION = "apps/portail/test/construction.test.ts";
const PERF = "apps/web/e2e/perf.spec.ts";
const POIDS = "apps/jump/e2e/poids.spec.ts";
// Lot R15 : Tower. Le test de Tower LIT sa limite dans ce tableau (il n'en écrit aucune) : le tableau est la seule source, il n'y a pas de seconde valeur à comparer ;
// ce test vérifie que les lignes sont celles que mesure `mesureTower` (`LIGNES_TOWER`) et que le test de Tower lit bien ce fichier.
const POIDS_TOWER = "apps/tower/e2e/poids.spec.ts";
const ATTENDUS: Record<string, number> = {
  // (lus dans le source : importer construction.test.ts lancerait ses constructions)
  "portail.premier": limite(CONSTRUCTION, /BUDGET_PREMIER_CHARGEMENT = (\d+) \* 1024;/) * 1024,
  "portail.polices": limite(CONSTRUCTION, /BUDGET_POLICES = (\d+) \* 1024;/) * 1024,
  "track.jsCss": limite(PERF, /toBeLessThan\(([\d_]+) \+ ([\d_]+)\)/),
  "track.js": limite(PERF, /JS compressé : \$\{JSON\.stringify\(gz\)\}`\)\.toBeLessThan\(([\d_]+)\)/),
  "track.horsThree": limite(PERF, /"le code du jeu et de la simulation, hors three\.js"\)\.toBeLessThan\(([\d_]+)\)/),
  "track.anglais": limite(PERF, /"le catalogue anglais, chargé à la demande"\)\.toBeLessThan\(([\d_]+)\)/),
  "track.miniatures": limite(PERF, /chargé à la demande"\)\.toBeLessThan\(([\d_]+)\); \/\/ ≈ [\d,]+ ko aujourd'hui \(lot 21/),
  "track.salon": limite(PERF, /\.salon\)\.toBeLessThan\(([\d_]+)\)/),
  "track.admin": limite(PERF, /"page d'admin \(admin-\*\.js\), compressée"\)\.toBeLessThan\(([\d_]+)\)/),
  // Lignes « à la demande » de Track (lots 41, 44 à 47) : hors du premier chargement, chacune gardée par un test de perf.spec.ts.
  "track.decor": limite(PERF, /"décor 3D à la demande, les huit thèmes \(gzip\)"\)\.toBeLessThan\(([\d_]+)\)/),
  "track.palier2": limite(PERF, /"le palier 2, à la demande, compressé"\)\.toBeLessThan\(([\d_]+)\)/),
  "track.vieCiel": limite(PERF, /"la vie et le ciel, à la demande, compressés"\)\.toBeLessThan\(([\d_]+)\)/),
  "track.post": limite(PERF, /"le post-traitement, à la demande, compressé"\)\.toBeLessThan\(([\d_]+)\)/),
  "track.qualiteMesure": limite(PERF, /"la mesure de la règle de qualité, à la demande"\)\.toBeLessThan\(([\d_]+)\)/),
  "track.garage": limite(PERF, /"le Garage, à la demande \(JS\), compressé"\)\.toBeLessThan\(([\d_]+)\)/),
  "track.polices": limite(PERF, /toBeLessThanOrEqual\((\d+) \* 1024\)/) * 1024,
  "jump.jsCss": limite(POIDS, /const AVANT = ([\d_]+) \+ ([\d_]+);/) + 20_000,
  "jump.anglais": limite(POIDS, /"le catalogue anglais, chargé à la demande"\)\.toBeLessThan\(([\d_]+)\)/),
  "jump.polices": limite(POIDS, /toBeLessThanOrEqual\((\d+) \* 1024\)/) * 1024,
  "partage.image": POIDS_MAX,
  ...Object.fromEntries((LIGNES_TOWER as string[]).map((cle) => [cle, lignes.get(cle)?.budget ?? Number.NaN])),
};

describe("lot I6 : docs/plateforme/budgets.md, la référence des budgets", () => {
  it("chaque budget du tableau est la limite que son test impose", () => {
    expect([...lignes.keys()].sort()).toEqual(Object.keys(ATTENDUS).sort());
    for (const [cle, attendu] of Object.entries(ATTENDUS)) expect(lignes.get(cle)?.budget, cle).toBe(attendu);
    expect(lire(POIDS)).toContain("AVANT + 20_000");
    expect(lire(POIDS_TOWER), "le test de Tower lit ses limites dans budgets.md").toContain("docs/plateforme/budgets.md");
    for (const cle of LIGNES_TOWER as string[]) expect(lire(POIDS_TOWER), `${cle} : lue par le test de Tower`).toContain(`"${cle}"`);
  });

  it("chaque ligne est cohérente : marge = budget − après, et l'après tient dans le budget", () => {
    for (const [cle, l] of lignes) {
      expect(l.marge, cle).toBe(l.budget - l.apres);
      expect(l.apres, cle).toBeLessThanOrEqual(l.budget);
    }
  });
});
