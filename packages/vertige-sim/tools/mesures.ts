import { gzipSync } from "node:zlib";
import { Rng } from "@cdj/core";
import { CM, Partie, T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, TICKS_PAR_SECONDE, chargeDe, dailyVertige, enregistrer, niveau, type BlocNiveau, type Commande, type Niveau, type NomNiveau } from "../src/index";
import { ETAPES_PARCOURS, jouerCibles, jouerEtapes } from "./robot";

// Les mesures du lot V0 (`npm run mesures:vertige -w @cdj/vertige-sim`) : le coût du rejeu d'une partie de 60 et de 120 s, et la taille de la rediffusion avec la souris, brute et compressée. Elles s'écrivent en
// Markdown sur la sortie standard. **Les profils de souris sont synthétiques** (aucune main humaine n'a joué) : ils bornent la taille, ils ne la prédisent pas — la mesure réelle se lit en jeu (`?debug&fps` affiche la
// taille de la rediffusion en cours) et se remplace ici par celle de Nathan.
const contenu = dailyVertige(20_000);

// ---------------------------------------------------------------- les commandes
function marche(graine: number, pas: number): Commande[] {
  const rng = new Rng(graine);
  const out: Commande[] = [];
  let k = T_AVANT;
  for (let i = 0; i < pas; i++) {
    if (rng.int(30) === 0) k = [T_AVANT, T_AVANT | T_DROITE, T_AVANT | T_GAUCHE, T_DROITE, T_GAUCHE, T_ARRIERE, T_AVANT][rng.int(7)]!;
    let c = k;
    if (rng.int(45) === 0) c |= T_SAUT;
    if (rng.int(150) === 0) c |= T_DASH;
    out.push({ k: c, dl: rng.int(61) - 30, dt: rng.int(21) - 10 });
  }
  return out;
}

/** Une souris synthétique : des gestes (une vitesse qui monte et retombe) séparés de repos ; `actif` : la part du temps en geste ; `hz` : les pas qui reçoivent ce que la souris a fait (affichage à 60 Hz : un pas sur deux). */
function souris(graine: number, pas: number, actif: number, hz: number): Commande[] {
  const rng = new Rng(graine);
  const out: Commande[] = [];
  const m = Math.max(1, Math.round(TICKS_PAR_SECONDE / hz));
  let reste = 0;
  let vl = 0;
  let vt = 0;
  let fin = 0;
  let k = T_AVANT;
  let accL = 0;
  let accT = 0;
  for (let i = 0; i < pas; i++) {
    if (i >= fin) {
      const geste = rng.int(1000) < actif * 1000;
      const duree = 20 + rng.int(50);
      fin = i + duree;
      reste = geste ? duree : 0;
      vl = geste ? (rng.int(2) === 0 ? -1 : 1) * (60 + rng.int(500)) : 0;
      vt = geste ? (rng.int(2) === 0 ? -1 : 1) * rng.int(80) : 0;
    }
    if (reste > 0) {
      const phase = Math.sin((Math.PI * (reste / Math.max(1, fin - i + reste))) / 2); // un geste qui monte et retombe
      accL += vl * (0.4 + 0.6 * Math.abs(phase)) + (rng.int(11) - 5);
      accT += vt * 0.4 + (rng.int(5) - 2);
      reste--;
    }
    if (rng.int(80) === 0) k = [T_AVANT, T_AVANT | T_DROITE, T_AVANT | T_GAUCHE, T_AVANT | T_SAUT, T_AVANT][rng.int(5)]!;
    let c = k;
    if (rng.int(300) === 0) c |= T_DASH;
    let dl = 0;
    let dt = 0;
    if (i % m === 0) {
      dl = Math.trunc(accL);
      dt = Math.trunc(accT);
      accL -= dl;
      accT -= dt;
    }
    out.push({ k: c, dl, dt });
  }
  return out;
}

