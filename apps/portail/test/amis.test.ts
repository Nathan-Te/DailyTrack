import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";
// @ts-expect-error — modules JavaScript du dépôt (scripts/), sans déclarations
import { JETON_ORIGINE } from "../../../scripts/site.mjs";
import { CATALOGUE_APERCU } from "../src/catalogueApercu";
import { CATALOGUE_PORTAIL } from "../src/catalogue";
import { CATALOGUE_PAGES } from "../src/cataloguePages";

// Lot F2 : la page « Mes amis » (`/amis/`) est une page d'entrée comme les autres (en-tête iOS, aperçu de partage avec l'image du portail, `noindex`, aucune ressource extérieure, aucun script ni
// style en ligne), les textes des pages des amis existent dans les deux langues, et la tuile de l'accueil dit « 3e entre amis » avec les mots des composants des amis.
const ROOT = join(__dirname, "../../..");
const lire = (f: string) => readFileSync(join(ROOT, f), "utf8");
const meta = (html: string, nom: string) => new RegExp(`<meta (?:property|name)="${nom.replace(/[.:]/g, "\\$&")}"([^>]*)>`).exec(html)?.[1] ?? "";

describe("la page /amis/", () => {
  const html = lire("apps/portail/amis/index.html");

  it("balises de partage (l'image du portail), noindex, en-tête iOS et manifeste", () => {
    expect(meta(html, "robots")).toContain('content="noindex"');
    expect(meta(html, "og:title")).toContain('data-t-content="apercu.amis.titre"');
    expect(meta(html, "og:description")).toContain('data-t-content="apercu.amis.description"');
    expect(meta(html, "og:url")).toContain(`content="${JETON_ORIGINE}/amis/"`);
    expect(meta(html, "og:image")).toContain(`content="${JETON_ORIGINE}/partage/portail.png"`);
    expect(meta(html, "og:image:alt")).toContain('data-t-content="apercu.image"');
    expect(meta(html, "twitter:card")).toContain('content="summary_large_image"');
    expect(meta(html, "apple-mobile-web-app-capable")).toContain('content="yes"');
    expect(html).toContain('<link rel="apple-touch-icon" href="/partage/icone-180.png" />');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain("viewport-fit=cover");
    for (const langue of ["fr", "en"] as const) {
      const c = CATALOGUE_APERCU[langue] as Record<string, string>;
      expect(c["apercu.amis.titre"]!.length, langue).toBeLessThanOrEqual(60);
      expect(c["apercu.amis.description"]!.length, langue).toBeGreaterThan(40);
      expect(c["apercu.amis.description"]!.length, langue).toBeLessThanOrEqual(160);
    }
  });

  it("un seul script (le module de la page), aucun script ni style en ligne, aucune ressource extérieure ; la page est dans la construction", () => {
    expect(html.match(/<script\b/g)).toHaveLength(1);
    expect(html).toContain('<script type="module" src="../src/amisPage.ts"></script>');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)|<style\b|\sstyle="|\son[a-z]+=/);
    expect(html).not.toMatch(/(?:src|href)="https?:/);
    expect(lire("apps/portail/vite.config.ts")).toContain('amis: resolve(import.meta.dirname, "amis/index.html")');
  });

  it("le code de la page n'écrit jamais de HTML et ne met aucun identifiant dans une adresse", () => {
    for (const f of ["amisPage.ts", "amisDonnees.ts", "classement.ts", "classementAmis.ts", "vitrineAmis.ts"]) {
      const code = lire(`apps/portail/src/${f}`).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
      expect(code, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/);
    }
    // L'adresse d'invitation porte un jeton caché, pas l'identifiant : la page ne la construit qu'avec le jeton rendu par le serveur.
    const page = lire("apps/portail/src/amisPage.ts");
    expect(page).toContain("adresseInvitation(location.origin, r.data.jeton)");
    expect(page).not.toMatch(/adresseInvitation\([^)]*idCourant/);
  });
});

describe("les textes des pages des amis", () => {
  it("la page, le lien du profil et le message du classement existent en français et en anglais", () => {
    const cles = ["amisPage.titre", "amisPage.description", "amisPage.sansProfil", "amisPage.chargement", "amisPage.invitation.chargement", "amisPage.mes.titre", "amisPage.groupe.titre", "classement.amis.indispo"] as const;
    for (const langue of ["fr", "en"] as const) for (const cle of cles) expect((CATALOGUE_PAGES[langue] as Record<string, string>)[cle], `${langue} ${cle}`).toBeTruthy();
    expect(Object.keys(CATALOGUE_PAGES.fr).sort()).toEqual(Object.keys(CATALOGUE_PAGES.en).sort());
  });

  it("les textes de l'accueil ne sont plus mêlés à ceux des autres pages (le premier chargement est au plafond de son budget)", () => {
    const accueil = Object.keys(CATALOGUE_PORTAIL.fr);
    for (const prefixe of ["profil.", "classement.", "nouveautes.", "amisPage."]) expect(accueil.filter((c) => c.startsWith(prefixe)), prefixe).toEqual([]);
    expect(Object.keys(CATALOGUE_PAGES.fr).filter((c) => accueil.includes(c))).toEqual([]);
  });

  it("« 3e entre amis » de la tuile : les mêmes mots que la phrase des composants des amis", () => {
    for (const langue of ["fr", "en"] as const) {
      expect((CATALOGUE_PORTAIL[langue] as Record<string, string>)["portail.classement.entreAmis"]).toBe((CATALOGUE_AMIS[langue] as Record<string, string>)["amis.rangEntreAmis"]);
    }
  });
});
