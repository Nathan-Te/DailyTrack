import { DUREE_EFFET, type Effet, medailleVisee, type PieceKind, type VuePartie } from "@cdj/tower-sim";
import { boutonFantome, boutonPleinEcran, el, nomMedaille, svg } from "@cdj/ui";
import { apercuPiece } from "./apercuPiece";
import { coeurs, majCoeurs } from "./composants";
import { type Entrees, type Touche } from "./entrees";
import { formatHauteur, formatPalier } from "./formatHauteur";
import { t, traducteurDuSocle } from "./i18n";
import { type EtatMedailles, TYPE_MEDAILLE } from "./medailles";

// Le HUD de la partie (lot T1) — maquettes `tower-hud-paysage.html` et `tower-hud-portrait.html`, charte rév. 13 § 9. Une bande de 30 px en haut au centre (hauteur · pièce n/40 ·
// vies en cœurs) ; pause, plein écran et fantôme en vue ; à droite la plaque « Suivante » et, au-dessus, l'objectif de médaille (lot T3 : la prochaine médaille et son seuil, ou « Médailles en calcul… ») ; les commandes tactiles
// (boutons) aux bords du bas. **Le centre reste libre.** La disposition (paysage ou portrait) est celle du rapport largeur / hauteur de l'écran, décidée par la feuille `jeu.css`
// (`max-aspect-ratio: 1/1`) : rien ici ne la calcule. Le HUD ne contient aucun texte écrit en dur : tout vient du catalogue.

export interface OptionsHud {
  racine: HTMLElement;
  entrees: Entrees;
  /** Interface tactile : les boutons de commande sont montrés. */
  tactile: boolean;
  vies: number;
  onPause(): void;
  onFantome(): void;
}

export { formatHauteur, formatPalier };

/** Combien de temps l'annonce d'un palier reste à l'écran (ms) : une ligne courte, qui disparaît (charte § 9). */
const ANNONCE_MS = 3600;

export class Hud {
  readonly element: HTMLElement;
  private readonly hauteur = el("span", { classe: "bande__hauteur" });
  private readonly pieces = el("span", { classe: "bande__pieces" });
  private readonly piecesTexte = el("span");
  private readonly viesBande: HTMLElement;
  // Lot T3 : l'objectif de médaille (la prochaine médaille à atteindre et son seuil), au-dessus de « Suivante ».
  private readonly objectif = el("div", { classe: "objectif", attrs: { role: "img", hidden: true } });
  private readonly objectifPastille = el("span", { classe: "objectif__pastille", attrs: { "aria-hidden": "true" } });
  private readonly objectifNom = el("span");
  private readonly objectifValeur = el("span", { classe: "objectif__valeur" });
  private readonly provisoire = el("span", { classe: "objectif__provisoire", attrs: { hidden: true } });
  private ligne: string | null = null;
  private readonly suivante = el("div", { classe: "suivante", attrs: { role: "img" } });
  private readonly suivanteApercu = el("span", { classe: "suivante__piece" });
  // Lot T2 : la plaque du prochain palier, au bord gauche à la hauteur du trait pointillé (« 10 m » puis l'effet, vert pour un bonus, encre pour un malus), et l'annonce d'un effet qui se déclenche.
  private readonly palier = el("div", { classe: "palier", attrs: { role: "img", hidden: true } });
  private readonly palierMetres = el("span", { classe: "palier__metres" });
  private readonly palierSigne = el("span", { classe: "palier__signe", attrs: { "aria-hidden": "true" } });
  private readonly palierEffet = el("span", { classe: "palier__nom" });
  private readonly annonce = el("div", { classe: "annonce", attrs: { role: "status", "aria-live": "polite" } });
  private minuteurAnnonce: ReturnType<typeof setTimeout> | null = null;
  private palierY = NaN;
  readonly pause: HTMLButtonElement;
  readonly fantome: HTMLButtonElement;
  readonly plein: HTMLButtonElement;
  private dernier = { hauteur: "", n: -1, vies: -1, suivante: "" as PieceKind | "" | null, nom: "", palier: "", objectif: "" };

