// `npm run recette:seed` (lot R1 de la plateforme) : remplit la base de RECETTE avec des joueurs fictifs déterministes, pour qu'un aperçu de
// branche ait tout de suite un classement, un fantôme du premier, des archives et des profils à regarder.
//
//   ENVIRONMENT=recette TURSO_DATABASE_URL=libsql://<base>-recette-<compte>.turso.io TURSO_AUTH_TOKEN=… npm run recette:seed [-- --days 7 --today AAAA-MM-JJ]
//
// Garde-fous (`recetteSeedTarget`, apps/api/src/config.ts, testé) : refus hors de ENVIRONMENT=recette, et refus si le nom de la base ne
// contient pas « recette ». Les courses passent par le VRAI `createApi` (rejeu serveur, temps recalculé, mêmes règles de jour ouvert, aucune
// écriture directe en base), avec une horloge injectée réglée sur chaque jour. Pilotes « Démo … » (les noms fictifs de `history:seed`),
// identifiant stable par nom (`fictionalId`) et marqués `demo` : relancer le script ne crée aucun doublon (le meilleur temps est gardé).
// Le Salon n'est pas rempli : une session finie est oubliée (27b), des joueurs fictifs y disparaîtraient en 10 minutes.
// Lot P1 : DailyJump aussi, **sur le jour courant** (celui qu'on teste sur l'aperçu : finir le niveau et voir son rang parmi eux) : les mêmes
// joueurs « Démo … » envoient de vraies rediffusions (perturbations de la preuve de l'auteur), par le même code que la démonstration
// (`seedJumpDays`, apps/api/src/jumpHistory.ts) et le vrai `createApi` (rejeu serveur). Relancer ne crée aucun doublon (meilleur essai gardé).
// Lot I2 : le **joueur de démonstration du portail** (« Démo », `seedPortailDemo`, apps/api/src/portailDemo.ts) : série de 5 jours, 2 journées
// parfaites, aujourd'hui Track fini (or) et Jump en cours ; le portail l'installe par `/?demo=joueur` (recette et aperçus seulement). Effacé
// puis recréé à chaque passage (la série reste de 5 jours). `--demo-seulement` : lui seul (les e2e du portail, en quelques secondes).
import { FICTIONAL_NAMES, Rng, dailyCircuit, formatDay, mixSeed, parseDay, runFictional, styleFor } from "@cdj/sim";
import { parisDay, parisDayStart } from "@cdj/clock";
import { readFileSync, readdirSync } from "node:fs";
import { createApi } from "../src/api";
import { ConfigError, recetteSeedTarget } from "../src/config";
import type { SqlDb } from "../src/db";
import { fictionalId } from "../src/history";
import { seedJumpDays } from "../src/jumpHistory";
import { seedClassementDemo } from "../src/classementDemo";
import { seedPortailDemo } from "../src/portailDemo";
import { openLibsql } from "../src/libsql-open";

const HOUR_MS = 3_600_000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

let target;
try {
  target = recetteSeedTarget(process.env);
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(`recette:seed refusé : ${e.message}`);
    process.exit(1);
  }
  throw e;
}

const demoSeulement = process.argv.includes("--demo-seulement");
const days = Number(arg("days") ?? 7);
if (!Number.isInteger(days) || days < 1 || days > 30) {
  console.error("--days : un nombre de jours entre 1 et 30");
  process.exit(1);
}
// Le dernier jour rempli : aujourd'hui à Paris (l'heure réelle n'est lue qu'ici, puis passée à l'API par une horloge injectée).
const today = arg("today") ? parseDay(arg("today")!) : parisDay(Date.now());
if (today === null || today === undefined) {
  console.error("--today : une date AAAA-MM-JJ");
  process.exit(1);
}

