import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Plugin } from "vite";

// Lot T3 — **la preuve de l'auteur ne quitte jamais le serveur** (règle R9). Un fichier de jour préparé porte la rediffusion du bot (`preuve`) : hors production (aperçu, local) elle reste, pour
// `?seed=…&bot` ; **la construction de production la retire de tout fichier publié** (`jours/*.json`), puis vérifie qu'il n'en reste aucune. La vérification croisée du site assemblé
// (`scripts/site.mjs`, comme pour Jump) est une zone partagée : elle viendra avec le branchement de la plateforme (lot T4).

/** Le texte d'un fichier de jour sans sa preuve (même mise en forme, une ligne par champ). */
export function retirerPreuve(texte: string): string {
  const o = JSON.parse(texte) as Record<string, unknown>;
  if (!("preuve" in o)) return texte;
  delete o.preuve;
  // Les mêmes lignes que `jsonJourFige` (le fichier canonique) : sauf `preuve`, rien ne change.
  const sans = texte.replace(/,\n {2}"preuve": "[A-Za-z0-9_-]*"\n\}\n$/, "\n}\n");
  if (sans === texte || "preuve" in (JSON.parse(sans) as Record<string, unknown>)) return `${JSON.stringify(o, null, 2)}\n`;
  return sans;
}

/** Retire la preuve de chaque `AAAA-MM-JJ.json` d'un dossier, puis lève si l'une y reste. Rend les fichiers changés. */
export function nettoyerDossier(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  const changes: string[] = [];
  for (const nom of readdirSync(dossier).filter((f) => f.endsWith(".json"))) {
    const texte = readFileSync(`${dossier}/${nom}`, "utf8");
    const propre = retirerPreuve(texte);
    if (propre !== texte) {
      writeFileSync(`${dossier}/${nom}`, propre);
      changes.push(nom);
    }
    if (/"preuve"/.test(readFileSync(`${dossier}/${nom}`, "utf8"))) throw new Error(`${nom} : la preuve de l'auteur est encore dans le fichier publié`);
  }
  return changes;
}

/** Le greffon de construction : en production (`VITE_PRODUCTION=1`) il nettoie `dist/jours/` après l'écriture du bundle. */
export function sansPreuveEnProduction(): Plugin {
  let production = false;
  let sortie = "dist";
  return {
    name: "tower-sans-preuve-en-production",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      production = config.env.VITE_PRODUCTION === "1" || process.env.VITE_PRODUCTION === "1";
      sortie = config.build.outDir.startsWith("/") ? config.build.outDir : `${config.root}/${config.build.outDir}`;
    },
    closeBundle() {
      if (production) nettoyerDossier(`${sortie}/jours`);
    },
  };
}
