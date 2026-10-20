// Le détecteur des chaînes d'interface écrites en dur (lot I1). Pur : il reçoit le texte d'un fichier et rend les endroits fautifs.
// Une chaîne d'interface passe toujours par un catalogue ; les seules exceptions sont marquées `i18n-ok: <raison>` (commentaire sur la même
// ligne ou la ligne d'avant ; en HTML `<!-- i18n-ok: … -->` sur la même ligne), pour un nom propre (« Du Jour », « Track », « CDJ2 »…).
//
// TypeScript : un littéral (guillemets ou gabarit `…`, sans compter les `${…}`) qui contient une lettre, affecté à `textContent`, `innerText`,
// `innerHTML`, `outerHTML`, `title`, `placeholder`, `alt`, `ariaLabel` ; passé à `setAttribute("title" | "aria-label" | "aria-description" |
// "placeholder" | "alt", …)`, `createTextNode`, `insertAdjacentHTML`, `append`, `prepend`, `alert`, `confirm`, `prompt` ; ou donné aux options
// de texte des composants (`texte`, `titre`, `legende`, `valeur`, `sousTexte`, `ariaLabel`, `label`, `title`, `placeholder`, `alt`,
// `"aria-label"`, `textContent`, `innerHTML`).
// HTML : tout texte entre deux balises (hors `<script>`, `<style>`, commentaires), les attributs `title`, `aria-label`, `placeholder`, `alt`, et
// le `content` d'un `<meta name="description">` ou `og:*`.

export interface Faute {
  ligne: number;
  extrait: string;
}

const LIT = String.raw`("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + "`(?:[^`\\\\]|\\\\.)*`)";
const REGLES_TS = [
  String.raw`\.(?:textContent|innerText|innerHTML|outerHTML|title|placeholder|alt|ariaLabel)\s*\+?=\s*` + LIT,
  String.raw`setAttribute\(\s*["'](?:title|aria-label|aria-description|placeholder|alt)["']\s*,\s*` + LIT,
  String.raw`\b(?:createTextNode|alert|confirm|prompt)\(\s*` + LIT,
  String.raw`\binsertAdjacentHTML\(\s*[^,]+,\s*` + LIT,
  String.raw`\.(?:append|prepend|replaceChildren)\(\s*` + LIT,
  String.raw`(?:[{,]\s*|^\s*)(?:texte|titre|legende|valeur|sousTexte|ariaLabel|label|title|placeholder|alt|textContent|innerText|innerHTML|"aria-label"|'aria-label')\s*:\s*` + LIT,
].map((r) => new RegExp(r, "gm"));

/** Un littéral qui contient une lettre, sans compter ce qui est calculé (`${…}`). */
function estTexte(litteral: string): boolean {
  return /\p{L}/u.test(litteral.slice(1, -1).replace(/\$\{[^}]*\}/g, ""));
}

function ligneDe(texte: string, index: number): number {
  return texte.slice(0, index).split("\n").length;
}

function marquee(lignes: string[], ligne: number): boolean {
  return /i18n-ok/.test(lignes[ligne - 1] ?? "") || /i18n-ok/.test(lignes[ligne - 2] ?? "");
}

/** Efface les commentaires (en gardant les sauts de ligne et les marques `i18n-ok`), sans toucher aux chaînes. */
function sansCommentaires(code: string): string {
  return code.replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, chaine: string | undefined) =>
    chaine ? m : m.replace(/[^\n]/g, " "),
  );
}

export function fautesTs(source: string): Faute[] {
  const lignes = source.split("\n");
  const code = sansCommentaires(source);
  const fautes: Faute[] = [];
  for (const re of REGLES_TS) {
    for (const m of code.matchAll(re)) {
      const lit = m[1]!;
      if (!estTexte(lit)) continue;
      const ligne = ligneDe(code, m.index! + m[0].length - lit.length);
      if (!marquee(lignes, ligne)) fautes.push({ ligne, extrait: m[0].trim().slice(0, 80) });
    }
  }
  return fautes.sort((a, b) => a.ligne - b.ligne);
}

export function fautesHtml(source: string): Faute[] {
  const lignes = source.split("\n");
  // Les blocs ignorés gardent leurs sauts de ligne (numéros de ligne justes).
  const blanc = (m: string) => m.replace(/[^\n]/g, " ");
  const html = source.replace(/<script\b[\s\S]*?<\/script>/gi, blanc).replace(/<style\b[\s\S]*?<\/style>/gi, blanc).replace(/<!--[\s\S]*?-->/g, blanc);
  const fautes: Faute[] = [];
  const ajoute = (index: number, extrait: string) => {
    const ligne = ligneDe(html, index);
    if (!marquee(lignes, ligne)) fautes.push({ ligne, extrait: extrait.trim().slice(0, 80) });
  };
  for (const m of html.matchAll(/>([^<]+)</g)) if (/\p{L}/u.test(m[1]!.replace(/&[a-z]+;|&#\d+;/gi, ""))) ajoute(m.index! + 1 + m[1]!.search(/\S/), m[1]!);
  for (const m of html.matchAll(/\s(?:title|aria-label|placeholder|alt)="([^"]*)"/g)) if (/\p{L}/u.test(m[1]!)) ajoute(m.index!, m[0]);
  for (const m of html.matchAll(/<meta\b[^>]*>/g)) {
    if (!/\b(?:name="description"|property="og:[^"]*"|name="twitter:[^"]*")/.test(m[0])) continue;
    const c = /\scontent="([^"]*)"/.exec(m[0]);
    if (c && /\p{L}/u.test(c[1]!)) ajoute(m.index!, m[0]);
  }
  return fautes.sort((a, b) => a.ligne - b.ligne);
}
