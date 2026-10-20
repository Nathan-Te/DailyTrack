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
  // Lot I4 : DailyTrack, un catalogue par zone (réunis par apps/web/src/catalogue.ts, qui n'est pas listé : ses clés seraient en double).
  ["apps/web (base)", "apps/web/src/catalogue.base.ts", "CATALOGUE_BASE"],
  ["apps/web (accueil)", "apps/web/src/catalogue.accueil.ts", "CATALOGUE_ACCUEIL"],
  ["apps/web (course)", "apps/web/src/catalogue.course.ts", "CATALOGUE_COURSE"],
  ["apps/web (réglages)", "apps/web/src/catalogue.reglages.ts", "CATALOGUE_REGLAGES"],
  ["apps/web (Salon)", "apps/web/src/catalogue.salon.ts", "CATALOGUE_SALON"],
];

export async function cataloguesApplications(): Promise<[string, { fr: Catalogue; en: Catalogue }][]> {
  return Promise.all(CATALOGUES.map(async ([nom, fichier, exporte]) => [nom, ((await import(/* @vite-ignore */ join(ROOT, fichier))) as Record<string, { fr: Catalogue; en: Catalogue }>)[exporte]!] as [string, { fr: Catalogue; en: Catalogue }]));
}

/** Les dossiers et fichiers soumis au refus des chaînes écrites en dur (chainesEnDur.test.ts). Lots I4, I5 : ajouter `apps/web/src`, `apps/jump/src`… */
export const DOSSIERS_SANS_CHAINES_EN_DUR: string[] = ["packages/ui/src", "packages/ui/outils", "apps/portail/src", "apps/portail/index.html", "apps/portail/ui", "apps/portail/profil", "apps/portail/classement", "apps/web/src", "apps/web/index.html"];

/** Ce qui n'est pas vérifié, chacun avec sa raison. */
export const EXCLUSIONS: Record<string, string> = {
  "apps/portail/mentions-legales": "page statique en français, traduite au lot I6",
  // Lot I4 : les outils internes de Nathan restent en français (hors du périmètre de l'anglais, charte et lot I4 § 1).
  "apps/web/src/tune.ts": "outil de réglage de la conduite (`?debug&tune`) : outil interne, en français",
  "apps/web/src/admin.ts": "page d'administration (`/admin/`) : outil interne, en français",
  "apps/web/src/adminBackend.ts": "page d'administration (`/admin/`) : outil interne, en français",
  "apps/web/src/adminLogic.ts": "page d'administration (`/admin/`) : outil interne, en français",
  "apps/web/src/adminPlan.ts": "planning de l'administration (lot 14) : outil interne, en français",
  "apps/web/src/adminPlanning.ts": "planning de l'administration (lot 14) : outil interne, en français",
  "apps/web/src/circuitStats.ts": "statistiques de circuit de l'administration (lot 14) : outil interne, en français",
  "apps/web/src/verify.ts": "page de vérification des rediffusions (`verify.html`, tests de navigateur) : aucun texte d'interface",
};
