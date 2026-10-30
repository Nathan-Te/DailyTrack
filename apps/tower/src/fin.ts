import type { Resultat, VuePartie } from "@cdj/tower-sim";
import { TICKS_PAR_SECONDE } from "@cdj/tower-sim";
import { el, formatTemps, suivreDialogue } from "@cdj/ui";
import { boutonJouer, coeurs, petiteTour } from "./composants";
import { formatHauteur } from "./hud";
import { langueCourante, t } from "./i18n";

// L'écran de fin de Tower (lot T1) — **réduit** de la maquette `tower-arrivee.html` à ce qui existe au lot T1 : la hauteur stable, la plus haute atteinte (qui ne compte pas), les vies,
// « Ta partie » (pièces posées et tombées, temps) et « Rejouer ». Ni médailles, ni classement, ni partage, ni message en direct, ni « Jeu suivant du jour » : ces parties **ne sont
// pas dans le DOM** (aucune place vide) ; elles arrivent aux lots T3 et T4. Posé sur la scène, sous le voile à rayures, dans la coque vert sapin de l'étiquette de Tower.

export interface Fin {
  readonly ouverte: boolean;
  montrer(vue: VuePartie, r: Resultat, vies: number): void;
  cacher(): void;
  traduire(): void;
}

export function monterFin(racine: HTMLElement, o: { onRejouer(): void }): Fin {
  const voile = el("div", { classe: "voile voile--fin", attrs: { id: "fin-ecran", hidden: true } });
  const coque = el("div", { classe: "coque", attrs: { role: "dialog", "aria-modal": "true" } });
  const eyebrow = el("span", { classe: "fin__eyebrow" });
  const legendeHauteur = el("span", { classe: "legende" });
  const hauteur = el("span", { classe: "fin__hauteur" });
  const plusHaute = el("span", { classe: "fin__max" });
  const replique = el("p", { classe: "fin__replique" });
  const legendeVies = el("span", { classe: "legende legende--papier" });
  const viesHote = el("span", { classe: "fin__coeurs" });
  const tuileVies = el("div", { classe: "fin__tuile fin__tuile--vies" }, legendeVies, viesHote);
  const rejouer = boutonJouer("", () => o.onRejouer(), "fin-rejouer");
  const legendePartie = el("span", { classe: "legende" });
  const ligne = (id: string) => {
    const nom = el("span");
    const valeur = el("b", { attrs: { id } });
    return { racine: el("div", { classe: "fin__ligne" }, nom, valeur), nom, valeur };
  };
  const posees = ligne("fin-posees");
  const tombees = ligne("fin-tombees");
  const temps = ligne("fin-temps");
  const gauche = el(
    "div",
    { classe: "fin__gauche" },
    eyebrow,
    el("div", { classe: "fin__score" }, el("div", { classe: "fin__score-texte" }, legendeHauteur, hauteur, plusHaute), petiteTour()),
    replique,
    tuileVies,
    rejouer,
  );
  const droite = el("div", { classe: "fin__droite" }, el("div", { classe: "fin__tuile fin__tuile--partie" }, legendePartie, posees.racine, tombees.racine, temps.racine));
  coque.append(el("div", { classe: "coque__stries", attrs: { "aria-hidden": "true" } }), el("main", { classe: "etiquette-tower" }, gauche, droite));
  voile.append(coque);
  racine.append(voile);
  suivreDialogue(voile, { focusInitial: () => rejouer });

  let ouverte = false;
  let donnees: { vue: VuePartie; r: Resultat; vies: number } | null = null;
  const traduire = () => {
    coque.setAttribute("aria-label", t("fin.aria"));
    eyebrow.textContent = t("fin.eyebrow");
    legendeHauteur.textContent = t("fin.hauteurStable");
    legendeVies.textContent = t("fin.vies");
    legendePartie.textContent = t("fin.partie");
    posees.nom.textContent = t("fin.posees");
    tombees.nom.textContent = t("fin.tombees");
    temps.nom.textContent = t("fin.temps");
    rejouer.textContent = t("fin.rejouer");
    if (!donnees) return;
    const { vue, r, vies } = donnees;
    hauteur.textContent = formatHauteur(r.hauteurMm);
    plusHaute.textContent = t("fin.plusHaute", { hauteur: formatHauteur(r.hauteurMaxMm) });
    replique.textContent = t(r.motif === "pieces" ? "fin.phrase.pieces" : "fin.phrase.vies");
    viesHote.replaceChildren(coeurs(vies, r.vies, t("hud.vies.aria", { n: r.vies, total: vies })));
    posees.valeur.textContent = `${r.posees}/${vue.total}`;
    tombees.valeur.textContent = String(r.tombees);
    temps.valeur.textContent = formatTemps((r.ticks * 1000) / TICKS_PAR_SECONDE, langueCourante());
  };
  return {
    get ouverte() {
      return ouverte;
    },
    montrer(vue, r, vies) {
      donnees = { vue, r, vies };
      traduire();
      ouverte = true;
      voile.hidden = false;
    },
    cacher() {
      ouverte = false;
      voile.hidden = true;
    },
    traduire,
  };
}
