import type { Plugin } from "vite";
import { valeurJeton, type NomJeton } from "../src/jetons";
import type { Catalogue } from "../src/i18n";

// Outils de construction (Vite) pour les applications qui passent au socle (lot I1 : le portail ; lots I4, I5 : les jeux). Côté Node seulement.
//
// `pagesDuSocle({ catalogue, prechargees })` :
//   - **pré-remplit les textes du HTML** depuis le catalogue français (langue par défaut, avant tout script) : un élément `data-t="cle"` reçoit
//     le texte de la clé, un attribut `data-t-<attr>="cle"` (ex. `data-t-content`) remplit l'attribut `<attr>`. Le HTML source ne contient donc
//     aucune chaîne d'interface (test des chaînes en dur), et la page reste lisible sans JavaScript ;
//   - **pose les couleurs des jetons** dans le HTML (`data-jeton-<attr>="dj-creme"` → `<attr>="#EDE3CF"` : `theme-color`) et l'icône de
//     l'onglet (`<link rel="icon" data-icone-du-jour>`), sans couleur écrite en dur ;
//   - **précharge les polices** demandées (`prechargees` : noms de fichiers woff2 sans extension, ex. `archivo-black-latin-400-normal`) dans
//     les pages qui les déclarent (`data-precharge-polices` sur `<html>`), avec leur nom à empreinte.
// Une clé ou un jeton inconnu arrête la construction.

const ECHAPPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const echappe = (s: string) => s.replace(/[&<>"]/g, (c) => ECHAPPE[c]!);

function texteDe(catalogue: Catalogue, cle: string): string {
  const v = catalogue[cle];
  if (v === undefined) throw new Error(`clé de traduction inconnue dans le HTML : ${cle}`);
  return typeof v === "string" ? v : v.other;
}

/** L'icône de l'onglet : une cartouche encre à l'étiquette terre cuite (couleurs des jetons). */
export function iconeDuJour(): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='3' fill='${valeurJeton("dj-encre")}'/>` +
    `<rect x='3' y='5' width='10' height='8' rx='1' fill='${valeurJeton("dj-terre")}'/><rect x='5' y='2' width='6' height='2' fill='${valeurJeton("dj-creme")}'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Remplit les `data-t`, `data-t-<attr>`, `data-jeton-<attr>` et l'icône d'une page HTML (pur, testé). */
export function remplirHtml(html: string, catalogue: Catalogue): string {
  return html
    .replace(/(<([a-z][a-z0-9-]*)\b[^>]*\sdata-t="([^"]+)"[^>]*>)\s*(<\/\2>)/g, (_, ouvre: string, _tag, cle: string, ferme: string) => `${ouvre}${echappe(texteDe(catalogue, cle))}${ferme}`)
    .replace(/\sdata-t-([a-z-]+)="([^"]+)"/g, (_, attr: string, cle: string) => ` ${attr}="${echappe(texteDe(catalogue, cle))}"`)
    .replace(/\sdata-jeton-([a-z-]+)="([^"]+)"/g, (_, attr: string, nom: string) => ` ${attr}="${valeurJeton(nom as NomJeton)}"`)
    .replace(/<link rel="icon" data-icone-du-jour\s*\/?>/g, `<link rel="icon" href="${iconeDuJour()}" />`);
}

export function pagesDuSocle(o: { catalogue: Catalogue; prechargees?: readonly string[] }): Plugin {
  return {
    name: "cdj-pages-du-socle",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        let out = remplirHtml(html, o.catalogue);
        if (/<html[^>]*\sdata-precharge-polices/.test(out)) {
          const liens: string[] = [];
          for (const nom of o.prechargees ?? []) {
            const asset = Object.values(ctx.bundle ?? {}).find((f) => f.type === "asset" && f.names.some((n) => n === `${nom}.woff2`));
            if (!ctx.bundle) continue; // serveur de développement : rien à précharger
            if (!asset) throw new Error(`police à précharger absente de la construction : ${nom}`);
            // Chemin relatif à la page (base « ./ ») : la profondeur de la page dans dist/.
            const profondeur = ctx.path.split("/").length - 2;
            liens.push(`<link rel="preload" as="font" type="font/woff2" crossorigin href="${"../".repeat(profondeur) || "./"}${asset.fileName}" />`);
          }
          out = out.replace(/\sdata-precharge-polices/, "").replace("</title>", `</title>\n    ${liens.join("\n    ")}`);
        }
        return out;
      },
    },
  };
}
