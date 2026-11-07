import { el, svg } from "@cdj/ui";

// Lot U1 (charte rév. 19, § 9) — les pièces de « la salle de jeux » : la barre du portail avec sa navigation et sa cloche, la barre d'onglets du téléphone, le fronton et la semaine en lampes.
// Des fonctions de présentation pures : elles reçoivent des textes déjà traduits (comme `boutonFavori`) et ne lisent ni le serveur ni le stockage. Feuille : `salle.css`.
// Elles vivent dans le portail (et non dans `@cdj/ui`) : les jeux ne paient aucun octet de plus. Les pages Classements, Amis et groupes et Profil les reprendront (lots U2 et U3).

/** Les quatre pages de la navigation (la page de l'accueil est « Aujourd'hui »). */
export type PageNav = "aujourdhui" | "classements" | "amis" | "profil";
export const PAGES_NAV: readonly PageNav[] = ["aujourdhui", "classements", "amis", "profil"];

/** Les adresses des quatre pages vues d'une page à la racine du site (`""`) ou d'un dossier (`"../"`). */
export const adresseNav = (page: PageNav, racine = ""): string => (page === "aujourdhui" ? racine || "./" : `${racine}${page === "classements" ? "classement" : page}/`);

export interface ItemNav {
  id: PageNav;
  /** Le texte de l'onglet du haut. */
  texte: string;
  /** Le mot court sous l'icône de la barre du bas (« Amis »). */
  court: string;
}

// Les icônes de la navigation (grille de 24, trait de 2,2 px, extrémités carrées) : à elles seules, un `aria-hidden` ; le mot est écrit à côté.
const TRACES: Record<PageNav | "cloche" | "fermer", readonly string[]> = {
  fermer: ["M5 5l14 14M19 5L5 19"],
  aujourdhui: ["M3 5h18v16H3z", "M3 10h18M8 3v4M16 3v4"],
  classements: ["M6 21V11M12 21V5M18 21v-7"],
  amis: ["M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z", "M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5", "M17 6.5a2.5 2.5 0 1 1 0 5", "M17 14.5c2.3.3 3.9 2 4.5 4.5"],
  profil: ["M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M4 21c1-4 4.2-6.5 8-6.5s7 2.5 8 6.5"],
  cloche: ["M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z", "M10 20.5a2.2 2.2 0 0 0 4 0"],
};

export function pictogramme(nom: keyof typeof TRACES, taille: number): SVGSVGElement {
  return svg(
    "svg",
    { classe: ["dj-icone", `dj-icone--${nom}`], attrs: { viewBox: "0 0 24 24", width: taille, height: taille, fill: "none", stroke: "currentColor", "stroke-width": 2.2, "stroke-linecap": "square", "stroke-linejoin": "miter", focusable: "false", "aria-hidden": "true" } },
    ...TRACES[nom].map((d) => svg("path", { attrs: { d } })),
  );
}

/**
 * La navigation : `haut` = les onglets de la barre (Archivo Black, l'onglet ouvert en encre plein) ; `bas` = la barre d'onglets du téléphone (icône et mot, l'onglet ouvert en encre avec
 * l'icône en terre). Une seule des deux se voit à la fois (la feuille de style). `data-nav-onglets` : LB et RB de la manette passent d'un lien à l'autre (`packages/ui/src/manette.ts`).
 */
export function navigation(o: { items: readonly ItemNav[]; ici: PageNav; aria: string; place: "haut" | "bas"; racine?: string }): HTMLElement {
  return el(
    "nav",
    { classe: o.place === "haut" ? "salle-nav" : "salle-onglets", attrs: { "aria-label": o.aria, "data-nav-onglets": o.place } },
    ...o.items.map((i) =>
      el(
        "a",
        { classe: i.id === o.ici ? "ici" : undefined, attrs: { href: adresseNav(i.id, o.racine), "aria-current": i.id === o.ici ? "page" : null, "data-cle": `nav-${o.place}-${i.id}` } },
        o.place === "bas" ? pictogramme(i.id, 24) : null,
        o.place === "bas" ? i.court : i.texte,
      ),
    ),
  );
}

export interface OptionsBarre {
  logo: HTMLElement;
  navigation: HTMLElement;
  langue: HTMLElement;
  cloche: HTMLElement;
  avatar: HTMLElement;
}

/** La barre du portail : logo à gauche, navigation, puis à droite la langue (cachée sur téléphone : elle est dans le profil), la cloche et l'avatar. */
export function barreSalle(o: OptionsBarre): HTMLElement {
  return el("header", { classe: "salle-barre" }, o.logo, o.navigation, el("div", { classe: "salle-barre__outils" }, o.langue, o.cloche, o.avatar));
}

