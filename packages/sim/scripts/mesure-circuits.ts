// Lot V2 (Track) : la mesure de la variété des circuits. `npm run mesure-circuits -- --jours 200 --depuis 2026-10-30` génère les circuits des jours à venir avec
// l'avant-dernière et la dernière version du générateur (`--versions 20,21` pour d'autres) et écrit `docs/track/variete.md` (`--sortie <fichier>` ; `--sans-ecrire` : la
// console seule). Hors CI : quelques minutes (≈ 0,15 s par circuit et par version).
//
// Ce qu'elle compte (`variete.ts`) : les motifs (suites de deux et trois éléments, dont « boost → longue ligne droite → virage serré » : par circuit, part des circuits qui
// l'ont, jours de suite), les suites de figures, les profils (lignes droites, rayons, dénivelé, changements de direction, part de chaque élément, temps de l'auteur), la
// ressemblance de deux jours qui se suivent (distance des profils, et la ressemblance du lot 49), et les mêmes chiffres par biome.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { GENERATOR_VERSION, THEME_NAMES, dailyCircuit, empreinte, formatDay, parseDay, ressemblance, rythmeDuJour, type ThemeName } from "../src/index";
import { MOTIF_BOOST_SERRE, distanceProfils, motifs, motifsBoostSerre, profilCircuit, vecteurProfil, type ProfilCircuit } from "../src/variete";

const argv = process.argv.slice(2);
const opt = (nom: string): string | undefined => {
  const i = argv.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
  if (i < 0) return undefined;
  return argv[i]!.includes("=") ? argv[i]!.slice(argv[i]!.indexOf("=") + 1) : argv[i + 1];
};
const JOURS = Number(opt("jours") ?? 200);
const DEPUIS = parseDay(opt("depuis") ?? "2026-10-30")!;
const VERSIONS = (opt("versions") ?? `${GENERATOR_VERSION - 1},${GENERATOR_VERSION}`).split(",").map(Number);
const SORTIE = opt("sortie") ?? join(import.meta.dirname ?? ".", "../../../docs/track/variete.md");
const ECRIRE = !argv.includes("--sans-ecrire");

interface Mesure {
  day: number;
  theme: ThemeName;
  rythme: string;
  spec: string;
  figures: string[];
  authorMs: number;
  fallback: boolean;
  ms: number;
  motif: number;
  m2: Set<string>;
  m3: Set<string>;
  profil: ProfilCircuit;
  vecteur: number[];
}

function mesurer(g: number): Mesure[] {
  const out: Mesure[] = [];
  for (let i = 0; i < JOURS; i++) {
    const day = DEPUIS + i;
    const t0 = performance.now();
    const c = dailyCircuit(day, 0, null, g);
    const ms = performance.now() - t0;
    const profil = profilCircuit(c.spec);
    out.push({ day, theme: c.theme, rythme: rythmeDuJour(day, g)?.replace("aerien", "aérien") ?? "—", spec: c.spec, figures: c.figures.map((f) => f.name), authorMs: c.authorMs, fallback: c.fallback, ms, motif: motifsBoostSerre(c.spec.split(" ").filter(Boolean)), m2: motifs(c.spec, 2), m3: motifs(c.spec, 3), profil, vecteur: vecteurProfil(profil, c.authorMs) });
    if (i % 25 === 24) process.stderr.write(`v${g} : ${i + 1}/${JOURS}\n`);
  }
  return out;
}

const moy = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pc = (x: number) => `${(100 * x).toFixed(0)} %`;
const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const s1 = (ms: number) => (ms / 1000).toFixed(1);
const quantile = (xs: readonly number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] ?? 0;
};

