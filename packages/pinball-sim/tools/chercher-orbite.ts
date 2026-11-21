import { DROITE, GAUCHE, PLANS, UNITE, dailyPinball, tirsDuBatteur } from "../src/index";

// `npm run chercher-orbite:pinball -w @cdj/pinball-sim -- <table> [largeur]` (lot PBT1) : où poser la bouche de l'orbite ? Les trajectoires du geste de référence du batteur droit (la table sans orbite) sont comptées : pour chaque
// position de bouche (un segment de `largeur` px, face au batteur), la plus longue série de moments de frappe consécutifs dont la bille le franchit à 500 px/s ou plus, en ms. Du meilleur au moins bon.
const [id, largeurArg, coteArg] = process.argv.slice(2);
const largeur = Number(largeurArg ?? 34);
const cote = coteArg === "g" ? GAUCHE : DROITE;
const plan = PLANS.find((p) => p.id === id)! as any;
plan.orbite = null;
plan.porte = undefined;
const c = dailyPinball(1, undefined, "foire", id, false);
const r = tirsDuBatteur(c, cote, { traces: true, echantillon: 1 });
const traces = r.traces!;
const bx = cote === DROITE ? 256 : 112;
const by = 640;
const res: { x: number; y: number; pas: number; ms: number }[] = [];
for (let y = 280; y <= 470; y += 10) {
  for (let x = 30; x <= 340; x += 10) {
    // la bouche est perpendiculaire à la direction du batteur
    const dx = x - bx;
    const dy = y - by;
    const n = Math.hypot(dx, dy);
    const ux = dx / n;
    const uy = dy / n;
    const ax = x - (-uy * largeur) / 2;
    const ay = y - (ux * largeur) / 2;
    const cx = x + (-uy * largeur) / 2;
    const cy = y + (ux * largeur) / 2;
    let serie = 0;
    let pire = 0;
    for (const t of traces) {
      let ok = false;
      for (let i = 1; i < t.x.length; i++) {
        const px = t.x[i - 1]!, py = t.y[i - 1]!, qx = t.x[i]!, qy = t.y[i]!;
        // croisement du segment (p,q) et de la bouche
        const d1 = (cx - ax) * (py - ay) - (cy - ay) * (px - ax);
        const d2 = (cx - ax) * (qy - ay) - (cy - ay) * (qx - ax);
        const e1 = (qx - px) * (ay - py) - (qy - py) * (ax - px);
        const e2 = (qx - px) * (cy - py) - (qy - py) * (cx - px);
        if (d1 * d2 <= 0 && e1 * e2 <= 0 && d1 !== d2) {
          const vit = Math.hypot(qx - px, qy - py); // px par pas
          const v = vit * 600;
          const vers = (qx - px) * ux + (qy - py) * uy > 0;
          if (vers && v >= 500) ok = true;
          break;
        }
      }
      serie = ok ? serie + 1 : 0;
      if (serie > pire) pire = serie;
    }
    res.push({ x, y, pas: pire, ms: Math.trunc((pire * 1000) / 600) });
  }
}
res.sort((a, b) => b.ms - a.ms);
const xmax = Number(process.env.XMAX ?? 999);
const gardes = res.filter((q) => q.x <= xmax);
console.log(`${id} largeur ${largeur} : ${traces.length} tirs`);
for (const q of gardes.slice(0, 20)) console.log(`${q.x} ${q.y} ${q.ms} ms`);
