import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Commandes } from "@cdj/ui/src/commandes";
import { describe, expect, it } from "vitest";
import { creerTenues } from "../src/jeu/tenues";

// Lot K8 — le relâchement d'une action (`PartieDuJeu.actionRelachee`). La logique est pure (`tenues.ts`) ; le câblage de `partie.ts` (clavier, manette, pause, fin) est relu dans le source, comme les autres
// parties DOM du kit (essayées par les specs de « Cibles »).
const jeu = () => {
  const relachees: string[] = [];
  return { relachees, tenues: creerTenues((id) => relachees.push(id)) };
};

describe("les actions tenues", () => {
  it("une action pressée puis levée est relâchée une fois", () => {
    const { relachees, tenues } = jeu();
    tenues.presser("gauche", "clavier:KeyQ");
    expect(tenues.tenues()).toEqual(["gauche"]);
    tenues.relacherSource("clavier:KeyQ");
    expect(relachees).toEqual(["gauche"]);
    expect(tenues.tenues()).toEqual([]);
    tenues.relacherSource("clavier:KeyQ"); // une levée de plus ne relâche rien
    expect(relachees).toEqual(["gauche"]);
  });
  it("lever une touche qui n'a rien pressé ne relâche rien", () => {
    const { relachees, tenues } = jeu();
    tenues.relacherSource("clavier:KeyZ");
    expect(relachees).toEqual([]);
  });
  it("deux sources tiennent la même action : elle n'est relâchée qu'à la dernière levée (deux touches, ou la touche et la manette)", () => {
    const { relachees, tenues } = jeu();
    tenues.presser("droite", "clavier:KeyD");
    tenues.presser("droite", "clavier:ArrowRight");
    tenues.presser("droite", "manette:droite");
    tenues.relacherSource("clavier:KeyD");
    tenues.relacherSource("manette:droite");
    expect(relachees).toEqual([]);
    tenues.relacherSource("clavier:ArrowRight");
    expect(relachees).toEqual(["droite"]);
  });
  it("une même source qui presse deux fois n'est comptée qu'une fois", () => {
    const { relachees, tenues } = jeu();
    tenues.presser("lanceur", "clavier:Space");
    tenues.presser("lanceur", "clavier:Space");
    tenues.relacherSource("clavier:Space");
    expect(relachees).toEqual(["lanceur"]);
  });
  it("deux actions sont indépendantes", () => {
    const { relachees, tenues } = jeu();
    tenues.presser("gauche", "clavier:KeyQ");
    tenues.presser("droite", "clavier:KeyD");
    tenues.relacherSource("clavier:KeyD");
    expect(relachees).toEqual(["droite"]);
    expect(tenues.tenues()).toEqual(["gauche"]);
  });
  it("tout relâcher (pause, fin, fenêtre qui perd le focus) relâche chaque action tenue une fois, dans l'ordre des appuis, quel que soit le nombre de sources", () => {
    const { relachees, tenues } = jeu();
    tenues.presser("gauche", "clavier:KeyQ");
    tenues.presser("droite", "clavier:KeyD");
    tenues.presser("droite", "manette:droite");
    tenues.toutRelacher();
    expect(relachees).toEqual(["gauche", "droite"]);
    expect(tenues.tenues()).toEqual([]);
    tenues.relacherSource("clavier:KeyD"); // la levée qui arrive ensuite (pendant la pause) ne relâche pas une seconde fois
    tenues.toutRelacher();
    expect(relachees).toEqual(["gauche", "droite"]);
  });
  it("vider oublie sans rien relâcher (la partie est détruite)", () => {
    const { relachees, tenues } = jeu();
    tenues.presser("gauche", "clavier:KeyQ");
    tenues.vider();
    tenues.relacherSource("clavier:KeyQ");
    expect(relachees).toEqual([]);
  });
});

