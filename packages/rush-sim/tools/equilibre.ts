import { readFileSync, writeFileSync } from "node:fs";
import { daysFromCivil } from "@cdj/core";
import { BOSS, BOSS_IDS, PRIORITES, Partie, REGLAGES_DEFAUT, STRATEGIES, dailyRush, etatPilote, pasDuPilote, reglagesDe, type Strategie } from "../src/index";

// L'ÉQUILIBRE du lot BR2 : `npm run equilibre:rush -w @cdj/rush-sim [-- --jours=60] [-- --detail]` (Node seulement ; aucune base, aucun réseau). Le pilote joue les trois stratégies (foncer, un peu d'XP, beaucoup d'XP) sur N jours ; pour chacune :
// les victoires, les temps (min / médiane / max), les niveaux atteints, le temps du combat contre le golem ; puis, jour par jour, quelle stratégie est la PLUS RAPIDE : la cible est qu'aucune ne gagne tous les jours et que chacune gagne au moins ~15 % des jours.
// `REGLAGES='{"xpBase":50}'` essaie d'autres valeurs sans rien changer au code ; `PRIORITES_<stratégie>='bottes-legeres,...'` d'autres listes de cartes.
const PREMIER = daysFromCivil(2026, 11, 2);
if (process.env.VIE) for (const [id, v] of Object.entries(JSON.parse(process.env.VIE) as Record<string, number>)) (BOSS[BOSS_IDS.indexOf(id as (typeof BOSS_IDS)[number])] as { vie: number }).vie = v;
const arg = (nom: string, defaut: number): number => Number(process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? defaut);
const jours = arg("jours", 60);
// Lot BR6 : `--debut=N` commence N jours après le premier jour ; `--sortie=fichier.json` écrit les parties (pour fusionner des tranches jouées en parallèle) ; `--fusion=a.json,b.json` lit ces fichiers au lieu de jouer (365 jours : quatre tranches de ~92).
const debut = arg("debut", 0);
const sortie = process.argv.find((a) => a.startsWith("--sortie="))?.slice(9);
const fusion = process.argv.find((a) => a.startsWith("--fusion="))?.slice(9);
const detail = process.argv.includes("--detail");
const reglages = reglagesDe({ ...REGLAGES_DEFAUT, ...(process.env.REGLAGES ? (JSON.parse(process.env.REGLAGES) as object) : {}) });
for (const s of STRATEGIES) {
  const l = process.env[`PRIORITES_${s.toUpperCase()}`];
  if (l) (PRIORITES as Record<Strategie, string[]>)[s] = l.split(",");
}

