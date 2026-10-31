import { describe, expect, it } from "vitest";
import type { EvenementJeu } from "../src/evenements";
import { GENRES_EVENEMENTS } from "../src/evenements";
import { hasardAffichage } from "../src/hasardAffichage";
import { ecrireSons, lireSons, SONS_DEFAUT } from "../src/reglagesSons";
import { type ContexteAudio, GESTES_DEVERROUILLAGE, Sons } from "../src/sons";
import { accepter, ATTENTE_CRIS_S, FAMILLE_DE, FAMILLES, FiltreCris, gainDe, gainDuCurseur, noteFreq, PHRASES_MEDAILLES, sonDe, VOIX_MAX, VOLUMES_DEFAUT } from "../src/sonsLogique";

// Lot T5 — les sons : la logique (quel son pour quel événement) est pure ; le lecteur est essayé sur un FAUX contexte audio (aucun vrai `AudioContext` ici). Aucun son avant le premier geste.

/** Un contexte audio factice : il compte ce qu'on lui demande de jouer. */
class FauxContexte {
  currentTime = 0;
  state = "suspended" as AudioContextState;
  sampleRate = 8000;
  destination = {} as AudioDestinationNode;
  oscillateurs = 0;
  bruits = 0;
  gains = 0;
  resumes = 0;
  suspends = 0;
  private param() {
    return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} };
  }
  createGain() {
    this.gains++;
    return { gain: this.param(), connect() {} } as unknown as GainNode;
  }
  createOscillator() {
    this.oscillateurs++;
    return { type: "sine", frequency: this.param(), connect() {}, start() {}, stop() {} } as unknown as OscillatorNode;
  }
  createBufferSource() {
    this.bruits++;
    return { buffer: null, loop: false, connect() {}, start() {}, stop() {} } as unknown as AudioBufferSourceNode;
  }
  createBiquadFilter() {
    return { type: "bandpass", frequency: this.param(), Q: { value: 0 }, connect() {} } as unknown as BiquadFilterNode;
  }
  createBuffer(_c: number, n: number) {
    return { getChannelData: () => new Float32Array(n) } as unknown as AudioBuffer;
  }
  resume() {
    this.resumes++;
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.suspends++;
    this.state = "suspended";
    return Promise.resolve();
  }
}

/** Une cible d'événements factice : le test « fait » les gestes. */
function cible() {
  const gestionnaires = new Map<string, () => void>();
  return {
    addEventListener: (t: string, f: unknown) => void gestionnaires.set(t, f as () => void),
    removeEventListener: (t: string) => void gestionnaires.delete(t),
    geste: (t: string) => gestionnaires.get(t)?.(),
    types: () => [...gestionnaires.keys()],
  };
}

function fabrique(o: { actifs?: boolean; volume?: number; familles?: Partial<typeof VOLUMES_DEFAUT> } = {}) {
  const ctx = new FauxContexte();
  const c = cible();
  let crees = 0;
  const reglages = { actifs: o.actifs ?? true, volume: o.volume ?? 0.8 };
  const sons = new Sons({ reglages: () => reglages, volumes: () => ({ ...VOLUMES_DEFAUT, ...o.familles }), hasard: hasardAffichage(1), creerContexte: () => (crees++, ctx as unknown as ContexteAudio), cible: c });
  sons.brancher();
  return { sons, ctx, c, reglages, crees: () => crees };
}

/** Un exemplaire de chaque événement. */
const EXEMPLES: EvenementJeu[] = [
  { genre: "deplacement" },
  { genre: "rotation" },
  { genre: "contact", taille: "normale", vitesse: 3 },
  { genre: "palier", effet: "lierre", bonus: true },
  { genre: "palier", effet: "vent", bonus: false },
  { genre: "effet", effet: "petite", bonus: true },
  { genre: "effet", effet: "geante", bonus: false },
  { genre: "perte", x: 2, taille: "normale", cascade: 0 },
  { genre: "plouf", x: 2, taille: "normale" },
  { genre: "effondrement", force: 2 },
  { genre: "ventDebut" },
  { genre: "ventFin" },
  { genre: "cri", id: 3 },
  { genre: "fin", motif: "pieces" },
  { genre: "fin", motif: "vies" },
  { genre: "medaille", nom: "bronze" },
  { genre: "medaille", nom: "argent" },
  { genre: "medaille", nom: "or" },
  { genre: "medaille", nom: "auteur" },
];

