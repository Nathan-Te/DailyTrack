import { BOSS, BOSS_IDS, Partie, REGLAGES_DEFAUT, contenuScenario, etatPilote, pasDuPilote, reglagesDe } from "../src/index";

// LES BOSS (lot BR3) : `npm run boss:rush -w @cdj/rush-sim [-- --jours=60] [-- --boss=belier] [-- --cartes=lame-lourde,cadence] [-- --phase2]` (Node seulement). Pour chaque boss, le pilote le combat seul (`?scenario=boss`, jours de graines différentes) :
// victoires, durée du combat (min / médiane / max), dégâts subis. `--cartes` donne des améliorations au départ (« une construction complète adaptée »), `--auto=N` prend les N premières cartes de la construction adaptée du boss.
// `REGLAGES='{"golemVie":1200}'` essaie d'autres valeurs sans toucher au code.
if (process.env.VIE) for (const [id, v] of Object.entries(JSON.parse(process.env.VIE) as Record<string, number>)) (BOSS[BOSS_IDS.indexOf(id as (typeof BOSS_IDS)[number])] as { vie: number }).vie = v;
const arg = (nom: string): string | undefined => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const jours = Number(arg("jours") ?? 40);
const seul = arg("boss");
const cartes = (arg("cartes") ?? "").split(",").filter((x) => x);
const phase2 = process.argv.includes("--phase2");
// `--auto=N` : les N premières cartes de la « construction adaptée » du boss : ses deux cartes favorites (deux paliers chacune), puis des bottes, la cadence, la lame lourde et un soin.
const auto = Number(arg("auto") ?? 0);
const construction = (b: number): string[] => [BOSS[b]!.favorise[0]!, BOSS[b]!.favorise[1]!, BOSS[b]!.favorise[0]!, BOSS[b]!.favorise[1]!, "bottes-legeres", "cadence", "lame-lourde", "soin"];
const reglages = reglagesDe({ ...REGLAGES_DEFAUT, ...(process.env.REGLAGES ? (JSON.parse(process.env.REGLAGES) as object) : {}) });
// `VIE='{"chene":60,"grand-duc":50}'` : les points de vie d'un boss en % de ceux du golem, sans toucher au code.
if (process.env.VIE) for (const [id, v] of Object.entries(JSON.parse(process.env.VIE) as Record<string, number>)) (BOSS[BOSS_IDS.indexOf(id as (typeof BOSS_IDS)[number])] as { vie: number }).vie = v;
const q = (v: number[]): string => {
  const t = [...v].sort((a, b) => a - b);
  return t.length === 0 ? "—" : `${t[0]!.toFixed(1)} / ${t[Math.floor(t.length / 2)]!.toFixed(1)} / ${t[t.length - 1]!.toFixed(1)}`;
};
for (let b = 0; b < BOSS_IDS.length; b++) {
  if (seul && BOSS_IDS[b] !== seul) continue;
  const temps: number[] = [];
  let victoires = 0;
  let subis = 0;
  let cap = 0;
  let totalChocs = 0;
  for (let k = 0; k < jours; k++) {
    const amelio = cartes.length > 0 ? cartes : auto > 0 ? construction(b).slice(0, auto) : [];
    const p = new Partie(contenuScenario("boss", { boss: b, jour: k, phase2, ameliorations: amelio }), reglages, true);
    const etat = etatPilote("foncer", -2, p);
    let chocs = 0;
    while (!p.finie && p.tick < 36000) {
      pasDuPilote(p, etat);
      if (p.evenements.length > 0) {
        chocs += p.evenements.filter((e) => e.k === "choc").length;
        p.vider();
      }
    }
    totalChocs += chocs;
    const r = p.resultat();
    if (r.victoire) {
      victoires++;
      temps.push(r.ticks / 60);
    } else cap++;
    subis += r.subis;
  }
  console.log(`${BOSS_IDS[b]!.padEnd(10)} ${victoires}/${jours} victoires · combat ${q(temps)} s (min / médiane / max) · dégâts subis ${(subis / jours).toFixed(2)}${b === 3 ? ` · ${(totalChocs / jours).toFixed(1)} chocs au muret par combat` : ""} · cartes : ${cartes.length || (auto > 0 ? `${auto} adaptées` : 0)}${cap ? ` · ${cap} défaites ou temps dépassé` : ""}`);
}
