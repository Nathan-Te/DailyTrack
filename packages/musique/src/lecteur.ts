import { type Couche, creerCouche } from "./couche";
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
// de son jeu — tirage pondéré, jamais deux fois le même d'affilée, fondu enchaîné — sur deux voix reliées à un seul bus (niveau, compresseur). Tout ce qui touche au
// navigateur est injecté (`Dependances`) : les tests le remplacent par des faux.
//
// **Lot S2 : par Web Audio seulement, jamais par un élément `<audio>`** (un élément média qui joue prend la main sur l'audio du téléphone et coupe la vidéo ou la musique du
// joueur). Un morceau est téléchargé, décodé (`decodeAudioData`) puis lu par un `AudioBufferSourceNode`. **Au plus deux morceaux décodés à la fois** : celui qui joue et le
// suivant (préchargé pendant que le premier joue ; pendant un fondu, celui qui sort et celui qui entre). Un morceau décodé pèse lourd (voir `packages/musique/CLAUDE.md`).
//
// Règles des navigateurs : rien n'est demandé au réseau avant le premier geste (ce module n'est chargé qu'à ce moment-là) ; le contexte est réveillé à chaque geste tant qu'il
// ne joue pas (sur iPhone, seul un geste qui se termine le réveille) ; la musique se met en pause quand l'onglet passe en arrière-plan (le contexte se suspend, donc son
// horloge aussi : la position du morceau, qui se lit sur cette horloge, s'arrête) et reprend au retour ; la position du morceau est gardée (stockage de l'onglet) pour que la
// page suivante reprenne au même endroit.

/** Un morceau décodé (un `AudioBuffer` convient). */
export interface TamponAudio {
  readonly duration: number;
}
/** Une lecture d'un tampon (un `AudioBufferSourceNode` convient) : elle ne se relance pas, on en crée une par morceau. */
export interface SourceAudio extends NoeudAudio {
  buffer: TamponAudio | null;
  onended: (() => void) | null;
  start(quand?: number, decalage?: number): void;
  stop(quand?: number): void;
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
/** Un oscillateur (la couche du jeu : lot B6). */
export interface OscAudio extends NoeudAudio {
  type: string;
  frequency: ParamAudio;
  start(t: number): void;
  stop(t: number): void;
}
export interface ContexteAudio {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createGain(): GainAudio;
  /** Lot S2 : la lecture d'un morceau décodé (jamais un élément média). */
  createBufferSource(): SourceAudio;
  decodeAudioData(donnees: ArrayBuffer): Promise<TamponAudio>;
  /** Sans lui, la couche du jeu reste muette. */
  createOscillator?(): OscAudio;
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
  /** Lot S2 : le fichier d'un morceau, en entier (les octets encodés ; le lecteur les décode). */
  telecharger(url: string): Promise<ArrayBuffer>;
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
  /** Les morceaux décodés (ou en cours de décodage) que le lecteur garde en mémoire : `TAMPONS_MAX` au plus. */
  tampons: string[];
}

/** Le pas de la surveillance du morceau qui joue (position, fin proche, préchargement du suivant), en millisecondes. */
export const PAS_SURVEILLANCE_MS = 250;
/** Le délai avant de réessayer un préchargement qui a échoué (réseau, décodage). */
export const REESSAI_PRECHARGEMENT_MS = 10_000;
/** Combien de morceaux décodés le lecteur garde au plus : celui qui joue et le suivant. */
export const TAMPONS_MAX = 2;

interface Voix {
  /** La lecture en cours (`null` : la voix est libre). */
  source: SourceAudio | null;
  /** Le début de la lecture sur l'horloge du contexte, et la position du morceau à cet instant : la position est `depart + (horloge − debut)`. */
  debut: number;
  depart: number;
  duree: number;
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
  /** Le niveau demandé par le jeu (0 à 1). Avec `duree` (secondes), le niveau y arrive **en fondu** (95 % à la fin de la durée) ; sans, en un clin d'œil (60 ms). */
  baisser(niveau: number, duree?: number): void;
  /** La couche du jeu (arpège ou nappe, voir `couche.ts`) entre en fondu (`true`) ou en sort (`false`) : environ 1 s. Rien ne se passe si le morceau en cours n'a pas de tempo et de tonique (`liste.json`). */
  couche(actif: boolean): void;
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
  let couche: Couche | undefined;
  let coucheVoulue = false;
  /** Les morceaux décodés (ou en cours de téléchargement et de décodage), par identifiant : au plus `TAMPONS_MAX`. */
  const tampons = new Map<string, Promise<TamponAudio>>();
  /** Le morceau préchargé pour la suite (tiré d'avance : le fondu n'attend pas le réseau). */
  let suivantChoisi: PisteServie | null = null;
  /** Le morceau qu'on est en train de charger pour le lancer (le premier, ou celui d'un fondu) : il n'est pas encore sur une voix. */
  let enChargement: PisteServie | null = null;
  let prochainEssai = 0;
  /** Le premier morceau se charge : un changement de scène attend (il est vérifié quand le morceau arrive). */
  let premier = false;

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

