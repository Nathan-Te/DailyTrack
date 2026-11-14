#!/usr/bin/env node
// Lot QA2 : mesure des images par seconde des maquettes visuelles de `docs/relectures/maquettes/jeux/`, avec le processeur ralenti 4 fois (protocole du navigateur).
//   node scripts/relecture/mesure-visuels.mjs            écrit `docs/relectures/maquettes/jeux/src/mesures.json`, puis `node scripts/relecture/maquettes-jeux.mjs pages` l'injecte dans les fiches.
// Pour chaque maquette : `base` (toutes les propositions éteintes), chaque proposition seule, `tout`. Chromium sans carte graphique (rendu logiciel) : les valeurs servent à comparer les propositions entre elles, pas à prédire un téléphone.
// Three.js (importmap jsdelivr) est servi depuis `node_modules/three` quand le réseau n'y mène pas.
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOSSIER = join(RACINE, "docs/relectures/maquettes/jeux");
const JEUX = { jump: ["parallaxe", "relief", "dangers", "perso", "effets"], tower: ["ciel", "profondeur", "lisibilite", "pieces", "effets"], blocks: ["grille", "pieces", "pose", "efface", "decor"], track: ["biomes", "ciel", "route", "voiture", "variete"], rush: ["toon", "ambiance", "acteurs", "combat", "profondeur"] };
const seulement = process.argv[2];
const nav = await chromium.launch({ args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const res = {};
for (const [jeu, fs] of Object.entries(JEUX)) {
  if (seulement && seulement !== jeu) continue;
  res[jeu] = {};
  for (const [nom, hash] of [["base", "mesure&base"], ...fs.map((f) => [f, `mesure&solo=${f}`]), ["tout", "mesure"]]) {
    const ctx = await nav.newContext({ viewport: { width: 1000, height: 800 } });
    const page = await ctx.newPage();
    await page.route("https://cdn.jsdelivr.net/npm/three@*/**", (r) => r.fulfill({ path: join(RACINE, "node_modules/three", r.request().url().replace(/^.*three@[^/]+\//, "")) }));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(`file://${join(DOSSIER, `${jeu}-visuel.html`)}#${hash}`);
    try { await page.waitForFunction(() => window.__fpsPret === true, undefined, { timeout: 60000 }); res[jeu][nom] = Math.round(await page.evaluate(() => window.__fps)); } catch { res[jeu][nom] = null; }
    await ctx.close();
    process.stdout.write(`${jeu} ${nom} : ${res[jeu][nom]} i/s\n`);
  }
}
await nav.close();
const fichier = join(DOSSIER, "src/mesures.json");
let ancien = {}; try { ancien = JSON.parse((await import("node:fs")).readFileSync(fichier, "utf8")); } catch {}
writeFileSync(fichier, JSON.stringify({ ...ancien, ...res }, null, 1) + "\n");
