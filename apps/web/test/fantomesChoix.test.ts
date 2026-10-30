import { describe, expect, it } from "vitest";
import { GHOST_COLORS } from "../src/salon";
import { CLE_FANTOMES, MAX_FANTOMES, TEINTES_FANTOMES, basculer, ecrireMemoire, lireMemoire, modeSuivant, parDefaut, selectionDe, teinteDe, type Choisi, type LigneClassement, type ModeChoisi } from "../src/fantomesChoix";

// Lot 55 : la logique pure du choix des fantômes — de 1 à 5, gardé pour le jour et oublié le lendemain, le cycle du bouton et ses modes sautés.
const ref = (n: number) => n.toString(16).padStart(12, "0");
const c = (n: number): Choisi => ({ ref: ref(n), name: `P${n}`, rank: n });
const ligne = (rank: number, me = false): LigneClassement => ({ rank, name: `P${rank}`, me, ref: me ? undefined : ref(rank) });
const stockage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), brut: m };
};

describe("la sélection : de 1 à 5 fantômes", () => {
  it("coche, décoche, et refuse une sixième sans rien changer", () => {
    let refs: Choisi[] = [];
    for (let n = 1; n <= MAX_FANTOMES; n++) {
      const r = basculer(refs, c(n));
      expect(r.ok).toBe(true);
      refs = r.refs;
      expect(refs).toHaveLength(n);
    }
    const sixieme = basculer(refs, c(6));
    expect(sixieme.ok).toBe(false);
    expect(sixieme.refs).toEqual(refs);
    const decoche = basculer(refs, c(3));
    expect(decoche.ok).toBe(true);
    expect(decoche.refs.map((x) => x.rank)).toEqual([1, 2, 4, 5]);
    expect(basculer(decoche.refs, c(6)).ok).toBe(true); // une place s'est libérée
  });

  it("la teinte d'une course est son rang dans la sélection (la même case, voiture et pseudo)", () => {
    const refs = [c(7), c(2), c(9)];
    expect(refs.map((x) => teinteDe(refs, x.ref))).toEqual([0, 1, 2]);
    expect(teinteDe(refs, ref(1))).toBe(-1);
  });
});

describe("les teintes", () => {
  it("sont celles du Salon (une copie, pour ne pas importer le Salon dans le choix)", () => {
    expect([...TEINTES_FANTOMES]).toEqual(GHOST_COLORS.slice(0, MAX_FANTOMES));
  });
});

describe("les fantômes proposés tant que rien n'est choisi", () => {
  it("le premier et celui juste devant toi (jamais toi)", () => {
    expect(parDefaut([ligne(1), ligne(2), ligne(3), ligne(4, true), ligne(5)]).map((x) => x.rank)).toEqual([1, 3]);
  });
  it("tu es deuxième : le premier est aussi celui devant toi, une seule fois ; premier : personne", () => {
    expect(parDefaut([ligne(1), ligne(2, true), ligne(3)]).map((x) => x.rank)).toEqual([1]);
    expect(parDefaut([ligne(1, true), ligne(2), ligne(3)])).toEqual([]);
  });
  it("sans ta ligne (pas classé) : le premier ; une ligne sans référence n'a pas de case", () => {
    expect(parDefaut([ligne(1), ligne(2)]).map((x) => x.rank)).toEqual([1]);
    expect(parDefaut([{ rank: 1, name: "Ancien", me: false }])).toEqual([]);
  });
  it("une fois qu'il a choisi, c'est son choix qui compte, même vide", () => {
    const lignes = [ligne(1), ligne(2), ligne(3, true)];
    expect(selectionDe({ mode: null, choisi: false, refs: [] }, lignes).map((x) => x.rank)).toEqual([1, 2]);
    expect(selectionDe({ mode: null, choisi: true, refs: [c(5)] }, lignes).map((x) => x.rank)).toEqual([5]);
    expect(selectionDe({ mode: null, choisi: true, refs: [] }, lignes)).toEqual([]);
  });
});

describe("gardée pour le jour, oubliée au jour suivant", () => {
  it("un aller-retour garde la sélection, le choix fait et le mode", () => {
    const s = stockage();
    ecrireMemoire("2026-10-30", { mode: "selection", choisi: true, refs: [c(1), c(4)] }, s);
    expect(lireMemoire("2026-10-30", s)).toEqual({ mode: "selection", choisi: true, refs: [c(1), c(4)] });
  });
  it("le jour suivant : la sélection est oubliée, le mode reste (il est gardé d'une course à l'autre)", () => {
    const s = stockage();
    ecrireMemoire("2026-10-30", { mode: "first", choisi: true, refs: [c(1)] }, s);
    expect(lireMemoire("2026-10-31", s)).toEqual({ mode: "first", choisi: false, refs: [] });
  });
  it("une mémoire abîmée ou piégée est ignorée : références mal formées, plus de cinq, doublons, mode inconnu", () => {
    const s = stockage();
    s.setItem(CLE_FANTOMES, "pas du json");
    expect(lireMemoire("2026-10-30", s)).toEqual({ mode: null, choisi: false, refs: [] });
    s.setItem(CLE_FANTOMES, JSON.stringify({ jour: "2026-10-30", mode: "ahead", choisi: true, refs: [{ ref: "XYZ", name: "x", rank: 1 }, c(1), c(1), c(2), c(3), c(4), c(5), c(6), { ref: ref(9), name: 3, rank: 1 }] }));
    const m = lireMemoire("2026-10-30", s);
    expect(m.mode).toBeNull();
    expect(m.refs.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5]);
  });
  it("la mémoire ne contient que des références publiques de 12 hexadécimaux et des pseudos", () => {
    const s = stockage();
    ecrireMemoire("2026-10-30", { mode: "selection", choisi: true, refs: [c(1), c(2)] }, s);
    for (const [, v] of s.brut) expect(v).not.toMatch(/[0-9a-f]{32}/);
  });
});

describe("le bouton : Rien → Le mien → Le premier → Ma sélection → Rien", () => {
  const tout = { off: true, mine: true, first: true, selection: true };
  const suite = (depart: ModeChoisi, dispo = tout) => {
    const out: ModeChoisi[] = [];
    let m = depart;
    for (let i = 0; i < 4; i++) {
      m = modeSuivant(m, dispo).mode;
      out.push(m);
    }
    return out;
  };
  it("fait défiler les quatre modes, dans cet ordre", () => {
    expect(suite("off")).toEqual(["mine", "first", "selection", "off"]);
  });
  it("saute un mode vide et le dit", () => {
    expect(modeSuivant("off", { ...tout, mine: false })).toEqual({ mode: "first", sautes: ["mine"] });
    expect(modeSuivant("first", { ...tout, selection: false })).toEqual({ mode: "off", sautes: ["selection"] });
    expect(modeSuivant("off", { off: true, mine: false, first: false, selection: false })).toEqual({ mode: "off", sautes: ["mine", "first", "selection"] });
  });
  it("« Ma sélection » n'apparaît que si une case est cochée", () => {
    expect(suite("off", { ...tout, selection: false })).toEqual(["mine", "first", "off", "mine"]);
  });
  it("l'ancien « joueur devant » (réglage) repart du premier", () => {
    expect(modeSuivant("ahead", tout).mode).toBe("selection");
  });
});
