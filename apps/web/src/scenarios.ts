import {
  createAirTrack,
  createBasCotesTrack,
  createCuvesTrack,
  createFigureTrack,
  createFiguresTrack,
  createGlaceTrack,
  createHerbeTrack,
  createLargeursTrack,
  createPilotageTrack,
  createReliefTrack,
  createSurfacesTrack,
  createTestTrack,
  createVitesseTrack,
  elementGrammaire,
  elementBloc,
  BLOCS_LOT58,
  figureByName,
  FIGURES_LOT49,
  PARTIES_LOT57,
  SAUTS_LOT57,
  TRANSITIONS_LOT57,
  type ElementGrammaire,
  THEMES,
  type PaletteName,
  type ThemeName,
  type Track,
} from "@cdj/sim";
import type { Cadre, el as elDuSocle } from "@cdj/ui";
import type { OptionsCadre } from "./cadre";
import { en as textesEn } from "./catalogue.course.figures.en";
import { fr as textesFr } from "./catalogue.course.figures.fr";

// Les circuits des scénarios d'essai (`?scenario=…`, lots 2 à 21) : écrits à la main, ils n'ont de sens que pour les outils de test. Lot 36 : ils quittent le paquet du
// premier chargement (avec la bibliothèque de figures qu'ils tirent), le jeu les charge (`import()`) seulement quand l'adresse en demande un, ou quand le circuit de
// secours du générateur est nécessaire (`circuitEngine.ts`).

/** Les scénarios connus de l'adresse (`?scenario=`), sauf `figure` et `figure-<nom>` (une figure à part, voir `scenarioTrack`). */
export const SCENARIOS = ["figures", "sauts", "blocs", "plat", "essai", "pilotage", "surfaces", "largeurs", "vitesse", "glace", "relief", "cuves", "air", "bas-cotes", "herbe"] as const;
export type Scenario = (typeof SCENARIOS)[number] | "figure";

/**
 * Le circuit d'un scénario ; `null` pour `plat` (le terrain d'essai du lot 1 n'a pas de circuit) et, pour `figure`, quand le nom est inconnu ou la variante
 * impossible (`?scenario=figure&f=<nom>&v=<variante>&m=1`). Tout autre nom donne le circuit d'essai.
 */
export function scenarioTrack(scenario: string, params: URLSearchParams): Track | null {
  switch (scenario) {
    case "plat":
      return null;
    case "pilotage":
      return createPilotageTrack();
    case "surfaces":
      return createSurfacesTrack();
    case "largeurs":
      return createLargeursTrack();
    case "vitesse":
      return createVitesseTrack();
    case "glace":
      return createGlaceTrack();
    case "relief":
      return createReliefTrack();
    case "cuves":
      return createCuvesTrack();
    case "air":
      return createAirTrack();
    case "bas-cotes":
      return createBasCotesTrack();
    case "herbe":
      return createHerbeTrack();
    case "figures":
      return createFiguresTrack();
    case "sauts":
      // Lot 57 : la page des sauts et des transitions, posée sur le premier saut de la grammaire.
      return createFigureTrack(SAUTS_LOT57[0]!.name);
    case "blocs":
      // Lot 58 : la page des blocs plus complexes, posée sur le premier prototype.
      return createFigureTrack(BLOCS_LOT58[0]!.name);
    case "figure":
      return createFigureTrack(params.get("f") ?? "", Number(params.get("v") ?? 0) || 0, params.get("m") === "1");
    default:
      // Lot 49 : `?scenario=figure-<nom>` (`&v=1` la variante, `&m=1` le miroir), le lien de la page des nouvelles figures.
      if (scenario.startsWith("figure-")) return createFigureTrack(scenario.slice(7), Number(params.get("v") ?? 0) || 0, params.get("m") === "1");
      // Lot 57 : `?scenario=saut-<nom>`, `?scenario=transition-<nom>` (`&v=`, `&m=1`).
      // Lot 58 : `?scenario=bloc-<nom>` (`&v=`, `&m=1`).
      if (elementGrammaire(scenario) || elementBloc(scenario)) return createFigureTrack(scenario, Number(params.get("v") ?? 0) || 0, params.get("m") === "1");
      return createTestTrack();
  }
}

