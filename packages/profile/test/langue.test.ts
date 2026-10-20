import { describe, expect, it } from "vitest";
import { LANGUE_KEY, detecterLangue, ecrireLangue, estLangue, lireLangue } from "../src/langue";

// Lot I1 (plateforme) : la langue commune, détectée à la première visite puis mémorisée pour tout le site.
function memoire(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const refuse = {
  getItem: () => {
    throw new Error("refusé");
  },
  setItem: () => {
    throw new Error("refusé");
  },
};

describe("langue commune de la plateforme", () => {
  it("détection : la première langue du navigateur ; tout ce qui commence par fr → français, sinon anglais", () => {
    expect(detecterLangue(["fr-FR", "en"])).toBe("fr");
    expect(detecterLangue(["fr-CA"])).toBe("fr");
    expect(detecterLangue(["FR"])).toBe("fr");
    expect(detecterLangue(["en-US", "fr"])).toBe("en");
    expect(detecterLangue(["de-DE"])).toBe("en");
    expect(detecterLangue(["", "fr-BE"])).toBe("fr");
    expect(detecterLangue([])).toBe("en");
    expect(detecterLangue(undefined)).toBe("en");
  });

  it("la clé est une clé de la plateforme (cdj:*), commune au portail et aux jeux", () => {
    expect(LANGUE_KEY).toBe("cdj:langue");
    expect(estLangue("fr") && estLangue("en")).toBe(true);
    expect(estLangue("de")).toBe(false);
  });

  it("première visite : la détection, rien n'est écrit ; ensuite le choix mémorisé gagne", () => {
    const s = memoire();
    expect(lireLangue(s, ["en-US"])).toEqual({ langue: "en", choisie: false });
    expect(s.m.size).toBe(0);
    expect(ecrireLangue(s, "fr")).toBe(true);
    expect(s.m.get("cdj:langue")).toBe("fr");
    expect(lireLangue(s, ["en-US"])).toEqual({ langue: "fr", choisie: true });
  });

  it("valeur invalide, stockage absent ou refusé : la détection, sans lever", () => {
    expect(lireLangue(memoire({ "cdj:langue": "de" }), ["fr"])).toEqual({ langue: "fr", choisie: false });
    expect(lireLangue(null, ["fr"])).toEqual({ langue: "fr", choisie: false });
    expect(lireLangue(refuse, ["en"])).toEqual({ langue: "en", choisie: false });
    expect(ecrireLangue(refuse, "en")).toBe(false);
    expect(ecrireLangue(null, "en")).toBe(false);
    expect(ecrireLangue(memoire(), "de" as never)).toBe(false);
  });
});
