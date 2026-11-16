import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EV_BANQUE, EV_BUMPER, EV_CIBLE, EV_COULEE, EV_FIN, EV_GEYSER, EV_LANCE, EV_MANEGE, EV_MISSION, EV_MULT, EV_PERDUE, EV_PORTAIL, EV_SAUVEE, EV_SLING, EV_SPINNER, EV_TOURBILLON, EV_TROU, EV_VOIE, THEMES_PINBALL } from "@cdj/pinball-sim";
import { Sons, type ContexteAudio } from "../src/sons";
import { Cliquetis, DELAIS_S, Melange, PAR_SON_MAX, VOIX_ABSOLU, VOIX_MAX, cadenceSpinner, coupureRoulement, hauteurRessort, niveauEffets, niveauRessort, niveauRoulement, niveauTrouNoir, photoVide, recetteDe, sonsDuPas, type Evenement, type NomSon, type Photo } from "../src/sonsLogique";
import { EXEMPLES } from "../src/tune-sons";

// Lot PBS1 — les sons de Pinball : la décision est pure (`sonsLogique.ts`), la lecture est un contexte qu'on peut remplacer ; la règle S2 (le son se mêle à celui du téléphone) tient au code, pas à l'oreille. **L'écoute réelle ne se vérifie pas ici.**
const photo = (p: Partial<Photo> = {}): Photo => ({ ...photoVide(), ...p });
const noms = (l: Evenement[]): string[] => l.map((e) => e.son);

