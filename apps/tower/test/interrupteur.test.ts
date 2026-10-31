import { demarrerInterrupteur } from "@cdj/profile";
import { describe, expect, it, vi } from "vitest";

// Lot TP — l'interrupteur de Tower : `off` = « Bientôt », `preview` = le jeu avec le bandeau seulement avec la clé d'aperçu (rangée dans `cdj:apercu:tower`, retirée de l'adresse), `on` = le jeu.
const CLE = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const memoire = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const etat = (v: string) => async () => new Response(JSON.stringify({ jeux: { tower: v } }));
const lancer = (v: string, search = "", stockage = memoire()) => {
  const remplacer = vi.fn();
  const poser = vi.fn();
  return demarrerInterrupteur({ jeu: "tower", base: "https://x.test", stockage, adresse: { pathname: "/tower/", search, hash: "" }, remplacerAdresse: remplacer, poserCle: poser, fetchImpl: etat(v) }).then((o) => ({ o, remplacer, poser, stockage }));
};

describe("l'interrupteur de Tower", () => {
  it("off : Bientôt, même avec une clé d'aperçu", async () => {
    expect((await lancer("off")).o).toEqual({ vue: "bientot" });
    expect((await lancer("off", `?apercu=${CLE}`)).o).toEqual({ vue: "bientot" });
  });
  it("preview : Bientôt sans clé ; avec le lien d'aperçu, la clé est rangée, retirée de l'adresse et portée par l'en-tête", async () => {
    expect((await lancer("preview")).o).toEqual({ vue: "bientot" });
    const r = await lancer("preview", `?apercu=${CLE}`);
    expect(r.o).toEqual({ vue: "apercu", brouillon: false });
    expect(r.remplacer).toHaveBeenCalledWith("/tower/");
    expect(r.poser).toHaveBeenCalledWith(CLE);
    expect(r.stockage.m.get("cdj:apercu:tower")).toBe(CLE);
  });
  it("on : le jeu", async () => {
    expect((await lancer("on")).o).toEqual({ vue: "ouvert" });
  });
});
