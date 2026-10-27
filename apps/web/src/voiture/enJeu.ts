// Retouche 40b — la voiture du jeu : celle de `voitureChoisie()` (ou de `?voiture=`), et à défaut la civile, avec sa couleur, son motif et le
// numéro du jour (au Salon, celui de la session). **La course n'attend jamais la voiture** : la civile (dans le premier chargement) est
// construite tout de suite ; le modèle choisi et les matériaux des paliers 2 et 3 se chargent à la demande (`import()`), et la voiture n'est
// remplacée que quand le jeu le permet (`peutChanger` : accueil, pause, décompte, arrivée — jamais en course). Le palier de la voiture suit la
// règle de qualité automatique (`palier()`) ; la Nuit allume un peu ses rayures, son numéro et ses feux. Rendu seul : rien ici ne touche à la
// simulation (mêmes `CarParams`, même boîte, mêmes points de contact pour toutes les voitures).
import type { CarModel } from "../carMesh";
import { VOITURE_DEFAUT, ficheVoiture } from "./catalogue";
import type { ChoixVoiture } from "./choix";
import { PALETTE } from "./livree";
import { construireFantome, construireVoiture, type FabriqueMateriaux, type PalierVoiture, type PlanVoiture, type Voiture } from "./modele";
import { PLAN_CIVILE } from "./modeleCivile";

/** La teinte du fantôme de ton meilleur temps (le bleu froid du lot 9). */
export const TEINTE_FANTOME = 0x57b4ff;

export interface OptionsVoitureEnJeu {
  /** Le choix (relu à chaque `relire()`). */
  choix(): ChoixVoiture;
  /** Le numéro peint (circuit du jour, session du Salon). */
  numero(): string;
  /** Le palier voulu (règle de qualité) : 1 (peinture standard) ou 2 (deux couches, à la demande). */
  palier(): 1 | 2;
  nuit(): boolean;
  /** Le jeu permet-il de changer de voiture maintenant (jamais en course) ? */
  peutChanger(): boolean;
  /** Pose la nouvelle voiture à la place de l'ancienne (elle est libérée ensuite). Lot 51 : plus de fantôme ici — chaque fantôme a la voiture de sa course (`fantomes.ts`). */
  adopter(voiture: Voiture): void;
  /** Les matériaux des paliers 2 et 3 (`import()`). */
  materiaux2(): Promise<FabriqueMateriaux>;
}

const cleDe = (c: ChoixVoiture, palier: number, silhouette = false) => `${c.id}|${c.couleur}|${c.motif}|${c.teinteMotif}|${palier}${silhouette ? "|s" : ""}`;

export class VoitureEnJeu {
  voiture: Voiture;
  /** La version simple de la civile (la Sparrow) : le fantôme par défaut, celui d'une course sans voiture connue. Lot 51 : les autres voitures des fantômes viennent de `fantomes.ts`. */
  readonly fantome: CarModel;
  /** Le modèle construit (sa clé : voiture, couleur, motif, palier). */
  private cle: string;
  private choixCourant: ChoixVoiture;
  /** Lot 41 : la voiture regardée au Garage, si ce n'est pas la tienne, et sa retouche (une voiture verrouillée : sa silhouette) ; `null` : ta voiture. */
  private regardee: { choix: ChoixVoiture; retouche?: (v: Voiture) => void } | null = null;
  /** Une voiture prête, en attente du moment où le jeu permet de changer. */
  private prete: { cle: string; voiture: Voiture; choix: ChoixVoiture } | null = null;
  /** Lot 51 : la voiture qu'on voit (le choix qui l'a construite) — celle qui court : elle part avec le temps. */
  private vue: ChoixVoiture;
  /** Lot 51 : la voiture d'un autre, montrée en rediffusion (« revoir le meilleur tour », spectateur) ; `null` : la tienne. */
  private imposee: ChoixVoiture | null = null;
  private enCours: string | null = null;
  /** Un chargement raté (hors ligne) : on ne le retente qu'au prochain choix. */
  private echec: string | null = null;
  private numeroPeint: string;
  private nuitPeinte = false;
  /** Compteurs (outil `?debug`, mesures) : voitures construites, remplacements, chargements ; durée de construction de la civile au démarrage ;
   *  heure (`performance.now()`) du dernier remplacement. */
  readonly stats = { construites: 0, remplacees: 0, chargements: 0, civileMs: 0, remplaceeA: 0 };

  constructor(private readonly o: OptionsVoitureEnJeu) {
    this.choixCourant = o.choix();
    this.numeroPeint = o.numero();
    // Tout de suite : la civile, au palier 1, déjà là (premier chargement) ; dans la couleur et le motif choisis.
    const t0 = performance.now();
    this.voiture = this.construire(PLAN_CIVILE, this.choixCourant, 1);
    this.fantome = construireFantome(PLAN_CIVILE, TEINTE_FANTOME);
    this.stats.civileMs = performance.now() - t0;
    this.vue = { ...this.choixCourant, id: VOITURE_DEFAUT };
    this.cle = cleDe(this.vue, 1);
  }

  /** Lot 51 : la voiture qu'on voit, avec sa couleur, son motif et sa teinte — celle d'une course qui s'arrête ici (le fantôme de ton record, l'envoi, le Salon). */
  get affichee(): ChoixVoiture {
    return { ...this.vue };
  }

