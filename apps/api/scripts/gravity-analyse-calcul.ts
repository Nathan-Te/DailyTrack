// Les calculs de l'analyse des parties de « Gravity » (lot GR5, l'outil du calibrage du lot GR6) : **purs**, sans base ni réseau — `gravity-analyse.ts` lit la base et les affiche, `test/gravityAnalyse.test.ts` les essaie.
// **Rien de personnel n'y entre** : ni identifiant, ni pseudo, ni adresse, ni rediffusion — la requête ne les lit pas ; la sortie ne porte que des effectifs, des quantiles et des parts (règle du dépôt : « jamais d'identifiant dans un journal »).
import { TICKS_PAR_SECONDE } from "@cdj/gravity-sim";

/** Une partie classée (la meilleure d'un joueur ce jour-là, rejouée par le serveur), telle que la table commune la garde. */
export interface PartieAnalysee {
  day: number;
  score: number;
  /** La durée en pas (120 par seconde). */
  ticks: number;
  /** Les mètres, lus dans `mesures` (null : absente d'une ligne d'avant ce champ). */
  distance: number | null;
  /** Le rang de la médaille : 0 aucune, 1 bronze, 2 argent, 3 or, 4 Diamant. */
  medaille: number;
  apercu: boolean;
  sim: number;
  generateur: number;
}

/** La requête : **une seule**, qui lit les colonnes utiles d'une ligne par partie classée des jours demandés (jamais `replay`, jamais `player_id`), par un index de `resultats_jeu` dont la clé commence par `(jeu, day)` (SQLite prend `resultats_jeu_by_rank` ou `_by_inputs` : tous deux conviennent). */
export const REQUETE_PARTIES = `SELECT day, cle1, cle2, medal, mesures, apercu, sim_version, generator_version FROM resultats_jeu WHERE jeu = ? AND day >= ? AND day <= ? AND hidden = 0 ORDER BY day`;

/** Le plan de la requête, vérifié avant de la lancer (règle « Turso sobre » : toute requête vérifie son plan) : elle doit chercher par un index sur `(jeu, day)`, jamais balayer la table. Lève sinon. */
export function verifierPlan(details: readonly string[]): void {
  const lignes = details.filter((d) => /resultats_jeu/.test(d));
  if (lignes.length === 0) throw new Error(`plan illisible : ${details.join(" | ")}`);
  for (const d of lignes) {
    if (/^SCAN/.test(d.trim()) && !/USING (COVERING )?INDEX/.test(d)) throw new Error(`la requête balaierait toute la table : ${d}`);
    if (!/USING (COVERING )?INDEX resultats_jeu_by_\w+ \(jeu=\? AND day/.test(d)) throw new Error(`la requête ne cherche pas par un index sur (jeu, day) de resultats_jeu : ${d}`);
  }
}

const MEDAILLES: Record<string, number> = { bronze: 1, silver: 2, gold: 3, author: 4 };

/** Une ligne brute de la table → une partie ; `null` si elle ne ressemble pas à une partie de Gravity (score non entier). Le score est `−cle1` (la table range le plus grand en tête : `signe: -1`). */
export function partieDe(brut: Record<string, unknown>): PartieAnalysee | null {
  const cle1 = Number(brut.cle1);
  const cle2 = Number(brut.cle2);
  if (!Number.isFinite(cle1) || !Number.isFinite(cle2)) return null;
  let distance: number | null = null;
  try {
    const m = brut.mesures ? (JSON.parse(String(brut.mesures)) as { distance?: unknown }) : null;
    if (m && typeof m.distance === "number") distance = m.distance;
  } catch {
    /* une ligne sans mesures lisibles : la distance manque, le reste compte */
  }
  return { day: Number(brut.day), score: -cle1 || 0, ticks: cle2, distance, medaille: MEDAILLES[String(brut.medal)] ?? 0, apercu: Number(brut.apercu) === 1, sim: Number(brut.sim_version), generateur: Number(brut.generator_version) };
}

export interface Quantiles {
  n: number;
  min: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  max: number;
  moyenne: number;
}
/** Les quantiles (rang le plus proche : le `p`-ième centile est la valeur du rang `⌈p × n⌉`) ; `null` sans valeur. */
export function quantiles(valeurs: readonly number[]): Quantiles | null {
  if (valeurs.length === 0) return null;
  const t = [...valeurs].sort((a, b) => a - b);
  const q = (p: number): number => t[Math.max(0, Math.ceil(p * t.length) - 1)]!;
  return { n: t.length, min: t[0]!, p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), max: t[t.length - 1]!, moyenne: Math.round(t.reduce((a, b) => a + b, 0) / t.length) };
}

