import { describe, expect, it } from "vitest";
import { FONDU_REMONTEE_S, FONDU_RETOMBEE_S, NIVEAU_FIN, creerFondFin } from "../src/jeu/fondFin";

// Le fondu de fin de partie (lot B6) : la musique retombe à 0,35 en 1,2 s quand la partie est jouée, puis remonte à 1 en 1,5 s à l'écran de fin. Un faux « musique » note les niveaux demandés.
function banc() {
  const appels: [number, number | undefined][] = [];
  const attente: { ms: number; fn: () => void }[] = [];
  const fond = creerFondFin({ baisser: (n, d) => void appels.push([n, d]) }, (ms, fn) => void attente.push({ ms, fn }));
  return { fond, appels, attente };
}

describe("le fondu de fin de partie", () => {
  it("les valeurs de la décision : 0,35 en 1,2 s, puis 1 en 1,5 s", () => {
    expect([NIVEAU_FIN, FONDU_RETOMBEE_S, FONDU_REMONTEE_S]).toEqual([0.35, 1.2, 1.5]);
  });

  it("un jeu qui montre sa fin (« Plus de place ! ») : retomber une seule fois, même dite à chaque image, puis remonter à l'écran de fin", () => {
    const { fond, appels, attente } = banc();
    fond.retomber();
    fond.retomber();
    fond.retomber();
    expect(appels).toEqual([[0.35, 1.2]]);
    fond.remonter();
    expect(appels).toEqual([[0.35, 1.2], [1, 1.5]]);
    expect(attente).toHaveLength(0); // rien à attendre : la chute a eu lieu pendant « Plus de place ! »
  });

  it("un jeu dont la partie finit d'un coup : elle retombe à l'écran de fin, puis remonte quand la chute est finie (1,2 s plus tard)", () => {
    const { fond, appels, attente } = banc();
    fond.remonter();
    expect(appels).toEqual([[0.35, 1.2]]);
    expect(attente.map((a) => a.ms)).toEqual([1200]);
    attente[0]!.fn();
    expect(appels).toEqual([[0.35, 1.2], [1, 1.5]]);
  });

  it("une nouvelle partie avant la remontée annule la remontée en attente, et la fin suivante retombe de nouveau", () => {
    const { fond, appels, attente } = banc();
    fond.remonter();
    fond.reinitialiser();
    attente[0]!.fn(); // le rappel d'avant arrive après le « Recommencer » : sans effet
    expect(appels).toEqual([[0.35, 1.2]]);
    fond.retomber();
    expect(appels).toEqual([[0.35, 1.2], [0.35, 1.2]]);
  });
});
