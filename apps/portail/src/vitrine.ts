import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/cadre.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-500.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-600.css";
import "@cdj/ui/src/polices/barlow-condensed-700-italique.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./vitrine.css";
import { parisDay } from "@cdj/clock";
import { ecrireLangue, lireLangue, type Langue } from "@cdj/profile";
import {
  CATALOGUE_COMMUN,
  COULEURS,
  ICONES,
  LANGUES,
  MEDAILLES,
  PAIRES,
  afficheur,
  astuceIphone,
  bandeauAnnonce,
  avatar,
  barreJeu,
  barrePortail,
  bouton,
  boutonFantome,
  boutonPleinEcran,
  cartouche,
  choixLangue,
  creerCadre,
  el,
  etiquetteJump,
  etiquetteTrack,
  formatNombre,
  formatNumeroJour,
  formatTemps,
  icone,
  logo,
  medaille,
  traducteur,
  tuile,
  valeurJeton,
  verifierPaire,
  type Jeu,
  type NomCouleur,
  type VarianteBouton,
} from "@cdj/ui";
import { CATALOGUE_VITRINE } from "./catalogueVitrine";
import { stockageDuPortail } from "./stockage";

// La vitrine des composants (`/ui/`, lot I1) : chaque composant de @cdj/ui dans tous ses états, en français ET en anglais (côte à côte), sur
// fond crème et sur asphalte, les médailles, la table des couleurs et les contrastes calculés des paires déclarées. Pour que Nathan valide le
// rendu à l'œil (seed-phase-3.md § 8). Recette et aperçus seulement : jamais construite pour la production (scripts/site.mjs).
// Les textes de la page suivent la langue de la plateforme ; les blocs « fr » et « en » montrent chacun les composants dans leur langue.

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_VITRINE, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;

const ETATS = ["normal", "survol", "appui", "focus", "desactive"] as const;
const VARIANTES: readonly VarianteBouton[] = ["marque", "secondaire", "track", "jump"];
const CLE_ETAT = { normal: "vitrine.etat.normal", survol: "vitrine.etat.survol", appui: "vitrine.etat.appui", focus: "vitrine.etat.focus", desactive: "vitrine.etat.desactive" } as const;
const CLE_BOUTON = { marque: "vitrine.bouton.marque", secondaire: "vitrine.bouton.secondaire", track: "vitrine.bouton.track", jump: "vitrine.bouton.jump" } as const;
const CLE_ICONE = { chevron: "icone.chevron", flamme: "icone.flamme", crane: "icone.crane", drapeau: "icone.drapeau", horloge: "icone.horloge", profil: "icone.profil", pleinEcran: "pleinEcran.entrer", pleinEcranQuitter: "pleinEcran.quitter", camera: "icone.camera" } as const;
/** Seuils de démonstration (ms) et médailles obtenues pour l'exemple. */
const SEUILS = { diamant: 29_880, or: 31_500, argent: 34_000, bronze: 38_000 } as const;

function section(titre: string, id: string, ...contenu: HTMLElement[]): HTMLElement {
  return el("section", { classe: "vitrine-section", attrs: { id, "aria-labelledby": `${id}-titre` } }, el("h2", { classe: "vitrine-section__titre", attrs: { id: `${id}-titre` }, texte: titre }), ...contenu);
}

function etiquetteEtat(t: T, cle: keyof typeof CLE_ETAT): HTMLElement {
  return el("span", { classe: "vitrine-etat", texte: t.t(CLE_ETAT[cle]) });
}

/** La grille des boutons : variantes × états. */
function boutons(t: T): HTMLElement {
  return el(
    "div",
    { classe: "vitrine-grille vitrine-grille--boutons" },
    ...VARIANTES.flatMap((v) =>
      ETATS.map((e) =>
        el(
          "div",
          { classe: "vitrine-case" },
          bouton({ texte: t.t(CLE_BOUTON[v]), variante: v, desactive: e === "desactive", etat: e === "survol" ? "est-survol" : e === "appui" ? "est-appui" : e === "focus" ? "est-focus" : undefined }),
          etiquetteEtat(t, e),
        ),
      ),
    ),
  );
}