export interface AnalyseDuJour {
  day: number;
  /** Les parties classées de ce jour, dont celles de l'aperçu. */
  parties: number;
  apercu: number;
  score: Quantiles | null;
  distance: Quantiles | null;
  /** La durée des parties, en secondes. */
  duree: Quantiles | null;
  /** La part (0 à 1) des parties qui atteignent au moins le bronze, l'argent, l'or, le Diamant. */
  medailles: { bronze: number; argent: number; or: number; diamant: number };
  /** Les versions (générateur / simulation) des parties de ce jour, si elles diffèrent : un jour rejoué sous une autre version est à lire à part. */
  versions: string[];
}

const part = (parties: readonly PartieAnalysee[], rang: number): number => (parties.length === 0 ? 0 : parties.filter((p) => p.medaille >= rang).length / parties.length);

/** L'analyse d'un jour. */
export function analyserJour(day: number, parties: readonly PartieAnalysee[]): AnalyseDuJour {
  const distances = parties.flatMap((p) => (p.distance === null ? [] : [p.distance]));
  return {
    day,
    parties: parties.length,
    apercu: parties.filter((p) => p.apercu).length,
    score: quantiles(parties.map((p) => p.score)),
    distance: quantiles(distances),
    duree: quantiles(parties.map((p) => Math.round(p.ticks / TICKS_PAR_SECONDE))),
    medailles: { bronze: part(parties, 1), argent: part(parties, 2), or: part(parties, 3), diamant: part(parties, 4) },
    versions: [...new Set(parties.map((p) => `g${p.generateur}/sim${p.sim}`))].sort(),
  };
}

/** Les parties groupées par jour, puis analysées (les jours sans partie n'ont pas de ligne). */
export function analyser(parties: readonly PartieAnalysee[]): AnalyseDuJour[] {
  const parJour = new Map<number, PartieAnalysee[]>();
  for (const p of parties) (parJour.get(p.day) ?? parJour.set(p.day, []).get(p.day)!).push(p);
  return [...parJour].sort((a, b) => a[0] - b[0]).map(([d, ps]) => analyserJour(d, ps));
}

const pct = (x: number): string => `${Math.round(x * 100)} %`;
const trois = (q: Quantiles | null, unite = ""): string => (q ? `${q.p10} / ${q.p50} / ${q.p90}${unite} (max ${q.max})` : "—");

/** Le texte : une ligne par jour (effectif, score, distance, durée, médailles, seuils) puis une ligne pour tous les jours. `date` : `AAAA-MM-JJ` d'un numéro de jour ; `seuils` : ceux du jour, s'ils sont connus. */
export function formater(analyses: readonly AnalyseDuJour[], toutes: AnalyseDuJour | null, date: (jour: number) => string, seuils: (jour: number) => string | null = () => null): string {
  const en = (a: AnalyseDuJour, jour: string): string[] => [
    `${jour}  ${String(a.parties).padStart(4)} partie(s)${a.apercu > 0 ? ` (dont ${a.apercu} d'aperçu)` : ""}${a.parties < 5 ? "  ⚠ moins de 5 : les quantiles ne disent presque rien" : ""}`,
    `    score     p10 / méd. / p90 : ${trois(a.score)}`,
    `    distance  p10 / méd. / p90 : ${trois(a.distance, " m")}`,
    `    durée     p10 / méd. / p90 : ${trois(a.duree, " s")}`,
    `    médailles atteintes : bronze ${pct(a.medailles.bronze)} · argent ${pct(a.medailles.argent)} · or ${pct(a.medailles.or)} · Diamant ${pct(a.medailles.diamant)}`,
    ...(a.versions.length > 0 ? [`    versions : ${a.versions.join(", ")}`] : []),
  ];
  const lignes = analyses.flatMap((a) => {
    const s = seuils(a.day);
    return [...en(a, date(a.day)), ...(s ? [`    seuils du jour : ${s}`] : [])];
  });
  if (toutes && analyses.length > 1) lignes.push("", ...en(toutes, "tous les jours"));
  return lignes.join("\n");
}
