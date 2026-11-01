import { el } from "@cdj/ui";
import type { ControleMusique } from "@cdj/ui/src/panneauMusique";
import { cleAction, commandes } from "./commandes";
import { type Ecran, creerEcran } from "./ecrans";
import { installerCataloguesDesEcrans } from "./catalogue.ecrans.fr";
import { installerCataloguesDuJeu } from "./catalogue.jeu.fr";
import { langueCourante, t } from "./i18n";
import { cheminMentions } from "@cdj/ui";
import type { FantomeDepart, Niveau, ReglagesJoueur } from "./reglagesJoueur";

const NIVEAUX: readonly Niveau[] = ["normal", "reduit", "aucun"];
const FANTOMES_DEPART: readonly FantomeDepart[] = ["aucun", "meilleure"];
import type { ReglagesSons } from "./reglagesSons";
import { monterBlocSons } from "./sonsUi";

// Les Réglages de Tower (lot T7), sur le modèle de `jump-reglages.html` (voir `ecrans.ts`) : l'étiquette de Tower porte **Son** (les effets, et le bloc commun de la musique), **Affichage** (le fantôme au
// départ, les secousses, la panique des yeux, la visée), **Commandes** (l'écran du socle : Clavier · Manette · Tactile) et les liens du profil commun et des mentions légales. **À la demande** : ni
// l'accueil ni le jeu ne les embarquent ; l'accueil et la pause les ouvrent, avec chacun sa façon de lire et d'écrire les effets sonores (l'état du jeu en partie, le stockage depuis l'accueil).
// Les réglages s'appliquent tout de suite et se gardent (`tower:reglages`, `reglagesJoueur.ts`) ; ils ne touchent jamais à la simulation. Cibles de 44 px au moins.

export interface OptionsReglages {
  jour(): { jour: number; numero: number | null };
  musique(): Promise<ControleMusique>;
  sons: { lire(): ReglagesSons; ecrire(r: ReglagesSons): void };
  reglages: { lire(): ReglagesJoueur; ecrire(r: ReglagesJoueur, quoi: keyof ReglagesJoueur): void };
  /** Appareil tactile : l'écran des commandes s'ouvre sur l'onglet Tactile. */
  tactile: boolean;
  /** `../profil/?retour=/tower/` : le profil commun du portail, avec le retour au jeu. */
  profilHref: string;
  surOuverture?(): void;
  surFermeture?(): void;
}

export interface Reglages {
  readonly ouvert: boolean;
  ouvrir(): void;
  fermer(): void;
  /** Le réglage des effets a changé ailleurs (la pause) : l'écran se remet à jour. */
  relireSons(): void;
}