function medailles(t: T, jeu: Jeu | undefined): HTMLElement {
  return el(
    "div",
    { classe: "vitrine-medailles" },
    el("div", { classe: "vitrine-grille vitrine-grille--4" }, ...MEDAILLES.map((m) => medaille(t, { type: m, obtenue: m !== "diamant", forme: "case", jeu, valeur: formatTemps(SEUILS[m], t.langue) }))),
    el("div", { classe: "vitrine-grille vitrine-grille--4" }, ...MEDAILLES.map((m) => medaille(t, { type: m, obtenue: false, forme: "case", jeu, valeur: formatTemps(SEUILS[m], t.langue) }))),
  );
}

/**
 * Lot I4b : le cadre d'un écran de jeu posé sur sa scène (`creerCadre`), dans une boîte qui figure la scène : la barre (« ‹ <JEU> » qui ferme l'écran),
 * l'étiquette du jeu et le pied (« Jeu suivant du jour »). Dans le jeu, le cadre couvre tout l'écran (`position: fixed`) ; ici il remplit sa boîte.
 */
function cadreSurScene(t: T, jeu: Jeu, jour: number): HTMLElement {
  const nom = t.t(jeu === "track" ? "jeu.track.titre" : "jeu.jump.titre");
  const cadre = creerCadre({
    etiquette: jeu === "track" ? "dj-etiquette track-etiquette dj-sombre" : "dj-etiquette jump-etiquette",
    aria: () => t.t("vitrine.cadre.titre"),
    barre: () => barreJeu(t, { href: "#", jour, numero: 12, retour: { texte: nom, ariaLabel: nom, onClick: () => undefined } }),
  });
  cadre.corps.append(el("h3", { classe: jeu === "track" ? "track-etiquette__titre" : "jump-etiquette__titre", texte: t.t("vitrine.cadre.titre") }), el("p", { texte: t.t(jeu === "track" ? "vitrine.etiquette.track" : "vitrine.etiquette.jump") }));
  cadre.pied.append(bouton({ texte: t.t("arrivee.jeuSuivant", { jeu: t.t(jeu === "track" ? "jeu.jump.nom" : "jeu.track.nom") }), href: "#", pleineLargeur: true }));
  cadre.racine.hidden = false;
  return el("div", { classe: ["vitrine-scene", `vitrine-scene--${jeu}`] }, cadre.racine);
}

/** Un iPhone, le temps d'un appel : sans plein écran de page, agent d'iPhone (la vitrine est une recette : l'astuce ne se montre que là). */
function surIphone<T>(construire: () => T): T {
  Object.defineProperty(navigator, "userAgent", { value: "iPhone", configurable: true });
  Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true }); // lot 53 : l'iPhone est reconnu par la fonction (écran tactile, pas de plein écran de page)
  try {
    return construire();
  } finally {
    Reflect.deleteProperty(navigator, "userAgent");
    Reflect.deleteProperty(document, "fullscreenEnabled");
    Reflect.deleteProperty(navigator, "maxTouchPoints");
  }
}

/** Lot G1 : un bouton fantôme (en jeu son nom lu dit le fantôme choisi : « Fantôme : ton record »). */
function fantome(t: T, classe: string[]): HTMLButtonElement {
  const b = boutonFantome({ classe, onClick: () => undefined });
  b.setAttribute("aria-label", t.t("vitrine.fantome"));
  return b;
}