  function appliquerNiveau(duree?: number): void {
    if (!ctx || !bus) return;
    bus.gain.setTargetAtTime(niveauFinal({ reglages, baisse, sourdine }), ctx.currentTime, duree ? duree / 3 : 0.06);
  }

  function noterReprise(force = false): void {
    const v = voixActive();
    if (!v?.piste) return;
    const t = d.maintenant();
    if (!force && t - derniereReprise < 1000) return;
    derniereReprise = t;
    ecrire(d.session, CLE_REPRISE, ecrireReprise({ id: v.piste.id, t: position(v), at: t }));
  }

  /** La position du morceau (secondes du fichier), lue sur l'horloge du contexte : elle s'arrête avec lui quand l'onglet est caché. */
  function position(v: Voix): number {
    if (!ctx || !v.source) return 0;
    return Math.min(v.duree, v.depart + Math.max(0, ctx.currentTime - v.debut));
  }

  /** Arrête la lecture d'une voix et lâche son tampon (il part avec la source). */
  function liberer(v: Voix): void {
    const s = v.source;
    v.source = null;
    v.piste = null;
    if (!s) return;
    s.onended = null;
    try {
      s.stop();
    } catch {
      /* déjà arrêtée */
    }
    s.disconnect?.();
  }

  /** Ne garde en mémoire que les morceaux utiles : ceux des voix et le suivant préchargé. */
  function purger(): void {
    const utiles = new Set<string>(voix.flatMap((v) => (v.piste ? [v.piste.id] : [])));
    if (suivantChoisi) utiles.add(suivantChoisi.id);
    if (enChargement) utiles.add(enChargement.id);
    for (const id of [...tampons.keys()]) if (!utiles.has(id)) tampons.delete(id);
  }

  /** Le morceau décodé (téléchargé et décodé une seule fois). L'appelant a déjà dit (voix, `suivantChoisi`, `enChargement`) quels morceaux sont utiles : les autres sont lâchés d'abord. */
  function tampon(piste: PisteServie): Promise<TamponAudio> {
    purger();
    let p = tampons.get(piste.id);
    if (!p) {
      const c = ctx!;
      p = d.telecharger(d.base + piste.fichier).then((octets) => c.decodeAudioData(octets));
      tampons.set(piste.id, p);
      const retrait = p;
      p.catch(() => {
        if (tampons.get(piste.id) === retrait) tampons.delete(piste.id); // un échec ne reste pas en mémoire : un autre essai repart de zéro
      });
    }
    return p;
  }

  /** Lance `piste` (déjà décodé) sur la voix libre, avec un fondu d'entrée de `entree` secondes (0 : plein tout de suite). */
  function lancer(piste: PisteServie, tamponDe: TamponAudio, depart: number, entree: number): Voix {
    const c = ctx!;
    // La voix libre : l'autre que celle qui joue ; au démarrage (rien ne joue), la première.
    const libre = voix[active]?.piste ? voix[1 - active]! : voix[active]!;
    liberer(libre);
    libre.genre = ++genre;
    libre.piste = piste;
    const source = c.createBufferSource();
    source.buffer = tamponDe;
    source.connect(libre.correction);
    const g = libre.genre;
    source.onended = () => {
      if (libre.genre === g && libre.source === source) surFin(libre);
    };
    const t = c.currentTime;
    const decalage = Math.min(Math.max(0, depart), Math.max(0, tamponDe.duration - 1));
    libre.source = source;
    libre.debut = t;
    libre.depart = decalage;
    libre.duree = tamponDe.duration;
    libre.correction.gain.setValueAtTime(gainDeDb(piste.volumeDb), t);
    libre.gain.gain.cancelScheduledValues(t);
    if (entree > 0) {
      libre.gain.gain.setValueAtTime(0, t);
      libre.gain.gain.setValueCurveAtTime(courbeFondu().entree, t, entree);
    } else libre.gain.gain.setValueAtTime(1, t);
    source.start(t, decalage); // contexte suspendu (avant un geste) : la lecture démarre au réveil, `geste()` le réveille
    return libre;
  }

