import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_COMMUN } from "../src/catalogue";
import type { Catalogue } from "../src/i18n";
import { SOURCES_DES_CLES, cataloguesApplications } from "./applications";
import { clesLues, estLue } from "./clesUtilisees";

// Lot I6 (nettoyage) : une clé de catalogue que personne ne lit est refusée. Une clé est lue si le code ou le HTML de son application la nomme
// en clair (`t("accueil.titre")`, `lier(el, "pause.mentions")`, `data-t="page.titre"`, une table de clés…) ou par un préfixe calculé
// (`t(\`theme.${code}\`)`, `"erreur." + code`). Les catalogues et les tests ne comptent pas. Une clé gardée pour plus tard s'écrit dans le code
// qui la lira, pas dans le catalogue.
const ROOT = join(__dirname, "../../..");

function fichiers(chemin: string): string[] {
  const abs = join(ROOT, chemin);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return [chemin];
  return readdirSync(abs).flatMap((f) => (["node_modules", "dist", "test", "e2e", "public"].includes(f) ? [] : fichiers(`${chemin}/${f}`)));
}
function sources(dossiers: string[]): string {
  return dossiers
    .flatMap(fichiers)
    .filter((f) => /\.(ts|html)$/.test(f) && !/(^|\/)catalogue[^/]*\.ts$/.test(f))
    .map((f) => readFileSync(join(ROOT, f), "utf8"))
    .join("\n");
}

describe("lot I6 : aucune clé de catalogue jamais lue", () => {
  it("le détecteur : nom en clair, préfixe calculé, et rien d'autre", () => {
    const lues = clesLues(['t("a.b");', "lier(x, 'c.d')", '<p data-t="e.f"></p>', "t(`theme.${x}`)", '"erreur." + code', "// t(\"g.h\") en commentaire compte aussi"].join("\n"));
    for (const cle of ["a.b", "c.d", "e.f", "theme.stade", "erreur.not_found", "g.h"]) expect(estLue(cle, lues), cle).toBe(true);
    for (const cle of ["a.c", "themes.x", "f.e"]) expect(estLue(cle, lues), cle).toBe(false);
  });

  it("le catalogue commun : chaque clé est lue par le socle ou une application", () => {
    const lues = clesLues(sources(SOURCES_DES_CLES.commun!));
    expect(Object.keys(CATALOGUE_COMMUN.fr).filter((c) => !estLue(c, lues))).toEqual([]);
  });

  it("chaque catalogue d'application : chaque clé est lue par son application", async () => {
    const jamais: string[] = [];
    for (const [nom, cat] of (await cataloguesApplications()) as [string, { fr: Catalogue }][]) {
      const app = nom.split(" (")[0]!;
      const dossiers = SOURCES_DES_CLES[app];
      expect(dossiers, `${app} : ajouter ses sources à SOURCES_DES_CLES (test/applications.ts)`).toBeDefined();
      const lues = clesLues(sources(dossiers!));
      for (const cle of Object.keys(cat.fr)) if (!estLue(cle, lues)) jamais.push(`${nom} : ${cle}`);
    }
    expect(jamais).toEqual([]);
  });
});
