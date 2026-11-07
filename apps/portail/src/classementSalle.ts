import { avatar, el, type TraducteurCommun } from "@cdj/ui";
import { compteDuFronton, pictogramme, type ItemNav } from "./salle";
import { photoDePlace } from "./classementPodium";

// Lot U2 (charte rév. 19, § 9) — les pièces de présentation de `/classement/` : le fronton d'une page (titre, date, compte à rebours), la cloche de la barre, le podium. Des fonctions pures : elles reçoivent des
// textes déjà traduits et des lignes déjà prêtes, et ne lisent ni le serveur ni le stockage. Feuille : `classementSalle.css`.

/** Les quatre onglets de la navigation, textes déjà traduits. */
export const itemsDeNavigation = (dire: (cle: "portail.nav.aujourdhui" | "portail.nav.classements" | "portail.nav.amis" | "portail.nav.amis.court" | "portail.nav.profil") => string): ItemNav[] => [
  { id: "aujourdhui", texte: dire("portail.nav.aujourdhui"), court: dire("portail.nav.aujourdhui") },
  { id: "classements", texte: dire("portail.nav.classements"), court: dire("portail.nav.classements") },
  { id: "amis", texte: dire("portail.nav.amis"), court: dire("portail.nav.amis.court") },
  { id: "profil", texte: dire("portail.nav.profil"), court: dire("portail.nav.profil") },
];

/** Le fronton d'une page de la salle : le titre en grand (moutarde, ombre terre), la date et le numéro de la journée dessous, le compte à rebours à droite. */
export function frontonDePage(o: { titre: string; date: string; journee: string | null; legende: string; compte: string }): HTMLElement {
  return el(
    "section",
    { classe: "salle-fronton classement-fronton" },
    el(
      "div",
      { classe: "salle-fronton__dedans" },
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
 * La cloche de la barre sur cette page : **un lien** (vers les nouveautés, ou vers « Mes messages » quand une réponse attend et qu'aucune nouveauté n'est à lire), avec le point terre quand quelque chose n'est pas lu.
 * Elle n'ouvre pas de feuille (celle de l'accueil est un écran du menu à la manette) et ne demande rien au serveur : ce qu'elle sait vient de la copie de l'accueil gardée dans le navigateur.
 */
export function clocheLien(o: { nom: string; nonLu: boolean; href: string }): HTMLElement {
  return el(
    "div",
    { classe: "salle-cloche" },
    el("a", { classe: "salle-cloche__bouton", attrs: { href: o.href, "aria-label": o.nom, id: "cloche", "data-cle": "cloche" } }, pictogramme("cloche", 22)),
    o.nonLu ? el("span", { classe: "salle-cloche__point", attrs: { "aria-hidden": "true", id: "cloche-point" } }) : null,
  );
}

/** Une place du podium, déjà prête (textes traduits, adresse de l'image, valeur formatée). */
export interface PlacePodium {
  rang: number;
  pseudo: string;
  ref?: string;
  image?: string;
  /** Le temps (ou la hauteur, ou les points) de la vue, déjà formaté ; `null` : aucun. */
  valeur: string;
  moi: boolean;
  /** « Toi » (déjà traduit), seulement pour ta place. */
  toi: string | null;
  /** Le rang dit aux lecteurs d'écran (« 1er »). */
  rangLu: string;
  /** L'emblème du groupe (22 px), déjà construit, quand le serveur le dit. */
  embleme: HTMLElement | null;
  /** Toucher la place ouvre la feuille du joueur (jamais la tienne). */
  ouvrir: (() => void) | null;
}

/**
 * Le podium : une liste de trois places **dans l'ordre du classement** (1er, 2e, 3e — l'ordre que lisent les lecteurs d'écran), que la feuille de style range en 2e · 1er · 3e. Chaque place : la photo ronde
 * (112 px pour la première, 92 px pour les deux suivantes), la pastille moutarde de la place posée en bas à droite, le pseudo, le temps et la marche d'encre. `li.classement-ligne` comme une ligne de la liste :
 * mêmes repères pour les tests (`data-rang`, `data-moi`, `.classement-pseudo`, `.classement-rang`).
 */
export function podium(t: TraducteurCommun, places: readonly PlacePodium[]): HTMLElement {
  return el(
    "ol",
    { classe: "classement-podium" },
    ...places.map((p, i) => {
      const corps = [
        el(
          "span",
          { classe: "classement-place__photo" },
          avatar(t, { pseudo: p.pseudo, ref: p.ref, image: p.image, taille: photoDePlace(i + 1), decoratif: true }),
          el("span", { classe: "classement-rang classement-badge", texte: String(p.rang) }),
          el("span", { classe: "dj-cache", texte: p.rangLu }),
        ),
        el("span", { classe: "classement-pseudo" }, p.pseudo, p.embleme, p.toi ? el("span", { classe: "classement-toi", texte: p.toi }) : null),
        el("span", { classe: "classement-temps", texte: p.valeur }),
        el("span", { classe: "classement-marche", attrs: { "aria-hidden": "true" }, texte: String(p.rang) }),
      ];
      const contenu = p.ouvrir
        ? el("button", { classe: "classement-ligne__corps classement-ligne__bouton classement-place__corps", attrs: { type: "button", "aria-haspopup": "dialog", "data-cle": `ligne-${p.ref}` } }, ...corps)
        : el("div", { classe: "classement-ligne__corps classement-place__corps" }, ...corps);
      if (p.ouvrir) contenu.addEventListener("click", p.ouvrir);
      return el(
        "li",
        { classe: ["classement-ligne", "classement-place", `classement-place--${i + 1}`, p.moi && "classement-ligne--moi", p.ouvrir && "classement-ligne--touchable"], attrs: { "data-rang": String(p.rang), ...(p.moi ? { "data-moi": "oui", "aria-current": "true" } : {}) } },
        contenu,
      );
    }),
  );
}
