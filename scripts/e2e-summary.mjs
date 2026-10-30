// Résumé d'un run e2e (retouche 29b) : lit le rapport JSON fusionné de Playwright et en tire un résumé Markdown où les tests INSTABLES
// (échec puis réussite à la relance) sont nommés — jamais cachés. Utilisé par le job `e2e` de .github/workflows/ci.yml.
//   node scripts/e2e-summary.mjs rapport.json [--mode pr|main|complet|nuit] [--quarantaine e2e/quarantaine.json] [--fail-on-flaky]
//   → Markdown sur la sortie, annotations `::warning` pour chaque instable
//   code de sortie : 1 s'il y a des échecs ; la nuit (`--mode nuit`, ou `--fail-on-flaky`), 1 aussi s'il y a des instables.
// Lot R3 (plateforme) — quarantaine (scripts/e2e-quarantaine.mjs) : sur une PR (`--mode pr`), l'échec ou l'instabilité d'un test en quarantaine
// est un avertissement nommé, pas un verdict rouge ; en `complet` (main, lancement manuel) et `nuit`, il reste bloquant ; la nuit, une entrée
// de plus de 14 jours fait échouer le run (« dette expirée »). Une quarantaine refusée (garde-fous) fait toujours échouer le run.

import { readFileSync, writeFileSync } from "node:fs";
import { MAX_DAYS, loadQuarantine, matches } from "./e2e-quarantaine.mjs";

/** Parcourt les suites et rend les tests à plat : { file, title, project, status, attempts, errors }. */
export function collectTests(report) {
  const out = [];
  // `path` : les titres des `describe` qui l'entourent (pas celui du fichier), pour nommer un test sans ambiguïté (tactile : un `describe` par téléphone).
  const walk = (suite, file, path) => {
    const here = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const results = t.results ?? [];
        out.push({
          file: spec.file ?? here,
          title: spec.title,
          path: [...path, spec.title],
          project: t.projectName,
          status: t.status, // expected | unexpected | flaky | skipped
          attempts: results.length,
          errors: results.map((r) => r.error?.message?.split("\n")[0]?.replace(/\u001b\[[0-9;]*m/g, "") ?? null).filter(Boolean),
          ms: results.reduce((s, r) => s + (r.duration ?? 0), 0),
        });
      }
    }
    for (const s of suite.suites ?? []) walk(s, here, [...path, s.title]);
  };
  for (const s of report.suites ?? []) walk(s, s.file, []);
  return out;
}

/** Secondes passées par fichier dans Chromium (tous essais), triées par nom. Les fichiers de DailyJump (projet `jump-chromium`, lot 3c) sont préfixés « jump/ », ceux de Tower (`tower-chromium`, lot R15) « tower/ ». */
export function chromiumSeconds(tests) {
  const sum = {};
  for (const t of tests) {
    if (t.project !== "chromium" && t.project !== "jump-chromium" && t.project !== "tower-chromium") continue;
    const key = t.project === "jump-chromium" ? `jump/${t.file.split("/").pop()}` : t.project === "tower-chromium" ? `tower/${t.file.split("/").pop()}` : t.file;
    sum[key] = (sum[key] ?? 0) + t.ms;
  }
  return Object.fromEntries(Object.keys(sum).sort().map((f) => [f, Math.round(sum[f] / 1000)]));
}

const mmss = (ms) => `${Math.floor(ms / 60000)} min ${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")} s`;

/**
 * `mode` : `pr` (la quarantaine n'est qu'un avertissement), `main` et `complet` (chaque fusion, lancement manuel : tout est bloquant) ou `nuit` (tout est bloquant,
 * un instable aussi, une dette expirée aussi). `quarantine` : le résultat de `loadQuarantine` (null = pas de quarantaine). `failOnFlaky` :
 * comme `nuit` pour les instables (ancien drapeau, gardé).
 */
