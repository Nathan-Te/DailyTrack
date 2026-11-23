import { PLANS, THEMES_PINBALL, dailyPinball, fenetresDeTir, Partie, pointOccupe, UNITE } from "../src/index";

// `npm run chercher-verrou:pinball -w @cdj/pinball-sim -- <table> [pas]` (lot PBT1, option 1 de Nathan) : le verrou posé sur une grille de la table (le reste du dessin ne bouge pas). Étape 1 : thème foire, la plus petite
// fenêtre de tous les objectifs de la table (le verrou ne doit rien boucher). Étape 2 : les meilleurs points rejoués dans les quatre thèmes, de face et en miroir. Écrit « x y pire(ms) verrou(ms) distance au dessin ».
const [id, pasArg] = process.argv.slice(2);
const pas = Number(pasArg ?? 8);
const plan = PLANS.find((p) => p.id === id)! as any;
const x0 = plan.emplacements[1].x;
const y0 = plan.emplacements[1].y;
const poser = (x: number, y: number): void => {
  plan.emplacements[1].x = x;
  plan.emplacements[1].y = y;
};
const pire = (c: ReturnType<typeof dailyPinball>): { pire: number; verrou: number; qui: string } => {
  const f = fenetresDeTir(c);
  let m = 1e9;
  let qui = "";
  for (const [o, ms] of Object.entries(f.ms)) if (ms < m) { m = ms; qui = o; }
  return { pire: m, verrou: f.ms.verrou ?? 0, qui };
};
const etape1: { x: number; y: number; pire: number; verrou: number; qui: string }[] = [];
for (let y = 240; y <= 470; y += pas) {
  for (let x = 48; x <= 326; x += pas) {
    poser(x, y);
    const c = dailyPinball(1, undefined, "foire", id, false);
    const t = new Partie(c).table;
    const autre = t.poses.find((q) => q.emplacement === 0)!;
    const rayon = (t.plateaux[0]?.r ?? t.tourbillons[0]?.r ?? t.geysers[0]?.r ?? 14 * UNITE) / UNITE;
    if (Math.hypot(x - autre.x / UNITE, y - autre.y / UNITE) < rayon + 28) continue;
    if (t.bumpers.some((b) => Math.hypot(b.x / UNITE - x, b.y / UNITE - y) < b.r / UNITE + 13 + 8) || pointOccupe(t, x, y)) continue;
    etape1.push({ x, y, ...pire(c) });
  }
}
etape1.sort((a, b) => b.pire - a.pire);
console.log(`${id} : ${etape1.length} points libres ; étape 2 sur les 14 meilleurs`);
for (const q of etape1.slice(0, 14)) {
  let m = 1e9;
  let v = 1e9;
  let qui = "";
  poser(q.x, q.y);
  for (const theme of THEMES_PINBALL) {
    for (const miroir of [false, true]) {
      const r = pire(dailyPinball(1, undefined, theme, id, miroir));
      if (r.pire < m) { m = r.pire; qui = `${theme}${miroir ? "'" : ""}:${r.qui}`; }
      v = Math.min(v, r.verrou);
    }
  }
  console.log(`${q.x} ${q.y}  pire ${m} (${qui})  verrou ${v}  à ${Math.round(Math.hypot(q.x - x0, q.y - y0))} px du dessin`);
}
poser(x0, y0);
