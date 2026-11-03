import "./versionPerimee.css";
import { CATALOGUE_VERSION } from "./catalogue.version";
import { bouton } from "./composants";
import { el } from "./dom";
import type { Langue } from "./i18n";

// Lot D2 — le bandeau d'un onglet périmé : le serveur a une autre version du jeu que cet onglet (resté ouvert pendant une mise en production). Une ligne, le bouton qui recharge la page.
// `role="status"` (lu sans prendre le focus : on ne vole jamais le focus au joueur), texte du catalogue à part `catalogue.version.ts`, mis à jour sur place au changement de langue.
// À la demande : le jeu le charge par `@cdj/kit/version`, jamais dans son premier chargement. **Jamais pendant une partie** : c'est la brique du kit qui le montre et le cache.

export interface OptionsVersionPerimee {
  /** La langue courante du jeu (relue à chaque `maj`). */
  langue(): Langue;
  /** Recharge la page (par défaut `location.reload()`). */
  recharger?: () => void;
}

export function bandeauVersionPerimee(o: OptionsVersionPerimee): { racine: HTMLElement; maj(): void } {
  const texte = el("p", { classe: "dj-bandeau__texte" });
  const recharger = bouton({ texte: "", variante: "secondaire", onClick: () => (o.recharger ?? (() => location.reload()))() });
  const racine = el("div", { classe: ["dj-bandeau", "dj-bandeau--important", "dj-versionperimee"], attrs: { role: "status", "aria-atomic": "true", "data-version-perimee": "1" } }, texte, recharger);
  const maj = () => {
    const t = CATALOGUE_VERSION[o.langue() === "en" ? "en" : "fr"] as unknown as Readonly<Record<string, string>>;
    texte.textContent = t["version.perimee"] ?? null;
    recharger.textContent = t["version.recharger"] ?? null;
    recharger.setAttribute("aria-label", t["version.rechargerAria"] ?? "");
  };
  maj();
  // Le jeu change de langue sans recharger : l'hôte rappelle `maj()`.
  return { racine, maj };
}
