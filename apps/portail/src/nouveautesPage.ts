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
import { parseDay } from "@cdj/core";
import { NOM_DE_ZONE } from "@cdj/core/nouveautes";
import { ecrireLangue, lireLangue, type Langue } from "@cdj/profile";
import { CATALOGUE_COMMUN, barreJeu, bouton, choixLangue, cheminMentions, el, formatDate, traducteur } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { dans, lireNouveautes, noterNouveauteLue, parDate, type Nouveaute } from "./nouveautesDonnees";
import { numeroDeJournee } from "./jours";
import { stockageDuPortail } from "./stockage";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("nouveautes")));

// Lot N2 : la page des nouveautés (`/nouveautes/`), ouverte par la ligne « Nouveautés » de l'accueil. Les mises à jour **par date, la plus récente en haut**, chaque ligne avec
// l'étiquette de sa zone (Du Jour, Track, Jump) ; **20 par page**, puis « Plus anciennes » (le curseur `avant` de `GET /api/portail/nouveautes`, cache public court). Français ou
// anglais selon la langue de la plateforme (`cdj:langue`). Tout texte venu du serveur se pose en `textContent` (jamais interprété). Ouvrir la page note « lu » sur cet appareil
// (un repère en `localStorage`, dans un try/catch : sans stockage, rien ne casse) : le point de l'accueil s'éteint.

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;

let nouveautes: Nouveaute[] = [];
let suivante: string | null = null;
/** `null` : première lecture pas encore faite ; sinon l'état de la dernière. */
let etat: "chargement" | "ok" | "erreur" = "chargement";
let enCours = false;

function article(t: T, n: Nouveaute): HTMLElement {
  return el(
    "article",
    { classe: "nouveautes-mise-a-jour", attrs: { "data-id": String(n.id) } },
    el("h3", { classe: "nouveautes-mise-a-jour__titre", texte: dans(n.titre, langue) }),
    el(
      "ul",
      { classe: "nouveautes-lignes", attrs: { "aria-label": t.t("nouveautes.lignes.aria") } },
      ...n.lignes.map((l) =>
        el(
          "li",
          { classe: "nouveautes-ligne", attrs: { "data-zone": l.zone ?? "" } },
          l.zone ? el("span", { classe: ["nouveautes-zone", `nouveautes-zone--${l.zone}`], texte: NOM_DE_ZONE[l.zone] }) : null,
          el("span", { classe: "nouveautes-ligne__texte", texte: dans(l, langue) }),
        ),
      ),
    ),
  );
}

function rendre(): void {
  const racine = document.getElementById("nouveautes");
  if (!racine) return;
  const t = traduire(langue);
  const focus = (document.activeElement as HTMLElement | null)?.getAttribute("data-cle");
  document.documentElement.lang = langue;
  document.title = t.t("nouveautes.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("nouveautes.description"));
  const jour = parisDay(Date.now());
  const groupes = parDate(nouveautes);
  const enfants: (Node | null)[] = [
    barreJeu(t, { href: "../", jour, numero: numeroDeJournee(jour) ?? undefined }),
    el("h1", { classe: "nouveautes-titre", texte: t.t("nouveautes.titre") }),
    etat === "chargement" ? el("p", { classe: "nouveautes-etat", attrs: { id: "nouveautes-etat", role: "status" }, texte: t.t("nouveautes.chargement") }) : null,
    etat === "erreur" ? el("p", { classe: "nouveautes-etat", attrs: { id: "nouveautes-etat", role: "status" }, texte: t.t("nouveautes.erreur") }) : null,
    etat === "ok" && nouveautes.length === 0 ? el("p", { classe: "nouveautes-etat", attrs: { id: "nouveautes-vide" }, texte: t.t("nouveautes.vide") }) : null,
    ...groupes.map((g) => {
      const jourDuGroupe = parseDay(g.date);
      return el(
        "section",
        { classe: "nouveautes-date", attrs: { "data-date": g.date } },
        el("h2", { classe: "nouveautes-date__jour", texte: jourDuGroupe === null ? g.date : formatDate(jourDuGroupe, langue, { capitale: true }) }),
        ...g.nouveautes.map((n) => article(t, n)),
      );
    }),
    suivante
      ? bouton({ texte: t.t("nouveautes.plusAnciennes"), variante: "secondaire", ariaLabel: t.t("nouveautes.plusAnciennes.aria"), pleineLargeur: true, onClick: () => void charger(suivante) })
      : null,
    el("section", { classe: "profil-section", attrs: { "aria-labelledby": "titre-langue" } }, el("h2", { classe: "profil-section__titre", attrs: { id: "titre-langue" }, texte: t.t("profil.langue.titre") }), choixLangue(t, { langue, onChange: changerLangue })),
    el(
      "footer",
      { classe: "portail-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "../"), hreflang: langue }, texte: t.t("portail.mentions") }),
    ),
  ];
  racine.replaceChildren(...enfants.filter((e): e is Node => e !== null));
  const bouton_ = racine.querySelector<HTMLElement>(".dj-bouton");
  if (bouton_ && !bouton_.hasAttribute("data-cle")) bouton_.setAttribute("data-cle", "plus-anciennes");
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
}

/** Lit une page (la première, ou `avant`) : une requête, ajoutée à ce qu'on affiche. Ouvrir la première page note « lu » sur cet appareil. */
async function charger(avant: string | null): Promise<void> {
  if (enCours) return;
  enCours = true;
  const r = await lireNouveautes(avant, fetch.bind(globalThis));
  enCours = false;
  if ("erreur" in r) {
    if (nouveautes.length === 0) etat = "erreur";
    rendre();
    return;
  }
  etat = "ok";
  nouveautes = avant ? [...nouveautes, ...r.page.nouveautes] : r.page.nouveautes;
  suivante = r.page.suivante;
  if (!avant && r.page.nouveautes.length) noterNouveauteLue(stockage, Math.max(...r.page.nouveautes.map((n) => n.publieLe)));
  rendre();
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

rendre();
void charger(null);
