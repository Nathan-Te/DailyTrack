import { distance, Partie, contenuScenario, etatPilote, indiceBoss, pasDuPilote } from "../src/index";
// Diagnostic d'un combat : `DIAG_BOSS=chene DIAG_JOUR=0 node dist/diagnostic.mjs` imprime chaque cœur perdu (tick, état du boss, attaque, zones, nuages).
import { BOSS, BOSS_IDS } from "../src/index";
if (process.env.VIE) for (const [id, v] of Object.entries(JSON.parse(process.env.VIE) as Record<string, number>)) (BOSS[BOSS_IDS.indexOf(id as (typeof BOSS_IDS)[number])] as { vie: number }).vie = v;
const b = indiceBoss(process.env.DIAG_BOSS ?? "golem");
const p = new Partie(contenuScenario("boss", { boss: b, jour: Number(process.env.DIAG_JOUR ?? 0) }), undefined, true);
const etat = etatPilote("foncer", -2, p);
let subis = 0;
while (!p.finie && p.tick < 36000) {
  pasDuPilote(p, etat);
  if (p.evenements.length > 400) p.vider();
  if (p.subis > subis) {
    subis = p.subis;
    const g = p.golem!;
    console.log(`t=${p.tick} cœurs=${p.c.coeurs} boss: etat=${g.etat} attaque=${g.attaque} phase=${g.phase} hp=${g.hp}/${g.hpMax} pos=(${(g.x / 4096).toFixed(1)},${(g.y / 4096).toFixed(1)}) chev=(${(p.c.x / 4096).toFixed(1)},${(p.c.y / 4096).toFixed(1)}) evts=${p.evenements.filter((e) => e.tick === p.tick).map((e) => e.k + (e.k === "impact" ? e.a : "")).join("+")} zones=${p.zones.map((z) => `${z.type}@${z.ti - p.tick}`).join(",")} nuages=${p.nuages.length}(${p.nuages.map((n) => (distance(n.x, n.y, p.c.x, p.c.y) / 4096).toFixed(1) + "/" + (n.r / 4096).toFixed(1)).join(",")}) monstres=${p.monstres.length} [${p.monstres.map((m) => `${(distance(m.x, m.y, p.c.x, p.c.y) / 4096).toFixed(1)}m/hp${m.hp}/gel${m.gel}/t${m.t}`).join(" ")}] chevEtat=${p.c.etat}/${p.c.t} esq=${p.c.attente}`);
  }
}
console.log(p.victoire ? `victoire t=${p.tick}` : `fin t=${p.tick} perdue=${p.perdue}`);