export function summarize(report, { failOnFlaky = false, mode = "complet", quarantine = null } = {}) {
  const tests = collectTests(report);
  const count = (s) => tests.filter((t) => t.status === s).length;
  const strictFlaky = failOnFlaky || mode === "nuit";
  const entries = quarantine?.entries ?? [];
  const quarantined = (t) => entries.find((e) => matches(e, t)) ?? null;
  // Sur une PR, un test en quarantaine qui échoue (ou passe à la relance) est mis à part : nommé, avertissement, non bloquant.
  const excused = mode === "pr" ? tests.filter((t) => (t.status === "unexpected" || t.status === "flaky") && quarantined(t)) : [];
  const flaky = tests.filter((t) => t.status === "flaky" && !excused.includes(t));
  const failed = tests.filter((t) => t.status === "unexpected" && !excused.includes(t));
  const lines = [];
  lines.push("## Résultats e2e");
  lines.push("");
  lines.push(`| Réussis | Instables (relance) | Échecs | Sautés (navigateur sans WebGL…) | Durée cumulée |`);
  lines.push(`|---|---|---|---|---|`);
  lines.push(`| ${count("expected")} | **${flaky.length}** | **${failed.length}** | ${count("skipped")} | ${mmss(report.stats?.duration ?? tests.reduce((s, t) => s + t.ms, 0))} |`);
  const block = (title, list, note) => {
    if (!list.length) return;
    lines.push("", `### ${title} (${list.length})`, note, "");
    for (const t of list) lines.push(`- \`${t.project}\` · \`${t.file}\` › ${t.title}${t.errors.length ? `\n  - ${t.errors.map((e) => e.slice(0, 220)).join("\n  - ")}` : ""}`);
  };
  if (quarantine?.errors?.length) {
    lines.push("", `### Quarantaine refusée (${quarantine.errors.length})`, "`e2e/quarantaine.json` ne respecte pas ses garde-fous : le run échoue.", "");
    for (const e of quarantine.errors) lines.push(`- ${e}`);
  }
  const expired = mode === "nuit" ? (quarantine?.expired ?? []) : [];
  if (expired.length) {
    lines.push("", `### Dettes expirées (${expired.length})`, `En quarantaine depuis plus de ${MAX_DAYS} jours : le run de nuit échoue.`, "");
    for (const e of expired) lines.push(`- \`${e.project}\` · ${e.test} — depuis ${e.depuis} (${e.age} jours), dette : ${e.dette}, à réparer par ${e.responsable}`);
  }
  block("Échecs", failed, "Échec à chaque essai : un vrai problème.");
  block("Tests instables", flaky, "Échec au premier essai, réussite à la relance : **à corriger** (cause dans le README du lot 29b, suivi dans docs/orchestration.md § 8).");
  block("En quarantaine (avertissement, non bloquant sur une PR)", excused, "Tests de `e2e/quarantaine.json` : ils ont tourné et échoué (ou réussi à la relance). Bloquants sur main, la nuit et avant la production.");
  if (entries.length && mode !== "pr") lines.push("", `Quarantaine (${entries.length}) : **bloquante ici** (${mode}) — ${entries.map((e) => `\`${e.project}\` · ${e.test}`).join(" ; ")}`);
  if (!failed.length && !flaky.length && !excused.length) lines.push("", "Aucun échec, aucun test instable.");
  // Durées Chromium par fichier (retouche 31b) : de quoi tenir à jour apps/web/e2e/durees.json, qui compose les parts de la CI.
  const perFile = chromiumSeconds(tests);
  if (Object.keys(perFile).length) {
    lines.push("", "<details><summary>Durées Chromium par fichier (s, essais ratés compris) — pour apps/web/e2e/durees.json (et, préfixés « jump/ » ou « tower/ », apps/jump/e2e/durees.json et apps/tower/e2e/durees.json)</summary>", "", "```json");
    lines.push(JSON.stringify(perFile, null, 2), "```", "</details>");
  }
  const warnings = [
    ...flaky.map((t) => `::warning title=Test instable (${t.project})::${t.file} › ${t.title}`),
    ...excused.map((t) => `::warning title=Test en quarantaine (${t.project})::${t.file} › ${t.title} : ${t.status === "flaky" ? "instable" : "échec"}, non bloquant sur une PR`),
    ...(quarantine?.errors ?? []).map((e) => `::error title=Quarantaine refusée::${e}`),
    ...expired.map((e) => `::error title=Dette expirée (${e.project})::${e.test} en quarantaine depuis ${e.age} jours`),
  ];
  const exitCode = failed.length || (strictFlaky && flaky.length) || quarantine?.errors?.length || expired.length ? 1 : 0;
  return { markdown: lines.join("\n"), warnings, flaky, failed, excused, exitCode };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , path, ...flags] = process.argv;
  const opt = (name) => (flags.includes(name) ? flags[flags.indexOf(name) + 1] : undefined);
  const mode = opt("--mode") ?? "complet";
  if (!path || !["pr", "main", "complet", "nuit"].includes(mode)) {
    console.error("usage : node scripts/e2e-summary.mjs rapport.json [--mode pr|main|complet|nuit] [--quarantaine e2e/quarantaine.json] [--fail-on-flaky] [--echecs echecs.json]");
    process.exit(2);
  }
  const qFile = opt("--quarantaine");
  const r = summarize(JSON.parse(readFileSync(path, "utf8")), { failOnFlaky: flags.includes("--fail-on-flaky"), mode, quarantine: qFile ? loadQuarantine(qFile) : null });
  console.log(r.markdown);
  for (const w of r.warnings) console.error(w);
  // Lot R12 : les tests rouges (« fichier › titre »), en JSON, pour le résumé de « Mettre en production » (sortie `echecs` de ci.yml appelé).
  if (opt("--echecs")) writeFileSync(opt("--echecs"), JSON.stringify(r.failed.map((t) => `${t.file} › ${t.title}`)));
  process.exit(r.exitCode);
}
