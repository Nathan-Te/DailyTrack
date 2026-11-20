import { Partie, THEMES_PINBALL, dailyPinball, defautsDeConception, densite, planDe, tirsDeConception, TIRS_MAX, TIRS_MIN, type ThemePinball } from "../src/index";

// OUTIL DU LOT PBT0 : règle les emplacements libres d'un plan d'essai. `npm run regler-essai:pinball -w @cdj/pinball-sim -- --plan=t1 --libres=0:30,2:25,3:40 [--iter=60] [--graine=1] [--miroir]`
// Une montée de colline : on déplace un emplacement libre (rayon en px après les deux-points) ; on garde le déplacement si **aucune règle de conception ne casse dans les quatre thèmes** (`defautsDeConception`) et si la plus petite
// fenêtre de tir de tous les thèmes (et, avec `--miroir`, du plan retourné) ne baisse pas ; à égalité, la densité la plus basse. Les rails, la porte et le mini-batteur sont écrits à la main dans `plans-essai.ts` : cet outil ne règle que
// les places de modules. Il écrit les coordonnées trouvées, à recopier dans `plans-essai.ts`.
const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const idPlan = valeur("plan") ?? "t1";
const libres = (valeur("libres") ?? "").split(",").filter(Boolean).map((l) => ({ i: Number(l.split(":")[0]), r: Number(l.split(":")[1] ?? 30) }));
const iterations = Number(valeur("iter") ?? 60);
let graine = Number(valeur("graine") ?? 1);
const alea = (): number => {
  graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0;
  return graine / 4294967296;
};
const plan = planDe(idPlan) as unknown as { emplacements: { x: number; y: number }[] };
const ids = args.includes("--miroir") ? [idPlan, `${idPlan}m`] : [idPlan];
const ordre: ThemePinball[] = ["espace", "ocean", "volcan", "foire"].filter((t) => (THEMES_PINBALL as readonly string[]).includes(t)) as ThemePinball[];

interface Bilan {
  /** Les règles de conception qui cassent (tous thèmes, tous sens), puis la plus petite fenêtre (ms) de tous les tirs, puis la densité : on minimise les défauts, puis on maximise la fenêtre. */
  defauts: number;
  pire: number;
  densite: number;
  raison: string;
}
function evaluer(meilleurPire: number): Bilan {
  let defauts = 0;
  let dens = 0;
  let raison = "";
  // d'abord les règles statiques, sans simulation, sur tous les thèmes et les deux sens
  for (const id of ids) {
    for (const theme of ordre) {
      const t = new Partie(dailyPinball(0, undefined, theme, id)).table;
      const d = defautsDeConception(t);
      defauts += d.length;
      if (d.length > 0 && raison === "") raison = `${id}/${theme} : ${d[0]}`;
      dens = Math.max(dens, densite(t).total);
    }
  }
  if (defauts > 0) return { defauts, pire: -1, densite: dens, raison };
  let pire = 1e9;
  for (const id of ids) {
    for (const theme of ordre) {
      const r = tirsDeConception(dailyPinball(0, undefined, theme, id));
      const requis = Object.entries(r.ms).filter(([n]) => n !== "poche");
      if (r.nombre < TIRS_MIN || r.nombre > TIRS_MAX) return { defauts: 1, pire: -1, densite: dens, raison: `${id}/${theme} : ${r.nombre} tirs` };
      for (const [, ms] of requis) pire = Math.min(pire, ms);
      if (pire < meilleurPire) return { defauts: 0, pire, densite: dens, raison: `${id}/${theme} : ${requis.map(([n, ms]) => `${n} ${ms}`).join(" ")}` };
    }
  }
  return { defauts: 0, pire, densite: dens, raison: "" };
}
const meilleurQue = (b: Bilan, m: Bilan): boolean => b.defauts < m.defauts || (b.defauts === m.defauts && (b.pire > m.pire || (b.pire === m.pire && b.densite < m.densite)));

// --aleatoire=N : N tirages uniformes de tous les emplacements libres dans leur boîte (le centre actuel ± rayon) ; les tirages sans défaut (règles statiques : instantané) sont mesurés (fenêtres), le meilleur sert de départ à la montée.
const tirages = Number(valeur("aleatoire") ?? 0);
if (tirages > 0) {
  const centre = libres.map((l) => ({ x: plan.emplacements[l.i]!.x, y: plan.emplacements[l.i]!.y }));
  const poser = (): void => libres.forEach((l, k) => {
    plan.emplacements[l.i]!.x = Math.round(centre[k]!.x + (alea() * 2 - 1) * l.r);
    plan.emplacements[l.i]!.y = Math.round(centre[k]!.y + (alea() * 2 - 1) * l.r);
  });
  const valides: { pos: number[][]; b: Bilan }[] = [];
  const limite = Number(valeur("garder") ?? 12);
  let n = 0;
  while (n < tirages && valides.length < limite) {
    n++;
    poser();
    let ok = true;
    for (const id of ids) {
      for (const theme of ordre) {
        if (!ok) break;
        ok = defautsDeConception(new Partie(dailyPinball(0, undefined, theme, id)).table).length === 0;
      }
    }
    if (ok) valides.push({ pos: libres.map((l) => [plan.emplacements[l.i]!.x, plan.emplacements[l.i]!.y]), b: evaluer(-1) });
  }
  console.log(`${n} tirages, ${valides.length} sans défaut`);
  valides.sort((a, b) => (b.b.pire - a.b.pire) || (a.b.densite - b.b.densite));
  const m = valides[0];
  if (m) {
    libres.forEach((l, k) => {
      plan.emplacements[l.i]!.x = m.pos[k]![0]!;
      plan.emplacements[l.i]!.y = m.pos[k]![1]!;
    });
    console.log(`meilleur tirage : pire fenêtre ${m.b.pire} ms, densité ${m.b.densite} ; ${valides.map((v) => v.b.pire).join(" ")}`);
  }
}
let meilleur = evaluer(-1);
console.log(`départ : ${meilleur.defauts} défauts${meilleur.defauts === 0 ? `, pire fenêtre ${meilleur.pire} ms, densité ${meilleur.densite}` : " (" + meilleur.raison + ")"}`);
for (let k = 0; k < iterations; k++) {
  const l = libres[Math.floor(alea() * libres.length)]!;
  const e = plan.emplacements[l.i]!;
  const avant = { x: e.x, y: e.y };
  e.x = Math.round(avant.x + (alea() * 2 - 1) * l.r);
  e.y = Math.round(avant.y + (alea() * 2 - 1) * l.r);
  const b = evaluer(meilleur.defauts === 0 ? meilleur.pire : -1);
  if (meilleurQue(b, meilleur)) {
    meilleur = b;
    console.log(`#${k} emplacement ${l.i} → (${e.x}, ${e.y}) : ${b.defauts} défauts, pire fenêtre ${b.pire} ms, densité ${b.densite}${b.defauts ? " (" + b.raison + ")" : ""}`);
  } else {
    e.x = avant.x;
    e.y = avant.y;
  }
}
console.log(JSON.stringify(plan.emplacements.map((e) => [e.x, e.y])));
console.log(meilleur.defauts === 0 ? `pire fenêtre ${meilleur.pire} ms, densité max ${meilleur.densite} ‰` : `${meilleur.defauts} défauts (${meilleur.raison})`);
