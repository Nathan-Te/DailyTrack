import "./annonce.css";
import { surveillerAnnonce, texteDeAnnonce, type Annonce } from "@cdj/profile";
import { BANDEAU_IMPORTANT_MS, bandeauAnnonce, visibiliteDeLaPage } from "@cdj/ui";
import { creerPilote, type PiloteAnnonce } from "./annonceTrack";
import type { EcranAnnonce } from "./annonceEcran";
import type { Langue } from "@cdj/profile";
import type { TraducteurCommun } from "@cdj/ui";

// Lot N2 — le bandeau du message en direct de Track (DOM). Chargé **à la demande** (`import("./annonceUi")` de `main.ts`) : ni ce fichier, ni sa feuille, ni la surveillance ne sont
// dans le premier chargement. Le bandeau est celui du socle (`bandeauAnnonce`, `role="status"` : jamais de focus pris), habillé aux couleurs de Track par `annonce.css`.
// Accueil et arrivée : entre la barre des jeux et l'étiquette (le corps de l'étiquette défile dessous) ; pause : en tête du dialogue. Le texte est une donnée : `textContent`, jamais du HTML.

const HOTES: Record<EcranAnnonce, { racine: string; avant: string }> = {
  accueil: { racine: "#home", avant: ".cadre__defile" },
  arrivee: { racine: "#finish", avant: ".cadre__defile" },
  pause: { racine: "#pause .dialogue", avant: ".dialogue__corps" },
};

/** Ce que le jeu donne (il l'a déjà en mémoire : ce fichier n'importe ni `api`, ni `i18n`, ni `storage`, qui sinon se détacheraient du premier chargement en fichiers de plus : octets). */
export interface DepsAnnonceUi {
  /** Le préfixe de l'API de la page (`apiBase()`, jamais nul ici : `annonceAutorisee`). */
  base: string;
  stockage: Pick<Storage, "getItem" | "setItem">;
  langue: () => Langue;
  surLangue: (rappel: () => void) => unknown;
  traducteur: () => TraducteurCommun;
}
let deps: DepsAnnonceUi;
let bande: HTMLElement | null = null;
let pose: { id: number; ecran: EcranAnnonce } | null = null;
/** L'instant où chaque message est apparu : « Important » ne se ferme qu'après 10 s **de présence**, pas 10 s à chaque écran. */
const vuLe = new Map<number, number>();

function poser(ecran: EcranAnnonce | null, a: Annonce | null, fermer: () => void): void {
  if (!ecran || !a) {
    bande?.remove();
    bande = null;
    pose = null;
    return;
  }
  const texte = texteDeAnnonce(a, deps.langue());
  if (bande?.isConnected && pose?.id === a.id && pose.ecran === ecran) {
    const p = bande.querySelector(".dj-bandeau__texte");
    if (p && p.textContent !== texte) p.textContent = texte; // la langue a changé : même bandeau, nouveau texte
    return;
  }
  bande?.remove();
  const h = HOTES[ecran];
  const racine = document.querySelector(h.racine);
  const avant = racine?.querySelector(h.avant);
  if (!racine || !avant) return;
  if (!vuLe.has(a.id)) vuLe.set(a.id, Date.now());
  const reste = Math.max(0, BANDEAU_IMPORTANT_MS - (Date.now() - vuLe.get(a.id)!));
  bande = bandeauAnnonce(deps.traducteur(), { texte, ton: a.ton, onFermer: fermer, classe: "annonce-track", fermableApresMs: a.ton === "important" ? reste : 0 });
  pose = { id: a.id, ecran };
  avant.before(bande);
}

/** Démarre la surveillance du message pour Track (`ou: "track"`). L'appelant a déjà vérifié `annonceAutorisee`. */
export function demarrerAnnonce(d: DepsAnnonceUi): PiloteAnnonce {
  deps = d;
  const vis = visibiliteDeLaPage();
  const pilote = creerPilote({
    surveiller: (surChangement) => surveillerAnnonce({ base: d.base, ou: "track", surChangement, stockage: d.stockage, visible: vis.visible, surVisibilite: vis.surVisibilite }),
    poser,
  });
  d.surLangue(() => pilote.actualiser());
  return pilote;
}