/** Lot I7 : le bouton plein écran (normal, en plein écran, sur asphalte, dans la barre des jeux) et l'astuce de l'iPhone. */
function pleinEcran(t: T, jour: number): HTMLElement[] {
  // Les deux états côte à côte : le bouton réel, puis l'état « en plein écran » posé à la main (la vitrine ne bascule pas la page).
  const mettre = (actif: boolean, classe: string) => {
    const b = boutonPleinEcran({ t: (cle) => t.t(cle), classe });
    b.hidden = false;
    if (actif) {
      b.setAttribute("aria-pressed", "true");
      b.setAttribute("aria-label", t.t("pleinEcran.quitter"));
      b.replaceChildren(icone("pleinEcranQuitter", { taille: 20 }));
    }
    return b;
  };
  const memoire = new Map<string, string>();
  const stockage = { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => void memoire.set(k, v) };
  const astuce = surIphone(() => astuceIphone({ textes: () => ({ astuce: t.t("pleinEcran.iphone"), fermer: t.t("pleinEcran.iphone.fermer") }), stockage }));
  // Lot 53 : l'aide que le bouton ouvre sur iPhone, et « Retrouver mon profil » (le premier lancement de l'application ajoutée à l'écran d'accueil) : deux écrans en
  // surimpression, chargés à la demande ; ici le profil « trouvé » est fictif (rien ne part sur le réseau, rien n'est adopté).
  const ouvrirAide = bouton({ texte: t.t("vitrine.pleinEcran.aide"), variante: "secondaire", onClick: () => void import("@cdj/ui/src/aideIphone").then((m) => m.aidePleinEcran()) });
  const ouvrirRetrouver = bouton({
    texte: t.t("vitrine.pleinEcran.retrouver"),
    variante: "secondaire",
    onClick: () =>
      void import("@cdj/ui/src/retrouver").then((m) =>
        m.retrouverMonProfil({
          erreur: () => null,
          verifier: async (saisi) => (saisi.trim() ? { ok: true, pseudo: "Nathan", jours: 12, adopter: () => true } : { ok: false, erreur: "vide" }),
          onPasser: () => undefined,
          onRetrouve: () => undefined,
        }),
      ),
  });
  return [
    el("div", { classe: "vitrine-ligne" }, mettre(false, "dj-plein-ecran--barre"), mettre(true, "dj-plein-ecran--barre")),
    el("div", { classe: "vitrine-ligne" }, ouvrirAide, ouvrirRetrouver),
    el("div", { classe: "vitrine-asphalte dj-sombre vitrine-ligne" }, mettre(false, "plaque-vitrine"), mettre(true, "plaque-vitrine")),
    barreJeu(t, { href: "../", jour, numero: 12, pleinEcran: true }),
    // Lot G1 : le bouton fantôme (« passer au fantôme suivant »), seul et à côté du plein écran, sur crème et sur asphalte.
    el("div", { classe: "vitrine-ligne" }, fantome(t, ["dj-plein-ecran--icone", "dj-plein-ecran--barre"]), el("span", { classe: "vitrine-asphalte dj-sombre vitrine-ligne" }, fantome(t, ["dj-plein-ecran--icone", "plaque-vitrine"]))),
    ...(astuce ? [astuce] : []),
  ];
}