/** La figure demandée par l'adresse : `?scenario=figure&f=<nom>` (lot 20) ou `?scenario=figure-<nom>` (lot 49) ; `null` sinon. */
export function figureDemandee(scenario: string | null, params: URLSearchParams): string | null {
  if (scenario === "figure") return params.get("f") ?? "";
  if (elementGrammaire(scenario) || elementBloc(scenario)) return scenario;
  return scenario?.startsWith("figure-") ? scenario.slice(7) : null;
}

/** La clé d'une figure dans le catalogue : son nom en camelCase (`saut-sortie-virage` → `figures.sautSortieVirage.…`). */
const cleFigure = (nom: string) => `figures.${nom.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`;

/** Lot 49 : les textes de la page des nouvelles figures (fr + en), que le jeu ajoute à son traducteur en chargeant les scénarios (`ajouterTextes`). */
export const TEXTES_FIGURES = { fr: textesFr, en: textesEn };

/**
 * Le nom lisible d'une figure (le titre du scénario `figure`) : celui du catalogue pour une nouveauté du lot 49 (français et anglais), sinon celui de
 * la bibliothèque (lot 20, en français).
 */
export const figureLabel = (name: string | null, t?: (cle: string) => string): string =>
  t && name && (FIGURES_LOT49.includes(name) || elementGrammaire(name) || elementBloc(name)) ? t(`${cleFigure(name)}.titre`) : (figureByName(name)?.label ?? elementGrammaire(name)?.label ?? elementBloc(name)?.label ?? "");

/** La palette d'une figure propre à un thème (`only`, lot 22) : on l'essaie contre son décor ; `null` pour une figure de tous les thèmes. */
export function figurePalette(name: string | null): PaletteName | null {
  // Lot 57 : un élément de la grammaire se joue sur la palette du premier thème qu'on lui propose.
  const only = (figureByName(name)?.only?.[0] ?? (elementGrammaire(name)?.only ?? elementBloc(name)?.themes)?.[0]) as ThemeName | undefined;
  return only ? THEMES[only].palette : null;
}

/** Les outils du jeu prêtés à la page des figures (comme au Garage : importés directement, ils changeraient le découpage du premier chargement). */
export interface OutilsFigures {
  el: typeof elDuSocle;
  creerCadre(o: OptionsCadre): Cadre;
  t(cle: string, params?: Record<string, string | number>): string;
  onLangue(cb: () => void): unknown;
}

/**
 * Lot 49 : la page des nouvelles figures (`?scenario=figures`), posée sur le tour des figures du lot 20. Une ligne par nouveauté : son titre, ce
 * qu'elle demande, ses thèmes, et deux liens (`?scenario=figure-<nom>`, la variante 2) qui gardent les autres paramètres de l'adresse (`debug`…).
 * Fermée (« ‹ TRACK », Échap, « Rouler le tour »), on roule le tour des figures. Deux clics du téléphone jusqu'à une figure.
 */
