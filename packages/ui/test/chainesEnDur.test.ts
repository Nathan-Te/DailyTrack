import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DOSSIERS_SANS_CHAINES_EN_DUR, EXCLUSIONS } from "./applications";
import { fautesHtml, fautesTs } from "./chainesEnDur";

// Lot I1 (seed-phase-3.md § 5) : aucune chaîne d'interface écrite en dur dans le portail et le socle — tout passe par les catalogues. Prêt
// pour les jeux (I4, I5) : il suffit d'ajouter leurs dossiers à DOSSIERS_SANS_CHAINES_EN_DUR (test/applications.ts).
const ROOT = join(__dirname, "../../..");

function fichiers(chemin: string): string[] {
  const abs = join(ROOT, chemin);
  if (Object.keys(EXCLUSIONS).some((e) => chemin === e || chemin.startsWith(`${e}/`))) return [];
  if (!statSync(abs).isDirectory()) return [chemin];
  return readdirSync(abs).flatMap((f) => (f === "node_modules" || f === "dist" || f === "test" ? [] : fichiers(`${chemin}/${f}`)));
}

describe("refus des chaînes écrites en dur", () => {
  it("le détecteur trouve les chaînes en dur (TypeScript)", () => {
    const code = [
      'el.textContent = "Bonjour";',
      "b.innerHTML = `<b>Salut ${nom}</b>`;",
      'a.setAttribute("aria-label", "Fermer");',
      'x.title = "Aide";',
      'el("p", { texte: "Jouer" });',
      'bouton({ ariaLabel: \'Partager\' });',
      'li.append("Mort");',
      'el("span", { attrs: { "aria-label": "Profil" } });',
      "input.placeholder = 'Ton pseudo';",
      'const t = { titre: "Les jeux" };',
    ].join("\n");
    expect(fautesTs(code).map((f) => f.ligne)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("le détecteur laisse passer les catalogues, le calculé, les nombres, les marques i18n-ok et les commentaires", () => {
    const code = [
      'el.textContent = t.t("portail.titre");',
      "el.textContent = `${a} · ${b}`;",
      'el("span", { texte: "07:42:18" });',
      'logo.textContent = "CDJ2"; // i18n-ok: nom du format de code',
      "// i18n-ok: noms des jeux",
      'el("b", { texte: "Track" });',
      '// el.textContent = "Bonjour";',
      'const fr = { "portail.titre": "Les jeux du jour" };',
      'a.setAttribute("href", "mentions-legales/");',
      'el("a", { attrs: { id: "mentions" } });',
    ].join("\n");
    expect(fautesTs(code)).toEqual([]);
  });

  it("le détecteur trouve les chaînes en dur (HTML) et laisse passer data-t et les marques", () => {
    const html = [
      "<title>Du Jour</title>",
      '<p data-t="portail.pied"></p>',
      '<button aria-label="Fermer"></button>',
      '<meta name="description" content="Un jeu par jour" />',
      '<meta name="viewport" content="width=device-width" />',
      "<script>const x = 'Bonjour';</script>",
      "<!-- Commentaire en français -->",
      "<b>Track</b> <!-- i18n-ok: nom du jeu -->",
      "<span>12 · 3</span>",
      "<p>",
      "  Bonjour",
      "</p>",
    ].join("\n");
    expect(fautesHtml(html).map((f) => f.ligne)).toEqual([1, 3, 4, 11]);
  });

  it("aucune chaîne en dur dans les dossiers vérifiés (packages/ui, apps/portail)", () => {
    for (const d of DOSSIERS_SANS_CHAINES_EN_DUR) expect(existsSync(join(ROOT, d)), d).toBe(true);
    const liste = DOSSIERS_SANS_CHAINES_EN_DUR.flatMap(fichiers).filter((f) => /\.(ts|html)$/.test(f));
    expect(liste.length).toBeGreaterThan(8);
    const fautes = liste.flatMap((f) => {
      const texte = readFileSync(join(ROOT, f), "utf8");
      return (f.endsWith(".html") ? fautesHtml(texte) : fautesTs(texte)).map((x) => `${relative(ROOT, join(ROOT, f))}:${x.ligne} ${x.extrait}`);
    });
    expect(fautes).toEqual([]);
  });

  it("chaque exclusion a sa raison", () => {
    for (const [chemin, raison] of Object.entries(EXCLUSIONS)) {
      expect(existsSync(join(ROOT, chemin)), chemin).toBe(true);
      expect(raison.length, chemin).toBeGreaterThan(10);
    }
  });
});
