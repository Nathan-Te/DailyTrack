import { estOngletPerime } from "@cdj/profile";
import { brancherVersion, type OptionsBrancherVersion } from "@cdj/kit/version";
import { GENERATOR_VERSION, SIM_VERSION } from "@cdj/sim";

// Lot D2 — l'onglet périmé de Track, chargé à la demande par `main.ts` (jamais dans le premier chargement) : la version du jeu comparée à celle du serveur (`/api/health`) avant la course, au retour sur
// l'onglet et après un refus `sim_version` / `track_mismatch` ; « Nouvelle version en ligne — recharger », **jamais pendant une course** : `body.en-course` (`syncCalqueHud` de `main.ts`) vaut vrai du
// décompte à l'arrivée, hors pause, accueil et fenêtres. **Ce fichier n'importe rien du jeu** (ni `api`, ni `i18n`, ni `access`, hors les deux numéros de version de la simulation) : ce qui sinon se détacherait du premier chargement en fichiers de plus
// (octets, comme `annonceUi.ts`) ; `main.ts` lui donne ce qu'il a déjà en mémoire.

let demarrage: ReturnType<typeof brancherVersion> | null = null;

/** Démarre la comparaison (une seule fois). `restreint` : la construction de production (`isRestricted`) ferme `?debug&simuler=`. */
export function demarrer(o: Pick<OptionsBrancherVersion, "base"> & { restreint: boolean }): void {
  const q = new URLSearchParams(location.search);
  const demande = q.get("simuler");
  demarrage ??= brancherVersion({ ...o, locales: { simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION }, simuler: !o.restreint && q.has("debug") && (demande === "lent" || demande === "perime") ? demande : null, chemin: "/api/health", langue: () => (document.documentElement.lang.startsWith("en") ? "en" : "fr"), enPartie: () => document.body.classList.contains("en-course") });
}

/** Un refus du serveur à l'envoi : un des trois codes de l'onglet périmé allume le bandeau. */
export const noterRefus = (code: string | undefined): void => void (estOngletPerime(code) && demarrage?.then((v) => v?.noterRefus(code ?? "")));