export interface LigneCloche {
  /** Le petit titre de la ligne (« Dernière nouveauté », « Mes messages »). */
  legende: string;
  texte: string;
  href: string;
  /** Un point terre : quelque chose n'est pas lu. */
  nonLue: boolean;
}

export interface OptionsCloche {
  /** Le nom lu du bouton, qui dit aussi quand quelque chose n'est pas lu. */
  nom: string;
  /** Un point terre sur la cloche tant qu'une nouveauté ou une réponse n'est pas lue. */
  point: boolean;
  ouverte: boolean;
  titre: string;
  fermer: string;
  lignes: readonly LigneCloche[];
  /** Quand il n'y a rien à montrer. */
  vide: string;
  onBasculer: () => void;
}

/** La cloche et sa petite feuille (la dernière nouveauté, les réponses non lues de « Mes messages »). Le bouton porte `aria-expanded` ; la feuille est un dialogue non modal fermé par Échap ou par la croix. */
export function cloche(o: OptionsCloche): HTMLElement {
  const bouton = el("button", { classe: "salle-cloche__bouton", attrs: { type: "button", "aria-expanded": String(o.ouverte), "aria-controls": "salle-feuille", "aria-haspopup": "dialog", "aria-label": o.nom, "data-cle": "cloche", id: "cloche" } }, pictogramme("cloche", 22));
  bouton.addEventListener("click", o.onBasculer);
  const fermer = el("button", { classe: "salle-feuille__fermer", attrs: { type: "button", "aria-label": o.fermer, "data-cle": "cloche-fermer" } }, pictogramme("fermer", 18));
  fermer.addEventListener("click", o.onBasculer);
  const feuille = o.ouverte
    ? el(
        "div",
        { classe: "salle-feuille", attrs: { id: "salle-feuille", role: "dialog", "aria-label": o.titre } },
        el("div", { classe: "salle-feuille__tete" }, el("p", { classe: "salle-feuille__titre", texte: o.titre }), fermer),
        o.lignes.length > 0
          ? el(
              "ul",
              { classe: "salle-feuille__liste" },
              ...o.lignes.map((l) =>
                el(
                  "li",
                  {},
                  el(
                    "a",
                    { classe: "salle-feuille__ligne", attrs: { href: l.href, "data-non-lue": l.nonLue ? "oui" : "non" } },
                    el("span", { classe: "salle-feuille__legende", texte: l.legende }),
                    el("span", { classe: "salle-feuille__texte", texte: l.texte }),
                    l.nonLue ? el("span", { classe: "salle-feuille__point", attrs: { "aria-hidden": "true" } }) : null,
                  ),
                ),
              ),
            )
          : el("p", { classe: "salle-feuille__vide", texte: o.vide }),
      )
    : null;
  return el("div", { classe: "salle-cloche" }, bouton, o.point ? el("span", { classe: "salle-cloche__point", attrs: { "aria-hidden": "true", id: "cloche-point" } }) : null, feuille);
}

export type EtatLampe = "parfaite" | "jouee" | "moitie" | "rien";

export interface Lampe {
  /** La lettre du jour (« L », « M »…). */
  lettre: string;
  /** Ce que lit un lecteur d'écran : « lundi, journée parfaite ». */
  nom: string;
  etat: EtatLampe;
  aujourdhui: boolean;
}

/** La semaine en lampes : 7 ronds (pleins = journée parfaite, contour = jouée, moitié = aujourd'hui en cours, éteints sinon) et la légende dessous. Sans lampes (le serveur n'a pas répondu), la place est réservée. */
export function semaineEnLampes(o: { lampes: readonly Lampe[] | null; legende: string; aria: string }): HTMLElement {
  return el(
    "div",
    { classe: "salle-semaine", attrs: { id: "semaine" } },
    o.lampes
      ? el(
          "ol",
          { classe: "salle-lampes", attrs: { "aria-label": o.aria } },
          ...o.lampes.map((l) =>
            el(
              "li",
              { classe: ["salle-lampe", `salle-lampe--${l.etat}`, l.aujourdhui && "salle-lampe--ajd"], attrs: { "data-etat": l.etat } },
              el("i", { attrs: { "aria-hidden": "true" } }),
              el("span", { attrs: { "aria-hidden": "true" }, texte: l.lettre }),
              el("span", { classe: "dj-cache", texte: l.nom }),
            ),
          ),
        )
      : el("div", { classe: "salle-lampes salle-lampes--reservees", attrs: { "aria-hidden": "true" } }),
    el("p", { classe: "salle-semaine__legende", texte: o.lampes ? o.legende : "" }),
  );
}