  /**
   * Lot 51 : montre la voiture d'un autre (la version complète : modèle, couleur, motif, teinte), pour revoir sa course ; `null` : la tienne. Remplacée quand le jeu le permet
   * (`peutChanger`), comme au Garage. Rien n'est enregistré.
   */
  regarder(choix: ChoixVoiture | null): void {
    this.imposee = choix;
    this.echec = null;
  }

  /** Relit le choix (le jeu le fait à l'accueil ; le Garage, après un changement). */
  relire(): void {
    this.choixCourant = this.o.choix();
    this.echec = null;
  }

  /** Le choix en vigueur. */
  get choix(): ChoixVoiture {
    return this.choixCourant;
  }

  /**
   * Lot 41 (le Garage) : montre une autre voiture que la tienne ; `retouche` la change une fois construite (une voiture verrouillée : sa silhouette,
   * que le Garage apporte) ; `null` : la tienne. Rien n'est enregistré.
   */
  apercu(choix: ChoixVoiture | null, retouche?: (v: Voiture) => void): void {
    this.regardee = choix ? { choix, retouche } : null;
    this.echec = null;
  }

  /** La voiture qu'on veut voir : celle regardée au Garage, sinon la tienne. */
  private get vise(): ChoixVoiture {
    return this.regardee?.choix ?? this.imposee ?? this.choixCourant;
  }

  private get silhouette(): boolean {
    return !!this.regardee?.retouche;
  }

  /** La voiture prête ou voulue est-elle celle qu'on voit ? (outil des tests) */
  get aJour(): boolean {
    return this.cle === cleDe(this.vise, this.o.palier(), this.silhouette) && !this.prete;
  }

  /** À chaque image : charge ce qu'il faut, remplace la voiture quand le jeu le permet, suit le numéro et la Nuit. */
  tick(): void {
    const vise = this.vise;
    const voulue = cleDe(vise, this.o.palier(), this.silhouette);
    if (voulue !== this.cle && voulue !== this.echec) {
      if (this.prete && this.prete.cle !== voulue) this.liberer(this.prete);
      if (this.prete?.cle !== voulue) {
        this.prete = null;
        this.preparer(vise, this.o.palier(), voulue, this.regardee?.retouche);
      }
      if (this.prete && this.o.peutChanger()) this.adopter(this.prete);
    } else if (this.prete) {
      this.liberer(this.prete);
      this.prete = null;
    }
    const n = this.o.numero();
    if (n !== this.numeroPeint) {
      this.numeroPeint = n;
      this.peindre(this.voiture);
    }
    const nuit = this.o.nuit();
    if (nuit !== this.nuitPeinte) {
      this.nuitPeinte = nuit;
      this.voiture.nuit(nuit);
    }
  }

  private couleurDe(c: ChoixVoiture): number {
    return PALETTE[c.couleur]?.hex ?? PALETTE[0]!.hex;
  }

  private peindre(v: Voiture) {
    v.peindre(this.couleurDe(this.vise), this.numeroPeint, this.vise.motif, this.vise.teinteMotif);
  }

  private construire(plan: PlanVoiture, c: ChoixVoiture, palier: PalierVoiture, materiaux?: FabriqueMateriaux, retouche?: (v: Voiture) => void): Voiture {
    this.stats.construites++;
    const v = construireVoiture(plan, { palier, couleur: this.couleurDe(c), numero: this.numeroPeint, motif: c.motif, teinteMotif: c.teinteMotif, materiaux });
    v.nuit(this.nuitPeinte);
    retouche?.(v);
    return v;
  }

  /** Charge le modèle (et les matériaux du palier 2) à la demande ; une seule préparation à la fois, la dernière voulue gagne. */
  private preparer(c: ChoixVoiture, palier: 1 | 2, cle: string, retouche?: (v: Voiture) => void) {
    if (this.enCours === cle) return;
    this.enCours = cle;
    this.stats.chargements++;
    const fiche = ficheVoiture(c.id) ?? ficheVoiture(VOITURE_DEFAUT)!;
    void Promise.all([fiche.charger(), palier > 1 ? this.o.materiaux2() : Promise.resolve(undefined)])
      .then(([plan, mat]) => {
        if (this.enCours !== cle) return; // un autre choix est passé entre-temps
        this.enCours = null;
        this.prete = { cle, voiture: this.construire(plan, c, palier, mat, retouche), choix: c };
        if (this.o.peutChanger()) this.adopter(this.prete);
      })
      .catch((e: unknown) => {
        // Hors ligne, morceau introuvable : on garde la voiture qu'on a (la civile au pire) ; on retentera au prochain choix.
        if (this.enCours === cle) this.enCours = null;
        this.echec = cle;
        console.warn("voiture : chargement impossible", e);
      });
  }

  private adopter(p: { cle: string; voiture: Voiture; choix: ChoixVoiture }) {
    const vieille = { voiture: this.voiture };
    this.voiture = p.voiture;
    this.vue = { ...p.choix };
    this.cle = p.cle;
    this.prete = null;
    this.peindre(this.voiture);
    this.voiture.nuit(this.nuitPeinte);
    this.stats.remplacees++;
    this.stats.remplaceeA = performance.now();
    this.o.adopter(p.voiture);
    this.liberer(vieille);
  }

  private liberer(p: { voiture: Voiture }) {
    p.voiture.dispose();
  }
}
