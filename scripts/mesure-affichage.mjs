// Lot B1 (plateforme) — LE VRAI TEMPS D'AFFICHAGE, sur un téléphone moyen en 4G : un outil, jamais la CI (une mesure de temps varie d'une machine à l'autre ; elle sert à décider s'il faut alléger,
// pas à bloquer une PR). Playwright, Chromium seulement : processeur ralenti ×4 (`Emulation.setCPUThrottlingRate`), réseau « 4G lente » du protocole de Chrome (`Network.emulateNetworkConditions` :
// 1,6 Mbit/s descendant, 750 kbit/s montant, 150 ms de latence), **cache vide à chaque passe** (un nouveau contexte), écran de 390 × 844, tactile. Pour le portail et l'accueil de chaque jeu :
//   · « écran utile » : le temps, depuis le début de la navigation, jusqu'à ce que le bouton « Jouer » soit **visible** (le portail : celui de la première cartouche ; Track : « Courir » ; Jump : « Jouer » ;
//     Tower : « Jouer ») — `performance.now()`, lu dans la page à chaque image ;
//   · « prêt à jouer » : la partie peut démarrer, moteur compris (Track : `__cdj.phase` ; Jump : `__jump.phase` ; Tower : la scène et Rapier chargés) — **par les outils d'essai de la page (`?debug`,
//     `?scenario=essai`), fermés en production : « — » contre la production** ;
//   · le premier affichage (FCP) et les octets transférés jusqu'à l'écran utile.
// Médiane de N passes (5 par défaut ; min–max entre parenthèses). `--detail` ajoute deux séries qui disent ce qui coûte : **réseau seul** (4G lente, processeur normal : le téléchargement) et **processeur
// seul** (×4, réseau libre : l'exécution du code).
//   npm run build && node scripts/site.mjs site && npm run mesure-affichage                 → le site assemblé (`site/`), servi en local avec gzip (comme Firebase Hosting), l'API absente
//   npm run mesure-affichage -- --url https://playdujour.com --lecture-seule                → une adresse déployée (production : lecture seule, GET de pages seulement, aucun joueur créé)
//   options : --passes 5 · --detail · --jeux portail,track,jump,tower · --json <fichier> · --site <dossier>
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Les pages mesurées : l'adresse de l'écran utile, le bouton à voir, et l'adresse + le signal du « prêt à jouer » (`pret` : un des cas de `sonde`, `null` : pas de mesure). */
export const PAGES = [
  { id: "portail", nom: "Portail", url: "/", bouton: ".dj-cartouche .dj-bouton", prete: null },
  { id: "track", nom: "Track (accueil)", url: "/track/", bouton: "#home-daily", prete: { url: "/track/?debug", signal: "cdj" } },
  { id: "jump", nom: "Jump (accueil)", url: "/jump/", bouton: "#home-play", prete: { url: "/jump/?debug&touch=1", signal: "jump" } },
  { id: "tower", nom: "Tower (accueil)", url: "/tower/?apercu=essai", bouton: "#accueil-jouer", prete: { url: "/tower/?scenario=essai&tactile=1", signal: "tower" } },
];

/** Le réseau « 4G lente » de Chrome (DevTools : « Slow 4G »). */
export const RESEAU_4G_LENTE = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
export const CONFIGURATIONS = {
  reference: { nom: "téléphone moyen (processeur ×4, 4G lente)", cpu: 4, reseau: RESEAU_4G_LENTE },
  reseau: { nom: "réseau seul (4G lente, processeur normal)", cpu: 1, reseau: RESEAU_4G_LENTE },
  cpu: { nom: "processeur seul (×4, réseau libre)", cpu: 4, reseau: null },
};

/** La médiane (la valeur du milieu ; pour un nombre pair, la plus haute des deux du milieu : jamais une valeur qui n'a pas été mesurée). */
export const mediane = (v) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : null);

/** Le texte d'une série : « 2,31 s (2,10–2,60) », « — » sans mesure. */
export const texteSerie = (v) => (v.length ? `${(mediane(v) / 1000).toFixed(2).replace(".", ",")} s (${(Math.min(...v) / 1000).toFixed(2).replace(".", ",")}–${(Math.max(...v) / 1000).toFixed(2).replace(".", ",")})` : "—");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".m4a": "audio/mp4", ".txt": "text/plain" };
const COMPRESSIBLES = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".wasm", ".webmanifest", ".txt"]);

