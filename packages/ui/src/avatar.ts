import type { TraducteurCommun } from "./composants";
import { el } from "./dom";
import type { Langue } from "./i18n";
import { icone } from "./icones";

// L'avatar d'un joueur (lots I1, I2 et C1 partie B) : **un module à part de `composants.ts`**. Les composants chargés à la demande (feuille d'un joueur, listes d'amis, groupes) l'importent ; s'il restait dans
// `composants.ts`, ils le feraient entrer dans le morceau partagé du premier chargement de chaque jeu (mesuré : +370 o pour Track, Jump et Tower).

/** Les initiales d'un pseudo (deux premières lettres ou chiffres, en capitales). */
export function initiales(pseudo: string, langue: Langue): string {
  return [...pseudo.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("").toLocaleUpperCase(langue === "fr" ? "fr-FR" : "en-US");
}

/**
 * L'avatar : les initiales du pseudo s'il y en a un, sinon l'icône profil. Lot I2 : avec `href`, un lien vers le profil commun (cible de 44 px,
 * nommé « Ton profil… ») ; sans, une image (lot I1).
 */
export interface OptionsAvatar {
  pseudo: string | null;
  href?: string;
  nom?: string;
  pastille?: boolean;
  /** Lot C1, partie B : la référence publique du joueur (sa couleur d'initiales en dérive) et l'adresse de son image (absente : les initiales). */
  ref?: string;
  image?: string;
  /** Taille en pixels (charte § 9, révision 19) : 24 (anciennes lignes), 32 (listes), 44 (défaut : barre), 48 (lignes de classement, amis de l'accueil), 52 (membres d'un groupe), 68 · 84 (podium sur téléphone), 88 (cartes d'amis, feuille d'un joueur), 92 · 112 (podium), 96 · 128 (profil). Les tailles de 48 px et plus sont dans `avatar-grand.css` (que l'accueil du portail ne paie pas). */
  taille?: 24 | 32 | 44 | 48 | 52 | 68 | 84 | 88 | 92 | 96 | 112 | 128;
  /** Décoratif (une ligne de classement dit déjà le pseudo) : masqué aux lecteurs d'écran. */
  decoratif?: boolean;
}
/** Les couleurs des initiales sans image (la charte, texte encre) ; l'index vient de la référence publique : stable pour un joueur, jamais son identifiant. */
export const COULEURS_INITIALES = 6;
export const couleurDe = (ref: string | undefined): number => (ref && /^[0-9a-f]{2}/i.test(ref) ? parseInt(ref.slice(0, 2), 16) % COULEURS_INITIALES : 0);

export function avatar(t: TraducteurCommun, o: OptionsAvatar): HTMLElement {
  const ini = o.pseudo ? initiales(o.pseudo, t.langue) : "";
  // Lot C1 : `pastille` (une réponse de l'éditeur attend dans « Mes messages ») ; `nom` : le nom lu, que l'application fournit alors (il dit aussi la réponse qui attend).
  const nom = o.nom ?? (ini ? t.t("profil.avatar", { nom: o.pseudo! }) : t.t(o.href !== undefined ? "profil.ouvrir" : "profil.aucun"));
  // Une image (contrôlée par le serveur) remplace les initiales ; sinon les initiales sur la couleur de la référence publique.
  const contenu = o.image ? el("img", { classe: "dj-avatar__img", attrs: { src: o.image, alt: "", width: o.taille ?? 44, height: o.taille ?? 44, loading: "lazy", decoding: "async" } }) : ini ? el("span", { attrs: { "aria-hidden": "true" }, texte: ini }) : icone("profil", { taille: 22 });
  const classe = ["dj-avatar", !ini && !o.image && "dj-avatar--vide", o.href !== undefined && "dj-avatar--lien", o.taille && o.taille !== 44 && `dj-avatar--t${o.taille}`, ini && !o.image && o.ref && `dj-avatar--c${couleurDe(o.ref)}`];
  if (o.decoratif) return el("span", { classe, attrs: { "aria-hidden": "true" } }, contenu);
  const enfants = o.pastille ? [contenu, el("span", { classe: "dj-avatar__pastille", attrs: { "aria-hidden": "true" } })] : [contenu];
  return o.href !== undefined ? el("a", { classe, attrs: { href: o.href, "aria-label": nom } }, ...enfants) : el("span", { classe, attrs: { role: "img", "aria-label": nom } }, ...enfants);
}