/** Tous les composants dans une langue. */
function bloc(l: Langue): HTMLElement {
  const t = traduire(l);
  const jour = parisDay(Date.now());
  return el(
    "div",
    { classe: "vitrine-langue", attrs: { lang: l, "data-langue-bloc": l } },
    el("h2", { classe: "vitrine-langue__titre", texte: t.t(l === "fr" ? "langue.fr.nom" : "langue.en.nom") }),
    section(
      t.t("vitrine.section.marque"),
      `marque-${l}`,
      el("div", { classe: "vitrine-ligne" }, logo(t), logo(t, { taille: "petit" })),
      barrePortail(t, { langue: l, pseudo: "Nathan", profil: "#" }),
      barrePortail(t, { langue: l, pseudo: null, profil: "#" }),
      barreJeu(t, { href: "../", jour, numero: 12 }),
      // Lot I4 : le retour d'un écran d'un jeu vers l'accueil du jeu (« ‹ TRACK », un bouton).
      barreJeu(t, { href: "#", jour, numero: 12, retour: { texte: t.t("jeu.track.titre"), ariaLabel: t.t("jeu.track.nom"), onClick: () => undefined } }),
      el("div", { classe: "vitrine-ligne" }, choixLangue(t, { langue: l }), avatar(t, { pseudo: "Kiwi" }), avatar(t, { pseudo: null })),
      // Lot I2 : l'avatar lien vers le profil commun (normal, survol, appui, focus ; sans pseudo).
      el(
        "div",
        { classe: "vitrine-ligne" },
        ...["", "est-survol", "est-appui", "est-focus"].map((etat) => {
          const a = avatar(t, { pseudo: "Kiwi", href: "#" });
          if (etat) a.classList.add(etat);
          return a;
        }),
        avatar(t, { pseudo: null, href: "#" }),
      ),
    ),
    section(t.t("vitrine.section.pleinEcran"), `plein-ecran-${l}`, ...pleinEcran(t, jour)),
    // Lot N2 : le message en direct, dans ses deux tons (la croix d'« Important » est montrée tout de suite : le délai de 10 s n'a pas de sens dans une vitrine).
    section(
      t.t("vitrine.section.bandeau"),
      `bandeau-${l}`,
      bandeauAnnonce(t, { texte: t.t("vitrine.bandeau.information"), ton: "information" }),
      bandeauAnnonce(t, { texte: t.t("vitrine.bandeau.important"), ton: "important", fermableApresMs: 0 }),
    ),
    section(
      t.t("vitrine.section.boutons"),
      `boutons-${l}`,
      el("h3", { classe: "vitrine-sous-titre", texte: t.t("vitrine.fond.creme") }),
      boutons(t),
      el("div", { classe: "vitrine-asphalte dj-sombre" }, el("h3", { classe: "vitrine-sous-titre", texte: t.t("vitrine.fond.asphalte") }), boutons(t)),
    ),
    section(
      t.t("vitrine.section.cartouches"),
      `cartouches-${l}`,
      el(
        "div",
        { classe: "vitrine-etagere" },
        cartouche({
          jeu: "track",
          etiquette: etiquetteTrack({ titre: t.t("jeu.track.titre"), numero: formatNumeroJour(12, l), texte: t.t("vitrine.etiquette.track"), niveau: "h3" }),
          action: bouton({ texte: t.t("vitrine.bouton.marque"), href: "#", pleineLargeur: true }),
        }),
        cartouche({
          jeu: "jump",
          etiquette: etiquetteJump({ titre: t.t("jeu.jump.titre"), numero: formatNumeroJour(12, l), texte: t.t("vitrine.etiquette.jump"), niveau: "h3" }),
          action: bouton({ texte: t.t("vitrine.bouton.marque"), href: "#", pleineLargeur: true }),
        }),
        cartouche({ etiquette: el("div", { classe: "dj-etiquette vitrine-etiquette-vide" }, logo(t)) }),
      ),
    ),
    section(t.t("vitrine.section.cadre"), `cadre-${l}`, el("p", { classe: "vitrine-intro", texte: t.t("vitrine.cadre.intro") }), cadreSurScene(t, "track", jour), cadreSurScene(t, "jump", jour)),
    section(
      t.t("vitrine.section.tuiles"),
      `tuiles-${l}`,
      el(
        "div",
        { classe: "vitrine-grille vitrine-grille--2" },
        tuile({ legende: t.t("vitrine.tuile.legende"), valeur: t.t("vitrine.tuile.valeur", { n: 5 }), sousTexte: t.t("vitrine.tuile.sous", { n: 2 }), icone: icone("flamme", { taille: 22 }) }),
        tuile({ legende: t.t("vitrine.tuile.legende"), valeur: t.t("vitrine.tuile.valeur", { n: 1 }), sousTexte: t.t("vitrine.tuile.sous", { n: 1 }) }),
      ),
      afficheur({ legende: t.t("vitrine.afficheur.legende"), valeur: "07:42:18" }),
    ),
    section(
      t.t("vitrine.section.medailles"),
      `medailles-${l}`,
      el("div", { classe: "vitrine-ligne" }, ...MEDAILLES.map((m) => medaille(t, { type: m, obtenue: true })), ...MEDAILLES.map((m) => medaille(t, { type: m, obtenue: false }))),
      medailles(t, undefined),
      el("div", { classe: "vitrine-asphalte dj-sombre" }, medailles(t, "track")),
      el("div", { classe: "vitrine-jaune" }, medailles(t, "jump")),
    ),
    section(
      t.t("vitrine.section.icones"),
      `icones-${l}`,
      el("div", { classe: "vitrine-ligne" }, ...ICONES.map((n) => el("span", { classe: "vitrine-icone" }, icone(n, { label: t.t(CLE_ICONE[n]), taille: 28 }), el("span", { attrs: { "aria-hidden": "true" }, texte: t.t(CLE_ICONE[n]) })))),
      el("div", { classe: "vitrine-asphalte dj-sombre vitrine-ligne" }, ...ICONES.map((n) => icone(n, { label: t.t(CLE_ICONE[n]), taille: 28 }))),
    ),
  );
}

