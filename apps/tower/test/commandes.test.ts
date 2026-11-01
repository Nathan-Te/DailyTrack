import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUTON_FIXE, Commandes, TOUCHE_FIXE, cleCommandes } from "@cdj/ui/src/commandes";
import { definirLiaison, definirTouche, retablir } from "@cdj/ui/src/commandesEdition";
import { ACTIONS_TOWER, cleAction } from "../src/commandes";
import { CATALOGUE_TOWER } from "../src/catalogue";

// Lot T7 (règle M2) : les actions de Tower, leurs touches d'origine (flèches, ZQSD en AZERTY, WASD en QWERTY), le stockage des choix (absent, abîmé…) et « jamais une touche en dur ».
const fraiche = (stockage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null = null): Commandes => new Commandes("tower", ACTIONS_TOWER, stockage);
const memoire = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const CLE = cleCommandes("tower");

describe("les actions de Tower et leurs touches d'origine", () => {
  const c = fraiche();

  it("le tableau du lot : flèches et lettres, manette", () => {
    expect(ACTIONS_TOWER.map((a) => [a.id, a.clavier, a.manette])).toEqual([
      ["gauche", ["ArrowLeft", "KeyA"], null],
      ["droite", ["ArrowRight", "KeyD"], null],
      ["tourner", ["ArrowUp", "KeyW", "KeyX"], "b0"],
      ["descendre", ["ArrowDown", "KeyS", "Space"], "b7"],
      ["recommencer", ["Enter"], "b2"],
      ["pause", ["KeyP"], null],
      ["fantome", ["KeyG"], "b3"],
    ]);
  });

  it("chaque touche d'origine est son action ; Échap n'est à aucune (fixe)", () => {
    for (const a of ACTIONS_TOWER) for (const code of a.clavier) expect(c.actionDeTouche(code), code).toBe(a.id);
    expect(c.actionDeTouche(TOUCHE_FIXE)).toBeNull();
  });

  it("ZQSD sur un AZERTY et WASD sur un QWERTY sont les mêmes touches physiques (KeyW, KeyA, KeyS, KeyD)", () => {
    const azerty = new Map([["KeyW", "z"], ["KeyA", "q"], ["KeyS", "s"], ["KeyD", "d"], ["ArrowUp", "ArrowUp"]]);
    const qwerty = new Map([["KeyW", "w"], ["KeyA", "a"], ["KeyS", "s"], ["KeyD", "d"]]);
    const a = fraiche();
    a.disposition = azerty;
    expect(a.nomsTouches("gauche", "fr")).toEqual(["←", "Q"]);
    expect(a.nomsTouches("droite", "fr")).toEqual(["→", "D"]);
    expect(a.nomsTouches("tourner", "fr")).toEqual(["↑", "Z", "X"]);
    expect(a.nomsTouches("descendre", "fr")).toEqual(["↓", "S", "Espace"]);
    const q = fraiche();
    q.disposition = qwerty;
    expect(q.nomsTouches("tourner", "en")).toEqual(["↑", "W", "X"]);
    expect(q.nomsTouches("descendre", "en")).toEqual(["↓", "S", "Space"]);
    // La même touche physique agit des deux côtés : seul son nom change.
    for (const code of ["KeyA", "KeyD", "KeyW", "KeyS"]) expect(a.actionDeTouche(code)).toBe(q.actionDeTouche(code));
  });

  it("les aides reçoivent les touches choisies en paramètres ({tourner}, {m_tourner}…)", () => {
    const p = c.parametres("fr");
    expect(p.tourner).toBe("↑, W ou X");
    expect(p.m_tourner).toBe("A");
    expect(p.m_descendre).toBe("RT");
    expect(p.pause).toBe("P");
  });

  it("chaque action a son nom dans les deux catalogues (Réglages › Commandes)", () => {
    for (const a of ACTIONS_TOWER) for (const langue of ["fr", "en"] as const) expect(CATALOGUE_TOWER[langue][cleAction(a.id)], `${langue} ${a.id}`).toBeTruthy();
  });
});

describe("changer une touche : échange, touches fixes, rétablir", () => {
  it("une touche déjà prise est échangée ; Échap et Start sont refusés", () => {
    const c = fraiche();
    expect(definirTouche(c, "tourner", 0, "KeyZ")).toEqual({ ok: true, echange: null });
    expect(c.touches("tourner")).toEqual(["KeyZ", "KeyW", "KeyX"]);
    expect(c.actionDeTouche("ArrowUp")).toBeNull();
    const r = definirTouche(c, "descendre", 1, "KeyZ");
    expect(r).toEqual({ ok: true, echange: { action: "tourner", emplacement: 0 } });
    expect(definirTouche(c, "gauche", 0, TOUCHE_FIXE)).toMatchObject({ ok: false, raison: "fixe" });
    expect(definirLiaison(c, "tourner", `b${BOUTON_FIXE}`)).toMatchObject({ ok: false, raison: "fixe" });
    expect(definirLiaison(c, "tourner", "b5")).toEqual({ ok: true, echange: null });
    retablir(c);
    expect(c.estDorigine()).toBe(true);
  });
});

describe("le stockage des commandes (`cdj:commandes:tower`)", () => {
  const D = fraiche();
  const origine = JSON.stringify(D.etat);

  it("absent : les touches d'origine", () => {
    expect(JSON.stringify(fraiche(memoire()).etat)).toBe(origine);
    expect(JSON.stringify(fraiche(null).etat)).toBe(origine);
  });

  it("abîmé, d'un autre format ou incohérent : les touches d'origine, sans erreur", () => {
    for (const brut of ["pas du json", "null", "[]", '{"v":9,"clavier":{}}', '{"v":1,"clavier":{"gauche":["KeyQ"],"droite":["KeyQ"]}}', '{"v":1,"clavier":{"gauche":[]}}', '{"v":1,"manette":{"tourner":"b9"}}']) {
      expect(JSON.stringify(fraiche(memoire({ [CLE]: brut })).etat), brut).toBe(origine);
    }
    const qui_leve = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } };
    expect(JSON.stringify(fraiche(qui_leve).etat)).toBe(origine);
    expect(() => definirTouche(fraiche(qui_leve), "tourner", 0, "KeyZ")).not.toThrow(); // l'écriture refusée n'est pas une erreur : le choix vaut pour la page
  });

  it("un choix valide est gardé et relu", () => {
    const s = memoire();
    const c = fraiche(s);
    definirTouche(c, "tourner", 0, "KeyZ");
    expect(JSON.parse(s.m.get(CLE)!).clavier.tourner[0]).toBe("KeyZ");
    expect(fraiche(s).touches("tourner")[0]).toBe("KeyZ");
  });
});

describe("jamais une touche en dur (règle M2)", () => {
  it("aucun fichier de src/ n'écrit une touche de jeu (flèches, lettres, Espace, Entrée), hors `commandes.ts` (les touches d'origine) : Échap, fixe, s'écrit par `TOUCHE_FIXE` ou ferme un dialogue", () => {
    const dossier = join(__dirname, "../src");
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".ts") && !/^catalogue/.test(f) && f !== "commandes.ts");
    for (const f of fichiers) {
      const code = readFileSync(join(dossier, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code.match(/["'`](Arrow(?:Up|Down|Left|Right)|Key[A-Z]|Space|Enter)["'`]/g) ?? [], f).toEqual([]);
    }
  });
});
