// `npm run measure:lignes -w @cdj/api` (lot R14) : les lignes lues et écrites des routes les plus appelées, sur la base de référence (300 joueurs, 14 jours de parties dans chaque
// jeu), à froid (instance neuve) et à chaud. **Base libSQL locale seulement** (un fichier temporaire, effacé à la fin) : rien ne vise Turso. Voir scripts/routesChaudes.ts.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLibsql } from "../src/libsql-open";
import { plusCouteuses } from "../src/comptage";
import { REFERENCE, REFERENCE_AUJOURDHUI, construireBaseDeReference } from "./baseDeReference";
import { mesurerRoutes, tableau } from "./routesChaudes";

const dossier = mkdtempSync(join(tmpdir(), "cdj-lignes-"));
try {
  const db = await openLibsql({ url: `file:${join(dossier, "reference.db")}`, comptage: true });
  const ecrit = await construireBaseDeReference(db, REFERENCE_AUJOURDHUI);
  console.log(`Base de référence : ${REFERENCE.joueurs} joueurs, ${REFERENCE.jours} jours — ${ecrit.results} résultats Track, ${ecrit.jump_results} résultats Jump.\n`);
  const mesures = await mesurerRoutes(db, db.compte, REFERENCE_AUJOURDHUI);
  console.log(tableau(mesures));
  if (process.argv.includes("--detail")) {
    db.compte.remettre();
    console.log("\n(--detail) les requêtes les plus coûteuses de la dernière route :");
    for (const l of plusCouteuses(db.compte.comptage, 5)) console.log(`  ${l.parcourues + l.renvoyees} lues · ${l.sql.slice(0, 120)}`);
  }
  db.close();
} finally {
  rmSync(dossier, { recursive: true, force: true });
}
