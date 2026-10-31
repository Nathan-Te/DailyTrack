import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOUTON,
  DELAI_PREMIER_MS,
  DELAI_SUITE_MS,
  Repetiteur,
  SuiviBoutons,
  boutonVisiblePourLeJeu,
  directionDe,
  etatDe,
  genreDeManette,
  voisin,
  type EtatPad,
  type Rect,
} from "../src/manetteLogique";

// Lot M1 : la manette dans les menus — la logique pure, essayée sur des manettes et des rectangles fictifs (aucun DOM, aucune horloge réelle).

const pad = (boutons: number[] = [], axes: number[] = [0, 0, 0, 0]): EtatPad => {
  const b = Array.from({ length: 17 }, (_, i) => boutons.includes(i));
  return { boutons: b, axes };
};
const r = (gauche: number, haut: number, droite: number, bas: number): Rect => ({ gauche, haut, droite, bas });

describe("lecture d'une manette", () => {
  it("lit les boutons enfoncés et les axes d'une manette de l'API", () => {
    const e = etatDe({ buttons: [{ pressed: true }, { pressed: false }], axes: [0.2, -0.7] });
    expect(e.boutons).toEqual([true, false]);
    expect(e.axes).toEqual([0.2, -0.7]);
  });

  it("la croix donne la direction, avant le stick", () => {
    expect(directionDe(pad([BOUTON.HAUT]))).toBe("haut");
    expect(directionDe(pad([BOUTON.BAS]))).toBe("bas");
    expect(directionDe(pad([BOUTON.GAUCHE]))).toBe("gauche");
    expect(directionDe(pad([BOUTON.DROITE], [-1, 0]))).toBe("droite");
    expect(directionDe(pad([BOUTON.HAUT, BOUTON.BAS]))).toBeNull(); // deux sens opposés s'annulent
  });

  it("le stick a une zone morte : en dessous de la moitié de sa course, rien", () => {
    expect(directionDe(pad([], [0.49, 0]))).toBeNull();
    expect(directionDe(pad([], [0, -0.3]))).toBeNull();
    expect(directionDe(pad([], [0.5, 0]))).toBe("droite");
    expect(directionDe(pad([], [-0.9, 0.1]))).toBe("gauche");
    expect(directionDe(pad([], [0.1, -0.9]))).toBe("haut");
    expect(directionDe(pad([], [0.2, 0.8]))).toBe("bas");
  });

  it("sur une diagonale, l'axe le plus penché décide", () => {
    expect(directionDe(pad([], [0.9, 0.6]))).toBe("droite");
    expect(directionDe(pad([], [0.6, 0.9]))).toBe("bas");
  });
});

describe("répétition d'une direction tenue", () => {
  it("part tout de suite, repart après 300 ms, puis toutes les 120 ms", () => {
    expect(DELAI_PREMIER_MS).toBe(300);
    expect(DELAI_SUITE_MS).toBe(120);
    const rep = new Repetiteur();
    expect(rep.pas("bas", 1000)).toBe("bas");
    expect(rep.pas("bas", 1100)).toBeNull();
    expect(rep.pas("bas", 1299)).toBeNull();
    expect(rep.pas("bas", 1300)).toBe("bas");
    expect(rep.pas("bas", 1419)).toBeNull();
    expect(rep.pas("bas", 1420)).toBe("bas");
    expect(rep.pas("bas", 1540)).toBe("bas");
  });

  it("relâcher puis rappuyer repart tout de suite ; changer de direction aussi", () => {
    const rep = new Repetiteur();
    expect(rep.pas("bas", 0)).toBe("bas");
    expect(rep.pas(null, 50)).toBeNull();
    expect(rep.pas("bas", 100)).toBe("bas");
    expect(rep.pas("haut", 150)).toBe("haut");
  });

  it("une direction tenue à l'ouverture d'un menu ne compte qu'une fois relâchée", () => {
    const rep = new Repetiteur();
    rep.ignorer("bas");
    expect(rep.pas("bas", 0)).toBeNull();
    expect(rep.pas("bas", 10_000)).toBeNull();
    expect(rep.pas(null, 10_001)).toBeNull();
    expect(rep.pas("bas", 10_002)).toBe("bas");
  });
});

