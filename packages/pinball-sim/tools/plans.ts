import { writeFileSync } from "node:fs";
import { PLANS, THEMES_PINBALL, UNITE, construireTable, REGLAGES, type Contenu, type Module } from "../src/index";

// `npm run plans:pinball -w @cdj/pinball-sim -- <fichier.svg> [theme]` : dessine les plans (murs, rails, bouches, emplacements, mini-batteur) dans un seul SVG — l'outil qui sert à régler leur géométrie. Aucun réseau, aucune base.
const sortie = process.argv[2] ?? "plans.svg";
const theme = (process.argv[3] ?? "foire") as (typeof THEMES_PINBALL)[number];
const px = (u: number): number => Math.round(u / UNITE * 10) / 10;
const couleurs = ["#c0392b", "#2471a3", "#1e8449", "#7d3c98"];
let corps = "";
PLANS.forEach((plan, k) => {
  const modules: Module[] = plan.emplacements.map((e, i) => {
    const f = e.fixe?.[theme];
    return (f ?? e.permis[0]!) as Module;
  });
  const c: Contenu = { jour: 0, g: 0, theme, plan: plan.id, modules };
  const t = construireTable(c, REGLAGES);
  let g = `<g transform="translate(${k * 400},0)"><rect width="390" height="780" fill="#f4efe6"/><text x="10" y="18" font-size="16" font-family="sans-serif">${plan.id}</text>`;
  for (const m of t.murs) g += `<line x1="${px(m.ax)}" y1="${px(m.ay)}" x2="${px(m.bx)}" y2="${px(m.by)}" stroke="${m.type === 2 ? "#e67e22" : "#444"}" stroke-width="2"/>`;
  for (const p of t.poteaux) g += `<circle cx="${px(p.x)}" cy="${px(p.y)}" r="${px(p.r)}" fill="#444"/>`;
  for (const b of t.bumpers) g += `<circle cx="${px(b.x)}" cy="${px(b.y)}" r="${px(b.r)}" fill="#f5b7b1" stroke="#c0392b"/>`;
  for (const z of [...t.plateaux, ...t.tourbillons, ...t.trousNoirs, ...t.geysers, ...t.portails]) g += `<circle cx="${px(z.x)}" cy="${px(z.y)}" r="${px(z.r)}" fill="none" stroke="#2471a3" stroke-dasharray="4 3"/>`;
  for (const z of t.trous) g += `<circle cx="${px(z.x)}" cy="${px(z.y)}" r="${px(z.r)}" fill="#111"/>`;
  for (const z of t.spinners) g += `<rect x="${px(z.x - z.l)}" y="${px(z.y) - 6}" width="${px(2 * z.l)}" height="12" fill="#a9dfbf"/>`;
  plan.emplacements.forEach((e, i) => (g += `<text x="${e.x}" y="${e.y + 4}" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#555">${i}:${modules[i]}</text>`));
  t.rails.forEach((r, i) => {
    g += `<polyline fill="none" stroke="${couleurs[i % 4]}" stroke-width="5" stroke-opacity="0.55" points="${r.x.map((x, j) => `${px(x)},${px(r.y[j]!)}`).join(" ")}"/>`;
  });
  for (const o of t.portes) g += `<line x1="${px(o.seg.ax)}" y1="${px(o.seg.ay)}" x2="${px(o.seg.bx)}" y2="${px(o.seg.by)}" stroke="#000" stroke-width="3"/><circle cx="${px(o.x)}" cy="${px(o.y)}" r="3" fill="#000"/>`;
  // lot PBG3 : le battant de la porte (en rouge), le poteau sauveur et ses lampes, l'aiguillage et ses deux trajets
  if (t.passage) g += `<line x1="${px(t.passage.battant.ax)}" y1="${px(t.passage.battant.ay)}" x2="${px(t.passage.battant.bx)}" y2="${px(t.passage.battant.by)}" stroke="#e00" stroke-width="4"/>`;
  g += `<circle cx="${px(t.sauveur.x)}" cy="${px(t.sauveur.y)}" r="${px(t.sauveur.r)}" fill="#0a0"/>`;
  for (const l of t.sauveur.lampes) g += `<line x1="${px(l.x - l.l)}" y1="${px(l.y)}" x2="${px(l.x + l.l)}" y2="${px(l.y)}" stroke="#0a0" stroke-width="3"/>`;
  if (t.aiguillage) {
    const a = t.aiguillage;
    g += `<circle cx="${px(a.x)}" cy="${px(a.y)}" r="5" fill="#f0f"/>`;
    for (const v of [a.versVerrou, a.versElement]) if (v) g += `<line x1="${px(a.x)}" y1="${px(a.y)}" x2="${px(v.x)}" y2="${px(v.y)}" stroke="#f0f" stroke-dasharray="3 3"/>`;
  }
  if (t.mini) {
    const sens = t.mini.cote === 0 ? 1 : -1;
    const x = t.mini.cote === 0 ? px(t.mini.x) : 368 - px(t.mini.x);
    g += `<line x1="${x}" y1="${px(t.mini.y)}" x2="${x + sens * px(t.mini.longueur) * 0.87}" y2="${px(t.mini.y) + px(t.mini.longueur) * 0.5}" stroke="#16a085" stroke-width="9" stroke-linecap="round"/>`;
  }
  g += `<line x1="112" y1="640" x2="172" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/><line x1="256" y1="640" x2="196" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/></g>`;
  corps += g;
});
writeFileSync(sortie, `<svg xmlns="http://www.w3.org/2000/svg" width="${400 * PLANS.length}" height="780" viewBox="0 0 ${400 * PLANS.length} 780">${corps}</svg>`);
console.log("écrit", sortie);
