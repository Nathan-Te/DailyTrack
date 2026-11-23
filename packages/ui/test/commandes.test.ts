import { describe, expect, it } from "vitest";
import { Commandes, boutonLiaison, cleCommandes, liaisonTenue, nomLiaison, nomTouche, type ActionCommande, type Stockage } from "../src/commandes";
import { axeLiaison, definirLiaison, definirTouche, emplacementsDe, estDorigine, liaisonPoussee, retablir } from "../src/commandesEdition";

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
    expect(emplacementsDe(c, "pause")).toEqual(["KeyP", ""]);
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

// Lot PA1c — un jeu à une commande : plusieurs liaisons de manette pour une action, plusieurs touches, `recommencer` sans touche ; les réglages déjà enregistrés restent valides.
describe("plusieurs liaisons, une action sans touche (lot PA1c)", () => {
  const FACES = ["b0", "b1", "b2", "b3"] as const;
  const UNE_COMMANDE: readonly ActionCommande[] = [
    { id: "jouer", clavier: ["Space", "Enter", "KeyX"], manette: FACES },
    { id: "recommencer", clavier: [], manette: null }, // le jeu redéclare l'action du kit : aucune touche
    { id: "pause", clavier: ["KeyP"], manette: null },
  ];
  const pad = (...appuyes: number[]) => ({ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: appuyes.includes(i) })), axes: [0, 0, 0, 0] });

  it("n'importe quel bouton de face déclenche l'action ; le nom les donne toutes ; le stockage ne garde que la première", () => {
    const c = new Commandes("un", UNE_COMMANDE, memoire());
    expect(c.liaisons("jouer")).toEqual(FACES);
    expect(c.liaison("jouer")).toBe("b0"); // celle que l'écran des commandes montre et remplace
    for (const b of [0, 1, 2, 3]) expect(c.enfonceeManette("jouer", pad(b)), `b${b}`).toBe(true);
    expect(c.enfonceeManette("jouer", pad(4))).toBe(false);
    expect(c.enfonceeManette("jouer", pad())).toBe(false);
    expect(c.nomLiaison("jouer", "fr")).toBe("A / B / X / Y");
    expect(c.parametres("fr")["m_jouer"]).toBe("A / B / X / Y");
    expect(c.nomLiaison("recommencer", "fr")).toBe("—");
    expect(c.etat.manette["jouer"]).toBe("b0");
    expect(estDorigine(c)).toBe(true);
    expect(c.liaisons("pause")).toEqual([]);
  });

  it("remplacer la liaison ne garde que la nouvelle ; une liaison d'une autre action échange sa place, y compris un des boutons de face", () => {
    const c = new Commandes("un", [...UNE_COMMANDE, { id: "special", clavier: ["KeyZ"], manette: "b5" }], memoire());
    expect(definirLiaison(c, "jouer", boutonLiaison(7))).toEqual({ ok: true, echange: null });
    expect(c.liaisons("jouer")).toEqual(["b7"]);
    expect(c.enfonceeManette("jouer", pad(1))).toBe(false);
    expect(estDorigine(c)).toBe(false);
    retablir(c);
    expect(c.liaisons("jouer")).toEqual(FACES);
    // « special » prend B (b1), un des quatre boutons de face de « jouer » : « jouer » ne le garde pas aussi
    expect(definirLiaison(c, "special", boutonLiaison(1))).toEqual({ ok: true, echange: "jouer" });
    expect(c.liaisons("special")).toEqual(["b1"]);
    expect(c.liaison("jouer")).toBe("b5"); // elle reçoit le bouton que « special » quitte
    expect(c.liaisons("jouer")).toEqual(["b5"]);
  });

  it("une action déclarée sans touche peut le rester : `coherent` l'accepte, et le réglage enregistré est relu tel quel au rechargement", () => {
    const stockage = memoire();
    const c = new Commandes("un", UNE_COMMANDE, stockage);
    expect(c.touches("recommencer")).toEqual([]);
    expect(emplacementsDe(c, "recommencer")).toEqual(["", ""]);
    // le joueur règle « jouer » (une touche changée, la liaison remplacée) : l'enregistrement est relu, pas écarté
    definirTouche(c, "jouer", 0, "KeyV");
    definirLiaison(c, "jouer", boutonLiaison(6));
    const relu = new Commandes("un", UNE_COMMANDE, stockage);
    expect(relu.touches("jouer")).toEqual(["KeyV", "Enter", "KeyX"]);
    expect(relu.liaisons("jouer")).toEqual(["b6"]);
    expect(relu.touches("recommencer")).toEqual([]);
    // un réglage d'avant (format inchangé : une liaison, des touches), déjà enregistré, reste valide
    const ancien = memoire({ [cleCommandes("un")]: JSON.stringify({ v: 1, clavier: { jouer: ["KeyV", "Enter", "KeyX"], recommencer: ["", ""], pause: ["KeyP", ""] }, manette: { jouer: "b0", recommencer: null, pause: null } }) });
    const lu = new Commandes("un", UNE_COMMANDE, ancien);
    expect(lu.touches("jouer")).toEqual(["KeyV", "Enter", "KeyX"]);
    expect(lu.liaisons("jouer")).toEqual(FACES); // la première liaison d'origine gardée : toutes celles de l'origine
    // …mais une touche d'une action qui en avait d'origine ne peut pas être retirée, ni une touche partagée acceptée
    for (const o of [{ jouer: ["", "", ""] }, { jouer: ["KeyP", "", ""] }]) {
      const c2 = new Commandes("un", UNE_COMMANDE, memoire({ [cleCommandes("un")]: JSON.stringify({ v: 1, clavier: o, manette: {} }) }));
      expect(c2.touches("jouer")).toEqual(["Space", "Enter", "KeyX"]);
    }
    // une touche posée sur l'action sans touche est gardée (le joueur le veut) et relue
    definirTouche(c, "recommencer", 0, "KeyR");
    expect(new Commandes("un", UNE_COMMANDE, stockage).touches("recommencer")).toEqual(["KeyR"]);
  });

  it("deux actions dont les liaisons se recouvrent (un bouton de face déjà pris) sont refusées en bloc, comme une liaison en double", () => {
    const deux: readonly ActionCommande[] = [{ id: "a", clavier: ["KeyA"], manette: ["b0", "b1"] }, { id: "b", clavier: ["KeyB"], manette: "b3" }];
    const c = new Commandes("d", deux, memoire({ [cleCommandes("d")]: JSON.stringify({ v: 1, clavier: {}, manette: { b: "b1" } }) }));
    expect(c.liaison("b")).toBe("b3"); // b1 est une liaison de « a » : l'enregistrement est écarté
    expect(c.liaisons("a")).toEqual(["b0", "b1"]);
  });
});
