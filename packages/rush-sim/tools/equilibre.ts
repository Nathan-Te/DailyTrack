import { daysFromCivil } from "@cdj/core";
import { PRIORITES, Partie, REGLAGES_DEFAUT, STRATEGIES, dailyRush, etatPilote, pasDuPilote, reglagesDe, type Strategie } from "../src/index";

// L'ÉQUILIBRE du lot BR2 : `npm run equilibre:rush -w @cdj/rush-sim [-- --jours=60] [-- --detail]` (Node seulement ; aucune base, aucun réseau). Le pilote joue les trois stratégies (foncer, un peu d'XP, beaucoup d'XP) sur N jours ; pour chacune :
// les victoires, les temps (min / médiane / max), les niveaux atteints, le temps du combat contre le golem ; puis, jour par jour, quelle stratégie est la PLUS RAPIDE : la cible est qu'aucune ne gagne tous les jours et que chacune gagne au moins ~15 % des jours.
// `REGLAGES='{"xpBase":50}'` essaie d'autres valeurs sans rien changer au code ; `PRIORITES_<stratégie>='bottes-legeres,...'` d'autres listes de cartes.
const PREMIER = daysFromCivil(2026, 11, 2);
const arg = (nom: string, defaut: number): number => Number(process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? defaut);
const jours = arg("jours", 60);
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
}
function jouer1(jour: number, strategie: Strategie): Partie1 {
  const p = new Partie(dailyRush(jour), reglages);
  const etat = etatPilote(strategie, -2, p, process.env.SEUIL_PEU ? Number(process.env.SEUIL_PEU) : undefined);
  while (!p.finie) pasDuPilote(p, etat);
  const r = p.resultat();
  return { victoire: r.victoire, s: r.ticks / 60, nv: r.nv, combat: p.barriere >= 0 ? (r.ticks - p.barriere) / 60 : 0, subis: r.subis, tues: r.tues };
}
const q = (v: number[], d = 1): string => {
  const t = [...v].sort((a, b) => a - b);
  return t.length === 0 ? "—" : `${t[0]!.toFixed(d)} / ${t[Math.floor(t.length / 2)]!.toFixed(d)} / ${t[t.length - 1]!.toFixed(d)}`;
};
const resultats = new Map<Strategie, Partie1[]>();
for (const s of STRATEGIES) resultats.set(s, Array.from({ length: jours }, (_, k) => jouer1(PREMIER + k, s)));
for (const s of STRATEGIES) {
  const r = resultats.get(s)!;
  const g = r.filter((x) => x.victoire);
  console.log(`« ${s} » : ${g.length}/${jours} victoires · temps ${q(g.map((x) => x.s))} s · niveaux ${q(r.map((x) => x.nv), 0)} · combat du golem ${q(g.map((x) => x.combat))} s · dégâts subis ${(r.reduce((a, x) => a + x.subis, 0) / jours).toFixed(2)} · monstres tués ${q(r.map((x) => x.tues), 0)}`);
}
// La plus rapide de chaque jour (une défaite vaut le pire temps) ; une égalité à 1 s près va à la stratégie la plus simple (foncer, puis peu).
const gagnant = new Map<Strategie, number>(STRATEGIES.map((s) => [s, 0]));
const ecarts = new Map<Strategie, number[]>(STRATEGIES.map((s) => [s, []]));
for (let k = 0; k < jours; k++) {
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
console.log(`La plus rapide (${jours} jours) : ${STRATEGIES.map((s) => `${s} ${gagnant.get(s)} (${((100 * gagnant.get(s)!) / jours).toFixed(0)} %, écart médian ${q(ecarts.get(s)!).split(" / ")[1]} s)`).join(" · ")}`);
