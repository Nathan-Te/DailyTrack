import { writeFileSync } from "node:fs";
import { daysFromCivil } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION, TABLES_REFUSEES, analyserTable, cleDeTable, dailyPinballAvec, toutesLesTables, type Contenu } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run valider:pinball -w @cdj/pinball-sim -- [--ecrire] [--fils=N] [--seulement=<début de clé>] [--jours=400]` : **la validation des 500 tables que le générateur peut tirer** (lot PB4). Chaque table passe les trois
// épreuves de `validation.ts` (aucune bille coincée, chaque module touché, la mission réussie) ; le verdict ne dépend que de la table, donc se calcule une fois pour toutes. `--ecrire` écrit les tables refusées dans
// `src/refusees.ts` (que le générateur lit) ; **si la liste change, monter `PINBALL_GENERATOR_VERSION`** (un jour servi ne change pas). `--jours=400` dit combien de jours auraient tiré une table refusée.
// Aucune base, aucun réseau. Une table met de 4 à 7 secondes (lot PBR1) : 500 tables ≈ 10 minutes sur 4 cœurs.
interface Resume {
  cle: string;
  ok: boolean;
  raisons: string[];
  scores: number[];
  pire: number;
  secondes: number;
  /** Lot PBG2 : le robot a verrouillé une bille / lancé une multibille sur cette table. */
  verrou: boolean;
  multibille: boolean;
}
const travail = (c: Contenu): Resume => {
  const t0 = performance.now();
  const a = analyserTable(c);
  return { cle: cleDeTable(c), ok: a.ok!, raisons: a.raisons!, scores: a.scores, pire: a.billes!.pire, secondes: (performance.now() - t0) / 1000, verrou: a.verrou!, multibille: a.multibille! };
};

if (enFil) repondre(travail);
else {
  const args = process.argv.slice(2);
  const valeur = (nom: string): string | undefined => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
  const seulement = valeur("seulement");
  const tables = toutesLesTables().filter((c) => !seulement || cleDeTable(c).startsWith(seulement));
  console.log(`${tables.length} table(s) à valider (générateur g${PINBALL_GENERATOR_VERSION}).`);
  const t0 = performance.now();
  let faits = 0;
  const resumes = await enParallele<Contenu, Resume>(new URL(import.meta.url), tables, (r) => {
    faits++;
    if (!r.ok || faits % 50 === 0) console.log(`  ${faits}/${tables.length} ${r.ok ? "ok" : "REFUSÉE"} ${r.cle}${r.ok ? "" : " — " + r.raisons.join(" ; ")}`);
  }, valeur("fils") ? Number(valeur("fils")) : undefined);
  const refusees = resumes.filter((r) => !r.ok);
  const motifs = new Map<string, number>();
  for (const r of refusees) {
    for (const m of r.raisons) {
      // lot PBL2 : le motif d'une table refusée (sans les chiffres) ; une fenêtre trop courte garde l'objectif (« fenêtre de tir trop courte : mission »)
      const cle = m.replace(/ \(.*$/, "").replace(/ : S\d:.*$/, "") + (m.startsWith("module jamais touché") ? ` : ${m.split(" : ")[1]!.split(":")[1]}` : "");
      motifs.set(cle, (motifs.get(cle) ?? 0) + 1);
    }
  }
  const pire = Math.max(...resumes.map((r) => r.pire));
  const secondes = resumes.map((r) => r.secondes);
  console.log(`${resumes.length - refusees.length} valides, ${refusees.length} refusée(s) sur ${resumes.length} ; la bille lâchée la plus lente met ${pire} pas (${(pire / 600).toFixed(0)} s) ; ${(secondes.reduce((a, b) => a + b, 0) / secondes.length).toFixed(1)} s par table en moyenne, ${Math.max(...secondes).toFixed(1)} s au pire ; ${((performance.now() - t0) / 1000).toFixed(0)} s en tout.`);
  for (const [m, n] of motifs) console.log(`  ${n} × ${m}`);
  const sansVerrou = resumes.filter((r) => !r.verrou).map((r) => r.cle);
  const sansMulti = resumes.filter((r) => !r.multibille).map((r) => r.cle);
  console.log(`Lot PBG2 : le robot a verrouillé une bille sur ${resumes.length - sansVerrou.length} tables sur ${resumes.length} et lancé une multibille sur ${resumes.length - sansMulti.length}.${sansMulti.length ? ` Sans multibille : ${sansMulti.slice(0, 12).join(" ; ")}${sansMulti.length > 12 ? " …" : ""}` : ""}`);
  if (valeur("jours")) {
    const n = Number(valeur("jours"));
    const premier = daysFromCivil(2026, 11, 2);
    const cles = new Set(refusees.map((r) => r.cle).concat(seulement ? [] : []));
    const vides = new Set<string>();
    let touches = 0;
    const distinctes = new Set<string>();
    for (let j = 0; j < n; j++) {
      const c = dailyPinballAvec(premier + j, vides);
      distinctes.add(cleDeTable(c));
      if (cles.has(cleDeTable(c))) touches++;
    }
    console.log(`Sur ${n} jours depuis le 02/11/2026 : ${touches} jour(s) auraient tiré une table refusée ; ${distinctes.size} tables différentes sont tirées.`);
  }
  if (args.includes("--ecrire")) {
    if (seulement) throw new Error("--ecrire demande la validation de toutes les tables (pas de --seulement)");
    const cles = refusees.map((r) => r.cle).sort();
    const fichier = new URL("../src/refusees.ts", import.meta.url);
    const entete = `// Les tables refusées par la validation (lot PB4) : la clé \`thème:plan:module,…\` de chacune (\`cleDeTable\`). **Produit par \`npm run valider:pinball -w @cdj/pinball-sim -- --ecrire\`**, jamais à la main : l'outil valide les 500
// tables que le générateur peut tirer (\`toutesLesTables\`) et écrit ici celles qu'il refuse. Le générateur ne les sert jamais : il passe à la graine suivante (\`dailyPinball\`).
// Changer le robot, la validation ou la simulation peut changer cette liste : la relancer, et **si elle change, monter \`PINBALL_GENERATOR_VERSION\`** (un jour déjà servi ne change pas : règle des jours figés).
// Dernière validation : générateur g${PINBALL_GENERATOR_VERSION}, ${resumes.length} tables, ${refusees.length} refusée(s).
`;
    writeFileSync(fichier, `${entete}export const TABLES_REFUSEES: readonly string[] = [${cles.map((c) => `\n  ${JSON.stringify(c)},`).join("")}${cles.length ? "\n" : ""}];\n`);
    console.log(`src/refusees.ts écrit (${cles.length} table(s)). Avant : ${TABLES_REFUSEES.length}.`);
  }
  process.exit(0);
}