describe("« Pinball » : quel son pour quel événement", () => {
  it("un pas où rien ne se passe ne crée rien (le cas courant : 600 fois par seconde)", () => {
    const a = photo();
    expect(sonsDuPas(0, a, photo(), "foire")).toEqual([]);
    expect(sonsDuPas(0, a, photo(), "foire")).toBe(sonsDuPas(0, a, photo(), "volcan")); // la même liste vide, rien d'alloué
  });

  it("les batteurs : un appui et une relâche, chacun de son côté ; le lanceur : sa détente à la charge d'avant", () => {
    expect(sonsDuPas(0, photo(), photo({ gauche: true }), "foire")).toEqual([{ son: "batteur", cote: "gauche", appui: true }]);
    expect(sonsDuPas(0, photo({ droite: true }), photo(), "foire")).toEqual([{ son: "batteur", cote: "droite", appui: false }]);
    expect(noms(sonsDuPas(0, photo(), photo({ gauche: true, droite: true }), "foire"))).toEqual(["batteur", "batteur"]);
    expect(sonsDuPas(EV_LANCE, photo({ charge: 800, lanceur: true }), photo({ charge: 0 }), "foire")).toEqual([{ son: "lanceur", charge: 800 }]);
    expect(sonsDuPas(EV_SLING, photo(), photo(), "foire")).toEqual([{ son: "sling" }]);
  });

  it("le bumper porte son thème et son rang ; une cible son rang dans la banque ; la banque complète a son arpège", () => {
    for (const t of THEMES_PINBALL) expect(sonsDuPas(EV_BUMPER, photo(), photo({ bumper: 2 }), t)).toEqual([{ son: "bumper", theme: t, rang: 2 }]);
    expect(sonsDuPas(EV_CIBLE, photo(), photo({ cible: 2 }), "ocean")).toEqual([{ son: "cible", rang: 2 }]);
    expect(noms(sonsDuPas(EV_CIBLE | EV_BANQUE, photo(), photo({ cible: 3 }), "ocean"))).toEqual(["cible", "banque"]);
  });

  it("un couloir allumé fait un « ding » de plus en plus haut ; le troisième est l'arpège, et le cran de multiplicateur qu'il donne le suit", () => {
    expect(sonsDuPas(EV_VOIE, photo(), photo({ voies: 1 }), "foire")).toEqual([{ son: "voie", n: 1 }]);
    expect(sonsDuPas(EV_VOIE, photo({ voies: 1 }), photo({ voies: 2 }), "foire")).toEqual([{ son: "voie", n: 2 }]);
    const trois = sonsDuPas(EV_VOIE | EV_MULT, photo({ voies: 2, mult: 1 }), photo({ voies: 3, mult: 2 }), "foire");
    expect(noms(trois)).toEqual(["voies", "mult"]);
    expect((trois[1] as Extract<Evenement, { son: "mult" }>).retard).toBeGreaterThan(0.2);
  });

  it("le spinner, le trou (aspiration, puis relance quand la bille repart), le tourbillon (prise, puis sortie)", () => {
    expect(sonsDuPas(EV_SPINNER, photo(), photo({ spin: 9000 }), "foire")).toEqual([{ son: "spinner", spin: 9000 }]);
    expect(sonsDuPas(EV_TROU, photo(), photo({ captif: 540 }), "foire")).toEqual([{ son: "trou", phase: "aspire" }]);
    expect(sonsDuPas(0, photo({ captif: 1 }), photo({ captif: 0 }), "foire")).toEqual([{ son: "trou", phase: "relance" }]);
    expect(sonsDuPas(EV_TOURBILLON, photo(), photo({ captif: 540, captifTb: 0 }), "ocean")).toEqual([{ son: "tourbillon", phase: "prise" }]);
    expect(sonsDuPas(0, photo({ captif: 1, captifTb: 0 }), photo({ captif: 0 }), "ocean")).toEqual([{ son: "tourbillon", phase: "sortie" }]);
    expect(sonsDuPas(0, photo({ captif: 30 }), photo({ captif: 29 }), "foire")).toEqual([]); // la bille est encore captive : rien à dire
  });

  it("les éléments des thèmes : manège, portail, geyser, coulée", () => {
    expect(noms(sonsDuPas(EV_MANEGE, photo(), photo(), "foire"))).toEqual(["manege"]);
    expect(noms(sonsDuPas(EV_PORTAIL, photo(), photo(), "espace"))).toEqual(["portail"]);
    expect(noms(sonsDuPas(EV_GEYSER, photo(), photo(), "volcan"))).toEqual(["geyser"]);
    expect(noms(sonsDuPas(EV_COULEE, photo(), photo(), "volcan"))).toEqual(["coulee"]);
  });

  it("le multiplicateur qui monte est une fanfare à son cran ; chaque pas de la jauge est un son, et la mission réussie prend la place du cran qu'elle donne", () => {
    expect(sonsDuPas(EV_MULT, photo({ mult: 2 }), photo({ mult: 3 }), "foire")).toEqual([{ son: "mult", mult: 3, retard: 0 }]);
    expect(sonsDuPas(EV_MANEGE, photo({ compteur: 1 }), photo({ compteur: 2 }), "foire")).toEqual([{ son: "manege" }, { son: "missionPas", compteur: 2 }]);
    const fin = sonsDuPas(EV_MANEGE | EV_MISSION | EV_MULT, photo({ compteur: 4, mult: 1 }), photo({ compteur: 5, mult: 2 }), "foire");
    expect(noms(fin)).toEqual(["manege", "mission"]); // ni « pas » ni « multiplicateur » : la fanfare dit tout
  });

  it("bille sauvée, bille perdue, fin de partie — et la dernière bille perdue est la fin, pas une bille perdue de plus", () => {
    expect(noms(sonsDuPas(EV_SAUVEE, photo(), photo(), "foire"))).toEqual(["sauvee"]);
    expect(noms(sonsDuPas(EV_PERDUE, photo(), photo(), "foire"))).toEqual(["perdue"]);
    expect(noms(sonsDuPas(EV_PERDUE | EV_FIN, photo(), photo(), "foire"))).toEqual(["fin"]);
    expect(noms(sonsDuPas(EV_FIN, photo(), photo(), "foire"))).toEqual(["fin"]); // la durée maximale
  });

  it("tout son de la simulation a une recette : chaque événement de `Partie.ev` est entendu", () => {
    const tous = [EV_BUMPER, EV_SLING, EV_CIBLE, EV_BANQUE, EV_SPINNER, EV_VOIE, EV_TROU, EV_LANCE, EV_PERDUE, EV_SAUVEE, EV_FIN, EV_MANEGE, EV_TOURBILLON, EV_PORTAIL, EV_GEYSER, EV_COULEE, EV_MISSION];
    for (const bit of tous) expect(sonsDuPas(bit, photo(), photo(), "foire").length, `bit ${bit}`).toBeGreaterThan(0);
  });
});

