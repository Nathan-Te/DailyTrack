import { daysFromCivil } from "@cdj/core";
import { BOSS_IDS, DUREE_TICKS, HUMAIN, STRATEGIES, TICKS_PAR_SECONDE, dailyRush, ligneDuJour, type LigneMedailles, type Strategie } from "../src/index";

// LE TABLEAU DES MÉDAILLES du lot BR4 : `npm run medailles:rush -w @cdj/rush-sim [-- --jours=365] [--depuis=0] [--detail] [--md]` (Node seulement ; aucune base, aucun réseau).
// Pour chaque jour : les temps des trois stratégies du pilote de référence, la stratégie du Diamant, les quatre seuils, les temps du pilote HUMANISÉ (`HUMAIN`, `bot.ts`). Puis les chiffres du README du lot :
//   1. par stratégie (pilote de référence) : victoires, temps, parties anormalement longues (plus de 100 s, ou plus de 40 s de plus que la meilleure stratégie du jour), blocages détectés ;
//   2. le Diamant (meilleur des trois) : victoires, temps ;
//   3. PAR BOSS : le temps du Diamant, de l'or, de l'argent et du bronze, et celui du pilote humanisé (le meilleur des trois, et « foncer ») ; la part des jours où l'humanisé qui fonce atteint le bronze et où le meilleur de ses trois atteint l'argent.
// `HUMAIN='{"reaction":18}'` essaie un autre profil ; `--md` écrit les tableaux en Markdown. Les pourcentages ne se changent pas ici : la fiche (`medailles.bareme`) les porte, Nathan tranche.
const PREMIER = daysFromCivil(2026, 11, 2);
const arg = (nom: string, defaut: number): number => Number(process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? defaut);
const jours = arg("jours", 365);
const depuis = arg("depuis", 0);
const detail = process.argv.includes("--detail");
const md = process.argv.includes("--md");
const profil = { ...HUMAIN, ...(process.env.HUMAIN ? (JSON.parse(process.env.HUMAIN) as object) : {}) };
const s = (ticks: number): number => ticks / TICKS_PAR_SECONDE;
const med = (v: number[]): number => {
  const t = [...v].sort((a, b) => a - b);
  return t.length === 0 ? NaN : t[Math.floor(t.length / 2)]!;
};
const pct = (n: number, d: number): string => (d === 0 ? "—" : `${Math.round((100 * n) / d)} %`);
const f1 = (n: number): string => (Number.isNaN(n) ? "—" : n.toFixed(1));
const depart = Date.now();
const lignes: LigneMedailles[] = [];
let calcul = 0;
for (let k = 0; k < jours; k++) {
  const c = dailyRush(PREMIER + depuis + k);
  const t0 = performance.now();
  lignes.push(ligneDuJour(c, profil));
  calcul += performance.now() - t0;
}
const meilleurHumain = (l: LigneMedailles): number => Math.min(...STRATEGIES.map((x) => l.humain[x]));
if (detail) {
  for (const l of lignes) console.log(`jour ${l.jour - PREMIER} ${BOSS_IDS[l.boss]} ${l.theme} : ${STRATEGIES.map((x) => `${x} ${f1(s(l.temps[x]))}`).join(" · ")} → Diamant ${l.diamant} ${f1(s(l.seuils.author))} · or ${f1(s(l.seuils.gold))} · argent ${f1(s(l.seuils.silver))} · bronze ${f1(s(l.seuils.bronze))} · humain ${STRATEGIES.map((x) => f1(s(l.humain[x]))).join(" / ")}`);
}

console.log(`\n== 1. Le pilote de référence, par stratégie (${jours} jours) ==`);
for (const x of STRATEGIES) {
  const g = lignes.filter((l) => l.temps[x] < DUREE_TICKS);
  const t = g.map((l) => s(l.temps[x]));
  const longs = lignes.filter((l) => l.temps[x] > 100 * TICKS_PAR_SECONDE).length;
  const retard = lignes.filter((l) => l.temps[x] - Math.min(...STRATEGIES.map((y) => l.temps[y])) > 40 * TICKS_PAR_SECONDE).length;
  const bloques = lignes.filter((l) => l.blocages[x] > 0).length;
  console.log(`« ${x} » : ${g.length}/${jours} victoires · temps ${f1(Math.min(...t))} / ${f1(med(t))} / ${f1([...t].sort((a, b) => a - b)[Math.floor(t.length * 0.95)]!)} (p95) / ${f1(Math.max(...t))} s · plus de 100 s : ${longs} · à plus de 40 s du meilleur du jour : ${retard} · blocages détectés : ${lignes.reduce((a, l) => a + l.blocages[x], 0)} (sur ${bloques} jours)`);
}
const gagnant = new Map<Strategie, number>(STRATEGIES.map((x) => [x, 0]));
for (const l of lignes) gagnant.set(l.diamant, gagnant.get(l.diamant)! + 1);
const diam = lignes.map((l) => l.seuils.author);
console.log(`Le Diamant (meilleur des trois) : ${lignes.filter((l) => l.seuils.author < DUREE_TICKS).length}/${jours} jours · temps ${f1(s(Math.min(...diam)))} / ${f1(s(med(diam)))} / ${f1(s(Math.max(...diam)))} s · stratégie : ${STRATEGIES.map((x) => `${x} ${gagnant.get(x)} (${pct(gagnant.get(x)!, jours)})`).join(" · ")}`);

