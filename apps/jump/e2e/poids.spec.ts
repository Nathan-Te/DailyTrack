import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// Lot I5 (budget de la phase 3) : le premier chargement de Jump ne pèse pas plus de **+20 ko** compressés de JS et de CSS qu'avant le lot ; les polices, au plus
// 150 ko, servies par un chemin unique et absolu (`/assets/…`, les mêmes fichiers que le portail et Track), seules celles du premier écran préchargées ; le
// catalogue anglais à part, chargé à la demande. Déterministe (la construction), sans navigateur.
//
// « Avant » = `main` au début du lot I5 (4c57c67), mesuré de la même façon : 352 866 o de JS (les neuf fichiers de la construction, hors `verify.html`, dont le fil
// de travail du générateur et la galerie) + 5 624 o de CSS (la feuille écrite dans `index.html`), soit **358 490 o**. (Le « 355 ko » du lot R4 comptait la même chose
// avant les lots P3 et P4.)
const AVANT = 352_866 + 5_624;
const dist = new URL("../dist/assets/", import.meta.url);
const gz = (f: string) => gzipSync(readFileSync(new URL(f, dist))).length;

test("le premier chargement : JS + CSS ≤ avant + 20 ko compressés ; le catalogue anglais à part", () => {
  const js = readdirSync(dist).filter((f) => f.endsWith(".js"));
  const poids = Object.fromEntries(js.map((f) => [f, gz(f)]));
  // À la demande : le catalogue anglais (un joueur en anglais), la page `verify.html` (tests de navigateur). (`tune.ts` reste dans le fichier principal,
  // comme avant le lot : s'il en sortait un jour, il ne compterait pas.)
  const aLaDemande = (f: string) => f.startsWith("catalogue.en-") || f.startsWith("tune-") || f.startsWith("verify-");
  const total = Object.entries(poids).reduce((n, [f, o]) => n + (aLaDemande(f) ? 0 : o), 0);
  const css = readdirSync(dist).filter((f) => f.endsWith(".css")).reduce((n, f) => n + gz(f), 0);
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const styleDansLaPage = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].reduce((n, m) => n + gzipSync(m[1]!).length, 0);
  test.info().annotations.push({ type: "mesure", description: `JS ${total} + CSS ${css + styleDansLaPage} = ${total + css + styleDansLaPage} o (avant : ${AVANT} o, +${total + css + styleDansLaPage - AVANT} o)` });
  expect(total + css + styleDansLaPage, `JS ${total} + CSS ${css} : ${JSON.stringify(poids)}`).toBeLessThanOrEqual(AVANT + 20_000);
  const anglais = Object.entries(poids).find(([f]) => f.startsWith("catalogue.en-"))?.[1] ?? 0;
  expect(anglais, "le catalogue anglais existe, à part").toBeGreaterThan(1_000);
  expect(anglais, "le catalogue anglais, chargé à la demande").toBeLessThan(8_000);
  const three = Object.entries(poids).find(([f]) => f.startsWith("three-"))?.[1] ?? 0;
  expect(three, "three.js reste dans son propre fichier (cache entre déploiements)").toBeGreaterThan(100_000);
});

test("les polices : au plus 150 ko, chemin du site partagé avec le portail et Track, Lilita One et Archivo 400 préchargées", () => {
  const css = readdirSync(dist).filter((f) => f.endsWith(".css"));
  const faces = new Set<string>();
  for (const f of css) for (const m of readFileSync(new URL(f, dist), "utf8").matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) faces.add(m[1]!);
  expect([...faces].map((f) => f.replace(/^\/assets\//, "").replace(/-[\w-]{8}\.woff2$/, "")).sort(), "Lilita One, Archivo Black, Archivo 400, 600 et 700, JetBrains Mono 700").toEqual([
    "archivo-black-latin-400-normal",
    "archivo-latin-400-normal",
    "archivo-latin-600-normal",
    "archivo-latin-700-normal",
    "jetbrains-mono-latin-700-normal",
    "lilita-one-latin-400-normal",
  ]);
  let octets = 0;
  for (const face of faces) {
    expect(face, "les polices sont servies par /assets/ (la racine du site, comme le portail et Track), pas relativement à la page").toMatch(/^\/assets\/[a-z-]+-latin-\d+-normal-[\w-]+\.woff2$/);
    octets += readFileSync(new URL(`.${face}`, new URL("../dist/", import.meta.url))).length;
  }
  test.info().annotations.push({ type: "mesure", description: `polices : ${(octets / 1024).toFixed(1)} Ko` });
  expect(octets, `polices : ${(octets / 1024).toFixed(1)} ko`).toBeLessThanOrEqual(150 * 1024);
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const precharges = [...html.matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="([^"]+)"/g)].map((m) => m[1]!);
  expect(precharges.map((p) => p.replace(/^\/assets\//, "").replace(/-[\w-]{8}\.woff2$/, "")).sort()).toEqual(["archivo-latin-400-normal", "lilita-one-latin-400-normal"]);
  for (const p of precharges) expect(faces.has(p), `${p} : le préchargement vise le même chemin que la feuille`).toBe(true);
  // Le HTML ne porte aucun texte en dur : il est pré-rempli en français à la construction (data-t), titre « Jump — Du Jour ».
  expect(html).toContain("<title data-t=\"page.titre\">Jump — Du Jour</title>");
});
