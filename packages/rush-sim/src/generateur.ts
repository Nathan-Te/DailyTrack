import { mixSeed } from "@cdj/core";
import { RUSH_GENERATOR_VERSION, SCENARIOS, type Scenario } from "./constantes";
import { ameliorationsDe, indiceAmelioration } from "./ameliorations";
import { genererNiveau, type Niveau } from "./niveau";
import { themeDuJour, type ThemeRush } from "./themes";

// Le contenu d'une partie. **Lot BR1** : le « jour » est un NIVEAU (une grille de collision, une suite de clairières, le chemin principal jusqu'à l'arène du golem, des détours vers des camps de monstres), tiré de la graine du jour ;
// son thème (palette, décor) vient du numéro de jour. Les scénarios d'essai (`?scenario=`) sont des contenus aussi, sans niveau : l'arène seule, comme au prototype ; ils ne sont jamais classés.
// **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge.


export interface Contenu {
  jour: number;
  g: number;
  scenario: Scenario;
  /** Le golem commence à 50 % de vie, déjà en phase 2 (`?scenario=boss&phase=2`). */
  phase2: boolean;
  /** La graine du hasard de la partie (apparitions, pierres). */
  graine: number;
  /** Le nombre de monstres que l'arène garde vivants (0 : la valeur du scénario). */
  monstres: number;
  /** Le niveau du jour (lot BR1), ou `null` pour un scénario d'essai (l'arène seule). */
  niveau: Niveau | null;
  /** Le thème visuel du jour. */
  theme: ThemeRush;
  /** Lot BR2 — scénarios d'essai seulement (jamais classés) : les améliorations déjà prises (`&ameliorations=tourbillon,lame-lourde` ; un identifiant répété les cumule). Le jour n'en a jamais. */
  ameliorations: string[];
  /** Lot BR2 — `?scenario=cartes&nv=5` : le niveau dont le choix est ouvert tout de suite (2 par défaut) ; 0 hors de ce scénario. */
  nv: number;
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Sel de la graine de Rush (propre au jeu). */
const SEL = 0x3f91d3;

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme (ici : une seule — les 1 à 3 n'ont jamais été servies : jeu `off`, aucun jour figé). */
export function dailyRush(jour: number, version: number = RUSH_GENERATOR_VERSION): Contenu {
  if (version !== 4) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  const graine = mixSeed(jour, SEL);
  return { jour, g: version, scenario: "jour", phase2: false, graine, monstres: 0, niveau: genererNiveau(graine), theme: themeDuJour(jour), ameliorations: [], nv: 0 };
}

/** Un scénario d'essai (jamais classé). La graine est fixe : un scénario se rejoue à l'identique. */
export function contenuScenario(scenario: Scenario, o: { phase2?: boolean; monstres?: number; jour?: number; ameliorations?: readonly string[]; nv?: number } = {}): Contenu {
  const jour = o.jour ?? 0;
  const ameliorations = ameliorationsDe(o.ameliorations ?? []);
  // Lot BR2 : le scénario `cartes` est le niveau du jour (la graine du jour tire les cartes) avec un choix déjà ouvert au niveau `nv`.
  if (scenario === "cartes") {
    const c = dailyRush(jour);
    return { ...c, scenario, ameliorations, nv: Math.max(2, Math.min(30, Math.trunc(o.nv ?? 2))) };
  }
  return { jour, g: RUSH_GENERATOR_VERSION, scenario, phase2: o.phase2 === true, graine: mixSeed(jour + 77, SEL), monstres: Math.max(0, Math.min(40, Math.trunc(o.monstres ?? 0))), niveau: null, theme: themeDuJour(jour), ameliorations, nv: 0 };
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  // Lot BR2 : les améliorations et le niveau d'un scénario n'entrent dans l'empreinte que s'il y en a (l'empreinte d'un jour du jeu ne change pas).
  const extra = contenu.ameliorations.length > 0 || contenu.nv > 0 ? [contenu.nv, ...contenu.ameliorations.map((id) => indiceAmelioration(id) + 1)] : [];
  for (const n of [contenu.jour, contenu.g, SCENARIOS.indexOf(contenu.scenario), contenu.phase2 ? 1 : 0, contenu.graine, contenu.monstres, contenu.niveau ? contenu.niveau.empreinte : 0, ...extra]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
    octet(n >>> 24);
  }
  return h.toString(16).padStart(8, "0");
}
