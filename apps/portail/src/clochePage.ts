import { parisDay } from "@cdj/clock";
import { etatCloche, type ContexteCloche } from "./classementSalle";
import { jourGarde } from "./cacheJour";
import { lignesDeCloche } from "./clocheLignes";
import { lireJour, type Jour } from "./jour";
import { feuilleDeCloche } from "./salle";

// Lot U4 — la feuille de la cloche sur `/classement/`, « Amis et groupes » et « Profil » : la **même** que sur l'accueil (dernière nouveauté, réponses non lues de « Mes messages »), **chargée à la demande** (un
// `import()` au premier toucher de la cloche, rien dans le premier chargement des pages) et sans requête de plus au chargement. À l'ouverture : la copie de l'accueil gardée dans le navigateur s'affiche tout de suite,
// puis `GET /api/portail/jour` est relu **une fois par minute au plus** (l'identité de l'appareil dans l'en-tête, comme l'accueil) et la feuille se redessine avec la réponse fraîche. Sans réseau, la copie reste.
// Échap ferme, un toucher ailleurs aussi ; le focus entre dans la feuille à l'ouverture et revient à la cloche à la fermeture. Les lignes sont celles de l'accueil (`clocheLignes.ts`). Écran du menu à la manette.

/** Au plus une relecture du serveur par minute (ouvrir et fermer la cloche ne multiplie pas les requêtes). */
const RELECTURE_MS = 60_000;

let fraiche: { jour: Jour; le: number } | null = null;
let enCours: Promise<void> | null = null;
let ecoute = false;
let contexte: ContexteCloche | null = null;

const racineDeCloche = (): HTMLElement | null => document.querySelector<HTMLElement>(".salle-cloche");

/** Ce que la feuille montre : la réponse fraîche si on l'a, sinon la copie de l'accueil du navigateur. */
function donnees(c: ContexteCloche): Jour | null {
  if (fraiche) return fraiche.jour;
  const maintenant = Date.now();
  return jourGarde(c.stockage, parisDay(maintenant), maintenant, c.identifiant() !== null);
}

/** Dessine (ou retire) la feuille et met le bouton et le point d'accord avec elle. */
function dessiner(racine: HTMLElement, c: ContexteCloche): void {
  const { lignes, point } = lignesDeCloche(c.t, c.langue, c.stockage, donnees(c), c.racine);
  const bouton = racine.querySelector<HTMLElement>("#cloche");
  bouton?.setAttribute("aria-expanded", String(etatCloche.ouverte));
  bouton?.setAttribute("aria-label", c.t.t(point ? "portail.cloche.nonLu" : "portail.cloche.nom"));
  const pastille = racine.querySelector("#cloche-point");
  if (point && !pastille) racine.append(Object.assign(document.createElement("span"), { id: "cloche-point", className: "salle-cloche__point" }));
  else if (!point) pastille?.remove();
  if (point) racine.querySelector("#cloche-point")?.setAttribute("aria-hidden", "true");
  // Redessinée quand la réponse fraîche arrive : si le focus était dans la feuille, il y revient (sur la première ligne, ou la croix).
  const ancienne = racine.querySelector(".salle-feuille");
  const avaitLeFocus = !!ancienne && ancienne.contains(document.activeElement);
  ancienne?.remove();
  if (!etatCloche.ouverte) return;
  racine.append(feuilleDeCloche({ titre: c.t.t("portail.cloche.titre"), fermer: c.t.t("portail.cloche.fermer"), lignes, vide: c.t.t("portail.cloche.vide"), onFermer: () => basculer(false) }));
  if (avaitLeFocus) racine.querySelector<HTMLElement>(".salle-feuille__ligne, .salle-feuille__fermer")?.focus();
}

/** Relit le jour du serveur (une fois par minute au plus) et redessine la feuille si elle est encore ouverte. Ne lève jamais : sans réponse, la copie reste. */
function relire(c: ContexteCloche): void {
  if (enCours || (fraiche && Date.now() - fraiche.le < RELECTURE_MS)) return;
  const id = c.identifiant();
  enCours = lireJour(fetch, id)
    .then((r) => {
      if (r.jour) fraiche = { jour: r.jour, le: Date.now() };
    })
    .catch(() => undefined)
    .finally(() => {
      enCours = null;
      const racine = racineDeCloche();
      if (racine && contexte && etatCloche.ouverte) dessiner(racine, contexte);
    });
}

function basculer(ouvrir: boolean): void {
  if (ouvrir === etatCloche.ouverte) return;
  etatCloche.ouverte = ouvrir;
  const racine = racineDeCloche();
  if (!racine || !contexte) return;
  dessiner(racine, contexte);
  if (ouvrir) relire(contexte);
  const cible = ouvrir ? document.querySelector<HTMLElement>(".salle-feuille__ligne, .salle-feuille__fermer") : document.getElementById("cloche");
  cible?.focus();
}

/**
 * Appelée par le bouton de la cloche (`deplacerLeFocus`) ou par une page redessinée pendant que la feuille était ouverte (sans toucher au focus) : met la feuille d'accord avec `etatCloche.ouverte`.
 */
export function afficher(racine: HTMLElement, c: ContexteCloche, deplacerLeFocus = true): void {
  const etait = racine.querySelector(".salle-feuille") !== null;
  contexte = c;
  dessiner(racine, c);
  if (!etatCloche.ouverte) {
    if (etait && deplacerLeFocus) document.getElementById("cloche")?.focus();
  } else {
    relire(c);
    if (!etait && deplacerLeFocus) document.querySelector<HTMLElement>(".salle-feuille__ligne, .salle-feuille__fermer")?.focus();
  }
  if (!ecoute) {
    ecoute = true;
    document.addEventListener("keydown", (e) => {
      if (etatCloche.ouverte && e.key === "Escape") basculer(false);
    });
    document.addEventListener("click", (e) => {
      if (etatCloche.ouverte && e.target instanceof Element && !e.target.closest(".salle-cloche")) basculer(false);
    });
  }
}

/** Test : la mémoire du module (la réponse fraîche, le contexte). */
export function oublier(): void {
  fraiche = null;
  enCours = null;
  contexte = null;
}

