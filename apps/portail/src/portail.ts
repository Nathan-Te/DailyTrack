import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./portail.css";
import { parisDay } from "@cdj/clock";
import { ecrireLangue, lireLangue, readIdentity, type Langue } from "@cdj/profile";
import { CATALOGUE_COMMUN, barrePortail, bouton, cartouche, el, etiquetteJump, etiquetteTrack, formatDate, formatNumeroJour, traducteur } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { cartes, type CarteJeu } from "./jours";
import { stockageDuPortail } from "./stockage";

// Le portail « Du Jour » (lot R4 ; lot I1 : passé au socle `@cdj/ui`, direction « Cartouches », français et anglais). Même contenu qu'au
// lot R4 : la date, une cartouche par jeu (nom, numéro du jour, accroche, bouton vers le jeu), le pied et le lien vers les mentions légales.
// Le portail riche (compte à rebours, série, statut de chaque jeu) arrive au lot I2 : rien n'est affiché qu'il ne sait pas.
// Langue : celle de la plateforme (`cdj:langue`, `@cdj/profile`) ; la changer met à jour l'écran sans recharger, `<html lang>` et le titre.
// Le jour est celui de Paris (`@cdj/clock`), comme dans les jeux. Aucune requête.

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;

const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);

function cartoucheDe(c: CarteJeu, t: ReturnType<typeof traduire>): HTMLElement {
  const numero = c.numero > 0 ? formatNumeroJour(c.numero, langue) : undefined;
  const etiquette =
    c.code === "track"
      ? etiquetteTrack({ titre: t.t("jeu.track.titre"), numero, texte: t.t("portail.track.accroche") })
      : etiquetteJump({ titre: t.t("jeu.jump.titre"), numero, texte: t.t("portail.jump.accroche") });
  const nom = t.t(c.code === "track" ? "jeu.track.nom" : "jeu.jump.nom");
  return cartouche({
    jeu: c.code,
    etiquette,
    action: bouton({ texte: t.t("portail.jouer"), href: c.lien, variante: "marque", pleineLargeur: true, ariaLabel: t.t("portail.jouer.aria", { jeu: nom }) }),
    attrs: { "data-jeu": c.code },
  });
}

function rendre(): void {
  const racine = document.getElementById("portail");
  if (!racine) return;
  const t = traduire(langue);
  document.documentElement.lang = langue;
  document.title = t.t("portail.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("portail.description"));
  const jour = parisDay(Date.now());
  const identite = readIdentity(stockage);
  racine.replaceChildren(
    el("h1", { classe: "dj-cache", texte: t.t("portail.titre") }),
    barrePortail(t, { langue, onLangue: changerLangue, pseudo: identite.exists ? identite.name : null }),
    el("p", { classe: "portail-date", attrs: { id: "date" }, texte: formatDate(jour, langue, { capitale: true }) }),
    el(
      "section",
      { classe: "portail-jeux", attrs: { "aria-labelledby": "portail-jeux-titre" } },
      el("h2", { classe: "portail-jeux__titre", attrs: { id: "portail-jeux-titre" }, texte: t.t("portail.jeux.titre") }),
      el("div", { classe: "portail-etagere", attrs: { id: "jeux" } }, ...cartes(jour).map((c) => cartoucheDe(c, t))),
    ),
    el(
      "footer",
      { classe: "portail-pied" },
      el("p", { texte: t.t("portail.pied") }),
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: "mentions-legales/", hreflang: langue === "fr" ? null : "fr" }, texte: t.t("portail.mentions") }),
    ),
  );
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  // Le focus reste sur le choix de langue (l'écran a été reconstruit).
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

rendre();
