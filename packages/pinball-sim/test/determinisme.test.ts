import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { DUREE_MAX_TICKS, GAUCHE, LANCEUR, Partie, dailyPinball, enregistrer, jouer, jouerRobot, rejouer, type Contenu, type Evenement } from "../src/index";

// Le déterminisme : la même liste d'événements donne toujours le même résultat — côté jeu (la partie pas à pas, comme `scene.ts`) comme côté serveur (`rejouer`) — quels que soient l'ordre des appels et le nombre de
// parties jouées avant.
const JOUR = daysFromCivil(2026, 11, 9);

function pasAPas(c: Contenu, evenements: readonly Evenement[], maxTicks: number): ReturnType<Partie["resultat"]> {
  const p = new Partie(c);
  let k = 0;
  while (!p.finie && p.tick < maxTicks) {
    while (k < evenements.length && evenements[k]!.tick === p.tick) {
      const e = evenements[k++]!;
      p.regler(e.c, e.enfonce);
    }
    p.avancer();
  }
  return p.resultat();
}

// **Lot PB3 : le test durait 24 s et a dépassé son délai en CI (30 s sous charge).** Il est découpé : une table par test (chacune son propre délai), deux par thème, avec des parties plus courtes (au plus 2 minutes de jeu,
// 72 000 pas, celles du robot) ; la campagne de 40 tables jouées jusqu'à la fin (15 minutes au plus) est celle de `npm run mesures:pinball -w @cdj/pinball-sim` (« déterminisme : client = serveur »), qui n'a pas de délai. Ce qui reste couvert
// ici : le même résultat par le jeu (pas à pas), le robot, le serveur (`rejouer`) et `jouer`, sur les quatre thèmes ; une partie sans appui qui dure les 15 minutes entières ; les parties du golden (`golden.test.ts`).
const COURT = 72000;
const THEMES = ["foire", "ocean", "espace", "volcan"] as const;

describe("même liste d'événements, même score", () => {
  for (const theme of THEMES) {
    for (const i of [0, 1]) {
      it(`${theme}, table ${i + 1} : le jeu (pas à pas), le robot et le serveur (rejouer) donnent le même résultat`, () => {
        const c = dailyPinball(JOUR + 9 * i + THEMES.indexOf(theme), undefined, theme);
        const { evenements, partie } = jouerRobot(c, 1, { maxTicks: COURT });
        // le jeu (la partie pas à pas, comme `scene.ts`) retrouve ce que le robot a joué, au même pas
        expect(pasAPas(c, evenements, COURT)).toEqual(partie.resultat());
        // le serveur rejoue la rediffusion décodée jusqu'à la fin de la partie, comme `jouer` et le jeu poussé jusqu'au bout
        const fin = pasAPas(c, evenements, DUREE_MAX_TICKS);
        expect(rejouer(c, enregistrer(c, evenements))).toEqual(fin);
        expect(jouer(c, evenements)).toEqual(fin);
      });
    }
  }
  // lot PBG2 : une partie qui passe par une multibille (deux billes verrouillées, trois billes en jeu, des jackpots, la mission du niveau suivant) se rejoue au bit près, par le jeu comme par le serveur ; le robot y joue 6 minutes
  it.each([["espace", "doublette"], ["foire", "boucle"]] as const)("lot PBG2 : une partie avec multibille (%s, plan %s) : le jeu, le robot et le serveur donnent le même résultat", (theme, plan) => {
    const c = dailyPinball(JOUR + 3, undefined, theme, plan);
    const { evenements, partie } = jouerRobot(c, 1, { maxTicks: 216000 });
    expect(partie.multibilles, "la partie passe par au moins une multibille").toBeGreaterThanOrEqual(1);
    expect(partie.jackpotsPartie).toBeGreaterThanOrEqual(1);
    expect(pasAPas(c, evenements, 216000)).toEqual(partie.resultat());
    const fin = pasAPas(c, evenements, DUREE_MAX_TICKS);
    expect(rejouer(c, enregistrer(c, evenements))).toEqual(fin);
    expect(jouer(c, evenements)).toEqual(fin);
  }, 120000);
  it("répétée cent fois (la même partie d'une minute) : toujours la même", () => {
    const c = dailyPinball(JOUR);
    const { evenements } = jouerRobot(c, 1, { maxTicks: 36000 });
    const ref = JSON.stringify(rejouer(c, enregistrer(c, evenements)));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(rejouer(c, enregistrer(c, evenements)))).toBe(ref);
  });
  it("un appui de moins change la partie : la rediffusion est bien ce qui compte (un appui et son relâchement retirés, sur dix appuis)", () => {
    const c = dailyPinball(JOUR);
    const { evenements } = jouerRobot(c, 1, { maxTicks: 60000 });
    const a = JSON.stringify(rejouer(c, enregistrer(c, evenements)));
    let changes = 0;
    const appuis = evenements.map((e, i) => [e, i] as const).filter(([e]) => e.enfonce && e.c !== LANCEUR).slice(0, 10);
    for (const [e, i] of appuis) {
      const rel = evenements.findIndex((x, k) => k > i && x.c === e.c);
      const sans = evenements.filter((_, k) => k !== i && k !== rel);
      if (JSON.stringify(rejouer(c, enregistrer(c, sans))) !== a) changes++;
    }
    expect(appuis.length).toBe(10);
    expect(changes).toBeGreaterThan(0);
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
