import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect } from "vitest";

// Lot M1 : l'aide des tests de « chaque écran déclare son action principale ». Les déclarations (`ECRANS_MANETTE` de chaque application) nomment des éléments par
// leur sélecteur (`#home-daily`, `.dj-bouton--track`…) ; un élément renommé sans que la déclaration suive laisserait un écran sans action principale. Le test relit les
// sources de l'application et exige que chaque identifiant et chaque classe nommés s'y trouvent encore.
const RACINE = resolve(__dirname, "../../..");

function sources(chemin: string): string {
  const absolu = join(RACINE, chemin);
  if (statSync(absolu).isFile()) return readFileSync(absolu, "utf8");
  return readdirSync(absolu)
    .filter((f) => !f.startsWith(".") && f !== "node_modules" && f !== "dist")
    .map((f) => sources(join(chemin, f)))
    .join("\n");
}

/** Les identifiants (`#x`) et classes (`.x`) d'un sélecteur ou d'une liste de sélecteurs. */
export function jetonsDe(selecteur: string): { id: string[]; classe: string[] } {
  return {
    id: [...selecteur.matchAll(/#([\w-]+)/g)].map((m) => m[1]!),
    classe: [...selecteur.matchAll(/\.([\w-]+)/g)].map((m) => m[1]!),
  };
}

/** Chaque écran déclaré a une action principale, et tout ce qu'il nomme existe encore dans les sources des `dossiers`. */
export function verifierEcrans(ecrans: readonly { ecran: string; principal: string; retour?: string }[], dossiers: string[]): void {
  const texte = dossiers.map(sources).join("\n");
  expect(ecrans.length).toBeGreaterThan(0);
  const vus = new Set<string>();
  for (const e of ecrans) {
    expect(e.principal.trim(), `l'écran ${e.ecran} doit déclarer son action principale`).not.toBe("");
    expect(vus.has(e.ecran), `l'écran ${e.ecran} est déclaré deux fois`).toBe(false);
    vus.add(e.ecran);
    for (const champ of [e.ecran, e.principal, e.retour ?? ""]) {
      const { id, classe } = jetonsDe(champ);
      for (const i of id) expect(texte, `#${i} (écran ${e.ecran}) n'existe plus dans ${dossiers.join(", ")}`).toContain(i);
      for (const c of classe) expect(texte, `.${c} (écran ${e.ecran}) n'existe plus dans ${dossiers.join(", ")}`).toContain(c);
    }
  }
}
