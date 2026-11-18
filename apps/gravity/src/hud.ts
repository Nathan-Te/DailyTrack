// Le HUD de la partie (lot GR3, seed § La DA) : **par-dessus le plateau**, compact, lisible sur téléphone — le score en grand au centre avec la ligne distance · pièces dessous, le multiplicateur en autocollant jaune avec sa jauge des 10 pièces,
// la médaille visée en haut à droite (la prochaine et son seuil), les bonus actifs en haut à gauche (bouclier ; aimant et ses secondes), le nom du thème quand il change, la cause de la mort. **Il ne lit que des nombres de la simulation**
// (`EtatHud`) ; couleurs : les jetons de la charte (`hud.css`) ; textes : les catalogues du jeu (`fr` + `en`), rien en dur. **Lot GR5 : le kit pose les zones** (`hud: "surimpression"`, `OptionsPartie.zones` : haut-gauche, centre, haut-droite,
// annonce) et masque le texte de sa barre (le score et la ligne du kit sont ceux que lisent la pause et les lecteurs d'écran) : ce fichier les remplit, il n'écrit plus de règle pour masquer la barre. Seuls la mort (et son bilan) et la mention
// du robot ont leur propre calque, au-dessus du plateau : ce ne sont pas des zones du HUD.
import { grouper, type Seuils } from "@cdj/gravity-sim";
import type { OptionsPartie, ZonesSurimpression } from "@cdj/kit/jeu/types";
import { CHEVRONS_DU_PORTAIL, MODE_AFFICHE, VITESSE_AFFICHEE, nomDuMode, type AnnonceMode, type AnnonceVitesse, type NomDeMode } from "./modesLogique";
import { DANGER_AFFICHE, type AnnonceDanger, type NomDeDanger } from "./dangersLogique";
import "./hud.css";

export interface EtatHud {
  score: number;
  distance: number;
  pieces: number;
  mult: number;
  /** Les pièces d'affilée (la jauge : `chaine % 10`). */
  chaine: number;
  bouclier: boolean;
  /** Les pas d'aimant restants (120 par seconde). */
  aimant: number;
  /** Les seuils, quand on les a (le calcul des jours sans fichier se fait en arrière-plan) : sinon rien n'est montré. */
  seuils: Seuils | null;
  /** Le thème dont le nom s'affiche : son code, son nom, sa mécanique, sa couleur ; `age` : les pas depuis le changement (rien après `duree`). */
  theme: { id: string; nom: string; meca: string; couleur: string; age: number } | null;
  /** La cause de la mort (clé `mort.<cause>`), ou null. */
  mort: string | null;
  /** Le bilan de la partie, montré avec la cause pendant que la mort se voit (lot GR4) : le kit n'a pas d'emplacement pour un bilan sur son écran de fin (README du lot). Null tant qu'on joue. */
  bilan: { distance: number; pieces: number; gemmes: number; theme: string; mult: number } | null;
  robot: boolean;
  /** Lot GR6 : le mode de vol en cours (`MODE_*`), l'annonce du dernier portail de mode (nom, consigne la première fois seulement, couleur du portail) et celle du dernier portail de vitesse ; `tick` : le pas de la simulation (leur âge). */
  mode: number;
  tick: number;
  annonceMode: (AnnonceMode & { couleur: string }) | null;
  annonceVitesse: AnnonceVitesse | null;
  /** Lot GR7 : l'annonce « Nouveau : les scies » du premier passage d'un danger (une fois par danger et par partie). */
  annonceDanger: AnnonceDanger | null;
  /** Lot GR5 : la mention des réglages d'essai (« Réglage d'essai · départ 8 m/s »), ou null : une partie normale n'en montre pas. */
  reglage: string | null;
}

