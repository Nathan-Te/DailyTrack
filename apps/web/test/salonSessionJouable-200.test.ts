import { describe, expect, it } from "vitest";
import { choisirSessionJouable, FENETRE, pilotesDeSession, sessionJouable } from "../outils/salonSessionJouable";

// Lot R17, preuve (Régression : ≈ 1 min en local, plus de 10 s) : sur 200 sessions consécutives à partir de l'horloge des tests (20/10/2026 12 h,
// sessions de 3 minutes), le choix de `salon-serveur.spec.ts` trouve toujours une session jouable dans la fenêtre, quelle que soit la session en cours.
const SESSION_MS = 180_000;
const DEPART = Math.floor(Date.parse("2026-10-20T12:00:00Z") / SESSION_MS);
const N = 200;

describe("sur 200 sessions consécutives, le choix trouve toujours une session jouable (lot R17)", () => {
  it("jamais FENETRE sessions injouables de suite ; combien de sessions il faut sauter au plus", () => {
    const jouable = new Map<number, boolean>();
    const ok = (s: number) => (jouable.has(s) ? jouable.get(s)! : (jouable.set(s, sessionJouable(s)), jouable.get(s)!));
    let maxSautees = 0;
    let injouables = 0;
    for (let courante = DEPART - 1; courante < DEPART - 1 + N; courante++) {
      // `choisirSessionJouable` avec la version rapide (mêmes critères que `pilotesDeSession`, vérifiée plus bas) : une session jouable est rendue sans ses pilotes.
      const { sautees } = choisirSessionJouable(courante, (s) => (ok(s) ? ({ session: s } as never) : null));
      maxSautees = Math.max(maxSautees, sautees);
    }
    for (let s = DEPART; s < DEPART + N + FENETRE; s++) if (!ok(s)) injouables++;
    console.log(`sessions injouables : ${injouables} sur ${N + FENETRE} ; sessions sautées au plus : ${maxSautees}`);
    expect(maxSautees).toBeLessThan(FENETRE);
  }, 600_000);

  it("la version rapide et la version complète donnent le même verdict (dix sessions)", () => {
    for (let s = DEPART; s < DEPART + 10; s++) expect(sessionJouable(s), `session ${s}`).toBe(pilotesDeSession(s) !== null);
  }, 600_000);
});
