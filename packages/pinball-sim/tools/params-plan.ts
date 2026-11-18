// @ts-nocheck
import { readFileSync } from "node:fs";
import { PLANS, orbite, porteDeLOrbite } from "../src/index";
// OUTIL DU LOT PBL2 : applique un fichier de paramètres de `regler-plan` au plan en mémoire (les outils qui dessinent ou mesurent)
export function appliquerParams(idPlan, fichier) {
  const plan = PLANS.find((p) => p.id === idPlan);
  const p = JSON.parse(readFileSync(fichier, "utf8"));
  const rails = plan.rampes;
  const base = rails.map((r) => r.points.map((q) => [q[0], q[1]]));
  plan.emplacements.forEach((e, i) => {
    e.x = p.slots[i][0]; e.y = p.slots[i][1];
    e.permis = e.permis.filter((m) => !(m === "spinner" && e.y > 322));
    if (e.permis.length === 0) e.permis = ["mini"];
  });
  rails.forEach((r, k) => {
    const [mx, my, a] = p.rails[k];
    r.points = [[mx, my], [Math.round(mx + 44 * Math.sin((a * Math.PI) / 180)), Math.round(my - 44 * Math.cos((a * Math.PI) / 180))], ...base[k].slice(2)];
  });
  const o = p.orbite;
  plan.orbite = orbite(o.xg, o.xd, o.yg, o.r, o.h, o.ag, o.ad, o.yd);
  const [mx, my, ag] = p.porte === 0 ? [o.xg, o.yg, o.ag] : [o.xd, o.yd, o.ad];
  plan.porte = porteDeLOrbite(mx, my, ag, p.largeur ?? 40, p.prof ?? 36);
  return p;
}