describe("les recettes : propres, bornées, sans clic", () => {
  const exemples: [NomSon, Evenement][] = (Object.keys(EXEMPLES) as NomSon[]).flatMap((n) => EXEMPLES[n].map((x): [NomSon, Evenement] => [n, x.e]));

  it("la table des sons (`?debug&sons`) a un bouton par son, et par thème pour les bumpers", () => {
    for (const [nom, liste] of Object.entries(EXEMPLES)) {
      expect(liste.length, nom).toBeGreaterThan(0);
      for (const x of liste) expect(x.e.son, nom).toBe(nom);
    }
    expect(EXEMPLES.bumper.map((x) => (x.e as Extract<Evenement, { son: "bumper" }>).theme).sort()).toEqual([...THEMES_PINBALL].sort());
  });

  it("chaque couche a une durée, un niveau borné à 0,3 et une attaque ; la durée du son est celle de sa couche la plus longue", () => {
    for (const [nom, e] of exemples) {
      for (const variation of [0, 0.5, 0.99]) {
        const r = recetteDe(e, variation);
        expect(r.nom).toBe(nom);
        expect(r.couches.length, nom).toBeGreaterThan(0);
        expect(r.priorite).toBeGreaterThanOrEqual(0);
        expect(r.priorite).toBeLessThanOrEqual(3);
        for (const c of r.couches) {
          expect(c.duree, nom).toBeGreaterThanOrEqual(0.01); // de quoi monter 3 ms et redescendre sans clic
          expect(c.gain, nom).toBeGreaterThan(0);
          expect(c.gain, nom).toBeLessThanOrEqual(0.3);
          expect(c.freq, nom).toBeGreaterThan(0);
          expect(c.retard ?? 0, nom).toBeGreaterThanOrEqual(0);
        }
        expect(r.duree).toBeCloseTo(Math.max(...r.couches.map((c) => (c.retard ?? 0) + c.duree)), 9);
        expect(r.duree, nom).toBeLessThanOrEqual(1.5); // le plus long est la fin de partie
      }
    }
  });

  it("les moments forts sont les plus prioritaires : la mission et la fin à 3, les moments à 2, la table à 1, le cliquetis du spinner à 0", () => {
    const p = (e: Evenement): number => recetteDe(e).priorite;
    expect(p({ son: "mission" })).toBe(3);
    expect(p({ son: "fin" })).toBe(3);
    for (const e of [{ son: "mult", mult: 3, retard: 0 }, { son: "perdue" }, { son: "sauvee" }, { son: "banque" }, { son: "voies" }, { son: "missionPas", compteur: 1 }] as Evenement[]) expect(p(e), e.son).toBe(2);
    for (const e of [{ son: "batteur", cote: "gauche", appui: true }, { son: "sling" }, { son: "bumper", theme: "foire", rang: 0 }, { son: "cible", rang: 1 }] as Evenement[]) expect(p(e), e.son).toBe(1);
    expect(p({ son: "spinner", spin: 5000 })).toBe(0);
  });

  it("le multiplicateur est plus aigu à chaque cran, la mission est le son le plus riche, la bille perdue descend", () => {
    const f = (m: number): number => recetteDe({ son: "mult", mult: m, retard: 0 }).couches[0]!.freq;
    for (let m = 3; m <= 6; m++) expect(f(m)).toBeGreaterThan(f(m - 1));
    expect(recetteDe({ son: "mission" }).couches.length).toBeGreaterThan(recetteDe({ son: "mult", mult: 2, retard: 0 }).couches.length);
    const perdue = recetteDe({ son: "perdue" }).couches[0]!;
    expect(perdue.vers!).toBeLessThan(perdue.freq);
    const pas = (n: number): number => recetteDe({ son: "missionPas", compteur: n }).couches[0]!.freq;
    expect(pas(2)).toBeGreaterThan(pas(1));
  });

  it("chaque thème a son bumper : quatre recettes différentes, dont un crépitement de bruit pour la braise et un « bloop » qui monte pour la bulle", () => {
    const r = (theme: (typeof THEMES_PINBALL)[number]) => recetteDe({ son: "bumper", theme, rang: 1 }, 0.5);
    const empreintes = THEMES_PINBALL.map((t) => JSON.stringify(r(t).couches));
    expect(new Set(empreintes).size).toBe(4);
    expect(r("volcan").couches.filter((c) => c.type === "bruit").length).toBeGreaterThanOrEqual(3);
    const bloop = r("ocean").couches[0]!;
    expect(bloop.vers!).toBeGreaterThan(bloop.freq);
    expect(r("espace").couches.some((c) => c.onde === "sawtooth" && c.filtre === "lowpass")).toBe(true);
  });

  it("les bumpers d'un même thème changent de hauteur avec leur rang, dans une gamme pentatonique (jamais de fausse note)", () => {
    const f = (rang: number): number => recetteDe({ son: "bumper", theme: "foire", rang }, 0.5).couches[0]!.freq;
    const demiTons = [0, 1, 2, 3, 4].map((r) => Math.round(12 * Math.log2(f(r) / f(0))));
    expect(demiTons).toEqual([0, 2, 4, 7, 9]);
    expect(f(5)).toBeCloseTo(f(0), 6); // le rang boucle
  });
});

