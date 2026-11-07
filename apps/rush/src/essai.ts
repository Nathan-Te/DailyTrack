import { parseDay } from "@cdj/core";
import { SCENARIOS, type Scenario } from "@cdj/rush-sim/constantes";

// Les options d'ESSAI de Rush, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9) :
//   · `?scenario=arene|boss` : l'arène sans fin (des vagues de gelées et de chauves-souris) ou le boss tout de suite (le golem ; lot BR3 : `&boss=golem|reine|grand-duc|belier|chene` choisit lequel des cinq) ; `&phase=2` : le boss à 50 % de vie ; `&monstres=30` : l'arène garde 30 monstres en vie ;
//   · `?scenario=bestiaire` (lot BR3) : les CINQ boss côte à côte, figés, sur le sol du thème (`&theme=prairie|carriere|sousbois`), leur nom dessous, la caméra fixe à la même échelle : de quoi juger silhouettes et contrastes ; `?scenario=carte&jours=14` écrit aussi le boss de chaque jour ;
//   · `?debug&tune` : le panneau des sensations ; `&reglages=<JSON>` : des réglages collés (ceux que le panneau exporte) ;
//   · `?debug&fps` : l'affichage des images par seconde et des appels de dessin ;
//   · `?scenario=jour&jour=AAAA-MM-JJ` (lot BR1) : le niveau d'un autre jour ; `?scenario=carte&jours=7` : la vue de dessus des 7 prochains jours (chemin, détours, camps, arène, pilote) ;
//   · `?scenario=mannequin` (lot BR0c) : six gelées immobiles qui ne meurent pas et un golem qui ne frappe pas, pour juger le coup ; `?scenario=vitrine` : la composition de la cible, figée ;
//   · `?scenario=cartes` (lot BR2) : l'écran de choix d'une amélioration s'ouvre tout de suite (`&nv=5` : le tirage de ce niveau-là pour le jour) ; `&ameliorations=tourbillon,lame-lourde` (un identifiant répété les cumule) donne ces améliorations au départ
//     de n'importe quel scénario (`mannequin`, `boss`, `jour`…), pour sentir une amélioration ou une construction ; `?scenario=carte&jours=7` ajoute, pour chaque jour, la stratégie la plus rapide et l'écart avec les deux autres ;
//   · `?qualite=haute|basse` (lot BR0c) : le niveau de rendu (haute : ombres portées, contour et bloom en post-traitement ; basse : ombres en disques, contour par coque). Sans le paramètre, haute avec un passage automatique en basse si les images par seconde chutent.
// Une partie d'essai n'est JAMAIS classée (`classable` de la définition) ; la rediffusion d'un scénario nomme le scénario et le serveur la refuse.
export interface Essai {
  scenario: Scenario | null;
  /** Lot BR1 : `&jour=AAAA-MM-JJ` joue le niveau d'un autre jour (numéro de jour civil), ou `null`. */
  jour: number | null;
  /** Lot BR1 : `?scenario=carte&jours=7` : la vue de dessus des N prochains jours (le nombre de jours), ou `null`. */
  carte: number | null;
  phase2: boolean;
  /** Lot BR3 : `&boss=<identifiant>` du scénario `boss` (l'indice est cherché à la demande : `indiceBoss`, dans le corps du jeu), ou `null` (le golem). */
  boss: string | null;
  monstres: number;
  tune: boolean;
  fps: boolean;
  /** Le niveau de rendu imposé par l'adresse, ou `null` (haute, avec le passage automatique en basse). */
  qualite: "haute" | "basse" | null;
  /** Les réglages de la simulation collés dans l'adresse (le JSON lu, non vérifié : `reglagesDe` du corps du jeu le fait, à la demande — ce fichier est dans le premier chargement), ou `null` (ceux de la partie classée). */
  reglages: unknown;
  /** Lot BR2 : `&ameliorations=` — les identifiants des améliorations données au départ (validés par la simulation). */
  ameliorations: string[];
  /** Lot BR2 : `&nv=` — le niveau du choix du scénario `cartes` (2 par défaut). */
  nv: number;
  /** Les sensations collées dans l'adresse (JSON brut), ou `null`. */
  sensations: unknown;
  /** Vrai dès qu'une option d'essai change la partie : elle n'est alors pas classable. */
  essai: boolean;
}

export function lireEssai(search: string, restreint: boolean): Essai {
  const vide: Essai = { scenario: null, jour: null, carte: null, phase2: false, boss: null, monstres: 0, tune: false, fps: false, qualite: null, reglages: null, ameliorations: [], nv: 2, sensations: null, essai: false };
  if (restreint) return vide;
  const q = new URLSearchParams(search);
  const nom = q.get("scenario") ?? "";
  const scenario = (SCENARIOS as readonly string[]).includes(nom) ? (nom as Scenario) : null;
  const debug = q.has("debug");
  const jourBrut = q.get("jour");
  const jour = jourBrut ? parseDay(jourBrut) : null;
  const carte = nom === "carte" ? Math.min(14, Math.max(1, Math.trunc(Number(q.get("jours"))) || 7)) : null;
  let reglages: unknown = null;
  let sensations: unknown = null;
  const brut = q.get("reglages");
  if (brut) {
    try {
      const j = JSON.parse(brut) as { reglages?: unknown; sensations?: unknown };
      reglages = j.reglages ?? j;
      sensations = j.sensations ?? null;
    } catch {
      /* un JSON abîmé : les réglages par défaut */
    }
  }
  const monstres = Number(q.get("monstres"));
  const nivQ = q.get("qualite");
  const ameliorations = (q.get("ameliorations") ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "");
  const nv = Math.trunc(Number(q.get("nv")));
  return {
    scenario,
    jour,
    carte,
    phase2: q.get("phase") === "2",
    boss: q.get("boss"),
    monstres: Number.isInteger(monstres) && monstres > 0 ? Math.min(40, monstres) : 0,
    tune: debug && q.has("tune"),
    fps: debug && q.has("fps"),
    qualite: nivQ === "haute" || nivQ === "basse" ? nivQ : null,
    reglages,
    ameliorations,
    nv: nv >= 2 ? nv : 2,
    sensations,
    essai: scenario !== null || ameliorations.length > 0 || jour !== null || carte !== null || (debug && q.has("tune")) || reglages !== null,
  };
}
