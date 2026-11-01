import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, Partie, REGLAGES_DEFAUT, SCENARIO_ESSAI, TICKS_PAR_SECONDE, encoderRediffusion, enregistrer, type Rapier } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { Commandes } from "@cdj/ui/src/commandes";
import { definirLiaison, definirTouche } from "@cdj/ui/src/commandesEdition";
import { activerManette, padPourLeJeu } from "@cdj/ui/src/manetteLien";
import { vi } from "vitest";
import { ACTIONS_TOWER } from "../src/commandes";
import { ENTREES_DEFAUT, Entrees, basDuPad, directionDuPad, padActif, type PadLu, type Touche } from "../src/entrees";

// Lot T7 : les entrées de Tower passent par `commandes` (clavier), la manette et les boutons de l'écran, et donnent **toujours le même masque de bits par tick** : une partie jouée avec d'autres touches
// est la même partie, la même rediffusion (règle M2). La manette est lue comme celle de Track et de Jump (`padPourLeJeu` : un menu ouvert la lève, sauf Start).
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const fraiche = (): Commandes => new Commandes("tower", ACTIONS_TOWER, null);

/** Une cible d'événements qui tient lieu de fenêtre : `touche("KeyZ", true)` appuie, `false` relâche. */
function clavier(c: Commandes, e = new Entrees(), actif = () => true) {
  const cible = new EventTarget();
  e.brancherClavier(cible as unknown as Window, actif, c);
  const touche = (code: string, bas: boolean, repeat = false): Event => {
    const ev = Object.assign(new Event(bas ? "keydown" : "keyup", { cancelable: true }), { code, repeat, ctrlKey: false, metaKey: false, altKey: false });
    cible.dispatchEvent(ev);
    return ev;
  };
  return { e, touche };
}

// Le scénario du joueur, en INTENTIONS : tenir « gauche » entre les ticks 0 et 25, tourner aux ticks 5 et 40, descendre de 60 à 400, tenir « droite » de 120 à 140.
type Evt = { tick: number; action: Touche; bas: boolean };
const SCENARIO: Evt[] = [
  { tick: 0, action: "gauche", bas: true },
  { tick: 5, action: "tourner", bas: true },
  { tick: 6, action: "tourner", bas: false },
  { tick: 25, action: "gauche", bas: false },
  { tick: 40, action: "tourner", bas: true },
  { tick: 41, action: "tourner", bas: false },
  { tick: 60, action: "descendre", bas: true },
  { tick: 120, action: "droite", bas: true },
  { tick: 140, action: "droite", bas: false },
  { tick: 400, action: "descendre", bas: false },
];
const TICKS = 700;

/** Joue le scénario avec les touches ACTUELLES de chaque action (la première) et rend les masques par tick. */
function masquesJoues(c: Commandes): number[] {
  const { e, touche } = clavier(c);
  const masques: number[] = [];
  for (let tick = 0; tick < TICKS; tick++) {
    for (const ev of SCENARIO.filter((x) => x.tick === tick)) touche(c.touches(ev.action)[0]!, ev.bas);
    masques.push(e.lire());
  }
  return masques;
}

function rediffusionDe(masques: readonly number[]): { texte: string; hauteurMm: number; ticks: number } {
  const p = new Partie(R, SCENARIO_ESSAI, { ...REGLAGES_DEFAUT });
  for (const m of masques) {
    if (p.etape !== "jeu") break;
    p.avancer(m);
  }
  const r = enregistrer(p);
  return { texte: encoderRediffusion(r), hauteurMm: p.vue().hauteurMm, ticks: p.commandesJouees().length };
}

