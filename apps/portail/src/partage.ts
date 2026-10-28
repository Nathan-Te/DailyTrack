import type { Medaille } from "./jour";

// Lot I3 : la **ligne de partage de la journée** — une ligne, puis le lien du portail :
//
//   Du Jour #1 — Track 🥇 · Jump 🥈 — 🔥 5
//   https://playdujour.com/
//
// Un jeu non fini (pas joué, ou en cours : le classement prouvé n'a rien) s'écrit « son nom suivi de ⬜ » (et non d'un tiret : il se lirait collé au « — » qui sépare la série) ; un jeu fini sans médaille porte une coche ; la
// journée parfaite ajoute une étoile après la série ; avant le 23/10/2026 le titre est « Du Jour » sans numéro ; sans série, la partie « 🔥 » disparaît.
// **Rien d'identifiant** dedans : ni pseudo, ni code, ni identifiant (le titre, les noms des jeux, les médailles et la série suffisent).
// Les émojis sont ceux que les jeux emploient déjà dans leur propre partage (`MEDAL_ICON` de `apps/web/src/share.ts` et `apps/jump/src/dailyInfo.ts`) ;
// ils ne vivent que dans ce texte (charte § 6 : aucun émoji dans l'interface). Les mots (le titre) viennent du catalogue de la langue.
// Logique pure (testée : `test/partage.test.ts`), sans DOM.

/** Les émojis de la ligne (charte § 6 : seulement ici). */
export const EMOJIS = {
  // i18n-ok: émojis de la ligne à partager, les mêmes que ceux des jeux (MEDAL_ICON)
  author: "💎",
  gold: "🥇",
  silver: "🥈",
  bronze: "🥉",
  /** Fini, sans médaille. */
  fini: "✅",
  /** Pas fini : pas joué, ou en cours. */
  vide: "⬜",
  serie: "🔥",
  parfaite: "⭐",
} as const;

/** Le statut d'un jeu pour la ligne : fini (avec sa médaille, ou `null`), ou pas fini (pas joué, en cours). */
export type StatutPartage = { fini: true; medaille: Medaille | null } | { fini: false };

export interface JeuPartage {
  /** Son nom, dans la langue (`jeu.track.nom`). */
  nom: string;
  statut: StatutPartage;
}

export interface OptionsPartage {
  /** « Du Jour #N » (le numéro de la journée commune) ou « Du Jour » sans numéro (`null` : avant le 23/10/2026). */
  titre: string;
  jeux: readonly JeuPartage[];
  /** La série tous jeux confondus (0 : la partie est omise). */
  serie: number;
  /** Journée parfaite aujourd'hui : une étoile après la série. */
  parfaite: boolean;
  /** Le lien du portail (l'origine courante : `https://playdujour.com/` en production). */
  lien: string;
}

/** Le morceau d'un jeu : « Track 🥇 », « Track ✅ » (fini sans médaille), « Jump ⬜ » (pas fini). */
export function morceauDeJeu(j: JeuPartage): string {
  if (!j.statut.fini) return `${j.nom} ${EMOJIS.vide}`;
  return `${j.nom} ${j.statut.medaille ? EMOJIS[j.statut.medaille] : EMOJIS.fini}`;
}

/** La ligne : le titre, les jeux, puis la série (et l'étoile d'une journée parfaite). */
export function lignePartage(o: OptionsPartage): string {
  const parts = [o.titre, o.jeux.map(morceauDeJeu).join(" · ")];
  if (o.serie >= 1) parts.push(`${EMOJIS.serie} ${o.serie}${o.parfaite ? ` ${EMOJIS.parfaite}` : ""}`);
  return parts.join(" — ");
}

/** Le texte complet à envoyer : la ligne, puis le lien (à la ligne). */
export function textePartage(o: OptionsPartage): string {
  return `${lignePartage(o)}\n${o.lien}`;
}

/** Le lien partagé : l'adresse publique du portail, c'est-à-dire l'**origine courante** (`https://playdujour.com/` en production, la recette, un aperçu). */
export function lienDuPortail(loc: Pick<Location, "origin">): string {
  return `${loc.origin}/`;
}

/** Ce que l'envoi a donné : partagé (feuille du téléphone), copié, annulé par le joueur, ou impossible (le texte reste à sélectionner). */
export type ResultatEnvoi = "partage" | "copie" | "annule" | "echec";

/** Copie un texte dans le presse-papiers (l'ancienne méthode en repli) ; faux si le navigateur refuse. */
export async function copier(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    /* permission refusée ou page non sécurisée : l'ancienne méthode */
  }
  try {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.append(zone);
    zone.select();
    const ok = document.execCommand("copy");
    zone.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Le partage : `navigator.share` quand il existe (la feuille de partage du téléphone), sinon le presse-papiers. Le texte contient déjà le lien : on ne
 * le passe pas deux fois. Annuler la feuille n'est pas une erreur ; une feuille qui échoue autrement retombe sur la copie.
 */
export async function envoyer(texte: string): Promise<ResultatEnvoi> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: texte });
      return "partage";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "annule";
    }
  }
  return (await copier(texte)) ? "copie" : "echec";
}
