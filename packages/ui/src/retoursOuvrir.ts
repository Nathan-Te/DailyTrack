import { CATALOGUE_RETOURS } from "./catalogue.retours";
import { dialogueRetour, type ContexteAffiche, type DialogueRetour, type TypeDeRetour } from "./retours";
import { traducteur } from "./i18n";
import type { Jeu } from "./composants";

// Lot C1, partie A : le seul morceau qui relie le dialogue « Un bug ? Une idée ? » au client des routes (`@cdj/profile/src/retours`) — **commun au portail et aux trois jeux** : chaque application ne garde qu'un
// petit module à la demande (`retoursJeu.ts`) qui lui passe son identité, son adresse de serveur et son module de profil. `@cdj/ui` ne dépend pas de `@cdj/profile` : le client est reçu en paramètre (sa
// forme est décrite ici). **À la demande** (`import()`), jamais dans `index.ts`. La langue est celle que l'application donne.

/** Ce que le dialogue attend du module `@cdj/profile/src/retours`. */
export interface ProfilRetours {
  clientRetours(o: { base: string; playerId: string | null }): {
    lireContexte(): Promise<{ ok: true; data: { version: string; jour: string; reference?: string } } | { ok: false; code: string }>;
    envoyer(o: { type: TypeDeRetour; texte: string; contexte: { jeu: string; page: string; jour: string; navigateur: string; systeme: string; ecran: string; langue: "fr" | "en" } }): Promise<{ ok: true; data: { reponsePossible: boolean } } | { ok: false; code: string }>;
  };
  famillesDe(userAgent: string, plateforme?: string): { navigateur: string; systeme: string };
  cheminDePage(chemin: string): string;
}

export interface OptionsOuvrirRetour {
  jeu: "portail" | Jeu;
  langue: "fr" | "en";
  /** L'adresse du serveur (`baseApi` de l'application). */
  base: string;
  /** L'identifiant secret du joueur, ou `null` sans profil. */
  playerId: string | null;
  profil: ProfilRetours;
  /** Où mène « Mes messages » après l'envoi (le profil du portail, depuis la racine du site). */
  hrefMessages?: string;
  parent?: HTMLElement;
  onFermer?: () => void;
  /** Ce que la page sait d'elle-même : par défaut ce que le navigateur dit (`location.pathname`, `navigator`, `screen`). */
  page?: string;
  userAgent?: string;
  plateforme?: string;
  ecran?: string;
}

/** Ouvre le dialogue. Le contexte est montré tout de suite (la version et la référence arrivent du serveur quand il répond) ; l'envoi n'a lieu qu'au bouton. */
export function ouvrirRetour(o: OptionsOuvrirRetour): DialogueRetour {
  const t = traducteur(o.langue, CATALOGUE_RETOURS);
  const client = o.profil.clientRetours({ base: o.base, playerId: o.playerId });
  const { navigateur, systeme } = o.profil.famillesDe(o.userAgent ?? navigator.userAgent, o.plateforme ?? navigator.platform);
  const base: ContexteAffiche = {
    jeu: o.jeu,
    page: o.profil.cheminDePage(o.page ?? location.pathname),
    jour: null,
    version: null,
    navigateur,
    systeme,
    ecran: o.ecran ?? `${Math.round(screen.width)}x${Math.round(screen.height)}`,
    langue: o.langue,
    reference: null,
  };
  const dialogue = dialogueRetour({
    t,
    contexte: base,
    sansProfil: o.playerId === null,
    jeu: o.jeu === "portail" ? undefined : (o.jeu as "track" | "jump" | "tower"), // un jeu neuf (fiche) n'a pas de couleur propre : la classe sans règle laisse le dialogue crème
    hrefMessages: o.hrefMessages,
    parent: o.parent,
    onFermer: o.onFermer,
    async envoyer(m) {
      const r = await client.envoyer({ type: m.type, texte: m.texte, contexte: { jeu: base.jeu, page: base.page, jour: base.jour ?? "", navigateur, systeme, ecran: base.ecran, langue: base.langue } });
      return r.ok ? { ok: true, reponsePossible: r.data.reponsePossible } : { ok: false, code: r.code };
    },
  });
  // La version du site et la référence publique viennent du serveur : le contexte du dialogue se complète dès qu'elles arrivent (sinon « inconnue »).
  void client.lireContexte().then((r) => {
    if (!r.ok) return;
    base.version = r.data.version;
    base.jour = r.data.jour;
    base.reference = r.data.reference ?? null;
    dialogue.majContexte(base);
  });
  return dialogue;
}
