// Lot I6 (plateforme) : les images de partage (Open Graph) et les icônes de l'écran d'accueil, produites AU MOMENT DE LA CONSTRUCTION du site
// à partir d'une page HTML de la charte (`apps/portail/partage/images.html` : jetons et polices hébergées de @cdj/ui), rendue par le navigateur
// de Playwright déjà présent pour les tests (aucune image extérieure, aucun service tiers, aucune dépendance ajoutée). Appelé par
// `scripts/site.mjs site` ; ligne de commande pour les regarder :
//   node scripts/images-partage.mjs <dossier>     → <dossier>/portail.png, track.png, jump.png (1200 × 630), icone-180.png, icone-192.png, icone-512.png
// Navigateur : Chromium, et lui seul (celui de Playwright, ou CHROMIUM_PATH), quel que soit le job qui assemble le site — lot B1b. Un autre navigateur
// dessinait la même page en PNG de 75 Ko au lieu de 42 Ko (Firefox : RGBA, compression plus faible) : les jobs Firefox et WebKit de la CI installent
// donc Chromium en plus du leur. Pas de repli : sans Chromium la construction échoue, avec la commande qui le donne.
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lirePlafonds } from "./budgets-controle.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** La page source des images (jamais servie). */
export const SOURCE_IMAGES = "apps/portail/partage/images.html";

/** Le dossier des images dans le site (adresse publique : `<origine>/partage/<nom>.png`). */
export const DOSSIER_PARTAGE = "partage";

/** Les images de partage (Open Graph, `summary_large_image`) : une par page partagée, 1200 × 630, PNG, au plus `POIDS_MAX` octets. */
export const IMAGES_PARTAGE = [
  { nom: "portail", section: "#portail", largeur: 1200, hauteur: 630 },
  { nom: "track", section: "#track", largeur: 1200, hauteur: 630 },
  { nom: "jump", section: "#jump", largeur: 1200, hauteur: 630 },
];

/** Les icônes de l'écran d'accueil : `apple-touch-icon` (180) et celles du manifeste (192, 512), la même section réduite. */
export const ICONES = [
  { nom: "icone-180", section: "#icone", taille: 180 },
  { nom: "icone-192", section: "#icone", taille: 192 },
  { nom: "icone-512", section: "#icone", taille: 512 },
];

/**
 * Poids maximal d'une image de partage (les messageries refusent ou réduisent les images lourdes). **Lot B1b : le plafond de la ligne `partage.image` de
 * docs/plateforme/budgets.md, lu là, jamais recopié** (règle du lot B1 : mesure + 10 %, en Ko, 1 Ko = 1 000 o) — un seul plafond pour la même image.
 */
export const POIDS_MAX = lirePlafonds(readFileSync(join(ROOT, "docs/plateforme/budgets.md"), "utf8"))["partage.image"];
if (!(POIDS_MAX > 0)) throw new Error("docs/plateforme/budgets.md : la ligne `partage.image` manque ou n'est pas lisible");

/** Largeur et hauteur d'un PNG (en-tête IHDR), ou une erreur si ce n'est pas un PNG. Pur, testé. */
export function taillePng(octets) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (octets.length < 24 || signature.some((b, i) => octets[i] !== b)) throw new Error("ce n'est pas un PNG");
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
}

/** Le navigateur qui dessine : Chromium, jamais un autre (même page, même PNG, même poids : lot B1b). */
async function lancerNavigateur() {
  const pw = await import("@playwright/test");
  try {
    return await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--font-render-hinting=none"] });
  } catch (e) {
    const cause = e instanceof Error ? e.message.split("\n")[0] : String(e);
    throw new Error(`Chromium est requis pour dessiner les images de partage (npx playwright install chromium, ou CHROMIUM_PATH) : ${cause}`);
  }
}

/**
 * Produit les images de partage et les icônes dans `sortie` ; rend la liste `{ nom, fichier, largeur, hauteur, octets }`. Échoue si une police
 * de la page n'est pas chargée (une image sans la police de la charte), si une image n'a pas sa taille ou dépasse `POIDS_MAX` (la ligne `partage.image` de budgets.md).
 */
export async function produireImages(sortie) {
  mkdirSync(sortie, { recursive: true });
  const navigateur = await lancerNavigateur();
  const faites = [];
  try {
    const page = await navigateur.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(join(ROOT, SOURCE_IMAGES)).href);
    const polices = await page.evaluate(async () => {
      await document.fonts.ready;
      const voulues = ['400 40px "Archivo Black"', 'italic 800 40px "Barlow Condensed"', '400 40px "Lilita One"'];
      await Promise.all(voulues.map((f) => document.fonts.load(f)));
      return voulues.filter((f) => !document.fonts.check(f));
    });
    if (polices.length) throw new Error(`police absente de la page des images : ${polices.join(", ")}`);
    for (const image of IMAGES_PARTAGE) {
      const fichier = join(sortie, `${image.nom}.png`);
      await page.locator(image.section).screenshot({ path: fichier, type: "png", animations: "disabled" });
      faites.push({ nom: image.nom, fichier, largeur: image.largeur, hauteur: image.hauteur });
    }
    for (const icone of ICONES) {
      const p = await navigateur.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: icone.taille / 512 });
      await p.goto(pathToFileURL(join(ROOT, SOURCE_IMAGES)).href);
      await p.evaluate(() => document.fonts.ready.then(() => document.fonts.load('400 40px "Archivo Black"')));
      const fichier = join(sortie, `${icone.nom}.png`);
      await p.locator(icone.section).screenshot({ path: fichier, type: "png", animations: "disabled" });
      await p.close();
      faites.push({ nom: icone.nom, fichier, largeur: icone.taille, hauteur: icone.taille });
    }
  } finally {
    await navigateur.close();
  }
  for (const f of faites) {
    const t = taillePng(readFileSync(f.fichier));
    if (t.largeur !== f.largeur || t.hauteur !== f.hauteur) throw new Error(`${f.nom}.png : ${t.largeur} × ${t.hauteur}, attendu ${f.largeur} × ${f.hauteur}`);
    f.octets = statSync(f.fichier).size;
    if (f.octets > POIDS_MAX) throw new Error(`${f.nom}.png : ${f.octets} octets, plus que ${POIDS_MAX}`);
  }
  return faites;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const sortie = resolve(process.argv[2] ?? join(ROOT, "site", DOSSIER_PARTAGE));
  produireImages(sortie).then(
    (faites) => {
      for (const f of faites) console.log(`${f.nom}.png : ${f.largeur} × ${f.hauteur}, ${(f.octets / 1024).toFixed(1)} ko`);
    },
    (e) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    },
  );
}
