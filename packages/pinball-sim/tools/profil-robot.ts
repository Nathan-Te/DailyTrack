import { daysFromCivil, parseDay } from "@cdj/core";
import { DUREE_PARTIE_ROBOT, PARTIES_DU_ROBOT, dailyPinball, graineDuRobot, jouerRobot, nouveauProfil, type ProfilRobot } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run profil-robot:pinball -w @cdj/pinball-sim -- [--jours 6] [--du AAAA-MM-JJ] [--fils=N]` (lot PBR1) : **le profil d'une table du robot** — où vont les pas qu'il simule pour décider (la bille jouée d'avance, les copies de départ,
// « ne rien faire », les frappes ; chaque étape selon la situation : batteur, rail, multibille, porte), comment finissent les essais, et le temps (les 4 parties du robot) contre celui de la simulation de la partie elle-même
// (les pas de la vraie partie, sans recherche). Aucune base, aucun réseau.
interface Sortie {
  profil: ProfilRobot;
  vrais: number;
  secondesRobot: number;
  }
const travail = (jour: number): Sortie => {
  const c = dailyPinball(jour);
  const profil = nouveauProfil();
  let vrais = 0;
  const t0 = performance.now();
  for (let k = 0; k < PARTIES_DU_ROBOT; k++) {
    const r = jouerRobot(c, graineDuRobot(k), { maxTicks: DUREE_PARTIE_ROBOT, profil });
    vrais += r.partie.tick;
  }
  const secondesRobot = (performance.now() - t0) / 1000;
  return { profil, vrais, secondesRobot };
};
const milliers = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
if (enFil) repondre(travail);
else {
  const args = process.argv.slice(2);
  const valeur = (nom: string): string | undefined => {
    const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
    if (i < 0) return undefined;
    return args[i]!.includes("=") ? args[i]!.slice(nom.length + 3) : args[i + 1];
  };
  const du = parseDay(valeur("du") ?? "") ?? daysFromCivil(2026, 11, 2);
  const n = Number(valeur("jours") ?? 6);
  const jours = Array.from({ length: n }, (_, i) => du + i * 5);
  const sorties = await enParallele<number, Sortie>(new URL(import.meta.url), jours, () => undefined, valeur("fils") ? Number(valeur("fils")) : undefined);
  const tot = nouveauProfil();
  let vrais = 0;
  for (const s of sorties) {
    vrais += s.vrais;
    tot.decisions += s.profil.decisions;
    tot.essais += s.profil.essais;
    tot.copies += s.profil.copies;
    for (const e of Object.keys(tot.pas) as (keyof ProfilRobot["pas"])[]) for (const t of Object.keys(tot.pas[e]) as (keyof ProfilRobot["pas"]["essai"])[]) tot.pas[e][t] += s.profil.pas[e][t];
    for (const [k, v] of Object.entries(s.profil.fins)) {
      const e = (tot.fins[k] ??= { n: 0, pas: 0 });
      e.n += v.n;
      e.pas += v.pas;
    }
  }
  const total = Object.values(tot.pas).reduce((a, r) => a + Object.values(r).reduce((x, y) => x + y, 0), 0);
  console.log(`${n} tables (un jour sur cinq), ${PARTIES_DU_ROBOT} parties chacune : ${milliers(vrais)} pas de vraie partie, ${milliers(total)} pas simulés pour décider (${(total / vrais).toFixed(1)} fois), ${milliers(tot.decisions)} décisions, ${milliers(tot.essais)} essais.`);
  console.log("\npart des pas simulés, par étape et par situation (%) :");
  console.log("            batteur    rail  multibille  porte   total");
  for (const e of Object.keys(tot.pas) as (keyof ProfilRobot["pas"])[]) {
    const r = tot.pas[e];
    const somme = Object.values(r).reduce((a, b) => a + b, 0);
    const pc = (x: number): string => ((100 * x) / total).toFixed(1).padStart(7);
    console.log(`${e.padEnd(9)} ${pc(r.batteur)} ${pc(r.rail)} ${pc(r.multibille)} ${pc(r.porte)} ${pc(somme)}`);
  }
  const colonnes = (["batteur", "rail", "multibille", "porte"] as const).map((t) => Object.values(tot.pas).reduce((a, r) => a + r[t], 0));
  console.log(`total     ${colonnes.map((x) => ((100 * x) / total).toFixed(1).padStart(7)).join(" ")}  100.0`);
  console.log("\ncomment finissent les essais : nombre · pas moyens · part des pas (%)");
  for (const [k, v] of Object.entries(tot.fins).sort((a, b) => b[1].pas - a[1].pas)) console.log(`  ${k.padEnd(26)} ${milliers(v.n).padStart(10)} · ${(v.pas / v.n).toFixed(0).padStart(5)} · ${((100 * v.pas) / total).toFixed(1)}`);
  process.exit(0);
}