const MEDAILLES = [
  { seuil: "bronze", nom: "medaille.bronze", couleur: "var(--dj-bronze)" },
  { seuil: "silver", nom: "medaille.argent", couleur: "var(--dj-argent)" },
  { seuil: "gold", nom: "medaille.or", couleur: "var(--dj-or)" },
  { seuil: "author", nom: "medaille.diamant", couleur: "var(--dj-diamant)" },
] as const;
/** Combien de pas le nom du thème reste affiché (1,8 s). */
export const THEME_AFFICHE = 216;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, ...enfants: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = classe;
  e.append(...enfants);
  return e;
};
const svg = (d: string, trait = false): SVGSVGElement => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 20 20");
  s.setAttribute("aria-hidden", "true");
  if (trait) s.classList.add("g-icone--trait");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  s.append(p);
  return s;
};
/** Les icônes des modes (lot GR6), dans un carré de 20 : l'avion en papier (plein), les autres en traits. La gravité : la double flèche. */
const ICONES_MODE: Readonly<Record<NomDeMode, { d: string; trait: boolean }>> = {
  gravite: { d: "M10 2v16M6 6l4-4 4 4M6 14l4 4 4-4", trait: true },
  avion: { d: "M2 10 18 3 11 17 9 11z", trait: false },
  onde: { d: "M2 14 6 5 10 14 14 5 18 14", trait: true },
  ressort: { d: "M10 2 5 4.5 15 7.5 5 10.5 15 13.5 5 16.5 10 18", trait: true },
};
/** Les icônes des dangers (lot GR7), dans un carré de 20 : la scie (un disque à dents), le sol fragile (une planche fendue), le laser (un rayon entre deux lentilles). */
const ICONES_DANGER: Readonly<Record<NomDeDanger, { d: string; trait: boolean }>> = {
  scies: { d: "M10 1l2 3 3-1 .5 3.5 3.5.5-1 3 3 2-3 2 1 3-3.5.5-.5 3.5-3-1-2 3-2-3-3 1-.5-3.5L2.5 14l1-3-3-2 3-2-1-3L6 3.5 6.5 1 9.5 2z", trait: false },
  fragiles: { d: "M2 6h16v8H2zM10 6 8 10l3 1-2 3", trait: true },
  lasers: { d: "M10 2v16M6 2h8M6 18h8", trait: true },
};
/** L'icône d'un portail de vitesse : `n` chevrons (›), ou deux tirets pour le portail lent. */
const iconeDeVitesse = (n: number): { d: string; trait: boolean } => ({ d: n === 0 ? "M3 7.5h14M3 12.5h14" : Array.from({ length: n }, (_, i) => `M${n === 1 ? 7 : n === 2 ? 4 + i * 6 : 2 + i * 6} 4l6 6-6 6`).join(""), trait: true });
const remplacerIcone = (hote: Element, icone: { d: string; trait: boolean }): void => {
  hote.querySelector("svg")?.remove();
  hote.prepend(svg(icone.d, icone.trait));
};

