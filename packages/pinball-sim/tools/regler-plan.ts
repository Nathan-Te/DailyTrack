// @ts-nocheck
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { PLANS, GAUCHE, DROITE, Partie, cleDeTable, fenetresDeTir, obstaclesDansLaZone, orbite, porteDeLOrbite, toutesLesTables, tirsDuBatteur, FENETRE_MIN_MS, THEMES_PINBALL } from "../src/index";

// OUTIL DU LOT PBL2 — un recuit à candidats : `node regler-plan.mjs <plan> <graine> <essais> <sortie.json> [depart.json]`. Les positions (emplacements, bouches des rampes, bouches de l'orbite) ne sont tirées que parmi les
// places où l'éventail des tirs d'un humain (table vide) passe assez longtemps (fenêtre géométrique), puis la table complète les départage par `fenetresDeTir`.
const [idPlan, graineTxt, essaisTxt, sortie, depart] = process.argv.slice(2);
const plan = PLANS.find((p) => p.id === idPlan);
let graine = Number(graineTxt) >>> 0;
const alea = () => ((graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0) / 4294967296);
const entier = (a, b) => a + Math.floor(alea() * (b - a + 1));
const choix = (l) => l[Math.floor(alea() * l.length)];

const vide = { jour: 0, g: 0, theme: "foire", plan: "classique", modules: [] };
const traces = [GAUCHE, DROITE].map((c) => tirsDuBatteur(vide, c, { traces: true, echantillon: 1 }).traces);
const fen = (essai) => Math.max(...traces.map((tr) => { let s = 0, m = 0; for (const t of tr) { s = essai(t) ? s + 1 : 0; if (s > m) m = s; } return m; }));
const winDisque = (r, x, y) => fen((t) => t.x.some((tx, i) => (tx - x) ** 2 + (t.y[i] - y) ** 2 <= r * r));
const winBouche = (x, y, a, vmin = 540) => {
  const ux = Math.sin((a * Math.PI) / 180), uy = -Math.cos((a * Math.PI) / 180), nx = -uy, ny = ux;
  return fen((t) => {
    for (let i = 1; i < t.x.length; i++) {
      const vx = (t.x[i] - t.x[i - 1]) * 600, vy = (t.y[i] - t.y[i - 1]) * 600;
      if (vx * ux + vy * uy < vmin) continue;
      const s0 = (t.x[i - 1] - x) * ux + (t.y[i - 1] - y) * uy, s1 = (t.x[i] - x) * ux + (t.y[i] - y) * uy;
      if (s0 < 0 && s1 >= 0 && Math.abs((t.x[i] - x) * nx + (t.y[i] - y) * ny) <= 14) return true;
    }
    return false;
  });
};
// les candidats
const SEUIL = 24;
const grille = [];
for (let y = 110; y <= 430; y += 8) for (let x = 44; x <= 324; x += 8) grille.push([x, y]);
const cand = (r) => grille.filter(([x, y]) => winDisque(r, x, y) >= SEUIL);
const C13 = cand(13), C22 = cand(22), C14 = cand(14), C40 = grille.filter(([x, y]) => winDisque(40, x, y) >= 36);
const CB = [];
for (let y = 230; y <= 440; y += 10) for (let x = 50; x <= 320; x += 10) for (let a = -40; a <= 40; a += 10) if (winBouche(x, y, a) >= SEUIL) CB.push([x, y, a]);
console.error(`candidats : r13 ${C13.length}, r22 ${C22.length}, r14 ${C14.length}, r40 ${C40.length}, bouches ${CB.length}`);

