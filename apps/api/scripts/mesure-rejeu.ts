// Lot K2bc — `npm run measure:rejeu -w @cdj/api` : le temps d'un **envoi complet** (`POST …/submit` par `createApi(...).handle`, rejeu compris) de chaque jeu, médiane de 20 passes après 3 d'échauffement, sur une base
// libSQL locale (un fichier temporaire, jamais Turso : règle R14). Un joueur neuf à chaque passe, la même rediffusion (les copies sont permises par l'outil). Sert à comparer avant / après un changement du serveur
// d'un jeu : le module des jeux ne doit rien ajouter de mesurable au rejeu. Le rejeu seul (sans HTTP ni base) est mesuré à part, pour situer la part du rejeu dans l'envoi.
import { mkdtempSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { parisDayStart } from "@cdj/clock";
import { daysFromCivil } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, replayAttempt } from "@cdj/jump-sim";
import { dailyCircuit, decodeReplay, replayRace, runPilot, encodeReplay } from "@cdj/sim";
import { TOWER_GENERATOR_VERSION, dailyTower } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { createApi } from "../src/api";
import { ensureSchemaOn } from "../src/db";
import { openLibsql } from "../src/libsql-open";
import { jouerScripte } from "./tower-aide";

const PASSES = 20;
const ECHAUFFEMENT = 3;
const mediane = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const D = (date: string): number => daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
const id = (n: number) => n.toString(16).padStart(32, "0");
console.log(`Machine : ${cpus()[0]?.model ?? "?"} (${cpus().length} cœurs), Node ${process.version}\n`);

const dossier = mkdtempSync(join(tmpdir(), "cdj-rejeu-"));
let n = 0;

async function mesurer(nom: string, date: string, chemin: string, corps: (nom: string) => unknown, rejeuSeul: () => unknown): Promise<void> {
  const db = await openLibsql({ url: `file:${join(dossier, `m${n++}.db`)}` });
  const clock = { now: parisDayStart(D(date)) + 12 * 3_600_000 };
  const api = createApi({ db, now: () => clock.now, allowCopies: true });
  await ensureSchemaOn(db);
  await db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES (?, 'on', 0, ?, 0)", [chemin.includes("tower") ? "tower" : chemin.includes("jump") ? "jump" : "track", JSON.stringify([[0, null]])]);
  const duree: number[] = [];
  for (let i = 0; i < PASSES + ECHAUFFEMENT; i++) {
    const req = new Request(`http://api.test${chemin}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": id(i + 1) }, body: JSON.stringify(corps(`Joueur${i + 1}`)) });
    const t0 = performance.now();
    const res = await api.handle(req, { clientKey: `198.51.100.${i + 1}` });
    const ms = performance.now() - t0;
    const texte = await res.text();
    if (res.status !== 200) throw new Error(`${nom} : ${res.status} ${texte.slice(0, 200)}`);
    if (i >= ECHAUFFEMENT) duree.push(ms);
    clock.now += 1000;
  }
  const seul: number[] = [];
  for (let i = 0; i < PASSES + ECHAUFFEMENT; i++) {
    const t0 = performance.now();
    rejeuSeul();
    if (i >= ECHAUFFEMENT) seul.push(performance.now() - t0);
  }
  console.log(`${nom.padEnd(8)} envoi complet : médiane ${mediane(duree).toFixed(1)} ms (min ${Math.min(...duree).toFixed(1)}, max ${Math.max(...duree).toFixed(1)}) · rejeu seul : médiane ${mediane(seul).toFixed(1)} ms`);
}

// Jump : la preuve de l'auteur du 30/10/2026.
{
  const niveau = dailyLevel(D("2026-10-30"));
  await mesurer("Jump", "2026-10-30", "/api/jump/submit", (name) => ({ levelId: niveau.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: niveau.code, name }), () => replayAttempt(niveau.level, niveau.replay, niveau.id));
}
// Track : le pilote du 14/10/2026.
{
  const jour = D("2026-10-14");
  const c = dailyCircuit(jour);
  const run = runPilot(c.track, { grip: 0.9 });
  const code = encodeReplay(run.replay);
  await mesurer("Track", "2026-10-14", "/api/submit", (name) => ({ date: "2026-10-14", replay: code, name }), () => replayRace(c.track, decodeReplay(code)));
}
// Tower : une partie scriptée du 10/11/2026.
{
  const R = await chargerRapier();
  const contenu = dailyTower(D("2026-11-10"), TOWER_GENERATOR_VERSION, 0);
  const j = jouerScripte(R, contenu);
  j.partie.dispose();
  const { rejouer } = await import("@cdj/tower-sim");
  await mesurer("Tower", "2026-11-10", "/api/tower/submit", (name) => ({ replay: j.code, name }), () => {
    rejouer(R, contenu, j.code);
  });
}
rmSync(dossier, { recursive: true, force: true });