/** Un serveur statique du site assemblé (`site/`), avec gzip comme Firebase Hosting ; `/api/…` répond 503 (le site se mesure sans serveur). */
export function servirSite(dossier) {
  const cache = new Map();
  const srv = createServer((req, res) => {
    const chemin = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (chemin.startsWith("/api/")) {
      res.writeHead(503);
      return res.end("{}");
    }
    let f = join(dossier, chemin);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) {
      res.writeHead(404);
      return res.end("introuvable");
    }
    const ext = extname(f);
    const entetes = { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "no-store" };
    let corps = readFileSync(f);
    if (COMPRESSIBLES.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      if (!cache.has(f)) cache.set(f, gzipSync(corps, { level: 6 }));
      corps = cache.get(f);
      entetes["content-encoding"] = "gzip";
    }
    res.writeHead(200, entetes);
    res.end(corps);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ base: `http://127.0.0.1:${srv.address().port}`, fermer: () => srv.close() })));
}

/** Le code posé dans la page avant tout script : à chaque image, note `performance.now()` la première fois que le bouton est visible (page d'accueil) ou que la partie est prête (page d'outils : `signal`) (aucune évaluation de texte : la CSP des pages le permet). */
function sonde({ bouton, signal }) {
  const t = (window.__mesure = { ecran: 0, pret: 0 });
  const visible = () => {
    const e = document.querySelector(bouton);
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
  };
  const pret = () => {
    if (signal === "cdj") return !!window.__cdj?.phase;
    if (signal === "jump") return ["ready", "playing"].includes(window.__jump?.phase ?? "");
    if (signal === "tower") return document.documentElement.dataset.ready === "true" && !!document.querySelector(".tower__scene");
    return false;
  };
  const tick = () => {
    try {
      if (!t.ecran && visible()) {
        t.ecran = performance.now();
        t.octets = performance.getEntriesByType("resource").reduce((n, e) => n + (e.transferSize || 0), 0) + (performance.getEntriesByType("navigation")[0]?.transferSize ?? 0);
      }
      if (signal && !t.pret && pret()) t.pret = performance.now();
    } catch {
      /* la page n'est pas encore prête : on réessaie à l'image suivante */
    }
    if (!(signal ? t.pret : t.ecran)) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Une passe : un contexte neuf (cache vide), la configuration réseau et processeur, l'adresse ; rend `{ ecran, pret, fcp, octets }` en millisecondes (0 : pas vu avant le délai). */
async function passe(browser, adresse, page_, config, delaiMs = 90_000) {
  const T0 = Date.now();
  const jalon = (m) => process.env.MESURE_JALONS && console.error(`    ${((Date.now() - T0) / 1000).toFixed(1)} s ${m}`);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: "block", locale: "fr-FR" });
  try {
    await context.addInitScript(sonde, { bouton: page_.bouton, signal: page_.signal ?? null });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    if (config.reseau) await cdp.send("Network.emulateNetworkConditions", config.reseau);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: config.cpu });
    jalon("avant goto");
    await page.goto(adresse, { waitUntil: "commit", timeout: delaiMs }).catch(() => {});
    jalon("goto");
    await page.waitForFunction((attendPret) => (attendPret ? !!window.__mesure?.pret : !!window.__mesure?.ecran), !!page_.signal, { timeout: delaiMs, polling: 100 }).catch(() => {});
    jalon("signal vu");
    await page.waitForFunction(() => performance.getEntriesByName("first-contentful-paint").length > 0, undefined, { timeout: 5000 }).catch(() => {}); // (le premier affichage est inscrit un peu après l'image qui l'a produit)
    const r = await page.evaluate(() => ({ ...window.__mesure, fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0 })).catch(() => ({ ecran: 0, pret: 0, fcp: 0 }));
    jalon("lu");
    // La mesure est prise : on lève les limites avant de fermer (sinon la fermeture attend les téléchargements encore ralentis).
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
    return r;
  } finally {
    jalon("avant fermeture");
    await context.close();
    jalon("fermé");
  }
}

/** Mesure toutes les pages : `{ id: { ecran: [ms], pret: [ms], fcp: [ms], octets: [o] } }` pour une configuration. */
export async function mesurer(browser, base, { passes, config, jeux, lectureSeule }) {
  const out = {};
  for (const p of PAGES.filter((x) => jeux.includes(x.id))) {
    const s = (out[p.id] = { ecran: [], pret: [], fcp: [], octets: [] });
    for (let i = 0; i < passes; i++) {
      const a = await passe(browser, base + p.url, { bouton: p.bouton, signal: null }, config);
      console.error(`  ${p.id} passe ${i + 1}/${passes} : écran utile ${Math.round(a.ecran)} ms`);
      if (a.ecran) s.ecran.push(a.ecran);
      if (a.fcp) s.fcp.push(a.fcp);
      if (a.octets) s.octets.push(a.octets);
      if (p.prete && !lectureSeule) {
        const b = await passe(browser, base + p.prete.url, { bouton: p.bouton, signal: p.prete.signal }, config);
        console.error(`  ${p.id} passe ${i + 1}/${passes} : prêt ${Math.round(b.pret)} ms`);
        if (b.pret) s.pret.push(b.pret);
      }
    }
  }
  return out;
}