  constructor(private readonly o: OptionsHud) {
    this.pause = el("button", { classe: "plaque-bouton", attrs: { type: "button", id: "pause" } }, el("span", { classe: "pause-barres", attrs: { "aria-hidden": "true" } }, el("span"), el("span")));
    this.pause.addEventListener("click", () => {
      this.pause.blur();
      o.onPause();
    });
    this.plein = boutonPleinEcran({ t: (c) => traducteurDuSocle().t(c as never), id: "plein-ecran", classe: "plaque-bouton", avantAide: () => o.onPause() });
    this.fantome = boutonFantome({ id: "fantome", classe: "plaque-bouton", onClick: () => o.onFantome() });
    this.pieces.append(
      svg("svg", { classe: "bande__icone", attrs: { "aria-hidden": "true", viewBox: "0 0 14 14", width: 14, height: 14 } }, svg("path", { attrs: { d: "M1 1h12v6H9v6H5V7H1z" } })),
      this.piecesTexte,
    );
    this.viesBande = coeurs(o.vies, o.vies, "");
    this.viesBande.classList.add("bande__vies");
    const bande = el("div", { classe: "bande", attrs: { role: "group" } }, this.hauteur, this.pieces, this.viesBande);
    this.suivante.append(el("span", { classe: "suivante__legende" }), this.suivanteApercu);
    const gauche = el("div", { classe: "hud__gauche" }, this.pause, this.plein, this.fantome);
    this.objectif.append(this.objectifPastille, this.objectifNom, this.objectifValeur);
    const droite = el("div", { classe: "hud__droite" }, this.objectif, this.provisoire, this.suivante);
    this.palier.append(this.palierMetres, el("span", { classe: "palier__pastille" }, this.palierSigne, this.palierEffet));
    this.element = el("div", { classe: ["hud", o.tactile && "hud--tactile"], attrs: { role: "group" } }, gauche, bande, droite, this.palier, this.annonce, this.commandes());
    o.racine.append(this.element);
    this.traduire();
  }

  private bouton(touche: Touche, cle: string, icone: SVGElement, extra?: string): HTMLButtonElement {
    const b = el("button", { classe: ["commande", `commande--${touche}`], attrs: { type: "button", "data-cle": cle } }, icone, extra ? el("span", { classe: "commande__texte", attrs: { "data-cle-texte": cle } }) : null);
    this.o.entrees.brancherBouton(b, touche);
    return b;
  }

  /** Les quatre boutons des maquettes : gauche et droite en bas à gauche, descendre et tourner en bas à droite. Ni joystick ni zones. */
  private commandes(): HTMLElement {
    const trait = (d: string, largeur: number, taille = 30, vue = "0 0 30 30") => svg("svg", { classe: "commande__icone", attrs: { "aria-hidden": "true", viewBox: vue, width: taille, height: taille } }, svg("path", { attrs: { d, "stroke-width": largeur } }));
    const gauche = this.bouton("gauche", "commande.gauche", trait("M19 5 9 15l10 10", 4.5));
    const droite = this.bouton("droite", "commande.droite", trait("M11 5l10 10-10 10", 4.5));
    const descendre = this.bouton("descendre", "commande.descendre", trait("M6 5l9 9 9-9M6 15l9 9 9-9", 4));
    const tourner = this.bouton("tourner", "commande.tourner", svg("svg", { classe: "commande__icone", attrs: { "aria-hidden": "true", viewBox: "0 0 32 32", width: 32, height: 32 } }, svg("path", { attrs: { d: "M25 16a9 9 0 1 1-3-6.7", "stroke-width": 4 } }), svg("path", { attrs: { d: "M17 4h7v7", "stroke-width": 4 } })), "texte");
    return el("div", { classe: "commandes", attrs: { role: "group", "data-cle-groupe": "hud.commandes" } }, el("div", { classe: "commandes__gauche" }, gauche, droite), el("div", { classe: "commandes__droite" }, descendre, tourner));
  }

