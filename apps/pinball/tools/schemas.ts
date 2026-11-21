import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { DROITE, GAUCHE, Partie, UNITE, dailyPinball, fenetresDeTir, plusLongueSerie, pasEnMs, tirsDuBatteur, zoneDeTir, FENETRE_MIN_MS, type Contenu, type Table } from "@cdj/pinball-sim";

// `npm run schemas -w @cdj/pinball` (lot PBT1) : **un schéma vu de dessus par table**, généré depuis le code (la table A, B et C en Fête foraine, de face) dans `docs/pinball/lots/captures-pbt1/schema-<A|B|C>.svg` et
// `.png` : le châssis, tous les éléments, l'éventail des tirs du geste de référence (chaque trajectoire colorée par ce que la bille touche en premier) et, dans la légende, **chaque tir numéroté comme sur les dessins de
// Nathan** avec sa fenêtre de tir en ms (le seuil humain est de 30 ms). Les trajectoires de la porte et de l'orbite sont celles du tir porte ouverte. Aucune base, aucun réseau.
const SORTIE = new URL("../../../docs/pinball/lots/captures-pbt1/", import.meta.url).pathname;
const COULEURS: Record<string, string> = { mission: "#E6A700", verrou: "#1f6feb", rampe1: "#1a9e3f", orbite: "#7fb800", porte: "#d62faa", banque: "#e67e22", bumpers: "#c0392b" };
const px = (u: number): number => Math.trunc((u / UNITE) * 10) / 10;
const ARC = (cx: number, cy: number, r: number): string => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#8e44ad" stroke-dasharray="3 3"/>`;

/** Les tirs numérotés d'une table, dans l'ordre des dessins de Nathan : le numéro, le nom, l'objectif mesuré, le point où poser la pastille. */
interface Tir {
  n: string;
  nom: string;
  objectif: string;
  x: number;
  y: number;
}
function tirsDeLaTable(id: string, t: Table): Tir[] {
  const pose = (type: string) => t.poses.find((q) => q.type === type)!;
  const element = t.poses.find((q) => q.emplacement === 0)!;
  const verrou = t.trous[t.verrou]!;
  const banque = pose("cibles");
  const bumpers = t.poses.find((q) => q.type === "bumpers" || q.type === "asteroide")!;
  const tir = (n: string, nom: string, objectif: string, x: number, y: number): Tir => ({ n, nom, objectif, x: px(x), y: px(y) });
  const orbite = t.rails.findIndex((r) => r.genre === "orbite");
  const rampe = t.rails.findIndex((r) => r.genre === "rampe");
  const bouche = (rang: number): [number, number] => [t.portes.find((g) => g.rail === rang)!.x, t.portes.find((g) => g.rail === rang)!.y];
  const nBanque = `S${banque.emplacement + 1}:cibles`;
  const nBumpers = `S${bumpers.emplacement + 1}:${bumpers.type}`;
  if (id === "A") return [tir("1", "orbite", "orbite", ...bouche(orbite)), tir("2", "mission", "mission", element.x, element.y), tir("3", "verrou", "verrou", verrou.x, verrou.y), tir("4", "banque", nBanque, banque.x, banque.y), tir("P", "bumpers", nBumpers, bumpers.x, bumpers.y)];
  if (id === "B") return [tir("1", "orbite", "orbite", ...bouche(orbite)), tir("2", "banque", nBanque, banque.x, banque.y), tir("3", "mission", "mission", element.x, element.y), tir("4", "verrou", "verrou", verrou.x, verrou.y), tir("5", "rampe", "rampe1", ...bouche(rampe)), tir("P", "bumpers", nBumpers, bumpers.x, bumpers.y)];
  return [tir("M", "mini-batteur", "", t.mini!.x, t.mini!.y), tir("1", "banque", nBanque, banque.x, banque.y), tir("2", "mission", "mission", element.x, element.y), tir("3", "verrou", "verrou", verrou.x, verrou.y), tir("4", "rampe", "rampe1", ...bouche(rampe))];
}

