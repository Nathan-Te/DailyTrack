import { describe, expect, it } from "vitest";
import { suivantDisponible } from "../src/fantome";

describe("le cycle du bouton fantôme", () => {
  const ordre = ["aucun", "meilleure", "diamant"] as const;
  const dispo = (d: { meilleure: boolean; diamant: boolean }) => (e: (typeof ordre)[number]) => e === "aucun" || d[e as "meilleure" | "diamant"];
  it("tourne dans l'ordre et boucle", () => {
    const ok = dispo({ meilleure: true, diamant: true });
    expect(suivantDisponible(ordre, "aucun", ok, "aucun")).toBe("meilleure");
    expect(suivantDisponible(ordre, "meilleure", ok, "aucun")).toBe("diamant");
    expect(suivantDisponible(ordre, "diamant", ok, "aucun")).toBe("aucun");
  });
  it("saute ce qui n'existe pas (règle G1)", () => {
    expect(suivantDisponible(ordre, "aucun", dispo({ meilleure: false, diamant: true }), "aucun")).toBe("diamant");
    expect(suivantDisponible(ordre, "aucun", dispo({ meilleure: false, diamant: false }), "aucun")).toBe("aucun");
  });
  it("un état qui n'existe plus mène au suivant possible ; rien de possible : le repli", () => {
    expect(suivantDisponible(ordre, "diamant", dispo({ meilleure: true, diamant: false }), "aucun")).toBe("aucun");
    expect(suivantDisponible(["a", "b"] as const, "a", () => false, "b")).toBe("b");
  });
});
