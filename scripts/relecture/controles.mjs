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
      const out = { cibles: [], debordement: [], coupe: [], textes: [], images: [] };

      if (tactile) {
        for (const e of racine.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="link"], [tabindex]:not([tabindex="-1"])')) {
          if (!visible(e) || e.disabled) continue;
          let r = e.getBoundingClientRect();
          // Une case ou un bouton radio compte avec son étiquette (la cible touchée est l'étiquette).
          const etiquette = e.matches("input") ? e.closest("label") ?? (e.id ? document.querySelector(`label[for="${CSS.escape(e.id)}"]`) : null) : null;
          if (etiquette) r = etiquette.getBoundingClientRect();
          if (r.width >= 43.5 && r.height >= 43.5) continue;
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
        if (/\(s\)|\(e\)|\(es\)/.test(t)) noter("« (s) »");
        if ([...t].some((c) => emoji.test(c) && !permis.test(c) && !/[0-9#*]/.test(c))) noter("emoji");
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
