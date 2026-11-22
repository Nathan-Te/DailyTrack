import type { Langue } from "@cdj/ui";
import type { Donnees } from "./donnees";
import type { I18n } from "./i18n";
import type { DefinitionJeu, DefinitionJeuParty, FicheClient } from "./types";

// Lot PA1b — **ce qu'un jeu Party ajoute à l'accueil et à la fin de partie** (tour de rôle des jeux Party : `docs/regles/api/un-jeu-party-lot-pa1.md`). **Chargé à la demande** (`import()` de `brancherJeu`, seulement pour une fiche
// de catégorie `party` ; le morceau `party-` est dans `A_LA_DEMANDE_PAR_DEFAUT`, `scripts/budgets.mjs`) : **le premier chargement d'un jeu du jour ne grossit que de l'appel**, jamais du code de ce fichier. **Ce fichier n'importe aucun module
// que le premier chargement utilise aussi** (`session`, `source`, `stockage`, `@cdj/profile`, `@cdj/ui` : un module que le premier chargement et un morceau à la demande partagent est sorti du morceau principal, et chaque jeu y perdrait de l'ordre d'un Ko ; mesuré sur Rush : +1 063 o avec trois de ces imports) : il reçoit les données et fabrique son DOM à la main : il reçoit les
// données (`prets`, le morceau `donnees`) et lit le classement du jour par elles. Il pose la ligne d'état dans l'accueil déjà dessiné (« Classé aujourd'hui » / « Jeu libre · classé le <date> »), montre le record de l'appareil (le meilleur, tous jours
// confondus : le jeu ne change pas d'un jour à l'autre) et dit à la partie, par `etatParty`, si le jeu est libre. Les textes vivent ici (français et anglais), pas dans le catalogue du kit, que tous les jeux chargent d'emblée.

/** Ce que le serveur dit d'un jeu Party pour un jour (réponse du classement du jour, `party`) : classé ce jour-là ? et sinon, la prochaine date où il sera en tête (`AAAA-MM-JJ`), si elle se calcule. */
export interface TourParty {
  classe: boolean;
  prochain: string | null;
}

/** Lot PA1 — le thème d'un jeu Party (le seul). */
export const THEME_UNIQUE = "unique";
/** Lot PA1 — la définition complète d'un jeu Party : un thème, aucune médaille, aucun fantôme (`seuils`, `medaille` et `rediffusionDiamant` ne sont jamais appelées : `sansMedaille`, `sansFantome`). */
export function definitionDeParty<C>(d: DefinitionJeuParty<C>): DefinitionJeu<C> {
  return { ...d, themeDuJour: () => THEME_UNIQUE, seuils: () => ({ author: 0, gold: 0, silver: 0, bronze: 0 }), medaille: () => null, rediffusionDiamant: () => "", sansMedaille: true, sansFantome: true };
}

/** **Le jeu est-il libre aujourd'hui ?** `true` quand le serveur a dit qu'il n'est pas le jeu du jour : la partie n'est alors ni classée ni envoyée. Inconnu (hors ligne, serveur muet) : `false`, l'envoi est tenté et le serveur refuse au besoin. Lu par la partie. */
export const etatParty: { libre: boolean } = { libre: false };

const TEXTES: Record<Langue, Record<string, string>> = {
  fr: {
    "kit.party.classe": "Classé aujourd'hui",
    "kit.party.libre": "Jeu libre",
    "kit.party.libreLe": "Jeu libre · classé le {date}",
    "kit.party.record": "Record de cet appareil",
    "kit.party.finLibre": "Jeu libre : pas de classement aujourd'hui. Ton record reste sur cet appareil.",
  },
  en: {
    "kit.party.classe": "Ranked today",
    "kit.party.libre": "Free play",
    "kit.party.libreLe": "Free play · ranked on {date}",
    "kit.party.record": "This device's record",
    "kit.party.finLibre": "Free play: no leaderboard today. Your record stays on this device.",
  },
};
export const texteParty = (cle: string, langue: Langue, date = ""): string => (TEXTES[langue] ?? TEXTES.fr)[cle]!.replace("{date}", date);

