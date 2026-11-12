// Lot QA1 : les contrôles automatiques de `npm run relecture`, faits sur la page telle qu'elle est photographiée. Chaque contrôle rend une liste de constats `{ quoi, ou }` (jamais une exception) :
// le tableau de l'index les compte page par page. Ce sont des signaux à regarder, pas des verdicts : un contrôle ne fait rien échouer (l'outil est hors de la CI).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

/** Les contrôles, dans l'ordre des colonnes du tableau. */
export const CONTROLES = [
  { id: "contraste", nom: "Contraste AA" },
  { id: "cibles", nom: "Cibles < 44 px" },
  { id: "debordement", nom: "Défilement horizontal" },
  { id: "coupe", nom: "Texte coupé" },
  { id: "chevauchement", nom: "Textes qui se chevauchent" },
  { id: "petit", nom: "Texte sous 12 px" },
  { id: "textes", nom: "Textes interdits" },
  { id: "focus", nom: "Focus invisible" },
  { id: "images", nom: "Images sans alt" },
  { id: "console", nom: "Erreurs de console" },
];

/** Contraste des textes : axe-core, règle `color-contrast` (WCAG AA). `zone` : n'auditer que cet écran (un jeu : pas la scène). */
export async function contraste(page, zone) {
  try {
    await page.evaluate(AXE);
    const violations = await page.evaluate(async (z) => {
      const r = await window.axe.run(z ? { include: [z] } : document, { runOnly: { type: "rule", values: ["color-contrast"] }, resultTypes: ["violations"] });
      return r.violations.flatMap((v) => v.nodes.map((n) => ({ ou: n.target.join(" "), quoi: (n.any[0]?.message ?? v.help).replace(/\s+/g, " ").slice(0, 160) })));
    }, zone ?? null);
    return violations.slice(0, 30);
  } catch (e) {
    return [{ quoi: `axe-core n'a pas pu auditer la page : ${String(e).slice(0, 120)}`, ou: "" }];
  }
}

/**
 * Les contrôles lus dans le DOM, en une passe : cibles tactiles (`tactile` seulement), défilement horizontal, texte coupé, textes interdits, images sans `alt`.
 * Un lien dans une phrase est exempté de la règle des 44 px (WCAG 2.5.8, exception « en ligne »).
 */