describe("le mélange : plafond de voix, délai minimal, priorité", () => {
  it("un bumper qui enchaîne : le délai minimal en laisse passer un sur deux ou trois, jamais plus de trois à la fois", () => {
    const m = new Melange();
    let joues = 0;
    for (let i = 0; i < 100; i++) if (m.demander("bumper", 1, 0.13, i * 0.01).jouer) joues++; // une touche tous les 10 ms pendant une seconde
    expect(joues).toBeLessThanOrEqual(1 / DELAIS_S.bumper! + 1);
    expect(joues).toBeGreaterThan(10);
    const n = new Melange();
    expect(n.demander("bumper", 1, 0.5, 0).jouer).toBe(true);
    expect(n.demander("bumper", 1, 0.5, 0.02).jouer).toBe(false); // trop tôt
    expect(n.demander("bumper", 1, 0.5, 0.06).jouer).toBe(true);
    expect(n.demander("bumper", 1, 0.5, 0.12).jouer).toBe(true);
    expect(n.demander("bumper", 1, 0.5, 0.18).jouer).toBe(false); // trois voix du même son : assez
    expect(PAR_SON_MAX).toBe(3);
  });

  it("le plafond de voix : au-delà, un son de même priorité est refusé", () => {
    const m = new Melange();
    const sons: NomSon[] = ["bumper", "sling", "cible", "voie", "trou", "manege", "tourbillon", "portail", "geyser", "coulee"];
    sons.forEach((s, i) => expect(m.demander(s, 1, 5, i * 0.3).jouer, s).toBe(true));
    expect(m.enCours(3)).toBe(VOIX_MAX);
    expect(m.demander("batteur", 1, 1, 3).jouer).toBe(false);
  });

  it("un moment plus fort passe devant : il prend la place du plus discret et du plus ancien, qui est coupé", () => {
    const m = new Melange();
    const a = m.demander("spinner", 0, 5, 0);
    const b = m.demander("manege", 1, 5, 0.3);
    for (const [i, s] of (["bumper", "sling", "cible", "voie", "trou", "tourbillon", "portail", "geyser"] as NomSon[]).entries()) m.demander(s, 1, 5, 0.6 + i * 0.3);
    expect(m.enCours(4)).toBe(VOIX_MAX);
    const d = m.demander("banque", 2, 1, 4);
    expect(d.jouer).toBe(true);
    expect(d.couper).toBe(a.id); // le cliquetis (priorité 0) cède, pas la valse du manège
    expect(b.id).not.toBe(d.couper);
    const e = m.demander("mission", 3, 1, 4.5); // la mission passe toujours : même au plafond de dix, elle joue
    expect(e.jouer).toBe(true);
    expect(m.enCours(4.5)).toBe(VOIX_MAX + 1);
  });

  it("la mission et la fin passent toujours, même quand tout est plein — jusqu'au plafond absolu, où elles volent la place d'un autre moment fort", () => {
    const m = new Melange();
    for (let i = 0; i < VOIX_ABSOLU; i++) m.demander(i % 2 ? "mult" : "perdue", 2, 10, i * 0.2);
    expect(m.demander("mult", 2, 1, 4).jouer).toBe(false);
    const d = m.demander("fin", 3, 1, 4.2);
    expect(d.jouer).toBe(true);
    expect(m.enCours(4.3)).toBeLessThanOrEqual(VOIX_ABSOLU);
  });

  it("une voix qui a fini libère sa place", () => {
    const m = new Melange();
    m.demander("geyser", 1, 0.5, 0);
    expect(m.enCours(0.4)).toBe(1);
    expect(m.enCours(0.6)).toBe(0);
    expect(m.demander("geyser", 1, 0.5, 0.6).jouer).toBe(true);
  });
});

