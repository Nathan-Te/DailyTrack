// Lot D3 (C10) — `npm run measure:memoire -w @cdj/api [-- --n=1000] [--jeu=tower|jump|track|tower-fil]` : la mémoire du processus après 1, 10, 100 et 1 000 rejeux de chaque jeu
// (`process.memoryUsage` : `rss`, `external`, `arrayBuffers`, `heapUsed`), après un ramasse-miettes forcé (`--expose-gc`, posé par le script npm). **Local seulement, aucune base** : le rejeu seul.
// `tower-fil` rejoue par le vrai fil de calcul du serveur (`executeurFil`, fichier empaqueté à la volée) : c'est ce que fait la production. Sert à prouver qu'un rejeu ne garde aucune mémoire.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { daysFromCivil } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, replayAttempt } from "@cdj/jump-sim";
import { dailyCircuit, decodeReplay, encodeReplay, replayRace, runPilot } from "@cdj/sim";
import { TOWER_GENERATOR_VERSION, dailyTower, rejouer } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { executeurFil } from "../src/jeux/fil";
import type { DemandeTower } from "../src/towerRejeu";
import { examinerParLeFil, examinerSurPlace } from "../src/towerRejeu";
import { fixtureJour, jouerScripte } from "./tower-aide";

const arg = (nom: string): string | undefined => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const N = Number(arg("n") ?? 1000);
const jeu = arg("jeu");
const POINTS = [1, 10, 100, 1000].filter((p) => p <= N);
if (!POINTS.includes(N)) POINTS.push(N);
// La mémoire linéaire du WebAssembly de Rapier (elle ne se rend jamais au système : elle ne fait que grandir ; une fuite la fait grandir sans fin) : on garde l'instance qui sort de `instantiate`.
let memoireWasm: WebAssembly.Memory | null = null;
const noter = (inst: WebAssembly.Instance | undefined): void => {
  const m = inst?.exports?.memory;
  if (m instanceof WebAssembly.Memory) memoireWasm = m;
};
const instantierOrigine = WebAssembly.instantiate.bind(WebAssembly) as (...x: unknown[]) => Promise<unknown>;
(WebAssembly as { instantiate: unknown }).instantiate = async (...a: unknown[]) => {
  const r = await instantierOrigine(...a);
  noter((r as { instance?: WebAssembly.Instance }).instance ?? (r instanceof WebAssembly.Instance ? r : undefined));
  return r;
};
WebAssembly.Instance = new Proxy(WebAssembly.Instance, {
  construct(cible, args) {
    const inst = Reflect.construct(cible, args) as WebAssembly.Instance;
    noter(inst);
    return inst;
  },
});
const D = (date: string): number => daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
const mo = (o: number): string => (o / 1_048_576).toFixed(1).padStart(7);

function lire(): { rss: number; ext: number; buf: number; tas: number; wasm: number } {
  (globalThis as { gc?: () => void }).gc?.();
  const m = process.memoryUsage();
  return { rss: m.rss, ext: m.external, buf: m.arrayBuffers, tas: m.heapUsed, wasm: memoireWasm ? memoireWasm.buffer.byteLength : 0 };
}

async function courbe(nom: string, rejeu: () => unknown | Promise<unknown>, lireAutre?: () => Promise<{ rss: number; ext: number }>): Promise<void> {
  console.log(`\n## ${nom}`);
  console.log("rejeux |   rss Mo | external | buffers | tas JS Mo | wasm Mo | pic rss | ms/rejeu");
  for (let i = 0; i < 3; i++) await rejeu(); // échauffement (compilation, chargement du WebAssembly)
  const base = lire();
  const pic = () => process.resourceUsage().maxRSS * 1024;
  console.log(`${"0".padStart(6)} | ${mo(base.rss)} | ${mo(base.ext)} | ${mo(base.buf)} | ${mo(base.tas)} | ${mo(base.wasm)} | ${mo(pic())} | (après 3 d'échauffement)`);
  let fait = 0;
  let t0 = performance.now();
  for (const p of POINTS) {
    while (fait < p) {
      await rejeu();
      await new Promise((r) => setImmediate(r)); // comme un serveur : la boucle d'événements respire entre deux requêtes (les finaliseurs de WebAssembly et le ramasse-miettes y passent)
      fait++;
    }
    const ms = (performance.now() - t0) / p;
    const m = lireAutre ? await lireAutre() : lire();
    const tas = lire();
    console.log(`${String(p).padStart(6)} | ${mo(m.rss)} | ${mo(m.ext)} | ${mo(tas.buf)} | ${mo(tas.tas)} | ${mo(tas.wasm)} | ${mo(pic())} | ${ms.toFixed(1)}`);
    t0 = performance.now() - ms * p; // la durée moyenne reste celle du total
  }
  const fin = lire();
  console.log(`→ croissance du processus (rss) entre 0 et ${N} : ${((fin.rss - base.rss) / 1_048_576).toFixed(1)} Mo ; WebAssembly : ${((fin.wasm - base.wasm) / 1_048_576).toFixed(1)} Mo`);
}

