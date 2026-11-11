import { MODULES, M, TICKS_PAR_SECONDE, analyser, commandesDuModule, ecartsHorsJauge, niveauDuModule, Partie, type Module } from "../src/index";

// L'outil d'écriture des modules (lot V2) : `npm run module:vertige -w @cdj/vertige-sim -- <id> [--trace N]` rejoue la solution d'un module depuis l'état canonique et dit où elle arrive, combien de pas elle compte en
// trop, chaque phase en l'air mesurée contre les jauges. `--tous` : un résumé de toute la bibliothèque.
const arg = process.argv.slice(2);
const tous = arg.includes("--tous");
const trace = arg.includes("--trace") ? Number(arg[arg.indexOf("--trace") + 1]) : 0;
const f = (v: number): string => (v / M).toFixed(2);

function rapport(m: Module): void {
  const a = analyser(m);
  const cmd = commandesDuModule(m);
  console.log(`\n## ${m.id} — ${m.nom} — ${a.arrive ? `arrive en ${a.ticks} pas (${(a.ticks / TICKS_PAR_SECONDE).toFixed(2)} s)` : "N'ARRIVE PAS"} ; ${cmd.length} pas écrits (${cmd.length - a.ticks} de trop) ; chutes ${a.chutes}`);
  for (const ph of a.phases) console.log(`  pas ${ph.debut}–${ph.fin} ${ph.mecaniques.join("+") || "chute"} : écart ${ph.ecart === null ? "–" : f(ph.ecart)} m, dénivelé ${ph.denivele === null ? "–" : f(ph.denivele)} m, distance ${f(ph.distance)} m, mur ${f(ph.longueurMur)} m${ph.sautsDeMur.length ? `, sauts de mur ${ph.sautsDeMur.map(f).join("/")}` : ""}${ph.changeDeRepere ? " (repère changé)" : ""}`);
  for (const r of ecartsHorsJauge(a)) console.log(`  ✗ ${r}`);
  {
    // Les événements : une bascule, une traversée, une chute, une capture.
    const p = new Partie(niveauDuModule(m, { lance: true }));
    let vu = [0, 0, 0, 0];
    cmd.forEach((c) => {
      if (p.finie) return;
      p.avancer(c);
      const k = [p.bascules, p.traversees, p.chutes, p.captures];
      if (k.some((v, i) => v !== vu[i])) console.log(`  · pas ${p.tick} : ${["bascule", "traversée", "chute", "capture"].filter((_, i) => k[i] !== vu[i]).join("+")} — pieds ${p.pieds().join(" ")} µm, gravité ${p.gravite}, v ${p.vitesseMonde().map(f).join(", ")}`);
      vu = k;
    });
  }
  if (trace > 0) {
    const p = new Partie(niveauDuModule(m, { lance: true }));
    cmd.forEach((c, i) => {
      if (p.finie) return;
      p.avancer(c);
      if ((i + 1) % trace === 0 || p.finie) console.log(`  pas ${p.tick}: pieds ${p.pieds().map(f).join(", ")} ori ${p.ori} v ${p.vitesseMonde().map(f).join(", ")} sol ${p.sol} mur ${p.surMur} g ${p.gravite} bascules ${p.bascules} traversees ${p.traversees} chutes ${p.chutes} captures ${p.captures}`);
    });
  }
}
for (const m of MODULES) if (tous || arg.includes(m.id)) rapport(m);
