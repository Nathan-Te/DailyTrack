import { describe, expect, it, vi } from "vitest";
import { DEPOT_GITHUB, ErreurGithub, compterPrDepuis, estPrRobot, etiquettePrecedente, instantDeEtiquette, instantDeParis, lirePrs, prDe, texteErreurGithub } from "../src/adminGithub";

// Lot N2 — la lecture des PR depuis le navigateur de l'éditeur sur l'API publique de GitHub : l'instant d'une étiquette (heure de Paris), la fenêtre lue, les PR lues, les limites.

const PR = (numero: number, mergedAt: string, extra: Record<string, unknown> = {}) => ({
  number: numero,
  title: `PR ${numero}`,
  html_url: `https://github.com/${DEPOT_GITHUB}/pull/${numero}`,
  body: `## Pour les joueurs\n- [Track] Français ${numero} // English ${numero}`,
  labels: [{ name: "jeu:track" }],
  pull_request: { merged_at: mergedAt },
  ...extra,
});

/** Un faux GitHub : les étiquettes, puis les recherches (une liste par page). */
function faux(o: { etiquettes?: string[]; pages?: unknown[][]; total?: number; statut?: number; entetes?: Record<string, string> } = {}) {
  const vues: string[] = [];
  const f = vi.fn(async (url: string) => {
    vues.push(url);
    if (o.statut) return new Response("{}", { status: o.statut, headers: o.entetes });
    if (url.includes("/git/matching-refs/")) return new Response(JSON.stringify((o.etiquettes ?? []).flatMap((e) => [{ ref: `refs/tags/${e}` }])), { status: 200 });
    const page = Number(new URL(url).searchParams.get("page"));
    const items = (o.pages ?? [[]])[page - 1] ?? [];
    return new Response(JSON.stringify({ total_count: o.total ?? items.length, items }), { status: 200 });
  });
  return { f: f as unknown as typeof fetch, vues };
}

describe("l'étiquette de mise en production : une heure de Paris", () => {
  it("convertit l'heure d'hiver et l'heure d'été en UTC", () => {
    expect(new Date(instantDeEtiquette("prod-2026-10-27-0949")!).toISOString()).toBe("2026-10-27T08:49:00.000Z"); // hiver (UTC+1) depuis le 25/10/2026
    expect(new Date(instantDeEtiquette("prod-2026-10-20-1211")!).toISOString()).toBe("2026-10-20T10:11:00.000Z"); // été (UTC+2)
    expect(new Date(instantDeEtiquette("prod-2026-10-25-0933")!).toISOString()).toBe("2026-10-25T08:33:00.000Z"); // le jour du changement d'heure, après 03 h
    expect(new Date(instantDeParis(2026, 10, 25, 1, 30)).toISOString()).toBe("2026-10-24T23:30:00.000Z"); // avant le changement : encore UTC+2
    expect(instantDeEtiquette("v1.2.3")).toBeNull();
    expect(instantDeEtiquette("prod-2026-10-27")).toBeNull();
  });
  it("l'étiquette d'avant : la plus récente strictement antérieure", () => {
    const tout = ["prod-2026-10-22-1101", "prod-2026-10-20-1211", "prod-2026-10-27-0949", "prod-2026-10-25-0933", "n-importe-quoi"];
    expect(etiquettePrecedente(tout, "prod-2026-10-27-0949")).toBe("prod-2026-10-25-0933");
    expect(etiquettePrecedente(tout, "prod-2026-10-20-1211")).toBeNull();
    expect(etiquettePrecedente([], "prod-2026-10-20-1211")).toBeNull();
  });
});

describe("une PR lue de GitHub", () => {
  it("zone d'après les étiquettes, section « Pour les joueurs » lue, « pas encore en production » après l'étiquette en cours", () => {
    const enProd = Date.parse("2026-10-27T08:49:00Z");
    const avant = prDe(PR(10, "2026-10-26T10:00:00Z"), enProd)!;
    expect(avant).toMatchObject({ numero: 10, zone: "Track", pasEncoreEnProduction: false });
    expect(avant.section.lignes[0]).toMatchObject({ zone: "track", fr: "Français 10", en: "English 10" });
    expect(prDe(PR(11, "2026-10-27T08:49:01Z"), enProd)!.pasEncoreEnProduction).toBe(true);
    expect(prDe(PR(12, "2026-10-27T08:49:00Z"), enProd)!.pasEncoreEnProduction).toBe(false);
    expect(prDe(PR(13, "2026-10-27T10:00:00Z", { labels: [{ name: "jeu:jump" }] }), null)!.zone).toBe("Jump");
    expect(prDe(PR(14, "2026-10-27T10:00:00Z", { labels: [] }), null)!.zone).toBe("Plateforme");
    expect(prDe(PR(15, "2026-10-27T10:00:00Z", { body: null }), null)!.section.presente).toBe(false);
    expect(prDe(PR(16, "2026-10-27T10:00:00Z", { body: "## Pour les joueurs\nrien" }), null)!.section.rien).toBe(true);
  });
  it("ce qui n'est pas une PR fusionnée est écartée ; une adresse étrangère n'est jamais un lien ; les textes restent des textes", () => {
    expect(prDe(null, null)).toBeNull();
    expect(prDe({ number: 1, title: "x" }, null)).toBeNull(); // pas de date de fusion
    expect(prDe(PR(2, "pas une date"), null)).toBeNull();
    const piege = prDe(PR(3, "2026-10-27T10:00:00Z", { title: "<img src=x onerror=alert(1)>", html_url: "https://exemple.test/hameçon" }), null)!;
    expect(piege.titre).toBe("<img src=x onerror=alert(1)>");
    expect(piege.url).toBe(`https://github.com/${DEPOT_GITHUB}/pull/3`);
  });
  it("les PR « robot » de la mise en production ne sont jamais proposées", () => {
    expect(estPrRobot("Jours figés — prod-2026-10-27-0949")).toBe(true);
    expect(estPrRobot("Lot N2 : nouveautés")).toBe(false);
  });
});

