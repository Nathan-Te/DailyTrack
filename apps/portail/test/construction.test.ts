import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { VITRINE, portailEnv } from "../../../scripts/site.mjs";

// Lot I1 : le portail construit pour de vrai (vite build, comme scripts/site.mjs), en production (sans vitrine) et en recette (avec).
//   - budget (seed-phase-3.md § 2, sur le modèle de measure:platform) : premier chargement ≤ 30 ko compressés (gzip) hors polices, polices
//     déclarées par la page ≤ 150 ko, seules Archivo Black et Archivo 400 préchargées ;
//   - la vitrine `/ui/` n'est jamais construite pour la production.
// Les chiffres sont écrits dans la sortie du test (et recopiés dans le README du lot).
export const BUDGET_PREMIER_CHARGEMENT = 30 * 1024;
export const BUDGET_POLICES = 150 * 1024;

const ROOT = join(__dirname, "../../..");
let tmp = "";
const sorties: Record<"production" | "recette", string> = { production: "", recette: "" };

function construire(production: boolean, out: string): void {
  execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--logLevel", "error", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env: portailEnv({ production }), stdio: "pipe" });
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "portail-"));
  sorties.production = join(tmp, "production");
  sorties.recette = join(tmp, "recette");
  construire(true, sorties.production);
  construire(false, sorties.recette);
}, 120_000);
afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Ce que charge la page `index.html` (hors polices) : la page, ses scripts (et leurs imports statiques) et ses feuilles. */
function premierChargement(dir: string): { fichiers: string[]; octets: number; polices: string[] } {
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const vus = new Set<string>();
  const file = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\srel="(?:stylesheet|modulepreload)"[^>]*\shref)="\.\/([^"]+)"/g)].map((m) => m[1]!);
  while (file.length) {
    const f = file.shift()!;
    if (vus.has(f)) continue;
    vus.add(f);
    if (f.endsWith(".js")) for (const m of readFileSync(join(dir, f), "utf8").matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) file.push(join(dirname(f), m[1]!));
  }
  const polices = new Set<string>();
  for (const f of vus) if (f.endsWith(".css")) for (const m of readFileSync(join(dir, f), "utf8").matchAll(/url\(["']?\.?\/?([^)"']+\.woff2)["']?\)/g)) polices.add(join(dirname(f), m[1]!));
  const fichiers = ["index.html", ...vus];
  const octets = fichiers.reduce((s, f) => s + gzipSync(readFileSync(join(dir, f)), { level: 9 }).length, 0);
  return { fichiers, octets, polices: [...polices] };
}

describe("construction du portail", () => {
  it(`budget : premier chargement ≤ ${BUDGET_PREMIER_CHARGEMENT / 1024} ko compressés hors polices, polices ≤ ${BUDGET_POLICES / 1024} ko`, () => {
    const p = premierChargement(sorties.production);
    const polices = p.polices.reduce((s, f) => s + readFileSync(join(sorties.production, f)).length, 0);
    console.log(`portail : ${(p.octets / 1024).toFixed(1)} ko compressés (gzip) — ${p.fichiers.join(", ")} ; polices : ${(polices / 1024).toFixed(1)} ko (${p.polices.length} fichiers)`);
    expect(p.fichiers.some((f) => f.endsWith(".js")) && p.fichiers.some((f) => f.endsWith(".css"))).toBe(true);
    expect(p.octets).toBeLessThanOrEqual(BUDGET_PREMIER_CHARGEMENT);
    expect(p.polices.length).toBeGreaterThan(3);
    expect(polices).toBeLessThanOrEqual(BUDGET_POLICES);
  });

  it("seules Archivo Black et Archivo 400 sont préchargées", () => {
    const html = readFileSync(join(sorties.production, "index.html"), "utf8");
    const pre = [...html.matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="\.\/assets\/([a-z-]+-latin-\d+-normal)-[\w-]+\.woff2"/g)].map((m) => m[1]);
    expect(pre).toEqual(["archivo-black-latin-400-normal", "archivo-latin-400-normal"]);
    for (const m of html.matchAll(/href="\.\/(assets\/[^"]+\.woff2)"/g)) expect(existsSync(join(sorties.production, m[1]!)), m[1]).toBe(true);
  });

  it("textes du HTML pré-remplis en français depuis les catalogues ; aucune ressource extérieure", () => {
    const html = readFileSync(join(sorties.production, "index.html"), "utf8");
    expect(html).toContain("<title data-t=\"portail.titre\">Du Jour</title>");
    expect(html).toContain('content="Du Jour : un jeu par jour, le même pour tous. Track et Jump."');
    expect(html).toContain('href="mentions-legales/" data-t="portail.mentions">Mentions légales et confidentialité</a>');
    expect(html).toContain('name="theme-color" content="#EDE3CF"');
    expect(html).not.toMatch(/data-jeton-|data-precharge-polices|data-icone-du-jour/);
    expect(html).not.toMatch(/(?:src|href)="https?:/);
  });

  it("la page des mentions passe aux jetons du socle sans script ni ressource extérieure (une feuille et des polices du site)", () => {
    const html = readFileSync(join(sorties.production, "mentions-legales/index.html"), "utf8");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<(?:link|img|iframe)\b[^>]*\b(?:href|src)="https?:/i);
    expect(html).toContain('name="theme-color" content="#EDE3CF"');
    const feuilles = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\.\/(assets\/[^"]+\.css)"/g)].map((m) => m[1]!);
    expect(feuilles).toHaveLength(1);
    const css = readFileSync(join(sorties.production, feuilles[0]!), "utf8");
    expect(css).toContain("--dj-creme:");
    for (const m of css.matchAll(/url\(["']?([^)"']+)["']?\)/g)) expect(m[1], m[1]).toMatch(/^(\.\/|\.\.\/|data:)/);
  });

  it("la vitrine /ui/ : construite pour la recette et les aperçus, jamais pour la production", () => {
    expect(VITRINE).toBe("ui");
    expect(existsSync(join(sorties.recette, "ui/index.html"))).toBe(true);
    expect(existsSync(join(sorties.production, "ui"))).toBe(false);
    expect(readFileSync(join(sorties.recette, "ui/index.html"), "utf8")).toContain('<meta name="robots" content="noindex" />');
    // Aucun fichier de la production ne parle de la vitrine (son script n'est pas construit).
    const js = readdirSync(join(sorties.production, "assets")).filter((f) => f.endsWith(".js"));
    expect(js.length).toBeGreaterThan(0);
    for (const f of js) expect(readFileSync(join(sorties.production, "assets", f), "utf8"), f).not.toContain("vitrine");
  });

  it("deploy-site.yml : --production pour la cible production, jamais pour la recette ni un aperçu", () => {
    const yml = readFileSync(join(ROOT, ".github/workflows/deploy-site.yml"), "utf8");
    expect(yml).toContain("node scripts/site.mjs site --sortie site ${{ inputs.cible == 'production' && '--production' || '' }}");
    expect(yml.match(/node scripts\/site\.mjs site\b/g)).toHaveLength(1);
    expect(portailEnv({ production: true }, {}).PORTAIL_VITRINE).toBe("0");
    expect(portailEnv({ production: false }, {}).PORTAIL_VITRINE).toBe("1");
    expect(readFileSync(join(ROOT, "apps/portail/vite.config.ts"), "utf8")).toContain('process.env.PORTAIL_VITRINE !== "0"');
  });
});
