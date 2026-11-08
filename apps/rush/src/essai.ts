import { parseDay } from "@cdj/core";
import { DUREE_TICKS, SCENARIOS, TICKS_PAR_SECONDE, type Scenario } from "@cdj/rush-sim/constantes";

// Les options d'ESSAI de Rush, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9) :
//   · `?scenario=arene|boss` : l'arène sans fin (des vagues de gelées et de chauves-souris) ou le boss tout de suite (le golem ; lot BR3 : `&boss=golem|reine|grand-duc|belier|chene` choisit lequel des cinq) ; `&phase=2` : le boss à 50 % de vie ; `&monstres=30` : l'arène garde 30 monstres en vie ;
//   · `?scenario=bestiaire` (lot BR3) : les CINQ boss côte à côte, figés, sur le sol du thème (`&theme=prairie|carriere|sousbois`), leur nom dessous, la caméra fixe à la même échelle : de quoi juger silhouettes et contrastes ; `?scenario=carte&jours=14` écrit aussi le boss de chaque jour ;
//   · `&competence=tourbillon|bond|bouclier` (lot BR5) : la compétence donnée au départ de `mannequin`, `boss`, `horde` (et de `jour`, sans l'écran de choix) ; `?scenario=horde` : 30 gélatons, 10 gelées et des groupes de vases, qui reviennent quand ils sont fauchés ; `&monstres=60` : jusqu'à 80 ;
//   · `?debug&tune` : le panneau des sensations ; `&reglages=<JSON>` : des réglages collés (ceux que le panneau exporte) ;
//   · `?debug&fps` : l'affichage des images par seconde et des appels de dessin ;
//   · `?scenario=jour&jour=AAAA-MM-JJ` (lot BR1) : le niveau d'un autre jour ; `?scenario=carte&jours=7` : la vue de dessus des 7 prochains jours (chemin, détours, camps, arène, pilote) ;
//   · `?scenario=mannequin` (lot BR0c) : six gelées immobiles qui ne meurent pas et un golem qui ne frappe pas, pour juger le coup ; `?scenario=vitrine` : la composition de la cible, figée ;
//   · `?scenario=cartes` (lot BR2) : l'écran de choix d'une amélioration s'ouvre tout de suite (`&nv=5` : le tirage de ce niveau-là pour le jour) ; `&ameliorations=tourbillon,lame-lourde` (un identifiant répété les cumule) donne ces améliorations au départ
//     de n'importe quel scénario (`mannequin`, `boss`, `jour`…), pour sentir une amélioration ou une construction ; `?scenario=carte&jours=7` ajoute, pour chaque jour, la stratégie la plus rapide et l'écart avec les deux autres ;
//   · `?scenario=jour&fantome=1` (lot BR4) : le jour complet contre le FANTÔME du Diamant (la partie de la meilleure des trois stratégies du pilote, ses cartes comprises), dès le départ ;
//   · `?scenario=medailles&jours=7` (lot BR4) : par jour, le boss, le thème, les temps des trois stratégies du pilote, la stratégie du Diamant, les quatre seuils et les temps du pilote humanisé ;
//   · `?scenario=fin&temps=65000` (lot BR4) : l'écran de fin, tout de suite, à ce temps (en millisecondes) sur le niveau du jour (`&jour=`) : pour le juger sans jouer ;
//   · `?qualite=haute|basse` (lot BR0c) : le niveau de rendu (haute : ombres portées, contour et bloom en post-traitement ; basse : ombres en disques, contour par coque). Sans le paramètre, haute avec un passage automatique en basse si les images par seconde chutent.
//   · `?scenario=bestiaire-monstres` (lot BR6) : les sept monstres et un élite de chaque, figés, côte à côte (`&theme=`) ; `?scenario=camp&ennemis=cracheur,chaman,porte-bouclier,totem` : un camp composé à la main (`&elite=1` : l'un d'eux est un élite, `&competence=`) ; `?scenario=epreuve` : directement la salle d'épreuve du jour ;
// Une partie d'essai n'est JAMAIS classée (`classable` de la définition) ; la rediffusion d'un scénario nomme le scénario et le serveur la refuse.
export interface Essai {
  scenario: Scenario | null;
  /** Lot BR1 : `&jour=AAAA-MM-JJ` joue le niveau d'un autre jour (numéro de jour civil), ou `null`. */
  jour: number | null;
  /** Lot BR1 : `?scenario=carte&jours=7` : la vue de dessus des N prochains jours (le nombre de jours), ou `null`. */
  carte: number | null;
  /** Lot BR4 : `?scenario=medailles&jours=7` : le tableau des médailles des N prochains jours (le nombre de jours), ou `null`. */
  medailles: number | null;
  /** Lot BR4 : `?scenario=fin&temps=65000` : l'écran de fin à ce temps (en ticks, converti de la valeur en millisecondes de l'adresse), ou `null`. */
  fin: number | null;
  /** Lot BR4 : `&fantome=1` — le fantôme du Diamant dès le départ (le jour joué est celui du jour). */
  fantome: boolean;
  phase2: boolean;
  /** Lot BR3 : `&boss=<identifiant>` du scénario `boss` (l'indice est cherché à la demande : `indiceBoss`, dans le corps du jeu), ou `null` (le golem). */
  boss: string | null;
  /** Lot BR5 : `&competence=` — l'identifiant de la compétence donnée au départ (l'indice est cherché par `indiceCompetence`), ou `null`. */
  competence: string | null;
  monstres: number;
  /** Lot BR6 : `&ennemis=cracheur,chaman` du scénario `camp` (identifiants bruts, validés par la simulation) et `&elite=1`. */
  ennemis: string[];
  elite: boolean;
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
  const vide: Essai = { scenario: null, jour: null, carte: null, medailles: null, fin: null, fantome: false, phase2: false, boss: null, competence: null, monstres: 0, ennemis: [], elite: false, tune: false, fps: false, qualite: null, reglages: null, ameliorations: [], nv: 2, sensations: null, essai: false };
  if (restreint) return vide;
  const q = new URLSearchParams(search);
  const nom = q.get("scenario") ?? "";
  const scenario = (SCENARIOS as readonly string[]).includes(nom) ? (nom as Scenario) : null;
  const debug = q.has("debug");
  const jourBrut = q.get("jour");
  const jour = jourBrut ? parseDay(jourBrut) : null;
  const carte = nom === "carte" ? Math.min(14, Math.max(1, Math.trunc(Number(q.get("jours"))) || 7)) : null;
  const medailles = nom === "medailles" ? Math.min(14, Math.max(1, Math.trunc(Number(q.get("jours"))) || 7)) : null;
  // `temps` en millisecondes dans l'adresse (65000 = 1:05) ; la simulation compte en ticks (60 par seconde), jamais moins d'une seconde ni plus de dix minutes.
  const tempsMs = Math.trunc(Number(q.get("temps")));
  const fin = nom === "fin" ? Math.min(DUREE_TICKS, Math.max(TICKS_PAR_SECONDE, Math.round(((Number.isFinite(tempsMs) && tempsMs > 0 ? tempsMs : 65000) * TICKS_PAR_SECONDE) / 1000))) : null;
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
    medailles,
    fin,
    fantome: q.get("fantome") === "1",
    phase2: q.get("phase") === "2",
    boss: q.get("boss"),
    competence: q.get("competence"),
    monstres: Number.isInteger(monstres) && monstres > 0 ? Math.min(80, monstres) : 0,
    ennemis: (q.get("ennemis") ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "").slice(0, 8),
    elite: q.get("elite") === "1",
    tune: debug && q.has("tune"),
    fps: debug && q.has("fps"),
    qualite: nivQ === "haute" || nivQ === "basse" ? nivQ : null,
    reglages,
    ameliorations,
    nv: nv >= 2 ? nv : 2,
    sensations,
    essai: scenario !== null || q.has("competence") || ameliorations.length > 0 || jour !== null || carte !== null || medailles !== null || fin !== null || q.get("fantome") === "1" || (debug && q.has("tune")) || reglages !== null,
  };
}