console.log(`Node ${process.version}, gc exposé : ${typeof (globalThis as { gc?: unknown }).gc === "function"}, N = ${N}`);

if (!jeu || jeu === "tower") {
  const R = await chargerRapier();
  const contenu = dailyTower(D("2026-11-10"), TOWER_GENERATOR_VERSION, 0);
  const j = jouerScripte(R, contenu);
  j.partie.dispose();
  await courbe("Tower — rejeu dans le fil principal (le repli)", () => rejouer(R, contenu, j.code));
}

if (!jeu || jeu === "tower-fil") {
  const dossier = mkdtempSync(join(tmpdir(), "cdj-memoire-"));
  try {
    const fichier = join(dossier, "tower-fil.mjs");
    await build({
      entryPoints: [new URL("../src/towerFilTravail.ts", import.meta.url).pathname],
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node22",
      outfile: fichier,
      logLevel: "silent",
      banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" },
    });
    const R = await chargerRapier();
    const contenu = dailyTower(D("2026-11-10"), TOWER_GENERATOR_VERSION, 0);
    const j = jouerScripte(R, contenu);
    j.partie.dispose();
    const executeur = executeurFil<DemandeTower, unknown>(fichier);
    await courbe("Tower — rejeu par le fil de calcul (la production), mémoire du processus entier (fil compris)", () => executeur.rejouer({ contenu, rediffusion: j.code }));
    await executeur.fermer?.();
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

// Le serveur de production : au premier jour préparé, `calculer` examine le fichier du jour (sa preuve est rejouée) ; avant le lot D3 c'était **dans le fil principal** (un second WebAssembly de Rapier, à côté de celui du fil
// de calcul des envois) ; maintenant le fil de calcul s'en charge. `--jeu=tower-serveur-avant` / `tower-serveur-apres` : le même scénario, une seule différence.
if (jeu === "tower-code") {
  const R = await chargerRapier();
  const j = jouerScripte(R, dailyTower(D("2026-11-10"), TOWER_GENERATOR_VERSION, 0));
  j.partie.dispose();
  writeFileSync(process.env.CODE_FILE ?? "dist/tower-code.txt", j.code);
}
for (const mode of ["avant", "apres"] as const) {
  if (jeu !== `tower-serveur-${mode}`) continue;
  const dossier = mkdtempSync(join(tmpdir(), "cdj-memoire-"));
  try {
    const fichier = join(dossier, "tower-fil.mjs");
    await build({ entryPoints: [new URL("../src/towerFilTravail.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", target: "node22", outfile: fichier, logLevel: "silent", banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" } });
    // La rediffusion jouée est écrite une fois par `--jeu=tower-code` (dans un autre processus) : le fil principal de ce processus ne charge Rapier que si le scénario le demande.
    const contenu = dailyTower(D("2026-11-10"), TOWER_GENERATOR_VERSION, 0);
    const j = { code: readFileSync(process.env.CODE_FILE ?? "dist/tower-code.txt", "utf8").trim() };
    const executeur = executeurFil<DemandeTower, unknown>(fichier);
    const json = fixtureJour("2026-11-07");
    // L'examen du jour (une fois par jour et par instance), puis les envois.
    if (mode === "avant") examinerSurPlace(await chargerRapier(), json, D("2026-11-07"));
    else await examinerParLeFil(executeur as never, json, D("2026-11-07"));
    await courbe(`Tower — le serveur (${mode === "avant" ? "AVANT D3 : l'examen du jour dans le fil principal" : "APRÈS D3 : l'examen du jour dans le fil de calcul"}), puis les envois par le fil`, () => executeur.rejouer({ contenu, rediffusion: j.code }));
    await executeur.fermer?.();
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

if (!jeu || jeu === "jump") {
  const niveau = dailyLevel(D("2026-10-30"));
  await courbe("Jump — replayAttempt", () => replayAttempt(niveau.level, niveau.replay, niveau.id));
  void JUMP_GENERATOR_VERSION;
  void JUMP_SIM_VERSION;
}

if (!jeu || jeu === "track") {
  const c = dailyCircuit(D("2026-10-14"));
  const code = encodeReplay(runPilot(c.track, { grip: 0.9 }).replay);
  await courbe("Track — replayRace", () => replayRace(c.track, decodeReplay(code)));
}
