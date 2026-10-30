// Lot T2 — les mesures du rapport : coût d'un rejeu (comparé au banc du lot T0, sur la MÊME machine), taille d'une rediffusion, borne de ticks.
//   npm run mesures-t2:tower -w @cdj/tower-sim [-- --rapide]     (≈ 3 min ; --rapide : moins de passes et de parties)
import { cpus } from "node:os";
import { parseDay } from "@cdj/core";
import { chargerMoteurB } from "../lab/b/moteurB";
import { rejouerBanc } from "../lab/banc";
import {
  COMMANDE,
  type Contenu,
  dailyTower,
  encoderRediffusion,
  enregistrer,
  MAX_TICKS_JEU,
  MAX_TICKS_REJEU,
  NB_PIECES,
  Partie,
  REGLAGES_DEFAUT,
  type Reglages,
  rejouerComplet,
  type Scenario,
  ticksRediffusion,
} from "../src";
import { chargerRapier } from "../src/rapier";
import { chercher } from "./joueur";

const rapide = process.argv.includes("--rapide");
const mediane = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const moyenne = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
const fmt = (n: number, d = 0): string => n.toFixed(d);

console.log(`Machine : ${cpus()[0]?.model ?? "?"} (${cpus().length} cœurs), Node ${process.version}`);
const R = await chargerRapier();
const B = await chargerMoteurB();

/** Joue une partie sans rien faire (chute minimale, tour au centre) et rend la rediffusion. */
function jouerIdle(contenu: Scenario, reglages: Reglages = REGLAGES_DEFAUT): Partie {
  const p = new Partie(R, contenu, reglages);
  while (p.etape !== "fini") p.avancer(0);
  return p;
}

// ---- 1. coût d'un rejeu ----
console.log("\n## Coût d'un rejeu complet (médiane de 20 passes après 2 d'échauffement)");
const passes = rapide ? 3 : 20;
function chronometrer(f: () => void): number[] {
  f();
  f();
  const t: number[] = [];
  for (let i = 0; i < passes; i++) {
    const t0 = performance.now();
    f();
    t.push(performance.now() - t0);
  }
  return t;
}
{
  // Le banc du lot T0 (moteur B, Rapier), mesuré ici pour comparer : 7 200 pas, 40 pièces et un effondrement.
  let pas = 0;
  const t = chronometrer(() => {
    pas = rejouerBanc(B, { repos: 600 }).ticks;
  });
  console.log(`banc du lot T0 (moteur B) : médiane ${fmt(mediane(t))} ms (min ${fmt(Math.min(...t))}, max ${fmt(Math.max(...t))}) · ${pas} pas · ${fmt((mediane(t) * 1000) / pas)} µs par pas`);
}
// Les parties de 40 pièces AVEC PALIERS, jouées sans rien faire (chute minimale, tout au centre) :
//  - « bonus » : 40 carrés et six paliers qui ne sont que des bonus (lierre, pièce figée, petite pièce, deux fois) : la tour de carrés tient, les 40 pièces se posent, la tour monte à ≈ 80 m, tous les
//    effets de bonus (soudures, corps fixes, demi-taille) s'appliquent : la partie nominale ENTIÈRE ;
//  - « jour » : les six effets du 02/11/2026 (coup de vent, géante, glissante comprises) sur la même suite : la tour s'effondre vers la 22ᵉ pièce (trois vies perdues).
const jour = parseDay("2026-11-02")!;
const duJour = dailyTower(jour);
const bonus: Contenu = { ...duJour, pieces: Array.from({ length: NB_PIECES }, () => "O" as const), paliers: duJour.paliers.map((p, i) => ({ metres: p.metres, effet: (["lierre", "figee", "petite"] as const)[i % 3]! })) };
const carresDuJour: Contenu = { ...duJour, pieces: bonus.pieces };
const grandes: [string, Scenario, Reglages][] = [
  ["40 carrés, six paliers de bonus, chute minimale (2,5 m/s)", bonus, REGLAGES_DEFAUT],
  ["40 carrés, les six effets du 02/11/2026, chute minimale", carresDuJour, REGLAGES_DEFAUT],
  ["40 carrés, six paliers de bonus, 1 m/s (la plus longue partie qui tient dans la borne)", bonus, { ...REGLAGES_DEFAUT, vitesseChute8: 8 }],
];
for (const [nom, contenu, reglages] of grandes) {
  const p = jouerIdle(contenu, reglages);
  const code = encoderRediffusion(enregistrer(p));
  const r = p.resultat()!;
  const vue = p.vue();
  p.dispose();
  const t = chronometrer(() => {
    rejouerComplet(R, contenu, code);
  });
  console.log(
    `${nom} : médiane ${fmt(mediane(t))} ms (min ${fmt(Math.min(...t))}, max ${fmt(Math.max(...t))}) · ${r.ticks} ticks de jeu + ${r.ticksGel - r.ticks} de stabilisation · ` +
      `${fmt((mediane(t) * 1000) / r.ticksGel)} µs par tick · ${r.posees}/40 posées, ${r.tombees} tombées, ${vue.declenches} paliers · hauteur ${fmt(r.hauteurMm / 1000, 1)} m`,
  );
}

