import { brancherVersion, type Version } from "../version";
import type { Donnees } from "./donnees";
import type { I18n } from "./i18n";
import type { OptionsUrl } from "./session";
import type { DefinitionJeu, FicheClient } from "./types";

// Lot D2 — l'onglet périmé : la version du jeu comparée à celle du serveur (`/api/<id>/info`) avant la partie, au retour sur l'onglet et après un refus `version` de l'envoi ; « Nouvelle version en ligne —
// recharger », **jamais pendant une partie** (aucun voile du jeu ouvert et la scène présente = une partie). À la demande.
const enPartie = (): boolean => document.querySelector(".jeu-scene") !== null && document.querySelector("#jeu-pause:not([hidden]), #jeu-fin:not([hidden])") === null;

export function monterVersion<C>(fiche: FicheClient, def: DefinitionJeu<C>, d: Donnees, options: OptionsUrl, i18n: I18n): Promise<Version | null> {
  const v = brancherVersion({ base: d.base, chemin: `/api/${fiche.id}/info`, simuler: options.simuler, locales: def.versions, enPartie, langue: () => i18n.langue });
  d.envoi.surRefus = (code: string) => void v.then((x) => x?.noterRefus(code));
  return v;
}