describe("les sons continus", () => {
  it("le roulement suit la vitesse : rien à l'arrêt, plus fort et plus clair quand la bille va vite, toujours très bas", () => {
    expect(niveauRoulement(0)).toBe(0);
    expect(niveauRoulement(30)).toBe(0);
    expect(niveauRoulement(600)).toBeGreaterThan(0);
    expect(niveauRoulement(1500)).toBeGreaterThan(niveauRoulement(600));
    expect(niveauRoulement(9999)).toBeLessThanOrEqual(0.05);
    expect(coupureRoulement(1500)).toBeGreaterThan(coupureRoulement(0));
  });
  it("le ressort monte avec la charge, et se tait sans charge", () => {
    expect(niveauRessort(0)).toBe(0);
    expect(hauteurRessort(1000)).toBeGreaterThan(hauteurRessort(0));
    expect(hauteurRessort(1000) / hauteurRessort(0)).toBeGreaterThan(2);
    expect(niveauRessort(1000)).toBeGreaterThan(niveauRessort(10));
  });
  it("le trou noir gronde de plus en plus près, et rien hors de son rayon", () => {
    expect(niveauTrouNoir(95, 95)).toBe(0);
    expect(niveauTrouNoir(200, 95)).toBe(0);
    expect(niveauTrouNoir(20, 95)).toBeGreaterThan(niveauTrouNoir(60, 95));
    expect(niveauTrouNoir(0, 95)).toBeLessThanOrEqual(0.13);
  });
  it("la cadence du cliquetis suit la rotation du spinner, plafonnée, et s'arrête quand il ne tourne presque plus", () => {
    expect(cadenceSpinner(0)).toBe(0);
    expect(cadenceSpinner(700)).toBe(0);
    expect(cadenceSpinner(5000)).toBeGreaterThan(cadenceSpinner(1000));
    expect(cadenceSpinner(30000)).toBeLessThanOrEqual(22);
    expect(1 / cadenceSpinner(30000)).toBeGreaterThanOrEqual(DELAIS_S.spinner!); // jamais plus vite que le délai du mélange
    const c = new Cliquetis();
    let clics = 0;
    for (let i = 0; i < 60; i++) clics += c.avancer(1 / 60, 10000); // une seconde à 11 clics par seconde
    expect(clics).toBeGreaterThanOrEqual(10);
    expect(clics).toBeLessThanOrEqual(12);
    expect(c.avancer(1 / 60, 0)).toBe(0);
  });
});

describe("le volume des effets", () => {
  it("0 ou illisible ne joue rien, et il ne dépasse jamais 1", () => {
    expect(niveauEffets(0)).toBe(0);
    expect(niveauEffets(Number.NaN)).toBe(0);
    expect(niveauEffets(-1)).toBe(0);
    expect(niveauEffets(0.5)).toBeGreaterThan(0);
    expect(niveauEffets(0.5)).toBeLessThan(0.5); // le bas du curseur est fin
    expect(niveauEffets(3)).toBe(1);
  });
});

// ---- la lecture, sur un faux contexte ----

type Appel = [string, ...number[]];
const param = (valeur = 0) => {
  const appels: Appel[] = [];
  return {
    value: valeur,
    appels,
    setValueAtTime(v: number, t: number) {
      appels.push(["set", v, t]);
    },
    linearRampToValueAtTime(v: number, t: number) {
      appels.push(["lin", v, t]);
    },
    exponentialRampToValueAtTime(v: number, t: number) {
      appels.push(["exp", v, t]);
    },
    setTargetAtTime(v: number, t: number, k: number) {
      appels.push(["cible", v, t, k]);
    },
    cancelScheduledValues(t: number) {
      appels.push(["annule", t]);
    },
  };
};
const noeud = (extra: object = {}) => ({ connect() {}, disconnect() {}, start() {}, stop() {}, ...extra });

