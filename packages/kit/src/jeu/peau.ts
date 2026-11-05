import { el } from "@cdj/ui";
import type { PeauJeu } from "./types";

// Lot « écrans du kit » — **la peau d'un jeu**, rendue par le kit. Tout ce qui est propre au jeu vient de sa fiche (la teinte, la coque et la police de l'étiquette : `jeux.generated.css`, classe
// `jeu-etiquette--<id>` posée sur la page) et, s'il le veut, de `DefinitionJeu.peau` (`PeauJeu` : une illustration, un décor par thème, un accent). Le jeu n'écrit aucune feuille d'écran.
// **Une couleur n'entre dans la page que si c'est un `#RRGGBB`** (`couleurValide`) : elle est posée en variable CSS (`style.setProperty`, jamais un attribut `style`).

const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Une couleur de la peau : `#RRGGBB`, rien d'autre. */
export const couleurValide = (c: unknown): c is string => typeof c === "string" && HEX.test(c);

/** Les deux aplats du décor d'un thème, ou `null` (le jeu n'en donne pas, ou une couleur est refusée) : le décor est alors celui de la fiche. */
export function fondDuTheme(peau: PeauJeu | undefined, theme: string): { ciel: string; sol: string } | null {
  const f = peau?.fond?.(theme);
  return f && couleurValide(f.ciel) && couleurValide(f.sol) ? { ciel: f.ciel, sol: f.sol } : null;
}

/** Pose la peau sur la page : la classe de la fiche (`--jeu-fond`, `--jeu-coque`, `--jeu-police`) et l'accent s'il y en a un. À appeler une fois, avant le premier écran. */
export function habillerPage(id: string, peau: PeauJeu | undefined): void {
  const racine = document.documentElement;
  racine.classList.add(`jeu-etiquette--${id}`);
  if (couleurValide(peau?.accent)) racine.style.setProperty("--peau-accent", peau!.accent!);
}

/** Le décor derrière les écrans de l'accueil : un aplat de ciel et une bande de sol (ceux du thème du jour, sinon la teinte et la coque de la fiche), sous le voile à rayures. Rien n'est cliquable. */
export function creerFond(peau: PeauJeu | undefined, theme: string): HTMLElement {
  const fond = el("div", { classe: "jeu-fond", attrs: { "aria-hidden": "true" } });
  const f = fondDuTheme(peau, theme);
  if (f) {
    fond.style.setProperty("--peau-ciel", f.ciel);
    fond.style.setProperty("--peau-sol", f.sol);
  }
  return fond;
}

/** L'illustration du titre de l'accueil, dans son habillage décoratif ; `null` si le jeu n'en donne pas. */
export function creerDessin(peau: PeauJeu | undefined): HTMLElement | null {
  const d = peau?.dessin?.();
  return d ? el("span", { classe: "jeu-accueil__dessin", attrs: { "aria-hidden": "true" } }, d) : null;
}
