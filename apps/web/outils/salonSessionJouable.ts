import { runPilot, salonCircuit, type PilotRun } from "@cdj/sim";

// Lot R17 : choisir une session du Salon JOUABLE pour `salon-serveur.spec.ts`. Le circuit d'une session est tiré par son numéro, qui dépend de
// l'heure atteinte par l'horloge de test (donc des specs passés avant dans la part) : tous les circuits n'ont pas deux pilotes qui finissent
// (mesuré : 6 sur 200 n'en ont aucun, quelle que soit l'adhérence de 0,95 à 0,5). Le test ne suppose plus que la session suivante l'est : il prend
// la première des `FENETRE` suivantes où l'on trouve un pilote rapide et un pilote plus lent qui finissent avec des temps différents.
// Pur (sans Playwright) pour que `test/salonSessionJouable.test.ts` le prouve sans navigateur.

/** Nombre de sessions suivantes examinées au plus (la suivante, puis les deux d'après). */
export const FENETRE = 3;
/** Adhérences essayées, de la plus haute à la plus basse (le pilote rapide et le pilote lent viennent de la même liste). */
export const ADHERENCES = [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5];

export interface SessionJouable {
  session: number;
  /** Le plus rapide qui finit. */
  fast: PilotRun;
  /** Le plus lent qui finit, strictement plus lent que `fast`. */
  slow: PilotRun;
}

/** Les deux pilotes d'une session, ou `null` si elle n'est pas jouable (moins de deux temps différents). Toutes les adhérences sont essayées : le plus rapide et le plus lent sont les extrêmes. */
export function pilotesDeSession(session: number): SessionJouable | null {
  const { track } = salonCircuit(session);
  let fast: PilotRun | null = null;
  let slow: PilotRun | null = null;
  for (const grip of ADHERENCES) {
    const run = runPilot(track, { grip });
    if (!run.valid) continue;
    if (!fast || run.finishMs < fast.finishMs) fast = run;
    if (!slow || run.finishMs > slow.finishMs) slow = run;
  }
  return fast && slow && slow.finishMs > fast.finishMs ? { session, fast, slow } : null;
}

/** Version rapide, pour prouver la fenêtre : y a-t-il deux temps de fin différents ? S'arrête au deuxième temps différent (deux courses en général). */
export function sessionJouable(session: number): boolean {
  const { track } = salonCircuit(session);
  let premier: number | null = null;
  for (const grip of ADHERENCES) {
    const run = runPilot(track, { grip });
    if (!run.valid) continue;
    if (premier === null) premier = run.finishMs;
    else if (run.finishMs !== premier) return true;
  }
  return false;
}

export interface Choix {
  /** La session retenue et ses deux pilotes. */
  jouable: SessionJouable;
  /** Combien de sessions suivantes ont été sautées (0 : la suivante convenait). */
  sautees: number;
}

/**
 * En partant de la session suivante (`courante + 1`), la première des `fenetre` suivantes qui a deux pilotes. `evaluer` est injectable (le test de la logique
 * n'a pas besoin du générateur). Échec explicite, avec les sessions essayées, si aucune ne convient.
 */
export function choisirSessionJouable(courante: number, evaluer: (session: number) => SessionJouable | null = pilotesDeSession, fenetre = FENETRE): Choix {
  for (let sautees = 0; sautees < fenetre; sautees++) {
    const jouable = evaluer(courante + 1 + sautees);
    if (jouable) return { jouable, sautees };
  }
  throw new Error(`aucune session jouable parmi les ${fenetre} suivantes (${courante + 1} à ${courante + fenetre})`);
}