/** Une date courte (« 22 nov. » / « Nov 22 »), la même que la barre des jeux sans le jour de la semaine ; `jour` est un numéro de jour. */
const dateCourte = (date: string, langue: Langue): string => new Intl.DateTimeFormat(langue, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

/** La ligne d'état de l'accueil : « Classé aujourd'hui », ou « Jeu libre · classé le <date> » (« Jeu libre » seul quand la prochaine date ne se calcule pas). */
export function statutParty(tour: TourParty, langue: Langue): string {
  if (tour.classe) return texteParty("kit.party.classe", langue);
  return tour.prochain === null || !/^\d{4}-\d{2}-\d{2}$/.test(tour.prochain) ? texteParty("kit.party.libre", langue) : texteParty("kit.party.libreLe", langue, dateCourte(tour.prochain, langue));
}

/**
 * Le record personnel : la meilleure partie gardée sur l'appareil (`<id>:records`, le format des records du kit : `{ jours: { AAAA-MM-JJ: { s: [colonnes…] } } }`), **tous jours confondus** ; `null` sans record lisible.
 * `sens` : le sens de chaque colonne de classement (la première qui diffère décide, comme `bat` de `records.ts`). Lu sans le module des records (un morceau de moins pour les autres jeux).
 */
export function meilleurScore(brut: string | null | undefined, sens: readonly ("asc" | "desc")[]): number[] | null {
  let meilleur: number[] | null = null;
  try {
    const jours = (JSON.parse(brut ?? "{}") as { jours?: Record<string, { s?: unknown }> }).jours ?? {};
    for (const v of Object.values(jours)) {
      const s = v?.s;
      if (!Array.isArray(s) || s.length !== sens.length || !s.every((x) => Number.isInteger(x) && x >= 0)) continue;
      const i = meilleur ? sens.findIndex((_, k) => s[k] !== meilleur![k]) : 0;
      if (!meilleur || (i >= 0 && (sens[i] === "desc" ? s[i] > meilleur[i]! : s[i] < meilleur[i]!))) meilleur = s as number[];
    }
  } catch {
    /* un enregistrement abîmé : pas de record affiché */
  }
  return meilleur;
}

/** Branche un jeu Party sur l'accueil que `brancherJeu` dessine (`prets` : les données de l'accueil ; sans effet sur une archive, `?seed=`). Ne lève jamais : un échec laisse l'accueil comme il est. */
export function monter<C>(fiche: FicheClient, def: DefinitionJeu<C>, i18n: I18n, prets: Promise<Donnees>): void {
  if (location.search.includes("seed=")) return; // un jour d'archive (`?seed=`) : ni classé ni libre
  const sens = fiche.colonnes.map((c) => c.sens);
  let statut: HTMLElement | null = null;
  let stockage: Storage | null = null;
  /** Le record de l'appareil dans la tuile « Ton record » (le kit y met celui d'aujourd'hui : on le remplace, sans boucler). */
  const montrerRecord = (): void => {
    const valeur = document.getElementById("jeu-record");
    const score = meilleurScore(stockage?.getItem(`${fiche.prefixe}records`), sens);
    if (!valeur || !score) return;
    const texte = def.formatScore(score, i18n.langue, i18n.t);
    const sous = texteParty("kit.party.record", i18n.langue);
    if (valeur.textContent !== texte) valeur.textContent = texte;
    const dessous = valeur.nextElementSibling;
    if (dessous && dessous.textContent !== sous) dessous.textContent = sous;
  };
  const poser = (tour: TourParty): void => {
    etatParty.libre = !tour.classe;
    const tuiles = document.querySelector(".jeu-accueil__gauche > .jeu-tuiles");
    if (!tuiles) return;
    if (!statut) {
      statut = document.createElement("p");
      statut.className = "jeu-archive";
      statut.id = "jeu-party";
      statut.setAttribute("role", "status");
    }
    statut.textContent = statutParty(tour, i18n.langue);
    if (!statut.isConnected) tuiles.before(statut);
  };
  void prets.then((d) => {
    stockage = d.stockage;
    // Le kit écrit son record d'aujourd'hui un peu après les données : on regarde la tuile quelques secondes (le record de l'appareil s'y remet, sans boucler).
    const tuiles = document.querySelector(".jeu-accueil__gauche > .jeu-tuiles");
    if (tuiles) {
      const observateur = new MutationObserver(montrerRecord);
      observateur.observe(tuiles, { subtree: true, childList: true, characterData: true });
      setTimeout(() => observateur.disconnect(), 10_000);
    }
    montrerRecord();
    void d.source?.board(new Date().toLocaleDateString("sv", { timeZone: "Europe/Paris" }), null).then((r) => {
      if (r.ok && r.data.party) poser(r.data.party);
    });
  });
}