console.log(`\n== 2. Le pilote humanisé (${JSON.stringify(profil)}), par stratégie ==`);
for (const x of STRATEGIES) {
  const g = lignes.filter((l) => l.humain[x] < DUREE_TICKS);
  console.log(`« ${x} » : ${g.length}/${jours} victoires · temps médian ${f1(s(med(g.map((l) => l.humain[x]))))} s`);
}
const bh = lignes.filter((l) => meilleurHumain(l) < DUREE_TICKS);
console.log(`Le meilleur des trois : ${bh.length}/${jours} victoires · médiane ${f1(s(med(bh.map(meilleurHumain))))} s`);

console.log(`\n== 3. Par boss : médianes en secondes (Diamant / or / argent / bronze · humanisé : meilleur des trois / « foncer ») et atteinte des médailles ==`);
const sep = md ? "|" : " ";
if (md) console.log("| Boss | jours | Diamant | Or | Argent | Bronze | humanisé : meilleur des trois | humanisé : foncer | foncer humanisé ≤ bronze | meilleur des trois humanisé ≤ argent | ≤ or |\n|---|---|---|---|---|---|---|---|---|---|---|");
for (let b = 0; b < BOSS_IDS.length; b++) {
  const jb = lignes.filter((l) => l.boss === b);
  if (jb.length === 0) continue;
  const cols = [BOSS_IDS[b]!, String(jb.length), f1(s(med(jb.map((l) => l.seuils.author)))), f1(s(med(jb.map((l) => l.seuils.gold)))), f1(s(med(jb.map((l) => l.seuils.silver)))), f1(s(med(jb.map((l) => l.seuils.bronze)))), f1(s(med(jb.map(meilleurHumain)))), f1(s(med(jb.map((l) => l.humain.foncer)))), pct(jb.filter((l) => l.humain.foncer <= l.seuils.bronze).length, jb.length), pct(jb.filter((l) => meilleurHumain(l) <= l.seuils.silver).length, jb.length), pct(jb.filter((l) => meilleurHumain(l) <= l.seuils.gold).length, jb.length)];
  console.log(md ? `| ${cols.join(" | ")} |` : cols.join(sep + " "));
}
const tous = lignes;
console.log(`TOUS (${tous.length} j) : Diamant ${f1(s(med(tous.map((l) => l.seuils.author))))} · or ${f1(s(med(tous.map((l) => l.seuils.gold))))} · argent ${f1(s(med(tous.map((l) => l.seuils.silver))))} · bronze ${f1(s(med(tous.map((l) => l.seuils.bronze))))} · humanisé ${f1(s(med(tous.map(meilleurHumain))))} / foncer ${f1(s(med(tous.map((l) => l.humain.foncer))))} · foncer humanisé ≤ bronze ${pct(tous.filter((l) => l.humain.foncer <= l.seuils.bronze).length, tous.length)} · meilleur des trois humanisé ≤ argent ${pct(tous.filter((l) => meilleurHumain(l) <= l.seuils.silver).length, tous.length)} · ≤ or ${pct(tous.filter((l) => meilleurHumain(l) <= l.seuils.gold).length, tous.length)} · ≤ Diamant ${pct(tous.filter((l) => meilleurHumain(l) <= l.seuils.author).length, tous.length)}`);
// 4. La sensibilité : un joueur de chair n'est pas seulement lent à réagir ; il hésite, se trompe de chemin, rate un coup. Ce que ce pilote ne sait pas simuler, on le suppose ici : le meilleur des trois du pilote humanisé multiplié par un facteur de lenteur.
console.log(`\n== 4. Et si un joueur était plus lent que le pilote humanisé ? Part des jours où « le meilleur des trois humanisé × facteur » atteint chaque médaille ==`);
if (md) console.log("| facteur | Diamant | Or | Argent | Bronze |\n|---|---|---|---|---|");
for (const k of [1, 1.25, 1.5, 1.75, 2]) {
  const part = (m: "author" | "gold" | "silver" | "bronze"): string => pct(lignes.filter((l) => meilleurHumain(l) * k <= l.seuils[m]).length, lignes.length);
  const cols = [`×${k}`, part("author"), part("gold"), part("silver"), part("bronze")];
  console.log(md ? `| ${cols.join(" | ")} |` : `×${k} : Diamant ${cols[1]} · or ${cols[2]} · argent ${cols[3]} · bronze ${cols[4]}`);
}
// 5. Des barèmes à comparer (propositions : la fiche garde 130 / 160 / 200 tant que Nathan n'a pas tranché) : pour chaque facteur de lenteur, la part des jours où le meilleur des trois humanisé × facteur atteint l'or / l'argent / le bronze.
const candidats: [number, number, number][] = [[130, 160, 200], [140, 180, 240], [150, 200, 300]];
console.log(`\n== 5. Barèmes : part des jours où « meilleur des trois humanisé × facteur » ≤ or / argent / bronze (pourcentages du Diamant) ==`);
if (md) console.log("| barème | ×1,25 | ×1,5 | ×1,75 | ×2 | ×2,5 |\n|---|---|---|---|---|---|");
for (const b of candidats) {
  const cols = [1.25, 1.5, 1.75, 2, 2.5].map((k) => [0, 1, 2].map((i) => Math.round((100 * lignes.filter((l) => meilleurHumain(l) * k <= (l.seuils.author * b[i]!) / 100).length) / lignes.length)).join(" / "));
  console.log(md ? `| ${b.join(" / ")} % | ${cols.join(" | ")} |` : `${b.join("/")} % : ${[1.25, 1.5, 1.75, 2, 2.5].map((k, i) => `×${k} → ${cols[i]}`).join(" · ")}`);
}
console.log(`\nTemps de calcul d'un jour (3 parties du pilote + 3 humanisées, Node) : ${(calcul / jours).toFixed(0)} ms en moyenne (mur total ${((Date.now() - depart) / 1000).toFixed(0)} s)`);