function faux(etat: "suspended" | "running" = "running") {
  const suivi = { gains: [] as { gain: ReturnType<typeof param> }[], oscillateurs: [] as { frequency: ReturnType<typeof param>; start: number[]; stop: number[] }[], sources: 0, filtres: 0, reveils: 0, fermes: 0, tampons: 0 };
  const ctx = {
    state: etat as AudioContextState,
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume() {
      suivi.reveils++;
      this.state = "running";
      return Promise.resolve();
    },
    close() {
      suivi.fermes++;
      return Promise.resolve();
    },
    createGain() {
      const g = { ...noeud(), gain: param(1) };
      suivi.gains.push(g);
      return g;
    },
    createOscillator() {
      const o = { frequency: param(), type: "sine", start: [] as number[], stop: [] as number[] };
      const n = noeud({ frequency: o.frequency, type: "sine", start: (t = 0) => o.start.push(t), stop: (t = 0) => o.stop.push(t) });
      suivi.oscillateurs.push(o);
      return n;
    },
    createBufferSource() {
      suivi.sources++;
      return noeud({ buffer: null, loop: false });
    },
    createBiquadFilter() {
      suivi.filtres++;
      return noeud({ frequency: param(), Q: param(), type: "lowpass" });
    },
    createDynamicsCompressor() {
      return noeud({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
    },
    createBuffer(_c: number, n: number) {
      suivi.tampons++;
      return { duration: n / 8000, getChannelData: () => new Float32Array(n) };
    },
  };
  return { ctx: ctx as unknown as ContexteAudio & { currentTime: number }, suivi, brut: ctx };
}

describe("`Sons` : la lecture", () => {
  it("aucun son avant le premier geste : un son demandé avant est perdu, jamais mis en file", () => {
    const { ctx, suivi } = faux();
    let crees = 0;
    const s = new Sons({ niveau: () => 1, creerContexte: () => (crees++, ctx) });
    expect(s.jouer({ son: "sling" })).toBe(false);
    expect(crees).toBe(0);
    expect(suivi.oscillateurs).toHaveLength(0);
    s.deverrouiller();
    expect(crees).toBe(1);
    expect(suivi.oscillateurs).toHaveLength(0); // ce qui a été demandé avant n'est pas rejoué
    expect(s.pret).toBe(true);
  });

  it("le geste réveille un contexte endormi, et ne crée le contexte qu'une fois ; sans Web Audio, jamais d'erreur", () => {
    const { ctx, suivi } = faux("suspended");
    let crees = 0;
    const s = new Sons({ niveau: () => 1, creerContexte: () => (crees++, ctx) });
    s.deverrouiller();
    s.deverrouiller();
    expect(crees).toBe(1);
    expect(suivi.reveils).toBeGreaterThanOrEqual(1);
    const sans = new Sons({ niveau: () => 1, creerContexte: () => null });
    sans.deverrouiller();
    expect(sans.jouer({ son: "sling" })).toBe(false);
    sans.continu(900, 0, null);
    sans.silence();
    sans.dispose();
  });

  it("le volume à 0 : rien ne se joue et aucun nœud audio n'est créé", () => {
    const { ctx, suivi } = faux();
    const s = new Sons({ niveau: () => 0, creerContexte: () => ctx });
    s.deverrouiller();
    const avant = suivi.gains.length;
    expect(s.jouer({ son: "mission" })).toBe(false);
    s.continu(1200, 800, { distance: 10, rayon: 95 });
    expect(suivi.gains.length).toBe(avant); // seulement le niveau général créé au premier geste
    expect(suivi.oscillateurs).toHaveLength(0);
    expect(suivi.sources).toBe(0);
    expect(s.joues).toHaveLength(0);
  });

  it("le volume vient du kit, lu à chaque son : un réglage changé en pause vaut tout de suite", () => {
    const { ctx, suivi } = faux();
    let v = 1;
    const s = new Sons({ niveau: () => v, creerContexte: () => ctx });
    s.deverrouiller();
    const crete = (): number => {
      const g = suivi.gains.at(-1)!.gain.appels;
      return Math.max(...g.filter((a) => a[0] === "lin").map((a) => a[1]!));
    };
    s.jouer({ son: "cible", rang: 1 });
    const fort = Math.max(...suivi.gains.filter((x) => x.gain.appels.length > 0).map((x) => Math.max(...x.gain.appels.filter((a) => a[0] === "lin").map((a) => a[1]!))));
    v = 0.3;
    ctx.currentTime = 1;
    const avant = suivi.gains.length;
    s.jouer({ son: "cible", rang: 1 });
    const doux = Math.max(...suivi.gains.slice(avant).filter((x) => x.gain.appels.length > 0).map((x) => Math.max(...x.gain.appels.filter((a) => a[0] === "lin").map((a) => a[1]!))));
    expect(doux).toBeLessThan(fort);
    expect(crete()).toBeGreaterThan(0);
  });

  it("aucun clic : chaque couche part de presque zéro, monte en au moins 3 ms, redescend à zéro avant l'arrêt de sa source", () => {
    for (const nom of Object.keys(EXEMPLES) as NomSon[]) {
      for (const x of EXEMPLES[nom]) {
        const { ctx, suivi } = faux();
        const s = new Sons({ niveau: () => 1, creerContexte: () => ctx });
        s.deverrouiller();
        const avant = suivi.gains.length; // le niveau général
        expect(s.jouer(x.e), nom).toBe(true);
        const couches = suivi.gains.slice(avant + 1); // le bus de la voix, puis une enveloppe par couche
        expect(couches.length, nom).toBeGreaterThan(0);
        for (const g of couches) {
          const a = g.gain.appels;
          const depart = a[0]!;
          expect(depart[0]).toBe("set");
          expect(depart[1]!, nom).toBeLessThanOrEqual(0.001);
          const montee = a.find((c) => c[0] === "lin")!;
          expect(montee[2]! - depart[2]!, nom).toBeGreaterThanOrEqual(0.003 - 1e-9);
          const dernier = a.at(-1)!;
          expect(dernier[0]).toBe("lin");
          expect(dernier[1], nom).toBe(0); // la fin est à zéro
        }
        // chaque oscillateur s'arrête après la fin de son enveloppe
        for (const o of suivi.oscillateurs) expect(o.stop[0]!).toBeGreaterThan(o.start[0]!);
      }
    }
  });

  it("les voix passent par un bus : celle qui cède la place s'éteint en fondu (jamais d'un coup), et le mélange borne ce qui joue", () => {
    const { ctx, suivi } = faux();
    const s = new Sons({ niveau: () => 1, creerContexte: () => ctx });
    s.deverrouiller();
    // dix sons de la table (priorité 1), presque au même instant : le mélange est plein
    const sons: Evenement[] = [{ son: "bumper", theme: "foire", rang: 0 }, { son: "sling" }, { son: "cible", rang: 1 }, { son: "voie", n: 1 }, { son: "trou", phase: "aspire" }, { son: "manege" }, { son: "tourbillon", phase: "prise" }, { son: "portail" }, { son: "geyser" }, { son: "coulee" }];
    sons.forEach((e, i) => {
      ctx.currentTime = i * 0.001;
      expect(s.jouer(e), e.son).toBe(true);
    });
    ctx.currentTime = 0.02;
    expect(s.jouer({ son: "batteur", cote: "gauche", appui: true })).toBe(false); // plein, même priorité
    expect(s.jouer({ son: "banque" })).toBe(true); // un moment plus fort prend la place du plus ancien
    const fondus = suivi.gains.flatMap((g) => g.gain.appels).filter((a) => a[0] === "cible" && a[1] === 0);
    expect(fondus.length).toBeGreaterThan(0);
    expect(fondus[0]![3]!).toBeGreaterThan(0.005); // une constante de temps : un fondu, pas une coupure
    const refus = s.joues.filter((j) => !j.joue).map((j) => j.son);
    expect(refus).toContain("batteur");
  });

  it("les sons continus ne sont créés que s'ils s'entendent, suivent leur niveau, et s'éteignent seuls sans mise à jour (la pause)", () => {
    const { ctx, suivi } = faux();
    const s = new Sons({ niveau: () => 1, creerContexte: () => ctx });
    s.deverrouiller();
    s.continu(0, 0, null);
    expect(suivi.sources).toBe(0); // une bille immobile : pas de roulement
    expect(suivi.oscillateurs).toHaveLength(0);
    ctx.currentTime = 1;
    s.continu(900, 0, null);
    expect(suivi.sources).toBe(1); // le roulement
    const roulement = suivi.gains.at(-1)!.gain.appels;
    const cibles = roulement.filter((a) => a[0] === "cible");
    expect(cibles[0]![1]!).toBeGreaterThan(0);
    expect(cibles[1]![1]).toBe(0); // l'homme mort
    expect(cibles[1]![2]!).toBeGreaterThan(cibles[0]![2]!);
    ctx.currentTime = 1.01;
    const n = suivi.gains.at(-1)!.gain.appels.length;
    s.continu(900, 0, null); // trop tôt : au plus une mise à jour toutes les 50 ms
    expect(suivi.gains.at(-1)!.gain.appels.length).toBe(n);
    ctx.currentTime = 1.2;
    s.continu(0, 700, { distance: 30, rayon: 95 });
    expect(suivi.oscillateurs).toHaveLength(2); // le ressort et le trou noir
    s.silence();
  });

  it("chaque son passe par le plafond, et son coût sur le fil principal se compte", () => {
    const { ctx } = faux();
    let t = 0;
    const s = new Sons({ niveau: () => 1, creerContexte: () => ctx, horloge: () => (t += 0.25) });
    s.deverrouiller();
    s.jouer({ son: "sling" });
    s.jouer({ son: "sling" }); // trop tôt (même instant) : refusé, mais compté
    expect(s.stats.appels).toBe(2);
    expect(s.stats.refuses).toBe(1);
    expect(s.stats.ms).toBeCloseTo(0.5, 6);
    expect(s.stats.pire).toBeCloseTo(0.25, 6);
  });

  it("dispose ferme le contexte (un navigateur n'en accepte qu'un petit nombre)", () => {
    const { ctx, suivi } = faux();
    const s = new Sons({ niveau: () => 1, creerContexte: () => ctx });
    s.deverrouiller();
    s.dispose();
    expect(suivi.fermes).toBe(1);
    expect(s.pret).toBe(false);
  });
});

describe("règle S2 et simulation intacte", () => {
  const lire = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  /** Le code sans ses commentaires (les consignes écrites en commentaire peuvent nommer ce qui est interdit). */
  const sansCommentaires = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => (l.trim().startsWith("//") ? "" : l.replace(/\s\/\/\s.*$/, ""))).join("\n");
  it("le contexte s'ouvre par `ouvrirContexteAudio` ; ni élément audio, ni Media Session, ni `new AudioContext` direct", () => {
    const s = sansCommentaires(lire("sons.ts"));
    expect(s).toContain("ouvrirContexteAudio");
    expect(s).not.toMatch(/new Audio\(|createMediaElementSource|<audio|<video|mediaSession|new (webkit)?AudioContext|"playback"/);
  });
  it("la décision ne touche pas la simulation : `sonsLogique.ts` ne lit que les constantes, jamais une partie, et n'écrit rien", () => {
    const s = sansCommentaires(lire("sonsLogique.ts"));
    expect(s).not.toMatch(/\bPartie\b|\.avancer\(|\.regler\(|Math\.random|AudioContext/);
    // la scène ne fait que lire la partie : aucune écriture d'un champ de la simulation pour les sons
    const scene = sansCommentaires(lire("scene.ts"));
    expect(scene).not.toMatch(/partie\.(ev|score|mult|billes|compteur|charge|choc|spin|tick) *=[^=]/);
  });
  it("les sons sont à la demande : la définition ne les importe pas (ils vivent avec la scène)", () => {
    expect(lire("definition.ts")).not.toMatch(/from "\.\/(sons|sonsLogique|tune-sons)"/);
    expect(lire("main.ts")).not.toMatch(/sons/i);
  });
});
