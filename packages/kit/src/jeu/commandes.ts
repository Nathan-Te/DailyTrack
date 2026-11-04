import { Commandes, type ActionCommande } from "@cdj/ui/src/commandes";
import type { I18n } from "./i18n";
import type { DefinitionJeu, FicheClient } from "./types";

// Lot K4f (règle M2 de la plateforme) — les commandes réglables d'un jeu neuf. **Le jeu ne lit jamais une touche en dur** : il déclare ses actions (`DefinitionJeu.actions`) et le kit ajoute les trois qui sont
// à tous (`pause`, `recommencer`, `fantome`). La correspondance touche → action se fait avant tout : la rediffusion ne dépend jamais des touches choisies. Échap et Start (pause) sont fixes. Les touches sont
// des `event.code` ; une instance par jeu (clé de stockage `cdj:commandes:<id>`).
export const ACTIONS_KIT: readonly ActionCommande[] = [
  { id: "pause", clavier: ["KeyP"], manette: null },
  { id: "recommencer", clavier: ["Enter"], manette: "b2" },
  { id: "fantome", clavier: ["KeyG"], manette: "b3" },
];

const memoire = new Map<string, Commandes>();

export function commandesDuJeu<C>(fiche: FicheClient, def: DefinitionJeu<C>, i18n: I18n): Commandes {
  let c = memoire.get(fiche.id);
  if (!c) {
    c = new Commandes(fiche.id, [...def.actions, ...ACTIONS_KIT]);
    memoire.set(fiche.id, c);
    const commandes = c;
    // Les aides citent les touches choisies (`{pause}`, `{m_pause}`…).
    i18n.parametresCommuns(() => commandes.parametres(i18n.langue));
  }
  return c;
}

/** La clé de catalogue qui nomme une action : celles du kit sont `kit.commandes.action.<id>`, celles du jeu `commandes.action.<id>`. */
export const cleAction = (id: string): string => (ACTIONS_KIT.some((a) => a.id === id) ? `kit.commandes.action.${id}` : `commandes.action.${id}`);