describe("la logique des sons : un son pour chaque événement", () => {
  it("chaque genre d'événement a une recette, une famille de volume, des couches non vides", () => {
    for (const g of GENRES_EVENEMENTS) expect(EXEMPLES.some((e) => e.genre === g), `un exemple de ${g}`).toBe(true);
    for (const e of EXEMPLES) {
      const r = sonDe(e, 0.5);
      expect(r.couches.length, e.genre).toBeGreaterThan(0);
      expect(r.duree, e.genre).toBeGreaterThan(0);
      expect(FAMILLES).toContain(r.famille);
      expect(r.famille).toBe(FAMILLE_DE[e.genre]);
      for (const c of r.couches) {
        expect(c.freq).toBeGreaterThan(0);
        expect(c.duree).toBeGreaterThan(0);
        expect(c.gain).toBeGreaterThan(0);
        expect(c.gain).toBeLessThan(0.5); // aucun effet n'écrase la musique
      }
    }
  });

  it("le choc d'un contact : sa hauteur dépend de la taille (petite aiguë, géante grave), son volume de la vitesse", () => {
    const f = (taille: "petite" | "normale" | "geante") => sonDe({ genre: "contact", taille, vitesse: 3 }).couches[0]!.freq;
    expect(f("petite")).toBeGreaterThan(f("normale"));
    expect(f("normale")).toBeGreaterThan(f("geante"));
    const g = (vitesse: number) => sonDe({ genre: "contact", taille: "normale", vitesse }).couches[0]!.gain;
    expect(g(0.5)).toBeLessThan(g(2));
    expect(g(2)).toBeLessThan(g(5));
    expect(g(50)).toBe(g(5)); // plafonné
  });

  it("un bonus monte, un malus descend (palier : les notes ; effet : le glissando)", () => {
    const notes = (bonus: boolean) => sonDe({ genre: "palier", effet: bonus ? "lierre" : "vent", bonus }).couches.map((c) => c.freq);
    const m = notes(true);
    const d = notes(false);
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThan(m[i - 1]!);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeLessThan(d[i - 1]!);
    const gl = (bonus: boolean) => sonDe({ genre: "effet", effet: bonus ? "petite" : "geante", bonus }).couches[0]!;
    expect(gl(true).vers!).toBeGreaterThan(gl(true).freq);
    expect(gl(false).vers!).toBeLessThan(gl(false).freq);
  });

  it("la chute : un sifflement qui descend, puis un « plouf » plus grave pour une grande pièce ; la fanfare d'une médaille est plus longue et plus haute à chaque marche", () => {
    const s = sonDe({ genre: "perte", x: 0, taille: "normale", cascade: 0 }).couches[0]!;
    expect(s.vers!).toBeLessThan(s.freq);
    const plouf = (taille: "petite" | "geante") => sonDe({ genre: "plouf", x: 0, taille }).couches.find((c) => c.type === "note")!.freq;
    expect(plouf("geante")).toBeLessThan(plouf("petite"));
    const duree = (nom: "bronze" | "argent" | "or" | "auteur") => sonDe({ genre: "medaille", nom }).duree;
    expect(duree("argent")).toBeGreaterThan(duree("bronze"));
    expect(duree("or")).toBeGreaterThan(duree("argent"));
    expect(duree("auteur")).toBeGreaterThan(duree("or"));
    const dernier = (nom: "bronze" | "argent" | "or" | "auteur") => PHRASES_MEDAILLES[nom].at(-1)!.note;
    expect(dernier("auteur")).toBeGreaterThan(dernier("or"));
    expect(noteFreq(0)).toBe(440);
  });

  it("les volumes : sons coupés = silence, famille à 0 = silence de la famille, curseur quadratique", () => {
    const e: EvenementJeu = { genre: "contact", taille: "normale", vitesse: 3 };
    expect(gainDe(e, { actifs: false, volume: 1 }, VOLUMES_DEFAUT)).toBe(0);
    expect(gainDe(e, { actifs: true, volume: 1 }, { ...VOLUMES_DEFAUT, contacts: 0 })).toBe(0);
    expect(gainDe(e, { actifs: true, volume: 1 }, VOLUMES_DEFAUT)).toBe(1);
    expect(gainDe(e, { actifs: true, volume: 0.5 }, VOLUMES_DEFAUT)).toBeCloseTo(0.25);
    expect(gainDuCurseur(2)).toBe(1);
    expect(gainDuCurseur(-1)).toBe(0);
  });

  it("la polyphonie est plafonnée : un clic cède avant un effondrement, un son essentiel passe toujours", () => {
    expect(accepter(0, 0)).toBe(true);
    expect(accepter(0, VOIX_MAX)).toBe(false);
    expect(accepter(2, VOIX_MAX - 2)).toBe(true);
    expect(accepter(2, VOIX_MAX - 1)).toBe(false);
    expect(accepter(0, VOIX_MAX - 3)).toBe(false); // le clic cède d'abord
    expect(accepter(3, VOIX_MAX * 5)).toBe(true);
  });

  it("les cris sont rares et bornés : une seule voix à la fois, un seul toutes les quelques secondes", () => {
    const f = new FiltreCris();
    expect(f.accepter(0, 0.2)).toBe(true);
    expect(f.accepter(0.1, 0.2)).toBe(false); // une seule voix
    expect(f.accepter(ATTENTE_CRIS_S - 0.1, 0.2)).toBe(false); // trop tôt
    expect(f.accepter(ATTENTE_CRIS_S + 0.1, 0.2)).toBe(true);
  });
});

