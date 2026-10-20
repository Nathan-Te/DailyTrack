import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { LAYOUT, REDIRECTION_PAGES, REGION, firebaseConfig } from "../../../scripts/site.mjs";

// Lot R4 : la configuration Firebase (firebase.json du dépôt) et la disposition du site.
const template = JSON.parse(readFileSync(join(__dirname, "../../../firebase.json"), "utf8"));
type Header = { source?: string; regex?: string; headers: { key: string; value: string }[] };
const cacheOf = (h: Header) => h.headers.find((x) => x.key === "Cache-Control")?.value;

describe("firebase.json", () => {
  it("renvoie /api/** vers le service Cloud Run de la cible, en europe-west1", () => {
    const prod = firebaseConfig(template, { site: "playdujour-prod", service: "cdj-api" });
    const recette = firebaseConfig(template, { site: "playdujour-recette", service: "cdj-api-recette" });
    expect(REGION).toBe("europe-west1");
    expect(prod.hosting.site).toBe("playdujour-prod");
    expect(prod.hosting.rewrites).toEqual([{ source: "/api/**", run: { serviceId: "cdj-api", region: "europe-west1" } }]);
    expect(recette.hosting.rewrites).toEqual([{ source: "/api/**", run: { serviceId: "cdj-api-recette", region: "europe-west1" } }]);
    // Jamais épinglé à une révision (pinTag est expérimental et suit la dernière révision créée : voir le README du lot R4).
    expect(JSON.stringify(template)).not.toContain("pinTag");
    expect(template.hosting.rewrites[0].run).toEqual({ serviceId: "cdj-api", region: "europe-west1" });
  });

  it("refuse un site ou un service mal formé", () => {
    expect(() => firebaseConfig(template, { site: "", service: "cdj-api" })).toThrow(/site/);
    expect(() => firebaseConfig(template, { site: "playdujour-prod", service: "CDJ API" })).toThrow(/service/);
  });

  it("en-têtes de cache : fichiers à empreinte immuables un an, HTML et JSON revalidés, chemins de dossier (index) revalidés", () => {
    const headers: Header[] = template.hosting.headers;
    const assets = headers.find((h) => h.source === "**/assets/**")!;
    expect(cacheOf(assets)).toBe("public, max-age=31536000, immutable");
    const html = headers.find((h) => h.source?.includes("html"))!;
    expect(cacheOf(html)).toBe("no-cache");
    const dir = headers.find((h) => h.regex)!;
    expect(cacheOf(dir)).toBe("no-cache");
    const re = new RegExp(dir.regex!);
    for (const p of ["/", "/track/", "/jump/", "/track/admin/"]) expect(re.test(p), p).toBe(true);
    for (const p of ["/track/assets/main-abc.js", "/jump/levels/2026-10-16.json", "/api/health"]) expect(re.test(p), p).toBe(false);
    // Aucune règle d'en-tête ne vise /api/** : les règles du serveur (lot P4) ne changent pas.
    expect(headers.every((h) => !(h.source ?? h.regex ?? "").includes("api"))).toBe(true);
  });

  it("/track et /jump sans « / » final sont redirigés (les chemins relatifs des jeux en dépendent)", () => {
    expect(template.hosting.redirects).toEqual([
      { source: "/track", destination: "/track/", type: 301 },
      { source: "/jump", destination: "/jump/", type: 301 },
    ]);
  });
});

describe("disposition du site", () => {
  it("portail à la racine, DailyTrack sous /track/, DailyJump sous /jump/ ; trois pages de redirection sur GitHub Pages", () => {
    expect(LAYOUT).toEqual([
      { from: "apps/portail/dist", to: "" },
      { from: "apps/web/dist", to: "track" },
      { from: "apps/jump/dist", to: "jump" },
    ]);
    expect(REDIRECTION_PAGES).toEqual(["index.html", "jump/index.html", "404.html"]);
  });
});