describe("règle M2 : d'autres touches, la même partie", () => {
  it("les touches d'origine donnent les bits attendus", () => {
    const m = masquesJoues(fraiche());
    expect(m[0]! & COMMANDE.GAUCHE).toBeTruthy();
    expect(m[6]! & COMMANDE.TOURNER).toBeFalsy(); // un ordre par appui
    expect(m.slice(5, 7).some((x) => x & COMMANDE.TOURNER)).toBe(true);
    expect(m[100]! & COMMANDE.DESCENDRE).toBeTruthy();
    expect(m[500]! & COMMANDE.DESCENDRE).toBeFalsy();
    expect(m.slice(120, 141).some((x) => x & COMMANDE.DROITE)).toBe(true);
  });

  it("avec d'autres touches (Z pour tourner, J et K pour aller de côté, N pour descendre) : mêmes bits, même rediffusion, même résultat", () => {
    const origine = masquesJoues(fraiche());
    const autres = fraiche();
    definirTouche(autres, "tourner", 0, "KeyZ");
    definirTouche(autres, "gauche", 0, "KeyJ");
    definirTouche(autres, "droite", 0, "KeyK");
    definirTouche(autres, "descendre", 0, "KeyN");
    expect(autres.touches("tourner")[0]).toBe("KeyZ");
    const change = masquesJoues(autres);
    expect(change).toEqual(origine);
    const a = rediffusionDe(origine);
    const b = rediffusionDe(change);
    expect(b.texte).toBe(a.texte);
    expect(b.hauteurMm).toBe(a.hauteurMm);
    expect(a.ticks).toBeGreaterThan(200);
  });

  it("une touche retirée d'une action n'agit plus (↑ après avoir mis Z), et n'agit pas sur une action voisine", () => {
    const c = fraiche();
    definirTouche(c, "tourner", 0, "KeyZ");
    const { e, touche } = clavier(c);
    touche("ArrowUp", true);
    expect(e.lire()).toBe(0);
    touche("KeyZ", true);
    expect(e.lire() & COMMANDE.TOURNER).toBeTruthy();
  });

  it("un écran ouvert prend le clavier ; Ctrl, Cmd, Alt le laissent au navigateur ; une touche maintenue ne rend pas deux ordres", () => {
    let actif = false;
    const c = fraiche();
    const { e, touche } = clavier(c, new Entrees(), () => actif);
    const ev = touche("ArrowLeft", true);
    expect(ev.defaultPrevented).toBe(false); // l'écran (pause, fin) garde Espace et les flèches
    expect(e.lire()).toBe(0);
    actif = true;
    touche("ArrowLeft", true);
    expect(e.lire() & COMMANDE.GAUCHE).toBeTruthy();
    expect(e.lire() & COMMANDE.GAUCHE).toBeFalsy(); // le délai de répétition n'est pas écoulé
    touche("ArrowLeft", true, true); // auto-répétition du système : ignorée (la cadence est celle du jeu)
    expect(e.lire() & COMMANDE.GAUCHE).toBeFalsy();
  });
});