describe("avec les touches remappées du joueur", () => {
  const actions = [
    { id: "gauche", clavier: ["KeyQ", "ArrowLeft"], manette: "b4" },
    { id: "droite", clavier: ["KeyD", "ArrowRight"], manette: "b5" },
  ] as const;
  /** Ce que fait `partie.ts` : keydown → l'action de la touche (réglages du moment) → pressée sous la source `clavier:<code>` ; keyup → lève cette source. */
  const clavier = (commandes: Commandes) => {
    const { relachees, tenues } = jeu();
    return {
      relachees,
      tenues,
      bas: (code: string) => {
        const id = commandes.actionDeTouche(code);
        if (id) tenues.presser(id, `clavier:${code}`);
        return id;
      },
      haut: (code: string) => tenues.relacherSource(`clavier:${code}`),
    };
  };
  it("la touche choisie par le joueur presse et relâche l'action ; l'ancienne touche ne fait plus rien", () => {
    const commandes = new Commandes("essai-k8", actions, null);
    commandes.etat.clavier.gauche = ["KeyW", ""];
    const k = clavier(commandes);
    expect(k.bas("KeyQ")).toBeNull();
    k.haut("KeyQ");
    expect(k.relachees).toEqual([]);
    expect(k.bas("KeyW")).toBe("gauche");
    k.haut("KeyW");
    expect(k.relachees).toEqual(["gauche"]);
  });
  it("les réglages changés pendant que la touche est tenue ne coincent pas l'action : la levée relâche ce que CETTE pression a pressé", () => {
    const commandes = new Commandes("essai-k8", actions, null);
    const k = clavier(commandes);
    k.bas("KeyD");
    commandes.etat.clavier.droite = ["KeyL", ""]; // le joueur remappe pendant qu'il tient D
    k.haut("KeyD");
    expect(k.relachees).toEqual(["droite"]);
  });
  it("les deux touches d'une action : relâchée à la levée de la dernière", () => {
    const commandes = new Commandes("essai-k8", actions, null);
    const k = clavier(commandes);
    k.bas("KeyD");
    k.bas("ArrowRight");
    k.haut("KeyD");
    expect(k.relachees).toEqual([]);
    k.haut("ArrowRight");
    expect(k.relachees).toEqual(["droite"]);
  });
});

describe("le câblage de partie.ts", () => {
  const partie = readFileSync(join(__dirname, "../src/jeu/partie.ts"), "utf8");
  const types = readFileSync(join(__dirname, "../src/jeu/types.ts"), "utf8");
  it("`actionRelachee` est facultative dans PartieDuJeu : un jeu qui ne la définit pas ne change pas", () => {
    expect(types).toMatch(/actionRelachee\?\(id: string\): void;/);
    expect(partie).toContain("partie.actionRelachee?.(id)");
  });
  it("l'appui, la levée du clavier et de la manette passent par les mêmes sources ; la pause, la fin et la perte du focus relâchent tout", () => {
    expect(partie).toContain("declencher(id, `clavier:${e.code}`)");
    expect(partie).toContain('addEventListener("keyup", (e: KeyboardEvent) => enfonce.relacherSource(`clavier:${e.code}`))');
    expect(partie).toContain("declencher(id, `manette:${id}`)");
    expect(partie).toContain("enfonce.relacherSource(`manette:${id}`)");
    expect(partie).toContain('addEventListener("blur", () => enfonce.toutRelacher())');
    expect(partie).toMatch(/enfonce\.toutRelacher\(\); \/\/ la simulation s'arrête/);
    expect(partie).toMatch(/function terminer\(\): void \{\n    enfonce\.toutRelacher\(\);/);
    expect(partie).toContain("enfonce.vider();");
  });
  it("le kit ne touche qu'aux actions du jeu : `pause`, `recommencer` et `fantome` ne sont jamais tenues", () => {
    expect(partie).toMatch(/if \(ids\.has\(id\)\) \{\n\s+partie\.action\(id\);\n\s+enfonce\.presser\(id, source\);/);
  });
});
