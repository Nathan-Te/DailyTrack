import { SCENARIOS, reglagesDe, sontLesReglagesParDefaut, type Reglages, type Scenario } from "@cdj/rush-sim";

// Les options d'ESSAI de Rush, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9) :
//   · `?scenario=arene|boss` : l'arène sans fin (des vagues de gelées et de chauves-souris) ou le golem tout de suite ; `&phase=2` : le golem à 50 % de vie ; `&monstres=30` : l'arène garde 30 monstres en vie ;
//   · `?debug&tune` : le panneau des sensations ; `&reglages=<JSON>` : des réglages collés (ceux que le panneau exporte) ;
//   · `?debug&fps` : l'affichage des images par seconde et des appels de dessin.
// Une partie d'essai n'est JAMAIS classée (`classable` de la définition) ; la rediffusion d'un scénario nomme le scénario et le serveur la refuse.
export interface Essai {
  scenario: Scenario | null;
  phase2: boolean;
  monstres: number;
  tune: boolean;
  fps: boolean;
  /** Les réglages de la simulation collés dans l'adresse, ou `null` (ceux de la partie classée). */
  reglages: Reglages | null;
  /** Les sensations collées dans l'adresse (JSON brut), ou `null`. */
  sensations: unknown;
  /** Vrai dès qu'une option d'essai change la partie : elle n'est alors pas classable. */
  essai: boolean;
}

export function lireEssai(search: string, restreint: boolean): Essai {
  const vide: Essai = { scenario: null, phase2: false, monstres: 0, tune: false, fps: false, reglages: null, sensations: null, essai: false };
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
  return {
    scenario,
    phase2: q.get("phase") === "2",
    monstres: Number.isInteger(monstres) && monstres > 0 ? Math.min(40, monstres) : 0,
    tune: debug && q.has("tune"),
    fps: debug && q.has("fps"),
    reglages,
    sensations,
    essai: scenario !== null || (debug && q.has("tune")) || reglages !== null,
  };
}
