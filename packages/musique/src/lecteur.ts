import { lireListe, pistesDuJeu } from "./liste";
import {
  CLE_REGLAGES,
  CLE_REPRISE,
  FONDU_ENTREE_S,
  FONDU_S,
  FONDU_SCENE_S,
  FONDU_SAUT_S,
  courbeFondu,
  departDeLaPage,
  ecrireReglages,
  ecrireReprise,
  gainDeDb,
  choisirSuivante,
  lireReglages,
  lireReprise,
  niveauFinal,
  pistesDeLaScene,
} from "./logique";
import type { JeuMusique, PisteServie, Reglages } from "./types";

// Le lecteur de musique commun (lot « musique »), **chargé à la demande au premier geste** (`demarrage.ts`) : jamais dans le premier chargement d'un jeu. Il joue la liste
// de son jeu — tirage pondéré, jamais deux fois le même d'affilée, fondu enchaîné — **en flux** (un élément audio par morceau, jamais le fichier en mémoire), sur deux voix
// reliées à un seul bus (niveau, compresseur). Tout ce qui touche au navigateur est injecté (`Dependances`) : les tests le remplacent par des faux.
//
// Règles des navigateurs : rien n'est demandé au réseau avant le premier geste (ce module n'est chargé qu'à ce moment-là) ; le contexte est réveillé à chaque geste tant qu'il
// ne joue pas (sur iPhone, seul un geste qui se termine le réveille) ; la musique se met en pause quand l'onglet passe en arrière-plan et reprend au retour ; la position
// du morceau est gardée (stockage de l'onglet) pour que la page suivante reprenne au même endroit.

/** Ce que le lecteur exige d'un élément audio (un `HTMLAudioElement` convient). */
export interface ElementAudio {
  src: string;
  preload: string;
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  load?(): void;
  addEventListener(type: string, fn: () => void): void;
  removeAttribute?(nom: string): void;
}

export interface ParamAudio {
  value: number;
  setTargetAtTime(v: number, t: number, constante: number): unknown;
  setValueCurveAtTime(courbe: Float32Array, t: number, duree: number): unknown;
  cancelScheduledValues(t: number): unknown;
  setValueAtTime(v: number, t: number): unknown;
}
export interface NoeudAudio {
  connect(vers: unknown): unknown;
  disconnect?(): unknown;
}
export interface GainAudio extends NoeudAudio {
  gain: ParamAudio;
}
export interface ContexteAudio {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createGain(): GainAudio;
  createMediaElementSource(el: unknown): NoeudAudio;
  /** Le compresseur commun (sans lui, la musique passerait telle quelle). */
  createDynamicsCompressor?(): NoeudAudio & { threshold: ParamAudio; ratio: ParamAudio; knee: ParamAudio; attack: ParamAudio; release: ParamAudio };
}