describe("lirePrs : la fenêtre, les requêtes, les limites", () => {
  it("lit les PR depuis l'étiquette d'avant : 1 requête d'étiquettes, 1 recherche ; trie de la plus récente ; écarte les robots", async () => {
    const { f, vues } = faux({
      etiquettes: ["prod-2026-10-25-0933", "prod-2026-10-27-0949", "prod-2026-10-20-1211"],
      pages: [[PR(1, "2026-10-26T10:00:00Z"), PR(3, "2026-10-28T08:00:00Z"), PR(2, "2026-10-27T10:00:00Z", { title: "Jours figés — prod-2026-10-27-0949" })]],
    });
    const l = await lirePrs(f, "prod-2026-10-27-0949", Date.parse("2026-10-28T09:00:00Z"));
    expect(l.precedente).toBe("prod-2026-10-25-0933");
    expect(l.prs.map((p) => [p.numero, p.pasEncoreEnProduction])).toEqual([[3, true], [1, false]]);
    expect(vues).toHaveLength(2);
    const q = decodeURIComponent(new URL(vues[1]!).searchParams.get("q")!);
    expect(q).toBe(`repo:${DEPOT_GITHUB} is:pr is:merged merged:>=2026-10-25T08:33:00Z`);
    expect(vues[1]).toMatch(/^https:\/\/api\.github\.com\/search\/issues\?/); // la seule origine appelée
    expect(vues[0]).toMatch(/^https:\/\/api\.github\.com\/repos\//);
  });
  it("sans étiquette connue : les 14 derniers jours, sans requête d'étiquettes", async () => {
    const { f, vues } = faux({ pages: [[PR(1, "2026-10-26T10:00:00Z")]] });
    const l = await lirePrs(f, null, Date.parse("2026-10-28T09:00:00Z"));
    expect(l.prs).toHaveLength(1);
    expect(l.prs[0]!.pasEncoreEnProduction).toBe(false);
    expect(vues).toHaveLength(1);
    expect(decodeURIComponent(vues[0]!)).toContain("merged:>=2026-10-14T09:00:00Z");
  });
  it("une seconde page seulement si la première est pleine ; au plus deux pages, la liste dit qu'elle est tronquée", async () => {
    const plein = (debut: number) => Array.from({ length: 100 }, (_, i) => PR(debut + i, "2026-10-26T10:00:00Z"));
    const { f, vues } = faux({ pages: [plein(1000), plein(2000)] });
    const l = await lirePrs(f, null);
    expect(vues).toHaveLength(2);
    expect(l.prs).toHaveLength(200);
    expect(l.tronquee).toBe(true);
  });
  it("la limite de l'API publique dit à quelle heure ça reprend ; le réseau et un refus ont leur texte", async () => {
    const reprise = Date.parse("2026-10-28T10:30:00Z") / 1000;
    const limite = faux({ statut: 403, entetes: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reprise) } });
    const e = await lirePrs(limite.f, null).catch((x) => x);
    expect(e).toBeInstanceOf(ErreurGithub);
    expect(e).toMatchObject({ genre: "limite", reprise: reprise * 1000 });
    expect(texteErreurGithub(e)).toContain("Limite de l'API publique de GitHub");
    expect(texteErreurGithub(e)).toContain("à la main");
    const coupe = await lirePrs((async () => { throw new TypeError("réseau"); }) as unknown as typeof fetch, null).catch((x) => x);
    expect(coupe).toMatchObject({ genre: "reseau" });
    expect(texteErreurGithub(coupe)).toContain("ne répond pas");
    expect(texteErreurGithub(await lirePrs(faux({ statut: 500 }).f, null).catch((x) => x))).toContain("(500)");
    expect(texteErreurGithub(new Error("autre"))).toBe("Lecture de GitHub impossible.");
  });
});

describe("le nombre de PR depuis la mise en production (tableau de bord)", () => {
  it("une requête ; le total de GitHub moins les PR « robot » lues", async () => {
    const { f, vues } = faux({ total: 7, pages: [[PR(1, "2026-10-28T08:00:00Z"), PR(2, "2026-10-28T09:00:00Z", { title: "Jours figés — prod-2026-10-28-0900" })]] });
    expect(await compterPrDepuis(f, Date.parse("2026-10-27T08:49:00Z"))).toBe(6);
    expect(vues).toHaveLength(1);
    expect(await compterPrDepuis(faux({ total: 0, pages: [[]] }).f, 0)).toBe(0);
  });
});
