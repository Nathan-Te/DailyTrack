// Le HUD de la partie (lot GR3, seed § La DA) : **par-dessus le plateau**, compact, lisible sur téléphone — le score en grand au centre avec la ligne distance · pièces dessous, le multiplicateur en autocollant jaune avec sa jauge des 10 pièces,
// la médaille visée en haut à droite (la prochaine et son seuil), les bonus actifs en haut à gauche (bouclier ; aimant et ses secondes), le nom du thème quand il change, la cause de la mort. **Il ne lit que des nombres de la simulation**
// (`EtatHud`) ; couleurs : les jetons de la charte (`hud.css`) ; textes : les catalogues du jeu (`fr` + `en`), rien en dur. **Lot GR5 : le kit pose les zones** (`hud: "surimpression"`, `OptionsPartie.zones` : haut-gauche, centre, haut-droite,
// annonce) et masque le texte de sa barre (le score et la ligne du kit sont ceux que lisent la pause et les lecteurs d'écran) : ce fichier les remplit, il n'écrit plus de règle pour masquer la barre. Seuls la mort (et son bilan) et la mention
// du robot ont leur propre calque, au-dessus du plateau : ce ne sont pas des zones du HUD.
import { grouper, type Seuils } from "@cdj/gravity-sim";
import type { OptionsPartie, ZonesSurimpression } from "@cdj/kit/jeu/types";
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
const svg = (d: string): SVGSVGElement => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 20 20");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  s.append(p);
  return s;
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
  private readonly robot = el("div", "g-robot");
  private readonly mortCause = el("b", "g-mort__cause");
  private readonly bilanValeurs = [0, 1, 2, 3, 4].map(() => el("b", "g-bilan__valeur"));
  private readonly mort = el("div", "g-mort", this.mortCause);
  private dernier = { ligne: "", mult: 1, med: "", bouclier: false, aimant: -1, themeId: "", mort: "", score: -1, vuTheme: false };

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
    this.mort.hidden = true;
    // Le bilan : cinq cases (valeur au-dessus, nom dessous), dans l'ordre de l'écran de fin de la maquette — distance, pièces, gemmes, thème atteint, multiplicateur maximal.
    const noms = ["bilan.distance", "bilan.pieces", "bilan.gemmes", "bilan.theme", "bilan.mult"] as const;
    this.mort.append(el("div", "g-bilan", ...noms.map((n, i) => el("div", "g-bilan__case", this.bilanValeurs[i]!, el("span", "g-bilan__nom", o.t(n))))));
    this.medaille.hidden = true;
    zones.centre.append(el("div", "g-score", this.score, this.ligne, this.mult));
    zones.hautDroite.append(this.medaille);
    zones.hautGauche.append(this.bonus);
    zones.annonce.append(this.theme);
    this.racine.append(this.robot, this.mort);
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
    this.robot.hidden = !e.robot;
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
    for (const e of [this.score.parentElement, this.medaille, this.bonus, this.theme]) e?.remove();
  }
}