/** Ne garde le regard qu'un pas sur `n` (la somme du groupe sur le premier pas) : le regard à 60 ou à 30 Hz. */
function decimer(c: readonly Commande[], n: number): Commande[] {
  const out = c.map((x) => ({ ...x, dl: 0, dt: 0 }));
  for (let i = 0; i < c.length; i += n) {
    let l = 0;
    let t = 0;
    for (let j = i; j < Math.min(c.length, i + n); j++) {
      l += c[j]!.dl;
      t += c[j]!.dt;
    }
    out[i]!.dl = l;
    out[i]!.dt = t;
  }
  return out;
}

// ---------------------------------------------------------------- le coût du rejeu
const blocsSynthetiques = (n: number): BlocNiveau[] =>
  Array.from({ length: n }, (_, i) => {
    const x = (i % 20) * 8 * CM * 100;
    const z = -Math.floor(i / 20) * 8 * CM * 100;
    return { boite: { x0: x, y0: -1_000_000, z0: z, x1: x + 5_000_000, y1: 0, z1: z + 5_000_000 }, role: "pierre" as const };
  });

function chrono(f: () => void, fois: number): { min: number; mediane: number; max: number } {
  for (let i = 0; i < 3; i++) f();
  const t: number[] = [];
  for (let i = 0; i < fois; i++) {
    const a = performance.now();
    f();
    t.push(performance.now() - a);
  }
  t.sort((a, b) => a - b);
  return { min: t[0]!, mediane: t[Math.floor(t.length / 2)]!, max: t[t.length - 1]! };
}
const ms = (v: number): string => (v < 10 ? v.toFixed(2) : v.toFixed(1));

console.log("# Lots V0 et V1 — mesures (Node " + process.version + ")\n");
console.log("## Le coût du rejeu d'une partie\n");
console.log("Médiane de 25 rejeux, en ms (min – max) ; une partie qui n'arrive pas joue ses 14 400 pas au plus. Le niveau : le nombre de boîtes que la simulation teste à chaque pas.\n");
console.log("| partie | niveau (boîtes) | pas | rejeu (ms) | par seconde de jeu (ms) | sans index (ms) |\n|---|---|---:|---|---:|---:|");
const lignes: [string, NomNiveau | "synthetique" | "synthetique600", number, number][] = [
  ["marche au hasard 60 s", "bac-a-sable", 7200, 1],
  ["marche au hasard 120 s", "bac-a-sable", 14400, 1],
  ["marche au hasard 120 s", "mur", 14400, 2],
  ["le parcours, joueur scripté", "parcours", 741, 3],
  ["marche au hasard 120 s", "synthetique", 14400, 4],
  // Lot V2 : 600 boîtes (un niveau entier pourra en compter des centaines).
  ["marche au hasard 45 s, 600 boîtes", "synthetique600", 5400, 4],
  ["marche au hasard 120 s, 600 boîtes", "synthetique600", 14400, 4],
  // Lot V1 : la gravité et les portails (niveaux sans arrivée, pour que la partie joue tous ses pas).
  ["va-et-vient 45 s, portails", "portails", 5400, 5],
  ["va-et-vient 120 s, portails", "portails", 14400, 6],
  ["marche au hasard 45 s, gravité", "gravite", 5400, 7],
  ["marche au hasard 120 s, gravité", "gravite", 14400, 8],
  ["marche au hasard 120 s, cube (6 orbes)", "cube", 14400, 9],
];
for (const [nom, nv, pas, graine] of lignes) {
  const niv: Niveau = nv === "synthetique" || nv === "synthetique600" ? { ...niveau("bac-a-sable"), blocs: blocsSynthetiques(nv === "synthetique" ? 200 : 600), arrivee: null } : { ...niveau(nv), ...(nv === "portails" ? { arrivee: null } : {}) };
  // Pour les portails, un joueur qui va et vient d'un portail de la première paire à l'autre (une traversée toutes les deux secondes environ) ; pour le cube, les six orbes en boucle ; sinon, une marche au hasard.
  const cmd =
    nv === "parcours"
      ? jouerEtapes("parcours", ETAPES_PARCOURS).commandes
      : nv === "portails"
        ? jouerCibles("portails", Array.from({ length: 400 }, (_, i): [number, number, number] => (i % 2 === 0 ? [-6, 1.2, -6] : [14, 1.2, -20])), { maxPas: pas }).commandes
        : marche(graine, pas);
  const vu = new Partie(niv);
  for (const c of cmd) vu.avancer(c);
  const evenements = nv === "portails" || nv === "gravite" || nv === "cube" ? ` — ${vu.traversees} traversées, ${vu.bascules} bascules` : "";
  const r = chrono(() => {
    const p = new Partie(niv);
    for (const c of cmd) {
      if (p.finie) break;
      p.avancer(c);
    }
  }, 25);
  // Lot V2 : la même partie en essayant toutes les boîtes (la référence exhaustive) — ce que coûtait le rejeu avant l'index spatial.
  const nivSans: Niveau = { ...niv, sansIndex: true };
  const sans = chrono(() => {
    const p = new Partie(nivSans);
    for (const c of cmd) {
      if (p.finie) break;
      p.avancer(c);
    }
  }, 25);
  console.log(`| ${nom}${evenements} | ${nv} (${niv.blocs.length}) | ${cmd.length} | ${ms(r.mediane)} (${ms(r.min)} – ${ms(r.max)}) | ${ms((r.mediane * TICKS_PAR_SECONDE) / cmd.length)} | ${ms(sans.mediane)} |`);
}