function schema(c: Contenu): string {
  const p = new Partie(c);
  const t = p.table;
  const f = fenetresDeTir(c);
  const zone = zoneDeTir();
  let g = `<rect width="640" height="780" fill="#f7f3ea"/><text x="8" y="16" font-size="12" font-family="sans-serif" font-weight="bold">Table ${c.plan}${c.miroir ? " (miroir)" : ""} — ${c.theme} — fenêtre de tir humaine : au moins ${FENETRE_MIN_MS} ms</text>`;
  // la zone de tir libre
  for (let gy = 0; gy < 190; gy++) for (let gx = 0; gx < 94; gx++) if (zone.cases[gy * 94 + gx]) g += `<rect x="${gx * 4}" y="${gy * 4}" width="4" height="4" fill="#cfe3ff" fill-opacity="0.35"/>`;
  // les trajectoires du geste de référence (un moment de frappe sur quatre), porte fermée, puis porte ouverte pour l'orbite et la porte
  for (const [cote, ouverte] of [[GAUCHE, false], [DROITE, false], [GAUCHE, true], [DROITE, true]] as const) {
    if (ouverte && !t.passage) continue;
    const r = tirsDuBatteur(c, cote, { traces: true, ...(ouverte ? { porteOuverte: true } : {}) });
    r.traces!.forEach((tr, d) => {
      const e = r.etiquettes[d]!;
      if (d % 4 !== 0 || e === "rien" || e === "recul") return;
      if (ouverte !== (e === "porte" || e === "orbite")) return;
      const couleur = COULEURS[e] ?? (e.endsWith("cibles") ? COULEURS.banque! : e.endsWith("bumpers") || e.endsWith("asteroide") ? COULEURS.bumpers! : "#999");
      g += `<polyline fill="none" stroke="${couleur}" stroke-width="1.1" stroke-opacity="0.75" points="${tr.x.map((x, j) => `${x},${tr.y[j]}`).join(" ")}"/>`;
    });
  }
  // les murs (le châssis et les guides), les cibles
  for (const m of t.murs) g += `<line x1="${px(m.ax)}" y1="${px(m.ay)}" x2="${px(m.bx)}" y2="${px(m.by)}" stroke="${m.type === 2 ? "#e67e22" : "#333"}" stroke-width="${m.type === 2 ? 4 : 2.2}"/>`;
  for (const r of t.rails) g += `<polyline fill="none" stroke="#1a9e3f" stroke-width="6" stroke-opacity="0.3" points="${r.x.map((x, j) => `${px(x)},${px(r.y[j]!)}`).join(" ")}"/>`;
  for (const o of t.portes) g += `<line x1="${px(o.seg.ax)}" y1="${px(o.seg.ay)}" x2="${px(o.seg.bx)}" y2="${px(o.seg.by)}" stroke="#000" stroke-width="3"/>`;
  if (t.passage) g += `<line x1="${px(t.passage.battant.ax)}" y1="${px(t.passage.battant.ay)}" x2="${px(t.passage.battant.bx)}" y2="${px(t.passage.battant.by)}" stroke="#d00" stroke-width="5"/>`;
  for (const b of t.bumpers) g += `<circle cx="${px(b.x)}" cy="${px(b.y)}" r="${px(b.r)}" fill="#f5b7b1" stroke="#c0392b" stroke-width="1.5"/>`;
  for (const q of [...t.plateaux, ...t.tourbillons, ...t.trousNoirs, ...t.geysers, ...t.portails]) g += `<circle cx="${px(q.x)}" cy="${px(q.y)}" r="${px(q.r)}" fill="#ffe08a" fill-opacity="0.45" stroke="#b58900" stroke-dasharray="4 3"/>`;
  for (const q of t.trous) g += `<circle cx="${px(q.x)}" cy="${px(q.y)}" r="${px(q.r)}" fill="#111"/>`;
  for (const q of t.spinners) g += `<rect x="${px(q.x - q.l)}" y="${px(q.y) - 5}" width="${px(2 * q.l)}" height="10" fill="#a9dfbf" stroke="#27ae60"/>`;
  if (t.mini) {
    const x = t.mini.cote === 0 ? px(t.mini.x) : 368 - px(t.mini.x);
    const sens = t.mini.cote === 0 ? 1 : -1;
    g += `<line x1="${x}" y1="${px(t.mini.y)}" x2="${x + sens * px(t.mini.longueur) * 0.87}" y2="${px(t.mini.y) + px(t.mini.longueur) * 0.5}" stroke="#16a085" stroke-width="9" stroke-linecap="round"/>`;
  }
  g += ARC(px(t.sauveur.x), px(t.sauveur.y), px(t.sauveur.r));
  g += `<line x1="112" y1="640" x2="172" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/><line x1="256" y1="640" x2="196" y2="660" stroke="#999" stroke-width="10" stroke-linecap="round"/>`;
  // les tirs numérotés : une pastille à leur place, la légende à droite avec la fenêtre en ms
  const tirs = tirsDeLaTable(c.plan, t);
  g += `<text x="392" y="48" font-size="12" font-family="sans-serif" font-weight="bold">Les tirs et leur fenêtre (ms)</text>`;
  tirs.forEach((q, i) => {
    g += `<circle cx="${q.x}" cy="${q.y}" r="10" fill="#fff" stroke="#222" stroke-width="2"/><text x="${q.x}" y="${q.y + 4}" font-size="12" font-weight="bold" text-anchor="middle" font-family="sans-serif">${q.n}</text>`;
    let ms: string;
    if (q.objectif === "") ms = "suit le batteur gauche";
    else if (f.ms[q.objectif] !== undefined) ms = `${f.ms[q.objectif]} ms`;
    else ms = `${Math.max(pasEnMs(plusLongueSerie(f.fermee[0], q.objectif)), pasEnMs(plusLongueSerie(f.fermee[1], q.objectif)))} ms`;
    const couleur = COULEURS[q.objectif] ?? (q.objectif.endsWith("cibles") ? COULEURS.banque! : COULEURS.bumpers!);
    g += `<circle cx="396" cy="${74 + i * 26}" r="9" fill="#fff" stroke="${couleur}" stroke-width="3"/><text x="396" y="${78 + i * 26}" font-size="11" font-weight="bold" text-anchor="middle" font-family="sans-serif">${q.n}</text>`;
    g += `<text x="412" y="${78 + i * 26}" font-size="12" font-family="sans-serif">${q.nom} — ${ms}</text>`;
  });
  const y0 = 80 + tirs.length * 26;
  g += `<text x="392" y="${y0 + 12}" font-size="11" font-family="sans-serif" fill="#555">Traits : le geste de référence des deux batteurs, coloré</text><text x="392" y="${y0 + 26}" font-size="11" font-family="sans-serif" fill="#555">par ce que la bille touche en premier ;</text><text x="392" y="${y0 + 40}" font-size="11" font-family="sans-serif" fill="#555">fond bleu : la zone de tir libre ; rouge : la porte.</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="780" viewBox="0 0 640 780">${g}</svg>`;
}

mkdirSync(SORTIE, { recursive: true });
const fichiers: string[] = [];
for (const id of ["A", "B", "C"]) {
  const c = dailyPinball(1, undefined, "foire", id, false);
  const chemin = `${SORTIE}schema-${id}.svg`;
  writeFileSync(chemin, schema(c));
  fichiers.push(chemin);
  console.log("écrit", chemin);
}
const navigateur = await chromium.launch({ args: ["--no-sandbox"] });
for (const f of fichiers) {
  const page = await navigateur.newPage({ viewport: { width: 640, height: 780 }, deviceScaleFactor: 2 });
  await page.goto(`file://${f}`);
  await page.screenshot({ path: f.replace(".svg", ".png") });
  await page.close();
}
await navigateur.close();
