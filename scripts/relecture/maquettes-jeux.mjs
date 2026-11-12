#!/usr/bin/env node
// Lot QA2 : assemble les maquettes des jeux de `docs/relectures/maquettes/jeux/` — un fichier HTML autonome par maquette (polices et captures incluses, aucune ressource externe sauf three.js par importmap).
//   node scripts/relecture/maquettes-jeux.mjs            (après `npm run relecture -- --seulement '^(track|jump|tower|blocks|rush)$' --langues fr` : les captures « avant » viennent de `relecture/captures/fr/`)
// Sources (`docs/relectures/maquettes/jeux/src/`) :
//   gabarits.mjs + donnees.mjs + jeux.css   les écrans « après » des maquettes d'interface (`<jeu>-interface.html`) et la comparaison, dessinés à la taille réelle de l'écran ;
//   <jeu>-visuel.html, index.html           des pages écrites à la main : `{{polices}}`, `{{capture:<sujet>/<taille>@<largeur>}}`, `{{ko:<fonction>}}` (poids gzip du code entre `/*@f:nom*/` et `/*@/f*/`), `{{mesure:<jeu>:<clé>}}` (mesures.json).
// Les maquettes sont des documents à lire, jamais du code à construire dans le site.
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOSSIER = join(RACINE, "docs/relectures/maquettes/jeux");
const SRC = join(DOSSIER, "src");
const CAPTURES = join(RACINE, "relecture/captures/fr");
const POLICES = [
  ["Archivo Black", 400, "normal", "archivo-black-latin-400-normal"],
  ["Archivo", 400, "normal", "archivo-latin-400-normal"],
  ["Archivo", 600, "normal", "archivo-latin-600-normal"],
  ["Archivo", 700, "normal", "archivo-latin-700-normal"],
  ["JetBrains Mono", 700, "normal", "jetbrains-mono-latin-700-normal"],
  ["Barlow Condensed", 800, "italic", "barlow-condensed-latin-800-italic"],
  ["Lilita One", 400, "normal", "lilita-one-latin-400-normal"],
  ["Rubik Mono One", 400, "normal", "profil/rubik-mono-one-latin-400-normal"],
  ["Bungee", 400, "normal", "profil/bungee-latin-400-normal"],
];
const polices = POLICES.map(([f, g, s, fichier]) => `@font-face{font-family:'${f}';font-weight:${g};font-style:${s};src:url(data:font/woff2;base64,${readFileSync(join(RACINE, "packages/ui/polices", `${fichier}.woff2`)).toString("base64")}) format('woff2')}`).join("\n");
const commun = readFileSync(join(RACINE, "docs/relectures/maquettes/src/commun.css"), "utf8");
const cssJeux = readFileSync(join(SRC, "jeux.css"), "utf8");
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const mesures = existsSync(join(SRC, "mesures.json")) ? JSON.parse(readFileSync(join(SRC, "mesures.json"), "utf8")) : {};

const navigateur = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await navigateur.newContext({ deviceScaleFactor: 1 })).newPage();

/** Une capture réduite à `largeur` px, en adresse `data:` (JPEG). */
const memo = new Map();
async function capture(cle, largeur) {
  const k = `${cle}@${largeur}`;
  if (memo.has(k)) return memo.get(k);
  const fichier = join(CAPTURES, `${cle}.jpg`);
  if (!existsSync(fichier)) throw new Error(`capture manquante : ${fichier} (npm run relecture -- --seulement '^(track|jump|tower|blocks|rush)$' --langues fr)`);
  await page.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${readFileSync(fichier).toString("base64")}" style="display:block;width:${largeur}px"></body>`);
  await page.evaluate(() => document.images[0].decode());
  const h = await page.evaluate(() => document.images[0].height);
  await page.setViewportSize({ width: largeur, height: h });
  const uri = `data:image/jpeg;base64,${(await page.screenshot({ type: "jpeg", quality: 64 })).toString("base64")}`;
  memo.set(k, uri);
  return uri;
}