// ---------------------------------------------------------------- la taille de la rediffusion
console.log("\n## La taille de la rediffusion (la souris comprise)\n");
console.log("Charge brute = les octets des commandes ; texte = ce qui part au serveur (enveloppe + base64url) ; gzip = zlib niveau 9. Souris **synthétique** : « calme » = un geste de la souris un quart du temps, « actif » = trois quarts. Un affichage à 60 Hz livre le regard un pas sur deux (le kit joue 120 pas par seconde, la souris est lue à chaque image).\n");
console.log("| partie | souris | regard | pas non nuls | brute (o) | texte (car.) | gzip de la charge (o) | gzip du texte (o) |\n|---|---|---|---:|---:|---:|---:|---:|");
for (const secondes of [60, 120]) {
  for (const [nom, actif, hz] of [["calme", 0.25, 60], ["actif", 0.75, 60], ["actif", 0.75, 144], ["continu", 1, 144]] as const) {
    for (const regard of [1, 2, 4]) {
      const base = souris(secondes * 7 + hz, secondes * TICKS_PAR_SECONDE, actif, hz);
      const cmd = regard === 1 ? base : decimer(base, regard);
      const charge = chargeDe(cmd);
      const texte = enregistrer(contenu, cmd);
      const gzC = gzipSync(Buffer.from(charge), { level: 9 }).length;
      const gzT = gzipSync(Buffer.from(texte), { level: 9 }).length;
      const nonNuls = cmd.filter((c) => c.dl !== 0 || c.dt !== 0).length;
      console.log(`| ${secondes} s | ${nom} (affichage ${hz} Hz) | ${TICKS_PAR_SECONDE / regard} Hz | ${nonNuls} | ${charge.length} | ${texte.length} | ${gzC} | ${gzT} |`);
    }
  }
}
const robot = jouerEtapes("parcours", ETAPES_PARCOURS).commandes;
const bot = chargeDe(robot);
console.log(`\nPour mémoire, le joueur scripté du parcours (${robot.length} pas, une rediffusion SANS souris humaine : seul le cap qui suit les points de passage bouge) : ${bot.length} o bruts, ${enregistrer(contenu, robot).length} caractères.`);