/** La table des couleurs et celle des contrastes (rapports calculés, seuils de la charte § 10). */
function couleurs(t: T): HTMLElement[] {
  const table = el(
    "div",
    { classe: "vitrine-nuancier" },
    ...(Object.keys(COULEURS) as NomCouleur[]).map((nom) =>
      el("div", { classe: "vitrine-nuance" }, el("span", { classe: "vitrine-nuance__pastille", style: { background: `var(--${nom})` } }), el("code", { texte: `--${nom}` }), el("code", { classe: "vitrine-nuance__valeur", texte: valeurJeton(nom) })),
    ),
  );
  const lignes = PAIRES.map((p) => {
    const r = verifierPaire(p);
    return el(
      "tr",
      { attrs: { "data-ok": String(r.ok) } },
      el("td", {}, el("span", { classe: "vitrine-exemple", style: { color: `var(--${p.couleur})`, background: `var(--${p.fond})` }, texte: t.t("vitrine.contraste.exemple") })),
      el("td", {}, el("code", { texte: p.couleur })),
      el("td", {}, el("code", { texte: p.fond })),
      el("td", { classe: "dj-chiffres", texte: `${formatNombre(r.rapport, t.langue, 2)}:1` }),
      el("td", { classe: "dj-chiffres", texte: `${formatNombre(r.seuil, t.langue, 1)}:1` }),
      el("td", { texte: t.t(r.ok ? "vitrine.contraste.ok" : "vitrine.contraste.ko") }),
    );
  });
  const contrastes = el(
    "table",
    { classe: "vitrine-contrastes" },
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", { attrs: { scope: "col" } }),
        ...(["vitrine.contraste.texte", "vitrine.contraste.fond", "vitrine.contraste.rapport", "vitrine.contraste.seuil"] as const).map((k) => el("th", { attrs: { scope: "col" }, texte: t.t(k) })),
        el("th", { attrs: { scope: "col" } }),
      ),
    ),
    el("tbody", {}, ...lignes),
  );
  return [section(t.t("vitrine.section.couleurs"), "couleurs", table), section(t.t("vitrine.section.contrastes"), "contrastes", el("div", { classe: "vitrine-defile" }, contrastes))];
}

function rendre(): void {
  const racine = document.getElementById("vitrine");
  if (!racine) return;
  const t = traduire(langue);
  document.documentElement.lang = langue;
  document.title = t.t("vitrine.titre");
  racine.replaceChildren(
    barrePortail(t, { langue, onLangue: changerLangue, pseudo: null }),
    el("h1", { classe: "vitrine-titre", texte: t.t("vitrine.titre") }),
    el("p", { classe: "vitrine-intro", texte: t.t("vitrine.intro") }),
    el("div", { classe: "vitrine-langues" }, ...LANGUES.map(bloc)),
    el("div", { classe: "vitrine-section", attrs: { id: "couleurs-contrastes" } }, ...couleurs(t)),
  );
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  document.querySelector<HTMLElement>(`.vitrine > .dj-barre-portail [data-langue="${l}"]`)?.focus();
}

rendre();
