// Lot QA1 : les planches (toutes les tailles d'un sujet côte à côte, à la même échelle) et l'index de `npm run relecture`. Une planche est dessinée par le navigateur (une page locale, puis une capture).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const ECHELLE = 0.3;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NOMS_ZONES = { portail: "Portail", track: "Track", jump: "Jump", tower: "Tower", blocks: "Blocks", rush: "Rush" };

/** Écrit `planches/<langue>/<sujet>.jpg` ; rend son chemin. */
export async function ecrirePlanche(navigateur, { sortie, sujet, langue, captures, tailles, pli }) {
  const fichier = join(sortie, "planches", langue, `${sujet.id}.jpg`);
  mkdirSync(dirname(fichier), { recursive: true });
  const vignettes = captures
    .map((c) => {
      const t = tailles.find((x) => x.id === c.taille);
      // `pli` : un trait marque le bas du premier écran (une page photographiée en entier).
      return `<figure><figcaption>${esc(t.nom)}</figcaption><div class="vue"><img src="${pathToFileURL(c.fichier).href}" width="${Math.round(t.l * ECHELLE)}" alt="">${pli ? `<i style="top:${Math.round(t.h * ECHELLE)}px"></i>` : ""}</div></figure>`;
    })
    .join("");
  const page = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:20px;background:#1f1d1a;color:#f4ecd8;font:600 13px/1.3 system-ui,sans-serif;width:max-content}
    h1{font-size:18px;margin:0 0 14px}h1 small{font-weight:400;opacity:.7;margin-left:10px}
    .rang{display:flex;gap:16px;align-items:flex-start}figure{margin:0}figcaption{margin-bottom:6px;white-space:nowrap}
    img{display:block;height:auto;outline:1px solid #6b655a;background:#fff}.vue{position:relative;overflow:hidden}.vue i{position:absolute;left:0;right:0;border-top:2px dashed #ff5a3c}</style>
    <h1>${esc(sujet.titre)}<small>${langue === "fr" ? "français" : "anglais"} · ${esc(sujet.id)}</small></h1><div class="rang">${vignettes}</div>`;
  const temporaire = join(dirname(fichier), `.${basename(fichier)}.html`);
  writeFileSync(temporaire, page);
  const contexte = await navigateur.newContext({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 1 });
  try {
    const p = await contexte.newPage();
    await p.goto(pathToFileURL(temporaire).href);
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    await p.locator("body").screenshot({ path: fichier, type: "jpeg", quality: 80 });
  } finally {
    await contexte.close();
    rmSync(temporaire, { force: true });
  }
  return fichier;
}

/** Le tableau des contrôles en Markdown (une ligne par sujet et par langue). */
export function tableauMarkdown({ lignes, controles }) {
  const tete = `| page | langue | ${controles.map((c) => c.nom).join(" | ")} |\n|---|---|${controles.map(() => "---:").join("|")}|`;
  const corps = lignes.map((l) => `| ${l.id} | ${l.langue} | ${l.manques.length && !l.captures.length ? controles.map(() => "—").join(" | ") : controles.map((c) => (l.constats[c.id] ?? []).length || "·").join(" | ")} |`);
  return `${tete}\n${corps.join("\n")}\n`;
}

/** Écrit `index.html` (planches et tableau, page par page) et `controles.md`. */
export function ecrireIndex(sortie, { lignes, tailles, controles, jour, refus }) {
  writeFileSync(join(sortie, "controles.md"), `# Relecture du ${jour} — contrôles automatiques\n\nUn nombre = des constats à regarder (détail dans \`index.html\` et \`controles.json\`) ; « · » = rien ; « — » = page non photographiée.\n\n${tableauMarkdown({ lignes, controles })}`);
  const zones = [...new Set(lignes.map((l) => l.zone))];
  const total = (l) => controles.reduce((n, c) => n + (l.constats[c.id] ?? []).length, 0);
  const cellule = (l, c) => {
    const n = (l.constats[c.id] ?? []).length;
    return `<td class="${n ? "oui" : "non"}">${n || "·"}</td>`;
  };
  const detail = (l) =>
    controles
      .filter((c) => (l.constats[c.id] ?? []).length)
      .map((c) => `<h4>${esc(c.nom)}</h4><ul>${(l.constats[c.id] ?? []).map((k) => `<li><b>${esc(k.quoi)}</b>${k.ou ? ` — <code>${esc(k.ou)}</code>` : ""} <i>${esc(k.tailles.join(", "))}</i></li>`).join("")}</ul>`)
      .join("");
  const sections = zones
    .map((zone) => {
      const ids = [...new Set(lignes.filter((l) => l.zone === zone).map((l) => l.id))];
      const blocs = ids
        .map((id) => {
          const versions = lignes.filter((l) => l.id === id);
          const premiere = versions[0];
          const planches = versions.map((l) => (l.planche ? `<a class="planche" href="${esc(l.planche)}"><img loading="lazy" src="${esc(l.planche)}" alt="Planche ${esc(l.titre)} (${l.langue})"><span>${l.langue === "fr" ? "français" : "anglais"}</span></a>` : `<p class="manque">${l.langue} : non photographié — ${esc(l.manques.join(" ; "))}</p>`)).join("");
          const tableau = `<table><thead><tr><th>langue</th>${controles.map((c) => `<th>${esc(c.nom)}</th>`).join("")}</tr></thead><tbody>${versions.map((l) => `<tr><th>${l.langue}</th>${controles.map((c) => cellule(l, c)).join("")}</tr>`).join("")}</tbody></table>`;
          const details = versions.filter((l) => total(l) || l.manques.length).map((l) => `<details><summary>${l.langue} : ${total(l)} constat${total(l) > 1 ? "s" : ""}${l.manques.length ? `, ${l.manques.length} manque${l.manques.length > 1 ? "s" : ""}` : ""}</summary>${l.manques.length ? `<p class="manque">${esc(l.manques.join(" ; "))}</p>` : ""}${detail(l)}</details>`).join("");
          return `<article id="${esc(id)}"><h3>${esc(premiere.titre)} <code>${esc(id)}</code></h3><div class="planches">${planches}</div>${tableau}${details}</article>`;
        })
        .join("");
      return `<section><h2 id="zone-${esc(zone)}">${esc(NOMS_ZONES[zone] ?? zone)}</h2>${blocs}</section>`;
    })
    .join("");
  const resume = `<table class="resume"><thead><tr><th>page</th><th>langue</th>${controles.map((c) => `<th>${esc(c.nom)}</th>`).join("")}</tr></thead><tbody>${lignes.map((l) => `<tr><th><a href="#${esc(l.id)}">${esc(l.id)}</a></th><td>${l.langue}</td>${l.captures.length ? controles.map((c) => cellule(l, c)).join("") : `<td colspan="${controles.length}" class="manque">non photographié</td>`}</tr>`).join("")}</tbody></table>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relecture du ${esc(jour)}</title><style>
    :root{color-scheme:light dark;--fond:#f4ecd8;--encre:#1f1d1a;--trait:#cfc4a8;--oui:#b3261e;--carte:#fffaf0}
    @media (prefers-color-scheme:dark){:root{--fond:#1f1d1a;--encre:#f4ecd8;--trait:#4a453c;--oui:#ff8a80;--carte:#2a2723}}
    body{margin:0;padding:24px;background:var(--fond);color:var(--encre);font:15px/1.45 system-ui,sans-serif}
    h1{margin:0 0 4px}h2{margin:40px 0 8px;border-bottom:2px solid var(--encre)}h3{margin:28px 0 8px}h4{margin:10px 0 2px;font-size:14px}
    code{font-size:12px;opacity:.75}nav a{margin-right:14px}a{color:inherit}
    .planches{display:flex;gap:12px;overflow-x:auto;padding-bottom:6px}.planche{flex:0 0 auto;text-align:center;font-size:12px;text-decoration:none}
    .planche img{display:block;height:260px;width:auto;max-width:900px;object-fit:cover;object-position:left top;border:1px solid var(--trait)}
    table{border-collapse:collapse;margin:10px 0;font-size:13px}th,td{border:1px solid var(--trait);padding:3px 8px;text-align:center}thead th{font-weight:600;background:var(--carte)}
    td.oui{color:var(--oui);font-weight:700}td.non{opacity:.45}.manque{color:var(--oui)}details{margin:4px 0}summary{cursor:pointer}ul{margin:2px 0 6px;padding-left:20px}li i{opacity:.6;font-size:12px}
    .resume{width:100%}.resume th:first-child{text-align:left}</style></head><body>
    <h1>Relecture du ${esc(jour)}</h1>
    <p>Produit par <code>npm run relecture</code>. Tailles : ${tailles.map((t) => esc(t.nom)).join(" · ")}. Un nombre = des constats à regarder ; aucun contrôle n'est un verdict.</p>
    ${refus.length ? `<p class="manque">Jeux non passés « on » : ${esc(refus.join(" ; "))}</p>` : ""}
    <nav>${zones.map((z) => `<a href="#zone-${esc(z)}">${esc(NOMS_ZONES[z] ?? z)}</a>`).join("")}<a href="#tableau">Tableau des contrôles</a></nav>
    ${sections}<h2 id="tableau">Tableau des contrôles, page par page</h2>${resume}</body></html>`;
  writeFileSync(join(sortie, "index.html"), html);
}
