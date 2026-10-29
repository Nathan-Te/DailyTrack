// Lot V1 (plateforme) : la mesure du sac de thèmes, dans les deux jeux. `npm run mesure:themes` écrit des tableaux Markdown :
//  1. avant : l'ancienne règle sur les 60 prochains jours et sur les jours déjà servis (répétitions d'un jour à l'autre, alternances A B A, écart maximal entre deux apparitions d'un thème) ;
//  2. après : le sac de thèmes sur 365 jours simulés à partir d'une bascule fictive, et dans le pire cas de toutes les positions possibles de cette bascule dans un cycle ;
//  3. les 30 prochains jours (date, thème) avant / après, avec le vrai code (registre des jours de Track, niveaux figés de Jump) ;
//  4. avec `--niveaux` : la validité des 365 niveaux (Track : un circuit validé par le pilote, jamais le secours ; Jump : un niveau dont la preuve de l'auteur arrive, jamais le secours,
//     aucune règle de `dailyProblems` enfreinte). Long (plusieurs minutes).
// Options : `--depuis=AAAA-MM-JJ` (premier jour des 30 prochains jours et de la bascule fictive ; demain par défaut n'existe pas : le jour de la mesure est fixé pour que le résultat se
// relise), `--bascule=AAAA-MM-JJ` (la bascule fictive des 365 jours).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay, parseDay, themeDuSac, type ReglesSac } from "../packages/core/src/index";
import * as track from "../packages/sim/src/index";
import * as jump from "../packages/jump-sim/src/index";

const arg = (nom: string, defaut: string): string => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? defaut;
const DEPUIS = parseDay(arg("depuis", "2026-10-30"))!;
const BASCULE = parseDay(arg("bascule", "2026-11-10"))!;
const NIVEAUX = process.argv.includes("--niveaux");
const TABLEAU = process.argv.includes("--tableau");

interface Stats {
  jours: number;
  repetitions: number;
  alternances: number;
  ecartMax: number;
}
function stats(suite: readonly string[]): Stats {
  let ecartMax = 0;
  for (const t of new Set(suite)) {
    let dernier = -1;
    suite.forEach((x, i) => {
      if (x !== t) return;
      if (dernier >= 0) ecartMax = Math.max(ecartMax, i - dernier);
      dernier = i;
    });
  }
  return {
    jours: suite.length,
    repetitions: suite.filter((x, i) => i > 0 && x === suite[i - 1]).length,
    alternances: suite.filter((x, i) => i > 1 && x === suite[i - 2]).length,
    ecartMax,
  };
}
const ligne = (nom: string, s: Stats) => `| ${nom} | ${s.jours} | ${s.repetitions} | ${s.alternances} | ${s.ecartMax} |`;
const ENTETE = ["| mesure | jours | répétitions | A B A | écart max |", "|---|---:|---:|---:|---:|"];
const plage = (depuis: number, n: number, f: (d: number) => string): string[] => Array.from({ length: n }, (_, i) => f(depuis + i));

interface Jeu {
  nom: string;
  themes: readonly string[];
  sel: number;
  ancien: (d: number) => string;
  /** Le thème que donne le code en vigueur (registre des jours, niveaux figés). */
  actuel: (d: number) => string;
  /** Les jours déjà servis. */
  servis: { depuis: number; jusqua: number };
  /** Le sac de ce jeu, avec une bascule fictive (les jours d'avant sont à l'ancienne règle). */
  sac: (d: number, bascule: number) => string;
}

const regles = (themes: readonly string[], sel: number, ancien: (d: number) => string, bascule: number): ReglesSac => ({
  n: themes.length,
  sel,
  ancien: (d) => themes.indexOf(ancien(d)),
  estAncien: (d) => d < bascule,
});

// ——— Track ———
const registre = track.resumeRegistreTrack();
const TRACK: Jeu = {
  nom: "Track",
  themes: track.THEME_NAMES,
  sel: 0x70a1,
  ancien: (d) => track.themeAncien(d).name,
  actuel: (d) => track.themeForDay(d).name,
  servis: { depuis: parseDay("2026-09-01")!, jusqua: parseDay(registre.jusqua)! },
  sac: (d, bascule) => track.THEME_NAMES[themeDuSac(d, regles(track.THEME_NAMES, 0x70a1, (x) => track.themeAncien(x).name, bascule))]!,
};

// ——— Jump ———
const dossier = join(process.cwd(), "apps/jump/public/levels");
const figes = readdirSync(dossier).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort();
const anciens = figes.filter((d) => (JSON.parse(readFileSync(join(dossier, `${d}.json`), "utf8")) as { generatorVersion: number }).generatorVersion < jump.JUMP_GENERATOR_SAC);
jump.declareOldFrozenDays(anciens); // comme le jeu et le serveur, d'après les niveaux figés du dépôt
const JUMP: Jeu = {
  nom: "Jump",
  themes: jump.JUMP_THEME_NAMES,
  sel: 0x6a756d70,
  ancien: (d) => jump.jumpThemeAncien(d),
  actuel: (d) => jump.jumpThemeForDay(d),
  servis: { depuis: parseDay(figes[0]!)!, jusqua: parseDay(figes.at(-1)!)! },
  sac: (d, bascule) => jump.JUMP_THEME_NAMES[themeDuSac(d, regles(jump.JUMP_THEME_NAMES, 0x6a756d70, (x) => jump.jumpThemeAncien(x), bascule))]!,
};

