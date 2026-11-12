#!/usr/bin/env node
// Lot QA1 : les miniatures d'un constat de relecture — pour chaque sujet photographié en français, l'ordinateur (1 440 px) et le téléphone (390 px) côte à côte, en JPEG de 800 px de large au plus.
//   node scripts/relecture/miniatures.mjs [--sortie docs/relectures/captures] [--poids 3000] [--constat docs/relectures/<fichier>.md]
// (après `npm run relecture` ; `--poids` : plafond du dossier en Ko, la commande échoue au-delà ; `--constat` : écrit le tableau des contrôles, en français, entre `<!-- tableau:debut -->` et
// `<!-- tableau:fin -->` du constat.)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lire = (nom, defaut) => (process.argv.includes(`--${nom}`) ? process.argv[process.argv.indexOf(`--${nom}`) + 1] : defaut);
const sortie = resolve(RACINE, lire("sortie", "docs/relectures/captures"));
const plafond = Number(lire("poids", "3000"));
const source = join(RACINE, "relecture");
const { sujets, controles } = JSON.parse(readFileSync(join(source, "controles.json"), "utf8"));
mkdirSync(sortie, { recursive: true });
for (const f of readdirSync(sortie)) if (f.endsWith(".jpg")) rmSync(join(sortie, f));
const navigateur = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await navigateur.newContext({ viewport: { width: 800, height: 520 }, deviceScaleFactor: 1 })).newPage();
let n = 0;
for (const s of sujets.filter((x) => x.langue === "fr")) {
  const de = (taille) => s.captures.find((c) => c.taille === taille)?.fichier;
  const [ordi, tel] = [de("1440x900"), de("390x844")];
  if (!ordi || !tel || !existsSync(join(source, ordi))) continue;
  // 800 px : l'ordinateur à 600 px, le téléphone à 190 px, coupés à 520 px de haut (le haut de la page).
  const html = join(sortie, ".miniature.html"); // une page locale : `about:blank` ne charge pas un fichier
  writeFileSync(html, `<body style="margin:0;background:#1f1d1a;display:flex;gap:10px;align-items:flex-start;height:520px;overflow:hidden"><img src="${pathToFileURL(join(source, ordi)).href}" style="width:600px"><img src="${pathToFileURL(join(source, tel)).href}" style="width:190px"></body>`);
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.screenshot({ path: join(sortie, `${s.id}.jpg`), type: "jpeg", quality: 55 });
  rmSync(html, { force: true });
  n++;
}
await navigateur.close();
const poids = readdirSync(sortie).reduce((t, f) => t + statSync(join(sortie, f)).size, 0) / 1024;
process.stdout.write(`miniatures : ${n} fichiers, ${poids.toFixed(0)} Ko dans ${sortie}\n`);
const constat = lire("constat", null);
if (constat) {
  const fichier = resolve(RACINE, constat);
  const fr = sujets.filter((x) => x.langue === "fr");
  const tableau = `| page | ${controles.map((c) => c.nom).join(" | ")} |\n|---|${controles.map(() => "---:").join("|")}|\n${fr.map((l) => `| ${l.id} | ${controles.map((c) => (l.constats[c.id] ?? []).length || "·").join(" | ")} |`).join("\n")}`;
  const texte = readFileSync(fichier, "utf8");
  const [a, b] = [texte.indexOf("<!-- tableau:debut -->"), texte.indexOf("<!-- tableau:fin -->")];
  if (a < 0 || b < a) throw new Error(`${constat} : repères du tableau absents`);
  writeFileSync(fichier, `${texte.slice(0, a)}<!-- tableau:debut -->\n${tableau}\n${texte.slice(b)}`);
}
if (poids > plafond) {
  process.stderr.write(`miniatures : ${poids.toFixed(0)} Ko, plafond ${plafond} Ko\n`);
  process.exit(1);
}
