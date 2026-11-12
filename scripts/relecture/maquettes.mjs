#!/usr/bin/env node
// Lot QA1 : assemble les maquettes « avant / après » de `docs/relectures/maquettes/` — un fichier HTML autonome par écran (polices du socle et captures incluses dans le fichier, aucune ressource externe).
//   node scripts/relecture/maquettes.mjs            (après `npm run relecture -- --seulement portail --langues fr` : les captures « avant » viennent de `relecture/captures/fr/`)
// Sources : `docs/relectures/maquettes/src/<écran>.html` (les propositions, une `<section data-avant="sujet/taille" data-largeur="1280|390">` par écran, puis la légende `<ol class="legende">`)
// et `src/commun.css` (jetons et formes de la charte). Les maquettes sont des documents à lire, jamais du code à construire dans le site.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(RACINE, "docs/relectures/maquettes/src");
const SORTIE = join(RACINE, "docs/relectures/maquettes");
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
const polices = POLICES.map(([famille, graisse, style, fichier]) => `@font-face{font-family:'${famille}';font-weight:${graisse};font-style:${style};src:url(data:font/woff2;base64,${readFileSync(join(RACINE, "packages/ui/polices", `${fichier}.woff2`)).toString("base64")}) format('woff2')}`).join("\n");
const commun = readFileSync(join(SRC, "commun.css"), "utf8");
const illustration = (jeu) => readFileSync(join(RACINE, `apps/${jeu}/public/illustration.svg`), "utf8").replace(/<\?xml[^>]*>/, "").trim();
/** Pictogrammes au trait (dessinés ici : aucun émoji, charte § 6) et blocs repris d'un écran à l'autre (`{{nom}}` dans une source). */
const trait = (d, plus = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${plus}>${d}</svg>`;
const ICONES = {
  cloche: trait('<path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7 2.5 7h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  profil: trait('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.600 8 7"/>'),
  etoile: trait('<path d="M12 3.200l2.700 5.600 6.100.800-4.500 4.200 1.200 6-5.500-3-5.500 3 1.200-6L3.200 9.600l6.100-.800z"/>'),
  etoilePleine: trait('<path d="M12 3.200l2.700 5.600 6.100.800-4.500 4.200 1.200 6-5.500-3-5.500 3 1.200-6L3.200 9.600l6.100-.800z" fill="currentColor"/>'),
  calendrier: trait('<rect x="3.500" y="5" width="17" height="15" rx="1.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/>'),
  barres: trait('<path d="M6 20v-7M12 20V5M18 20v-10"/>'),
  amis: trait('<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c0-3.600 2.900-6 6.500-6s6.500 2.400 6.500 6"/><circle cx="17" cy="9" r="2.500"/><path d="M17.500 14.200c2.400.400 4 2.200 4 4.800"/>'),
  crayon: trait('<path d="M4 20l1-4L16 5l3 3L8 19z"/>'),
  flamme: trait('<path d="M12 3c1 3 4 4.500 4 8.500a4 4 0 0 1-8 0c0-1.500.700-2.500 1.500-3.500.300 1.200 1 1.800 1.500 2 .200-2.500-.500-4.500 1-7z" fill="currentColor"/>'),
  drapeau: trait('<path d="M6 21V4M6 5h11l-2.500 3.500L17 12H6"/>'),
  coche: trait('<path d="M5 12.500l4.500 4.500L19 7.500"/>'),
  lien: trait('<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>'),
  plus: trait('<path d="M12 5v14M5 12h14"/>'),
};
/** La cloche et l'avatar : ceux de « Démo », ou ceux d'un visiteur sans profil. */
const outils = (anonyme) => (anonyme ? `<span class="rond">${ICONES.cloche}</span><span class="rond">${ICONES.profil}</span>` : `<span class="rond">${ICONES.cloche}<i class="point"></i></span><span class="av m">DÉ</span>`);
const BLOCS = {
  barre: (ici, anonyme) => `<header class="barre"><span class="logo">DU JOUR</span><nav class="nav">${["Aujourd'hui", "Classements", "Amis et groupes", "Profil"].map((n, i) => `<a${String(i) === ici ? ' class="ici"' : ""}>${n}</a>`).join("")}</nav><div class="outils"><div class="langue"><span class="ici">FR</span><span>EN</span></div>${outils(anonyme)}</div></header>`,
  barreAnon: (ici) => BLOCS.barre(ici, true),
  barreTel: (_, anonyme) => `<header class="barre"><span class="logo">DU JOUR</span><div class="outils">${outils(anonyme)}</div></header>`,
  barreTelAnon: () => BLOCS.barreTel(null, true),
  onglets: (ici) => `<nav class="onglets">${[["calendrier", "Aujourd'hui"], ["barres", "Classements"], ["amis", "Amis"], ["profil", "Profil"]].map(([ic, n], i) => `<a${String(i) === ici ? ' class="ici"' : ""}>${ICONES[ic]}${n}</a>`).join("")}</nav>`,
  pied: () => `<footer class="pied"><p>Nouveau jour à minuit, heure de Paris. Ton profil est le même dans tous les jeux.</p><a class="soc">Rejoindre le Discord</a><a class="soc kofi">Me soutenir sur Ko-fi</a><a class="lien">Un bug ? Une idée ?</a><a class="lien">Mentions légales et confidentialité</a></footer>`,
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** La capture « avant », réduite et recadrée par le navigateur, en adresse `data:` (JPEG). */
async function avant(page, cle, largeur) {
  const fichier = join(CAPTURES, `${cle}.jpg`);
  if (!existsSync(fichier)) throw new Error(`capture manquante : ${fichier} (npm run relecture -- --seulement portail --langues fr)`);
  const cible = largeur > 600 ? 880 : 390;
  await page.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${readFileSync(fichier).toString("base64")}" style="display:block;width:${cible}px"></body>`);
  await page.evaluate(() => document.images[0].decode());
  const h = await page.evaluate(() => document.images[0].height);
  await page.setViewportSize({ width: cible, height: Math.min(h, largeur > 600 ? 1500 : 2300) });
  return `data:image/jpeg;base64,${(await page.screenshot({ type: "jpeg", quality: 62 })).toString("base64")}`;
}

