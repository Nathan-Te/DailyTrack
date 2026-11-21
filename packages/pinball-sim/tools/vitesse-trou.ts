// `npm run vitesse-trou:pinball -w @cdj/pinball-sim` (lot PBT1) : la fenêtre de tir du verrou des 6 dispositions (thème foire) quand le trou garde la bille jusqu'à 650, 900, 1 200 et 2 000 px/s (`trouVitesseMax`) —
// de quoi dire si la vitesse de capture du trou est la cause d'une fenêtre trop courte (elle ne l'est pas seule : voir le README du lot).
import { REGLAGES, copierReglages, dailyPinball, fenetresDeTir, toutesLesTables, cleDeTable } from "../src/index";
for (const v of [650, 900, 1200, 2000]) {
  const r = copierReglages(REGLAGES); (r as any).trouVitesseMax = v;
  const out: string[] = [];
  for (const c of toutesLesTables().filter((c) => c.theme === "foire")) {
    const f = fenetresDeTir(c, r);
    out.push(`${c.plan}${c.miroir ? "'" : ""} verrou ${f.ms.verrou}`);
  }
  console.log(`trouVitesseMax ${v} : ${out.join(" | ")}`);
}