const rails = plan.rampes;
const base = rails.map((r) => r.points.map((q) => [q[0], q[1]]));
let courant;
const hasard = () => {
  const c = {
    slots: plan.emplacements.map((e) => [e.x, e.y]),
    rails: rails.map(() => { const m = choix(CB); return [m[0], m[1], m[2]]; }),
    orbite: { xg: 80, yg: 280, ag: -10, xd: 288, yd: 280, ad: 10, h: plan.orbite.hauteur, r: 150 },
    porte: entier(0, 1),
  };
  c.slots[1] = choix(C13); c.slots[0] = choix(C40); c.slots[2] = choix(C22); c.slots[4] = choix(C14); c.slots[3] = choix(grille); c.slots[5] = choix(grille);
  const oc = choix(CB.filter((m) => m[0] < 170 && m[1] < 345)); const od = choix(CB.filter((m) => m[0] > 198 && m[1] < 345));
  c.orbite.xg = oc[0]; c.orbite.yg = oc[1]; c.orbite.ag = Math.min(oc[2], 5);
  c.orbite.xd = od[0]; c.orbite.yd = od[1]; c.orbite.ad = Math.max(od[2], -5);
  return c;
};
const baseRails2 = plan.rampes.map((r) => r.points.map((q) => [q[0], q[1]]));
const permisOrig = plan.emplacements.map((e) => [...e.permis]);
function appliquer(p) {
  plan.emplacements.forEach((e, i) => {
    e.x = p.slots[i][0]; e.y = p.slots[i][1];
    e.permis = permisOrig[i].filter((m) => !(m === "spinner" && e.y > 322));
    if (e.permis.length === 0) e.permis = ["mini"];
  });
  rails.forEach((r, k) => {
    const [mx, my, a] = p.rails[k];
    const u = [Math.sin((a * Math.PI) / 180), -Math.cos((a * Math.PI) / 180)];
    r.points = [[mx, my], [Math.round(mx + 44 * u[0]), Math.round(my + 44 * u[1])], ...base[k].slice(2)];
  });
  const o = p.orbite;
  plan.orbite = orbite(o.xg, o.xd, o.yg, o.r, o.h, o.ag, o.ad, o.yd);
  const [mx, my, ag] = p.porte === 0 ? [o.xg, o.yg, o.ag] : [o.xd, o.yd, o.ad];
  plan.porte = porteDeLOrbite(mx, my, ag, p.largeur ?? 40, p.prof ?? 36);
}
// les tables d'évaluation : deux par thème (la première d'un thème d'abord : l'étape rapide)
const toutes = toutesLesTables().filter((c) => c.plan === plan.id);
const parTheme = THEMES_PINBALL.map((th) => toutes.filter((c) => c.theme === th));
const rapide = parTheme.map((l) => l[0]);
const complet = [...rapide, ...parTheme.map((l) => l[Math.floor(l.length / 2)]), ...parTheme.map((l) => l[l.length - 1])];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// contraintes de présentation (le recuit ne connaît pas la taille des éléments) : le thème (rayon 50 à 56) loin des murs, les emplacements écartés, les bouches loin des emplacements, une rampe qui ne fait pas de crochet
const distBord = (x, y) => (y < 205 ? 176.25 - Math.hypot(x - 196.25, y - 205) : Math.min(x - 20, (y >= 255 ? 348 : 372.5) - x));
function sain(p, base) {
  // la porte : son battant incliné d'au moins 25° (une bille posée sur un battant presque plat n'en glisse jamais : bille coincée)
  if (p.porte === 0 ? !(p.orbite.ag <= -25 && p.orbite.ag >= -45) : !(p.orbite.ad >= 25 && p.orbite.ad <= 45)) return false;
  for (let i = 0; i < p.slots.length; i++) if (i !== 1 && distBord(p.slots[i][0], p.slots[i][1]) < (i === 0 ? 80 : 68)) return false;
  if (distBord(p.slots[1][0], p.slots[1][1]) < 40) return false;
  const [s0, ...autres] = p.slots;
  if (s0[0] < 100 || s0[0] > 268 || s0[1] < 190 || s0[1] > 350) return false;
  for (const s of autres) { if (s[0] < 56 || s[0] > 312 || s[1] < 105 || s[1] > 420) return false; if (Math.hypot(s[0] - s0[0], s[1] - s0[1]) < 78) return false; }
  for (let i = 0; i < autres.length; i++) for (let j = i + 1; j < autres.length; j++) if (Math.hypot(autres[i][0] - autres[j][0], autres[i][1] - autres[j][1]) < 60) return false;
  const bouches = [...p.rails.map((r) => [r[0], r[1]]), [p.orbite.xg, p.orbite.yg], [p.orbite.xd, p.orbite.yd]];
  for (const s of p.slots) for (const b of bouches) if (Math.hypot(s[0] - b[0], s[1] - b[1]) < 56) return false;
  for (let i = 0; i < bouches.length; i++) for (let j = i + 1; j < bouches.length; j++) if (Math.hypot(bouches[i][0] - bouches[j][0], bouches[i][1] - bouches[j][1]) < 44) return false;
  for (let k = 0; k < p.rails.length; k++) { const r = p.rails[k]; const b = base[k][2]; const p1 = [r[0] + 44 * Math.sin((r[2] * Math.PI) / 180), r[1] - 44 * Math.cos((r[2] * Math.PI) / 180)]; if (Math.hypot(b[0] - p1[0], b[1] - p1[1]) > 230 || r[1] < 240 || r[1] > 420 || r[0] < 60 || r[0] > 300) return false; }
  const o = p.orbite;
  if (o.xg < 60 || o.xg > 150 || o.xd < 218 || o.xd > 308 || o.yg < 240 || o.yg > 330 || o.yd < 240 || o.yd > 330) return false;
  return true;
}
function valide(p) {
  if (!sain(p, baseRails2)) return false;
  const pts = [...p.slots, ...p.rails.map((r) => [r[0], r[1]]), [p.orbite.xg, p.orbite.yg], [p.orbite.xd, p.orbite.yd]];
  for (let i = 0; i < p.slots.length; i++) for (let j = i + 1; j < pts.length; j++) if (dist(pts[i], pts[j]) < (j < p.slots.length ? 56 : 40)) return false;
  for (let i = 0; i < p.rails.length; i++) for (let j = i + 1; j < p.rails.length; j++) if (dist(p.rails[i], p.rails[j]) < 50) return false;
  const o = p.orbite;
  if (o.xg > 170 || o.xd < 198 || o.yg > 345 || o.yg < 230 || o.yd > 345 || o.yd < 230) return false;
  return true;
}
let evals = 0;
function note(p, tables) {
  appliquer(p);
  evals++;
  let score = 0;
  const pires = [];
  for (const c of tables) {
    if (c.modules.some((m, i) => m === "spinner" && plan.emplacements[i].y > 322)) continue; // une table que `permis` n'offre plus
    const t = new Partie(c).table;
    const obst = obstaclesDansLaZone(t);
    score -= 100 * obst.length;
    if (obst.length) pires.push(`${c.theme} obstacle ${obst.map((o) => o.nom).join(",")}`);
    const f = fenetresDeTir(c);
    for (const [o, ms] of Object.entries(f.ms)) {
      score += Math.min(ms, 50) / 10;
      if (ms < FENETRE_MIN_MS) { score -= 15; pires.push(`${c.theme}:${o}=${ms}`); }
    }
  }
  return { score, detail: pires.join(" ") };
}
function muter(p) {
  const q = JSON.parse(JSON.stringify(p));
  const g = alea();
  const pas = () => (alea() < 0.5 ? -1 : 1) * entier(2, alea() < 0.15 ? 28 : 9);
  const ang = () => (alea() < 0.5 ? -1 : 1) * 5;
  if (g < 0.36) { const s = q.slots[entier(0, 5)]; if (alea() < 0.5) s[0] += pas(); else s[1] += pas(); }
  else if (g < 0.60) { const r = q.rails[entier(0, q.rails.length - 1)]; const h = alea(); if (h < 0.4) r[0] += pas(); else if (h < 0.8) r[1] += pas(); else r[2] += ang(); }
  else if (g < 0.92) { const o = q.orbite; const k = choix(["xg", "yg", "ag", "xd", "yd", "ad"]); o[k] += k[0] === "a" ? ang() : pas(); }
  else if (g < 0.96) q.largeur = Math.max(40, Math.min(60, (q.largeur ?? 40) + (alea() < 0.5 ? -4 : 4)));
  else q.prof = Math.max(20, Math.min(36, (q.prof ?? 36) + (alea() < 0.5 ? -4 : 4)));
  if (alea() < 0.03) q.porte = 1 - q.porte;
  return q;
}
if (depart) courant = JSON.parse(readFileSync(depart, "utf8"));
else { for (let k = 0; k < 5000 && !(courant && valide(courant)); k++) courant = hasard(); }
// réparation du départ : les emplacements trop près du bord sont rentrés vers le centre de la table
courant.slots.forEach((q, i) => { const mini = i === 1 ? 40 : i === 0 ? 80 : 68; for (let k = 0; k < 80 && distBord(q[0], q[1]) < mini; k++) { q[0] += Math.sign(196 - q[0]) * 3; q[1] += Math.sign(300 - q[1]) * 3; } });
appliquer(courant);
let { score: sc, detail } = valide(courant) ? note(courant, complet) : { score: -1e9, detail: "départ invalide" };
let rap = valide(courant) ? note(courant, rapide).score : -1e9;
console.log(`départ ${sc.toFixed(1)} ${detail}`);
const n = Number(essaisTxt);
for (let i = 0; i < n; i++) {
  const cand = muter(courant);
  if (!valide(cand)) continue;
  const r1 = note(cand, rapide);
  if (r1.score < rap - 8) continue;
  const r = note(cand, complet);
  if (r.score >= sc) {
    if (r.score > sc) console.log(`#${i} ${r.score.toFixed(1)} ${r.detail}`);
    courant = cand; sc = r.score; detail = r.detail; rap = r1.score;
    writeFileSync(sortie, JSON.stringify(courant));
  }
}
console.log(`fin ${sc.toFixed(1)} (${evals} évaluations) ${detail}`);
appendFileSync(sortie + ".log", `${idPlan} ${graineTxt} ${sc.toFixed(1)} ${detail}\n`);
