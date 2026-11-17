import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { Partie, dailyGravity, enregistrer, jouer, jouerRobot, rejouer, terrainDuJour } from "../src/index";

// Le déterminisme (lot GR6 : la liste est celle des changements du bouton — appui, relâché, appui…) : la même liste donne toujours le même résultat — côté jeu (la partie pas à pas, comme `scene.ts`) comme côté serveur (`rejouer`) — quels que soient l'ordre des appels, le terrain déjà en
// mémoire ou non, et un autre jour de la même version.
const JOUR = daysFromCivil(2026, 11, 9);
const appuis = Array.from({ length: 80 }, (_, i) => 30 + i * 97 + ((i * 31) % 17));

function pasAPas(a: readonly number[]): ReturnType<Partie["resultat"]> {
  const p = new Partie(terrainDuJour(dailyGravity(JOUR)));
  let k = 0;
  while (!p.finie) {
    if (a[k] === p.tick) {
      if (p.bouton) p.relacher();
      else p.appuyer();
      k++;
    }
    p.avancer();
  }
  return p.resultat();
}

describe("même liste de changements, même score", () => {
  it("le jeu (pas à pas) et le serveur (rejouer) donnent le même résultat", () => {
    const c = dailyGravity(JOUR);
    const jeu = pasAPas(appuis);
    const serveur = rejouer(c, enregistrer(c, appuis));
    expect(serveur).toEqual(jeu);
    expect(jouer(terrainDuJour(c), appuis)).toEqual(jeu);
  });
  it("avec des appuis ET des relâchés à travers les trois modes (la partie du robot) : le jeu pas à pas, le serveur et `jouer` donnent la même chose", () => {
    const c = dailyGravity(JOUR);
    const robot = jouerRobot(terrainDuJour(c), { maxTicks: 22000 });
    const changements = robot.changements;
    expect(robot.partie.modeLoin, "la partie du robot doit avoir traversé au moins un mode").not.toBe(0);
    expect(changements.length).toBeGreaterThan(100);
    const jeu = pasAPas(changements);
    expect(rejouer(c, enregistrer(c, changements))).toEqual(jeu);
    expect(jouer(terrainDuJour(c), changements)).toEqual(jeu);
    expect(jeu.changements).toBe(changements.length);
  }, 60000);
  it("un terrain neuf ou déjà chargé, dans le désordre : rien ne change", () => {
    const c = dailyGravity(JOUR);
    const a = jouer(terrainDuJour(c), appuis);
    terrainDuJour(c).morceau(300); // charge loin devant
    const b = jouer(terrainDuJour(c), appuis);
    const neuf = jouer(terrainDuJour({ ...c, ordre: [...c.ordre] }), appuis);
    expect(b).toEqual(a);
    expect(neuf).toEqual(a);
  });
  it("répétée cent fois : toujours la même partie", () => {
    const c = dailyGravity(JOUR);
    const ref = JSON.stringify(rejouer(c, enregistrer(c, appuis)));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(rejouer(c, enregistrer(c, appuis)))).toBe(ref);
  });
  it("un appui de moins change la partie (la rediffusion est bien ce qui compte)", () => {
    const c = dailyGravity(JOUR);
    const a = rejouer(c, enregistrer(c, appuis));
    const b = rejouer(c, enregistrer(c, appuis.slice(1)));
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
  });
});
