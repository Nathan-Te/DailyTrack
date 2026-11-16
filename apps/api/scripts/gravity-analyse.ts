import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { parisDay } from "@cdj/clock";
import { dailyGravity, lireJourFige, seuilsDe } from "@cdj/gravity-sim";
import { ConfigError, assertDatabaseMatches, databaseName } from "../src/config";
import { exigerDistant } from "../src/distant";
import { REQUETE_PARTIES, analyser, analyserJour, formater, partieDe, verifierPlan, type PartieAnalysee } from "./gravity-analyse-calcul";

// `npm run analyser -w @cdj/gravity -- [--cible recette|production] [--du AAAA-MM-JJ] [--au AAAA-MM-JJ] [--parties toutes|classees|apercu] [--sans-seuils] [--json] [--distant]` (lot GR5, **l'outil du calibrage du lot GR6**) :
// lit les parties de Gravity d'une base (celle de la recette, où les parties d'essai et d'aperçu s'enregistrent ; ou la production, en **lecture seule**), **par jour** : l'effectif, la distribution des scores et des distances
// (p10 / médiane / p90 / max), la durée des parties, et la part des joueurs qui atteint chaque médaille — de quoi régler la vitesse, les seuils et la longueur d'un thème (`?vitesse=`, `?plafond=`, `?pente=`, `?gravite=`,
// `?longueur=`, `?medailles=` : `apps/gravity/src/essai.ts`). Les seuils du jour (fichier de jour s'il existe, sinon le robot) sont rappelés ; `--sans-seuils` évite le calcul du robot (≈ 1 s par jour).
//   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=<jeton en LECTURE SEULE> npm run analyser -w @cdj/gravity -- --cible recette --distant --du 2026-11-20
// **Une seule requête**, vérifiée avant d'être lancée (`EXPLAIN QUERY PLAN` : l'index `resultats_jeu_by_rank`, jamais un balayage) ; elle lit une ligne par partie classée des jours demandés (le coût en lectures de Turso : une par
// partie), jamais `replay` ni `player_id`. **Aucun identifiant, pseudo ni adresse ne sort** : seulement des effectifs, des quantiles et des parts. Ne lit que : aucun `INSERT`, `UPDATE`, `DELETE` n'est écrit ici ; le jeton donné
// doit être celui d'un accès en lecture seule. Une base distante exige `--distant` (règle « Turso sobre », lot R14).
const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => {
  const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
  if (i < 0) return undefined;
  return args[i]!.includes("=") ? args[i]!.slice(nom.length + 3) : args[i + 1];
};
const stop = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const cibleDemandee = valeur("cible") ?? "recette";
if (cibleDemandee !== "recette" && cibleDemandee !== "production") stop("--cible recette|production");
const cible: "recette" | "production" = cibleDemandee as "recette" | "production";
const url = process.env.TURSO_DATABASE_URL?.trim() ?? "";
if (!url) stop("TURSO_DATABASE_URL manque (et TURSO_AUTH_TOKEN, en lecture seule, pour une base distante).");
exigerDistant(url, args, "analyser:gravity lit une ligne par partie classée de Gravity (chacune compte dans le quota de lecture de Turso).");
try {
  assertDatabaseMatches(cible, url);
} catch (e) {
  stop(e instanceof ConfigError ? e.message : String(e));
}
const aujourdhui = parisDay(Date.now());
const au = valeur("au") ? parseDay(valeur("au")!) : aujourdhui;
const du = valeur("du") ? parseDay(valeur("du")!) : au === null ? null : au - 13;
if (du === null || au === null || au < du) stop("--du et --au : des dates AAAA-MM-JJ, du ≤ au (par défaut les 14 derniers jours).");
const parties = valeur("parties") ?? "toutes";
if (!["toutes", "classees", "apercu"].includes(parties)) stop("--parties toutes|classees|apercu");

const nom = url.startsWith("file:") ? "@libsql/client" : "@libsql/client/http";
const { createClient } = (await import(/* @vite-ignore */ nom)) as typeof import("@libsql/client/http");
const client = createClient({ url: url.replace(/^libsql:/, "https:"), authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
const params = ["gravity", du!, au!];
try {
  // Le plan d'abord : une requête qui balaierait la table ne part pas.
  const plan = await client.execute({ sql: `EXPLAIN QUERY PLAN ${REQUETE_PARTIES}`, args: params });
  verifierPlan(plan.rows.map((r) => String(r.detail)));
  const res = await client.execute({ sql: REQUETE_PARTIES, args: params });
  const toutes = res.rows.flatMap((r) => {
    const p = partieDe(r as unknown as Record<string, unknown>);
    return p ? [p] : [];
  });
  const gardees: PartieAnalysee[] = toutes.filter((p) => parties === "toutes" || (parties === "apercu" ? p.apercu : !p.apercu));
  const analyses = analyser(gardees);
  const ensemble = gardees.length > 0 ? analyserJour(-1, gardees) : null;
  if (args.includes("--json")) {
    console.log(JSON.stringify({ base: databaseName(url), du: formatDay(du!), au: formatDay(au!), parties, jours: analyses.map((a) => ({ ...a, date: formatDay(a.day) })), ensemble }, null, 2));
  } else {
    console.log(`Gravity — parties du ${formatDay(du!)} au ${formatDay(au!)} (base « ${databaseName(url)} », ${parties === "toutes" ? "toutes les parties" : parties === "apercu" ? "parties d'aperçu seulement" : "parties classées seulement"}) : ${gardees.length} ligne(s) lue(s) pour ${analyses.length} jour(s).`);
    if (gardees.length === 0) console.log("Aucune partie sur cette période.");
    else {
      // Les seuils du jour : le fichier de jour du dépôt s'il existe, sinon le robot (versions des parties du jour) — mémorisés, un jour n'est calculé qu'une fois.
      const dossier = join(dirname(new URL(import.meta.url).pathname), "../../gravity/public/jours");
      const memoire = new Map<number, string | null>();
      const seuils = (jour: number): string | null => {
        if (args.includes("--sans-seuils")) return null;
        if (memoire.has(jour)) return memoire.get(jour)!;
        let texte: string | null = null;
        try {
          const f = join(dossier, `${formatDay(jour)}.json`);
          const fige = existsSync(f) ? lireJourFige(JSON.parse(readFileSync(f, "utf8"))) : null;
          const s = seuilsDe(fige ?? dailyGravity(jour));
          texte = `bronze ${s.bronze} · argent ${s.silver} · or ${s.gold} · Diamant ${s.author}${fige ? " (fichier de jour)" : " (calculés par le robot)"}`;
        } catch {
          texte = null; // une version que ce code ne joue plus : pas de seuils
        }
        memoire.set(jour, texte);
        return texte;
      };
      console.log(formater(analyses, ensemble, formatDay, seuils));
    }
  }
} finally {
  client.close();
}
