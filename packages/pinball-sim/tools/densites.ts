import { PINBALL_GENERATOR_VERSION, PLANS_ESSAI, THEMES_PINBALL, Partie, dailyPinball, densite, formesDeLaTable, toutesLesTables, DENSITE_MAX, type Contenu } from "../src/index";

// `npm run densites:pinball -w @cdj/pinball-sim` : le budget de densité (lot PBT0) mesuré — le contre-exemple de Nathan (Volcan × « doublette » après le lot PBL2, rails de 18 px du lot PBL1), les 94 tables du jour (rails de 18 px) et
// les plans d'essai (rails de 12 px). Les nombres sont des ‰ du haut du plateau.
const nathan: Contenu = { jour: 0, g: PINBALL_GENERATOR_VERSION, theme: "volcan", plan: "doublette", modules: ["geyser", "trou", "bumpers", "mini", "coulee", "mini"] };
const d = densite(new Partie(nathan).table, 18);
console.log(`la table de Nathan (volcan:doublette, rails de 18 px) : total ${d.total} ‰ (obstacles ${d.obstacles}, rails ${d.rails}) — ${formesDeLaTable(new Partie(nathan).table).length} formes`);
const jour = toutesLesTables().map((c) => densite(new Partie(c).table, 18).total).sort((a, b) => a - b);
const q = (t: readonly number[], p: number): number => t[Math.min(t.length - 1, Math.floor((t.length * p) / 100))]!;
console.log(`les ${jour.length} tables du jour (rails de 18 px) : min ${jour[0]}, médiane ${q(jour, 50)}, 90 % ${q(jour, 90)}, max ${jour[jour.length - 1]} ‰`);
const jour12 = toutesLesTables().map((c) => densite(new Partie(c).table).total).sort((a, b) => a - b);
console.log(`les mêmes tables avec des rails de 12 px : médiane ${q(jour12, 50)}, max ${jour12[jour12.length - 1]} ‰`);
const essais: number[] = [];
for (const p of PLANS_ESSAI) {
  for (const id of [p.id, `${p.id}m`]) {
    const v = THEMES_PINBALL.map((t) => densite(new Partie(dailyPinball(0, undefined, t, id)).table).total);
    essais.push(...v);
    console.log(`${id.padEnd(3)} ${THEMES_PINBALL.map((t, i) => `${t} ${v[i]}`).join("  ")}`);
  }
}
essais.sort((a, b) => a - b);
console.log(`plans d'essai : min ${essais[0]}, médiane ${q(essais, 50)}, max ${essais[essais.length - 1]} ‰ (plafond ${DENSITE_MAX})`);