// Poids gzip du code marqué entre les repères `@f:nom` et `@/f` (écrits en commentaire de bloc) d'une source.
const marques = (src) => Object.fromEntries([...src.matchAll(/\/\*@f:(\w+)\*\/([\s\S]*?)\/\*@\/f\*\//g)].map(([, nom, code]) => [nom, gzipSync(Buffer.from(code.replace(/\s+/g, " "))).length]));
const ko = (o) => (o / 1024).toFixed(1).replace(".", ",");

const STYLE_PAGE = `
body{margin:0;background:#D8CCB3;color:#2A1E16;font:15px/1.5 system-ui,sans-serif;padding:28px 20px 80px}
.intro,.paire,.suite{max-width:1560px;margin:0 auto 36px}
h1{font:800 26px/1.2 system-ui,sans-serif;margin:6px 0 8px}
.intro p{max-width:940px;margin:0 0 10px}.intro a{color:inherit;font-weight:700}
.paire h2,.suite h2{font:800 19px system-ui,sans-serif;margin:0 0 4px}
.note{max-width:940px;margin:0 0 10px}
.duo{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
figure{margin:0;background:#fff;border-radius:10px;padding:10px;box-shadow:0 1px 0 #B8AB90;min-width:0}
figcaption{font:700 13px system-ui,sans-serif;color:#555;margin:0 0 6px 2px;text-transform:uppercase;letter-spacing:.6px}
.apres figcaption{color:#1565C0}
.boite{overflow:hidden;position:relative}
.avant img{display:block;width:100%}
iframe{border:0;display:block;transform-origin:0 0;background:#222}
.legende{max-width:1000px;padding-left:0;list-style:none;counter-reset:n;margin:10px 0 0}
.legende li{counter-increment:n;position:relative;padding:8px 0 8px 40px;border-top:1px solid #B8AB90}
.legende li::before{content:counter(n);position:absolute;left:0;top:8px;width:24px;height:24px;border-radius:50%;background:#1565C0;color:#fff;font:700 13px/24px system-ui,sans-serif;text-align:center}
.legende b{font-weight:700}.legende i{font-style:normal;color:#555}
.marque{display:inline-block;font:700 11px system-ui,sans-serif;letter-spacing:.6px;text-transform:uppercase;padding:1px 7px;border-radius:3px;border:2px solid #2A1E16;background:#E8B23A;margin-left:4px;white-space:nowrap}
.marque.plat{background:#4FC3DC}.marque.sim{background:#C2401F;color:#FFF4E0}.marque.com{background:#9ED9BC}
table{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0}th,td{border:2px solid #2A1E16;padding:6px 9px;text-align:left;vertical-align:top}th{background:#2A1E16;color:#EDE3CF}
code{font-size:13px}`;

const SCRIPT_CADRES = `
const css = document.getElementById("css").textContent;
for (const cadre of document.querySelectorAll("iframe[data-l]")) {
  const l = Number(cadre.dataset.l), h = Number(cadre.dataset.h);
  const corps = cadre.closest("figure").querySelector('script[type="text/plain"]').textContent;
  cadre.srcdoc = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style></head><body>' + corps + "</body></html>";
  cadre.style.width = l + "px"; cadre.style.height = h + "px";
  const ajuster = () => { const boite = cadre.parentElement; const k = Math.min(1, boite.clientWidth / l); cadre.style.transform = "scale(" + k + ")"; boite.style.height = h * k + "px"; };
  ajuster(); addEventListener("resize", ajuster);
}`;

/** Un écran « avant / après » : la capture, puis la proposition dessinée à la taille réelle de l'écran. */
async function paire(g, e, gab) {
  const { l, h } = e;
  const affiche = l >= 900 ? 760 : l;
  const corps = e.corps ?? gab[e.gabarit](g, l, h, e);
  return `<section class="paire"><h2>${e.titre}</h2>${e.note ? `<p class="note">${e.note}</p>` : ""}<div class="duo">
    <figure class="avant" style="flex:0 1 ${affiche + 20}px"><figcaption>Avant — le jeu aujourd'hui</figcaption><div class="boite"><img alt="Capture : ${esc(e.titre)}" src="${await capture(e.avant, affiche)}"></div></figure>
    <figure class="apres" style="flex:0 1 ${affiche + 20}px"><figcaption>Après — la proposition</figcaption><div class="boite"><iframe title="Proposition : ${esc(e.titre)}" data-l="${l}" data-h="${h}" scrolling="no"></iframe></div><script type="text/plain">${corps.replace(/<\/script/g, "<\\/script")}</script></figure>
  </div></section>`;
}

const enveloppe = ({ titre, intro, corps, css = "" }) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<style>${STYLE_PAGE}${css}</style>
</head>
<body>
<div class="intro"><p><a href="index.html">‹ Toutes les maquettes des jeux</a></p><h1>${esc(titre)}</h1>${intro}</div>
${corps}
<script type="text/plain" id="css">${polices}\n${commun}\n${cssJeux}</script>
<script>${SCRIPT_CADRES}</script>
</body>
</html>
`;

const sortie = [];
const ecrire = (nom, html) => { writeFileSync(join(DOSSIER, nom), html); sortie.push(`${nom} ${(html.length / 1024).toFixed(0)} Ko`); };

// ---------------------------------------------------------------- interface + comparaison
const gab = await import(pathToFileURL(join(SRC, "gabarits.mjs")).href);
const { JEUX, comparaison } = await import(pathToFileURL(join(SRC, "donnees.mjs")).href);
const seulement = process.argv[2] ?? null;
const legendeHtml = (g) => `<section class="suite"><h2>Ce qui change, et pourquoi</h2><ol class="legende">${g.legende.map((x) => `<li><b>${x.t}</b> ${x.d}${(x.m ?? []).map((m) => `<span class="marque ${m[0]}">${m[1]}</span>`).join("")} <i>${x.ref ?? ""}</i></li>`).join("")}</ol></section>`;
for (const [id, g] of Object.entries(JEUX)) {
  if (seulement && !id.startsWith(seulement) && seulement !== "interface") continue;
  g.n = Object.fromEntries(g.legende.map((x, i) => [x.k, i + 1]));
  const paires = [];
  for (const e of g.ecrans) paires.push(await paire(g, e, gab));
  ecrire(`${id}-interface.html`, enveloppe({
    titre: `${g.nomCourt} — maquette d'interface (lot QA2)`,
    intro: `<p>${g.intro}</p><p>À gauche la capture du jeu le 12 novembre 2026 (<code>npm run relecture</code>), à droite la proposition, dessinée à la taille réelle de l'écran avec les jetons et les formes de la charte « Cartouches » (révisions 13, 17 et 18). Les pastilles bleues numérotées renvoient à la légende sous les écrans ; les cadres bleus en pointillé sont les marges de sécurité de l'iPhone. Rien n'est codé : un lot de jeu s'en servira de base.</p>`,
    corps: paires.join("\n") + legendeHtml(g),
  }));
}
if (!seulement || seulement === "comparaison" || seulement === "interface") {
  const { sections, intro, legende } = comparaison;
  const corps = [];
  for (const s of sections) {
    const avant = [], apres = [];
    for (const [id, g] of Object.entries(JEUX)) {
      g.n = g.n ?? Object.fromEntries(g.legende.map((x, i) => [x.k, i + 1]));
      const cle = `${id}-${s.sujet}/${s.l}x${s.h}`;
      avant.push(`<figure class="avant" style="flex:0 1 ${s.aff + 20}px"><figcaption>${g.nomCourt}</figcaption><div class="boite"><img alt="Capture : ${g.nomCourt}, ${esc(s.titre)}" src="${await capture(cle, s.aff)}"></div></figure>`);
      const c = gab[s.gabarit](g, s.l, s.h);
      apres.push(`<figure class="apres" style="flex:0 1 ${s.aff + 20}px"><figcaption>${g.nomCourt}</figcaption><div class="boite"><iframe title="Proposition : ${g.nomCourt}, ${esc(s.titre)}" data-l="${s.l}" data-h="${s.h}" scrolling="no"></iframe></div><script type="text/plain">${c.replace(/<\/script/g, "<\\/script")}</script></figure>`);
    }
    corps.push(`<section class="paire"><h2>${s.titre}</h2><p class="note">${s.note}</p><h3 style="margin:8px 0 4px;font:700 14px system-ui">Avant</h3><div class="duo">${avant.join("")}</div><h3 style="margin:14px 0 4px;font:700 14px system-ui;color:#1565C0">Après</h3><div class="duo">${apres.join("")}</div>
      <table><thead><tr><th>Commun aux cinq jeux (proposé une seule fois)</th><th>Propre à chaque jeu (l'identité)</th></tr></thead><tbody><tr><td>${s.commun}</td><td>${s.identite}</td></tr></tbody></table></section>`);
  }
  ecrire("comparaison.html", enveloppe({ titre: "Les cinq jeux côte à côte — accueil et arrivée (lot QA2)", intro, corps: corps.join("\n") + `<section class="suite"><h2>Ce qui devient commun</h2>${legende}</section>` }));
}

