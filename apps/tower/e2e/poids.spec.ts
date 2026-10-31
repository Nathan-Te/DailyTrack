import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { LIGNES_TOWER, mesureTower } from "../../../scripts/budgets.mjs";

// Lot R15 (plateforme) : le budget de Tower est gardé comme ceux de Track et de Jump. La limite n'est pas écrite ici : elle est lue dans `docs/plateforme/budgets.md` (les lignes
// `tower.*` du tableau, qui est la référence des budgets). Déterministe (la construction), sans navigateur.
// Lot T4 : **le premier chargement est l'accueil seul** (`tower.jsCss`) et le jeu — la scène (Three.js), la partie, le HUD, l'arrivée — se charge à la demande (`tower.jeu`). Lot TP : les deux lignes
// sont au grand tableau de budgets.md, et la mesure est celle de `mesureTower` (`scripts/budgets.mjs`, d'après le graphe de `apps/tower/tools/mesure.mjs` : le graphe statique de `index.html`, plus le
// contenu du jour que l'accueil charge dès qu'il est dessiné) ; la physique (Rapier et son `.wasm`), le catalogue anglais et les polices ont chacun leur ligne.
const budgets = readFileSync(new URL("../../../docs/plateforme/budgets.md", import.meta.url), "utf8");
const limite = (cle: string): number => {
  const m = new RegExp(`^\\| \`${cle.replace(".", "\\.")}\` \\| [^|]+\\| [^|]+\\| ([\\d\\s]+) \\|`, "m").exec(budgets);
  if (!m) throw new Error(`budgets.md n'a pas de ligne « ${cle} »`);
  return Number(m[1]!.replace(/\s/g, ""));
};
interface Morceau {
  js: number;
  css: number;
  total: number;
  fichiers: string[];
}
const mesureComplete = mesureTower() as { polices: number; detail: Record<string, unknown> };
const mesure = { ...mesureComplete.detail, polices: mesureComplete.polices } as { accueil: Morceau; jeu: Morceau; physique: number; physiqueWasm: number; anglais: number; polices: number };

test("budgets.md a une ligne par mesure de Tower", () => {
  expect(LIGNES_TOWER.map(limite).every((n: number) => n > 0)).toBe(true);
  });

test("le premier chargement est l'accueil seul : ni Three.js, ni la partie, ni la physique, ni l'anglais, et dans le budget de budgets.md", () => {
  const a = mesure.accueil;
  test.info().annotations.push({ type: "mesure", description: `accueil JS ${a.js} + CSS ${a.css} = ${a.total} o (budget ${limite("tower.jsCss")} o) — ${a.fichiers.join(", ")}` });
  expect(a.js, `fichiers mesurés : ${a.fichiers.join(", ")}`).toBeGreaterThan(5_000);
  expect(a.fichiers.some((f) => /^(jeu|partie|rapier|empreinte|catalogue\.en)-/.test(f)), "ni le jeu, ni la partie, ni la physique, ni l'anglais dans le premier chargement").toBe(false);
  expect(a.total, `JS ${a.js} + CSS ${a.css}`).toBeLessThanOrEqual(limite("tower.jsCss"));
  expect(a.total, "l'accueil seul est bien plus léger que le jeu").toBeLessThan(mesure.jeu.total / 2);
});

test("le jeu (la scène avec Three.js, la partie, le HUD, l'arrivée) est à la demande et dans son budget", () => {
  const j = mesure.jeu;
  test.info().annotations.push({ type: "mesure", description: `jeu JS ${j.js} + CSS ${j.css} = ${j.total} o (budget ${limite("tower.jeu")} o) — ${j.fichiers.join(", ")}` });
  expect(j.js, `fichiers mesurés : ${j.fichiers.join(", ")}`).toBeGreaterThan(100_000); // Three.js est le gros du jeu : la mesure l'a bien trouvé
  expect(j.fichiers.some((f) => f.startsWith("rapier-") || f.startsWith("catalogue.en-")), "ni la physique ni l'anglais dans le jeu").toBe(false);
  expect(j.total, `JS ${j.js} + CSS ${j.css}`).toBeLessThanOrEqual(limite("tower.jeu"));
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
