import type { KeyValueStore, Langue } from "@cdj/profile";
import { el } from "@cdj/ui";
import type { TraducteurCloche } from "./clocheLignes";
import { compteDuFronton, pictogramme, type ItemNav } from "./salle";

// Lot U2 (charte rév. 19, § 9) — les pièces de présentation de `/classement/` : le fronton d'une page (titre, date, compte à rebours), la cloche de la barre. Lot U6 : le podium et les lignes sont le composant commun de `@cdj/ui` (`classement.ts`). Des fonctions pures : elles reçoivent des
// textes déjà traduits et des lignes déjà prêtes, et ne lisent ni le serveur ni le stockage. Feuille : `classementSalle.css`.

/** Les quatre onglets de la navigation, textes déjà traduits. */
export const itemsDeNavigation = (dire: (cle: "portail.nav.aujourdhui" | "portail.nav.classements" | "portail.nav.amis" | "portail.nav.amis.court" | "portail.nav.profil") => string): ItemNav[] => [
  { id: "aujourdhui", texte: dire("portail.nav.aujourdhui"), court: dire("portail.nav.aujourdhui") },
  { id: "classements", texte: dire("portail.nav.classements"), court: dire("portail.nav.classements") },
  { id: "amis", texte: dire("portail.nav.amis"), court: dire("portail.nav.amis.court") },
  { id: "profil", texte: dire("portail.nav.profil"), court: dire("portail.nav.profil") },
];

/** Le fronton d'une page de la salle : le titre en grand (moutarde, ombre terre), la date et le numéro de la journée dessous, le compte à rebours à droite. */
export function frontonDePage(o: { titre: string; date: string; journee: string | null; legende: string; compte: string; embleme?: HTMLElement }): HTMLElement {
  return el(
    "section",
    { classe: ["salle-fronton classement-fronton", o.embleme && "classement-fronton--embleme"] },
    el(
      "div",
      { classe: "salle-fronton__dedans" },
      o.embleme ?? null,
      el(
        "div",
        { classe: "salle-fronton__titre" },
        el("h1", { classe: "classement-fronton__titre", texte: o.titre }),
        el("p", { classe: "salle-fronton__date classement-fronton__date", attrs: { id: "date" }, texte: o.date }),
        o.journee ? el("span", { classe: "salle-fronton__journee", attrs: { id: "journee" }, texte: o.journee }) : null,
      ),
      compteDuFronton({ legende: o.legende, valeur: o.compte }),
    ),
  );
}

/**
 * Lot U4 — ce que la feuille de la cloche a besoin de savoir de la page qui l'ouvre (`clochePage.ts`, chargée à la demande) : le traducteur de la page, sa langue, le stockage du navigateur (le repère « nouveauté
 * lue », la copie de l'accueil), l'identité de l'appareil (une lecture à l'ouverture seulement) et le chemin vers la racine du portail.
 */
export interface ContexteCloche {
  t: TraducteurCloche;
  langue: Langue;
  stockage: KeyValueStore | null;
  /** L'identifiant de l'appareil, `null` sans profil. */
  identifiant: () => string | null;
  /** `"../"` depuis `/classement/`, `/amis/`, `/profil/`. */
  racine: string;
}

/** La feuille est-elle ouverte ? Les pages redessinent leur barre à chaque changement : l'état vit ici (et non dans le bouton), la barre neuve la rouvre. */
export const etatCloche = { ouverte: false };

/**
 * La cloche de la barre sur `/classement/`, « Amis et groupes » et « Profil » (lot U4) : **un bouton qui ouvre la même feuille que sur l'accueil** (dernière nouveauté, réponses non lues), avec le point terre quand
 * quelque chose n'est pas lu (d'après la copie de l'accueil du navigateur). La feuille est **chargée à la demande** (`clochePage.ts`, au premier toucher) et ne demande rien au serveur avant : à l'ouverture, elle
 * montre la copie de l'accueil tout de suite, puis relit `GET /api/portail/jour` une fois. Écran du menu à la manette comme sur l'accueil (`ECRAN_CLOCHE`).
 */
export function clocheDePage(o: { nom: string; nonLu: boolean; contexte: ContexteCloche }): HTMLElement {
  const bouton = el("button", { classe: "salle-cloche__bouton", attrs: { type: "button", "aria-expanded": "false", "aria-controls": "salle-feuille", "aria-haspopup": "dialog", "aria-label": o.nom, id: "cloche", "data-cle": "cloche" } }, pictogramme("cloche", 22));
  const racine = el("div", { classe: "salle-cloche" }, bouton, o.nonLu ? el("span", { classe: "salle-cloche__point", attrs: { "aria-hidden": "true", id: "cloche-point" } }) : null);
  const afficher = (deplacerLeFocus: boolean) => void import("./clochePage").then((m) => m.afficher(racine, o.contexte, deplacerLeFocus));
  bouton.addEventListener("click", () => {
    etatCloche.ouverte = !etatCloche.ouverte;
    afficher(true);
  });
  if (etatCloche.ouverte) afficher(false); // la page s'est redessinée pendant que la feuille était ouverte
  return racine;
}
