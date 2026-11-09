import { BLOCKS_GENERATOR_VERSION, dailyBlocks, jouer, partPosable, partPouce, piecesPosables, PLAFOND_PIECES, REGLAGE_PAR_DEFAUT, resoudreReglage, serieAuRang, serieCandidate, tirerSerie } from "../src/index";
import { arg, jouerBot, nombre, type NomBot, posableVue, pouceVu, premierJour, reglageDesArguments, type SerieVue, seriesVues } from "./aide";

// `npm run mesure:tirage -w @cdj/blocks-sim -- [--graines=1000] [--bot=faible|moyen|diamant] [--du=AAAA-MM-JJ] [--essais=40] [--pente=1] [--rangmax=80] [--posable=25,100,60] [--pouce=60,45,80] [--k=8]` (lot B8c) :
// le tirage adapté à la grille, mesuré sur N jours joués par un bot jusqu'à la fin de la partie (ou le plafond de 2 000 pièces) :
//   · la part des séries POSABLES et celle des séries avec un COUP DE POUCE, par tranche de rang (que l'exigence ait été posée ou non : c'est ce que le joueur voit), et, pour comparer, la part des séries qui seraient posables sans s'adapter
//     à la grille (la première série candidate de chaque rang, celle d'un tirage qui ne regarde pas la grille) ;
//   · la survie du bot (en pièces) : minimum, quartiles, médiane, maximum, part des parties qui touchent le plafond ;
//   · le temps du tirage d'une série (médiane et pire cas, rejoué sur les grilles vues) et le temps du rejeu serveur d'une partie complète (médiane, pire cas) ;
//   · le nombre d'essais utilisés. Un renseignement pour régler le tirage : jamais une cible de survie d'un bot en elle-même hors de la consigne du lot.
const N = nombre("graines", 1000);
const bot = (arg("bot") ?? "diamant") as NomBot;
const reglage = reglageDesArguments();
const complet = resoudreReglage(reglage);
const depart = premierJour();
const TRANCHES: readonly (readonly [number, number])[] = [[0, 10], [10, 25], [25, 50], [50, 75], [75, 100], [100, 150], [150, 300], [300, 700]];
const q = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!;
const resume = (a: number[]) => ({ min: q(a, 0), q1: q(a, 25), mediane: q(a, 50), q3: q(a, 75), max: q(a, 100) });

const compte = TRANCHES.map(() => ({ series: 0, posables: 0, brutes: 0, pouces: 0, exige1: 0, exige2: 0, essais: 0, tenues: 0 }));
const survie: number[] = [];
const tempsRejeu: number[] = [];
const tempsTirage: number[] = [];
let plafond = 0;
const vues: { contenu: ReturnType<typeof dailyBlocks>; series: SerieVue[] }[] = [];

for (let i = 0; i < N; i++) {
  const contenu = dailyBlocks(depart + i, BLOCKS_GENERATOR_VERSION, reglage);
  const { actions, resultat } = jouerBot(bot, contenu);
  survie.push(resultat.poses);
  if (resultat.raison === "plafond") plafond++;
  const series = seriesVues(contenu, actions);
  if (i < 100) vues.push({ contenu, series });
  for (const s of series) {
    const t = TRANCHES.findIndex(([a, b]) => s.rang >= a && s.rang < b);
    if (t < 0) continue;
    const c = compte[t]!;
    c.series++;
    if (posableVue(s)) c.posables++;
    if (s.pieces.length === 3 && piecesPosables(s.grille, serieCandidate(contenu.graine, s.rang, 0, complet.rampe)) === 3) c.brutes++; // la première candidate, sans exigence : ce que le tirage donnerait sans s'adapter
    if (pouceVu(s)) c.pouces++;
    const d = tirerSerie(contenu.graine, s.rang, s.grille, complet);
    c.essais += d.essai + 1;
    if (d.exige1) c.exige1++;
    if (d.exige2) c.exige2++;
    if (d.posables === 3 && (!d.exige2 || d.pouce)) c.tenues++;
  }
  // Le rejeu du serveur : la partie complète, telle qu'elle se rejoue (tire chaque série).
  if (resultat.raison !== "arret") {
    const t0 = performance.now();
    jouer(contenu, actions);
    tempsRejeu.push(performance.now() - t0);
  }
}
// Le temps du tirage d'une série, sur les grilles vues (100 premiers jours).
for (const { contenu, series } of vues) {
  for (const s of series) {
    const t0 = performance.now();
    serieAuRang(contenu.graine, s.rang, s.grille, complet);
    tempsTirage.push(performance.now() - t0);
  }
}
const pct = (a: number, b: number): number => (b === 0 ? 0 : Math.round((1000 * a) / b) / 10);
console.log(
  JSON.stringify(
    {
      bot,
      graines: N,
      reglage: complet,
      survieEnPieces: resume(survie),
      ...(arg("brut") ? { survieBrute: survie } : {}),
      plafond: pct(plafond, N),
      tranches: TRANCHES.map(([a, b], t) => {
        const c = compte[t]!;
        return {
          series: `${a}-${b - 1}`,
          vues: c.series,
          posablesPct: pct(c.posables, c.series),
          posablesSansAdaptationPct: pct(c.brutes, c.series),
          poucePct: pct(c.pouces, c.series),
          exige1Pct: pct(c.exige1, c.series),
          exige2Pct: pct(c.exige2, c.series),
          nominalExige1: partPosable(Math.floor((a + b - 1) / 2), complet),
          nominalExige2: partPouce(Math.floor((a + b - 1) / 2), complet),
          essaisMoyens: c.series === 0 ? 0 : Math.round((10 * c.essais) / c.series) / 10,
          exigencesTenuesPct: pct(c.tenues, c.series),
        };
      }),
      tirageMs: { mediane: Math.round(100 * q(tempsTirage, 50)) / 100, p99: Math.round(100 * q(tempsTirage, 99)) / 100, max: Math.round(100 * q(tempsTirage, 100)) / 100, series: tempsTirage.length },
      rejeuMs: { mediane: Math.round(10 * q(tempsRejeu, 50)) / 10, max: Math.round(10 * q(tempsRejeu, 100)) / 10, parties: tempsRejeu.length },
      plafondPieces: PLAFOND_PIECES,
      defaut: REGLAGE_PAR_DEFAUT === complet,
    },
    null,
    1,
  ),
);