describe("la manette", () => {
  const pad = (boutons: number[] = [], axes: number[] = [0, 0, 0, 0]): PadLu => ({ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: boutons.includes(i) })), axes });

  it("la croix et le stick déplacent (fixes) ; le bas de la croix et du stick descend ; A tourne, RT descend (réglables)", () => {
    expect(directionDuPad(pad([14]))).toBe(-1);
    expect(directionDuPad(pad([15]))).toBe(1);
    expect(directionDuPad(pad([], [-0.9, 0, 0, 0]))).toBe(-1);
    expect(directionDuPad(pad([], [0.3, 0, 0, 0]))).toBe(0); // zone morte
    expect(basDuPad(pad([13]))).toBe(true);
    expect(basDuPad(pad([], [0, 0.9, 0, 0]))).toBe(true);
    const c = fraiche();
    const e = new Entrees();
    e.lirePad(pad([0]), c);
    expect(e.lire() & COMMANDE.TOURNER).toBeTruthy();
    e.lirePad(pad([7]), c);
    expect(e.lire() & COMMANDE.DESCENDRE).toBeTruthy();
    e.lirePad(pad([], [0, 0.9, 0, 0]), c);
    expect(e.lire() & COMMANDE.DESCENDRE).toBeTruthy();
    e.lirePad(pad(), c);
    expect(e.lire() & COMMANDE.DESCENDRE).toBeFalsy();
  });

  it("les boutons se changent dans Réglages › Commandes : « tourner » sur B", () => {
    const c = fraiche();
    definirLiaison(c, "tourner", "b1");
    const e = new Entrees();
    e.lirePad(pad([0]), c);
    expect(e.lire() & COMMANDE.TOURNER).toBeFalsy();
    e.lirePad(pad([1]), c);
    expect(e.lire() & COMMANDE.TOURNER).toBeTruthy();
  });

  it("gauche et droite se répètent comme au clavier (même délai, même cadence)", () => {
    const c = fraiche();
    const clav = clavier(c);
    const manette = new Entrees();
    clav.touche("ArrowLeft", true);
    const bitsClavier: number[] = [];
    const bitsManette: number[] = [];
    for (let t = 0; t < 120; t++) {
      manette.lirePad(pad([14]), c);
      bitsClavier.push(clav.e.lire() & COMMANDE.GAUCHE);
      bitsManette.push(manette.lire() & COMMANDE.GAUCHE);
    }
    expect(bitsManette).toEqual(bitsClavier);
    expect(bitsManette.filter(Boolean).length).toBeGreaterThan(10);
    expect(bitsManette.slice(1, ENTREES_DEFAUT.delaiTicks).every((b) => b === 0)).toBe(true);
  });

  it("une manette absente ou levée relâche tout (un menu ouvert la cache : un appui ne sert jamais deux fois)", () => {
    const c = fraiche();
    const e = new Entrees();
    e.lirePad(pad([14, 0, 7]), c);
    expect(e.lire()).not.toBe(0);
    e.lirePad(undefined, c);
    e.lire();
    expect(e.lire()).toBe(0);
  });

  it("le filtre de la plateforme (padPourLeJeu) lève la manette sous un menu : la partie ne reçoit plus rien", async () => {
    const ecouteurs: (() => void)[] = [];
    vi.stubGlobal("addEventListener", (_: string, f: () => void) => ecouteurs.push(f));
    let menuOuvert = true;
    const levee = (p: Gamepad): Gamepad => ({ ...p, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 9 && !!p.buttons[9]?.pressed, touched: false, value: 0 })), axes: [0, 0, 0, 0] }) as unknown as Gamepad;
    activerManette(async () => ({ OPTIONS_MANETTE: {}, demarrerManette: (_o, brancher) => brancher((p) => (menuOuvert ? levee(p) : p)) }));
    ecouteurs[0]!();
    await new Promise((r) => setTimeout(r, 0));
    const brute = pad([0, 9, 14]) as unknown as Gamepad;
    const c = fraiche();
    const e = new Entrees();
    e.lirePad(padPourLeJeu(brute), c);
    expect(e.lire()).toBe(0); // menu ouvert : ni A, ni la croix
    expect(padPourLeJeu(brute)!.buttons[9]!.pressed).toBe(true); // Start reste au jeu (la pause)
    menuOuvert = false;
    e.lirePad(padPourLeJeu(brute), c);
    expect(e.lire() & (COMMANDE.TOURNER | COMMANDE.GAUCHE)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("padActif : la dernière entrée vient d'une manette dès qu'un bouton est enfoncé ou un stick penché", () => {
    expect(padActif(pad())).toBe(false);
    expect(padActif(pad([3]))).toBe(true);
    expect(padActif(pad([], [0.1, -0.9, 0, 0]))).toBe(true);
  });
});

describe("plusieurs sources tiennent la même touche", () => {
  it("clavier et manette sur « gauche » : un seul ordre, et la touche reste tenue tant qu'une source la tient", () => {
    const c = fraiche();
    const e = new Entrees();
    e.appuyer("gauche", "clavier");
    e.appuyer("gauche", "manette");
    expect(e.lire() & COMMANDE.GAUCHE).toBeTruthy();
    expect(e.lire() & COMMANDE.GAUCHE).toBeFalsy(); // pas deux ordres pour un même appui
    e.relacher("gauche", "clavier");
    expect(e.enfoncee("gauche")).toBe(true);
    e.relacher("gauche", "manette");
    expect(e.enfoncee("gauche")).toBe(false);
    expect(TICKS_PAR_SECONDE).toBe(60);
    void c;
  });
});