describe("un appui ne sert jamais deux fois", () => {
  const tenus = (...i: number[]) => Array.from({ length: 16 }, (_, k) => i.includes(k));

  it("un bouton ne compte qu'à son front montant", () => {
    const s = new SuiviBoutons();
    expect(s.mettreAJour(tenus(BOUTON.A))).toEqual([BOUTON.A]);
    expect(s.mettreAJour(tenus(BOUTON.A))).toEqual([]);
    expect(s.mettreAJour(tenus())).toEqual([]);
    expect(s.mettreAJour(tenus(BOUTON.A))).toEqual([BOUTON.A]);
  });

  it("le A qui a fermé la pause reste levé pour le jeu jusqu'à son relâchement", () => {
    const s = new SuiviBoutons();
    s.mettreAJour(tenus(BOUTON.A));
    s.consommer(BOUTON.A); // le menu s'en est servi (« Reprendre »)
    // le menu est fermé : le jeu ne doit pas lire A (sinon le personnage saute)
    expect(boutonVisiblePourLeJeu(BOUTON.A, false, s)).toBe(false);
    s.mettreAJour(tenus(BOUTON.A));
    expect(boutonVisiblePourLeJeu(BOUTON.A, false, s)).toBe(false);
    s.mettreAJour(tenus()); // relâché
    expect(boutonVisiblePourLeJeu(BOUTON.A, false, s)).toBe(true);
    // le prochain appui compte
    s.mettreAJour(tenus(BOUTON.A));
    expect(boutonVisiblePourLeJeu(BOUTON.A, false, s)).toBe(true);
  });

  it("menu ouvert, le jeu ne lit rien, sauf Start (la pause)", () => {
    const s = new SuiviBoutons();
    for (const b of [BOUTON.A, BOUTON.B, BOUTON.X, BOUTON.GAUCHE, BOUTON.LB]) expect(boutonVisiblePourLeJeu(b, true, s)).toBe(false);
    expect(boutonVisiblePourLeJeu(BOUTON.START, true, s)).toBe(true);
  });

  it("Start n'est jamais caché au jeu, même consommé", () => {
    const s = new SuiviBoutons();
    s.mettreAJour(tenus(BOUTON.START));
    s.consommer(BOUTON.START);
    expect(boutonVisiblePourLeJeu(BOUTON.START, false, s)).toBe(true);
  });

  it("consommer un bouton qui n'est pas tenu ne retient pas le prochain appui", () => {
    const s = new SuiviBoutons();
    s.consommer(BOUTON.A);
    s.mettreAJour(tenus(BOUTON.A));
    expect(boutonVisiblePourLeJeu(BOUTON.A, false, s)).toBe(true);
  });
});

