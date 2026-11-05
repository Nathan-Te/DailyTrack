import { describe, expect, it } from "vitest";
import { colonneDe, dailyBlocks, enregistrer, grilleEnTexte, ligneDe, Partie, PREMIER_JOUR_BLOCKS } from "@cdj/blocks-sim";
import { jouerDiamant } from "@cdj/blocks-sim/diamant";
import { jouerGlouton } from "@cdj/blocks-sim/glouton";
import { creerFantome, ecartFantome } from "../src/fantome";

// Lot B4 — le fantôme : la grille et le score d'une autre partie du jour AU MÊME RANG de pièce que le joueur, puis, sa partie finie, sa dernière grille (« Fin du fantôme »). Pur : rien n'est écrit dans la partie du joueur.
const contenu = dailyBlocks(PREMIER_JOUR_BLOCKS + 4);
const diamant = jouerDiamant(contenu);
const rediffusion = enregistrer(contenu, diamant.actions);

/** La partie jouée pose après pose : ce que le fantôme doit montrer à chaque rang. */
function reference(actions: readonly number[]): { grille: string[]; score: number; combo: number }[] {
  const p = new Partie(contenu);
  const r = [{ grille: grilleEnTexte(p.grille), score: p.score, combo: p.combo }];
  for (const a of actions) {
    p.poser(colonneDe(a), ligneDe(a));
    r.push({ grille: grilleEnTexte(p.grille), score: p.score, combo: p.combo });
  }
  return r;
}

describe("le fantôme montre sa grille et son score au même rang de pièce", () => {
  it("au rang n (n poses du joueur), la grille, le score et le combo du fantôme après ses n premières poses", () => {
    const f = creerFantome(contenu, rediffusion)!;
    expect(f).not.toBeNull();
    expect(f.poses).toBe(diamant.actions.length);
    expect(f.scoreFinal).toBe(diamant.resultat.score);
    const attendu = reference(diamant.actions);
    for (const rang of [0, 1, 2, 5, 17, f.poses - 1]) {
      const e = f.etat(rang);
      expect({ grille: grilleEnTexte(e.grille), score: e.score, combo: e.combo }, `rang ${rang}`).toEqual(attendu[rang]);
      expect(e.fini).toBe(false);
    }
  });

  it("au rang 0, une grille vide et un score de 0 : le fantôme est là dès la première pièce", () => {
    const e = creerFantome(contenu, rediffusion)!.etat(0);
    expect(e.score).toBe(0);
    expect(grilleEnTexte(e.grille).every((l) => l === "........")).toBe(true);
  });

  it("le score du fantôme ne baisse jamais d'un rang à l'autre", () => {
    const f = creerFantome(contenu, rediffusion)!;
    for (let r = 1; r <= f.poses; r++) expect(f.etat(r).score).toBeGreaterThanOrEqual(f.etat(r - 1).score);
  });
});

describe("quand le fantôme est fini (sa partie s'est arrêtée avant celle du joueur)", () => {
  const court = jouerGlouton(contenu);
  const f = creerFantome(contenu, enregistrer(contenu, court.actions))!;
  it("après sa dernière pose, il garde sa dernière grille et son score final, et il est `fini`", () => {
    expect(f.poses).toBe(court.actions.length);
    const derniere = reference(court.actions).at(-1)!;
    for (const rang of [f.poses, f.poses + 1, f.poses + 40, 100_000]) {
      const e = f.etat(rang);
      expect(e.fini, `rang ${rang}`).toBe(true);
      expect({ grille: grilleEnTexte(e.grille), score: e.score, combo: e.combo }).toEqual(derniere);
    }
    expect(f.etat(f.poses - 1).fini).toBe(false);
  });
  it("un rang négatif ou fractionnaire reste dans la partie du fantôme", () => {
    expect(f.etat(-3).score).toBe(0);
    expect(f.etat(2.9).score).toBe(f.etat(2).score);
  });
});

describe("un fantôme illisible n'existe pas (la partie se joue sans lui)", () => {
  it("aucune rediffusion, du texte quelconque, ou la rediffusion d'un autre jour : `null`", () => {
    expect(creerFantome(contenu, null)).toBeNull();
    expect(creerFantome(contenu, "")).toBeNull();
    expect(creerFantome(contenu, "n'importe quoi")).toBeNull();
    const autre = dailyBlocks(PREMIER_JOUR_BLOCKS + 5);
    expect(creerFantome(autre, rediffusion)).toBeNull();
  });
  it("une partie qui n'est pas terminée n'est pas un fantôme", () => {
    expect(creerFantome(contenu, enregistrer(contenu, diamant.actions.slice(0, 3)))).toBeNull();
  });
});

describe("l'écart avec le fantôme, vu du joueur", () => {
  it("+ s'il le devance, − (le signe moins typographique) s'il est derrière, = à égalité", () => {
    expect(ecartFantome(3000, 2760, "fr")).toBe("+240");
    expect(ecartFantome(100, 220, "fr")).toBe("−120");
    expect(ecartFantome(500, 500, "fr")).toBe("=");
  });
  it("les grands nombres suivent la langue, avec une espace insécable en français", () => {
    expect(ecartFantome(14_500, 1_000, "fr")).toBe("+13\u00a0500");
    expect(ecartFantome(14_500, 1_000, "en")).toBe("+13,500");
  });
});
