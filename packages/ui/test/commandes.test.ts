import { describe, expect, it } from "vitest";
import { Commandes, boutonLiaison, cleCommandes, liaisonTenue, nomLiaison, nomTouche, type ActionCommande, type Stockage } from "../src/commandes";
import { axeLiaison, definirLiaison, definirTouche, estDorigine, liaisonPoussee, retablir } from "../src/commandesEdition";

const ACTIONS: readonly ActionCommande[] = [
  { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: "a0-" },
  { id: "sauter", clavier: ["Space", "ArrowUp", "KeyW"], manette: "b0" },
  { id: "pause", clavier: ["KeyP"], manette: null },
];
const memoire = (init: Record<string, string> = {}): Stockage & { m: Map<string, string> } => {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

describe("commandes réglables (lot M2)", () => {
  it("part des touches d'origine, une action garde toutes ses touches d'origine", () => {
    const c = new Commandes("essai", ACTIONS, memoire());
    expect(c.touches("sauter")).toEqual(["Space", "ArrowUp", "KeyW"]);
    expect(c.emplacements("pause")).toBe(2);
    expect(c.emplacementsDe("pause")).toEqual(["KeyP", ""]);
    expect(c.liaison("sauter")).toBe("b0");
    expect(estDorigine(c)).toBe(true);
  });

  it("une touche déjà prise est échangée avec l'action qui l'avait", () => {
    const c = new Commandes("essai", ACTIONS, memoire());
    const r = definirTouche(c, "gauche", 1, "KeyW"); // KeyW était à « sauter » (emplacement 2), « gauche » perdait KeyA
    expect(r).toEqual({ ok: true, echange: { action: "sauter", emplacement: 2 } });
    expect(c.touches("gauche")).toEqual(["ArrowLeft", "KeyW"]);
    expect(c.touches("sauter")).toEqual(["Space", "ArrowUp", "KeyA"]);
    expect(c.actionDeTouche("KeyW")).toBe("gauche");
  });

  it("la même touche sur deux emplacements d'une action : les deux emplacements s'échangent", () => {
    const c = new Commandes("essai", ACTIONS, memoire());
    expect(definirTouche(c, "gauche", 0, "KeyA")).toEqual({ ok: true, echange: null });
    expect(c.touches("gauche")).toEqual(["KeyA", "ArrowLeft"]);
  });

  it("une touche posée sur un emplacement vide : l'autre action perd la sienne, sans rien recevoir", () => {
    const c = new Commandes("essai", ACTIONS, memoire());
    definirTouche(c, "pause", 1, "KeyA");
    expect(c.touches("gauche")).toEqual(["ArrowLeft"]);
    expect(c.touches("pause")).toEqual(["KeyP", "KeyA"]);
  });

  it("Échap et Start sont fixes", () => {
    const c = new Commandes("essai", ACTIONS, memoire());
    expect(definirTouche(c, "sauter", 0, "Escape")).toEqual({ ok: false, raison: "fixe" });
    expect(definirLiaison(c, "sauter", boutonLiaison(9))).toEqual({ ok: false, raison: "fixe" });
    expect(definirTouche(c, "sauter", 0, "n'importe quoi")).toEqual({ ok: false, raison: "invalide" });
    expect(definirTouche(c, "nulle", 0, "KeyZ")).toEqual({ ok: false, raison: "inconnue" });
    expect(c.touches("sauter")[0]).toBe("Space");
    expect(c.liaison("sauter")).toBe("b0");
  });

  it("une liaison de manette prise est échangée (B pour sauter : « gauche » reçoit le bouton A)", () => {
    const c = new Commandes("essai", ACTIONS, memoire());
    definirLiaison(c, "gauche", boutonLiaison(1));
    expect(definirLiaison(c, "sauter", boutonLiaison(1))).toEqual({ ok: true, echange: "gauche" });
    expect(c.liaison("sauter")).toBe("b1");
    expect(c.liaison("gauche")).toBe("b0"); // « gauche » reçoit le bouton que « sauter » quitte
  });

  it("s'enregistre sous cdj:commandes:<jeu> avec une version, et se relit", () => {
    const s = memoire();
    const c = new Commandes("jump", ACTIONS, s);
    definirTouche(c, "sauter", 0, "KeyZ");
    expect(JSON.parse(s.m.get(cleCommandes("jump"))!).v).toBe(1);
    expect(cleCommandes("jump")).toBe("cdj:commandes:jump");
    expect(new Commandes("jump", ACTIONS, s).touches("sauter")[0]).toBe("KeyZ");
    expect(new Commandes("autre", ACTIONS, s).touches("sauter")[0]).toBe("Space"); // une clé par jeu
  });

  it("stockage absent, abîmé, d'un autre format ou qui lève : touches d'origine, sans erreur", () => {
    const origine = ["Space", "ArrowUp", "KeyW"];
    expect(new Commandes("j", ACTIONS, null).touches("sauter")).toEqual(origine);
    for (const brut of ["{pas du json", "[]", "null", '{"v":2,"clavier":{"sauter":["KeyZ"]}}', '{"v":1,"clavier":{"sauter":[42]}}']) {
      expect(new Commandes("j", ACTIONS, memoire({ [cleCommandes("j")]: brut })).touches("sauter")).toEqual(origine);
    }
    const qui_leve: Stockage = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("plein"); } };
    const c = new Commandes("j", ACTIONS, qui_leve);
    expect(c.touches("sauter")).toEqual(origine);
    expect(definirTouche(c, "sauter", 0, "KeyZ").ok).toBe(true); // l'écriture échoue, le choix vit le temps de la page
    expect(c.touches("sauter")[0]).toBe("KeyZ");
  });

  it("un stockage modifié à la main qui lie une touche à deux actions, laisse une action sans touche ou prend Start est refusé en bloc", () => {
    const origine = new Commandes("j", ACTIONS, null);
    for (const o of [
      { v: 1, clavier: { gauche: ["KeyZ", "KeyQ"], sauter: ["KeyZ", ""] }, manette: {} }, // KeyZ sur deux actions
      { v: 1, clavier: { gauche: ["", ""] }, manette: {} }, // une action sans touche
      { v: 1, clavier: {}, manette: { sauter: "b9" } }, // Start
      { v: 1, clavier: {}, manette: { gauche: "b5", sauter: "b5" } }, // un bouton sur deux actions
    ]) {
      const c = new Commandes("j", ACTIONS, memoire({ [cleCommandes("j")]: JSON.stringify(o) }));
      expect(c.touches("sauter")).toEqual(origine.touches("sauter"));
      expect(c.touches("gauche")).toEqual(origine.touches("gauche"));
      expect(c.liaison("sauter")).toBe("b0");
    }
    // un fichier cohérent, lui, est lu
    const bon = new Commandes("j", ACTIONS, memoire({ [cleCommandes("j")]: JSON.stringify({ v: 1, clavier: { sauter: ["KeyZ", ""] }, manette: { sauter: "b2" } }) }));
    expect(bon.touches("sauter")).toEqual(["KeyZ"]);
    expect(bon.liaison("sauter")).toBe("b2");
  });

  it("rétablir ramène l'origine, retire la clé et prévient les abonnés", () => {
    const s = memoire();
    const c = new Commandes("j", ACTIONS, s);
    let n = 0;
    c.surChangement(() => n++);
    definirTouche(c, "sauter", 0, "KeyZ");
    definirLiaison(c, "sauter", "b2");
    retablir(c);
    expect(estDorigine(c)).toBe(true);
    expect(s.m.has(cleCommandes("j"))).toBe(false);
    expect(n).toBe(3);
  });

  it("lit le clavier et la manette par action", () => {
    const c = new Commandes("j", ACTIONS, memoire());
    definirTouche(c, "sauter", 0, "KeyZ");
    expect(c.enfoncee("sauter", new Set(["KeyZ"]))).toBe(true);
    expect(c.enfoncee("sauter", new Set(["Space"]))).toBe(false);
    const pad = { buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 })), axes: [-0.9, 0, 0, 0] };
    expect(c.enfonceeManette("sauter", pad)).toBe(true);
    expect(c.enfonceeManette("gauche", pad)).toBe(true); // axe 0 vers la gauche
    expect(liaisonTenue(axeLiaison(0, 1), pad)).toBe(false);
    expect(liaisonPoussee(pad)).toBe("b0");
    expect(liaisonPoussee({ buttons: [], axes: [0, 0.9] })).toBe("a1+");
  });

  it("le nom d'une touche suit la disposition du clavier (AZERTY : KeyW se lit Z), sinon la table", () => {
    const azerty = new Map([["KeyW", "z"], ["KeyA", "q"], ["KeyD", "d"]]);
    expect(nomTouche("KeyW", "fr", azerty)).toBe("Z");
    expect(nomTouche("KeyA", "fr", azerty)).toBe("Q");
    expect(nomTouche("KeyW", "fr", null)).toBe("W");
    expect(nomTouche("Space", "fr")).toBe("Espace");
    expect(nomTouche("Space", "en")).toBe("Space");
    expect(nomTouche("Enter", "fr")).toBe("Entrée");
    expect(nomTouche("ArrowUp", "en")).toBe("↑");
    expect(nomTouche("Digit4", "fr")).toBe("4");
    expect(nomLiaison("b0", "fr")).toBe("A");
    expect(nomLiaison("b7", "en")).toBe("RT");
    expect(nomLiaison("a0-", "fr")).toBe("Stick gauche ←");
    expect(nomLiaison(null, "fr")).toBe("—");
  });
});
