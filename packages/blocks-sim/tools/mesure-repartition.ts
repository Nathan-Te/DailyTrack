import { daysFromCivil } from "@cdj/core";
import { genererSuite, graineDuJour, PIECES, RAMPE_PAR_DEFAUT, TAILLE_SERIE, type Rampe } from "../src/index";

// `npm run mesure:repartition -w @cdj/blocks-sim -- [--graines=1000] [--pente=…] [--rangmax=…] [--poidsbase=<json>] [--du=AAAA-MM-JJ]` : la RÉPARTITION des pièces de la suite (lot B8b, seed § 4), sur N jours, au début (séries 0 à 10) puis
// au plafond de la rampe (les 20 séries qui suivent `rangMax`), par famille de grosseur : dominos, pièces de 3 cases, de 4 cases, de 5 cases ou plus. Compte aussi les entorses aux règles de série (il ne doit y en avoir aucune).
// `--poidsbase='{"domino":8}'` essaie d'autres poids de base (par nom de forme : domino, barre3, barre4, barre5, carre2, carre3, coin, l, grandl, t, grandt, s, z, rect) ; réglage seulement, rien n'est écrit.
const arg = (n: string, d: number): number => Number(process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const poidsBase = process.argv.find((a) => a.startsWith("--poidsbase="))?.slice(12);
if (poidsBase) {
  const base = JSON.parse(poidsBase) as Record<string, number>;
  for (const p of PIECES) {
    const k = p.nom.replace(/-\d+$/, "");
    if (k in base) (p as { poids: number }).poids = base[k]!;
  }
}
const N = arg("graines", 1000);
const rampe: Rampe = { pente: arg("pente", RAMPE_PAR_DEFAUT.pente), rangMax: arg("rangmax", RAMPE_PAR_DEFAUT.rangMax) };
const du = process.argv.find((a) => a.startsWith("--du="))?.slice(5);
const depart = du ? daysFromCivil(Number(du.slice(0, 4)), Number(du.slice(5, 7)), Number(du.slice(8, 10))) : daysFromCivil(2026, 11, 2);

const famille = (cases: number): "dominos" | "trois" | "quatre" | "cinqEtPlus" => (cases <= 2 ? "dominos" : cases === 3 ? "trois" : cases === 4 ? "quatre" : "cinqEtPlus");
const fenetres = { debut: [0, 11], plafond: [rampe.rangMax, rampe.rangMax + 20] } as const;
const compte = { debut: { dominos: 0, trois: 0, quatre: 0, cinqEtPlus: 0 }, plafond: { dominos: 0, trois: 0, quatre: 0, cinqEtPlus: 0 } };
const entorses = { dominos: 0, doublons: 0, sansGrosse: 0, boites33: 0 };
const pieces = Math.min(2000, (rampe.rangMax + 20) * TAILLE_SERIE);
for (let i = 0; i < N; i++) {
  const suite = genererSuite(graineDuJour(depart + i), rampe, pieces);
  for (let s = 0; s * TAILLE_SERIE + 2 < suite.length; s++) {
    const trio = suite.slice(s * TAILLE_SERIE, (s + 1) * TAILLE_SERIE).map((id) => PIECES[id]!);
    if (trio.filter((p) => p.cases === 2).length > 1) entorses.dominos++;
    if (new Set(trio.map((p) => p.id)).size < trio.length) entorses.doublons++;
    if (!trio.some((p) => p.cases >= 4)) entorses.sansGrosse++;
    if (trio.filter((p) => p.boite33).length > 1) entorses.boites33++;
    for (const [nom, [a, b]] of Object.entries(fenetres) as ["debut" | "plafond", readonly [number, number]][]) if (s >= a && s < b) for (const p of trio) compte[nom][famille(p.cases)]++;
  }
}
const pct = (c: Record<string, number>): Record<string, number> => {
  const t = Object.values(c).reduce((x, y) => x + y, 0);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, +((100 * v) / t).toFixed(1)]));
};
console.log(JSON.stringify({ jours: N, rampe, poidsBase: poidsBase ? JSON.parse(poidsBase) : "catalogue", pourcentDebut: pct(compte.debut), pourcentPlafond: pct(compte.plafond), entorses }));
