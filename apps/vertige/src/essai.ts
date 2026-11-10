import { estNomNiveau, type NomNiveau } from "@cdj/vertige-sim";
import type { StyleVertige } from "./confort";

// Les options d'ESSAI de Vertige, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9), sauf `style` (un choix de rendu, sans effet sur la partie) :
//   · `?scenario=bac-a-sable|mur|parcours` : une arène (murs, marches, trous de 2 à 10 m), un long mur au-dessus du vide, ou le parcours de la maquette (sans le portail) ;
//   · `?style=doux|cartouche` : le style de rendu (« Lumière douce » ou « Cartouche ») ; les touches 1 et 2 le changent en partie ;
//   · `?debug&tune` : le panneau des sensations (vitesses, saut, gravité, mur, dash, sensibilité, champ de vision, roulis) et l'export en JSON ; `&reglages=<JSON>` : des réglages collés (ceux que le panneau exporte) ;
//   · `?debug&demo` : le joueur scripté du parcours joue à ta place (captures, mesures d'images par seconde : le même parcours à chaque fois) ;
//   · `?debug&fps` : les images par seconde, les appels de dessin et la taille de la rediffusion ; `&bloom=0` et `&ombres=0` coupent le halo et les ombres (pour mesurer ce qu'ils coûtent).
// Une partie d'essai n'est JAMAIS classée (`classable` de la définition) ; la rediffusion d'un scénario nomme le scénario et le serveur la refuse.
export interface Essai {
  scenario: NomNiveau | null;
  style: StyleVertige | null;
  tune: boolean;
  fps: boolean;
  /** Le joueur scripté joue (captures et mesures). */
  demo: boolean;
  /** `?debug` : la porte `window.__vertige` des tests. */
  debug: boolean;
  /** Les réglages de la simulation collés dans l'adresse (le JSON lu, non vérifié : `reglagesDe` de la simulation le fait, dans le corps du jeu — ce fichier est dans le premier chargement), ou `null`. */
  reglages: unknown;
  /** Les réglages de confort collés dans l'adresse (JSON brut), ou `null`. */
  confort: unknown;
  bloom: boolean;
  ombres: boolean;
  /** Vrai dès qu'une option change la partie : elle n'est alors pas classable. */
  essai: boolean;
}

export function lireEssai(search: string, restreint: boolean): Essai {
  const q = new URLSearchParams(search);
  const s = q.get("style");
  const style: StyleVertige | null = s === "doux" || s === "cartouche" ? s : null;
  const vide: Essai = { scenario: null, style, tune: false, fps: false, demo: false, debug: false, reglages: null, confort: null, bloom: true, ombres: true, essai: false };
  if (restreint) return vide;
  const nom = q.get("scenario") ?? "";
  const scenario = estNomNiveau(nom) ? nom : null;
  const debug = q.has("debug");
  let reglages: unknown = null;
  let confort: unknown = null;
  const brut = q.get("reglages");
  if (brut) {
    try {
      const j = JSON.parse(brut) as { reglages?: unknown; confort?: unknown };
      reglages = j.reglages ?? j;
      confort = j.confort ?? null;
    } catch {
      /* un JSON abîmé : les réglages du jeu */
    }
  }
  const tune = debug && q.has("tune");
  return {
    scenario,
    style,
    tune,
    fps: debug && q.has("fps"),
    demo: debug && q.has("demo"),
    debug,
    reglages,
    confort,
    bloom: q.get("bloom") !== "0",
    ombres: q.get("ombres") !== "0",
    essai: scenario !== null || tune || (debug && q.has("demo")) || reglages !== null,
  };
}
