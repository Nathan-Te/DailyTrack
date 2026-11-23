import { PLANS, dailyPinball, fenetresDeTir } from "../src/index";

// `npm run tolerance:pinball -w @cdj/pinball-sim -- <table> <thème> <verrou|mission|rampe|orbite> <objectif>` (lot PBT1) : la recherche bornée de la règle « un élément ne bouge pas de plus de 15 px » — la meilleure fenêtre de tir
// (ms) de l'objectif quand on déplace l'élément (ou, pour `rampe`, la bouche : guides et premier point du rail ; pour `orbite`, la bouche du couloir : porte et pied du guide) de −15 à +15 px, par pas de 3 px.
// Exemple : `-- A foire verrou verrou`, `-- B foire rampe rampe1`. Le plan est modifié en mémoire seulement.
const [id, theme, quoi, objectif] = process.argv.slice(2);
const plan = PLANS.find((p) => p.id === id)! as any;
const copie = JSON.parse(JSON.stringify(plan));
const restaurer = () => { for (const k of Object.keys(copie)) plan[k] = JSON.parse(JSON.stringify(copie[k])); };
function deplacer(dx: number, dy: number) {
  restaurer();
  if (quoi === "verrou") { plan.emplacements[1].x += dx; plan.emplacements[1].y += dy; }
  if (quoi === "mission") { plan.emplacements[0].x += dx; plan.emplacements[0].y += dy; }
  if (quoi === "rampe") {
    for (const g of plan.guides) if (g.genre === "bouche") for (const p of g.points) { p[0] += dx; p[1] += dy; }
    plan.rampes[0].points[0][0] += dx; plan.rampes[0].points[0][1] += dy;
  }
  if (quoi === "banque") {
    const e = plan.emplacements[3];
    e.x += dx; e.y += dy;
    for (const c of e.banque.cibles) { c[0] += dx; c[1] += dy; c[2] += dx; c[3] += dy; }
    const f = e.banque.fond; f[0] += dx; f[1] += dy; f[2] += dx; f[3] += dy;
  }
  if (quoi === "orbite") {
    plan.porte.y += dy; plan.guides[0].points[0][1] += dy; // la bouche du couloir monte ou descend
  }
}
let meilleur = { ms: -1, dx: 0, dy: 0 };
const pas = 3;
const lignes: string[] = [];
for (let dy = -15; dy <= 15; dy += pas) {
  let ligne = `dy ${String(dy).padStart(3)}: `;
  for (let dx = -15; dx <= 15; dx += pas) {
    if (quoi === "orbite" && dx !== 0) continue;
    deplacer(dx, dy);
    const c = dailyPinball(1, undefined, theme as never, id, false);
    const f = fenetresDeTir(c);
    const ms = f.ms[objectif!] ?? -1;
    ligne += String(ms).padStart(4);
    if (ms > meilleur.ms) meilleur = { ms, dx, dy };
  }
  lignes.push(ligne);
}
console.log(`${id} ${theme} ${quoi} → ${objectif} : meilleur ${meilleur.ms} ms en (dx ${meilleur.dx}, dy ${meilleur.dy})  [colonnes dx −15…+15]`);
console.log(lignes.join("\n"));