  /** Le morceau préchargé s'il peut encore servir : il est de la scène et ce n'est pas celui qui joue. */
  function suivantValide(courantId: string | null | undefined): PisteServie | null {
    const s = suivantChoisi;
    return s && s.id !== courantId && candidats().some((p) => p.id === s.id) ? s : null;
  }

  /** Précharge le morceau qui suivra celui qui joue (un seul à la fois, et jamais un troisième tampon). */
  function preparerSuivant(): void {
    const courant = voixActive();
    const autre = voix[1 - active];
    if (!ctx || arrete || fondu || suivantChoisi || enChargement || !courant?.piste || autre?.piste || d.maintenant() < prochainEssai) return;
    const choix = choisirSuivante(candidats(), courant.piste.id, d.hasard);
    if (!choix) return;
    suivantChoisi = choix;
    tampon(choix).catch(() => {
      if (suivantChoisi === choix) suivantChoisi = null;
      prochainEssai = d.maintenant() + REESSAI_PRECHARGEMENT_MS;
    });
  }

  /** Enchaîne : le morceau en cours sort en fondu, le suivant (préchargé, sinon chargé maintenant) entre en fondu. `duree` : la durée du fondu. */
  function enchainer(duree: number): void {
    if (fondu || !ctx || arrete) return;
    const courant = voixActive();
    const suivant = suivantValide(courant?.piste?.id) ?? choisirSuivante(candidats(), courant?.piste?.id ?? precedent, d.hasard);
    if (!suivant) return;
    fondu = true;
    const id = ++fonduId;
    // Au plus deux morceaux décodés : un fondu en cours qu'on remplace coupe la voix qui sortait, et le préchargement devient le morceau qu'on charge.
    const libre = voix[1 - active];
    if (libre?.piste) liberer(libre);
    suivantChoisi = null;
    enChargement = suivant;
    const pret = tampon(suivant);
    pret.then(
      (decode) => {
        if (fonduId !== id || arrete || !ctx) return; // une autre demande est passée devant
        enChargement = null;
        const sortante = voixActive();
        if (sortante?.piste) {
          precedent = sortante.piste.id;
          const t = ctx.currentTime;
          sortante.gain.gain.cancelScheduledValues(t);
          sortante.gain.gain.setValueCurveAtTime(courbeFondu().sortie, t, duree);
          const g = sortante.genre;
          d.planifier(duree * 1000 + 50, () => {
            if (sortante.genre === g) {
              liberer(sortante);
              purger();
            }
          });
        }
        const v = lancer(suivant, decode, 0, duree);
        active = voix.indexOf(v);
        d.planifier(duree * 1000, () => {
          if (fonduId === id) fondu = false;
        });
        noterReprise(true);
        prevenir();
      },
      () => {
        // Le réseau ou le décodage a échoué : le morceau en cours continue (ou finit en silence) ; la fin du morceau, « suivant » ou un changement de scène réessaie.
        if (fonduId !== id) return;
        fondu = false;
        enChargement = null;
      },
    );
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
    suivantChoisi = null;
    const g = courant.genre;
    d.planifier(duree * 1000 + 50, () => {
      if (courant.genre === g) {
        liberer(courant);
        purger();
        prevenir();
      }
    });
    prevenir();
  }

  /** La scène a changé : on garde le morceau en cours s'il y passe aussi, sinon on passe en fondu à un morceau de la scène (ou au silence). */
  function appliquerScene(): void {
    if (!ctx || arrete || enPause || premier || toutes.length === 0) return;
    const c = candidats();
    const v = voixActive();
    if (v?.piste && c.some((p) => p.id === v.piste!.id)) return;
    if (c.length === 0) return faireSilence(FONDU_SCENE_S);
    fondu = false;
    fonduId++;
    enchainer(FONDU_SCENE_S);
  }

