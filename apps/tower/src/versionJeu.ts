import { brancherVersion, type Version } from "@cdj/kit/version";
import { TOWER_GENERATOR_VERSION, TOWER_SIM_VERSION } from "@cdj/tower-sim";
import type { Envoi } from "./envoi";
import { langueCourante } from "./i18n";

// Lot D2 — l'onglet périmé de Tower, chargé à la demande par l'accueil (jamais dans le premier chargement) : la version du jeu comparée à celle du serveur (`/api/tower/info`) avant la partie, au retour
// sur l'onglet et après un refus `version` de l'envoi ; « Nouvelle version en ligne — recharger », **jamais pendant une partie**. Une partie tourne quand la scène existe et que ni la pause ni
// l'arrivée ne sont ouvertes (les voiles `#pause-ecran` et `#fin-ecran`) : lu dans la page, pour ne rien ajouter au premier chargement.

const enPartie = (): boolean => document.querySelector(".tower__scene") !== null && document.querySelector("#pause-ecran:not([hidden]), #fin-ecran:not([hidden])") === null;

export function monterVersionTower(o: { base: string | null; simuler: "lent" | "perime" | null; envoi: Envoi }): Promise<Version | null> {
  const v = brancherVersion({
    base: o.base,
    chemin: "/api/tower/info",
    simuler: o.simuler,
    locales: { simVersion: TOWER_SIM_VERSION, generatorVersion: TOWER_GENERATOR_VERSION },
    enPartie,
    langue: langueCourante,
  });
  o.envoi.surRefus = (code) => void v.then((x) => x?.noterRefus(code));
  return v;
}