export function pageFigures(o: OutilsFigures, search: string, page: "figures" | "sauts" | "blocs" = "figures"): { ouvert(): boolean; fermer(): void } {
  const sauts = page !== "figures";
  const cadre = o.creerCadre({ id: "figures-index", titreAria: page === "blocs" ? "blocs.index.aria" : page === "sauts" ? "sauts.index.aria" : "figures.index.aria", retour: "jeu", onRetour: () => fermer() });
  const lien = (nom: string, variante: number, miroir = false) => {
    const p = new URLSearchParams(search);
    for (const k of ["scenario", "f", "v", "m"]) p.delete(k);
    p.set("scenario", sauts ? nom : `figure-${nom}`);
    if (variante > 0) p.set("v", String(variante));
    if (miroir) p.set("m", "1");
    return `?${p.toString()}`;
  };
  /** Lot 57 : une ligne de la page des sauts et des transitions (titre, ce qu'il demande, ses parties, ses thèmes, ses variantes et le miroir). */
  const ligne = (e: ElementGrammaire): HTMLElement => {
    const pt = (x: string) => o.t(`sauts.partie.${x}`);
    const pa = PARTIES_LOT57[e.name];
    const boutons = [o.el("a", { classe: ["dj-bouton", "dj-bouton--marque"], attrs: { href: lien(e.name, 0) }, texte: o.t("figures.index.essayer") })];
    if (e.variants > 1) boutons.push(o.el("a", { classe: ["dj-bouton", "dj-bouton--secondaire"], attrs: { href: lien(e.name, 1) }, texte: o.t("figures.index.variante") }));
    boutons.push(o.el("a", { classe: ["dj-bouton", "dj-bouton--secondaire"], attrs: { href: lien(e.name, 0, true) }, texte: o.t("sauts.index.miroir") }));
    return o.el(
      "section",
      { attrs: { "data-figure": e.name } },
      o.el("h2", { classe: "etiquette__sous-titre", texte: o.t(`${cleFigure(e.name)}.titre`) }),
      o.el("p", { classe: "note", texte: o.t(`${cleFigure(e.name)}.quoi`) }),
      ...("famille" in e ? [o.el("p", { classe: "legende", texte: o.t("blocs.index.famille", { famille: o.t(`blocs.famille.${String(e.famille)}`) }) })] : []),
      ...(pa
        ? [o.el("p", { classe: "legende", texte: o.t("sauts.index.parties", { approche: pt(pa.approche), appel: pt(pa.appel), vol: pt(pa.vol), reception: pa.reception.map(pt).join(", "), sortie: pt(pa.sortie), vitesse: pt(pa.vitesse) }) })]
        : []),
      o.el("p", { classe: "legende", texte: o.t("figures.index.themes", { liste: (e.only ?? []).map((th) => o.t(`theme.${th}`)).join(", ") }) }),
      o.el("div", { classe: ["actions", "actions--duo"] }, ...boutons),
    );
  };
  const dessiner = () => {
    if (page === "blocs") {
      cadre.corps.replaceChildren(o.el("h1", { classe: "etiquette__titre", texte: o.t("blocs.index.titre") }), o.el("p", { classe: "note", texte: o.t("blocs.index.intro") }), ...BLOCS_LOT58.map(ligne));
      return;
    }
    if (sauts) {
      cadre.corps.replaceChildren(
        o.el("h1", { classe: "etiquette__titre", texte: o.t("sauts.index.titre") }),
        o.el("p", { classe: "note", texte: o.t("sauts.index.intro") }),
        o.el("h2", { classe: "etiquette__titre", texte: o.t("sauts.index.sauts") }),
        ...SAUTS_LOT57.map(ligne),
        o.el("h2", { classe: "etiquette__titre", texte: o.t("sauts.index.transitions") }),
        ...TRANSITIONS_LOT57.map(ligne),
      );
      return;
    }
    const lignes: HTMLElement[] = [o.el("h1", { classe: "etiquette__titre", texte: o.t("figures.index.titre") }), o.el("p", { classe: "note", texte: o.t("figures.index.intro") })];
    for (const nom of FIGURES_LOT49) {
      const only = figureByName(nom)?.only;
      const themes = only ? o.t("figures.index.themes", { liste: only.map((th) => o.t(`theme.${th}`)).join(", ") }) : o.t("figures.index.tous");
      lignes.push(
        o.el(
          "section",
          { attrs: { "data-figure": nom } },
          o.el("h2", { classe: "etiquette__sous-titre", texte: o.t(`${cleFigure(nom)}.titre`) }),
          o.el("p", { classe: "note", texte: o.t(`${cleFigure(nom)}.quoi`) }),
          o.el("p", { classe: "legende", texte: themes }),
          o.el(
            "div",
            { classe: ["actions", "actions--duo"] },
            o.el("a", { classe: ["dj-bouton", "dj-bouton--marque"], attrs: { href: lien(nom, 0) }, texte: o.t("figures.index.essayer") }),
            o.el("a", { classe: ["dj-bouton", "dj-bouton--secondaire"], attrs: { href: lien(nom, 1) }, texte: o.t("figures.index.variante") }),
          ),
        ),
      );
    }
    const tour = o.el("button", { classe: ["dj-bouton", "dj-bouton--secondaire"], attrs: { type: "button", id: "figures-tour" }, texte: o.t("figures.index.tour") });
    tour.addEventListener("click", () => fermer());
    lignes.push(o.el("div", { classe: "actions" }, tour));
    cadre.corps.replaceChildren(...lignes);
  };
  dessiner();
  o.onLangue(dessiner);
  if (!cadre.racine.isConnected) document.body.append(cadre.racine);
  cadre.racine.hidden = false;
  let ouvert = true;
  function fermer() {
    ouvert = false;
    cadre.racine.hidden = true;
  }
  return { ouvert: () => ouvert, fermer };
}