export class Hud {
  /** Le calque de la mort et de la mention du robot (le reste du HUD est dans les zones du kit). */
  private readonly racine = el("div", "g-hud");
  private readonly score = el("b", "g-score__nombre", "0");
  private readonly ligne = el("span", "g-score__ligne");
  private readonly multNombre = el("b", "g-mult__nombre", "×1");
  private readonly jauge = el("u", "g-mult__jauge");
  private readonly mult = el("div", "g-mult", this.multNombre, el("i", "g-mult__piste", this.jauge));
  private readonly medaillePoint = el("i", "g-medaille__point");
  private readonly medailleTexte = el("span", "g-medaille__texte");
  private readonly medaille = el("div", "g-medaille", this.medaillePoint, this.medailleTexte);
  private readonly bonus = el("div", "g-bonus");
  private readonly puceBouclier = el("span", "g-bonus__puce", svg("M10 2 17 5v5c0 4-3 7-7 8-4-1-7-4-7-8V5z"), el("span", "g-bonus__texte"));
  private readonly puceAimant = el("span", "g-bonus__puce", svg("M3 17v-6a7 7 0 0 1 14 0v6h-4v-6a3 3 0 0 0-6 0v6z"), el("span", "g-bonus__texte"));
  private readonly themeNom = el("b", "g-theme__nom");
  private readonly themeMeca = el("small", "g-theme__meca");
  private readonly theme = el("div", "g-theme", this.themeNom, this.themeMeca);
  /** Lot GR6 : l'annonce d'un mode (nom, consigne la première fois), celle d'un portail de vitesse, et la petite icône du mode en cours près du multiplicateur. */
  private readonly modeNom = el("b", "g-mode__nom");
  private readonly modeConsigne = el("small", "g-mode__consigne");
  private readonly mode = el("div", "g-mode", el("span", "g-mode__icone"), el("div", "g-mode__texte", this.modeNom, this.modeConsigne));
  private readonly vitesseTexte = el("span", "g-vitesse__texte");
  private readonly vitesse = el("div", "g-vitesse", el("span", "g-vitesse__icone"), this.vitesseTexte);
  private readonly iconeMode = el("span", "g-modeicone");
  /** Lot GR7 : l'annonce d'un danger (« Nouveau : les scies » et sa consigne), la même carte que celle d'un mode, l'accent rouge. */
  private readonly dangerNom = el("b", "g-danger__nom");
  private readonly dangerConsigne = el("small", "g-danger__consigne");
  private readonly danger = el("div", "g-danger", el("span", "g-danger__icone"), el("div", "g-danger__texte", this.dangerNom, this.dangerConsigne));
  private readonly robot = el("div", "g-robot");
  private readonly reglage = el("div", "g-reglage");
  private readonly mortCause = el("b", "g-mort__cause");
  private readonly bilanValeurs = [0, 1, 2, 3, 4].map(() => el("b", "g-bilan__valeur"));
  private readonly mort = el("div", "g-mort", this.mortCause);
  private dernier = { ligne: "", mult: 1, med: "", bouclier: false, aimant: -1, themeId: "", mort: "", score: -1, vuTheme: false, modeId: 0, vuMode: false, vitesseId: 0, vuVitesse: false, mode: -1, dangerId: 0, vuDanger: false };

  constructor(
    hote: HTMLElement,
    private readonly o: OptionsPartie,
  ) {
    const zones: ZonesSurimpression = o.zones!; // `hud: "surimpression"` (definition.ts) : le kit les donne toujours
    if (o.reduit) {
      this.racine.classList.add("g-hud--reduit");
      zones.centre.classList.add("g-hud--reduit"); // les transitions du HUD s'éteignent (hud.css) : le thème est dans l'annonce, la jauge dans le centre
      zones.annonce.classList.add("g-hud--reduit");
      zones.hautGauche.classList.add("g-hud--reduit");
    }
    this.racine.setAttribute("aria-hidden", "true"); // le score et la ligne du kit disent la même chose aux lecteurs d'écran
    this.puceBouclier.querySelector(".g-bonus__texte")!.textContent = o.t("hud.bouclier");
    this.puceBouclier.hidden = true;
    this.puceAimant.hidden = true;
    this.bonus.append(this.puceBouclier, this.puceAimant);
    this.robot.textContent = o.t("essai.robot");
    this.robot.hidden = true;
    this.reglage.hidden = true;
    this.mort.hidden = true;
    // Le bilan : cinq cases (valeur au-dessus, nom dessous), dans l'ordre de l'écran de fin de la maquette — distance, pièces, gemmes, thème atteint, multiplicateur maximal.
    const noms = ["bilan.distance", "bilan.pieces", "bilan.gemmes", "bilan.theme", "bilan.mult"] as const;
    this.mort.append(el("div", "g-bilan", ...noms.map((n, i) => el("div", "g-bilan__case", this.bilanValeurs[i]!, el("span", "g-bilan__nom", o.t(n))))));
    this.medaille.hidden = true;
    this.mode.hidden = false;
    this.iconeMode.hidden = true;
    zones.centre.append(el("div", "g-score", this.score, this.ligne, el("div", "g-score__rang", this.mult, this.iconeMode)));
    zones.hautDroite.append(this.medaille);
    zones.hautGauche.append(this.bonus);
    this.danger.hidden = false;
    zones.annonce.append(this.theme, this.mode, this.vitesse, this.danger);
    this.racine.append(this.robot, this.reglage, this.mort);
    this.mult.addEventListener("animationend", () => this.mult.classList.remove("g-mult--chute"));
    hote.append(this.racine);
  }

