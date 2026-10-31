// Lot 56 — le lecteur d'ambiance : joue l'ambiance d'un thème (lit continu, couche liée au décor, événements espacés, réactions) dans un contexte audio.
// **Lecture seule** : l'ambiance ne reçoit de la course que la vitesse, « en course » et la position du décor (`EntreeAmbiance`) ; elle ne change jamais une course, ne lit ni
// l'horloge murale ni le hasard non semé (graine fixe). À la demande, avec le thème ; jamais avant le premier geste (le contexte n'existe pas avant). Tout nœud bref passe par
// `Compteur.bref` (se détache à la fin de sa source), un permanent par `nd` : rien ne s'accumule, rien ne fuit au recommencement ni au changement de thème.
// Règle d'empaquetage : aucun import d'une valeur du premier chargement.
import { Compteur } from "../moteur";
import { coupureSelonVitesse, niveauReaction, niveauSelonVitesse, type DonneesAmbiance, type EntreeAmbiance, type FluxDef, type Reaction, type ThemeAmbiance } from "./donnees";
import { SR, alea, entre, parmi, type Alea } from "./kit";

export { THEMES_AMBIANCE, themeAmbianceDe, type EntreeAmbiance, type Reaction, type ThemeAmbiance } from "./donnees";

/** Les recettes, chacune son morceau : un thème ne charge que la sienne. */
const RECETTES: Record<ThemeAmbiance, () => Promise<{ fabriquer(): Promise<DonneesAmbiance> }>> = {
  stade: () => import("./themes/stade"),
  rallye: () => import("./themes/rallye"),
  banquise: () => import("./themes/banquise"),
  campagne: () => import("./themes/campagne"),
  canyon: () => import("./themes/canyon"),
  col: () => import("./themes/col"),
  ville: () => import("./themes/ville"),
  nuit: () => import("./themes/nuit"),
};

export interface Fabrication {
  donnees: DonneesAmbiance;
  /** Temps de rendu du thème (ms), sur cet appareil. */
  renduMs: number;
  /** Mémoire des tampons (octets). */
  memoire: number;
}

const cache = new Map<ThemeAmbiance, Promise<Fabrication>>();

/** Rend l'ambiance d'un thème (une fois par page : les deux derniers thèmes sont gardés, le Salon change de thème toutes les dix minutes). */
export function fabriquerAmbiance(theme: ThemeAmbiance): Promise<Fabrication> {
  let p = cache.get(theme);
  if (!p) {
    const debut = performance.now();
    p = RECETTES[theme]()
      .then((m) => m.fabriquer())
      .then((donnees) => ({ donnees, renduMs: performance.now() - debut, memoire: memoireDe(donnees) }));
    cache.set(theme, p);
    p.catch(() => cache.delete(theme)); // hors ligne : on réessaiera
    while (cache.size > 2) cache.delete(cache.keys().next().value as ThemeAmbiance);
  }
  return p;
}

export const memoireDe = (d: DonneesAmbiance): number => 4 * (d.lit.reduce((s, c) => s + c.length, 0) + (d.local?.canaux.reduce((s, c) => s + c.length, 0) ?? 0) + d.banque.donnees.length);

export interface OptionsAmbiance {
  ctx: BaseAudioContext;
  /** Où l'ambiance se branche (le bus « ambiance » du jeu). */
  sortie: AudioNode;
  theme: ThemeAmbiance;
  /** Graine des tirages (le même thème, la même graine : les mêmes événements, au même rythme). */
  graine?: number;
  /** Instant de départ (s) : par défaut l'horloge du contexte ; un rendu hors ligne donne 0. */
  t0?: number;
  /** Des données déjà fabriquées (essais). */
  fabrication?: Fabrication;
}

export interface EtatAmbiance {
  theme: ThemeAmbiance;
  /** Nœuds permanents, nœuds brefs encore vivants, événements joués, derniers événements (nom et instant). */
  noeuds: number;
  brefs: number;
  joues: number;
  derniers: string[];
  /** Gain du bus, coupure (Hz), niveau du décor. */
  gain: number;
  coupure: number;
  local: number;
  renduMs: number;
}

