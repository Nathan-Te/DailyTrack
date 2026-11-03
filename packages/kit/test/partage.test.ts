import { describe, expect, it } from "vitest";
import { adresseDePartage, assemblerLigne, ligneParDefaut, textePartage } from "../src/partage";

describe("la ligne à partager (gabarit commun)", () => {
  it("omet les morceaux inconnus et sépare par ' — '", () => {
    expect(assemblerLigne(["Du Jour · Jump #12", "31,402 s", null, "47 💀", undefined, false, "3e/128"])).toBe("Du Jour · Jump #12 — 31,402 s — 47 💀 — 3e/128");
    expect(assemblerLigne([])).toBe("");
  });
  it("le texte complet : la ligne, puis l'adresse", () => {
    expect(textePartage("ligne", "https://playdujour.com/jump/")).toBe("ligne\nhttps://playdujour.com/jump/");
  });
  it("l'adresse : la page sans paramètre, ?seed= seulement pour un autre jour", () => {
    const lieu = { origin: "https://playdujour.com", pathname: "/tower/" };
    expect(adresseDePartage(lieu)).toBe("https://playdujour.com/tower/");
    expect(adresseDePartage(lieu, "2026-11-02", true)).toBe("https://playdujour.com/tower/");
    expect(adresseDePartage(lieu, "2026-11-02", false)).toBe("https://playdujour.com/tower/?seed=2026-11-02");
    expect(adresseDePartage(lieu, undefined, false)).toBe("https://playdujour.com/tower/");
  });
  it("la ligne qu'un jeu neuf obtient par défaut", () => {
    const base = { nom: "Cibles", date: "2026-11-09", score: "17 cibles" };
    expect(ligneParDefaut({ ...base, numero: 12, medaille: "🥇", extras: ["2 💀"], rang: "3e/128" })).toBe("Du Jour · Cibles #12 — 17 cibles — 🥇 — 2 💀 — 3e/128");
    expect(ligneParDefaut({ ...base, numero: 0 })).toBe("Du Jour · Cibles (2026-11-09) — 17 cibles");
    expect(ligneParDefaut({ ...base, numero: null, rang: null })).toBe("Du Jour · Cibles (2026-11-09) — 17 cibles");
  });
});
