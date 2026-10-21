import type { Plugin } from "vite";
import type { Catalogue } from "../src/i18n";
/** L'icône de l'onglet : une cartouche encre à l'étiquette terre cuite (couleurs des jetons). */
export declare function iconeDuJour(): string;
/** Remplit les `data-t`, `data-t-<attr>`, `data-jeton-<attr>` et l'icône d'une page HTML (pur, testé). */
export declare function remplirHtml(html: string, catalogue: Catalogue): string;
/**
 * `absolues` (lot I4) : les polices sont servies par un chemin absolu (`/assets/<nom>.woff2`, le même pour toutes les applications du site : un joueur qui
 * vient du portail les a déjà en cache) ; le préchargement doit alors viser ce même chemin.
 */
export declare function pagesDuSocle(o: {
    catalogue: Catalogue;
    prechargees?: readonly string[];
    absolues?: boolean;
}): Plugin;