  /** Relit tous les textes (au démarrage et au changement de langue). */
  traduire(): void {
    this.element.setAttribute("aria-label", t("hud.aria"));
    this.pause.setAttribute("aria-label", t("hud.pause"));
    this.element.querySelector(".suivante__legende")!.textContent = t("hud.suivante");
    for (const b of this.element.querySelectorAll<HTMLElement>("[data-cle]")) b.setAttribute("aria-label", t(b.dataset.cle!));
    for (const s of this.element.querySelectorAll<HTMLElement>("[data-cle-texte]")) s.textContent = t(s.dataset.cleTexte!);
    this.element.querySelector(".commandes")!.setAttribute("aria-label", t("hud.commandes"));
    this.dernier = { hauteur: "", n: -1, vies: -1, suivante: "", nom: "", palier: "", objectif: "" };
    this.provisoire.textContent = t("medailles.provisoire");
    if (this.ligne !== null) this.annonce.textContent = this.ligne;
  }

  /**
   * Pose la plaque du prochain palier à `px` pixels du haut de l'écran (la hauteur du trait pointillé), sans sortir de la zone libre entre les boutons du haut et les commandes du bas
   * (`min`, `max`). N'écrit que la variable CSS : la mise en page est dans `jeu.css`.
   */
  placerPalier(px: number, min: number, max: number): void {
    const y = Math.round(Math.min(Math.max(px, min), max));
    if (y === this.palierY) return;
    this.palierY = y;
    this.palier.style.setProperty("--palier-y", `${y}px`);
  }

  /** L'annonce d'un palier qui se déclenche : une ligne courte sous la bande, qui disparaît. */
  annoncerPalier(metres: number, effet: Effet): void {
    this.annoncerTexte(t(DUREE_EFFET[effet] > 1 ? "annonce.palier.trois" : "annonce.palier", { metres: formatPalier(metres), effet: t(`effet.${effet}`) }));
  }

  /** Une ligne d'aide sous la bande (même emplacement, même disparition). */
  annoncerTexte(texte: string): void {
    this.annonce.textContent = texte;
    this.annonce.classList.add("annonce--visible");
    if (this.minuteurAnnonce) clearTimeout(this.minuteurAnnonce);
    this.minuteurAnnonce = setTimeout(() => this.cacherAnnonce(), ANNONCE_MS);
  }

  cacherAnnonce(): void {
    if (this.minuteurAnnonce) clearTimeout(this.minuteurAnnonce);
    this.minuteurAnnonce = null;
    if (this.ligne !== null) {
      this.annonce.textContent = this.ligne; // la ligne fixe (« Le bot réfléchit… ») reprend la place
      this.annonce.classList.add("annonce--visible");
      return;
    }
    this.annonce.classList.remove("annonce--visible");
  }

  /** Une ligne qui reste sous la bande tant qu'on ne la retire pas (`null`) : « Le bot réfléchit… » (`?bot`). */
  fixerLigne(texte: string | null): void {
    this.ligne = texte;
    if (texte === null) {
      this.cacherAnnonce();
      return;
    }
    if (this.minuteurAnnonce) clearTimeout(this.minuteurAnnonce);
    this.minuteurAnnonce = null;
    this.annonce.textContent = texte;
    this.annonce.classList.add("annonce--visible");
  }

