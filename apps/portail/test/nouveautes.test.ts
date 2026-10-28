import { describe, expect, it, vi } from "vitest";
import { NOUVEAUTES_LUES_KEY, dans, lireNouveautes, lireNouveauteLue, nonLue, noterNouveauteLue, pageDe, parDate, type Nouveaute } from "../src/nouveautesDonnees";
import { nouveauteDe } from "../src/jour";
import { CLES_GARDEES } from "@cdj/profile";

// Lot N2 — les nouveautés côté joueur : lecture prudente de la réponse, « lue sur cet appareil » (stockage refusé ou absent : jamais de point, rien ne casse), regroupement par date.

const N = (id: number, date: string, publieLe = id * 1000): Nouveaute => ({ id, date, titre: { fr: `Titre ${id}`, en: `Title ${id}` }, lignes: [{ zone: "track", fr: "a", en: "b" }], publieLe });
const memoire = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } };
};

describe("la page des nouveautés : lecture prudente", () => {
  it("garde ce qui est lisible, écarte le reste, ignore une zone inconnue", () => {
    const p = pageDe({
      nouveautes: [
        { id: 2, date: "2026-10-27", titre: { fr: "A", en: "B" }, lignes: [{ zone: "jump", fr: "x", en: "y" }, { zone: "ailleurs", fr: "z", en: "w" }, { fr: 3 }], publieLe: 5 },
        { id: "3", date: "2026-10-26", titre: { fr: "A", en: "B" }, lignes: [] },
        null,
        { id: 4, date: "2026-10-25", titre: { fr: "C", en: "D" }, lignes: [] },
      ],
      suivante: "2026-10-25.4",
    });
    expect(p!.nouveautes.map((n) => n.id)).toEqual([2, 4]);
    expect(p!.nouveautes[0]!.lignes).toEqual([{ zone: "jump", fr: "x", en: "y" }, { zone: null, fr: "z", en: "w" }]);
    expect(p!.suivante).toBe("2026-10-25.4");
    expect(pageDe({ suivante: null })).toBeNull();
    expect(pageDe(null)).toBeNull();
    expect(pageDe({ nouveautes: [], suivante: 3 })).toEqual({ nouveautes: [], suivante: null });
  });
  it("un texte reste un texte : aucune balise n'est ôtée ni interprétée ici", () => {
    const p = pageDe({ nouveautes: [{ id: 1, date: "2026-10-27", titre: { fr: "<b>x</b>", en: "<i>y</i>" }, lignes: [{ zone: "track", fr: "<img src=x>", en: "ok" }], publieLe: 1 }], suivante: null });
    expect(p!.nouveautes[0]!.titre.fr).toBe("<b>x</b>");
    expect(p!.nouveautes[0]!.lignes[0]!.fr).toBe("<img src=x>");
  });
  it("la langue : le français à défaut d'un anglais", () => {
    expect(dans({ fr: "a", en: "b" }, "en")).toBe("b");
    expect(dans({ fr: "a", en: "" }, "en")).toBe("a");
    expect(dans({ fr: "a", en: "b" }, "fr")).toBe("a");
  });
});

describe("lireNouveautes : `GET /api/portail/nouveautes?avant=`", () => {
  it("la première page sans curseur, la suivante avec ; une panne ou un code du serveur est une valeur", async () => {
    const vues: string[] = [];
    const ok = vi.fn(async (url: string) => (vues.push(url), new Response(JSON.stringify({ nouveautes: [], suivante: null }), { status: 200 })));
    expect(await lireNouveautes(null, ok, "")).toEqual({ page: { nouveautes: [], suivante: null } });
    await lireNouveautes("2026-10-06.12", ok, "");
    expect(vues).toEqual(["/api/portail/nouveautes", "/api/portail/nouveautes?avant=2026-10-06.12"]);
    expect(await lireNouveautes(null, async () => { throw new Error("réseau"); }, "")).toEqual({ erreur: "reseau" });
    expect(await lireNouveautes("x", async () => new Response(JSON.stringify({ error: "invalid_cursor" }), { status: 400 }), "")).toEqual({ erreur: "invalid_cursor" });
    expect(await lireNouveautes(null, async () => new Response(JSON.stringify({ pas: "une page" }), { status: 200 }), "")).toEqual({ erreur: "reseau" });
  });
});

describe("« lue sur cet appareil » : un repère en localStorage, dans un try/catch", () => {
  it("le point s'allume pour une nouveauté plus récente que la dernière lue, et s'éteint quand on la lit ; la lire ne recule jamais", () => {
    const { m, s } = memoire();
    expect(nonLue(N(1, "2026-10-27", 5000), s)).toBe(true);
    noterNouveauteLue(s, 5000);
    expect(m.get(NOUVEAUTES_LUES_KEY)).toBe("5000");
    expect(nonLue(N(1, "2026-10-27", 5000), s)).toBe(false);
    expect(nonLue(N(2, "2026-10-28", 6000), s)).toBe(true);
    noterNouveauteLue(s, 3000);
    expect(lireNouveauteLue(s)).toBe(5000);
  });
  it("sans nouveauté : pas de point ; une nouveauté dépubliée qui laisse une plus ancienne n'en refait pas un", () => {
    const { s } = memoire({ [NOUVEAUTES_LUES_KEY]: "9000" });
    expect(nonLue(null, s)).toBe(false);
    expect(nonLue(N(1, "2026-10-20", 4000), s)).toBe(false);
  });
  it("sans stockage, ou stockage qui refuse : jamais de point, jamais d'exception", () => {
    const casse = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } };
    expect(nonLue(N(1, "2026-10-27"), null)).toBe(false);
    expect(nonLue(N(1, "2026-10-27"), undefined)).toBe(false);
    expect(nonLue(N(1, "2026-10-27"), casse)).toBe(false);
    expect(() => noterNouveauteLue(casse, 1)).not.toThrow();
    expect(() => noterNouveauteLue(null, 1)).not.toThrow();
    expect(lireNouveauteLue(casse)).toBe(0);
    expect(lireNouveauteLue(memoire({ [NOUVEAUTES_LUES_KEY]: "pas un nombre" }).s)).toBe(0);
  });
  it("c'est un réglage gardé : « Nouveau départ » ne le rend pas", () => {
    expect(CLES_GARDEES).toContain(NOUVEAUTES_LUES_KEY);
  });
});

describe("regroupement par date et ligne de l'accueil", () => {
  it("une section par date, dans l'ordre du serveur", () => {
    const g = parDate([N(5, "2026-10-27"), N(4, "2026-10-27"), N(3, "2026-10-25"), N(2, "2026-10-27")]);
    expect(g.map((x) => [x.date, x.nouveautes.map((n) => n.id)])).toEqual([["2026-10-27", [5, 4]], ["2026-10-25", [3]], ["2026-10-27", [2]]]);
    expect(parDate([])).toEqual([]);
  });
  it("la nouveauté de l'accueil est lue avec prudence", () => {
    expect(nouveauteDe({ id: 3, date: "2026-10-27", titre: { fr: "a", en: "b" }, publieLe: 10 })).toEqual({ id: 3, date: "2026-10-27", titre: { fr: "a", en: "b" }, publieLe: 10 });
    expect(nouveauteDe(null)).toBeNull();
    expect(nouveauteDe({ id: 3, date: "2026-10-27", titre: { fr: "a" }, publieLe: 10 })).toBeNull();
    expect(nouveauteDe({ id: 3, date: "2026-10-27", titre: { fr: "a", en: "b" } })).toBeNull();
  });
});