describe("le lecteur : aucun son avant le premier geste", () => {
  it("avant tout geste, aucun contexte audio n'est créé et rien ne se joue (ni mis en file)", () => {
    const { sons, ctx, crees } = fabrique();
    for (const e of EXEMPLES) expect(sons.jouer(e), e.genre).toBe(false);
    expect(crees()).toBe(0);
    expect(sons.pret).toBe(false);
    expect(ctx.oscillateurs + ctx.bruits + ctx.gains).toBe(0);
    expect(sons.joues).toHaveLength(0);
    // Le premier geste crée le contexte ; ce qui a été perdu avant n'est pas rejoué.
    sons.deverrouiller();
    expect(sons.pret).toBe(true);
    expect(ctx.oscillateurs + ctx.bruits).toBe(0);
  });

  it("chaque geste connu (pointeur, clavier, toucher) déverrouille ; une fois, pas deux contextes", () => {
    for (const g of GESTES_DEVERROUILLAGE) {
      const { sons, c, crees } = fabrique();
      expect(c.types()).toContain(g);
      c.geste(g);
      c.geste(g);
      expect(sons.pret, g).toBe(true);
      expect(crees()).toBe(1);
    }
  });

  it("après le geste, chaque événement déclenche son son (oscillateur ou bruit), et le cri est limité", () => {
    const { sons, ctx, c } = fabrique();
    c.geste("keydown");
    expect(ctx.resumes).toBeGreaterThan(0);
    for (const e of EXEMPLES) {
      ctx.currentTime += 5; // laisse finir le son précédent (polyphonie, cris)
      const avant = ctx.oscillateurs + ctx.bruits;
      expect(sons.jouer(e), e.genre).toBe(true);
      expect(ctx.oscillateurs + ctx.bruits, e.genre).toBeGreaterThan(avant);
    }
    expect(sons.joues).toHaveLength(EXEMPLES.length);
    // Deux cris aussitôt : le second est refusé.
    ctx.currentTime += 10;
    expect(sons.jouer({ genre: "cri", id: 1 })).toBe(true);
    expect(sons.jouer({ genre: "cri", id: 2 })).toBe(false);
  });

  it("« Sons : non » ne joue rien ; une famille à 0 se tait ; les cris se règlent à zéro", () => {
    const off = fabrique({ actifs: false });
    off.c.geste("click");
    for (const e of EXEMPLES) expect(off.sons.jouer(e), e.genre).toBe(false);
    expect(off.ctx.oscillateurs + off.ctx.bruits).toBe(0);
    const sansCris = fabrique({ familles: { cris: 0 } });
    sansCris.c.geste("click");
    expect(sansCris.sons.jouer({ genre: "cri", id: 1 })).toBe(false);
    expect(sansCris.sons.jouer({ genre: "deplacement" })).toBe(true);
  });

  it("les effets ne coupent jamais la musique : le lecteur ne touche à aucun autre contexte, et suspend le sien seulement quand l'onglet est caché", () => {
    const { sons, ctx, c } = fabrique();
    c.geste("pointerdown");
    sons.jouer({ genre: "contact", taille: "normale", vitesse: 4 });
    expect(ctx.suspends).toBe(0);
    sons.surVisibilite(true);
    expect(ctx.suspends).toBe(1);
    sons.surVisibilite(false);
    expect(ctx.state).toBe("running");
  });

  it("le souffle du vent est une boucle qui suit ventDebut et ventFin, même demandée avant le geste", () => {
    const { sons, ctx, c } = fabrique();
    sons.souffle(true); // avant le geste : mémorisé, rien ne joue
    expect(ctx.bruits).toBe(0);
    c.geste("keydown");
    expect(ctx.bruits).toBe(1); // la boucle démarre au déverrouillage
    sons.jouer({ genre: "ventFin" });
    sons.jouer({ genre: "ventDebut" });
    expect(ctx.bruits).toBeGreaterThanOrEqual(2); // + le petit coup de vent du début
  });

  it("le réglage des sons se garde (`tower:sons`), borné, et se relit ; un stockage cassé donne les valeurs par défaut", () => {
    const m = new Map<string, string>();
    const stockage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(lireSons(stockage)).toEqual(SONS_DEFAUT);
    ecrireSons(stockage, { actifs: false, volume: 0.35 });
    expect(lireSons(stockage)).toEqual({ actifs: false, volume: 0.35 });
    m.set("tower:sons", JSON.stringify({ actifs: "oui", volume: 9 }));
    expect(lireSons(stockage)).toEqual({ actifs: true, volume: 1 });
    m.set("tower:sons", "{pas du json");
    expect(lireSons(stockage)).toEqual(SONS_DEFAUT);
    expect(lireSons(null)).toEqual(SONS_DEFAUT);
    expect(() => ecrireSons({ setItem: () => { throw new Error("quota"); } }, SONS_DEFAUT)).not.toThrow();
  });
});
