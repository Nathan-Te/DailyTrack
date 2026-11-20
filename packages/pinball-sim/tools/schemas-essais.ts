import { mkdirSync, writeFileSync } from "node:fs";
import { MISSION_DU_THEME, MODULES_DE_MISSION, PLANS_ESSAI, Partie, UNITE, dailyPinball, fenetresDeTir, formesDeLaTable, nomDuModule, pasEnMs, tirsDeConception, DENSITE_MAX, densite } from "../src/index";

// `npm run schemas-essais:pinball -w @cdj/pinball-sim -- <dossier> [--miroir]` : **la fiche de tir de chaque plan d'essai** (lot PBT0) — un schéma vu de dessus (le thème Fête foraine : un SVG par plan, que le README convertit en PNG avec le Chromium de Playwright), les tirs numérotés, leur fenêtre en ms,
// le batteur d'où on les prend (le meilleur des deux) et ce qu'ils font. Aucun réseau.
const args = process.argv.slice(2);
const dossier = args.find((a) => !a.startsWith("--")) ?? "schemas";
const miroir = args.includes("--miroir");
mkdirSync(dossier, { recursive: true });
const px = (u: number): number => Math.round((u / UNITE) * 10) / 10;
const QUOI: Record<string, string> = {
  mission: "l'élément du thème (ici le manège) : la mission — 5 tours",
  verrou: "le trou : le verrou, après la mission (deux billes lancent la multibille)",
  rampe1: "la rampe : 800 points, un rang de combo ; la bille revient par un couloir de retour",
  orbite: "l'orbite (bouche libre) : 500 points, un rang de combo ; ouvre la porte sans banque",
  porte: "la porte ouverte : 4 000 points et un cran de mission",
  banque: "trois cibles : 2 000 points, ouvre la porte",
};
const cles = (n: string): string => (n.startsWith("S") && n.endsWith(":cibles") ? "banque" : n);
for (const plan of PLANS_ESSAI) {
  const id = miroir ? `${plan.id}m` : plan.id;
  const c = dailyPinball(0, undefined, "foire", id);
  const t = new Partie(c).table;
  const f = fenetresDeTir(c);
  const tirs = tirsDeConception(c);
  const d = densite(t);
  const nums: { n: number; x: number; y: number; nom: string; ms: number; depuis: string; quoi: string }[] = [];
  const ajouter = (nom: string, x: number, y: number): void => {
    const g = f.objectifs[nom];
    const ms = tirs.ms[nom] ?? 0;
    const depuis = g ? (g[0] > g[1] ? "batteur gauche" : g[1] > g[0] ? "batteur droit" : "les deux") : "les deux";
    nums.push({ n: nums.length + 1, x, y, nom, ms, depuis, quoi: QUOI[cles(nom)] ?? "" });
  };
  const elt = t.poses.find((q) => (MODULES_DE_MISSION[MISSION_DU_THEME.foire] as readonly string[]).includes(q.type))!;
  ajouter("mission", px(elt.x), px(elt.y));
  const v = t.trous[t.verrou]!;
  ajouter("verrou", px(v.x), px(v.y));
  t.rails.forEach((r, i) => {
    const nom = r.genre === "orbite" ? "orbite" : "rampe1";
    const bouche = t.portes.find((g) => g.rail === i && g.bout === 0)!;
    ajouter(nom, px(bouche.x), px(bouche.y));
  });
  if (t.passage) ajouter("porte", px(t.passage.x), px(t.passage.y));
  for (const q of t.poses.filter((q) => q.type === "cibles")) {
    const nom = nomDuModule(q);
    const g = tirs.ms[nom];
    if (g === undefined) continue;
    ajouter(nom, px(q.x), px(q.y));
  }
  let corps = `<rect width="820" height="800" fill="#f7f3ea"/>`;
  corps += `<text x="14" y="26" font-size="20" font-weight="700" font-family="sans-serif">${id} — ${plan.idee}</text>`;
  corps += `<g transform="translate(10,40)">`;
  corps += `<path d="M20 560 L20 205 A176.25 176.25 0 0 1 372.5 205 L372.5 718 L348 718 L348 255 L348 560 L250 634 M20 560 L118 634" fill="none" stroke="#555" stroke-width="2.5"/>`;
  for (const m of t.murs) if (m.type !== 2 && m.ax !== m.bx || m.type !== 2 && m.ay !== m.by) corps += `<line x1="${px(m.ax)}" y1="${px(m.ay)}" x2="${px(m.bx)}" y2="${px(m.by)}" stroke="#999" stroke-width="1.2"/>`;
  t.rails.forEach((r) => (corps += `<polyline fill="none" stroke="#1a9e3f" stroke-width="10" stroke-opacity="0.35" stroke-linecap="round" points="${r.x.map((x, j) => `${px(x)},${px(r.y[j]!)}`).join(" ")}"/><polyline fill="none" stroke="#1a9e3f" stroke-width="2" points="${r.x.map((x, j) => `${px(x)},${px(r.y[j]!)}`).join(" ")}"/>`));
  // lot PBT0b : la ligne de visée de chaque bouche, du point entre les batteurs : libre de tout obstacle
  for (const o of t.portes) corps += `<line x1="184" y1="650" x2="${px(o.x)}" y2="${px(o.y)}" stroke="#1a9e3f" stroke-width="1" stroke-dasharray="4 4" stroke-opacity="0.7"/>`;
  for (const o of t.portes) corps += `<line x1="${px(o.seg.ax)}" y1="${px(o.seg.ay)}" x2="${px(o.seg.bx)}" y2="${px(o.seg.by)}" stroke="#0a7" stroke-width="3"/>`;
  for (const q of formesDeLaTable(t)) {
    if (q.nom.startsWith("bouche:") || q.nom === "porte") continue;
    const nom = q.nom.split(":")[1];
    const couleur = nom === "bumpers" || nom === "mini" ? "#f0b8b0" : nom === "cibles" ? "#f5cf9a" : nom === "manege" ? "#f6e3a8" : nom === "trou" ? "#222" : "#cfe3ff";
    if (q.genre === "disque") corps += `<circle cx="${q.x}" cy="${q.y}" r="${q.r}" fill="${couleur}" stroke="#8a5a44" stroke-width="1"/>`;
    else corps += `<line x1="${q.ax}" y1="${q.ay}" x2="${q.bx}" y2="${q.by}" stroke="${couleur}" stroke-width="${2 * q.r}" stroke-linecap="round" stroke-opacity="0.9"/>`;
  }
  if (t.passage) corps += `<line x1="${px(t.passage.battant.ax)}" y1="${px(t.passage.battant.ay)}" x2="${px(t.passage.battant.bx)}" y2="${px(t.passage.battant.by)}" stroke="#d62" stroke-width="5"/>` + t.murs.slice(-2).map((m) => `<line x1="${px(m.ax)}" y1="${px(m.ay)}" x2="${px(m.bx)}" y2="${px(m.by)}" stroke="#d62" stroke-width="2"/>`).join("");
  if (t.mini) {
    const sens = t.mini.cote === 0 ? 1 : -1;
    const x = t.mini.cote === 0 ? px(t.mini.x) : 368 - px(t.mini.x);
    corps += `<line x1="${x}" y1="${px(t.mini.y)}" x2="${x + sens * px(t.mini.longueur) * 0.94}" y2="${px(t.mini.y) + px(t.mini.longueur) * 0.34}" stroke="#16a085" stroke-width="9" stroke-linecap="round"/>`;
  }
  corps += `<line x1="112" y1="640" x2="172" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/><line x1="256" y1="640" x2="196" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/>`;
  for (const n of nums) corps += `<circle cx="${n.x}" cy="${n.y}" r="11" fill="#111" stroke="#fff" stroke-width="2"/><text x="${n.x}" y="${n.y + 4.5}" font-size="13" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">${n.n}</text>`;
  corps += `<text x="10" y="690" font-size="11" fill="#666" font-family="sans-serif">rails verts · porte en orange · pointillés : la ligne de visée libre de chaque bouche</text>`;
  corps += `</g>`;
  // la liste des tirs à droite
  let y = 70;
  corps += `<text x="400" y="${y}" font-size="14" font-weight="700" font-family="sans-serif">${nums.length} tirs (fenêtre en ms, depuis)</text>`;
  for (const n of nums) {
    y += 34;
    corps += `<circle cx="412" cy="${y - 4}" r="10" fill="#111"/><text x="412" y="${y}" font-size="12" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">${n.n}</text>`;
    corps += `<text x="430" y="${y - 6}" font-size="12" font-weight="700" font-family="sans-serif">${n.nom} — ${n.ms} ms — ${n.depuis}</text>`;
    corps += `<text x="430" y="${y + 8}" font-size="10" fill="#444" font-family="sans-serif">${n.quoi}</text>`;
  }
  corps += `<text x="400" y="${y + 50}" font-size="11" fill="#444" font-family="sans-serif">densité ${d.total} ‰ (plafond ${DENSITE_MAX}) : obstacles ${d.obstacles}, rails ${d.rails}</text>`;
  writeFileSync(`${dossier}/schema-${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="800" viewBox="0 0 820 800">${corps}</svg>`);
  console.log(`schema-${id}.svg : ${nums.map((n) => `${n.n}=${n.nom} ${n.ms} ms ${n.depuis}`).join(" ; ")}`);
}
