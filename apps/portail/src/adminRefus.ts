import { el } from "@cdj/ui";
import type { RefusDuTableau, RefusPeriode } from "./adminDonnees";

// Lot D2 (C1) — la carte « Refus d'envoi par cause » du tableau de bord : pour chaque jeu, sur 24 h ou sur 7 jours, **onglet périmé** (attendu, sans gravité), **rediffusion invalide** (la ligne à
// surveiller pour un écart de déterminisme), **limites** (429, 503), **jour** (jour clos, horloge) et **autres** (erreurs serveur) ; le détail par code est au clic. Les nombres viennent de
// `journal_erreurs` (un code, une route, une heure : ni joueur, ni adresse). Texte posé en `textContent`, aucun style en ligne.

const COLONNES = [
  { cle: "perime", titre: "Onglet périmé", aide: "version, sim_version, track_mismatch : un onglet resté ouvert pendant une mise en production" },
  { cle: "invalide", titre: "Rediffusion invalide", aide: "le rejeu ne correspond pas, copie, rediffusion abîmée : la ligne à surveiller" },
  { cle: "limites", titre: "Limites", aide: "429 (trop de requêtes) et 503 (serveur occupé)" },
  { cle: "jour", titre: "Jour", aide: "jour clos après la grâce, jour inconnu (horloge de l'appareil)" },
  { cle: "serveur", titre: "Autres", aide: "erreurs serveur" },
] as const;

type Ligne = RefusPeriode["parJeu"][number];

function ligne(titre: string, id: string, c: Pick<Ligne, "perime" | "invalide" | "limites" | "jour" | "serveur" | "codes">, total = false): HTMLElement[] {
  const detail = Object.entries(c.codes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const bouton = el("button", { classe: "admin-refus__detail", attrs: { type: "button", "aria-expanded": "false", "aria-controls": id, "data-detail": id }, texte: titre });
  const rangee = el(
    "tr",
    { classe: total ? "admin-refus__total" : undefined, attrs: { "data-jeu": id } },
    el("th", { attrs: { scope: "row" } }, detail.length ? bouton : el("span", { texte: titre })),
    ...COLONNES.map((k) => el("td", { classe: ["admin-refus__n", k.cle === "invalide" && c.invalide > 0 ? "admin-refus__n--surveiller" : null], attrs: { "data-cause": k.cle }, texte: String(c[k.cle]) })),
  );
  const contenu = el(
    "tr",
    { classe: "admin-refus__codes", attrs: { id, hidden: "" } },
    el("td", { attrs: { colspan: String(COLONNES.length + 1) } }, el("ul", { classe: "admin-refus__liste" }, ...detail.map(([code, n]) => el("li", {}, el("span", { classe: "admin-mono", texte: code }), el("span", { texte: ` × ${n}` }))))),
  );
  bouton.addEventListener("click", () => {
    const ouvert = bouton.getAttribute("aria-expanded") !== "true";
    bouton.setAttribute("aria-expanded", String(ouvert));
    contenu.toggleAttribute("hidden", !ouvert);
  });
  return [rangee, contenu];
}

function tableau(periode: RefusPeriode, prefixe: string): HTMLElement {
  const lignes = [...periode.parJeu.flatMap((j) => ligne(j.nom, `${prefixe}-${j.jeu}`, j)), ...ligne("Tous les jeux", `${prefixe}-total`, periode.total, true)];
  return el(
    "div",
    { classe: "admin-defile" },
    el(
      "table",
      { classe: ["admin-table", "admin-refus"], attrs: { id: `refus-${prefixe}` } },
      el("thead", {}, el("tr", {}, el("th", { attrs: { scope: "col" }, texte: "Jeu" }), ...COLONNES.map((k) => el("th", { attrs: { scope: "col", title: k.aide }, texte: k.titre })))),
      el("tbody", {}, ...lignes),
    ),
  );
}

export function carteRefus(refus: RefusDuTableau): HTMLElement {
  const t24 = tableau(refus.h24, "h24");
  const t7 = tableau(refus.j7, "j7");
  t7.hidden = true;
  const choix = (texte: string, cible: HTMLElement, autre: HTMLElement, id: string) => {
    const b = el("button", { classe: "admin-filtre", attrs: { type: "button", "aria-pressed": id === "h24" ? "true" : "false", "data-periode": id }, texte });
    return { b, cible, autre };
  };
  const a = choix("24 heures", t24, t7, "h24");
  const b = choix("7 jours", t7, t24, "j7");
  for (const [x, y] of [[a, b], [b, a]] as const) {
    x.b.addEventListener("click", () => {
      x.cible.hidden = false;
      y.cible.hidden = true;
      x.b.setAttribute("aria-pressed", "true");
      y.b.setAttribute("aria-pressed", "false");
    });
  }
  return el(
    "section",
    { classe: "admin-carte", attrs: { "aria-labelledby": "titre-refus", id: "refus-par-cause" } },
    el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id: "titre-refus" }, texte: "Refus d'envoi par cause" }),
    el("p", { classe: "admin-aide", texte: "« Onglet périmé » est attendu après une mise en production. « Rediffusion invalide » est la ligne à surveiller : un rejeu du serveur qui ne correspond pas. Touche un jeu pour le détail par code." }),
    el("div", { classe: "admin-refus__periodes", attrs: { role: "group", "aria-label": "Période" } }, a.b, b.b),
    t24,
    t7,
  );
}
