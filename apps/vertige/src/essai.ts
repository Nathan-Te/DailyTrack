import { estNomNiveau, type NomNiveau } from "@cdj/vertige-sim";

// Les options d'ESSAI de Vertige, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9) :
//   · `?scenario=modules` (lot V2) : la galerie des modules de niveau (nom, étiquettes, temps du robot ; « Voir la solution » : la caméra rejoue la solution ; « Jouer ») ; `?scenario=enchainement` : l'enchaînement fixe de
//     modules, à jouer (chuter exprès : on reprend au palier ; R reprend au dernier palier), le temps du robot est affiché ;
//   · `?scenario=jours&debug` (lot V3) : la galerie des 14 prochains jours (les modules du niveau, le temps du robot, « Voir la démonstration » : le robot joue le niveau ; « Jouer ») ;
//   · `?scenario=bac-a-sable|mur|parcours|gravite|portails|cube` : une arène (murs, marches, trous de 2 à 10 m), un long mur au-dessus du vide, le parcours de la maquette (sans le portail), la salle de la gravité (des surfaces
//     marquées, à l'ouest et à l'est), la salle des portails (trois paires et un court parcours) ou le cube (six plaques marquées, les six directions de la gravité) ;
//   · `?debug&tune` : le panneau des sensations (vitesses, saut, gravité, mur, dash, sensibilité, champ de vision, roulis, balancement, transition de la caméra à une bascule) et l'export en JSON ; `&reglages=<JSON>` : des réglages collés (ceux que le panneau exporte) ;
//   · `?debug&demo` : le joueur scripté du parcours joue à ta place (captures, mesures d'images par seconde : le même parcours à chaque fois) ;
//   · `?debug&fps` : les images par seconde, les appels de dessin et la taille de la rediffusion ; `&bloom=0` et `&ombres=0` coupent le halo et les ombres (pour mesurer ce qu'ils coûtent).
// Une partie d'essai n'est JAMAIS classée (`classable` de la définition) ; la rediffusion d'un scénario nomme le scénario et le serveur la refuse.
export interface Essai {
  scenario: NomNiveau | null;
  /** `?scenario=modules` (lot V2) : la galerie des modules de niveau — chacun se regarde (la caméra rejoue la solution) ou se joue. */
  galerie: boolean;
  /** `?scenario=jours` (lot V3) : la galerie des 14 prochains jours — leurs modules, le temps du robot, « Voir la démonstration » (le robot joue le niveau) et « Jouer ». */
  jours: boolean;
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
  const vide: Essai = { scenario: null, galerie: false, jours: false, tune: false, fps: false, demo: false, debug: false, reglages: null, confort: null, bloom: true, ombres: true, essai: false };
  if (restreint) return vide;
  const nom = q.get("scenario") ?? "";
  const scenario = estNomNiveau(nom) ? nom : null;
  const galerie = nom === "modules";
  const jours = nom === "jours";
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
    galerie,
    jours,
    tune,
    fps: debug && q.has("fps"),
    demo: debug && q.has("demo"),
    debug,
    reglages,
    confort,
    bloom: q.get("bloom") !== "0",
    ombres: q.get("ombres") !== "0",
    essai: scenario !== null || galerie || jours || tune || (debug && q.has("demo")) || reglages !== null,
  };
}
