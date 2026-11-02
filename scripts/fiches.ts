// Lot K1 (plateforme) — `npm run fiches` : lit `config/jeux/<id>.json`, valide chaque fiche (`@cdj/core/fiche`) puis écrit les projections (portail, serveur, ci, jeu) et les vues TypeScript des
// paquets (`packages/core/src/ficheSorties.ts` dit lesquelles). `npm run fiches -- --verifier` n'écrit rien et échoue si un fichier du dépôt n'est pas à jour (le test
// `packages/core/test/fiches.test.ts` fait la même vérification). À lancer après tout changement de fiche. Aucune dépendance, aucun réseau.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { lireFiche, validerEnsemble, type FicheJeu } from "../packages/core/src/fiche";
import { DOSSIER_FICHES, sorties } from "../packages/core/src/ficheSorties";

const RACINE = process.cwd();

/** Les fiches du dépôt, validées, dans l'ordre de leur champ `ordre`. Lève une erreur qui liste tous les problèmes. */
export function lireLesFiches(racine = RACINE): FicheJeu[] {
  const dossier = join(racine, DOSSIER_FICHES);
  const fiches = readdirSync(dossier)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => lireFiche(JSON.parse(readFileSync(join(dossier, f), "utf8")), f.slice(0, -5)));
  const problemes = validerEnsemble(fiches);
  if (problemes.length > 0) throw new Error(`les fiches se contredisent :\n  - ${problemes.join("\n  - ")}`);
  return fiches.sort((a, b) => a.ordre - b.ordre);
}

const verifier = process.argv.includes("--verifier");
if (process.argv[1] && resolve(process.argv[1]).includes("fiches")) {
  const fiches = lireLesFiches();
  const attendu = sorties(fiches);
  const perimes: string[] = [];
  for (const [chemin, contenu] of Object.entries(attendu)) {
    const f = join(RACINE, chemin);
    const actuel = existsSync(f) ? readFileSync(f, "utf8") : null;
    if (actuel === contenu) continue;
    perimes.push(chemin);
    if (!verifier) {
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, contenu);
    }
  }
  if (verifier && perimes.length > 0) {
    console.error(`pas à jour : ${perimes.join(", ")} — lance \`npm run fiches\``);
    process.exit(1);
  }
  console.log(`${fiches.length} fiche(s) (${fiches.map((f) => f.id).join(", ")}) : ${Object.keys(attendu).length} fichier(s) ${verifier ? "à jour" : perimes.length > 0 ? `écrits (${perimes.length} changé(s))` : "déjà à jour"}`);
}
