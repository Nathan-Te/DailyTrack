import { writeFileSync } from "node:fs";
import { DROITE, GAUCHE, Partie, THEMES_PINBALL, UNITE, cleDeTable, dailyPinball, defautsDeConception, densite, formesDeLaTable, tirsDeConception, tirsDuBatteur, zoneDeTir, DENSITE_MAX, FENETRE_MIN_MS, type ThemePinball } from "../src/index";

// OUTIL DU LOT PBT0 : les règles de conception d'un plan. `npm run conception:pinball -w @cdj/pinball-sim -- --plan=t1[m] [--theme=volcan|tous] [--svg=plan.svg] [--sans-tirs]`
// Pour chaque thème : les défauts de conception (rails qui gênent, poche, densité), les tirs et leurs fenêtres (ms), et, avec `--svg`, la table dessinée avec les trajectoires du geste de référence colorées par ce que la bille touche en premier.
const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const plan = valeur("plan") ?? "t1";
const themes: ThemePinball[] = !valeur("theme") || valeur("theme") === "tous" ? [...THEMES_PINBALL] : [valeur("theme") as ThemePinball];
const px = (u: number): number => Math.round((u / UNITE) * 10) / 10;
let corps = "";
themes.forEach((theme, k) => {
  const c = dailyPinball(0, undefined, theme, plan);
  const p = new Partie(c);
  const t = p.table;
  const d = densite(t);
  const defauts = defautsDeConception(t);
  console.log(`${cleDeTable(c)}  densité ${d.total} ‰ (obstacles ${d.obstacles}, rails ${d.rails}; plafond ${DENSITE_MAX})`);
  for (const m of defauts) console.log(`   ✗ ${m}`);
  let tirs: ReturnType<typeof tirsDeConception> | null = null;
  if (!args.includes("--sans-tirs")) {
    tirs = tirsDeConception(c);
    console.log(`   ${tirs.nombre} tirs : ${Object.entries(tirs.ms).map(([o, ms]) => `${o} ${ms}${ms >= FENETRE_MIN_MS ? "" : " ✗"}`).join("  ")}`);
  }
  if (valeur("svg")) {
    const couleur = (e: string): string => (e === "mission" ? "#e6b800" : e === "verrou" ? "#1f6feb" : e === "porte" ? "#d62faa" : e.startsWith("rampe") || e === "orbite" ? "#1a9e3f" : e.startsWith("mur:") ? "#888" : e === "rien" ? "#ccc" : e === "recul" ? "#c60" : "#a55");
    let g = `<g transform="translate(${k * 392},0)"><rect width="380" height="780" fill="#f7f3ea"/><text x="6" y="14" font-size="10" font-family="sans-serif">${cleDeTable(c)} · ${d.total} ‰${defauts.length ? " · " + defauts.length + " défauts" : ""}</text>`;
    const z = zoneDeTir();
    for (let gy = 0; gy < 190; gy++) for (let gx = 0; gx < 94; gx++) if (z.cases[gy * 94 + gx]) g += `<rect x="${gx * 4}" y="${gy * 4}" width="4" height="4" fill="#cfe3ff" fill-opacity="0.35"/>`;
    for (const m of t.murs) g += `<line x1="${px(m.ax)}" y1="${px(m.ay)}" x2="${px(m.bx)}" y2="${px(m.by)}" stroke="${m.type === 2 ? "#e67e22" : "#444"}" stroke-width="2"/>`;
    for (const f of formesDeLaTable(t)) {
      if (f.nom.startsWith("bouche:")) continue;
      if (f.genre === "disque") g += `<circle cx="${f.x}" cy="${f.y}" r="${f.r}" fill="#f5b7b1" fill-opacity="0.35" stroke="#c0392b" stroke-width="0.6"/>`;
      else g += `<line x1="${f.ax}" y1="${f.ay}" x2="${f.bx}" y2="${f.by}" stroke="#c0392b" stroke-opacity="0.25" stroke-width="${2 * f.r}" stroke-linecap="round"/>`;
    }
    for (const b of t.bumpers) g += `<circle cx="${px(b.x)}" cy="${px(b.y)}" r="${px(b.r)}" fill="#f5b7b1" stroke="#c0392b"/>`;
    for (const q of [...t.plateaux, ...t.tourbillons, ...t.trousNoirs, ...t.geysers, ...t.portails]) g += `<circle cx="${px(q.x)}" cy="${px(q.y)}" r="${Math.min(px(q.r), 60)}" fill="none" stroke="#2471a3" stroke-dasharray="4 3"/>`;
    for (const q of t.trous) g += `<circle cx="${px(q.x)}" cy="${px(q.y)}" r="${px(q.r)}" fill="#111"/>`;
    for (const q of t.spinners) g += `<rect x="${px(q.x - q.l)}" y="${px(q.y) - 6}" width="${px(2 * q.l)}" height="12" fill="#a9dfbf"/>`;
    t.rails.forEach((r) => (g += `<polyline fill="none" stroke="#1a9e3f" stroke-width="12" stroke-opacity="0.35" points="${r.x.map((x, j) => `${px(x)},${px(r.y[j]!)}`).join(" ")}"/>`));
    for (const o of t.portes) g += `<line x1="${px(o.seg.ax)}" y1="${px(o.seg.ay)}" x2="${px(o.seg.bx)}" y2="${px(o.seg.by)}" stroke="#000" stroke-width="3"/>`;
    if (t.passage) g += `<line x1="${px(t.passage.battant.ax)}" y1="${px(t.passage.battant.ay)}" x2="${px(t.passage.battant.bx)}" y2="${px(t.passage.battant.by)}" stroke="#e00" stroke-width="4"/>`;
    if (t.mini) {
      const sens = t.mini.cote === 0 ? 1 : -1;
      const x = t.mini.cote === 0 ? px(t.mini.x) : 368 - px(t.mini.x);
      g += `<line x1="${x}" y1="${px(t.mini.y)}" x2="${x + sens * px(t.mini.longueur) * 0.87}" y2="${px(t.mini.y) + px(t.mini.longueur) * 0.5}" stroke="#16a085" stroke-width="9" stroke-linecap="round"/>`;
    }
    if (t.aiguillage) g += `<circle cx="${px(t.aiguillage.x)}" cy="${px(t.aiguillage.y)}" r="4" fill="#f0f"/>`;
    if (!args.includes("--sans-trajets")) {
      for (const [i, ouverte] of [[0, false], [1, false], [0, true], [1, true]] as const) {
        if (ouverte && !t.passage) continue;
        const r = tirsDuBatteur(c, i === 0 ? GAUCHE : DROITE, { traces: true, ...(ouverte ? { porteOuverte: true } : {}) });
        r.traces!.forEach((tr, dd) => {
          const e = r.etiquettes[dd]!;
          if (dd % 8 !== 0 || e === "rien" || (ouverte && e !== "porte") || (!ouverte && e === "porte")) return;
          g += `<polyline fill="none" stroke="${couleur(e)}" stroke-width="1.2" stroke-opacity="0.8" points="${tr.x.map((x, j) => `${x},${tr.y[j]}`).join(" ")}"/>`;
        });
      }
    }
    c.modules.forEach((m, i) => (g += `<text x="${px(t.poses[i]!.x)}" y="${px(t.poses[i]!.y) + 3}" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#333">${i}:${m}</text>`));
    if (tirs) g += `<text x="6" y="770" font-size="9" font-family="sans-serif">${Object.entries(tirs.ms).map(([o, ms]) => `${o} ${ms}`).join(" · ")}</text>`;
    g += `<line x1="112" y1="640" x2="172" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/><line x1="256" y1="640" x2="196" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/></g>`;
    corps += g;
  }
});
if (valeur("svg")) {
  writeFileSync(valeur("svg")!, `<svg xmlns="http://www.w3.org/2000/svg" width="${392 * themes.length}" height="780" viewBox="0 0 ${392 * themes.length} 780">${corps}</svg>`);
  console.log("écrit", valeur("svg"));
}