  private nombre(n: number): string {
    return grouper(n, this.o.langue);
  }

  maj(e: EtatHud): void {
    const d = this.dernier;
    const t = this.o.t;
    if (e.score !== d.score) {
      d.score = e.score;
      this.score.textContent = this.nombre(e.score);
    }
    const ligne = `${e.distance} m · ${t(e.pieces === 1 ? "hud.pieces.une" : "hud.pieces.autres", { n: e.pieces })}`;
    if (ligne !== d.ligne) {
      d.ligne = ligne;
      this.ligne.textContent = ligne;
    }
    // le multiplicateur : l'autocollant et sa jauge ; quand il retombe (une pièce ratée) il chute, bien visiblement
    if (e.mult !== d.mult) {
      this.multNombre.textContent = `×${e.mult}`;
      if (e.mult < d.mult && !this.o.reduit) {
        this.mult.classList.remove("g-mult--chute");
        void this.mult.offsetWidth;
        this.mult.classList.add("g-mult--chute");
      }
      d.mult = e.mult;
    }
    this.jauge.style.width = `${e.mult >= 5 ? 100 : (e.chaine % 10) * 10}%`;
    this.mult.setAttribute("aria-label", t("hud.mult.aria", { mult: e.mult }));
    // la médaille visée : la première dont le seuil n'est pas atteint ; toutes obtenues : le Diamant, obtenu
    if (e.seuils) {
      const cible = MEDAILLES.find((m) => e.score < e.seuils![m.seuil]) ?? null;
      const m = cible ?? MEDAILLES[3];
      const texte = cible ? t("hud.medaille", { medaille: t(m.nom), seuil: this.nombre(e.seuils[m.seuil]) }) : t("medaille.obtenue", { medaille: t(m.nom) });
      if (texte !== d.med) {
        d.med = texte;
        this.medailleTexte.textContent = texte;
        this.medaillePoint.style.background = m.couleur;
        this.medaille.hidden = false;
      }
    }
    if (e.bouclier !== d.bouclier) {
      d.bouclier = e.bouclier;
      this.puceBouclier.hidden = !e.bouclier;
    }
    const secondes = e.aimant > 0 ? Math.ceil(e.aimant / 120) : 0;
    if (secondes !== d.aimant) {
      d.aimant = secondes;
      this.puceAimant.hidden = secondes === 0;
      this.puceAimant.querySelector(".g-bonus__texte")!.textContent = t("hud.aimant", { s: secondes });
    }
    this.puceAimant.classList.toggle("g-bonus__puce--fin", secondes > 0 && secondes <= 2);
    // le nom du thème, quand il change : il apparaît, reste 1,8 s, s'efface
    if (e.theme && e.theme.id !== d.themeId) {
      d.themeId = e.theme.id;
      this.themeNom.textContent = e.theme.nom;
      this.themeMeca.textContent = e.theme.meca;
      this.theme.style.setProperty("--g-accent", e.theme.couleur);
    }
    const vu = e.theme !== null && e.theme.age >= 0 && e.theme.age <= THEME_AFFICHE && e.mort === null;
    if (vu !== d.vuTheme) {
      d.vuTheme = vu;
      this.theme.classList.toggle("g-theme--vu", vu);
    }
    // Lot GR6 : l'icône du mode en cours (rien en gravité), l'annonce du dernier portail de mode (elle reste 2,5 s) et celle d'un portail de vitesse (1,3 s, discrète)
    if (e.mode !== d.mode) {
      d.mode = e.mode;
      const nom = nomDuMode(e.mode);
      this.iconeMode.hidden = e.mode === 0;
      if (e.mode !== 0) remplacerIcone(this.iconeMode, ICONES_MODE[nom]);
    }
    const am = e.annonceMode;
    if (am && am.id !== d.modeId) {
      d.modeId = am.id;
      this.modeNom.textContent = t(`mode.${am.mode}`);
      this.modeConsigne.textContent = am.consigne ? t(`mode.${am.mode}.consigne`) : "";
      this.modeConsigne.hidden = !am.consigne;
      this.mode.style.setProperty("--g-accent", am.couleur);
      remplacerIcone(this.mode.firstElementChild!, ICONES_MODE[am.mode]);
    }
    const vuMode = am !== null && e.tick - am.depuis >= 0 && e.tick - am.depuis <= MODE_AFFICHE && e.mort === null;
    if (vuMode !== d.vuMode) {
      d.vuMode = vuMode;
      this.mode.classList.toggle("g-mode--vu", vuMode);
    }
    const av = e.annonceVitesse;
    if (av && av.id !== d.vitesseId) {
      d.vitesseId = av.id;
      this.vitesseTexte.textContent = t(`portail.${av.type}`);
      remplacerIcone(this.vitesse.firstElementChild!, iconeDeVitesse(CHEVRONS_DU_PORTAIL[av.type]));
    }
    const vuVitesse = av !== null && e.tick - av.depuis >= 0 && e.tick - av.depuis <= VITESSE_AFFICHEE && e.mort === null;
    if (vuVitesse !== d.vuVitesse) {
      d.vuVitesse = vuVitesse;
      this.vitesse.classList.toggle("g-vitesse--vu", vuVitesse);
    }
    // Lot GR7 : « Nouveau : les scies » (3 s, une fois par danger et par partie)
    const ad = e.annonceDanger;
    if (ad && ad.id !== d.dangerId) {
      d.dangerId = ad.id;
      this.dangerNom.textContent = t("danger.nouveau", { danger: t(`danger.${ad.danger}`) });
      this.dangerConsigne.textContent = t(`danger.${ad.danger}.consigne`);
      this.danger.style.setProperty("--g-accent", ad.couleur);
      remplacerIcone(this.danger.firstElementChild!, ICONES_DANGER[ad.danger]);
    }
    const vuDanger = ad !== null && e.tick - ad.depuis >= 0 && e.tick - ad.depuis <= DANGER_AFFICHE && e.mort === null;
    if (vuDanger !== d.vuDanger) {
      d.vuDanger = vuDanger;
      this.danger.classList.toggle("g-danger--vu", vuDanger);
    }
    this.robot.hidden = !e.robot;
    if (e.reglage !== (this.reglage.hidden ? null : this.reglage.textContent)) {
      this.reglage.hidden = e.reglage === null;
      this.reglage.textContent = e.reglage ?? "";
    }
    if (e.mort !== d.mort) {
      d.mort = e.mort ?? "";
      this.mort.hidden = e.mort === null;
      if (e.mort) this.mortCause.textContent = t(`mort.${e.mort}`);
    }
    if (e.bilan) {
      const b = e.bilan;
      const v = [t("bilan.metres", { m: this.nombre(b.distance) }), this.nombre(b.pieces), this.nombre(b.gemmes), b.theme, `×${b.mult}`];
      v.forEach((x, i) => {
        if (this.bilanValeurs[i]!.textContent !== x) this.bilanValeurs[i]!.textContent = x;
      });
    }
  }

  detruire(): void {
    this.racine.remove();
    // les zones du kit sont vidées à chaque partie (`surimpression.vider`) ; on retire pourtant ce qu'on y a posé : la scène peut être détruite avant
    for (const e of [this.score.parentElement, this.medaille, this.bonus, this.theme, this.mode, this.vitesse, this.danger]) e?.remove();
  }
}
