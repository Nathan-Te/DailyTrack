import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { fichiersAvecPreuveTower } from "../../../scripts/site.mjs";
import { retirerPreuve } from "../preuves";

// Lot TP — **la preuve de l'auteur d'un jour de Tower ne quitte jamais le serveur** (règle R9) : `scripts/site.mjs --production` revérifie le site assemblé. Ici, sur des jours préparés réels
// (ceux de `packages/tower-sim/test/fixtures/jours/`, avec leur preuve) : un site dont les jours n'ont plus la preuve passe, un site qui la garde (ou la copie ailleurs) est refusé.

const FIXTURES = join(__dirname, "../../../packages/tower-sim/test/fixtures/jours");
const tmp = mkdtempSync(join(tmpdir(), "tower-site-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const jours = readdirSync(FIXTURES).filter((f) => f.endsWith(".json"));
const preuveDe = (f: string): string => (JSON.parse(readFileSync(join(FIXTURES, f), "utf8")) as { preuve?: string }).preuve ?? "";

function site(nom: string, publier: (f: string, texte: string) => string): string {
  const out = join(tmp, nom);
  mkdirSync(join(out, "tower/jours"), { recursive: true });
  for (const f of jours) writeFileSync(join(out, "tower/jours", f), publier(f, readFileSync(join(FIXTURES, f), "utf8")));
  return out;
}

describe("le site de production ne publie aucune preuve de Tower", () => {
  it("les jours préparés du dépôt portent une preuve (le contrôle n'est pas vide)", () => {
    const avecPreuve = jours.filter((f) => preuveDe(f).length > 100);
    expect(avecPreuve.length).toBeGreaterThanOrEqual(3);
  });

  it("des jours publiés sans leur preuve (la construction de production) passent le contrôle", () => {
    const out = site("propre", (_f, t) => retirerPreuve(t));
    expect(fichiersAvecPreuveTower(out, FIXTURES)).toEqual([]);
  });

  it("un jour publié avec sa preuve est refusé, comme une preuve recopiée dans un autre fichier", () => {
    const sale = site("sale", (_f, t) => t);
    expect(fichiersAvecPreuveTower(sale, FIXTURES).length).toBeGreaterThanOrEqual(3);
    const copie = site("copie", (_f, t) => retirerPreuve(t));
    const avecPreuve = jours.find((f) => preuveDe(f).length > 100)!;
    writeFileSync(join(copie, "autre.js"), `export const x = "${preuveDe(avecPreuve)}";`);
    expect(fichiersAvecPreuveTower(copie, FIXTURES)).toEqual(["autre.js"]);
  });

  it("un jour du dépôt absent du site, ou changé, est signalé", () => {
    const out = site("incomplet", (_f, t) => retirerPreuve(t));
    rmSync(join(out, "tower/jours", jours[0]!));
    expect(fichiersAvecPreuveTower(out, FIXTURES)).toEqual([`tower/jours/${jours[0]} (absent)`]);
    cpSync(join(FIXTURES, jours[1]!), join(out, "tower/jours", jours[0]!)); // un autre jour sous ce nom
    expect(fichiersAvecPreuveTower(out, FIXTURES).length).toBeGreaterThan(0);
  });
});