// ---------------------------------------------------------------- pages écrites à la main (visuel, index)
if (!seulement || seulement === "pages") {
  for (const nom of readdirSync(SRC).filter((f) => f.endsWith(".html")).sort()) {
    let src = readFileSync(join(SRC, nom), "utf8");
    const poids = marques(src.replace(/\{\{inclure:([\w.]+)\}\}/g, (_, f) => readFileSync(join(SRC, "inc", f), "utf8")));
    src = src.replace(/\{\{inclure:([\w.]+)\}\}/g, (_, f) => readFileSync(join(SRC, "inc", f), "utf8"));
    src = src.replace(/\{\{polices\}\}/g, polices);
    src = src.replace(/\{\{ko:(\w+)\}\}/g, (_, k) => (poids[k] === undefined ? "?" : ko(poids[k])));
    src = src.replace(/\{\{mesure:(\w+):(\w+)\}\}/g, (_, j, k) => String(mesures[j]?.[k] ?? "—"));
    const demandes = [...src.matchAll(/\{\{capture:([^@}]+)@(\d+)\}\}/g)];
    for (const [tout, cle, l] of demandes) src = src.replace(tout, await capture(cle, Number(l)));
    ecrire(nom, src);
  }
}
await navigateur.close();
process.stdout.write(`maquettes des jeux : ${sortie.join(" · ")}\n`);
