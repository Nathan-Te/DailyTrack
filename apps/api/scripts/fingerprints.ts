import {
  FINGERPRINT_AXES,
  THEME_NAMES,
  bestPilotRun,
  circuitFingerprint,
  clearAxes,
  dailyCircuit,
  fingerprintDistance,
  formatDay,
  meanFingerprint,
  type DailyCircuit,
  type Fingerprint,
  type ThemeName,
} from "@cdj/sim";

// Empreinte des thèmes (lot 25), section de `npm run measure:generator` (seule : `ONLY=empreinte`).
// Pour chaque thème, `PER_THEME` circuits (12 par défaut) du thème imposé, sur des dates consécutives : moyenne de chaque axe de l'empreinte
// (`fingerprint.ts`), puis une table de distance entre thèmes (écarts divisés par l'échelle fixe de chaque axe) qui nomme les deux thèmes les
// plus proches. `FINGERPRINT_OUT=fichier.json` écrit les moyennes et les distances (pour comparer avant / après un changement).

const fmt = (v: number, key: string) =>
  ["descent", "air", "ice", "dirt", "sand", "grass", "mainWidthShare"].includes(key) ? `${(100 * v).toFixed(0)} %` : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2);

export interface ThemePrints {
  theme: ThemeName;
  circuits: DailyCircuit[];
  prints: Fingerprint[];
  fallbacks: number;
}

export async function measureFingerprints(firstDay: number, perTheme: number, daily: { c: DailyCircuit; print: Fingerprint | null }[]): Promise<void> {
  console.log(`\n## Empreinte des thèmes (lot 25) : ${perTheme} circuits par thème imposé, à partir du ${formatDay(firstDay)}`);
  const all: ThemePrints[] = [];
  for (const theme of THEME_NAMES) {
    const entry: ThemePrints = { theme, circuits: [], prints: [], fallbacks: 0 };
    for (let d = 0; d < perTheme; d++) {
      const c = dailyCircuit(firstDay + d, 0, theme);
      if (c.fallback) {
        entry.fallbacks++;
        continue;
      }
      const run = bestPilotRun(c.track)!;
      entry.circuits.push(c);
      entry.prints.push(circuitFingerprint(c.track, run));
    }
    all.push(entry);
  }
  const means = new Map(all.map((e) => [e.theme, meanFingerprint(e.prints)] as const));
  const extra = (e: ThemePrints, get: (f: Fingerprint) => number) => e.prints.map(get);
  console.log("axe".padEnd(28) + THEME_NAMES.map((n) => n.padStart(9)).join(""));
  for (const ax of FINGERPRINT_AXES) console.log(ax.label.padEnd(28) + THEME_NAMES.map((n) => fmt(means.get(n)![ax.key]!, ax.key).padStart(9)).join(""));
  console.log("largeur dominante (part)".padEnd(28) + all.map((e) => fmt(e.prints.reduce((s, f) => s + f.mainWidthShare, 0) / Math.max(1, e.prints.length), "mainWidthShare").padStart(9)).join(""));
  console.log("plus haute montée (m)".padEnd(28) + all.map((e) => String(Math.max(0, ...extra(e, (f) => f.climb))).padStart(9)).join(""));
  console.log("dénivelé net (max)".padEnd(28) + all.map((e) => String(Math.max(...extra(e, (f) => f.net))).padStart(9)).join(""));
  console.log("amplitude (max)".padEnd(28) + all.map((e) => String(Math.max(...extra(e, (f) => f.relief))).padStart(9)).join(""));
  console.log("plus long vide (cellules)".padEnd(28) + all.map((e) => String(Math.max(0, ...extra(e, (f) => f.longestGap))).padStart(9)).join(""));
  console.log("moments de choix".padEnd(28) + all.map((e) => fmt(e.prints.reduce((s, f) => s + f.choices, 0) / Math.max(1, e.prints.length), "c").padStart(9)).join(""));
  console.log("circuits de secours".padEnd(28) + all.map((e) => String(e.fallbacks).padStart(9)).join(""));

  console.log("\ntable de distance (√ moyenne des carrés des écarts / échelle) :");
  console.log("".padEnd(10) + THEME_NAMES.map((n) => n.padStart(9)).join(""));
  const pairs: { a: ThemeName; b: ThemeName; d: number }[] = [];
  for (const a of THEME_NAMES) {
    console.log(a.padEnd(10) + THEME_NAMES.map((b) => (a === b ? "—" : fingerprintDistance(means.get(a)!, means.get(b)!).toFixed(2)).padStart(9)).join(""));
    for (const b of THEME_NAMES) if (a < b) pairs.push({ a, b, d: fingerprintDistance(means.get(a)!, means.get(b)!) });
  }
  pairs.sort((x, y) => x.d - y.d);
  console.log(`les deux thèmes les plus proches : ${pairs[0]!.a} et ${pairs[0]!.b} (${pairs[0]!.d.toFixed(2)}) ; puis ${pairs.slice(1, 4).map((p) => `${p.a}–${p.b} ${p.d.toFixed(2)}`).join(" · ")}`);
  const rc = clearAxes(means.get("rallye")!, means.get("canyon")!, ["width", "turns", "straight", "meanSpeed", "air"]);
  const cb = clearAxes(means.get("col")!, means.get("banquise")!, ["net", "descent", "peakSpeed", "ice", "coasts"]);
  console.log(`écarts nets Rallye / Canyon : ${rc.length}/5 (${rc.join(", ")}) ; Col alpin / Banquise : ${cb.length}/5 (${cb.join(", ")})`);

  // Les circuits du jour (60 dates) : les règles « chaque circuit » du lot 25.
  const col = daily.filter((r) => r.c.theme === "col" && r.print);
  const ban = daily.filter((r) => r.c.theme === "banquise" && r.print);
  const colAll = [...col.map((r) => r.print!), ...(all.find((e) => e.theme === "col")?.prints ?? [])];
  const banAll = [...ban.map((r) => r.print!), ...(all.find((e) => e.theme === "banquise")?.prints ?? [])];
  console.log(`Col alpin : dénivelé net ≤ −40 m sur ${colAll.filter((f) => f.net <= -40).length}/${colAll.length} circuits (du jour et imposés) ; Banquise : amplitude ≤ 8 m sur ${banAll.filter((f) => f.relief <= 8).length}/${banAll.length}`);

  const out = process.env.FINGERPRINT_OUT;
  if (out) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(out, JSON.stringify({ means: Object.fromEntries(means), pairs }, null, 1));
    console.log(`(empreintes écrites dans ${out})`);
  }
}
