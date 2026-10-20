import { join } from "node:path";
import type { Catalogue } from "../src/i18n";

// Les applications passées au socle (lot I1 : le portail et sa vitrine ; lots I4, I5 : ajouter Track et Jump ici, rien d'autre à changer).
// Les modules sont chargés par chemin calculé : ils n'entrent pas dans le projet TypeScript de packages/ui.
const ROOT = join(__dirname, "../../..");

/** Catalogues des applications (fichier, export) : leur parité est vérifiée par catalogues.test.ts. */
export const CATALOGUES: [nom: string, fichier: string, exporte: string][] = [
  ["apps/portail", "apps/portail/src/catalogue.ts", "CATALOGUE_PORTAIL"],
  ["apps/portail (vitrine)", "apps/portail/src/catalogueVitrine.ts", "CATALOGUE_VITRINE"],
  ["apps/portail (démonstration)", "apps/portail/src/catalogueDemo.ts", "CATALOGUE_DEMO"],
];

export async function cataloguesApplications(): Promise<[string, { fr: Catalogue; en: Catalogue }][]> {
  return Promise.all(CATALOGUES.map(async ([nom, fichier, exporte]) => [nom, ((await import(/* @vite-ignore */ join(ROOT, fichier))) as Record<string, { fr: Catalogue; en: Catalogue }>)[exporte]!] as [string, { fr: Catalogue; en: Catalogue }]));
}

/** Les dossiers et fichiers soumis au refus des chaînes écrites en dur (chainesEnDur.test.ts). Lots I4, I5 : ajouter `apps/web/src`, `apps/jump/src`… */
export const DOSSIERS_SANS_CHAINES_EN_DUR: string[] = ["packages/ui/src", "packages/ui/outils", "apps/portail/src", "apps/portail/index.html", "apps/portail/ui", "apps/portail/profil"];

/** Ce qui n'est pas vérifié, chacun avec sa raison. */
export const EXCLUSIONS: Record<string, string> = {
  "apps/portail/mentions-legales": "page statique en français, traduite au lot I6",
};
