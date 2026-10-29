// Lot R12 — la sauvegarde de la base avant chaque mise en production (job `sauvegarde` de « Mettre en production », jamais un test ni un agent) :
//
//   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=<jeton en LECTURE SEULE> npm run base:sauvegarde -w @cdj/api -- --cible production|recette --sortie <fichier.sql.gz>
//
// Lecture seule (`src/sauvegarde.ts` : une transaction de lecture ; le jeton donné par le workflow est un jeton Turso `--read-only`). Le fichier est un texte
// SQL compressé (format de `sqlite3 .dump`) ; il est **restauré dans une base SQLite en mémoire et recompté avant d'être rendu** : une sauvegarde qui ne se
// restaure pas fait échouer le job (et donc la mise en production). **Rien de personnel ne sort** : la sortie ne porte que des noms de tables, des nombres
// de lignes, la taille et l'empreinte du fichier (le dépôt est public, les journaux aussi) ; le fichier va dans le bucket privé, jamais en artefact.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { ConfigError, assertDatabaseMatches, databaseName } from "../src/config";
import { identifiant, sauvegarder, type Lecteur, type ResultatLu } from "../src/sauvegarde";
import { exigerDistant } from "../src/distant";

const args = process.argv.slice(2);
const value = (name: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? "") : "";
};
function stop(message: string): never {
  console.error(`::error title=Sauvegarde impossible::${message}`);
  process.exit(1);
}

const cible = value("cible");
const sortie = value("sortie");
const url = process.env.TURSO_DATABASE_URL?.trim() ?? "";
if (cible !== "production" && cible !== "recette") stop("--cible production|recette");
if (!sortie.endsWith(".sql.gz")) stop("--sortie <fichier>.sql.gz");
if (!url) stop("TURSO_DATABASE_URL manque");
exigerDistant(url, args, "base:sauvegarde lit toutes les lignes de la base (elles comptent toutes dans le quota de lecture de Turso).");
try {
  assertDatabaseMatches(cible, url);
} catch (e) {
  stop(e instanceof ConfigError ? e.message : String(e));
}

// Turso : le client HTTP (comme le serveur) ; `file:` (essai local seulement) : le client natif, chargé à la demande.
const nom = url.startsWith("file:") ? "@libsql/client" : "@libsql/client/http";
const { createClient } = (await import(/* @vite-ignore */ nom)) as typeof import("@libsql/client/http");
const client = createClient({ url: url.replace(/^libsql:/, "https:"), authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
const lire: Lecteur = async (requetes) => (await client.batch(requetes.map((sql) => ({ sql, args: [] })), "read")) as unknown as ResultatLu[];

const debut = Date.now();
const { texte, tables } = await sauvegarder(lire);
client.close();
if (!tables.length) stop("aucune table lue : la base est vide ou illisible");

// La preuve que la sauvegarde se restaure : la rejouer dans SQLite (en mémoire) et recompter chaque table.
const essai = new DatabaseSync(":memory:");
essai.exec(texte);
const ecarts = tables.filter((t) => Number((essai.prepare(`SELECT count(*) AS n FROM ${identifiant(t.nom)}`).get() as { n: number }).n) !== t.lignes);
essai.close();
if (ecarts.length) stop(`la sauvegarde ne se restaure pas à l'identique (tables : ${ecarts.map((t) => t.nom).join(", ")})`);

const gz = gzipSync(texte, { level: 9 });
writeFileSync(sortie, gz);
const empreinte = createHash("sha256").update(gz).digest("hex");
console.log(`### Sauvegarde de la base « ${databaseName(url)} » (${cible}) — lue en ${Math.round((Date.now() - debut) / 100) / 10} s, restaurée et recomptée`);
console.log("");
console.log("| Table | Lignes |");
console.log("|---|---:|");
for (const t of tables) console.log(`| \`${t.nom}\` | ${t.lignes} |`);
console.log("");
console.log(`Fichier : ${(gz.length / 1024).toFixed(1)} ko compressés (${(Buffer.byteLength(texte) / 1024).toFixed(1)} ko de SQL), SHA-256 \`${empreinte.slice(0, 16)}…\`.`);
console.log("Aucune donnée personnelle dans ce résumé : des noms de tables et des nombres de lignes seulement.");
