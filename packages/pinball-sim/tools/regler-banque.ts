import { PLANS, banqueDiagonale, dailyPinball, fenetresDeTir } from "../src/index";

// `npm run regler-banque:pinball -w @cdj/pinball-sim -- <table> <thème>` (lot PBT1) : la banque en diagonale (tables B, C) tourne autour de sa cible du milieu (de −30° à +30° de son inclinaison de −28°) et glisse de ±9 px ; aucune de ses
// trois cibles ne s'écarte de plus de 15 px de son dessin. Écrit la meilleure fenêtre (ms) de la banque et les centres trouvés.
const [id, theme] = process.argv.slice(2);
const plan = PLANS.find((p) => p.id === id)! as any;
const orig: number[][] = id === "B" ? [[88, 267], [112, 255], [136, 243]] : [[68, 257], [92, 245], [116, 233]];
const [mx, my] = orig[1]! as [number, number];
const pole = (a: number): number[][] => orig.map(([x, y]) => { const r = ((a * Math.PI) / 180); const dx = x! - mx, dy = y! - my; return [Math.trunc(mx + dx * Math.cos(r) - dy * Math.sin(r)), Math.trunc(my + dx * Math.sin(r) + dy * Math.cos(r))]; });
let meilleur = { ms: -1, a: 0, sx: 0, sy: 0 };
for (let a = -30; a <= 30; a += 5) {
  for (let sx = -9; sx <= 9; sx += 3) {
    for (let sy = -9; sy <= 9; sy += 3) {
      const c = pole(a).map(([x, y]) => [x! + sx, y! + sy]);
      if (c.some((p, i) => Math.hypot(p![0]! - orig[i]![0]!, p![1]! - orig[i]![1]!) > 15)) continue;
      plan.emplacements[3].banque = banqueDiagonale(c as never, -28 + a);
      plan.emplacements[3].x = c[1]![0]; plan.emplacements[3].y = c[1]![1];
      const f = fenetresDeTir(dailyPinball(1, undefined, theme as never, id, false));
      const ms = Math.min(f.ms["S4:cibles"] ?? 0, f.ms.verrou ?? 99, f.ms.mission ?? 99, f.ms.rampe1 ?? 99, f.ms.orbite ?? 99);
      if (ms > meilleur.ms) { meilleur = { ms, a, sx, sy }; console.log(`${ms} ms (banque ${f.ms["S4:cibles"]}) angle ${-28 + a}° décalage (${sx}, ${sy}) centres ${JSON.stringify(c)}`); }
    }
  }
}
