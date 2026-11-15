import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { DUREE_MAX_TICKS, GAUCHE, LANCEUR, Partie, dailyPinball, enregistrer, jouer, piloter, rejouer, type Evenement } from "../src/index";

// Le déterminisme : la même liste d'événements donne toujours le même résultat — côté jeu (la partie pas à pas, comme `scene.ts`) comme côté serveur (`rejouer`) — quels que soient l'ordre des appels et le nombre de
// parties jouées avant.
const JOUR = daysFromCivil(2026, 11, 9);

function pasAPas(jour: number, evenements: readonly Evenement[]): ReturnType<Partie["resultat"]> {
  const p = new Partie(dailyPinball(jour));
  let k = 0;
  while (!p.finie) {
    while (k < evenements.length && evenements[k]!.tick === p.tick) {
      const e = evenements[k++]!;
      p.regler(e.c, e.enfonce);
    }
    p.avancer();
  }
  return p.resultat();
}

describe("même liste d'événements, même score", () => {
  it("le jeu (pas à pas), le pilote et le serveur (rejouer) donnent le même résultat, sur dix tables", () => {
    for (let i = 0; i < 10; i++) {
      const c = dailyPinball(JOUR + i);
      const { evenements, partie } = piloter(c, DUREE_MAX_TICKS);
      expect(partie.finie || partie.tick === DUREE_MAX_TICKS).toBe(true);
      const serveur = rejouer(c, enregistrer(c, evenements));
      expect(serveur).toEqual(partie.resultat());
      expect(pasAPas(JOUR + i, evenements)).toEqual(serveur);
      expect(jouer(c, evenements)).toEqual(serveur);
    }
  });
  it("répétée cent fois (la même partie de 3 minutes) : toujours la même", () => {
    const c = dailyPinball(JOUR);
    const { evenements } = piloter(c, 108000);
    const ref = JSON.stringify(rejouer(c, enregistrer(c, evenements)));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(rejouer(c, enregistrer(c, evenements)))).toBe(ref);
  });
  it("un événement de moins change la partie : la rediffusion est bien ce qui compte", () => {
    const c = dailyPinball(JOUR);
    const { evenements } = piloter(c, 60000);
    const a = rejouer(c, enregistrer(c, evenements));
    const b = rejouer(c, enregistrer(c, evenements.filter((_, i) => i !== 40 && i !== 41)));
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
  });
  it("une partie sans aucun appui : la bille ne part jamais, la partie dure les quinze minutes, zéro point", () => {
    const c = dailyPinball(JOUR);
    expect(rejouer(c, enregistrer(c, []))).toEqual({ score: 0, ticks: DUREE_MAX_TICKS, billes: 3, multMax: 1 });
  });
  it("deux événements de commandes différentes au même pas sont permis, dans n'importe quel ordre", () => {
    const c = dailyPinball(JOUR);
    const a: Evenement[] = [{ tick: 5, c: GAUCHE, enfonce: true }, { tick: 5, c: LANCEUR, enfonce: true }, { tick: 200, c: LANCEUR, enfonce: false }];
    const b: Evenement[] = [a[1]!, a[0]!, a[2]!];
    expect(rejouer(c, enregistrer(c, a))).toEqual(rejouer(c, enregistrer(c, b)));
  });
});