export interface StockageMin {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export interface Dependances {
  jeu: JeuMusique;
  /** L'adresse du dossier de la musique, avec la barre finale (`/musique/`). */
  base: string;
  /** Les réglages communs (stockage de l'appareil, celui de chaque jeu). */
  stockage: StockageMin | null;
  /** La reprise (stockage de l'onglet). */
  session: StockageMin | null;
  /** Lit `liste.json` : le JSON, ou rejette. */
  chargerListe(url: string): Promise<unknown>;
  creerAudio(): ElementAudio;
  creerContexte(): ContexteAudio | null;
  /** La page est cachée (onglet en arrière-plan). */
  cachee(): boolean;
  /** S'abonne à un événement de la fenêtre ou du document ; rend la fonction qui se désabonne. */
  ecouter(cible: "fenetre" | "document", type: string, fn: () => void): () => void;
  maintenant(): number;
  hasard(): number;
  /** Rappelle `fn` dans `ms` millisecondes. */
  planifier(ms: number, fn: () => void): void;
}

/** Les événements qui comptent comme un geste du joueur (sur iPhone, seuls `touchend` et `click` réveillent l'audio). */
export const GESTES = ["pointerdown", "keydown", "touchstart", "touchend", "click"] as const;

export interface EtatLecteur {
  jeu: JeuMusique;
  /** La liste du jeu est chargée et n'est pas vide. */
  active: boolean;
  /** Le contexte audio joue vraiment. */
  joue: boolean;
  enCours: { id: string; titre: string; artiste: string; credit: string } | null;
  precedent: string | null;
  reglages: Reglages;
  baisse: number;
  sourdine: boolean;
  enPause: boolean;
  /** La scène annoncée par le jeu. */
  scene: string | null;
  /** Les morceaux de la scène (ceux qui peuvent jouer maintenant). */
  pistes: string[];
}

interface Voix {
  el: ElementAudio;
  /** Le fondu de la voix (0 à 1). */
  gain: GainAudio;
  /** La correction de volume du morceau (`volumeDb`), avant le fondu. */
  correction: GainAudio;
  piste: PisteServie | null;
  /** Numéro d'écoute : un fondu qui n'est plus le sien ne la touche pas. */
  genre: number;
}

export interface Lecteur {
  etat(): EtatLecteur;
  /** Le morceau en cours (« En écoute »). */
  enCours(): PisteServie | null;
  reglages(): Reglages;
  regler(patch: Partial<Reglages>): void;
  baisser(niveau: number): void;
  /** La scène du jeu (`menu`, `theme:nuit`…) ; `null` : aucune (tous les morceaux du jeu). Un changement fait passer, en fondu, à un morceau de la nouvelle scène (s'il y en a un) ; le morceau en cours est gardé s'il y passe aussi. */
  scene(nom: string | null): void;
  /** Il y a quelque chose à écouter dans ce jeu : la liste est chargée, elle n'est pas vide et le contexte existe. */
  actif(): boolean;
  sourdine(coupe: boolean): void;
  suivante(): void;
  /** Le lecteur a changé de morceau ou de réglage : les réglages (le panneau) se relisent. */
  surChangement(fn: () => void): () => void;
  /** Un geste du joueur : réveille le contexte et relance un morceau en attente. */
  geste(): void;
  arreter(): void;
}

export function creerLecteur(d: Dependances): Lecteur {
  let reglages = lireReglages(lire(d.stockage, CLE_REGLAGES));
  let baisse = 1;
  let sourdine = false;
  /** Tous les morceaux du jeu ; `candidats()` en tire ceux de la scène. */
  let toutes: PisteServie[] = [];
  let scene: string | null = null;
  let ctx: ContexteAudio | null = null;
  let bus: GainAudio | null = null;
  let voix: Voix[] = [];
  let active = 0;
  let precedent: string | null = null;
  let enPause = false;
  let fondu = false;
  let fonduId = 0;
  let genre = 0;
  let derniereReprise = -Infinity;
  const abonnes = new Set<() => void>();
  const desabonner: (() => void)[] = [];
  let arrete = false;

  const prevenir = () => abonnes.forEach((f) => f());
  const voixActive = (): Voix | undefined => voix[active];
  const candidats = (): PisteServie[] => pistesDeLaScene(toutes, scene);

  function lire(s: StockageMin | null, cle: string): string | null {
    try {
      return s?.getItem(cle) ?? null;
    } catch {
      return null;
    }
  }
  function ecrire(s: StockageMin | null, cle: string, v: string): void {
    try {
      s?.setItem(cle, v);
    } catch {
      /* stockage refusé : tant pis */
    }
  }

  function appliquerNiveau(): void {
    if (!ctx || !bus) return;
    bus.gain.setTargetAtTime(niveauFinal({ reglages, baisse, sourdine }), ctx.currentTime, 0.06);
  }

  function noterReprise(force = false): void {
    const v = voixActive();
    if (!v?.piste) return;
    const t = d.maintenant();
    if (!force && t - derniereReprise < 1000) return;
    derniereReprise = t;
    ecrire(d.session, CLE_REPRISE, ecrireReprise({ id: v.piste.id, t: v.el.currentTime, at: t }));
  }

  /** Lance `piste` sur la voix libre, avec un fondu d'entrée de `entree` secondes (0 : plein tout de suite). */
  function lancer(piste: PisteServie, depart: number, entree: number): Voix | null {
    if (!ctx) return null;
    // La voix libre : l'autre que celle qui joue ; au démarrage (rien ne joue), la première.
    const libre = voix[active]?.piste ? voix[1 - active]! : voix[active]!;
    libre.genre = ++genre;
    libre.piste = piste;
    const el = libre.el;
    el.preload = "auto";
    el.src = d.base + piste.fichier;
    el.currentTime = depart > 0 ? depart : 0;
    const t = ctx.currentTime;
    libre.correction.gain.setValueAtTime(gainDeDb(piste.volumeDb), t);
    libre.gain.gain.cancelScheduledValues(t);
    if (entree > 0) {
      libre.gain.gain.setValueAtTime(0, t);
      libre.gain.gain.setValueCurveAtTime(courbeFondu().entree, t, entree);
    } else libre.gain.gain.setValueAtTime(1, t);
    el.play().catch(() => undefined); // refusé avant un geste : `geste()` réessaie
    return libre;
  }

  /** Enchaîne : le morceau en cours sort en fondu, le suivant entre en fondu. `duree` : la durée du fondu. */
  function enchainer(duree: number): void {
    if (fondu || !ctx || arrete) return;
    const courant = voixActive();
    const suivant = choisirSuivante(candidats(), courant?.piste?.id ?? precedent, d.hasard);
    if (!suivant) return;
    fondu = true;
    const id = ++fonduId;
    const t = ctx.currentTime;
    const sortante = courant;
    if (sortante?.piste) {
      precedent = sortante.piste.id;
      sortante.gain.gain.cancelScheduledValues(t);
      sortante.gain.gain.setValueCurveAtTime(courbeFondu().sortie, t, duree);
      const g = sortante.genre;
      d.planifier(duree * 1000 + 50, () => {
        if (sortante.genre === g) {
          sortante.el.pause();
          sortante.piste = null;
        }
      });
    }
    const v = lancer(suivant, 0, duree);
    if (v) active = voix.indexOf(v);
    d.planifier(duree * 1000, () => {
      if (fonduId === id) fondu = false;
    });
    noterReprise(true);
    prevenir();
  }

  /** Le morceau en cours sort en fondu et rien ne le remplace (la scène n'a aucun morceau). */
  function faireSilence(duree: number): void {
    const courant = voixActive();
    if (!ctx || !courant?.piste) return;
    fonduId++;
    fondu = false;
    precedent = courant.piste.id;
    const t = ctx.currentTime;
    courant.gain.gain.cancelScheduledValues(t);
    courant.gain.gain.setValueCurveAtTime(courbeFondu().sortie, t, duree);
    const g = courant.genre;
    d.planifier(duree * 1000 + 50, () => {
      if (courant.genre === g) {
        courant.el.pause();
        courant.piste = null;
        prevenir();
      }
    });
    prevenir();
  }

  /** La scène a changé : on garde le morceau en cours s'il y passe aussi, sinon on passe en fondu à un morceau de la scène (ou au silence). */
  function appliquerScene(): void {
    if (!ctx || arrete || enPause || toutes.length === 0) return;
    const c = candidats();
    const v = voixActive();
    if (v?.piste && c.some((p) => p.id === v.piste!.id)) return;
    if (c.length === 0) return faireSilence(FONDU_SCENE_S);
    fondu = false;
    fonduId++;
    enchainer(FONDU_SCENE_S);
  }

  /** `timeupdate` de la voix active : la fin approche (fondu) ; la position est notée. */
  function surTemps(v: Voix): void {
    if (v !== voixActive() || fondu || enPause) return;
    noterReprise();
    const dur = v.el.duration;
    if (Number.isFinite(dur) && dur > 0 && dur - v.el.currentTime <= FONDU_S + 0.15) enchainer(FONDU_S);
  }

  function surFin(v: Voix): void {
    // Un morceau qui finit sans fondu (durée inconnue du navigateur) : on enchaîne tout de suite.
    if (v === voixActive() && !fondu && !enPause) enchainer(FONDU_ENTREE_S);
  }

  function reveiller(): void {
    if (!ctx || arrete) return;
    if (ctx.state !== "running" && !d.cachee()) void ctx.resume().catch(() => undefined);
    const v = voixActive();
    if (v?.piste && v.el.paused && !enPause && !d.cachee()) v.el.play().catch(() => undefined);
    // Les écouteurs de geste restent tant que la musique ne joue pas vraiment.
    if (ctx.state === "running" && v && !v.el.paused) retirerGestes();
  }

  let retraits: (() => void)[] = [];
  function retirerGestes(): void {
    for (const r of retraits) r();
    retraits = [];
  }

  function arrierePlan(): void {
    if (!ctx || arrete) return;
    if (d.cachee()) {
      enPause = true;
      noterReprise(true);
      for (const v of voix) if (!v.el.paused) v.el.pause();
      void ctx.suspend().catch(() => undefined);
    } else {
      enPause = false;
      void ctx.resume().catch(() => undefined);
      const v = voixActive();
      if (v?.piste) v.el.play().catch(() => undefined);
      // Le fondu qui était en cours quand l'onglet est parti n'a plus de sens : l'autre voix reste en pause, sortie.
      fondu = false;
      fonduId++;
      appliquerScene();
    }
    prevenir();
  }

  async function demarrer(): Promise<void> {
    let liste;
    try {
      liste = lireListe(await d.chargerListe(`${d.base}liste.json`));
    } catch {
      liste = null;
    }
    if (arrete || !liste) return;
    toutes = pistesDuJeu(liste, d.jeu);
    if (toutes.length === 0) return;
    const c = d.creerContexte();
    if (!c) return;
    ctx = c;
    bus = c.createGain();
    bus.gain.value = 0;
    const comp = c.createDynamicsCompressor?.();
    if (comp) {
      // Un limiteur doux : rien ne sature, même un morceau trop fort.
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
      bus.connect(comp);
      comp.connect(c.destination);
    } else bus.connect(c.destination);
    voix = [0, 1].map(() => {
      const el = d.creerAudio();
      el.preload = "none";
      const correction = c.createGain();
      const gain = c.createGain();
      gain.gain.value = 0;
      c.createMediaElementSource(el).connect(correction);
      correction.connect(gain);
      gain.connect(bus!);
      const v: Voix = { el, gain, correction, piste: null, genre: 0 };
      el.addEventListener("timeupdate", () => surTemps(v));
      el.addEventListener("ended", () => surFin(v));
      return v;
    });
    appliquerNiveau();
    for (const g of GESTES) retraits.push(d.ecouter("fenetre", g, reveiller));
    desabonner.push(d.ecouter("document", "visibilitychange", arrierePlan), d.ecouter("fenetre", "pagehide", () => noterReprise(true)));
    const choix = departDeLaPage(candidats(), lireReprise(lire(d.session, CLE_REPRISE)), d.maintenant(), d.hasard);
    if (choix) {
      const v = lancer(choix.piste, choix.depart, FONDU_ENTREE_S);
      if (v) active = voix.indexOf(v);
    }
    reveiller();
    prevenir();
  }
  void demarrer();

  return {
    etat() {
      const v = voixActive();
      return {
        jeu: d.jeu,
        active: toutes.length > 0 && ctx !== null,
        joue: ctx?.state === "running" && !!v && !v.el.paused,
        enCours: v?.piste ? { id: v.piste.id, titre: v.piste.titre, artiste: v.piste.artiste, credit: v.piste.credit } : null,
        precedent,
        reglages: { ...reglages },
        baisse,
        sourdine,
        enPause,
        scene,
        pistes: candidats().map((p) => p.id),
      };
    },
    enCours: () => voixActive()?.piste ?? null,
    reglages: () => ({ ...reglages }),
    regler(patch) {
      reglages = { ...reglages, ...patch };
      reglages.volume = Math.min(1, Math.max(0, reglages.volume));
      ecrire(d.stockage, CLE_REGLAGES, ecrireReglages(reglages));
      appliquerNiveau();
      prevenir();
    },
    baisser(n) {
      const b = Math.min(1, Math.max(0, n));
      if (b === baisse) return; // un jeu peut le dire à chaque image
      baisse = b;
      appliquerNiveau();
    },
    actif: () => toutes.length > 0 && ctx !== null,
    scene(nom) {
      if (nom === scene) return;
      scene = nom;
      appliquerScene();
    },
    sourdine(coupe) {
      if (coupe === sourdine) return;
      sourdine = coupe;
      appliquerNiveau();
    },
    suivante() {
      if (enPause) return;
      fondu = false;
      enchainer(FONDU_SAUT_S);
    },
    surChangement(fn) {
      abonnes.add(fn);
      return () => abonnes.delete(fn);
    },
    geste: reveiller,
    arreter() {
      arrete = true;
      retirerGestes();
      desabonner.forEach((f) => f());
      for (const v of voix) v.el.pause();
    },
  };
}
