import { parisDay } from "@cdj/clock";
import { adresseAvatar, readIdentity, readPlayerId, type KeyValueStore, type Langue } from "@cdj/profile";
import { CATALOGUE_COMMUN, avatar, choixLangue, formatDate, formatNumeroJour, logo, traducteur } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { CATALOGUE_PAGES } from "./cataloguePages";
import { jourGarde } from "./cacheJour";
import { clocheDePage, frontonDePage, itemsDeNavigation } from "./classementSalle";
import { baseApi, formatCompte, prochainMinuit } from "./jour";
import { numeroDeJournee } from "./jours";
import { nonLue } from "./nouveautesDonnees";
import { barreSalle, navigation, type PageNav } from "./salle";

// Lot U3 (charte rév. 19, § 1 et § 9) — ce que partagent les pages « Amis et groupes » et « Profil » de la salle de jeux : la barre (logo, navigation, langue, cloche, avatar), le fronton (titre, date, journée,
// compte à rebours) et la barre d'onglets du téléphone. Des pièces de présentation : les textes viennent du catalogue du portail, le stockage est passé en paramètre, rien n'est demandé au serveur au chargement (la cloche lit la
// copie de l'accueil gardée dans le navigateur, comme `/classement/`, et ouvre sa feuille à la demande : lot U4). Les pages Classements et accueil gardent leurs propres assemblages (lots U1 et U2).

export const traducteurDePage = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_PAGES, CATALOGUE_COMMUN);
export type TPage = ReturnType<typeof traducteurDePage>;

export interface OptionsSalle {
  t: TPage;
  langue: Langue;
  /** La page ouverte dans la navigation. */
  ici: PageNav;
  stockage: KeyValueStore | null;
  /** Le joueur a-t-il une identité sur cet appareil ? */
  identifie: boolean;
  /** L'image de son avatar, quand une lecture plus fraîche que la copie de l'accueil l'a donnée. */
  avatar?: string;
  onLangue: (l: Langue) => void;
}

/** La barre de la salle : la copie de l'accueil du navigateur dit si la cloche porte un point et quelle est l'image de l'avatar. */
export function barreDePage(o: OptionsSalle): HTMLElement {
  const { t } = o;
  const maintenant = Date.now();
  const copie = jourGarde(o.stockage, parisDay(maintenant), maintenant, o.identifie);
  const reponses = copie?.joueur?.messagesNonLus ?? 0;
  const nouveaute = nonLue(copie?.nouveaute, o.stockage);
  const identite = readIdentity(o.stockage);
  const items = itemsDeNavigation((cle) => t.t(cle));
  return barreSalle({
    logo: logo(t),
    navigation: navigation({ items, ici: o.ici, aria: t.t("portail.nav.aria"), place: "haut", racine: "../" }),
    langue: choixLangue(t, { langue: o.langue, onChange: o.onLangue }),
    // Lot U4 : la cloche ouvre la même feuille que sur l'accueil (chargée à la demande, `clochePage.ts`) ; le point vient de la copie de l'accueil.
    cloche: clocheDePage({ nom: t.t(nouveaute || reponses > 0 ? "portail.cloche.nonLu" : "portail.cloche.nom"), nonLu: nouveaute || reponses > 0, contexte: { t, langue: o.langue, stockage: o.stockage, identifiant: () => (o.stockage ? readPlayerId(o.stockage) : null), racine: "../" } }),
    avatar: avatar(t, { pseudo: identite.exists ? identite.name : null, href: "../profil/", image: adresseAvatar(baseApi(), o.avatar ?? copie?.joueur?.avatar) }),
  });
}

/** La barre d'onglets du téléphone (fixe, en bas) : la même navigation, avec des icônes. */
export const ongletsDuBas = (t: TPage, ici: PageNav): HTMLElement => navigation({ items: itemsDeNavigation((cle) => t.t(cle)), ici, aria: t.t("portail.nav.aria"), place: "bas", racine: "../" });

/** Le fronton d'une page : son titre, la date, le numéro de la journée et le compte à rebours jusqu'aux prochains niveaux. */
export function frontonDeLaPage(o: { t: TPage; langue: Langue; titre: string; jour: number }): HTMLElement {
  const numero = numeroDeJournee(o.jour);
  const maintenant = Date.now();
  return frontonDePage({
    titre: o.titre,
    date: formatDate(o.jour, o.langue, { capitale: true }),
    journee: numero ? o.t.t("portail.journee", { numero: formatNumeroJour(numero, o.langue) }) : null,
    legende: o.t.t("portail.compte.legende"),
    compte: formatCompte(prochainMinuit(null, maintenant) - maintenant),
  });
}

/** Fait battre le compte à rebours du fronton (`.salle-compte__valeur`) sur l'horloge de l'appareil recalée sur Paris ; à zéro, `auMinuit` (la page relit ses données une fois). */
export function battre(auMinuit?: () => void): void {
  let echeance = prochainMinuit(null, Date.now());
  setInterval(() => {
    const maintenant = Date.now();
    const valeur = document.querySelector(".salle-compte__valeur");
    if (valeur) valeur.textContent = formatCompte(echeance - maintenant);
    if (maintenant < echeance) return;
    echeance = prochainMinuit(null, maintenant);
    auMinuit?.();
  }, 1000);
}