describe("navigation spatiale", () => {
  // Une grille : deux colonnes, trois rangées ; une barre en haut.
  //   [barre                    ]
  //   [a1]   [b1]
  //   [a2]   [b2]
  //   [a3]
  const barre = r(0, 0, 210, 40);
  const a1 = r(0, 60, 100, 100);
  const b1 = r(110, 60, 210, 100);
  const a2 = r(0, 110, 100, 150);
  const b2 = r(110, 110, 210, 150);
  const a3 = r(0, 160, 100, 200);
  const tous = [barre, a1, b1, a2, b2, a3];

  it("va à l'élément droit devant", () => {
    expect(voisin(a1, tous, "bas")).toBe(3); // a2, pas b2
    expect(voisin(a1, tous, "droite")).toBe(2); // b1
    expect(voisin(b2, tous, "haut")).toBe(2); // b1
    expect(voisin(b2, tous, "gauche")).toBe(3); // a2
    expect(voisin(a2, tous, "haut")).toBe(1); // a1
  });

  it("ne sort pas de la grille : rien au-delà du bord", () => {
    expect(voisin(a3, tous, "bas")).toBe(-1);
    expect(voisin(a1, tous, "gauche")).toBe(-1);
    expect(voisin(barre, tous, "haut")).toBe(-1);
  });

  it("une rangée plus courte : le bas de b2 va à l'élément le plus proche (a3, en diagonale)", () => {
    expect(voisin(b2, tous, "bas")).toBe(5);
  });

  it("depuis la barre, le bas va au plus proche des deux colonnes (à égalité, le premier)", () => {
    expect(voisin(barre, tous, "bas")).toBe(1);
  });

  it("deux éléments côte à côte ne sont pas « au-dessus » l'un de l'autre", () => {
    expect(voisin(a1, [b1], "bas")).toBe(-1);
    expect(voisin(a1, [b1], "haut")).toBe(-1);
  });

  it("préfère l'élément en face à un voisin diagonal un peu plus près", () => {
    const depuis = r(100, 0, 200, 40);
    const enFace = r(100, 60, 200, 100);
    const diagonale = r(205, 45, 305, 85);
    expect(voisin(depuis, [diagonale, enFace], "bas")).toBe(1);
  });

  it("une liste verticale : monte et descend d'un cran", () => {
    const liste = [r(0, 0, 200, 44), r(0, 50, 200, 94), r(0, 100, 200, 144)];
    expect(voisin(liste[0]!, liste, "bas")).toBe(1);
    expect(voisin(liste[1]!, liste, "bas")).toBe(2);
    expect(voisin(liste[2]!, liste, "haut")).toBe(1);
  });

  it("un élément posé dans un autre (recouvrement) se rejoint dans le sens du mouvement", () => {
    const grand = r(0, 0, 200, 200);
    const dedans = r(50, 120, 150, 180);
    expect(voisin(grand, [dedans], "bas")).toBe(0);
  });
});

describe("lettres des boutons", () => {
  it("type Xbox par défaut", () => {
    expect(genreDeManette("Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)")).toBe("xbox");
    expect(genreDeManette("")).toBe("xbox");
    expect(genreDeManette("Logitech Gamepad F310")).toBe("xbox");
  });

  it("croix et rond dessinés pour une PlayStation", () => {
    expect(genreDeManette("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)")).toBe("playstation");
    expect(genreDeManette("054c-0ce6-DualSense Wireless Controller")).toBe("playstation");
    expect(genreDeManette("PS4 Controller")).toBe("playstation");
    expect(genreDeManette("Sony PLAYSTATION(R)3 Controller")).toBe("playstation");
  });
});

describe("aucune lecture sans manette", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sans manette, la page ne charge rien et ne lit rien ; le jeu garde sa manette telle quelle", async () => {
    const lecture = vi.fn(() => []);
    const ecouteurs = new Map<string, () => void>();
    vi.stubGlobal("navigator", { getGamepads: lecture });
    vi.stubGlobal("addEventListener", (type: string, f: () => void) => ecouteurs.set(type, f));
    const { activerManette, padPourLeJeu } = await import("../src/manetteLien");
    activerManette(async () => ({ demarrerManette: () => undefined, OPTIONS_MANETTE: { page: true } }));
    // Seul `gamepadconnected` est écouté : ni boucle d'animation, ni lecture, ni module chargé tant qu'aucune manette n'est branchée.
    expect([...ecouteurs.keys()]).toEqual(["gamepadconnected"]);
    expect(lecture).not.toHaveBeenCalled();
    const fausse = { buttons: [], axes: [0] } as unknown as Gamepad;
    expect(padPourLeJeu(fausse)).toBe(fausse);
    expect(padPourLeJeu(undefined)).toBeUndefined();
    expect(lecture).not.toHaveBeenCalled();
  });
});