export interface Ambiance {
  readonly theme: ThemeAmbiance;
  /** À chaque image : règle le volume, la coupure, le décor, et lance les événements dus. */
  maj(e: EntreeAmbiance): void;
  /** La foule (et ce qui réagit) à un point de contrôle ou à l'arrivée. */
  reagir(r: Reaction): void;
  /** Joue tout de suite un événement (le flux nommé, ou le prochain dû) : écoute sur la planche. */
  declencher(nom?: string): void;
  /** Un multiplicateur de niveau de l'ambiance entière (la planche) : 1 par défaut. */
  regler(niveau: number): void;
  etat(): EtatAmbiance;
  /** Arrête les sources et détache tous les nœuds (le thème change, la course recommence, le Salon bascule). */
  arreter(): void;
}

interface EtatFlux {
  def: FluxDef;
  prochain: number;
}

/** Les tampons d'une fabrication, dans un contexte. */
function tampons(ctx: BaseAudioContext, d: DonneesAmbiance) {
  const stereo = (canaux: Float32Array[]) => {
    const b = ctx.createBuffer(canaux.length, canaux[0]!.length, SR);
    canaux.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
    return b;
  };
  const banque = ctx.createBuffer(1, d.banque.donnees.length, SR);
  banque.copyToChannel(d.banque.donnees as Float32Array<ArrayBuffer>, 0);
  return { lit: stereo(d.lit), local: d.local ? stereo(d.local.canaux) : null, banque };
}