export function monterReglages(racine: HTMLElement, o: OptionsReglages): Reglages {
  installerCataloguesDuJeu();
  installerCataloguesDesEcrans();
  let s: ReglagesJoueur = o.reglages.lire();
  const ecran: Ecran = creerEcran(racine, { id: "reglages", aria: "reglages.aria", jour: o.jour, surOuverture: () => ouvrirEcran(), surFermeture: () => fermerEcran() });
  const montrer: (() => void)[] = [];
  const section = (cle: string, ...enfants: (Node | null)[]) => el("section", { classe: "reglages__section" }, el("h2", { classe: "reglages__titre", texte: t(cle) }), ...enfants);
  const aide = (cle: string) => el("p", { classe: "reglages__aide", texte: t(cle) });

  // Un choix exclusif (segment) : des boutons `aria-pressed` dans un groupe nommé.
  const segment = <V extends string | boolean>(quoi: keyof ReglagesJoueur, aria: string, choix: readonly { valeur: V; cle: string }[]): HTMLElement => {
    const groupe = el("div", { classe: "segment", attrs: { role: "group", "data-setting": quoi, "aria-label": t(aria) } });
    const boutons = choix.map((c) => {
      const b = el("button", { classe: "segment__bouton", attrs: { type: "button", "data-value": String(c.valeur) }, texte: t(c.cle) });
      b.addEventListener("click", () => {
        if (s[quoi] === c.valeur) return;
        s = { ...s, [quoi]: c.valeur };
        montrer.forEach((f) => f());
        o.reglages.ecrire({ ...s }, quoi);
      });
      groupe.append(b);
      return b;
    });
    montrer.push(() => boutons.forEach((b, i) => b.setAttribute("aria-pressed", s[quoi] === choix[i]!.valeur ? "true" : "false")));
    return groupe;
  };
  const ligne = (cle: string, groupe: HTMLElement): HTMLElement => el("div", { classe: "reglages__ligne" }, el("span", { classe: "reglages__nom", texte: t(cle) }), groupe);
  const niveaux = (quoi: "secousses" | "yeux", cle: string) => ligne(cle, segment(quoi, cle, NIVEAUX.map((n) => ({ valeur: n, cle: `reglages.niveau.${n}` }))));
  const lien = (id: string, cle: string, href: string): HTMLElement => el("a", { classe: "reglages__lien", attrs: { id, href }, texte: t(cle) });

  const blocSons = monterBlocSons({ lire: () => o.sons.lire(), ecrire: (r) => o.sons.ecrire(r), idCase: "reglages-sons", idVolume: "reglages-sons-volume" });
  const placeMusique = el("div", { classe: "reglages__musique" });
  let chargerMusique: (() => void) | null = () => {
    chargerMusique = null;
    void import("@cdj/ui/src/panneauMusique").then((m) => m.monterPanneau(o.musique, placeMusique), () => undefined);
  };

  // Réglages › Commandes : l'écran du socle (onglets Clavier · Manette · Tactile), chargé à la première ouverture ; les touches d'origine et celles du joueur sont dans `commandes.ts`.
  const hoteCommandes = el("div", { classe: "reglages__commandes", attrs: { id: "reglages-commandes" } });
  let commandesChargees = false;
  const monterCommandes = (): void => {
    if (commandesChargees) return;
    commandesChargees = true;
    void import("@cdj/ui/src/commandesEcran").then((m) => {
      const e = m.ecranCommandes({
        commandes,
        t,
        cleAction,
        ongletInitial: o.tactile ? "tactile" : "clavier",
        fixesManette: () => [
          { nom: t("commandes.manette.deplacer"), touche: t("commandes.fixe.stick") },
          { nom: t("commandes.manette.descendre"), touche: t("commandes.fixe.stickBas") },
        ],
        tactile: () => el("p", { classe: "dj-commandes__etat", texte: t("commandes.tactile") }),
      });
      hoteCommandes.replaceChildren(e.racine);
    });
  };

  ecran.corps.append(
    el("h1", { classe: "etiquette__titre", texte: t("reglages.titre") }),
    section("reglages.son", blocSons.element, placeMusique),
    section(
      "reglages.affichage",
      ligne("reglages.fantome", segment("fantome", "reglages.fantome", FANTOMES_DEPART.map((f) => ({ valeur: f, cle: `fantome.${f}` })))),
      aide("reglages.fantome.aide"),
      niveaux("secousses", "reglages.secousses"),
      aide("reglages.secousses.aide"),
      niveaux("yeux", "reglages.yeux"),
      aide("reglages.yeux.aide"),
      ligne("reglages.visee", segment("visee", "reglages.visee", [{ valeur: true, cle: "reglages.oui" }, { valeur: false, cle: "reglages.non" }])),
      aide("reglages.visee.aide"),
    ),
    section("reglages.commandes", hoteCommandes),
    el("div", { classe: "reglages__liens" }, lien("reglages-profil", "reglages.profil", o.profilHref), lien("reglages-mentions", "reglages.mentions", cheminMentions(langueCourante(), "../"))),
  );
  montrer.forEach((f) => f());

  function ouvrirEcran(): void {
    s = o.reglages.lire();
    montrer.forEach((f) => f());
    blocSons.relire();
    chargerMusique?.();
    monterCommandes();
    o.surOuverture?.();
  }
  function fermerEcran(): void {
    o.surFermeture?.();
  }
  return {
    get ouvert() {
      return ecran.ouvert;
    },
    ouvrir: () => ecran.ouvrir(),
    fermer: () => ecran.fermer(),
    relireSons: () => blocSons.relire(),
  };
}
