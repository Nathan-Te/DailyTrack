import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_COMMUN } from "@cdj/ui";
// @ts-expect-error — modules JavaScript du dépôt (scripts/), sans déclarations
import { JETON_ORIGINE, MANIFESTE, manifeste, origineDuSite, poserOrigine } from "../../../scripts/site.mjs";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { DOSSIER_PARTAGE, ICONES, IMAGES_PARTAGE, POIDS_MAX, SOURCE_IMAGES, taillePng } from "../../../scripts/images-partage.mjs";
import { CATALOGUE_PORTAIL } from "../src/catalogue";
import { CATALOGUE_BASE as BASE_TRACK } from "../../web/src/catalogue.base";
import { CATALOGUE_BASE as BASE_JUMP } from "../../jump/src/catalogue.base";

// Lot I6 (plateforme) : ce qu'on voit quand on colle un lien de playdujour.com (Open Graph, Twitter), les icônes de l'écran d'accueil et le
// manifeste, la page 404. Les images elles-mêmes (tailles, poids, adresses servies) sont vérifiées sur le site assemblé : e2e
// apps/web/e2e/domaine.spec.ts (« lot I6 »).
const ROOT = join(__dirname, "../../..");
const lire = (f: string) => readFileSync(join(ROOT, f), "utf8");

/** Les trois pages qu'on partage : la page source, son chemin public, son image et son catalogue. */
const PAGES = [
  { page: "apps/portail/index.html", chemin: "/", image: "portail", catalogue: CATALOGUE_PORTAIL },
  { page: "apps/web/index.html", chemin: "/track/", image: "track", catalogue: BASE_TRACK },
  { page: "apps/jump/index.html", chemin: "/jump/", image: "jump", catalogue: BASE_JUMP },
] as const;

/** La valeur d'une balise `<meta property|name="…">` (attribut `content`, ou la clé `data-t-content` pré-remplie à la construction). */
function meta(html: string, nom: string): { content?: string; cle?: string } | null {
  const m = new RegExp(`<meta (?:property|name)="${nom.replace(/[.:]/g, "\\$&")}"([^>]*)>`).exec(html);
  if (!m) return null;
  return { content: /\scontent="([^"]*)"/.exec(m[1]!)?.[1], cle: /\sdata-t-content="([^"]*)"/.exec(m[1]!)?.[1] };
}

