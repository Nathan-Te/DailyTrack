import { writeFileSync } from "node:fs";
import { plusLongueSerie, pasEnMs } from "../src/index";
import { UNITE, dansLaZoneDeTir, obstaclesDansLaZone, zoneDeTir, Partie, cleDeTable, fenetresDeTir, FENETRE_MIN_MS, toutesLesTables, tirsDuBatteur, billeTenue, GAUCHE, DROITE, type Contenu } from "../src/index";

// `npm run fenetres:pinball -w @cdj/pinball-sim -- [--plan=tremplin] [--theme=volcan] [--cle=<début de clé>] [--n=4] [--detail]` : les fenêtres de tir humaines (lot PBL2) de quelques tables.
const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
import { appliquerParams } from "./params-plan";
const plan = valeur("plan");
if (valeur("params")) appliquerParams(plan!, valeur("params")!);
const theme = valeur("theme");
const cle = valeur("cle");
const n = Number(valeur("n") ?? 1);
const regex = valeur("regex");
let tables: Contenu[] = toutesLesTables().filter((c) => (!plan || c.plan === plan) && (!theme || c.theme === theme) && (!cle || cleDeTable(c).startsWith(cle)) && (!regex || new RegExp(regex).test(cleDeTable(c))));
if (args.includes("--defauts")) {
  const vus = new Set<string>();
  tables = tables.filter((c) => !vus.has(`${c.plan}:${c.theme}`) && vus.add(`${c.plan}:${c.theme}`));
} else if (n > 0) tables = tables.filter((_, i) => i % Math.max(1, Math.floor(tables.length / n)) === 0).slice(0, n);
for (const c of tables) {
  const t0 = performance.now();
  const f = fenetresDeTir(c);
  console.log(`${cleDeTable(c)}  (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  for (const [o, [g, d]] of Object.entries(f.objectifs)) console.log(`   ${o.padEnd(8)} gauche ${String(g).padStart(3)} pas, droit ${String(d).padStart(3)} pas → ${f.ms[o]} ms ${f.ms[o]! >= FENETRE_MIN_MS ? "" : "  <<< SOUS LE SEUIL"}`);
  if (args.includes("--detail")) {
    for (const [nom, e] of [["gauche", f.fermee[0]], ["droit", f.fermee[1]], ["gauche, porte ouverte", f.ouverte[0]], ["droit, porte ouverte", f.ouverte[1]]] as const) {
      const runs: string[] = [];
      let k = 0;
      while (k < e.length) {
        let j = k;
        while (j + 1 < e.length && e[j + 1] === e[k]) j++;
        runs.push(`${k}-${j}:${e[k]}`);
        k = j + 1;
      }
      console.log(`   ${nom} (${e.length} moments) : ${runs.join("  ")}`);
    }
  }
}
if (args.includes("--tenue")) {
  for (const cote of [GAUCHE, DROITE] as const) {
    const b = billeTenue(tables[0]!, cote);
    console.log(`bille tenue côté ${cote} : ${b ? `posée en (${b.x}, ${b.y}) après ${b.pasPour} pas` : "jamais posée"}`);
  }
  console.log(tirsDuBatteur(tables[0]!, GAUCHE).etiquettes.length);
}
if (args.includes("--zone")) {
  const z = zoneDeTir();
  console.log(`zone de tir : ${z.casesMarquees} cases de 4 px`);
  // la carte, une ligne par 16 px (y de 380 à 660), une colonne par 8 px
  for (let y = 380; y <= 660; y += 16) {
    let l = "";
    for (let x = 0; x < 376; x += 6) l += dansLaZoneDeTir(x, y) ? "#" : ".";
    console.log(`${String(y).padStart(3)} ${l}`);
  }
  for (const c of tables) console.log(`${cleDeTable(c)} : ${obstaclesDansLaZone(new Partie(c).table).map((o) => `${o.nom}@${o.x},${o.y}`).join(" ") || "aucun obstacle"}`);
}
// --svg=fichier.svg : les tables dessinées (murs, rails, modules, porte) avec les trajectoires du geste (un moment de frappe sur `--pas=6`), colorées par ce que la bille touche en premier ; la zone de tir en gris clair.
const svg = valeur("svg");
if (svg) {
  const pas = Number(valeur("pas") ?? 6);
  const couleur = (e: string): string => (e === "mission" ? "#e6b800" : e === "verrou" ? "#1f6feb" : e === "porte" ? "#d62faa" : e.startsWith("rampe") || e === "orbite" ? "#1a9e3f" : e.startsWith("mur:") ? "#888" : e === "rien" ? "#ccc" : e === "recul" ? "#c60" : "#a55");
  const px = (u: number): number => Math.round((u / UNITE) * 10) / 10;
  let corps = "";
  const z = zoneDeTir();
  tables.forEach((c, k) => {
    const p = new Partie(c);
    const t = p.table;
    let g = `<g transform="translate(${k * 392},0)"><rect width="380" height="780" fill="#f7f3ea"/><text x="6" y="14" font-size="10" font-family="sans-serif">${cleDeTable(c)}</text>`;
    for (let gy = 0; gy < 190; gy++) for (let gx = 0; gx < 94; gx++) if (z.cases[gy * 94 + gx]) g += `<rect x="${gx * 4}" y="${gy * 4}" width="4" height="4" fill="#cfe3ff" fill-opacity="0.35"/>`;
    for (const m of t.murs) g += `<line x1="${px(m.ax)}" y1="${px(m.ay)}" x2="${px(m.bx)}" y2="${px(m.by)}" stroke="${m.type === 2 ? "#e67e22" : "#444"}" stroke-width="2"/>`;
    for (const b of t.bumpers) g += `<circle cx="${px(b.x)}" cy="${px(b.y)}" r="${px(b.r)}" fill="#f5b7b1" stroke="#c0392b"/>`;
    for (const q of [...t.plateaux, ...t.tourbillons, ...t.trousNoirs, ...t.geysers, ...t.portails]) g += `<circle cx="${px(q.x)}" cy="${px(q.y)}" r="${px(q.r)}" fill="none" stroke="#2471a3" stroke-dasharray="4 3"/>`;
    for (const q of t.trous) g += `<circle cx="${px(q.x)}" cy="${px(q.y)}" r="${px(q.r)}" fill="#111"/>`;
    for (const q of t.spinners) g += `<rect x="${px(q.x - q.l)}" y="${px(q.y) - 6}" width="${px(2 * q.l)}" height="12" fill="#a9dfbf"/>`;
    t.rails.forEach((r) => (g += `<polyline fill="none" stroke="#1a9e3f" stroke-width="4" stroke-opacity="0.35" points="${r.x.map((x, j) => `${px(x)},${px(r.y[j]!)}`).join(" ")}"/>`));
    for (const o of t.portes) g += `<line x1="${px(o.seg.ax)}" y1="${px(o.seg.ay)}" x2="${px(o.seg.bx)}" y2="${px(o.seg.by)}" stroke="#000" stroke-width="3"/>`;
    if (t.passage) g += `<line x1="${px(t.passage.battant.ax)}" y1="${px(t.passage.battant.ay)}" x2="${px(t.passage.battant.bx)}" y2="${px(t.passage.battant.by)}" stroke="#e00" stroke-width="4"/>`;
    if (t.mini) {
      const sens = t.mini.cote === 0 ? 1 : -1;
      const x = t.mini.cote === 0 ? px(t.mini.x) : 368 - px(t.mini.x);
      g += `<line x1="${x}" y1="${px(t.mini.y)}" x2="${x + sens * px(t.mini.longueur) * 0.87}" y2="${px(t.mini.y) + px(t.mini.longueur) * 0.5}" stroke="#16a085" stroke-width="9" stroke-linecap="round"/>`;
    }
    for (const [i, ouverte] of [[0, false], [1, false], [0, true], [1, true]] as const) {
      if (ouverte && !t.passage) continue;
      const r = tirsDuBatteur(c, i === 0 ? GAUCHE : DROITE, { traces: true, ...(ouverte ? { porteOuverte: true } : {}) });
      r.traces!.forEach((tr, d) => {
        const e = r.etiquettes[d]!;
        if (d % pas !== 0 || e === "rien" || (ouverte && e !== "porte")) return;
        if (!ouverte && e === "porte") return;
        g += `<polyline fill="none" stroke="${couleur(e)}" stroke-width="1.2" stroke-opacity="0.8" points="${tr.x.map((x, j) => `${x},${tr.y[j]}`).join(" ")}"/>`;
      });
    }
    g += `<line x1="112" y1="640" x2="172" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/><line x1="256" y1="640" x2="196" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/></g>`;
    corps += g;
  });
  writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" width="${392 * tables.length}" height="780" viewBox="0 0 ${392 * tables.length} 780">${corps}</svg>`);
  console.log("écrit", svg);
}
if (args.includes("--resume")) {
  for (const c of tables) {
    const f = fenetresDeTir(c);
    console.log(`${cleDeTable(c).padEnd(62)} ${Object.entries(f.ms).map(([o, ms]) => `${o} ${String(ms).padStart(3)}${ms >= FENETRE_MIN_MS ? " " : "!"}`).join("  ")}`);
  }
}
// --ordinaires : les fenêtres des modules ordinaires (bumpers, cibles… : ce qu'un joueur vise sans y penser) sur les tables par défaut — de quoi justifier le seuil humain (README du lot PBL2)
if (args.includes("--ordinaires")) {
  const toutes: number[] = [];
  for (const c of tables) {
    const f = fenetresDeTir(c);
    const noms = new Set([...f.fermee[0], ...f.fermee[1]].filter((e) => /^S\d+:/.test(e)));
    for (const nom of noms) {
      const w = Math.max(plusLongueSerie(f.fermee[0], nom), plusLongueSerie(f.fermee[1], nom));
      toutes.push(pasEnMs(w));
    }
  }
  toutes.sort((a, b) => a - b);
  const q = (p: number): number => toutes[Math.min(toutes.length - 1, Math.floor((toutes.length * p) / 100))]!;
  console.log(`modules ordinaires touchés en premier : ${toutes.length} ; fenêtre (ms) min ${toutes[0]}, 25 % ${q(25)}, médiane ${q(50)}, 75 % ${q(75)}, max ${toutes[toutes.length - 1]}`);
}
