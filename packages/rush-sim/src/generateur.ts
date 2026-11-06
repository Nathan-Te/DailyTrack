import { mixSeed } from "@cdj/core";
import { RUSH_GENERATOR_VERSION, SCENARIOS, type Scenario } from "./constantes";
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
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Sel de la graine de Rush (propre au jeu). */
const SEL = 0x3f91d3;

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme (ici : une seule, la 1 du prototype n'a jamais été servie : jeu `off`, aucun jour figé). */
export function dailyRush(jour: number, version: number = RUSH_GENERATOR_VERSION): Contenu {
  if (version !== 2) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  const graine = mixSeed(jour, SEL);
  return { jour, g: version, scenario: "jour", phase2: false, graine, monstres: 0, niveau: genererNiveau(graine), theme: themeDuJour(jour) };
}

/** Un scénario d'essai (jamais classé). La graine est fixe : un scénario se rejoue à l'identique. */
export function contenuScenario(scenario: Scenario, o: { phase2?: boolean; monstres?: number; jour?: number } = {}): Contenu {
  const jour = o.jour ?? 0;
  return { jour, g: RUSH_GENERATOR_VERSION, scenario, phase2: o.phase2 === true, graine: mixSeed(jour + 77, SEL), monstres: Math.max(0, Math.min(40, Math.trunc(o.monstres ?? 0))), niveau: null, theme: themeDuJour(jour) };
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, SCENARIOS.indexOf(contenu.scenario), contenu.phase2 ? 1 : 0, contenu.graine, contenu.monstres, contenu.niveau ? contenu.niveau.empreinte : 0]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
    octet(n >>> 24);
  }
  return h.toString(16).padStart(8, "0");
}
