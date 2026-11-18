import { describe, expect, it } from "vitest";
import { choisirSessionJouable, FENETRE, pilotesDeSession, sessionJouable, type SessionJouable } from "../outils/salonSessionJouable";

// Lot R17 : le choix de la session du Salon pour `e2e/salon-serveur.spec.ts` (version courte, Essentiel). La preuve sur 200 sessions est dans
// `salonSessionJouable-200.test.ts` (Régression, ≈ 1 min).
const faux = (session: number) => ({ session, fast: { finishMs: 1 }, slow: { finishMs: 2 } }) as unknown as SessionJouable;

describe("choisirSessionJouable : la logique de la fenêtre", () => {
  it("prend la session suivante quand elle est jouable", () => {
    expect(choisirSessionJouable(10, faux)).toMatchObject({ jouable: { session: 11 }, sautees: 0 });
  });
  it("saute les sessions injouables, dans l'ordre, et prend la première jouable", () => {
    const vues: number[] = [];
    const evaluer = (s: number) => (vues.push(s), s === 13 ? faux(s) : null);
    expect(choisirSessionJouable(10, evaluer)).toMatchObject({ jouable: { session: 13 }, sautees: 2 });
    expect(vues).toEqual([11, 12, 13]);
  });
  it("échoue, en le disant, quand aucune des sessions de la fenêtre ne convient (et n'en regarde pas une de plus)", () => {
    const vues: number[] = [];
    expect(() => choisirSessionJouable(10, (s) => (vues.push(s), null))).toThrow(/aucune session jouable.*11 à 13/);
    expect(vues).toHaveLength(FENETRE);
  });
});

describe("pilotesDeSession : de vrais circuits du Salon", () => {
  it("un pilote rapide et un pilote plus lent qui finissent, avec des temps différents ; la version rapide est d'accord", () => {
    // Les sessions 0 et 1 de l'horloge des tests (20/10/2026 12 h) : celles où le pilote lent de l'ancien test ne finissait pas.
    const depart = Math.floor(Date.parse("2026-10-20T12:00:00Z") / 180_000);
    for (const session of [depart, depart + 1, depart + 2]) {
      const p = pilotesDeSession(session);
      expect(p, `session ${session}`).not.toBeNull();
      expect(p!.fast.valid && p!.slow.valid).toBe(true);
      expect(p!.slow.finishMs).toBeGreaterThan(p!.fast.finishMs);
      expect(sessionJouable(session)).toBe(true);
    }
  });
});
