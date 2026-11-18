import { daysFromCivil, parseDay } from "@cdj/core";
import { DUREE_PARTIE_ROBOT, PARTIES_DU_ROBOT, SITUATIONS, dailyPinball, graineDuRobot, jouerRobot, nouveauProfil, type ProfilRobot } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run profil-robot:pinball -w @cdj/pinball-sim -- [--jours 8] [--du AAAA-MM-JJ] [--pas 5] [--fils=N]` (lot PBR1) : **le profil d'une table du robot** — où vont les pas qu'il simule pour décider (la bille jouée d'avance,
// les copies de départ, « ne rien faire », les frappes ; chaque étape selon la situation : batteur, rail, multibille, porte), comment finissent les essais, et **le temps** : la simulation de la vraie partie contre les
// recherches du robot. Une table sur `--pas` (cinq par défaut), les 4 parties du robot de chacune. Aucune base, aucun réseau. Le temps compte le chronométrage lui-même (quelques pour cent).
interface Sortie {
  profil: ProfilRobot;
  vrais: number;
  secondes: number;
}
const travail = (jour: number): Sortie => {
  const c = dailyPinball(jour);
  const profil = nouveauProfil(() => performance.now());
  let vrais = 0;
  const t0 = performance.now();
  for (let k = 0; k < PARTIES_DU_ROBOT; k++) vrais += jouerRobot(c, graineDuRobot(k), { maxTicks: DUREE_PARTIE_ROBOT, profil }).partie.tick;
  return { profil, vrais, secondes: (performance.now() - t0) / 1000 };
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
  const n = Number(valeur("jours") ?? 8);
  const saut = Number(valeur("pas") ?? 5);
  const jours = Array.from({ length: n }, (_, i) => du + i * saut);
  const sorties = await enParallele<number, Sortie>(new URL(import.meta.url), jours, () => undefined, valeur("fils") ? Number(valeur("fils")) : undefined);
  const tot = nouveauProfil();
  let vrais = 0;
  let secondes = 0;
  for (const s of sorties) {
    vrais += s.vrais;
    secondes += s.secondes;
    tot.decisions += s.profil.decisions;
    tot.essais += s.profil.essais;
    tot.reel.pas += s.profil.reel.pas;
    tot.reel.ms += s.profil.reel.ms;
    tot.ms.arrivee += s.profil.ms.arrivee;
    tot.ms.chauffe += s.profil.ms.chauffe;
    for (const q of SITUATIONS) {
      tot.ms.rien[q] += s.profil.ms.rien[q];
      tot.ms.essai[q] += s.profil.ms.essai[q];
      for (const e of ["arrivee", "chauffe", "rien", "essai"] as const) tot.pas[e][q] += s.profil.pas[e][q];
    }
    for (const [k, v] of Object.entries(s.profil.fins)) {
      const e = (tot.fins[k] ??= { n: 0, pas: 0 });
      e.n += v.n;
      e.pas += v.pas;
    }
  }
  const total = Object.values(tot.pas).reduce((a, r) => a + SITUATIONS.reduce((x, q) => x + r[q], 0), 0);
  console.log(`${n} tables (une sur ${saut}), ${PARTIES_DU_ROBOT} parties chacune : ${milliers(vrais)} pas de vraie partie, ${milliers(total)} pas simulés pour décider (${(total / vrais).toFixed(1)} par pas joué), ${milliers(tot.decisions)} décisions, ${milliers(tot.essais)} essais.`);
  console.log(`\nPAS simulés par étape et par situation (% du total) :`);
  console.log("             batteur    rail multibille  porte   total");
  const pc = (x: number, base: number): string => ((100 * x) / base).toFixed(1).padStart(8);
  for (const e of ["arrivee", "chauffe", "rien", "essai"] as const) console.log(`${e.padEnd(10)} ${SITUATIONS.map((q) => pc(tot.pas[e][q], total)).join(" ")} ${pc(SITUATIONS.reduce((a, q) => a + tot.pas[e][q], 0), total)}`);
  console.log(`total      ${SITUATIONS.map((q) => pc(["arrivee", "chauffe", "rien", "essai"].reduce((a, e) => a + tot.pas[e as "essai"][q], 0), total)).join(" ")}   100.0`);
  const ms = tot.reel.ms + tot.ms.arrivee + tot.ms.chauffe + SITUATIONS.reduce((a, q) => a + tot.ms.rien[q] + tot.ms.essai[q], 0);
  console.log(`\nTEMPS (% du temps chronométré, ${(ms / 1000).toFixed(0)} s sur ${(secondes).toFixed(0)} s de calcul ; le reste : décisions, lanceur, lecture) :`);
  console.log(`  vraie partie (la simulation seule) ${pc(tot.reel.ms, ms)} %   (${milliers(tot.reel.pas)} pas, ${((tot.reel.ms * 1000) / tot.reel.pas).toFixed(2)} µs le pas)`);
  console.log(`  bille jouée d'avance               ${pc(tot.ms.arrivee, ms)} %`);
  console.log(`  copies de départ                   ${pc(tot.ms.chauffe, ms)} %`);
  console.log(`  ne rien frapper                    ${pc(SITUATIONS.reduce((a, q) => a + tot.ms.rien[q], 0), ms)} %`);
  for (const q of SITUATIONS) console.log(`  frappes, situation « ${q} »`.padEnd(37) + `${pc(tot.ms.essai[q], ms)} %`);
  console.log(`  recherches du robot en tout        ${pc(ms - tot.reel.ms, ms)} %`);
  console.log("\ncomment finissent les essais : nombre · pas moyens · part des pas (%)");
  for (const [k, v] of Object.entries(tot.fins).sort((a, b) => b[1].pas - a[1].pas)) console.log(`  ${k.padEnd(26)} ${milliers(v.n).padStart(10)} · ${(v.pas / v.n).toFixed(0).padStart(5)} · ${((100 * v.pas) / total).toFixed(1)}`);
  process.exit(0);
}