const out: string[] = [];
for (const jeu of [TRACK, JUMP]) {
  const n = jeu.themes.length;
  out.push(`## ${jeu.nom} (${n} thèmes, cycles de ${n} jours)`, "", ...ENTETE);
  out.push(ligne("avant — 60 prochains jours (ancienne règle)", stats(plage(DEPUIS, 60, jeu.ancien))));
  out.push(ligne(`avant — jours déjà servis (${formatDay(jeu.servis.depuis)} → ${formatDay(jeu.servis.jusqua)})`, stats(plage(jeu.servis.depuis, jeu.servis.jusqua - jeu.servis.depuis + 1, jeu.ancien))));
  out.push(ligne("avant — 365 jours (ancienne règle)", stats(plage(BASCULE, 365, jeu.ancien))));
  out.push(ligne(`après — 60 prochains jours (code en vigueur, depuis le ${formatDay(DEPUIS)})`, stats(plage(DEPUIS, 60, jeu.actuel))));
  out.push(ligne(`après — jours déjà servis (inchangés)`, stats(plage(jeu.servis.depuis, jeu.servis.jusqua - jeu.servis.depuis + 1, jeu.actuel))));
  const apres = stats(plage(BASCULE, 365, (d) => jeu.sac(d, BASCULE)));
  out.push(ligne(`après — 365 jours depuis la bascule fictive du ${formatDay(BASCULE)} (sac seul)`, apres));
  // Le pire cas : la bascule fictive à chacune des 3 × n positions possibles, la veille et l'avant-veille à l'ancienne règle (la jonction comprise).
  const pire: Stats = { jours: 367, repetitions: 0, alternances: 0, ecartMax: 0 };
  for (let decalage = 0; decalage < 3 * n; decalage++) {
    const b = BASCULE + decalage;
    const s = stats(plage(b - 2, 367, (d) => jeu.sac(d, b)));
    // Les deux premiers jours de la suite sont ceux de l'ancienne règle (la veille et l'avant-veille) : la jonction se compte, mais pas leur propre répétition éventuelle.
    const avantSac = stats(plage(b - 2, 2, (d) => jeu.ancien(d)));
    pire.repetitions = Math.max(pire.repetitions, s.repetitions - avantSac.repetitions);
    pire.alternances = Math.max(pire.alternances, s.alternances);
    pire.ecartMax = Math.max(pire.ecartMax, stats(plage(b, 365, (d) => jeu.sac(d, b))).ecartMax);
  }
  out.push(ligne(`après — pire cas sur ${3 * n} positions de la bascule (veille et avant-veille comprises)`, pire));
  out.push("", `**Les 30 prochains jours** (depuis le ${formatDay(DEPUIS)} ; le code en vigueur lit le registre / les niveaux figés) :`, "", "| date | avant | après |", "|---|---|---|");
  for (let i = 0; i < 30; i++) {
    const d = DEPUIS + i;
    out.push(`| ${formatDay(d)} | ${jeu.ancien(d)} | ${jeu.actuel(d)} |`);
  }
  out.push("");
}

if (NIVEAUX) {
  out.push("## Validité des niveaux (365 jours depuis la bascule fictive)", "");
  const t0 = Date.now();
  let secoursTrack = 0;
  let pireTentative = 0;
  for (let i = 0; i < 365; i++) {
    const c = track.dailyCircuit(BASCULE + i);
    if (c.fallback) secoursTrack++;
    pireTentative = Math.max(pireTentative, c.attempt);
  }
  out.push(`- Track : ${365 - secoursTrack} circuits sur 365 validés par le pilote (secours : ${secoursTrack}), tentative la plus longue : ${pireTentative} sur ${track.MAX_ATTEMPTS_SAC} (${((Date.now() - t0) / 1000).toFixed(0)} s).`);
  jump.declareOldFrozenDays([]);
  jump.declareOldFrozenDays(Array.from({ length: 30 }, (_, i) => formatDay(BASCULE - 1 - i)));
  const t1 = Date.now();
  let secoursJump = 0;
  let problemes = 0;
  for (let i = 0; i < 365; i++) {
    const L = jump.dailyLevel(BASCULE + i);
    if (L.fallback) secoursJump++;
    if (jump.dailyProblems(L).length > 0) problemes++;
  }
  out.push(`- Jump : ${365 - secoursJump} niveaux sur 365 dont la preuve de l'auteur arrive (secours : ${secoursJump}), ${problemes} niveau(x) qui enfreignent une règle de \`dailyProblems\` (${((Date.now() - t1) / 1000).toFixed(0)} s).`, "");
}

if (TABLEAU) {
  // Le tableau commun des 30 prochains jours (README du lot) : Track et Jump, avant / après.
  const t = ["| date | Track avant | Track après | Jump avant | Jump après |", "|---|---|---|---|---|"];
  for (let i = 0; i < 30; i++) {
    const d = DEPUIS + i;
    t.push(`| ${formatDay(d).slice(5)} | ${TRACK.ancien(d)} | ${TRACK.actuel(d)} | ${JUMP.ancien(d)} | ${JUMP.actuel(d)} |`);
  }
  console.log(t.join("\n"));
} else console.log(out.join("\n"));
