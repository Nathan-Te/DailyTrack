// Résumé d'un run e2e (retouche 29b) : lit le rapport JSON fusionné de Playwright et en tire un résumé Markdown où les tests INSTABLES
// (échec puis réussite à la relance) sont nommés — jamais cachés. Utilisé par le job `e2e` de .github/workflows/ci.yml.
//   node scripts/e2e-summary.mjs rapport.json [--fail-on-flaky]  → Markdown sur la sortie, annotations `::warning` pour chaque instable
//   code de sortie : 1 s'il y a des échecs ; avec --fail-on-flaky (run de nuit), 1 aussi s'il y a des instables.

import { readFileSync } from "node:fs";

/** Parcourt les suites et rend les tests à plat : { file, title, project, status, attempts, errors }. */
export function collectTests(report) {
  const out = [];
  const walk = (suite, file) => {
    const here = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const results = t.results ?? [];
        out.push({
          file: spec.file ?? here,
          title: spec.title,
          project: t.projectName,
          status: t.status, // expected | unexpected | flaky | skipped
          attempts: results.length,
          errors: results.map((r) => r.error?.message?.split("\n")[0]?.replace(/\u001b\[[0-9;]*m/g, "") ?? null).filter(Boolean),
          ms: results.reduce((s, r) => s + (r.duration ?? 0), 0),
        });
      }
    }
    for (const s of suite.suites ?? []) walk(s, here);
  };
  for (const s of report.suites ?? []) walk(s, s.file);
  return out;
}

/** Secondes passées par fichier dans Chromium (tous essais), triées par nom. */
export function chromiumSeconds(tests) {
  const sum = {};
  for (const t of tests) if (t.project === "chromium") sum[t.file] = (sum[t.file] ?? 0) + t.ms;
  return Object.fromEntries(Object.keys(sum).sort().map((f) => [f, Math.round(sum[f] / 1000)]));
}

const mmss = (ms) => `${Math.floor(ms / 60000)} min ${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")} s`;

export function summarize(report, { failOnFlaky = false } = {}) {
  const tests = collectTests(report);
  const count = (s) => tests.filter((t) => t.status === s).length;
  const flaky = tests.filter((t) => t.status === "flaky");
  const failed = tests.filter((t) => t.status === "unexpected");
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
  block("Échecs", failed, "Échec à chaque essai : un vrai problème.");
  block("Tests instables", flaky, "Échec au premier essai, réussite à la relance : **à corriger** (cause dans le README du lot 29b, suivi dans docs/orchestration.md § 8).");
  if (!failed.length && !flaky.length) lines.push("", "Aucun échec, aucun test instable.");
  // Durées Chromium par fichier (retouche 31b) : de quoi tenir à jour apps/web/e2e/durees.json, qui compose les parts de la CI.
  const perFile = chromiumSeconds(tests);
  if (Object.keys(perFile).length) {
    lines.push("", "<details><summary>Durées Chromium par fichier (s, essais ratés compris) — pour apps/web/e2e/durees.json</summary>", "", "```json");
    lines.push(JSON.stringify(perFile, null, 2), "```", "</details>");
  }
  const warnings = flaky.map((t) => `::warning title=Test instable (${t.project})::${t.file} › ${t.title}`);
  const exitCode = failed.length || (failOnFlaky && flaky.length) ? 1 : 0;
  return { markdown: lines.join("\n"), warnings, flaky, failed, exitCode };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , path, ...flags] = process.argv;
  if (!path) {
    console.error("usage : node scripts/e2e-summary.mjs rapport.json [--fail-on-flaky]");
    process.exit(2);
  }
  const r = summarize(JSON.parse(readFileSync(path, "utf8")), { failOnFlaky: flags.includes("--fail-on-flaky") });
  console.log(r.markdown);
  for (const w of r.warnings) console.error(w);
  process.exit(r.exitCode);
}
