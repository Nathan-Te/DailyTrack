import type { Resultat, VuePartie } from "@cdj/tower-sim";
import { medailleObtenue, medailleVisee, NOMS_MEDAILLES, TICKS_PAR_SECONDE } from "@cdj/tower-sim";
import { el, formatTemps, medaille, nomMedaille, suivreDialogue } from "@cdj/ui";
import { boutonJouer, coeurs, petiteTour } from "./composants";
import { formatHauteur } from "./hud";
import { langueCourante, t, traducteurDuSocle } from "./i18n";
import { type EtatMedailles, SANS_MEDAILLES, TYPE_MEDAILLE } from "./medailles";

// L'écran de fin de Tower (lots T1 et T3) — **réduit** de la maquette `tower-arrivee.html` à ce qui existe : la hauteur stable, la plus haute atteinte (qui ne compte pas), les vies, la médaille
// obtenue et le bloc « Médailles du jour » (lot T3 : les quatre médailles, celle obtenue en aplat, les autres en contour, et « Or : encore 4,094 m »), « Ta partie » (pièces posées et tombées, temps)
// et « Rejouer ». Ni classement, ni partage, ni message en direct, ni « Jeu suivant du jour » : ces parties **ne sont pas dans le DOM** (aucune place vide) ; elles arrivent au lot T4. Posé sur la scène, sous le voile à rayures, dans la coque vert sapin de l'étiquette de Tower.

export interface Fin {
  readonly ouverte: boolean;
  /** `note` : une ligne sous les médailles (la meilleure de la session, le Diamant du bot), déjà écrite. */
  montrer(vue: VuePartie, r: Resultat, vies: number, medailles?: EtatMedailles, note?: string | null): void;
  /** Les médailles ont fini de se calculer (le bot, hors production) pendant que l'écran est ouvert. */
  majMedailles(medailles: EtatMedailles): void;
  cacher(): void;
  traduire(): void;
}

export function monterFin(racine: HTMLElement, o: { onRejouer(): void; /** Le haut de l'écran : le contenu joué (« Suite d'essai », la date du jour, « Paliers »). */ eyebrow(): string }): Fin {
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
  // Lot T3 : la médaille obtenue (à côté des vies), le bloc « Médailles du jour » (colonne de droite) et, hors production, la ligne du Diamant du bot.
  const legendeMedaille = el("span", { classe: "legende" });
  const medailleNom = el("span", { classe: "fin__medaille-nom", attrs: { id: "fin-medaille" } });
  const tuileMedaille = el("div", { classe: "fin__tuile fin__tuile--medaille", attrs: { hidden: true } }, legendeMedaille, medailleNom);
  const legendeMedailles = el("span", { classe: "legende" });
  const grilleMedailles = el("div", { classe: "fin__medailles-grille" });
  const noteMedailles = el("p", { classe: "fin__medailles-note", attrs: { id: "fin-medailles-note" } });
  const noteSession = el("p", { classe: "fin__medailles-note", attrs: { id: "fin-medailles-session", hidden: true } });
  const tuileMedailles = el("div", { classe: "fin__tuile fin__tuile--medailles", attrs: { id: "fin-medailles", hidden: true } }, legendeMedailles, grilleMedailles, noteMedailles, noteSession);
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
    el("div", { classe: "fin__rang" }, tuileMedaille, tuileVies),
    rejouer,
  );
  const droite = el("div", { classe: "fin__droite" }, tuileMedailles, el("div", { classe: "fin__tuile fin__tuile--partie" }, legendePartie, posees.racine, tombees.racine, temps.racine));
  coque.append(el("div", { classe: "coque__stries", attrs: { "aria-hidden": "true" } }), el("main", { classe: "etiquette-tower" }, gauche, droite));
  voile.append(coque);
  racine.append(voile);
  suivreDialogue(voile, { focusInitial: () => rejouer });

  let ouverte = false;
  let donnees: { vue: VuePartie; r: Resultat; vies: number; medailles: EtatMedailles; session: string | null } | null = null;
  const traduire = () => {
    coque.setAttribute("aria-label", t("fin.aria"));
    eyebrow.textContent = o.eyebrow();
    legendeHauteur.textContent = t("fin.hauteurStable");
    legendeVies.textContent = t("fin.vies");
    legendePartie.textContent = t("fin.partie");
    posees.nom.textContent = t("fin.posees");
    tombees.nom.textContent = t("fin.tombees");
    temps.nom.textContent = t("fin.temps");
    rejouer.textContent = t("fin.rejouer");
    if (!donnees) return;
    const { vue, r, vies, medailles, session } = donnees;
    legendeMedaille.textContent = t("fin.medaille");
    legendeMedailles.textContent = t("fin.medailles");
    tuileMedaille.hidden = tuileMedailles.hidden = !medailles.medailles && !medailles.enCalcul;
    if (medailles.medailles) {
      const m = medailles.medailles;
      const obtenue = medailleObtenue(r.hauteurMm, m);
      medailleNom.textContent = obtenue ? nomMedaille(traducteurDuSocle(), TYPE_MEDAILLE[obtenue]) : t("fin.medaille.aucune");
      // Les quatre médailles, comme la maquette (Bronze, Argent, Or, Diamant) : celle obtenue en aplat, les autres en contour.
      grilleMedailles.replaceChildren(...NOMS_MEDAILLES.map((nom) => medaille(traducteurDuSocle(), { type: TYPE_MEDAILLE[nom], obtenue: nom === obtenue, forme: "case", valeur: formatHauteur(m[nom]) })));
      const visee = medailleVisee(r.hauteurMm, m);
      noteMedailles.replaceChildren();
      noteMedailles.append(visee ? t("fin.medailles.encore", { medaille: nomMedaille(traducteurDuSocle(), TYPE_MEDAILLE[visee.nom]), reste: formatHauteur(visee.reste) }) : t("fin.medailles.toutes"));
      if (medailles.provisoire) noteMedailles.append(` ${t("medailles.provisoire")}.`);
    } else if (medailles.enCalcul) {
      medailleNom.textContent = "…";
      grilleMedailles.replaceChildren();
      noteMedailles.textContent = t("fin.medailles.calcul");
    }
    noteSession.hidden = !session;
    noteSession.textContent = session ?? "";
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
    montrer(vue, r, vies, medailles = SANS_MEDAILLES, session = null) {
      donnees = { vue, r, vies, medailles, session };
      traduire();
      ouverte = true;
      voile.hidden = false;
    },
    majMedailles(medailles) {
      if (!donnees) return;
      donnees = { ...donnees, medailles };
      traduire();
    },
    cacher() {
      ouverte = false;
      voile.hidden = true;
    },
    traduire,
  };
}