/** Le fronton : la bande encre sous la barre, ses ampoules (un motif de la feuille), la date, le numéro de la journée, la semaine en lampes et le compte à rebours. */
export function fronton(o: { date: string; journee: string | null; semaine: HTMLElement; compte: HTMLElement }): HTMLElement {
  return el(
    "section",
    { classe: "salle-fronton" },
    el(
      "div",
      { classe: "salle-fronton__dedans" },
      el("div", { classe: "salle-fronton__titre" }, el("p", { classe: "salle-fronton__date", attrs: { id: "date" }, texte: o.date }), o.journee ? el("span", { classe: "salle-fronton__journee", attrs: { id: "journee" }, texte: o.journee }) : null),
      o.semaine,
      o.compte,
    ),
  );
}

/** Le compte à rebours du fronton : la légende en capitales et les chiffres JetBrains Mono moutarde (`battre` n'en change que la valeur). */
export function compteDuFronton(o: { legende: string; valeur: string }): HTMLElement {
  return el("div", { classe: "salle-compte", attrs: { id: "compte" } }, el("span", { classe: "salle-compte__legende", texte: o.legende }), el("span", { classe: "salle-compte__valeur", texte: o.valeur }));
}

/** Le titre d'une zone de l'accueil (« JEUX DU JOUR », « ARCADE ») avec, à droite, un petit texte (l'avancement). */
export function titreDeZone(o: { id: string; texte: string; droite?: HTMLElement | null; classe?: string }): HTMLElement {
  return el("div", { classe: ["salle-titre", o.classe] }, el("h2", { classe: "salle-titre__texte", attrs: { id: o.id }, texte: o.texte }), o.droite ?? null);
}

// --- Lot U1, partie 2 : la colonne de droite --------------------------------------------------------------------------------------------------------

/** Un panneau de la colonne de droite : un cadre papier (bordure 3 px, ombre nette) avec son titre en Archivo Black. */
export function panneau(o: { id: string; titre?: string; classe?: string }, ...enfants: (Node | null)[]): HTMLElement {
  return el(
    "section",
    { classe: ["salle-panneau", o.classe], attrs: { id: o.id, ...(o.titre ? { "aria-labelledby": `${o.id}-titre` } : {}) } },
    o.titre ? el("h2", { classe: "salle-panneau__titre", attrs: { id: `${o.id}-titre` }, texte: o.titre }) : null,
    ...enfants,
  );
}

/** La progression de la journée : un segment par jeu de ta journée, plein quand il est fini. */
export function progression(o: { total: number; finis: number; aria: string }): HTMLElement {
  return el("div", { classe: "salle-progres", attrs: { role: "img", "aria-label": o.aria } }, ...Array.from({ length: o.total }, (_, i) => el("i", { classe: i < o.finis ? "on" : undefined })));
}

export interface ChoixVue {
  id: string;
  texte: string;
}
/** Un sélecteur segmenté (Tous · Amis · Mon groupe) : des boutons `aria-pressed`, le choisi en encre plein. */
export function selecteurDeVue(o: { aria: string; choix: readonly ChoixVue[]; actif: string; onChoix: (id: string) => void }): HTMLElement {
  return el(
    "div",
    { classe: "salle-seg", attrs: { role: "group", "aria-label": o.aria } },
    ...o.choix.map((c) => {
      const b = el("button", { classe: "salle-seg__bouton", attrs: { type: "button", "aria-pressed": String(c.id === o.actif), "data-vue": c.id, "data-cle": `vue-${c.id}` } }, c.texte);
      b.addEventListener("click", () => {
        if (c.id !== o.actif) o.onChoix(c.id);
      });
      return b;
    }),
  );
}

/** L'emblème d'un groupe : un carré à coins de 8 px, son image ou les deux premières lettres de son nom (décoratif : le nom est écrit à côté). Lot U2 : `taille` (22 · 48 · 52 · 72, charte § 9) ; 52 par défaut. */
export function emblemeDeGroupe(o: { initiales: string; image?: string; taille?: 22 | 48 | 52 | 72 }): HTMLElement {
  const px = o.taille ?? 52;
  return el("span", { classe: ["salle-embleme", o.taille && `salle-embleme--t${o.taille}`], attrs: { "aria-hidden": "true" } }, o.image ? el("img", { attrs: { src: o.image, alt: "", width: px, height: px, loading: "lazy", decoding: "async" } }) : o.initiales);
}
