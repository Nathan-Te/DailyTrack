import { describe, expect, it } from "vitest";
import { THEME_NAMES } from "@cdj/sim";
import { JUMP_THEME_NAMES } from "@cdj/jump-sim";
import { CATALOGUE_PORTAIL } from "../src/catalogue";
import { DEMO_JOUEUR } from "../src/demo";
import { DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM } from "../../api/src/portailDemo";

// Lot I2 : les thèmes du jour traduits par le portail sont exactement ceux des jeux (la liste vient des jeux), chaque thème de Jump a sa
// réplique (une par thème, dans les deux langues : la parité est vérifiée par packages/ui/test/catalogues.test.ts), et le joueur de
// démonstration installé par `/?demo=joueur` est celui que `recette:seed` crée.
const cles = Object.keys(CATALOGUE_PORTAIL.fr);
const suffixes = (prefixe: string) => cles.filter((c) => c.startsWith(prefixe)).map((c) => c.slice(prefixe.length)).sort();

describe("portail : thèmes et répliques", () => {
  it("les thèmes de Track et de Jump sont ceux des jeux, ni plus ni moins", () => {
    expect(suffixes("portail.theme.cdj.")).toEqual([...THEME_NAMES].sort());
    expect(suffixes("portail.theme.jump.")).toEqual([...JUMP_THEME_NAMES].sort());
  });

  it("une réplique de Jump par thème (une seule phrase courte, sans émoji)", () => {
    expect(suffixes("portail.jump.replique.")).toEqual([...JUMP_THEME_NAMES].sort());
    for (const langue of ["fr", "en"] as const) {
      for (const theme of JUMP_THEME_NAMES) {
        const r = CATALOGUE_PORTAIL[langue][`portail.jump.replique.${theme}`] as string;
        expect(r.length, r).toBeLessThanOrEqual(64);
        expect(r, r).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });
});

describe("portail : le joueur de démonstration", () => {
  it("le même identifiant et le même pseudo que celui de recette:seed (apps/api/src/portailDemo.ts)", () => {
    expect(DEMO_JOUEUR).toEqual({ id: DEMO_JOUEUR_ID, nom: DEMO_JOUEUR_NOM });
  });
});
