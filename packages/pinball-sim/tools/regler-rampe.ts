import { PLANS, dailyPinball, fenetresDeTir } from "../src/index";

// `npm run regler-rampe:pinball -w @cdj/pinball-sim -- <table> <thème> [objectif]` (lot PBT1) : la bouche d'une rampe (les quatre bouts des deux guides et le premier point du rail) bouge point par point, chacun de 15 px
// au plus (distance) de son dessin ; une descente par coordonnée cherche la meilleure fenêtre de tir de la rampe. Écrit la meilleure bouche trouvée.
const [id, theme, objectif = "rampe1"] = process.argv.slice(2);
const plan = PLANS.find((p) => p.id === id)! as any;
const orig = JSON.parse(JSON.stringify({ g: plan.guides, r: plan.rampes[0].points[0] }));
const pts = (): number[][] => [...plan.guides.filter((g: any) => g.genre === "bouche").flatMap((g: any) => g.points), plan.rampes[0].points[0]];
const base = JSON.parse(JSON.stringify(pts()));
const courant = base.map((p: number[]) => [0, 0]);
const eval_ = (): number => {
  const c = dailyPinball(1, undefined, theme as never, id, false);
  return fenetresDeTir(c).ms[objectif] ?? 0;
};
const poser = (): void => pts().forEach((p, i) => { p[0] = base[i][0] + courant[i][0]; p[1] = base[i][1] + courant[i][1]; });
let meilleur = eval_();
for (let tour = 0; tour < 4; tour++) {
  for (let i = 0; i < courant.length; i++) {
    for (const axe of [0, 1]) {
      for (const delta of [-12, -9, -6, -3, 3, 6, 9, 12]) {
        const avant = courant[i][axe];
        courant[i][axe] = avant + delta;
        if (Math.hypot(courant[i][0], courant[i][1]) > 15) { courant[i][axe] = avant; continue; }
        poser();
        // un guide garde au moins 18 px (sinon ce n'est plus un guide)
        const p = pts();
        if (Math.hypot(p[0]![0]! - p[1]![0]!, p[0]![1]! - p[1]![1]!) < 18 || Math.hypot(p[2]![0]! - p[3]![0]!, p[2]![1]! - p[3]![1]!) < 18) { courant[i][axe] = avant; continue; }
        const v = eval_();
        if (v > meilleur) meilleur = v; else courant[i][axe] = avant;
      }
    }
  }
  poser();
  console.log(`tour ${tour} : ${meilleur} ms`);
}
poser();
console.log(JSON.stringify({ deplacements: courant, bouche: pts() }));
void orig;