export async function creerAmbiance(o: OptionsAmbiance): Promise<Ambiance> {
  const fab = o.fabrication ?? (await fabriquerAmbiance(o.theme));
  const d = fab.donnees;
  const { ctx } = o;
  const a: Alea = alea(o.graine ?? 20261031);
  const c = new Compteur();
  const t0 = o.t0 ?? ctx.currentTime;
  const buf = tampons(ctx, d);

  // Le bus de l'ambiance : le gain (volume, vitesse), le passe-bas (ce qui est lointain disparaît d'abord en vitesse), puis la sortie.
  const bus = c.nd(ctx.createGain());
  bus.gain.value = 0;
  const coupe = c.nd(ctx.createBiquadFilter());
  coupe.type = "lowpass";
  coupe.frequency.value = 9000;
  coupe.Q.value = 0.5;
  bus.connect(coupe).connect(o.sortie);
  // Les réactions passent par leur propre gain : la vitesse les couvre moins que le reste.
  const busReaction = c.nd(ctx.createGain());
  busReaction.gain.value = 0;
  busReaction.connect(o.sortie);

  // Le lit : deux lectures du même tampon à deux hauteurs (la boucle ne se retrouve jamais), départ à un endroit tiré.
  const lire = (b: AudioBuffer, taux: number, gain: number, dest: AudioNode) => {
    const s = c.nd(ctx.createBufferSource());
    s.buffer = b;
    s.loop = true;
    s.playbackRate.value = taux;
    const g = c.nd(ctx.createGain());
    g.gain.value = gain;
    s.connect(g).connect(dest);
    s.start(t0, a() * b.duration);
    return g;
  };
  if (d.deuxLectures) {
    lire(buf.lit, 1, 0.72, bus);
    lire(buf.lit, 0.87, 0.72, bus);
  } else lire(buf.lit, 1, 1, bus);

  // La couche liée au décor : un gain qui suit la proximité, un panoramique qui suit le côté.
  let local: { g: GainNode; pan: StereoPannerNode | null } | null = null;
  if (d.local && buf.local) {
    const g = lire(buf.local, 1, 0, bus);
    const pan = typeof ctx.createStereoPanner === "function" ? c.nd(ctx.createStereoPanner()) : null;
    if (pan) {
      g.disconnect();
      g.connect(pan).connect(bus);
    }
    local = { g, pan };
  }

  const flux: EtatFlux[] = d.flux.map((def) => ({ def, prochain: t0 + entre(a, def.premier[0], def.premier[1]) }));
  const derniers: string[] = [];
  let joues = 0;
  const noter = (nom: string, t: number) => {
    joues++;
    derniers.push(`${nom}@${t.toFixed(1)}`);
    if (derniers.length > 96) derniers.shift();
  };

  /** Joue une variante d'un groupe de la banque : hauteur, volume et position tirés. */
  const jouer = (def: FluxDef, t: number, dest: AudioNode, gain: number) => {
    const variantes = d.banque.tranches[def.nom];
    if (!variantes?.length) return;
    const tr = parmi(a, variantes);
    const taux = entre(a, def.hauteur[0], def.hauteur[1]);
    const src = ctx.createBufferSource();
    src.buffer = buf.banque;
    src.playbackRate.value = taux;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = def.coupure;
    lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = gain;
    const liés: AudioNode[] = [lp, g];
    src.connect(lp).connect(g);
    if (typeof ctx.createStereoPanner === "function") {
      const pan = ctx.createStereoPanner();
      liés.push(pan);
      g.connect(pan).connect(dest);
      if (def.balayage) {
        const sens = a() < 0.5 ? 1 : -1;
        pan.pan.setValueAtTime(def.balayage[0] * sens, t);
        pan.pan.linearRampToValueAtTime(def.balayage[1] * sens, t + tr.duree / taux);
      } else pan.pan.value = entre(a, def.pan[0], def.pan[1]);
    } else g.connect(dest);
    c.bref(src, ...liés);
    src.start(t, tr.debut, tr.duree);
    noter(def.nom, t);
  };

  let tPrec = t0;
  let derive = 1;
  let deriveCible = 1;
  let prochaineDerive = t0 + 4;
  let niveauRegle = 1;
  let gainBus = 0;
  let coupure = 9000;
  let niveauLocal = 0;
  let vitesse = 0;
  let actifPrec = false;

  return {
    theme: o.theme,
    maj(e) {
      const t = e.t ?? ctx.currentTime;
      const dt = Math.max(0, Math.min(0.1, t - tPrec));
      vitesse = e.vitesse;
      // La dérive lente : toutes les quatre à neuf secondes l'ambiance respire un peu plus ou un peu moins (rien ne se répète exactement).
      if (t >= prochaineDerive) {
        deriveCible = entre(a, 0.78, 1.12);
        prochaineDerive = t + entre(a, 4, 9);
      }
      derive += (deriveCible - derive) * Math.min(1, dt * 0.35);
      gainBus = e.actif ? d.niveau * niveauRegle * niveauSelonVitesse(e.vitesse) * derive : 0;
      coupure = coupureSelonVitesse(e.vitesse);
      bus.gain.setTargetAtTime(gainBus, t, 0.35);
      coupe.frequency.setTargetAtTime(coupure, t, 0.4);
      busReaction.gain.setTargetAtTime(e.actif ? d.niveau * niveauRegle * niveauReaction(e.vitesse) : 0, t, 0.1);
      if (local) {
        const p = e.decor?.proche ?? 0;
        niveauLocal = d.local!.base + (1 - d.local!.base) * Math.min(1, Math.max(0, p));
        local.g.gain.setTargetAtTime(niveauLocal * (e.decor === null ? 0 : 1), t, 0.25);
        local.pan?.pan.setTargetAtTime(Math.min(1, Math.max(-1, e.decor?.cote ?? 0)), t, 0.25);
      }
      // Les événements : un tirage à chaque échéance ; pendant une pause, les échéances attendent (aucune rafale au retour).
      if (e.actif) {
        if (!actifPrec) for (const f of flux) f.prochain = Math.max(f.prochain, t + 0.5);
        for (const f of flux) {
          if (t < f.prochain) continue;
          if (c.brefsVivants < 14) jouer(f.def, t + 0.02, bus, entre(a, f.def.gain[0], f.def.gain[1]));
          f.prochain = t + entre(a, f.def.ecart[0], f.def.ecart[1]);
        }
      } else for (const f of flux) f.prochain += t - tPrec;
      actifPrec = e.actif;
      tPrec = t;
    },
    reagir(r) {
      const def = d.reactions[r];
      const variantes = def ? d.banque.tranches[def.nom] : undefined;
      if (!def || !variantes?.length || !actifPrec) return;
      jouer({ nom: def.nom, ecart: [0, 0], premier: [0, 0], gain: [def.gain, def.gain], pan: [0, 0], hauteur: [0.97, 1.03], coupure: 9000 }, tPrec + 0.02, busReaction, def.gain);
    },
    declencher(nom) {
      const f = nom ? flux.find((x) => x.def.nom === nom) : flux.reduce((m, x) => (x.prochain < m.prochain ? x : m), flux[0]!);
      if (f) jouer(f.def, tPrec + 0.02, bus, entre(a, f.def.gain[0], f.def.gain[1]));
    },
    regler(n) {
      niveauRegle = Math.max(0, n);
    },
    etat: () => ({ theme: o.theme, noeuds: c.n, brefs: c.brefsVivants, joues, derniers: [...derniers], gain: gainBus, coupure, local: niveauLocal, renduMs: fab.renduMs }),
    arreter() {
      c.tout();
    },
  };
}
