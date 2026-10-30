// Lot T0 — les mesures du README : coût d'un rejeu, stabilité, coût d'un tour de bot (Node). Le déterminisme, lui, est vérifié par les tests (test/banc.test.ts et
// apps/tower/e2e/determinisme.spec.ts) et le poids par tools/poids.ts.
//   npm run mesures:tower -w @cdj/tower-sim [-- --rapide]     (≈ 3 min ; --rapide : moins de passes, pour vérifier l'outil)
import { cpus } from "node:os";
import { moteurA } from "../lab/a/moteurA";
import { chargerMoteurB } from "../lab/b/moteurB";
import { BANC_CONFIG, bancCommandes, rejouerBanc, tourPropre } from "../lab/banc";
import { type Engine, type WorldConfig } from "../lab/interface";
import { BOT_PAR_DEFAUT, tourDeBot } from "../lab/mesures/bot";
import { mesurerStabilite } from "../lab/mesures/stabilite";

const rapide = process.argv.includes("--rapide");
const seulement = process.argv.find((a) => a.startsWith("--seulement="))?.slice(12);
const veut = (section: string): boolean => !seulement || seulement === section;
const mediane = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const ms = (t0: number): number => performance.now() - t0;
const fmt = (n: number, d = 1): string => n.toFixed(d);

console.log(`Machine : ${cpus()[0]?.model ?? "?"} (${cpus().length} cœurs), Node ${process.version}`);
const A = moteurA();
const B = await chargerMoteurB();
const moteurs: Engine[] = [A, B];

// ---- 1. coût d'un rejeu complet (le banc : 40 pièces, 110 s de jeu simulé, jusqu'à la fin) ----
console.log("\n## Coût d'un rejeu complet (banc d'essai, médiane de 20 passes, après 2 passes d'échauffement)");
const passes = rapide ? 3 : 20;
for (const e of veut("rejeu") ? moteurs : []) {
  for (const hz of [60, 120]) {
    const cmds = bancCommandes().map((c) => ({ ...c, tick: (c.tick * hz) / 60 }));
    const config: WorldConfig = { ...BANC_CONFIG, hz };
    let r = rejouerBanc(e, { config, commandes: cmds, repos: (600 * hz) / 60 });
    rejouerBanc(e, { config, commandes: cmds, repos: (600 * hz) / 60 });
    const t: number[] = [];
    for (let i = 0; i < passes; i++) {
      const t0 = performance.now();
      r = rejouerBanc(e, { config, commandes: cmds, repos: (600 * hz) / 60 });
      t.push(ms(t0));
    }
    const m = mediane(t);
    console.log(
      `${e.name} · ${hz} Hz : médiane ${fmt(m)} ms (min ${fmt(Math.min(...t))}, max ${fmt(Math.max(...t))}) · ${r.ticks} pas, ${fmt((m * 1000) / r.ticks, 0)} µs par pas · ` +
        `${fmt(60000 / m, 0)} rejeux/min sur ce cœur · pièces tombées ${r.tombees}/40`,
    );
  }
}

// ---- 2. stabilité d'une tour posée proprement ----
console.log("\n## Stabilité : la tour propre de 40 pièces (34 m), 30 s, selon le nombre d'itérations du solveur");
for (const e of veut("stabilite") ? moteurs : []) {
  for (const iterations of rapide ? [30] : [8, 12, 20, 30, 60]) {
    for (const sleep of [true, false]) {
      const s = mesurerStabilite(e, { ...BANC_CONFIG, iterations, sleep }, 30);
      console.log(
        `${e.name} · ${String(iterations).padStart(2)} itérations · sommeil ${sleep ? "oui" : "non"} : dérive max ${fmt(s.derive * 100)} cm, angle ${fmt(s.deriveAngle * 1000)} mrad, ` +
          `tremblement max ${fmt(s.tremblement * 1000, 2)} mm/pas, endormie au pas ${s.dormiAu ?? "jamais"}, tombées ${s.tombees}, hauteur ${fmt(s.hauteurDebut, 2)} → ${fmt(s.hauteurFin, 2)} m`,
      );
    }
  }
}

// ---- 3. un tour de bot (40 positions × 4 rotations, jusqu'à stabilisation) sur une tour propre de k pièces ----
console.log("\n## Un tour de bot : 40 positions × 4 rotations = 160 essais, chacun sur une copie, jusqu'à stabilisation (≤ 5 s)");
const tour = tourPropre();
const resultatsBot: Record<string, { k: number; ms: number; pas: number }[]> = {};
for (const e of veut("bot") ? moteurs : []) {
  resultatsBot[e.name] = [];
  for (const k of rapide ? [10] : [10, 20, 39]) {
    const world = e.createWorld(BANC_CONFIG);
    const specs = tour.slice(0, k);
    for (const s of specs) e.addPiece(world, s);
    for (let i = 0; i < 120; i++) e.step(world);
    const t0 = performance.now();
    const t = tourDeBot(e, { world, specs: [...specs] }, "T", rapide ? { ...BOT_PAR_DEFAUT, positions: 8 } : BOT_PAR_DEFAUT);
    const dt = ms(t0);
    resultatsBot[e.name]!.push({ k, ms: dt, pas: t.pas });
    console.log(`${e.name} · tour de ${String(k).padStart(2)} pièces : ${fmt(dt / 1000, 2)} s pour ${t.essais} essais (${fmt(dt / t.essais)} ms par essai, ${fmt(t.pas / t.essais, 0)} pas par essai)`);
    e.dispose(world);
  }
}
if (!rapide && veut("bot")) {
  console.log("\n## Extrapolation (somme sur les 40 pièces d'une journée, interpolation linéaire du coût d'un tour entre 10, 20 et 39 pièces posées)");
  for (const name of Object.keys(resultatsBot)) {
    const pts = resultatsBot[name]!;
    const coût = (k: number): number => {
      const [p, q] = k <= 20 ? [pts[0]!, pts[1]!] : [pts[1]!, pts[2]!];
      return p.ms + ((q.ms - p.ms) * (k - p.k)) / (q.k - p.k);
    };
    let jour = 0;
    for (let k = 0; k < 40; k++) jour += Math.max(coût(k), 0);
    console.log(`${name} : ≈ ${fmt(jour / 1000, 0)} s pour la journée (40 pièces), ≈ ${fmt((8 * jour) / 60000, 1)} min pour 8 jours figés d'un coup`);
  }
}