// SQLite (`node:sqlite`, Node 22) n'est chargé que pour une base locale : contre Turso, le script tourne aussi sur un Node plus ancien.
const db: SqlDb = target.kind === "turso" ? await openLibsql({ url: target.url, authToken: target.authToken }) : (await import("../src/node-sqlite")).openSqlite(target.path);
console.log(`base de recette : ${target.kind === "turso" ? new URL(target.url.replace(/^libsql:/, "https:")).hostname : target.path} · ${days} jour(s) jusqu'au ${formatDay(today)}`);
// La base répond-elle ? Sinon chaque course serait refusée (erreur 500) sans dire pourquoi.
try {
  await db.first("SELECT 1 AS ok");
} catch (e) {
  console.error(`recette:seed : la base de recette ne répond pas (adresse ou jeton faux ?) — ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

// Les niveaux figés de DailyJump du dépôt (les mêmes que ceux de l'image du serveur).
const levelsDir = new URL("../../jump/public/levels/", import.meta.url);
const frozen: Record<string, unknown> = {};
for (const f of readdirSync(levelsDir).sort()) {
  const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
  if (date) frozen[date] = JSON.parse(readFileSync(new URL(f, levelsDir), "utf8"));
}

let clock = 0;
const api = createApi({ db, now: () => clock, demoPlayers: true, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
const submit = async (body: unknown) => {
  const res = await api.handle(new Request("http://recette.local/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

const started = Date.now();
let total = 0;
for (let day = today - days + 1; day <= today && !demoSeulement; day++) {
  const date = formatDay(day);
  const circuit = dailyCircuit(day);
  // Même tirage que l'historique de démonstration (graine propre au jour) : 8 à 15 pilotes, niveaux variés.
  const rng = new Rng(mixSeed(day, 0x11d3));
  const wanted = 8 + rng.int(8);
  const names = rng.shuffle(FICTIONAL_NAMES);
  let accepted = 0;
  let refused = 0;
  for (let p = 0; p < names.length && accepted < wanted; p++) {
    const skill = (rng.int(1000) / 1000) ** 1.3;
    let run: { code: string; finishMs: number } | null = null;
    for (let attempt = 0; attempt < 4 && !run; attempt++) {
      const style = styleFor(Math.min(1, skill + attempt * 0.12));
      run = runFictional(circuit.track, { ...style, wobble: style.wobble / (1 + attempt) }, mixSeed(day, p * 31 + attempt));
    }
    if (!run) continue;
    // Midi à Paris, une seconde par pilote : le jour est ouvert, et l'ordre d'arrivée est stable.
    clock = parisDayStart(day) + 12 * HOUR_MS + (p + 1) * 1000;
    const res = await submit({ playerId: fictionalId(names[p]!), name: names[p]!, date, replay: run.code });
    if (res.status === 200) accepted++;
    else {
      refused++;
      if (refused === 1) console.log(`  ${date} : refus du serveur (${res.status} ${String(res.body.error ?? "")}) — la course ne compte pas`);
    }
  }
  total += accepted;
  console.log(`${date} : ${accepted} pilote(s) classé(s)${refused ? `, ${refused} refus` : ""}`);
}
console.log(`\n${total} temps envoyés par createApi (rejoués par le serveur) en ${((Date.now() - started) / 1000).toFixed(0)} s.`);

// DailyJump : les joueurs fictifs du jour courant.
const jumpStarted = Date.now();
const jumps = await seedJumpDays({
  db,
  frozen,
  days: demoSeulement ? [] : [today],
  onDay: (d) => console.log(`DailyJump ${d.date} : ${d.accepted} joueur(s) classé(s), ${d.lives} vie(s) gardée(s) (morts rejouées)${d.refused || d.firstError ? `, ${d.refused} refus (${d.firstError}) — l'essai ne compte pas` : ""}`),
});
console.log(`${jumps} essais DailyJump envoyés par createApi (rejoués par le serveur) en ${((Date.now() - jumpStarted) / 1000).toFixed(0)} s.`);

// Lot I3 : les joueurs du classement du jour (avant « Démo » : son rang du jour se lit parmi eux).
// `--demo-seulement` les saute (les e2e du portail, en quelques secondes) sauf avec `--classement` (les e2e du classement du jour).
if (!demoSeulement || process.argv.includes("--classement")) {
  const classementStarted = Date.now();
  const classement = await seedClassementDemo({ db, frozen, today });
  console.log(
    `Classement du jour (lot I3) : ${classement.joueurs} joueurs de démonstration (${classement.effaces} effacés puis recréés) — ${classement.track} course(s) Track, ${classement.jump} essai(s) Jump rejoués par le serveur en ${((Date.now() - classementStarted) / 1000).toFixed(0)} s${classement.refus.length ? `, ${classement.refus.length} refus (${classement.refus[0]}) — ne comptent pas` : ""}.`,
  );
}

// Lot I2 : le joueur de démonstration du portail (après les autres : son rang du jour se lit parmi eux).
const demoStarted = Date.now();
const demo = await seedPortailDemo({ db, frozen, today });
console.log(
  `Joueur de démonstration « Démo » (portail, /?demo=joueur) : Track ${demo.track.map((t) => `${t.date} ${t.medal ?? "sans médaille"}`).join(", ")} ; Jump ${demo.jump.map((j) => j.date).join(", ") || "—"} ; ${demo.morts} mort(s) aujourd'hui — ${((Date.now() - demoStarted) / 1000).toFixed(0)} s.`,
);