  /**
   * L'objectif de médaille : la prochaine médaille que la hauteur n'atteint pas encore et son seuil ; « Médailles en calcul… » tant que le bot calcule ; rien sans médailles (la suite d'essai,
   * les paliers). Les médailles estimées sont marquées « provisoires ». N'écrit dans le DOM que ce qui change.
   */
  majObjectif(e: EtatMedailles, hauteurMm: number): void {
    const visee = e.medailles ? medailleVisee(hauteurMm, e.medailles) : null;
    const cle = e.enCalcul ? "calcul" : !e.medailles ? "" : visee ? `${visee.nom}${visee.seuil}${e.provisoire}` : `diamant${e.provisoire}`;
    if (cle === this.dernier.objectif) return;
    this.dernier.objectif = cle;
    this.objectif.hidden = cle === "";
    this.provisoire.hidden = cle === "" || cle === "calcul" || !e.provisoire;
    if (cle === "") return;
    const type = visee ? TYPE_MEDAILLE[visee.nom] : "diamant";
    for (const c of ["bronze", "argent", "or", "diamant"]) this.objectif.classList.remove(`objectif--${c}`);
    this.objectifPastille.hidden = cle === "calcul";
    if (cle === "calcul") {
      this.objectifNom.textContent = t("hud.objectif.calcul");
      this.objectifValeur.textContent = "";
      this.objectif.setAttribute("aria-label", t("hud.objectif.calcul"));
      return;
    }
    this.objectif.classList.add(`objectif--${type}`);
    const nom = nomMedaille(traducteurDuSocle(), type);
    if (visee) {
      this.objectifNom.textContent = nom;
      this.objectifValeur.textContent = formatHauteur(visee.seuil);
      this.objectif.setAttribute("aria-label", t("hud.objectif.aria", { medaille: nom, hauteur: formatHauteur(visee.seuil) }));
    } else {
      this.objectifNom.textContent = t("hud.objectif.diamant");
      this.objectifValeur.textContent = "";
      this.objectif.setAttribute("aria-label", t("hud.objectif.diamant"));
    }
  }

  /** Met à jour ce qui a changé depuis l'image précédente (le DOM n'est touché que pour une valeur nouvelle). */
  maj(vue: VuePartie, nomFantome: string): void {
    const d = this.dernier;
    const h = formatHauteur(vue.hauteurMm);
    if (h !== d.hauteur) {
      d.hauteur = h;
      this.hauteur.textContent = h;
      this.hauteur.setAttribute("aria-label", t("hud.hauteur.aria", { hauteur: h }));
    }
    const n = Math.min(vue.numero, vue.total);
    if (n !== d.n) {
      d.n = n;
      this.piecesTexte.textContent = `${n}/${vue.total}`;
      this.pieces.setAttribute("aria-label", t("hud.pieces.aria", { n, total: vue.total }));
    }
    if (vue.vies !== d.vies) {
      d.vies = vue.vies;
      majCoeurs(this.viesBande, this.o.vies, vue.vies);
      this.viesBande.setAttribute("aria-label", t("hud.vies.aria", { n: vue.vies, total: this.o.vies }));
    }
    if (vue.suivante !== d.suivante) {
      d.suivante = vue.suivante;
      this.suivante.hidden = vue.suivante === null;
      this.suivanteApercu.replaceChildren(...(vue.suivante ? [apercuPiece(vue.suivante)] : []));
      if (vue.suivante) this.suivante.setAttribute("aria-label", t("hud.suivante.aria", { forme: vue.suivante }));
    }
    const p = vue.palier;
    const clePalier = p ? `${p.metres}${p.effet}` : "";
    if (clePalier !== d.palier) {
      d.palier = clePalier;
      this.palier.hidden = !p;
      if (p) {
        this.palier.classList.toggle("palier--bonus", p.bonus);
        this.palier.classList.toggle("palier--malus", !p.bonus);
        this.palierMetres.textContent = formatPalier(p.metres);
        this.palierSigne.textContent = p.bonus ? "+" : "−";
        this.palierEffet.textContent = t(`effet.${p.effet}`);
        this.palier.setAttribute("aria-label", t("hud.palier.aria", { metres: formatPalier(p.metres), effet: t(`effet.${p.effet}`), type: t(p.bonus ? "palier.bonus" : "palier.malus") }));
      }
    }
    if (nomFantome !== d.nom) {
      d.nom = nomFantome;
      this.fantome.setAttribute("aria-label", t("fantome.bouton", { nom: nomFantome }));
    }
  }

  /** Caché pendant l'écran de fin (la partie n'est plus à l'écran). */
  set cache(c: boolean) {
    this.element.hidden = c;
  }
}