const navigateur = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await navigateur.newContext({ deviceScaleFactor: 1 })).newPage();
const fiches = [];
for (const nom of readdirSync(SRC).filter((f) => f.endsWith(".html")).sort()) {
  let source = readFileSync(join(SRC, nom), "utf8").replace(/\{\{illustration:(\w+)\}\}/g, (_, jeu) => illustration(jeu)).replace(/\{\{icone:(\w+)\}\}/g, (_, n) => ICONES[n]).replace(/\{\{(barreTelAnon|barreAnon|barreTel|barre|onglets|pied)(?::(\w+))?\}\}/g, (_, n, a) => BLOCS[n](a));
  const meta = (cle) => new RegExp(`<meta name="${cle}" content="([^"]*)">`).exec(source)?.[1] ?? "";
  const sections = [...source.matchAll(/<section data-avant="([^"]+)" data-largeur="(\d+)" data-titre="([^"]*)"(?: data-note="([^"]*)")?>([\s\S]*?)<\/section>/g)];
  const legende = /<ol class="legende">[\s\S]*?<\/ol>/.exec(source)?.[0] ?? "";
  const style = /<style>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? "";
  const paires = [];
  for (const [, cle, largeur, titre, note, corps] of sections) {
    const l = Number(largeur);
    paires.push(`<section class="paire ${l > 600 ? "ordi" : "tel"}"><h2>${titre}</h2>${note ? `<p class="note">${note}</p>` : ""}<div class="duo">
      <figure class="avant"><figcaption>Avant — le site aujourd'hui</figcaption><img alt="Capture de l'écran actuel : ${esc(titre)}" src="${await avant(page, cle, l)}"></figure>
      <figure class="apres"><figcaption>Après — la proposition</figcaption><div class="boite"><iframe title="Proposition : ${esc(titre)}" data-largeur="${l}" scrolling="no"></iframe></div><script type="text/plain">${corps.replace(/<\/script/g, "<\\/script")}</script></figure>
    </div></section>`);
  }
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta("titre")}</title>
<style>
body{margin:0;background:#D8CCB3;color:#2A1E16;font:15px/1.5 system-ui,sans-serif;padding:28px 20px 80px}
.intro,.paire,.suite{max-width:1560px;margin:0 auto 36px}
h1{font:800 26px/1.2 system-ui,sans-serif;margin:6px 0 8px}
.intro p{max-width:900px;margin:0 0 10px}.intro a{color:inherit;font-weight:700}
.paire h2,.suite h2{font:800 19px system-ui,sans-serif;margin:0 0 4px}
.note{max-width:900px;margin:0 0 10px}
.duo{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
figure{margin:0;background:#fff;border-radius:10px;padding:10px;box-shadow:0 1px 0 #B8AB90;min-width:0}
figcaption{font:700 13px system-ui,sans-serif;color:#555;margin:0 0 6px 2px;text-transform:uppercase;letter-spacing:.6px}
.apres figcaption{color:#1565C0}
.ordi figure{flex:1 1 560px}.ordi img{width:100%;display:block}
.tel figure{flex:0 0 auto}.tel img{width:390px;max-width:100%;display:block}
.boite{overflow:hidden;position:relative}
iframe{border:0;display:block;transform-origin:0 0;background:#EDE3CF}
.tel iframe{width:390px}
.legende{max-width:900px;padding-left:0;list-style:none;counter-reset:n;margin:10px 0 0}
.legende li{counter-increment:n;position:relative;padding:8px 0 8px 40px;border-top:1px solid #B8AB90}
.legende li::before{content:counter(n);position:absolute;left:0;top:8px;width:24px;height:24px;border-radius:50%;background:#1565C0;color:#fff;font:700 13px/24px system-ui,sans-serif;text-align:center}
.legende b{font-weight:700}.legende i{font-style:normal;color:#555}
.marque{display:inline-block;font:700 11px system-ui,sans-serif;letter-spacing:.6px;text-transform:uppercase;padding:1px 7px;border-radius:3px;border:2px solid #2A1E16;background:#E8B23A;margin-left:4px;white-space:nowrap}
.marque.serveur{background:#4FC3DC}.marque.grave{background:#C2401F;color:#FFF4E0}
</style>
</head>
<body>
<div class="intro"><p><a href="index.html">‹ Toutes les maquettes</a></p><h1>${meta("titre")}</h1><p>${meta("intro")}</p>
<p>À gauche la capture du site le 12 novembre 2026 (<code>npm run relecture</code>), à droite la proposition, dessinée en HTML avec les jetons, les polices et les formes de la charte « Cartouches » (révisions 18 à 20). Les pastilles bleues numérotées renvoient à la légende sous les écrans. Les photos sont des initiales de remplacement.</p></div>
${paires.join("\n")}
<section class="suite"><h2>Ce qui change, et pourquoi</h2>${legende}</section>
<script type="text/plain" id="css">${polices}\n${commun}\n${style}</script>
<script>
const css = document.getElementById("css").textContent;
for (const cadre of document.querySelectorAll("iframe[data-largeur]")) {
  const largeur = Number(cadre.dataset.largeur);
  const corps = cadre.closest("figure").querySelector('script[type="text/plain"]').textContent;
  cadre.srcdoc = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style></head><body class="' + (largeur > 600 ? "ordi" : "tel") + '">' + corps + "</body></html>";
  cadre.style.width = largeur + "px";
  const ajuster = () => {
    const doc = cadre.contentDocument;
    if (!doc || !doc.body) return;
    const boite = cadre.parentElement;
    const k = largeur > 600 ? boite.clientWidth / largeur : 1;
    cadre.style.transform = "scale(" + k + ")";
    cadre.style.height = "10px";
    const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    cadre.style.height = h + "px";
    boite.style.height = h * k + "px";
  };
  cadre.addEventListener("load", () => { ajuster(); cadre.contentDocument.fonts.ready.then(ajuster); setTimeout(ajuster, 400); });
  addEventListener("resize", ajuster);
}
</script>
</body>
</html>
`;
  writeFileSync(join(SORTIE, nom), html);
  fiches.push(`${nom} ${(html.length / 1024).toFixed(0)} Ko`);
}
await navigateur.close();
process.stdout.write(`maquettes : ${fiches.join(" · ")}\n`);