export function controlesDuDom(page, { tactile, zone }) {
  return page.evaluate(
    ({ tactile, zone }) => {
      const racine = (zone && document.querySelector(zone)) || document.body;
      const dire = (e) => {
        const id = e.id ? `#${e.id}` : "";
        const classe = typeof e.className === "string" && e.className.trim() ? `.${e.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
        const texte = (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
        return `${e.tagName.toLowerCase()}${id}${classe}${texte ? ` « ${texte} »` : ""}`;
      };
      const visible = (e) => {
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const s = getComputedStyle(e);
        if (s.visibility !== "visible" || s.display === "none" || Number(s.opacity) === 0) return false;
        for (let p = e; p; p = p.parentElement) if (p.hasAttribute("hidden") || p.getAttribute("aria-hidden") === "true" || p.inert) return false;
        return true;
      };
      const out = { cibles: [], debordement: [], coupe: [], chevauchement: [], petit: [], textes: [], images: [] };

      if (tactile) {
        for (const e of racine.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="link"], [tabindex]:not([tabindex="-1"])')) {
          if (!visible(e) || e.disabled) continue;
          const r = e.getBoundingClientRect();
          // Un champ compte aussi par son étiquette (toucher l'étiquette suffit) : il passe si l'un des deux fait 44 px.
          const etiquette = e.matches("input") ? e.closest("label") ?? (e.id ? document.querySelector(`label[for="${CSS.escape(e.id)}"]`) : null) : null;
          const e2 = etiquette?.getBoundingClientRect();
          if ((r.width >= 43.5 && r.height >= 43.5) || (e2 && e2.width >= 43.5 && e2.height >= 43.5)) continue;
          if (e.matches("a") && getComputedStyle(e).display.startsWith("inline") && e.parentElement && /^(P|LI|SPAN|TD|DD|SMALL|EM|STRONG)$/.test(e.parentElement.tagName) && (e.parentElement.textContent ?? "").trim().length > (e.textContent ?? "").trim().length + 8) continue;
          out.cibles.push({ quoi: `${Math.round(r.width)} × ${Math.round(r.height)} px`, ou: dire(e) });
        }
      }

      const largeur = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > largeur + 1) {
        const fautifs = [];
        for (const e of document.body.querySelectorAll("*")) {
          if (!visible(e)) continue;
          const r = e.getBoundingClientRect();
          if (r.right > largeur + 1 && getComputedStyle(e).position !== "fixed") fautifs.push(e);
        }
        const feuilles = fautifs.filter((e) => !fautifs.some((f) => f !== e && e.contains(f))).slice(0, 4);
        out.debordement.push({ quoi: `la page fait ${document.documentElement.scrollWidth} px pour un écran de ${largeur} px`, ou: feuilles.map(dire).join(" ; ") });
      }

      for (const e of racine.querySelectorAll("*")) {
        if (!visible(e)) continue;
        const s = getComputedStyle(e);
        const propre = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
        if (!propre || (e.clientWidth <= 2 && e.clientHeight <= 2)) continue; // un texte réservé aux lecteurs d'écran (`dj-cache`) n'est pas « coupé »
        const coupeX = e.scrollWidth > e.clientWidth + 1 && (s.overflowX === "hidden" || s.overflowX === "clip");
        const coupeY = e.scrollHeight > e.clientHeight + 2 && (s.overflowY === "hidden" || s.overflowY === "clip");
        if (coupeX || coupeY) out.coupe.push({ quoi: s.textOverflow === "ellipsis" ? "points de suspension" : coupeX ? "coupé en largeur" : "coupé en hauteur", ou: dire(e) });
        // Un texte qui sort de l'écran sans défilement.
        const r = e.getBoundingClientRect();
        if (r.left < -1 && r.right > 0 && s.position !== "fixed") out.coupe.push({ quoi: "sort de l'écran à gauche", ou: dire(e) });
      }

      // Deux textes l'un sur l'autre : les boîtes des textes (pas celles de leurs blocs) qui se recouvrent sur 30 % au moins de la largeur et de la hauteur du plus petit, hors parent et enfant.
      // (La boîte d'un texte compte son interligne : deux lignes serrées se touchent sans se recouvrir, d'où le seuil. Un texte réservé aux lecteurs d'écran ne compte pas.)
      const fixe = (e) => {
        for (let p = e; p && p !== document.body; p = p.parentElement) if (/fixed|sticky/.test(getComputedStyle(p).position)) return true;
        return false;
      };
      const boites = [];
      for (const e of racine.querySelectorAll("*")) {
        if (boites.length > 500 || !visible(e) || e.clientWidth <= 2 || e.clientHeight <= 2 || getComputedStyle(e).clipPath !== "none" || getComputedStyle(e).clip !== "auto") continue;
        const noeuds = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
        if (!noeuds.length) continue;
        const plage = document.createRange();
        plage.setStart(noeuds[0], 0);
        plage.setEnd(noeuds.at(-1), noeuds.at(-1).textContent.length);
        const r = plage.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) boites.push({ e, r, fixe: fixe(e) });
      }
      for (let i = 0; i < boites.length; i++) {
        for (let k = i + 1; k < boites.length; k++) {
          const [a, b] = [boites[i], boites[k]];
          if (a.e.contains(b.e) || b.e.contains(a.e) || a.fixe !== b.fixe) continue; // un texte qui défile sous une barre fixe n'est pas un chevauchement
          const l = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (l >= 0.3 * Math.min(a.r.width, b.r.width) && h >= 0.3 * Math.min(a.r.height, b.r.height) && l > 4 && h > 4) out.chevauchement.push({ quoi: `${dire(a.e)} recouvre ${dire(b.e)}`.slice(0, 170), ou: "" });
        }
      }

      const emoji = /\p{Extended_Pictographic}/u;
      const permis = /[©®™↑↓←→↗↘‹›«»✓✕×★☆•·…▲▼◀▶♪]/u; // signes de la charte (flèches, coche, étoile) : pas des emoji
      const cle = /(^|\s)[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){1,4}(?=$|\s)/;
      const adresse = /\.(com|fr|org|net|io|html|json|png|svg|js|css|ts|md|app|dev|gg)$/i;
      const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
      const vus = new Set();
      for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
        const t = n.textContent.replace(/\s+/g, " ").trim();
        const parent = n.parentElement;
        if (!t || !parent || /^(SCRIPT|STYLE|NOSCRIPT|CODE|PRE|TEXTAREA)$/.test(parent.tagName) || !visible(parent)) continue;
        const noter = (quoi) => {
          const k = `${quoi}|${t}`;
          if (!vus.has(k)) vus.add(k), out.textes.push({ quoi, ou: `${dire(parent)}` });
        };
        // Charte § 4 : pas de texte d'interface sous 12 px, sauf une légende en capitales de 10 ou 11 px en graisse 700 au moins.
        const style = getComputedStyle(parent);
        const corps = parseFloat(style.fontSize);
        const legende = corps >= 10 && (Number(style.fontWeight) >= 700 || /Black|Mono One|Bungee|Lilita/.test(style.fontFamily.split(",")[0])) && (style.textTransform === "uppercase" || t === t.toUpperCase());
        if (corps < 11.95 && !legende && t.length > 1 && parent.clientWidth > 2 && parent.clientHeight > 2 && !vus.has(`petit|${dire(parent)}`)) vus.add(`petit|${dire(parent)}`), out.petit.push({ quoi: `${Math.round(corps * 10) / 10} px`, ou: dire(parent) });
        if (/\(s\)|\(e\)|\(es\)/.test(t)) noter("« (s) »");
        // La ligne à partager porte des émojis exprès (charte, § 6, révision 4) : elle n'est pas « l'interface ».
        if (!parent.closest('[class*="partage"], [class*="share"]') && [...t].some((c) => emoji.test(c) && !permis.test(c) && !/[0-9#*]/.test(c))) noter("emoji");
        if (/\bundefined\b|\bNaN\b|\[object |\bnull\b/.test(t)) noter("undefined / NaN / null");
        const m = cle.exec(t);
        if (m && !adresse.test(m[0].trim()) && !/^\d/.test(m[0].trim()) && !/^(v|n)\.\d/.test(m[0].trim()) && !parent.closest("a[href^='mailto:'], time")) noter(`clé non traduite ? « ${m[0].trim()} »`);
      }
      for (const e of racine.querySelectorAll("[aria-label], [title], [placeholder], [alt]")) {
        for (const a of ["aria-label", "title", "placeholder", "alt"]) {
          const v = e.getAttribute(a);
          if (v && (/\bundefined\b|\bNaN\b|\[object /.test(v) || (cle.test(v) && !adresse.test(v) && !/\s/.test(v.trim())))) out.textes.push({ quoi: `attribut ${a} : « ${v.slice(0, 40)} »`, ou: dire(e) });
        }
      }

      for (const e of racine.querySelectorAll("img, svg, canvas")) {
        if (e.closest('[aria-hidden="true"]') || !visible(e)) continue;
        const nomme = e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby") || e.getAttribute("role") === "presentation" || e.getAttribute("role") === "none";
        if (e.tagName === "IMG" ? !e.hasAttribute("alt") && !nomme : e.tagName === "CANVAS" ? false : !nomme && !e.querySelector("title")) out.images.push({ quoi: `${e.tagName.toLowerCase()} sans alt ni aria-hidden`, ou: dire(e.tagName === "IMG" ? e : e.parentElement ?? e) });
      }
      for (const k of Object.keys(out)) out[k] = out[k].slice(0, 30);
      return out;
    },
    { tactile, zone: zone ?? null },
  );
}

/** Focus au clavier : `Tab` jusqu'à 60 arrêts ; un arrêt sans contour ni ombre de focus est noté. Ordinateur seulement. */
export async function focusVisible(page, zone) {
  const constats = [];
  const vus = new Set();
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const etat = await page.evaluate((z) => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const contour = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 1 && s.outlineColor !== "rgba(0, 0, 0, 0)";
      const ombre = s.boxShadow !== "none";
      const id = e.id ? `#${e.id}` : "";
      const classe = typeof e.className === "string" && e.className.trim() ? `.${e.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
      const r = e.getBoundingClientRect();
      return { cle: `${e.tagName}${id}${classe}${Math.round(r.left)},${Math.round(r.top + scrollY)}`, ou: `${e.tagName.toLowerCase()}${id}${classe} « ${(e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)} »`, visible: contour || ombre, dans: !z || !!e.closest(z) };
    }, zone ?? null);
    if (!etat) continue;
    if (vus.has(etat.cle)) break;
    vus.add(etat.cle);
    if (!etat.visible && etat.dans) constats.push({ quoi: "ni contour ni ombre au focus", ou: etat.ou });
  }
  if (!vus.size) constats.push({ quoi: "aucun arrêt de tabulation", ou: "" });
  return constats.slice(0, 30);
}

/** Écoute la console d'une page : erreurs, exceptions, réponses 4xx / 5xx (hors celles que la page attend : `attendues`, des expressions régulières sur l'adresse). */
export function ecouterConsole(page, attendues = []) {
  const constats = [];
  const noter = (quoi, ou) => {
    if (constats.length < 30 && !constats.some((c) => c.quoi === quoi && c.ou === ou)) constats.push({ quoi, ou });
  };
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) noter(m.text().replace(/\s+/g, " ").slice(0, 200), new URL(page.url()).pathname);
  });
  page.on("pageerror", (e) => noter(`exception : ${String(e.message).slice(0, 200)}`, new URL(page.url()).pathname));
  page.on("response", (r) => {
    if (r.status() >= 400 && !attendues.some((a) => a.test(r.url()))) noter(`réponse ${r.status()}`, new URL(r.url()).pathname);
  });
  return constats;
}
