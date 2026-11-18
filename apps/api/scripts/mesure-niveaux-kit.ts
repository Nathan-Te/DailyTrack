// Lot D4 — `npm run measure:niveaux-kit -w @cdj/api` : ce que coûte le niveau du jour de chaque jeu du kit (les seuils des médailles : le robot du jeu), et ce que le fil de calcul change pour le fil principal.
//   1. pour chaque jeu du registre qui calcule son niveau hors de la plateforme (`GameDefinition.niveauDuJour`) et chacun des trois jours de la mesure : le temps du calcul (dans le fil de calcul), la taille du niveau
//      gardé en base (son JSON) et la preuve que le JSON ne perd rien (`toStrictEqual`) ;
//   2. pendant ce temps, le plus long écart d'une sentinelle de 5 ms dans le fil principal (le retard de la boucle d'événements) : il doit rester petit ;
//   3. le temps de réponse de `GET /api/portail/jour` sur une instance froide dont le niveau de chaque jeu est en cours de calcul (Pinball et Gravity visibles) — l'accueil n'attend plus.
// Le processeur de la machine de mesure n'est pas celui de Cloud Run (3 à 5 fois plus lent, D1) : ce sont les rapports qui comptent. Base libSQL locale (un fichier temporaire), jamais Turso.
import { mkdtempSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { build } from "esbuild";
import { parisDayStart } from "@cdj/clock";
import { daysFromCivil, formatDay } from "@cdj/core";
import { createApi } from "../src/api";
import { ensureSchemaOn } from "../src/db";
import { executeurFil } from "../src/jeux/fil";
import { silentLog } from "../src/log";
import { openLibsql } from "../src/libsql-open";
import { DELAI_NIVEAU_KIT_MS, DELAI_NIVEAU_MS, type DemandeKit, type DemandeNiveau, FILE_NIVEAU_KIT, type ReponseKit, type ReponseNiveau } from "../src/niveauxFil";
import { GAMES } from "../src/registry";
import { FICHES_SERVEUR } from "../src/fiches.generated";

const JOURS = [daysFromCivil(2026, 11, 17), daysFromCivil(2026, 11, 18), daysFromCivil(2026, 11, 19)];
console.log(`Machine : ${cpus()[0]?.model ?? "?"} (${cpus().length} cœurs), Node ${process.version}\n`);

const dossier = mkdtempSync(join(tmpdir(), "cdj-niveaux-kit-"));
const fichierFil = join(dossier, "niveaux-fil.mjs");
await build({
  entryPoints: [new URL("../src/niveauxFilTravail.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: fichierFil,
  banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" },
  logLevel: "silent",
});

const kit = GAMES.filter((g) => g.niveauDuJour);
let pireEcart = 0;
let dernier = performance.now();
const sentinelle = setInterval(() => {
  const t = performance.now();
  pireEcart = Math.max(pireEcart, t - dernier - 5);
  dernier = t;
}, 5);

const seulement = process.env.SCENARIO; // « 1 », « 2 » ou « 3 » : un seul scénario de la partie 2 (profil du fil principal : `node --cpu-prof`)
if (!seulement) {
console.log("1. Le niveau du jour et les seuils de ses médailles de chaque jeu du kit, dans le fil de calcul (le premier calcul du fil charge aussi le script) :");
console.log("| jeu | jour | niveau et seuils, dans le fil | JSON (ce que la base garderait) | JSON sans perte |\n|---|---|---|---|---|");
const fil = executeurFil<DemandeKit, ReponseKit>(fichierFil, { delaiMs: DELAI_NIVEAU_KIT_MS, fileMax: FILE_NIVEAU_KIT });
for (const jeu of kit) {
  for (const jour of JOURS) {
    const t0 = performance.now();
    const garde = await fil.rejouer({ jeu: "kit", code: jeu.code, day: jour, frozen: {} });
    const ms = performance.now() - t0;
    const texte = JSON.stringify(garde);
    const sansPerte = isDeepStrictEqual(JSON.parse(texte), garde);
    console.log(`| ${jeu.code} | ${formatDay(jour)} | ${(ms / 1000).toFixed(1)} s | ${(texte.length / 1024).toFixed(1)} Ko | ${sansPerte ? "oui" : "**NON**"} |`);
  }
}
await fil.fermer?.();
console.log(`\nRetard de la boucle d'événements du fil principal pendant ces calculs : ${pireEcart.toFixed(0)} ms (le plus long écart d'une sentinelle de 5 ms).\n`);
}

console.log("2. L'accueil sur une instance froide, le niveau de chaque jeu du kit en cours de calcul (Pinball, Gravity et les autres visibles ; l'horloge est à 10 h, jour du 18/11) :");
let base = 0;
async function accueil(titre: string, kitAllume: boolean, avecJumpEtTrack: boolean): Promise<void> {
  const db = await openLibsql({ url: `file:${join(dossier, `m${base++}.db`)}` });
  await ensureSchemaOn(db);
  const maintenant = parisDayStart(JOURS[1]!) + 10 * 3_600_000;
  // L'interrupteur à `on` pour les jeux du kit (et, selon le cas, éteint pour Jump et Track : le fil de calcul de D3, qui n'est pas ce qu'on mesure ici) ; une base de mesure, aucune donnée de joueur.
  for (const f of FICHES_SERVEUR) {
    const duKit = kit.some((g) => g.code === f.code);
    const allume = duKit ? kitAllume : avecJumpEtTrack;
    if (duKit || !avecJumpEtTrack) await db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES (?, ?, ?, '[]', ?)", [f.id, allume ? "on" : "off", JOURS[0]! - 1, maintenant]);
  }
  const filKit = executeurFil<DemandeKit, ReponseKit>(fichierFil, { delaiMs: DELAI_NIVEAU_KIT_MS, fileMax: FILE_NIVEAU_KIT });
  const filJumpTrack = executeurFil<DemandeNiveau, ReponseNiveau>(fichierFil, { delaiMs: DELAI_NIVEAU_MS });
  const api = createApi({ db, now: () => maintenant, log: silentLog, niveauxExecuteur: filJumpTrack, niveauxKitExecuteur: filKit, environment: "local", revision: "mesure" });
  const requete = (chemin: string) => api.handle(new Request(`http://api.test${chemin}`), { clientKey: "203.0.113.7" });
  pireEcart = 0;
  console.log(`  ${titre}`);
  for (const chemin of ["/api/portail/jour", "/api/portail/jour", "/api/jeux", "/api/portail/classement"]) {
    const t0 = performance.now();
    const r = await requete(chemin);
    const corps = await r.text();
    const visibles = chemin === "/api/portail/jour" ? (JSON.parse(corps) as { jeux: { jeu: string; seuils: unknown }[] }).jeux.map((j) => `${j.jeu}${j.seuils ? "" : " (sans seuils)"}`).join(", ") : "";
    console.log(`    GET ${chemin} : ${r.status} en ${(performance.now() - t0).toFixed(0)} ms${visibles ? ` — ${visibles}` : ""}`);
  }
  console.log(`    retard de la boucle pendant ces lectures : ${pireEcart.toFixed(0)} ms ; mémoire du processus (fil principal et fils de calcul) : ${(process.memoryUsage().rss / 1e6).toFixed(0)} Mo`);
  await filKit.fermer?.();
  await filJumpTrack.fermer?.();
}
if (!seulement || seulement === "1") await accueil("Track et Jump seuls (référence : le fil de D3, le premier accueil attend leur niveau) :", false, true);
if (!seulement || seulement === "2") await accueil("jeux du kit seuls :", true, false);
if (!seulement || seulement === "3") await accueil("Track, Jump et les jeux du kit :", true, true);
clearInterval(sentinelle);
rmSync(dossier, { recursive: true, force: true });
process.exit(0);