describe("lot I6 : chaque page partagée déclare ses balises de partage", () => {
  it.each(PAGES)("$page", ({ page, chemin, image, catalogue }) => {
    const html = lire(page);
    expect(meta(html, "og:type")?.content).toBe("website");
    expect(meta(html, "og:site_name")?.cle).toBe("marque.nom");
    expect(CATALOGUE_COMMUN.fr["marque.nom"]).toBe("Du Jour");
    expect(meta(html, "og:locale")?.content).toBe("fr_FR");
    expect(meta(html, "og:locale:alternate")?.content).toBe("en_GB");
    expect(meta(html, "og:title")?.cle).toBe("apercu.titre");
    expect(meta(html, "og:description")?.cle).toBe("apercu.description");
    expect(meta(html, "og:image:alt")?.cle).toBe("apercu.image");
    expect(meta(html, "og:url")?.content).toBe(`${JETON_ORIGINE}${chemin}`);
    expect(meta(html, "og:image")?.content).toBe(`${JETON_ORIGINE}/${DOSSIER_PARTAGE}/${image}.png`);
    expect(meta(html, "og:image:type")?.content).toBe("image/png");
    expect(meta(html, "og:image:width")?.content).toBe("1200");
    expect(meta(html, "og:image:height")?.content).toBe("630");
    expect(meta(html, "twitter:card")?.content).toBe("summary_large_image");
    expect(html).toContain(`<link rel="apple-touch-icon" href="/${DOSSIER_PARTAGE}/icone-180.png" />`);
    expect(html).toContain(`<link rel="manifest" href="/${MANIFESTE}" />`);
    // Les textes : français (lancement) et anglais prêt ; titre court, description lisible dans une carte de messagerie.
    for (const langue of ["fr", "en"] as const) {
      const c = catalogue[langue] as Record<string, string>;
      expect(c["apercu.titre"]!.length, `${page} ${langue}`).toBeLessThanOrEqual(60);
      expect(c["apercu.description"]!.length, `${page} ${langue}`).toBeGreaterThan(40);
      expect(c["apercu.description"]!.length, `${page} ${langue}`).toBeLessThanOrEqual(160);
      expect(c["apercu.image"]!.length, `${page} ${langue}`).toBeGreaterThan(20);
    }
    expect(IMAGES_PARTAGE.map((i: { nom: string }) => i.nom)).toContain(image);
  });

  it("les images : 1200 × 630, au plus 150 ko ; les icônes 180, 192 et 512 ; la source est dans le dépôt, sans ressource extérieure", () => {
    for (const i of IMAGES_PARTAGE) expect([i.largeur, i.hauteur], i.nom).toEqual([1200, 630]);
    expect(ICONES.map((i: { taille: number }) => i.taille)).toEqual([180, 192, 512]);
    expect(POIDS_MAX).toBe(150 * 1024);
    const source = lire(SOURCE_IMAGES);
    expect(source).not.toMatch(/(?:href|src)="https?:/);
    expect(source).not.toMatch(/url\(["']?https?:/);
    for (const i of [...IMAGES_PARTAGE, ...ICONES]) expect(source, i.section).toContain(`id="${i.section.slice(1)}"`);
    // Aucune couleur écrite en dur : les jetons de @cdj/ui seulement (charte § 3).
    expect(source.replace(/<!--[\s\S]*?-->/g, "")).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgba?\(/);
  });

  it("taillePng lit la largeur et la hauteur d'un PNG, refuse le reste", () => {
    const ihdr = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(ihdr);
    ihdr.writeUInt32BE(1200, 16);
    ihdr.writeUInt32BE(630, 20);
    expect(taillePng(ihdr)).toEqual({ largeur: 1200, hauteur: 630 });
    expect(() => taillePng(Buffer.from("GIF89a……………………………………"))).toThrow(/PNG/);
  });
});

describe("lot I6 : adresses absolues qui suivent l'origine du site déployé", () => {
  it("production : toujours https://playdujour.com ; recette par défaut ; un aperçu, son canal ; jamais l'adresse de la production hors production", () => {
    expect(origineDuSite({ production: true })).toBe("https://playdujour.com");
    expect(origineDuSite({ production: true, origine: "https://playdujour.com/" })).toBe("https://playdujour.com");
    expect(() => origineDuSite({ production: true, origine: "https://playdujour-recette--pr-12-abc.web.app" })).toThrow(/production/);
    expect(origineDuSite({})).toBe("https://recette.playdujour.com");
    expect(origineDuSite({ origine: "https://playdujour-recette--pr-12-ab12cd34.web.app" })).toBe("https://playdujour-recette--pr-12-ab12cd34.web.app");
    expect(origineDuSite({ origine: "http://localhost:4177" })).toBe("http://localhost:4177");
    expect(() => origineDuSite({ origine: "https://playdujour.com" })).toThrow(/production/);
    expect(() => origineDuSite({ origine: "https://exemple.org/chemin" })).toThrow(/invalide/);
    expect(() => origineDuSite({ origine: "http://exemple.org" })).toThrow(/invalide/);
  });

  it("le jeton est remplacé partout dans la page", () => {
    const html = `<meta property="og:url" content="${JETON_ORIGINE}/jump/" /><meta property="og:image" content="${JETON_ORIGINE}/partage/jump.png" />`;
    const out = poserOrigine(html, "https://playdujour.com");
    expect(out).not.toContain(JETON_ORIGINE);
    expect(out).toContain('content="https://playdujour.com/jump/"');
    expect(out).toContain('content="https://playdujour.com/partage/jump.png"');
  });

  it("deploy-site.yml passe l'origine du site déployé (le canal d'aperçu est retrouvé ou créé avant la construction) et installe Chromium", () => {
    const yml = lire(".github/workflows/deploy-site.yml");
    expect(yml).toContain('--origine "${{ steps.origine.outputs.origine }}"');
    expect(yml.indexOf("- name: Origine du site")).toBeLessThan(yml.indexOf("- name: Construire les jeux et le site"));
    expect(yml.indexOf("Authentification Google Cloud (clé JSON)")).toBeLessThan(yml.indexOf("- name: Origine du site"));
    expect(yml).toContain('origine="$(node scripts/domaine.mjs adresse "$CIBLE")"');
    expect(yml).toContain("hosting:channel:create \"$CANAL\"");
    expect(yml).toContain("npx playwright install --with-deps chromium");
  });
});

describe("lot I6 : le manifeste « Ajouter à l'écran d'accueil »", () => {
  const jetons = lire("packages/ui/src/jetons.css");
  it("nom Du Jour, couleurs de la charte (jetons), icônes 192 et 512, autonome, départ au portail ; pas de service worker", () => {
    const m = manifeste(jetons);
    expect(m.name).toBe("Du Jour");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#EDE3CF");
    expect(m.theme_color).toBe("#EDE3CF");
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512"]);
    for (const i of m.icons) expect(i.src).toMatch(new RegExp(`^/${DOSSIER_PARTAGE}/icone-(192|512)\\.png$`));
    expect(() => manifeste("")).toThrow(/jeton/);
    for (const f of ["apps/portail/src", "apps/web/src", "apps/jump/src"]) expect(lire(`${f}/../index.html`)).not.toMatch(/serviceWorker/);
  });
});

describe("lot I6 : la page 404", () => {
  const html = lire("apps/portail/404.html");
  it("statique, dans la charte, les deux langues, un lien vers le portail ; chemins absolus", () => {
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/(?:href|src)="https?:/);
    expect(html).toContain("Cette page n'existe pas");
    expect(html).toContain("This page doesn't exist");
    expect(html).toContain('lang="en"');
    expect(html).toContain('<span class="dj-logo">DU JOUR</span>');
    expect(html.match(/href="\/"/g)!.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('<meta name="robots" content="noindex" />');
    const vite = lire("apps/portail/vite.config.ts");
    expect(vite).toContain('introuvable: resolve(import.meta.dirname, "404.html")');
    expect(vite).toContain('ctx.path === "/404.html"');
  });

  it("firebase.json : Hosting sert 404.html pour toute adresse inconnue (aucun renvoi « attrape-tout »), /api/** reste au serveur", () => {
    const config = JSON.parse(lire("firebase.json"));
    expect(config.hosting.rewrites).toEqual([{ source: "/api/**", run: { serviceId: "cdj-api", region: "europe-west1" } }]);
    expect(JSON.stringify(config)).not.toContain("404.html"); // le comportement par défaut de Hosting : la page 404.html à la racine du site
    expect(config.hosting.public).toBe("site");
    expect(lire("scripts/site.mjs")).toContain('existsSync(join(out, "404.html"))');
  });
});
