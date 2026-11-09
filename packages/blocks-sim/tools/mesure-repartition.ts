import { BLOCKS_GENERATOR_VERSION, dailyBlocks, graineDuJour, PIECES, serieCandidate, resoudreReglage } from "../src/index";
import { arg, jouerBot, nombre, type NomBot, premierJour, reglageDesArguments, seriesVues } from "./aide";

// `npm run mesure:repartition -w @cdj/blocks-sim -- [--graines=1000] [--bot=diamant|moyen|faible] [--pente=…] [--rangmax=…] [--apres=…] [--essais=…] [--poidsbase=<json>] [--du=AAAA-MM-JJ]` : la RÉPARTITION des pièces (lot B8b, seed § 4 ; refaite au lot B8c
// pour le tirage adapté), sur N jours, au début (séries 0 à 10) puis au plafond de la rampe (les 20 séries qui suivent `rangMax`), par famille de grosseur : dominos, pièces de 3 cases, de 4 cases, de 5 cases ou plus.
// Deux mesures : (1) `candidates` — la première série candidate de chaque rang, avant toute exigence : c'est la répartition des poids et de la rampe (celle de B8b) ; (2) `tirees` — les pièces que le tirage a réellement données
// au fil des parties du bot choisi : ce que voit un joueur (les exigences y pèsent). Compte aussi les entorses aux règles de série (il ne doit y en avoir aucune, ni dans l'une ni dans l'autre).
// `--poidsbase='{"domino":8}'` essaie d'autres poids de base (par nom de forme : domino, barre3, barre4, barre5, carre2, carre3, coin, l, grandl, t, grandt, s, z, rect) ; réglage seulement, rien n'est écrit.
const poidsBase = arg("poidsbase");
if (poidsBase) {
  const base = JSON.parse(poidsBase) as Record<string, number>;
  for (const p of PIECES) {
    const k = p.nom.replace(/-\d+$/, "");
    if (k in base) (p as { poids: number }).poids = base[k]!;
  }
}
const N = nombre("graines", 1000);
const bot = (arg("bot") ?? "diamant") as NomBot;
const reglage = reglageDesArguments();
const complet = resoudreReglage(reglage);
const rangMax = complet.rampe.rangMax;
const depart = premierJour();

type Famille = "dominos" | "trois" | "quatre" | "cinqEtPlus";
const famille = (cases: number): Famille => (cases <= 2 ? "dominos" : cases === 3 ? "trois" : cases === 4 ? "quatre" : "cinqEtPlus");
const fenetres = { debut: [0, 11], plafond: [rangMax, rangMax + 20] } as const;
const vide = (): Record<Famille, number> => ({ dominos: 0, trois: 0, quatre: 0, cinqEtPlus: 0 });
const mesures = { candidates: { debut: vide(), plafond: vide() }, tirees: { debut: vide(), plafond: vide() } };
const entorses = { dominos: 0, doublons: 0, sansGrosse: 0, boites33: 0, tresGrosseTot: 0 };
const verifier = (trio: readonly { cases: number; id: number; boite33: boolean; tresGrosse: boolean }[], rang: number): void => {
  if (trio.filter((p) => p.cases === 2).length > 1) entorses.dominos++;
  if (new Set(trio.map((p) => p.id)).size < trio.length) entorses.doublons++;
  if (!trio.some((p) => p.cases >= 4)) entorses.sansGrosse++;
  if (trio.filter((p) => p.boite33).length > 1) entorses.boites33++;
  if (rang < 2 && trio.some((p) => p.tresGrosse)) entorses.tresGrosseTot++;
};
const compter = (cible: Record<"debut" | "plafond", Record<Famille, number>>, rang: number, trio: readonly { cases: number }[]): void => {
  for (const [nom, [a, b]] of Object.entries(fenetres) as ["debut" | "plafond", readonly [number, number]][]) if (rang >= a && rang < b) for (const p of trio) cible[nom][famille(p.cases)]++;
};
for (let i = 0; i < N; i++) {
  const contenu = dailyBlocks(depart + i, BLOCKS_GENERATOR_VERSION, reglage);
  const g = graineDuJour(depart + i);
  for (let s = 0; s < rangMax + 20; s++) {
    const trio = serieCandidate(g, s, 0, complet.rampe);
    verifier(trio, s);
    compter(mesures.candidates, s, trio);
  }
  for (const v of seriesVues(contenu, jouerBot(bot, contenu).actions)) {
    verifier(v.pieces, v.rang);
    compter(mesures.tirees, v.rang, v.pieces);
  }
}
const pct = (c: Record<string, number>): Record<string, number> => {
  const t = Object.values(c).reduce((x, y) => x + y, 0);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, t === 0 ? 0 : +((100 * v) / t).toFixed(1)]));
};
console.log(
  JSON.stringify({
    jours: N,
    bot,
    rampe: complet.rampe,
    poidsBase: poidsBase ? JSON.parse(poidsBase) : "catalogue",
    candidates: { debut: pct(mesures.candidates.debut), plafond: pct(mesures.candidates.plafond) },
    tirees: { debut: pct(mesures.tirees.debut), plafond: pct(mesures.tirees.plafond), piecesAuPlafond: Object.values(mesures.tirees.plafond).reduce((x, y) => x + y, 0) },
    entorses,
  }),
);
