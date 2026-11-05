import { SCENARIOS, type Scenario } from "@cdj/rush-sim/constantes";
import { reglagesDe, sontLesReglagesParDefaut, type Reglages } from "@cdj/rush-sim/reglagesSim";

// Les options d'ESSAI de Rush, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9) :
//   · `?scenario=arene|boss` : l'arène sans fin (des vagues de gelées et de chauves-souris) ou le golem tout de suite ; `&phase=2` : le golem à 50 % de vie ; `&monstres=30` : l'arène garde 30 monstres en vie ;
//   · `?debug&tune` : le panneau des sensations ; `&reglages=<JSON>` : des réglages collés (ceux que le panneau exporte) ;
//   · `?debug&fps` : l'affichage des images par seconde et des appels de dessin ;
//   · `?scenario=mannequin` (lot BR0c) : six gelées immobiles qui ne meurent pas et un golem qui ne frappe pas, pour juger le coup ; `?scenario=vitrine` : la composition de la cible, figée ;
//   · `?qualite=haute|basse` (lot BR0c) : le niveau de rendu (haute : ombres portées, contour et bloom en post-traitement ; basse : ombres en disques, contour par coque). Sans le paramètre, haute avec un passage automatique en basse si les images par seconde chutent.
// Une partie d'essai n'est JAMAIS classée (`classable` de la définition) ; la rediffusion d'un scénario nomme le scénario et le serveur la refuse.
export interface Essai {
  scenario: Scenario | null;
  phase2: boolean;
  monstres: number;
  tune: boolean;
  fps: boolean;
  /** Le niveau de rendu imposé par l'adresse, ou `null` (haute, avec le passage automatique en basse). */
  qualite: "haute" | "basse" | null;
  /** Les réglages de la simulation collés dans l'adresse, ou `null` (ceux de la partie classée). */
  reglages: Reglages | null;
  /** Les sensations collées dans l'adresse (JSON brut), ou `null`. */
  sensations: unknown;
  /** Vrai dès qu'une option d'essai change la partie : elle n'est alors pas classable. */
  essai: boolean;
}

export function lireEssai(search: string, restreint: boolean): Essai {
  const vide: Essai = { scenario: null, phase2: false, monstres: 0, tune: false, fps: false, qualite: null, reglages: null, sensations: null, essai: false };
  if (restreint) return vide;
  const q = new URLSearchParams(search);
  const nom = q.get("scenario") ?? "";
  const scenario = (SCENARIOS as readonly string[]).includes(nom) ? (nom as Scenario) : null;
  const debug = q.has("debug");
  let reglages: Reglages | null = null;
  let sensations: unknown = null;
  const brut = q.get("reglages");
  if (brut) {
    try {
      const j = JSON.parse(brut) as { reglages?: unknown; sensations?: unknown };
      const r = reglagesDe(j.reglages ?? j);
      reglages = sontLesReglagesParDefaut(r) ? null : r;
      sensations = j.sensations ?? null;
    } catch {
      /* un JSON abîmé : les réglages par défaut */
    }
  }
  const monstres = Number(q.get("monstres"));
  const nivQ = q.get("qualite");
  return {
    scenario,
    phase2: q.get("phase") === "2",
    monstres: Number.isInteger(monstres) && monstres > 0 ? Math.min(40, monstres) : 0,
    tune: debug && q.has("tune"),
    fps: debug && q.has("fps"),
    qualite: nivQ === "haute" || nivQ === "basse" ? nivQ : null,
    reglages,
    sensations,
    essai: scenario !== null || (debug && q.has("tune")) || reglages !== null,
  };
}