// ---- 2. taille d'une rediffusion ----
console.log("\n## Taille d'une rediffusion (octets bruts, puis texte base64url)");
const tailles: { nom: string; octets: number; texte: number; ticks: number }[] = [];
function noter(nom: string, p: Partie): void {
  const rec = enregistrer(p);
  const texte = encoderRediffusion(rec).length;
  tailles.push({ nom, octets: Math.round((texte * 3) / 4), texte, ticks: ticksRediffusion(rec) });
}
{
  const dates = rapide ? ["2026-11-02"] : ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
  for (const d of dates) {
    const p = chercher(R, dailyTower(parseDay(d)!), REGLAGES_DEFAUT);
    noter(`joueur d'essai, ${d}`, p);
    p.dispose();
  }
  // Un joueur au clavier sur une partie nominale ENTIÈRE (40 pièces de 168 ticks, 6 720 ticks), sans simulation : par pièce, une touche maintenue vers un côté (un ordre au tick 10, puis toutes les
  // 3 ticks : délai et cadence de `?debug&tune`), un quart de tour, un autre appui, puis « descendre » maintenu pendant les 48 derniers ticks. C'est le plus dense qu'un humain joue vraiment.
  const plages: { masque: number; ticks: number }[] = [];
  const ajouter = (masque: number, ticks: number): void => {
    const d = plages[plages.length - 1];
    if (d && d.masque === masque) d.ticks += ticks;
    else plages.push({ masque, ticks });
  };
  for (let piece = 0; piece < NB_PIECES; piece++) {
    const cote = piece % 2 === 0 ? COMMANDE.GAUCHE : COMMANDE.DROITE;
    let tick = 0;
    for (; tick < 168; tick++) {
      let c = 0;
      if (tick >= 10 && tick < 25 && (tick - 10) % 3 === 0) c |= cote;
      if (tick === 40) c |= COMMANDE.TOURNER;
      if (tick === 60 || tick === 63) c |= cote === COMMANDE.GAUCHE ? COMMANDE.DROITE : COMMANDE.GAUCHE;
      if (tick >= 120) c |= COMMANDE.DESCENDRE;
      ajouter(c, 1);
    }
  }
  const humain = { sim: 2, g: 1, contenu: { jour }, reglages: { ...REGLAGES_DEFAUT }, plages };
  const texte = encoderRediffusion(humain).length;
  tailles.push({ nom: "40 pièces au clavier (touche répétée, quart de tour, descente), 6 720 ticks", octets: Math.round((texte * 3) / 4), texte, ticks: ticksRediffusion(humain) });
}
for (const t of tailles) console.log(`${t.nom} : ${t.ticks} ticks, ${t.octets} o bruts, ${t.texte} caractères`);
const joueurs = tailles.filter((t) => t.nom.startsWith("joueur"));
console.log(`moyenne des parties du joueur d'essai : ${fmt(moyenne(joueurs.map((t) => t.octets)))} o bruts, ${fmt(moyenne(joueurs.map((t) => t.texte)))} caractères (${fmt(moyenne(joueurs.map((t) => t.ticks)))} ticks)`);
// Le pire cas possible : un masque différent à chaque tick, jusqu'à la borne : 2 octets par tick (le masque, puis un nombre de ticks de 1).
const pire = 2 * MAX_TICKS_JEU + 16;
console.log(`pire cas théorique (${MAX_TICKS_JEU} ticks, un masque différent à chaque tick) : ${pire} o bruts, ${Math.ceil((pire * 4) / 3)} caractères`);

// ---- 3. la borne de ticks ----
console.log("\n## Borne de ticks");
const nominal = NB_PIECES * Math.round((REGLAGES_DEFAUT.hauteurApparition8 / REGLAGES_DEFAUT.vitesseChute8) * 60);
console.log(`partie nominale : ${NB_PIECES} pièces × ${REGLAGES_DEFAUT.hauteurApparition8 / 8} m à ${REGLAGES_DEFAUT.vitesseChute8 / 8} m/s = ${nominal} ticks ; borne MAX_TICKS_JEU = ${MAX_TICKS_JEU} (×${fmt(MAX_TICKS_JEU / nominal, 2)}), avec la stabilisation ${MAX_TICKS_REJEU}`);