/** Part des circuits qui contiennent chaque motif. */
function frequences(ms: readonly Mesure[], cle: "m2" | "m3"): [string, number][] {
  const n = new Map<string, number>();
  for (const m of ms) for (const k of m[cle]) n.set(k, (n.get(k) ?? 0) + 1);
  return [...n.entries()].map(([k, c]) => [k, c / ms.length] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function suitesFigures(ms: readonly Mesure[], n: number): [string, number][] {
  const c = new Map<string, number>();
  for (const m of ms) {
    const vus = new Set<string>();
    for (let i = 0; i + n <= m.figures.length; i++) vus.add(m.figures.slice(i, i + n).join(" → "));
    for (const k of vus) c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c.entries()].map(([k, x]) => [k, x / ms.length] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

interface Resume {
  g: number;
  motifPart: number;
  motifMax: number;
  motifSuite: number;
  top3: [string, number];
  top2: [string, number];
  distSuite: number;
  distSuiteMin: number;
  ressSuite: number;
  auteur: number[];
  secours: number;
  genMoy: number;
  genMax: number;
  biomeMin: [string, number];
  biomeMoy: number;
}

function resume(g: number, ms: readonly Mesure[]): Resume {
  const dist: number[] = [];
  const ress: number[] = [];
  let motifSuite = 0;
  for (let i = 1; i < ms.length; i++) {
    dist.push(distanceProfils(ms[i - 1]!.vecteur, ms[i]!.vecteur));
    ress.push(ressemblance(empreinte({ spec: ms[i - 1]!.spec, figures: ms[i - 1]!.figures }), empreinte({ spec: ms[i]!.spec, figures: ms[i]!.figures })).total);
    if (ms[i - 1]!.motif > 0 && ms[i]!.motif > 0) motifSuite++;
  }
  const { min, moyenne } = distancesBiomes(ms);
  return {
    g,
    motifPart: ms.filter((m) => m.motif > 0).length / ms.length,
    motifMax: Math.max(...ms.map((m) => m.motif)),
    motifSuite,
    top3: frequences(ms, "m3")[0]!,
    top2: frequences(ms, "m2")[0]!,
    distSuite: moy(dist),
    distSuiteMin: Math.min(...dist),
    ressSuite: moy(ress),
    auteur: ms.map((m) => m.authorMs),
    secours: ms.filter((m) => m.fallback).length,
    genMoy: moy(ms.map((m) => m.ms)),
    genMax: Math.max(...ms.map((m) => m.ms)),
    biomeMin: min,
    biomeMoy: moyenne,
  };
}

/** Le profil moyen d'un biome (vecteur), et les distances entre biomes. */
function profilsBiomes(ms: readonly Mesure[]): Map<ThemeName, number[]> {
  const out = new Map<ThemeName, number[]>();
  for (const t of THEME_NAMES) {
    const de = ms.filter((m) => m.theme === t);
    if (de.length === 0) continue;
    out.set(t, de[0]!.vecteur.map((_, i) => moy(de.map((m) => m.vecteur[i]!))));
  }
  return out;
}
function distancesBiomes(ms: readonly Mesure[]): { min: [string, number]; moyenne: number; table: Map<string, number> } {
  const p = profilsBiomes(ms);
  const table = new Map<string, number>();
  let min: [string, number] = ["—", Infinity];
  const toutes: number[] = [];
  const noms = [...p.keys()];
  for (let i = 0; i < noms.length; i++)
    for (let j = i + 1; j < noms.length; j++) {
      const d = distanceProfils(p.get(noms[i]!)!, p.get(noms[j]!)!);
      table.set(`${noms[i]}|${noms[j]}`, d);
      toutes.push(d);
      if (d < min[1]) min = [`${noms[i]} / ${noms[j]}`, d];
    }
  return { min, moyenne: moy(toutes), table };
}

/** Noms des grandeurs du vecteur de profil (`vecteurProfil`), dans l'ordre. */
const GRANDEURS = ["droite moy.", "droite max", "lignes longues", "rayon", "serrés", "amples", "dénivelé", "montée", "changements", "largeur", "sans rebords", "boosts", "sauts", "cuves", "pentes", "auteur"];

/**
 * Deux biomes « nettement distincts » : au moins `NETTES` grandeurs du profil dont l'écart des moyennes vaut au moins `EFFET` écart-type (d de Cohen, écart-type commun des deux
 * biomes d'un jour à l'autre). La distance moyenne écrase les écarts (seize grandeurs, la plupart communes) ; celle-ci dit ce qu'un joueur verrait.
 */
const EFFET = 1;
const NETTES = 2;
function ecartsBiomes(ms: readonly Mesure[]): { paires: [string, string[]][]; distinctes: number; total: number } {
  const noms = THEME_NAMES.filter((t) => ms.some((m) => m.theme === t));
  const paires: [string, string[]][] = [];
  for (let a = 0; a < noms.length; a++)
    for (let b = a + 1; b < noms.length; b++) {
      const A = ms.filter((m) => m.theme === noms[a]);
      const B = ms.filter((m) => m.theme === noms[b]);
      const nettes: string[] = [];
      for (let k = 0; k < GRANDEURS.length; k++) {
        const xa = A.map((m) => m.vecteur[k]!);
        const xb = B.map((m) => m.vecteur[k]!);
        const ma = moy(xa);
        const mb = moy(xb);
        const va = moy(xa.map((x) => (x - ma) ** 2));
        const vb = moy(xb.map((x) => (x - mb) ** 2));
        const sd = Math.sqrt((va + vb) / 2);
        if (sd > 0 && Math.abs(ma - mb) / sd >= EFFET) nettes.push(`${GRANDEURS[k]} ${ma > mb ? "+" : "−"}`);
      }
      paires.push([`${noms[a]} / ${noms[b]}`, nettes]);
    }
  return { paires, distinctes: paires.filter(([, n]) => n.length >= NETTES).length, total: paires.length };
}

function tableauBiomes(ms: readonly Mesure[]): string[] {
  const lignes = [
    "| biome | jours | droite moy. (blocs) | droite max | lignes ≥ 3 blocs | rayon moy. (m) | serrés | amples | dénivelé (m) | montée (m) | changements de direction | largeur (m) | sans rebords | boosts | sauts | cuves | pentes | auteur (s) | motif « boost → longue → serré » |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  const ligne = (nom: string, de: readonly Mesure[]) => {
    const p = (f: (x: ProfilCircuit) => number) => moy(de.map((m) => f(m.profil)));
    return `| ${nom} | ${de.length} | ${f1(p((x) => x.droiteMoyenne))} | ${f1(p((x) => x.droiteMax))} | ${pc(p((x) => x.partLongues))} | ${f1(p((x) => x.rayonMoyen))} | ${pc(p((x) => x.partSerres))} | ${pc(p((x) => x.partAmples))} | ${f1(p((x) => x.denivele))} | ${f1(p((x) => x.montee))} | ${f1(p((x) => x.changements))} | ${f1(p((x) => x.largeur))} | ${pc(p((x) => x.ouverte))} | ${pc(p((x) => x.parts.boost))} | ${pc(p((x) => x.parts.saut))} | ${pc(p((x) => x.parts.cuve))} | ${pc(p((x) => x.parts.montée + x.parts.descente))} | ${s1(moy(de.map((m) => m.authorMs)))} | ${pc(de.filter((m) => m.motif > 0).length / Math.max(1, de.length))} |`;
  };
  for (const t of THEME_NAMES) {
    const de = ms.filter((m) => m.theme === t);
    if (de.length) lignes.push(ligne(t, de));
  }
  lignes.push(ligne("**tous**", ms));
  return lignes;
}

function matriceBiomes(ms: readonly Mesure[]): string[] {
  const { table } = distancesBiomes(ms);
  const noms = THEME_NAMES.filter((t) => ms.some((m) => m.theme === t));
  const out = [`| | ${noms.join(" | ")} |`, `|---|${noms.map(() => "---:").join("|")}|`];
  for (const a of noms) out.push(`| ${a} | ${noms.map((b) => (a === b ? "—" : f2(table.get(`${a}|${b}`) ?? table.get(`${b}|${a}`) ?? 0))).join(" | ")} |`);
  return out;
}

const resultats = VERSIONS.map((g) => ({ g, ms: mesurer(g) }));
const resumes = resultats.map(({ g, ms }) => resume(g, ms));
const out: string[] = [];
const titreVersions = VERSIONS.map((g) => `v${g}`).join(" → ");
out.push(
  "# Variété des circuits de Track (lot V2)",
  "",
  `Produit par \`npm run mesure-circuits -- --jours ${JOURS} --depuis ${formatDay(DEPUIS)}\` (\`packages/sim/scripts/mesure-circuits.ts\`, hors CI) : les circuits des ${JOURS} jours du ${formatDay(DEPUIS)} au ${formatDay(DEPUIS + JOURS - 1)}, générés avec chaque version (${titreVersions}) sur les mêmes jours (la version est imposée : \`dailyCircuit(jour, 0, null, g)\`). Définitions : \`packages/sim/src/variete.ts\`. **Ne pas modifier à la main** : relancer la commande.`,
  "",
  "- **Éléments** : `boost` (plaque, super turbo), `longue` (trois blocs droits ou plus), `serré` / `large` / `ample` (virages d'une, deux, trois cellules), `relevé`, `montée`, `descente`, `saut`, `cuve`, `bosse`, `coupé` ; une droite d'un ou deux blocs n'est qu'une liaison et n'entre pas dans les motifs.",
  "- **Fréquence d'un motif** : la part des circuits qui le contiennent au moins une fois.",
  "- **Distance de deux profils** : la moyenne des écarts de seize grandeurs ramenées entre 0 et 1 (lignes droites, rayons, part des serrés et des amples, dénivelé, montée, changements de direction, largeur de la route, part sans rebords, part des boosts, des sauts, des cuves et des pentes, temps de l'auteur) ; 0 = identiques.",
  "",
  "## 1. Résumé avant / après",
  "",
  `| mesure | ${VERSIONS.map((g) => `v${g}`).join(" | ")} |`,
  `|---|${VERSIONS.map(() => "---:").join("|")}|`,
  `| circuits avec « ${MOTIF_BOOST_SERRE} » | ${resumes.map((r) => pc(r.motifPart)).join(" | ")} |`,
  `| ce motif, au plus par circuit | ${resumes.map((r) => r.motifMax).join(" | ")} |`,
  `| jours de suite qui l'ont tous les deux | ${resumes.map((r) => r.motifSuite).join(" | ")} |`,
  `| motif de trois éléments le plus fréquent | ${resumes.map((r) => `${r.top3[0]} (${pc(r.top3[1])})`).join(" | ")} |`,
  `| motif de deux éléments le plus fréquent | ${resumes.map((r) => `${r.top2[0]} (${pc(r.top2[1])})`).join(" | ")} |`,
  `| distance des profils de deux jours qui se suivent (moyenne) | ${resumes.map((r) => f2(r.distSuite)).join(" | ")} |`,
  `| … la plus faible | ${resumes.map((r) => f2(r.distSuiteMin)).join(" | ")} |`,
  `| ressemblance (lot 49) de deux jours qui se suivent | ${resumes.map((r) => f2(r.ressSuite)).join(" | ")} |`,
  `| distance entre deux biomes (moyenne des paires) | ${resumes.map((r) => f2(r.biomeMoy)).join(" | ")} |`,
  `| … les deux biomes les plus proches | ${resumes.map((r) => `${r.biomeMin[0]} (${f2(r.biomeMin[1])})`).join(" | ")} |`,
  `| paires de biomes nettement distinctes (≥ ${NETTES} grandeurs à ≥ ${EFFET} écart-type) | ${resultats.map(({ ms }) => { const e = ecartsBiomes(ms); return `${e.distinctes} / ${e.total}`; }).join(" | ")} |`,
  `| grandeurs nettement différentes par paire (moyenne) | ${resultats.map(({ ms }) => f1(moy(ecartsBiomes(ms).paires.map(([, n]) => n.length)))).join(" | ")} |`,
  `| temps du pilote : min · P5 · médiane · P95 · max (s) | ${resumes.map((r) => [0, 0.05, 0.5, 0.95, 1].map((q) => s1(quantile(r.auteur, q))).join(" · ")).join(" | ")} |`,
  `| circuits de secours | ${resumes.map((r) => r.secours).join(" | ")} |`,
  `| génération : moyenne · pire (ms, cette machine) | ${resumes.map((r) => `${r.genMoy.toFixed(0)} · ${r.genMax.toFixed(0)}`).join(" | ")} |`,
  "",
);
for (const { g, ms } of resultats) {
  out.push(`## 2. Motifs (v${g})`, "", "Les quinze suites de trois éléments et les dix de deux les plus fréquentes, puis les suites de figures.", "", "| suite de trois | circuits | | suite de deux | circuits |", "|---|---:|---|---|---:|");
  const t3 = frequences(ms, "m3").slice(0, 15);
  const t2 = frequences(ms, "m2").slice(0, 15);
  for (let i = 0; i < 15; i++) out.push(`| ${t3[i]?.[0] ?? ""} | ${t3[i] ? pc(t3[i]![1]) : ""} | | ${i < 10 ? (t2[i]?.[0] ?? "") : ""} | ${i < 10 && t2[i] ? pc(t2[i]![1]) : ""} |`);
  const presence = suitesFigures(ms, 1).slice(0, 8);
  out.push("", `Figures les plus présentes (part des circuits) : ${presence.map(([k, x]) => `${k} (${pc(x)})`).join(" ; ")}.`);
  const f3 = suitesFigures(ms, 3).slice(0, 5);
  const f2_ = suitesFigures(ms, 2).slice(0, 5);
  out.push("", `Suites de deux figures les plus fréquentes : ${f2_.map(([k, x]) => `${k} (${pc(x)})`).join(" ; ")}.`, "", `Suites de trois figures : ${f3.map(([k, x]) => `${k} (${pc(x)})`).join(" ; ")}.`, "");
}
for (const { g, ms } of resultats) {
  out.push(`## 3. Profils par biome (v${g})`, "", ...tableauBiomes(ms), "", `Distances entre les profils moyens des biomes (v${g}) :`, "", ...matriceBiomes(ms), "");
  const e = ecartsBiomes(ms);
  out.push(`Ce qui distingue deux biomes (v${g}) : les grandeurs dont l'écart des moyennes vaut au moins ${EFFET} écart-type d'un jour à l'autre (+ : le premier en a plus). ${e.distinctes} paires sur ${e.total} en ont au moins ${NETTES}.`, "", "| paire | grandeurs nettement différentes |", "|---|---|");
  for (const [k, n] of e.paires) out.push(`| ${k} | ${n.length ? n.join(", ") : "—"} |`);
  out.push("");
}
const dernier = resultats[resultats.length - 1]!;
if (dernier.ms.some((m) => m.rythme !== "—")) {
  out.push(`## 4. Rythmes (v${dernier.g})`, "", "| rythme | jours | droite moy. | serrés | dénivelé (m) | sauts | boosts | auteur (s) | motif |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of [...new Set(dernier.ms.map((m) => m.rythme))].sort()) {
    const de = dernier.ms.filter((m) => m.rythme === r);
    const p = (f: (x: ProfilCircuit) => number) => moy(de.map((m) => f(m.profil)));
    out.push(`| ${r} | ${de.length} | ${f1(p((x) => x.droiteMoyenne))} | ${pc(p((x) => x.partSerres))} | ${f1(p((x) => x.denivele))} | ${pc(p((x) => x.parts.saut))} | ${pc(p((x) => x.parts.boost))} | ${s1(moy(de.map((m) => m.authorMs)))} | ${pc(de.filter((m) => m.motif > 0).length / de.length)} |`);
  }
  const suite = dernier.ms.filter((m, i) => i > 0 && m.rythme === dernier.ms[i - 1]!.rythme).length;
  out.push("", `Deux jours de suite avec le même rythme : ${suite}.`, "");
  out.push("### Rythme par biome", "", `| biome | ${[...new Set(dernier.ms.map((m) => m.rythme))].sort().join(" | ")} |`, `|---|${[...new Set(dernier.ms.map((m) => m.rythme))].map(() => "---:").join("|")}|`);
  for (const t of THEME_NAMES) {
    const de = dernier.ms.filter((m) => m.theme === t);
    out.push(`| ${t} | ${[...new Set(dernier.ms.map((m) => m.rythme))].sort().map((r) => de.filter((m) => m.rythme === r).length).join(" | ")} |`);
  }
  out.push("");
}
const texte = out.join("\n");
if (ECRIRE) {
  mkdirSync(dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, texte);
  process.stderr.write(`écrit : ${SORTIE}\n`);
} else console.log(texte);
