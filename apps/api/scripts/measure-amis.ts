// `npm run measure:amis -w @cdj/api` (lot F2) : les lignes lues et écrites des routes des amis pour 0, 10 et 100 amis, sur la base de référence (300 joueurs, 14 jours de parties dans chaque jeu).
// **Base libSQL locale seulement** (un fichier temporaire, effacé à la fin) : rien ne vise Turso. Voir scripts/amisCout.ts.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLibsql } from "../src/libsql-open";
import { REFERENCE, construireBaseDeReference } from "./baseDeReference";
import { AMIS_AUJOURDHUI, NOMBRES_D_AMIS, mesurerAmis, tableauAmis } from "./amisCout";

const dossier = mkdtempSync(join(tmpdir(), "cdj-amis-"));
try {
  const db = await openLibsql({ url: `file:${join(dossier, "reference.db")}`, comptage: true });
  const ecrit = await construireBaseDeReference(db, AMIS_AUJOURDHUI);
  console.log(`Base de référence : ${REFERENCE.joueurs} joueurs, ${REFERENCE.jours} jours — ${ecrit.results} résultats Track, ${ecrit.jump_results} Jump, ${ecrit.tower_results} Tower.\n`);
  for (const n of NOMBRES_D_AMIS) console.log(`${tableauAmis(n, await mesurerAmis(db, db.compte, AMIS_AUJOURDHUI, n))}\n`);
  db.close();
} finally {
  rmSync(dossier, { recursive: true, force: true });
}