interface Partie1 {
  victoire: boolean;
  s: number;
  nv: number;
  combat: number;
  subis: number;
  tues: number;
  boss: number;
}
function jouer1(jour: number, strategie: Strategie): Partie1 {
  const p = new Partie(dailyRush(jour), reglages);
  const etat = etatPilote(strategie, -2, p, process.env.SEUIL_PEU ? Number(process.env.SEUIL_PEU) : undefined);
  while (!p.finie) pasDuPilote(p, etat);
  const r = p.resultat();
  return { victoire: r.victoire, s: r.ticks / 60, nv: r.nv, combat: p.barriere >= 0 ? (r.ticks - p.barriere) / 60 : 0, subis: r.subis, tues: r.tues, boss: p.golem!.kind };
}
const q = (v: number[], d = 1): string => {
  const t = [...v].sort((a, b) => a - b);
  return t.length === 0 ? "—" : `${t[0]!.toFixed(d)} / ${t[Math.floor(t.length / 2)]!.toFixed(d)} / ${t[t.length - 1]!.toFixed(d)}`;
};
const resultats = new Map<Strategie, Partie1[]>();
if (fusion) {
  for (const s of STRATEGIES) resultats.set(s, []);
  for (const f of fusion.split(",")) {
    const lu = JSON.parse(readFileSync(f, "utf8")) as Record<Strategie, Partie1[]>;
    for (const s of STRATEGIES) resultats.get(s)!.push(...lu[s]!);
  }
} else {
  for (const s of STRATEGIES) resultats.set(s, Array.from({ length: jours }, (_, k) => jouer1(PREMIER + debut + k, s)));
  if (sortie) writeFileSync(sortie, JSON.stringify(Object.fromEntries(STRATEGIES.map((s) => [s, resultats.get(s)]))));
}
const nbJours = resultats.get("foncer")!.length;
for (const s of STRATEGIES) {
  const r = resultats.get(s)!;
  const g = r.filter((x) => x.victoire);
  console.log(`« ${s} » : ${g.length}/${nbJours} victoires · temps ${q(g.map((x) => x.s))} s · niveaux ${q(r.map((x) => x.nv), 0)} · combat du boss ${q(g.map((x) => x.combat))} s · dégâts subis ${(r.reduce((a, x) => a + x.subis, 0) / nbJours).toFixed(2)} · monstres tués ${q(r.map((x) => x.tues), 0)}`);
}
// La plus rapide de chaque jour (une défaite vaut le pire temps) ; une égalité à 1 s près va à la stratégie la plus simple (foncer, puis peu).
const gagnant = new Map<Strategie, number>(STRATEGIES.map((s) => [s, 0]));
const ecarts = new Map<Strategie, number[]>(STRATEGIES.map((s) => [s, []]));
for (let k = 0; k < nbJours; k++) {
  const t = STRATEGIES.map((s) => {
    const x = resultats.get(s)![k]!;
    return x.victoire ? x.s : 600;
  });
  const meilleur = t.indexOf(Math.min(...t));
  const s = STRATEGIES[meilleur]!;
  gagnant.set(s, gagnant.get(s)! + 1);
  const autres = t.filter((_, i) => i !== meilleur);
  ecarts.get(s)!.push(Math.min(...autres) - t[meilleur]!);
  if (detail) console.log(`  jour ${k + 1} : ${STRATEGIES.map((n, i) => `${n} ${t[i]!.toFixed(1)}`).join(" · ")} → ${s} (+${(Math.min(...autres) - t[meilleur]!).toFixed(1)} s sur la suivante)`);
}
console.log(`La plus rapide (${nbJours} jours) : ${STRATEGIES.map((s) => `${s} ${gagnant.get(s)} (${((100 * gagnant.get(s)!) / nbJours).toFixed(0)} %, écart médian ${q(ecarts.get(s)!).split(" / ")[1]} s)`).join(" · ")}`);

// Lot BR3 : la répartition PAR BOSS (elle peut être déséquilibrée pour un boss, pas sur l'ensemble) et les temps de chaque stratégie contre chaque boss.
for (let b = 0; b < BOSS_IDS.length; b++) {
  const jb = Array.from({ length: nbJours }, (_, k) => k).filter((k) => resultats.get("foncer")![k]!.boss === b);
  if (jb.length === 0) continue;
  const compte = STRATEGIES.map((s) => 0);
  for (const k of jb) {
    const t = STRATEGIES.map((s) => (resultats.get(s)![k]!.victoire ? resultats.get(s)![k]!.s : 600));
    compte[t.indexOf(Math.min(...t))]!++;
  }
  console.log(`${BOSS_IDS[b]!.padEnd(10)} (${jb.length} j) : ${STRATEGIES.map((s, i) => `${s} ${compte[i]} (${Math.round((100 * compte[i]!) / jb.length)} %) ${q(jb.map((k) => resultats.get(s)![k]!.s).filter((_, i2) => resultats.get(s)![jb[i2]!]!.victoire))} s, combat ${q(jb.map((k) => resultats.get(s)![k]!.combat).filter((_, i2) => resultats.get(s)![jb[i2]!]!.victoire))} s`).join(" · ")}`);
}

// Les défaites et les jours trop longs (une stratégie qui se perd ou s'attarde), par boss.
for (const s of STRATEGIES) {
  const mauvais = resultats.get(s)!.map((x, k) => ({ x, k })).filter(({ x }) => !x.victoire || x.s > 100);
  if (mauvais.length > 0) console.log(`  « ${s} » défaites ou > 100 s : ${mauvais.map(({ x, k }) => `jour ${k} ${BOSS_IDS[x.boss]} ${x.victoire ? `${x.s.toFixed(0)} s` : "perdu"}`).join(" · ")}`);
}