const SEUIL_ECRAN_MS = 3000;

/** Le tableau Markdown d'une configuration. */
export function tableauMarkdown(titre, res, { lectureSeule = false } = {}) {
  const l = [`### ${titre}`, "", "| page | écran utile (bouton « Jouer » visible) | prêt à jouer | premier affichage (FCP) | transféré jusqu'à l'écran utile |", "|---|---|---|---|---|"];
  for (const p of PAGES) {
    const s = res[p.id];
    if (!s) continue;
    const pret = !p.prete ? "= écran utile" : lectureSeule ? "— (outils d'essai fermés en production)" : texteSerie(s.pret);
    const ko = s.octets.length ? `${(mediane(s.octets) / 1000).toFixed(1).replace(".", ",")} Ko` : "—";
    l.push(`| ${p.nom} | ${texteSerie(s.ecran)}${s.ecran.length && mediane(s.ecran) > SEUIL_ECRAN_MS ? " ⚠️" : ""} | ${pret} | ${texteSerie(s.fcp)} | ${ko} |`);
  }
  return l.join("\n") + "\n";
}

/** La conclusion : « on s'arrête là » si l'écran utile vient en moins de 3 s partout, sinon les pages à traiter d'abord. */
export function conclusion(res) {
  const pages = PAGES.filter((p) => res[p.id]?.ecran.length);
  const lentes = pages.filter((p) => mediane(res[p.id].ecran) >= SEUIL_ECRAN_MS).sort((a, b) => mediane(res[b.id].ecran) - mediane(res[a.id].ecran));
  if (!lentes.length) return `**Conclusion : l'écran utile s'affiche en moins de ${SEUIL_ECRAN_MS / 1000} s partout (la plus lente : ${texteSerie(res[[...pages].sort((a, b) => mediane(res[b.id].ecran) - mediane(res[a.id].ecran))[0].id].ecran)}). On s'arrête là.**\n`;
  return `**Conclusion : à traiter en premier** (écran utile à ${SEUIL_ECRAN_MS / 1000} s ou plus) : ${lentes.map((p) => `${p.nom} (${texteSerie(res[p.id].ecran)})`).join(", ")}.\n`;
}

async function main(argv) {
  const opt = (nom, defaut) => (argv.includes(nom) ? argv[argv.indexOf(nom) + 1] : defaut);
  const passes = Number(opt("--passes", 5));
  const jeux = String(opt("--jeux", "portail,track,jump,tower")).split(",");
  const url = opt("--url");
  const lectureSeule = argv.includes("--lecture-seule") || !!(url && /^https:\/\/(www\.)?playdujour\.com\/?$/.test(url));
  const site = resolve(ROOT, opt("--site", "site"));
  if (!url && !existsSync(join(site, "index.html"))) throw new Error(`${site} : le site n'est pas assemblé (npm run build && node scripts/site.mjs site)`);
  const { chromium } = await import("playwright");
  const serveur = url ? null : await servirSite(site);
  const base = (url ?? serveur.base).replace(/\/$/, "");
  // Une adresse déployée passe par le proxy de l'environnement s'il y en a un (`HTTPS_PROXY`), comme tout client.
  const proxy = url && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  try {
    const sorties = [];
    const resultats = {};
    for (const cle of argv.includes("--detail") ? ["reference", "reseau", "cpu"] : ["reference"]) {
      const res = (resultats[cle] = await mesurer(browser, base, { passes, config: CONFIGURATIONS[cle], jeux, lectureSeule }));
      sorties.push(tableauMarkdown(CONFIGURATIONS[cle].nom, res, { lectureSeule }));
    }
    const texte = `Mesure du ${new Date().toISOString().slice(0, 10)} · ${url ?? "site assemblé en local (gzip)"} · médiane de ${passes} passes, cache vide, 390 × 844, Chromium ${browser.version()} · rendu logiciel, la machine de mesure n'est pas un téléphone : lire les écarts, pas les valeurs absolues.\n\n${sorties.join("\n")}\n${conclusion(resultats.reference)}`;
    process.stdout.write(texte);
    if (opt("--json")) writeFileSync(opt("--json"), JSON.stringify({ passes, url: url ?? "local", resultats }, null, 2) + "\n");
  } finally {
    await browser.close();
    serveur?.fermer();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main(process.argv.slice(2));
