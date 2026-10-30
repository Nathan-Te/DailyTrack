import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { LIGNES_TOWER, mesureTower } from "../../../scripts/budgets.mjs";

// Lot R15 (plateforme) : le budget de Tower est gardé comme ceux de Track et de Jump. La limite n'est pas écrite ici : elle est lue dans `docs/plateforme/budgets.md` (les lignes
// `tower.*` du tableau, qui est la référence des budgets) ; la mesure est `mesureTower` de `scripts/budgets.mjs` (la même que `node scripts/budgets.mjs`, sur `apps/tower/dist`).
// Déterministe (la construction), sans navigateur. Premier chargement = la page du jeu (JS + CSS compressés) ; la physique (Rapier et son `.wasm`), le catalogue anglais et les
// polices ont chacun leur ligne.
const budgets = readFileSync(new URL("../../../docs/plateforme/budgets.md", import.meta.url), "utf8");
const limite = (cle: string): number => {
  const m = new RegExp(`^\\| \`${cle.replace(".", "\\.")}\` \\| [^|]+\\| [^|]+\\| ([\\d\\s]+) \\|`, "m").exec(budgets);
  if (!m) throw new Error(`budgets.md n'a pas de ligne « ${cle} »`);
  return Number(m[1]!.replace(/\s/g, ""));
};
const mesure = mesureTower() as { jsCss: number; js: number; css: number; physique: number; physiqueWasm: number; anglais: number; polices: number; fichiers: string[] };

test("budgets.md a une ligne par mesure de Tower", () => {
  expect(LIGNES_TOWER.map(limite).every((n: number) => n > 0)).toBe(true);
});

test("le premier chargement : JS + CSS dans le budget de budgets.md (la page du jeu, sans la physique ni l'anglais)", () => {
  test.info().annotations.push({ type: "mesure", description: `JS ${mesure.js} + CSS ${mesure.css} = ${mesure.jsCss} o (budget ${limite("tower.jsCss")} o) — ${mesure.fichiers.join(", ")}` });
  // Le jeu (three.js compris) est le gros du premier chargement : la mesure l'a bien trouvé, et la physique n'y est pas.
  expect(mesure.js, `fichiers mesurés : ${mesure.fichiers.join(", ")}`).toBeGreaterThan(100_000);
  expect(mesure.fichiers.some((f) => f.startsWith("rapier-") || f.startsWith("catalogue.en-")), "ni la physique ni l'anglais dans le premier chargement").toBe(false);
  expect(mesure.jsCss, `JS ${mesure.js} + CSS ${mesure.css}`).toBeLessThanOrEqual(limite("tower.jsCss"));
});

test("la physique (Rapier et son .wasm) est à la demande et dans son budget", () => {
  test.info().annotations.push({ type: "mesure", description: `physique ${mesure.physique} o dont .wasm ${mesure.physiqueWasm} o (budget ${limite("tower.physique")} o)` });
  expect(mesure.physiqueWasm, "le .wasm est servi comme un fichier, à part du JavaScript").toBeGreaterThan(500_000);
  expect(mesure.physique, "la physique, à la demande").toBeLessThanOrEqual(limite("tower.physique"));
});

test("le catalogue anglais est à part (à la demande) et les polices dans leur budget", () => {
  expect(mesure.anglais, "le catalogue anglais existe, à part").toBeGreaterThan(1_000);
  expect(mesure.anglais, "le catalogue anglais, chargé à la demande").toBeLessThanOrEqual(limite("tower.anglais"));
  expect(mesure.polices, `polices : ${(mesure.polices / 1024).toFixed(1)} ko`).toBeLessThanOrEqual(limite("tower.polices"));
});
