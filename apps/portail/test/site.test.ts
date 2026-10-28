import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { DOSSIERS_DEMO, LAYOUT, REGION, firebaseConfig, partagerPolices, retirerDemos, robots } from "../../../scripts/site.mjs";

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

  it("lot R7 : en-têtes de sécurité sur tout le site (nosniff, Referrer-Policy, pas d'encadrement, droits du navigateur retirés)", () => {
    const headers: Header[] = template.hosting.headers;
    const all = headers.find((h) => h.source === "**")!;
    const get = (k: string) => all.headers.find((x) => x.key === k)?.value ?? "";
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(get("X-Frame-Options")).toBe("DENY");
    expect(get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(get("Content-Security-Policy")).toContain("object-src 'none'");
    for (const feature of ["camera", "microphone", "geolocation", "payment"]) expect(get("Permissions-Policy")).toContain(`${feature}=()`);
    // la page d'administration de DailyTrack : jamais indexée (en plus de sa balise `noindex`)
    expect(headers.find((h) => h.source === "/track/admin/**")!.headers[0]).toEqual({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
  });

  it("lot N1 : /admin/ est en noindex et a sa propre CSP — le script de Google y est permis, nulle part ailleurs", () => {
    const headers: Header[] = template.hosting.headers;
    const admin = headers.find((h) => h.source === "/admin/**")!;
    expect(admin.headers.find((x) => x.key === "X-Robots-Tag")).toEqual({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    const csp = admin.headers.find((x) => x.key === "Content-Security-Policy")!.value;
    const directives = Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([nom, ...v]) => [nom!, v]));
    // Google Identity Services : exactement ce que Google documente, et rien de plus.
    expect(directives["script-src"]).toEqual(["'self'", "https://accounts.google.com/gsi/client"]);
    expect(directives["frame-src"]).toEqual(["https://accounts.google.com/gsi/"]);
    expect(directives["connect-src"]).toEqual(["'self'", "https://accounts.google.com/gsi/"]);
    expect(directives["style-src"]).toEqual(["'self'", "https://accounts.google.com/gsi/style"]);
    expect(directives["default-src"]).toEqual(["'self'"]);
    expect(directives["frame-ancestors"]).toEqual(["'none'"]);
    expect(directives["object-src"]).toEqual(["'none'"]);
    expect(directives["base-uri"]).toEqual(["'self'"]);
    // Ni script ni style en ligne, ni eval, ni joker.
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*|data:(?!\s*;|$)/);
    expect(directives["img-src"]).toEqual(["'self'", "data:"]);
    // Les autres règles du site n'autorisent aucun domaine de Google, et la page d'administration est la seule à en charger un.
    for (const h of headers.filter((x) => x.source !== "/admin/**")) for (const k of h.headers) expect(k.value, `${h.source ?? h.regex} ${k.key}`).not.toContain("google");
    const pages = ["index.html", "profil/index.html", "classement/index.html", "mentions-legales/index.html", "legal/index.html", "404.html"].map((f) => readFileSync(join(__dirname, "..", f), "utf8"));
    for (const html of pages) expect(html).not.toContain("accounts.google.com");
    const page = readFileSync(join(__dirname, "../admin/index.html"), "utf8");
    expect(page).toContain('content="noindex');
    expect(page).not.toMatch(/<script(?![^>]*\bsrc=)/); // aucun script en ligne
    expect(page).not.toMatch(/<style\b|\sstyle="|\son[a-z]+=/); // aucun style ni gestionnaire en ligne
    expect(page).not.toContain("accounts.google.com"); // le script de Google est chargé par admin.ts, jamais écrit dans la page
  });

  it("lot R7 : la recette et les aperçus s'interdisent aux moteurs de recherche, la production non", () => {
    const find = (c: { hosting: { headers: Header[] } }) => c.hosting.headers.find((h) => h.headers.some((x) => x.key === "X-Robots-Tag") && h.source === "**");
    const recette = firebaseConfig(template, { site: "playdujour-recette", service: "cdj-api-recette", noindex: true });
    const prod = firebaseConfig(template, { site: "playdujour-prod", service: "cdj-api" });
    expect(find(recette)!.headers[0]!.value).toContain("noindex");
    expect(find(prod)).toBeUndefined();
    expect(robots({ production: false })).toContain("Disallow: /\n");
    expect(robots({ production: true })).not.toContain("Disallow");
  });

  it("lot R7 : les données de démonstration (rediffusions des jours à venir) sont retirées du site de production", () => {
    const out = mkdtempSync(join(tmpdir(), "demos-"));
    for (const d of DOSSIERS_DEMO) {
      mkdirSync(join(out, d), { recursive: true });
      writeFileSync(join(out, d, "2026-10-30.json"), "{}");
    }
    mkdirSync(join(out, "jump/levels"), { recursive: true });
    writeFileSync(join(out, "jump/levels/2026-10-26.json"), "{}");
    expect(DOSSIERS_DEMO).toEqual(["track/demo", "jump/demo"]);
    expect(retirerDemos(out)).toEqual(DOSSIERS_DEMO);
    for (const d of DOSSIERS_DEMO) expect(existsSync(join(out, d)), d).toBe(false);
    expect(existsSync(join(out, "jump/levels/2026-10-26.json"))).toBe(true); // les niveaux figés, eux, restent
    expect(retirerDemos(out)).toEqual([]);
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

  it("aucune redirection maison de /track ou /jump : Firebase ajoute lui-même le « / » final des dossiers (trailingSlash non réglé)", () => {
    // Une redirection { source: "/track", destination: "/track/" } bouclait : Hosting fait correspondre /track/ à /track (vu en recette,
    // « redirigé à de trop nombreuses reprises »). Sans `trailingSlash`, Hosting redirige /track vers /track/ (dossier avec index.html).
    expect(template.hosting.redirects ?? []).toEqual([]);
    expect(template.hosting.trailingSlash).toBeUndefined();
    expect(template.hosting.cleanUrls).toBeUndefined();
  });
});

describe("disposition du site", () => {
  it("portail à la racine, DailyTrack sous /track/, DailyJump sous /jump/", () => {
    expect(LAYOUT).toEqual([
      { from: "apps/portail/dist", to: "" },
      { from: "apps/web/dist", to: "track" },
      { from: "apps/jump/dist", to: "jump" },
    ]);
  });
});

// Lot I4 : les polices de Track sont servies par `/assets/…`, le même chemin que celles du portail (un joueur qui vient du portail les a déjà en cache).
describe("polices partagées entre le portail, Track et Jump", () => {
  function site(portail: Record<string, string>, track: Record<string, string>, css: string) {
    const out = mkdtempSync(join(tmpdir(), "site-"));
    mkdirSync(join(out, "assets"), { recursive: true });
    mkdirSync(join(out, "track/assets"), { recursive: true });
    for (const [nom, contenu] of Object.entries(portail)) writeFileSync(join(out, "assets", nom), contenu);
    for (const [nom, contenu] of Object.entries(track)) writeFileSync(join(out, "track/assets", nom), contenu);
    writeFileSync(join(out, "track/assets/main-abc.css"), css);
    return out;
  }
  const css = "@font-face{src:url(/assets/archivo-400-aaa.woff2)}@font-face{src:url(/assets/barlow-600-bbb.woff2)}.x{background:url(./image.png)}";

  it("une police que le portail a aussi n'est servie qu'une fois ; celle qu'il n'a pas rejoint `assets/` du portail", () => {
    const out = site({ "archivo-400-aaa.woff2": "AAA" }, { "archivo-400-aaa.woff2": "AAA", "barlow-600-bbb.woff2": "BBB" }, css);
    expect(partagerPolices(out)).toEqual({ communes: ["archivo-400-aaa.woff2"], ajoutees: ["barlow-600-bbb.woff2"] });
    for (const nom of ["archivo-400-aaa.woff2", "barlow-600-bbb.woff2"]) {
      expect(existsSync(join(out, "assets", nom)), nom).toBe(true);
      expect(existsSync(join(out, "track/assets", nom)), `${nom} : plus de copie sous /track/`).toBe(false);
    }
    expect(readFileSync(join(out, "assets/barlow-600-bbb.woff2"), "utf8")).toBe("BBB");
  });

  it("un même nom avec d'autres octets arrête l'assemblage (le nom porte l'empreinte du contenu)", () => {
    const out = site({ "archivo-400-aaa.woff2": "AAA" }, { "archivo-400-aaa.woff2": "AUTRE", "barlow-600-bbb.woff2": "BBB" }, css);
    expect(() => partagerPolices(out)).toThrow(/différente/);
  });

  it("une police demandée mais absente de la construction de Track arrête l'assemblage", () => {
    const out = site({}, { "archivo-400-aaa.woff2": "AAA" }, css);
    expect(() => partagerPolices(out)).toThrow(/absente/);
  });
  // Lot I5 : Jump aussi. Une police que Track a déjà apportée au portail n'est pas recopiée ; celle que seul Jump demande (Lilita One) rejoint `assets/`.
  it("Jump : ses polices rejoignent les mêmes fichiers que le portail et Track, plus aucune copie sous /jump/", () => {
    const out = site({ "archivo-400-aaa.woff2": "AAA" }, { "archivo-400-aaa.woff2": "AAA", "barlow-600-bbb.woff2": "BBB" }, css);
    mkdirSync(join(out, "jump/assets"), { recursive: true });
    writeFileSync(join(out, "jump/assets/archivo-400-aaa.woff2"), "AAA");
    writeFileSync(join(out, "jump/assets/barlow-600-bbb.woff2"), "BBB");
    writeFileSync(join(out, "jump/assets/lilita-400-ccc.woff2"), "CCC");
    writeFileSync(join(out, "jump/assets/boot-abc.css"), "@font-face{src:url(/assets/archivo-400-aaa.woff2)}@font-face{src:url(/assets/barlow-600-bbb.woff2)}@font-face{src:url(/assets/lilita-400-ccc.woff2)}");
    expect(partagerPolices(out)).toEqual({ communes: ["archivo-400-aaa.woff2"], ajoutees: ["barlow-600-bbb.woff2", "lilita-400-ccc.woff2"] });
    for (const nom of ["archivo-400-aaa.woff2", "barlow-600-bbb.woff2", "lilita-400-ccc.woff2"]) {
      expect(existsSync(join(out, "assets", nom)), nom).toBe(true);
      expect(existsSync(join(out, "jump/assets", nom)), `${nom} : plus de copie sous /jump/`).toBe(false);
    }
  });

  it("Jump : un même nom avec d'autres octets que la police de Track ou du portail arrête l'assemblage", () => {
    const out = site({}, {}, "");
    mkdirSync(join(out, "jump/assets"), { recursive: true });
    writeFileSync(join(out, "assets/lilita-400-ccc.woff2"), "CCC");
    writeFileSync(join(out, "jump/assets/lilita-400-ccc.woff2"), "AUTRE");
    writeFileSync(join(out, "jump/assets/boot-abc.css"), "@font-face{src:url(/assets/lilita-400-ccc.woff2)}");
    expect(() => partagerPolices(out)).toThrow(/différente/);
  });
});
