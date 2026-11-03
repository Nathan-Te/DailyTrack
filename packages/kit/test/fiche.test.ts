import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ficheDeJeu } from "../src/fiche";

// Ce que chaque jeu donne au kit (lot K3) est ce que dit sa fiche : le préfixe de stockage, le nom, la destination du message. Les constantes sont lues dans le code du jeu (le kit ne les lit pas à
// l'exécution : la fiche des trois jeux pèserait dans le premier chargement).
const ROOT = join(__dirname, "../../..");
const lire = (f: string) => readFileSync(join(ROOT, f), "utf8");

const JEUX = [
  { id: "track", app: "apps/web", stockage: "src/storage.ts", prefixeAttendu: /@cdj\/kit\/stockage/ },
  { id: "jump", app: "apps/jump", stockage: "src/storage.ts", prefixeAttendu: /STORAGE_PREFIX = "jump:"/ },
  { id: "tower", app: "apps/tower", stockage: "src/stockage.ts", prefixeAttendu: /STORAGE_PREFIX = "tower:"/ },
] as const;

describe("le kit et la fiche des jeux", () => {
  for (const j of JEUX) {
    it(`${j.id} : préfixe de stockage, nom et destination du message sont ceux de sa fiche`, () => {
      const fiche = ficheDeJeu(j.id)!;
      expect(fiche, `fiche de ${j.id}`).toBeDefined();
      expect(fiche.prefixe).toBe(j.id === "track" ? "cdj:" : `${j.id}:`);
      expect(fiche.messageOu).toBe(j.id);
      expect(lire(`${j.app}/${j.stockage}`)).toMatch(j.prefixeAttendu);
      expect(lire(`${j.app}/src/interrupteurInit.ts`)).toContain(`brancherInterrupteur("${j.id}", "${fiche.nom.fr}"`);
    });
  }
  it("un jeu inconnu n'a pas de fiche", () => {
    expect(ficheDeJeu("inconnu")).toBeUndefined();
  });
});
