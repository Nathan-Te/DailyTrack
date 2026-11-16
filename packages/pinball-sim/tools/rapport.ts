import { daysFromCivil, formatDay, parseDay } from "@cdj/core";
import { PARTIES_DU_ROBOT, POURCENT_ARGENT, POURCENT_BRONZE, POURCENT_OR, TICKS_PAR_SECONDE, analyserTable, cleDeTable, dailyPinball, dailyPinballAvec, type Seuils } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run robot:pinball -w @cdj/pinball-sim -- --jours 30 [--du AAAA-MM-JJ] [--liens <adresse du jeu>] [--fils=N]` : le rapport du robot (lot PB4), une ligne par jour : le thème, les scores de ses parties, la mission
// (parties réussies), les modules jamais touchés, la table (validée ; retirée si le tirage de la graine de base était refusé), la durée du calcul. Puis un résumé (durée d'une table, répartition des scores) et,
// avec `--liens`, un lien `?jour=…&robot` par thème pour regarder le robot jouer la table. Aucune base, aucun réseau.
interface Jour {
  jour: number;
  date: string;
  theme: string;
  scores: number[];
  ticks: number[];
  missions: number;
  manquants: string[];
  ok: boolean;
  raisons: string[];
  retiree: boolean;
  seuils: Seuils;
  secondes: number;
  pasSimules: number;
}
const travail = (jour: number): Jour => {
  const t0 = performance.now();
  const c = dailyPinball(jour);
  const a = analyserTable(c);
  const brut = dailyPinballAvec(jour, new Set());
  return { jour, date: formatDay(jour), theme: c.theme, scores: a.scores, ticks: a.ticks, missions: a.missions.filter(Boolean).length, manquants: a.manquants!, ok: a.ok!, raisons: a.raisons!, retiree: cleDeTable(brut) !== cleDeTable(c), seuils: a.seuils, secondes: (performance.now() - t0) / 1000, pasSimules: a.pasSimules };
};

const milliers = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
if (enFil) repondre(travail);
else {
  const args = process.argv.slice(2);
  const valeur = (nom: string): string | undefined => {
    const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
    if (i < 0) return undefined;
    return args[i]!.includes("=") ? args[i]!.slice(nom.length + 3) : args[i + 1];
  };
  const du = parseDay(valeur("du") ?? "") ?? daysFromCivil(2026, 11, 2);
  const n = Number(valeur("jours") ?? 30);
  const jours = Array.from({ length: n }, (_, i) => du + i);
  const t0 = performance.now();
  const lignes = await enParallele<number, Jour>(new URL(import.meta.url), jours, () => undefined, valeur("fils") ? Number(valeur("fils")) : undefined);
  for (const l of lignes) {
    const sc = l.scores.map(milliers).join(" / ");
    console.log(`${l.date}  ${l.theme.padEnd(6)}  scores ${sc}  mission ${l.missions}/${PARTIES_DU_ROBOT}  jamais touchés : ${l.manquants.length ? l.manquants.join(", ") : "aucun"}  table : ${l.ok ? "validée" : "REFUSÉE (" + l.raisons.join(" ; ") + ")"}${l.retiree ? ", retirée (graine suivante)" : ""}  ${l.secondes.toFixed(1)} s`);
  }
  const secondes = lignes.map((l) => l.secondes).sort((a, b) => a - b);
  console.log(`\n${lignes.length} jours en ${((performance.now() - t0) / 1000).toFixed(0)} s (sur ${valeur("fils") ?? "tous les"} cœurs). Table complète (${PARTIES_DU_ROBOT} parties du robot + validation) : ${(secondes.reduce((a, b) => a + b, 0) / secondes.length).toFixed(1)} s en moyenne, ${secondes[secondes.length - 1]!.toFixed(1)} s au pire.`);
  const pas = lignes.map((l) => l.pasSimules / PARTIES_DU_ROBOT);
  console.log(`Le robot simule ${(pas.reduce((a, b) => a + b, 0) / pas.length / 1000).toFixed(0)} k pas par partie pour décider (une partie de ${(lignes[0]!.ticks[0]! / TICKS_PAR_SECONDE).toFixed(0)} s).`);
  console.log(`Parties : ${lignes.filter((l) => l.ok).length}/${lignes.length} tables valides, mission réussie dans ${lignes.reduce((a, l) => a + l.missions, 0)}/${lignes.length * PARTIES_DU_ROBOT} parties, ${lignes.filter((l) => l.retiree).length} table(s) retirée(s).`);
  // la répartition : chaque partie rapportée au meilleur score de sa table (Diamant), et les seuils qui en sortent
  const rapports = lignes.flatMap((l) => l.scores.map((s) => s / Math.max(...l.scores))).sort((a, b) => a - b);
  const q = (p: number): string => `${Math.round(rapports[Math.min(rapports.length - 1, Math.floor((rapports.length * p) / 100))]! * 100)} %`;
  console.log(`Score d'une partie du robot / meilleur de sa table : minimum ${q(0)}, 10 % des parties sous ${q(10)}, 25 % sous ${q(25)}, médiane ${q(50)}, 75 % sous ${q(75)}. Seuils : Bronze ${POURCENT_BRONZE} %, Argent ${POURCENT_ARGENT} %, Or ${POURCENT_OR} % du Diamant.`);
  const diamants = lignes.map((l) => l.seuils.author).sort((a, b) => a - b);
  console.log(`Diamant : de ${milliers(diamants[0]!)} à ${milliers(diamants[diamants.length - 1]!)} (médiane ${milliers(diamants[Math.floor(diamants.length / 2)]!)}).`);
  const base = valeur("liens");
  if (base) {
    console.log("\nLe robot joue (un jour par thème) :");
    const vus = new Set<string>();
    for (const l of lignes) if (!vus.has(l.theme)) {
      vus.add(l.theme);
      console.log(`  ${l.theme} : ${base.replace(/\/?$/, "/")}?jour=${l.date}&robot`);
    }
  }
  process.exit(0);
}