  /** Tous les `PAS_SURVEILLANCE_MS` : la position de la voix active est notée (reprise, couche) ; la fin approche (fondu) ; sinon le suivant se précharge. */
  function surveiller(): void {
    if (arrete) return;
    d.planifier(PAS_SURVEILLANCE_MS, surveiller);
    const v = voixActive();
    if (!ctx || !v?.piste || !v.source || enPause) return;
    const pos = position(v);
    couche?.lire(v.genre, pos - ctx.currentTime, pos);
    if (fondu) return;
    noterReprise();
    if (v.duree > 0 && v.duree - pos <= FONDU_S + 0.15) enchainer(FONDU_S);
    else preparerSuivant();
  }

  /** Une lecture a fini toute seule (aucun fondu ne l'a relayée) : on enchaîne tout de suite. */
  function surFin(v: Voix): void {
    if (v === voixActive() && !fondu && !enPause) enchainer(FONDU_ENTREE_S);
  }

  function reveiller(): void {
    if (!ctx || arrete) return;
    if (ctx.state !== "running" && !d.cachee()) void ctx.resume().catch(() => undefined);
    // Les écouteurs de geste restent tant que la musique ne joue pas vraiment.
    if (ctx.state === "running" && voixActive()?.source) retirerGestes();
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
      void ctx.suspend().catch(() => undefined); // l'horloge du contexte s'arrête : les lectures en cours attendent, au même endroit
    } else {
      enPause = false;
      void ctx.resume().catch(() => undefined);
      // Le fondu qui était en cours quand l'onglet est parti n'a plus de sens : on reprend la suite sans lui.
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
      const correction = c.createGain();
      const gain = c.createGain();
      gain.gain.value = 0;
      correction.connect(gain);
      gain.connect(bus!);
      return { source: null, debut: 0, depart: 0, duree: 0, gain, correction, piste: null, genre: 0 } satisfies Voix;
    });
    appliquerNiveau();
    if (c.createOscillator) {
      couche = creerCouche({
        ctx: c,
        bus,
        piste: () => voixActive()?.piste ?? null,
        flux: () => {
          const v = voixActive();
          return v?.piste && v.source ? { genre: v.genre, t: position(v) } : null;
        },
        audible: () => !enPause && !d.cachee() && c.state === "running" && niveauFinal({ reglages, baisse, sourdine }) > 0,
        hasard: d.hasard,
        planifier: d.planifier,
      });
      couche.regler(coucheVoulue);
    }
    for (const g of GESTES) retraits.push(d.ecouter("fenetre", g, reveiller));
    desabonner.push(d.ecouter("document", "visibilitychange", arrierePlan), d.ecouter("fenetre", "pagehide", () => noterReprise(true)));
    d.planifier(PAS_SURVEILLANCE_MS, surveiller);
    const choix = departDeLaPage(candidats(), lireReprise(lire(d.session, CLE_REPRISE)), d.maintenant(), d.hasard);
    reveiller();
    prevenir();
    if (!choix) return;
    // Le premier morceau se télécharge et se décode avant de commencer ; si le jeu a changé de scène entre-temps, il passe son tour.
    premier = true;
    enChargement = choix.piste;
    try {
      const decode = await tampon(choix.piste);
      premier = false;
      enChargement = null;
      if (arrete || fondu || voixActive()?.piste) return; // un « suivant » a pris la place
      if (!candidats().some((p) => p.id === choix.piste.id)) return appliquerScene(); // la scène a changé pendant le chargement
      active = voix.indexOf(lancer(choix.piste, decode, choix.depart, FONDU_ENTREE_S));
      reveiller();
      prevenir();
    } catch {
      premier = false;
      enChargement = null;
    }
  }
  void demarrer();

  return {
    etat() {
      const v = voixActive();
      return {
        jeu: d.jeu,
        active: toutes.length > 0 && ctx !== null,
        joue: ctx?.state === "running" && !!v?.source,
        enCours: v?.piste ? { id: v.piste.id, titre: v.piste.titre, artiste: v.piste.artiste, credit: v.piste.credit } : null,
        precedent,
        reglages: { ...reglages },
        baisse,
        sourdine,
        enPause,
        scene,
        pistes: candidats().map((p) => p.id),
        tampons: [...tampons.keys()],
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
    baisser(n, duree) {
      const b = Math.min(1, Math.max(0, n));
      if (b === baisse) return; // un jeu peut le dire à chaque image
      baisse = b;
      appliquerNiveau(duree);
    },
    couche(a) {
      coucheVoulue = a;
      couche?.regler(a);
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
      for (const v of voix) liberer(v);
      tampons.clear();
      suivantChoisi = null;
      enChargement = null;
    },
  };
}
