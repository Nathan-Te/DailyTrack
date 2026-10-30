import { formatDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { dailyCircuit, encodeReplay as encodeTrack, runPilot } from "@cdj/sim";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, demoAttempts, encodeReplay as encodeJump, replayAttempt } from "@cdj/jump-sim";
import { createApi } from "../src/api";
import type { ClientCompte, Comptage } from "../src/comptage";
import type { SqlDb } from "../src/db";
import { referenceId } from "./baseDeReference";

/**
 * Lot R14 — les routes les plus appelées, mesurées en lignes lues sur la base de référence (`baseDeReference.ts`, base libSQL locale comptée).
 *
 * Deux mesures par route de lecture :
 *   - **à froid** : une instance neuve (rien en mémoire) — c'est le cas d'une instance Cloud Run qui vient de démarrer (`min-instances=0`), donc le plus fréquent à faible trafic ;
 *   - **à chaud** : la même instance, une seconde fois (classement gardé pour sa fenêtre, niveau en mémoire…).
 * Un envoi n'a que sa mesure à froid. `lues` = lignes parcourues + lignes renvoyées (estimation basse : voir `src/comptage.ts`).
 */
export interface Mesure {
  instructions: number;
  parcourues: number;
  renvoyees: number;
  lues: number;
  ecrites: number;
}
export interface MesureRoute {
  route: string;
  statut: number;
  froid: Mesure;
  chaud: Mesure | null;
}

const resume = (c: Comptage): Mesure => ({ instructions: c.instructions, parcourues: c.parcourues, renvoyees: c.renvoyees, lues: c.parcourues + c.renvoyees, ecrites: c.ecrites });

interface RouteSpec {
  nom: string;
  methode: "GET" | "POST";
  chemin: (date: string) => string;
  /** Numéro du joueur de la référence qui appelle (en-tête `X-Player-Id`), ou un identifiant précis. */
  joueur?: number | string;
  corps?: (today: number) => unknown;
}

export const ROUTES_CHAUDES: RouteSpec[] = [
  { nom: "portail jour (visiteur)", methode: "GET", chemin: () => "/api/portail/jour" },
  { nom: "portail jour (joueur)", methode: "GET", chemin: () => "/api/portail/jour", joueur: 5 },
  { nom: "portail classement (cumul)", methode: "GET", chemin: () => "/api/portail/classement" },
  { nom: "Track classement du jour", methode: "GET", chemin: (d) => `/api/day/${d}/leaderboard`, joueur: 5 },
  { nom: "Track profil /api/me", methode: "GET", chemin: () => "/api/me", joueur: 5 },
  { nom: "Jump bundle du jour", methode: "GET", chemin: (d) => `/api/jump/day/${d}/bundle`, joueur: 5 },
  { nom: "message en direct", methode: "GET", chemin: () => "/api/annonce" },
  {
    nom: "Track envoi d'un résultat",
    methode: "POST",
    chemin: () => "/api/submit",
    joueur: "ffffffffffffffffffffffffffff0001",
    corps: (today) => {
      const run = runPilot(dailyCircuit(today).track, { grip: 0.8 });
      if (!run.valid) throw new Error("le pilote ne finit pas ce circuit");
      return { name: "Nouveau pilote", date: formatDay(today), replay: encodeTrack(run.replay) };
    },
  },
  {
    nom: "Jump envoi d'un résultat",
    methode: "POST",
    chemin: () => "/api/jump/submit",
    joueur: "ffffffffffffffffffffffffffff0002",
    corps: (today) => {
      const J = dailyLevel(today);
      for (const seed of [0x5eed, 0x5eee, 0x5eef, 0x5ef0]) {
        for (const a of demoAttempts(J.level, J.replay, seed, { attempts: 40 }).filter((x) => x.end === "arrivée")) {
          const r = replayAttempt(J.level, a.replay, J.id);
          if (r.finished && r.time > J.authorTicks) return { levelId: J.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: encodeJump(a.replay), name: "Nouveau sauteur" };
        }
      }
      throw new Error("aucun essai fictif plus lent que l'auteur");
    },
  },
];

export async function mesurerRoutes(db: SqlDb, compte: ClientCompte, today: number): Promise<MesureRoute[]> {
  const date = formatDay(today);
  const clock = parisDayStart(today) + 12 * 3_600_000;
  // Production : rien n'est permis de plus qu'au serveur réel (`allowCopies` faux : la vérification des copies fait partie du coût d'un envoi).
  const neuve = () => createApi({ db, now: () => clock, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const appel = async (api: ReturnType<typeof createApi>, r: RouteSpec) => {
    const headers: Record<string, string> = r.corps ? { "Content-Type": "application/json" } : {};
    if (r.joueur !== undefined) headers["X-Player-Id"] = typeof r.joueur === "number" ? referenceId(r.joueur) : r.joueur;
    const res = await api.handle(new Request(`http://mesure.local${r.chemin(date)}`, { method: r.methode, headers, body: r.corps ? JSON.stringify(r.corps(today)) : undefined }), { clientKey: "198.51.100.7" });
    await res.text();
    return res.status;
  };
  // Les circuits et niveaux du jour se calculent à la première requête du jour, puis restent en base : ce n'est pas le coût d'une route.
  const chaud = neuve();
  for (const chemin of [`/api/day/${date}`, `/api/jump/day/${date}`]) await chaud.handle(new Request(`http://mesure.local${chemin}`), { clientKey: "198.51.100.7" }).then((r) => r.text());
  const corps = new Map(ROUTES_CHAUDES.map((r) => [r.nom, r.corps ? r.corps(today) : undefined])); // préparés hors mesure (calcul de rediffusions)
  const sortie: MesureRoute[] = [];
  for (const r of ROUTES_CHAUDES) {
    const spec = r.corps ? { ...r, corps: () => corps.get(r.nom) } : r;
    compte.remettre();
    const api = neuve();
    const statut = await appel(api, spec);
    const froid = resume(compte.comptage);
    let tiede: Mesure | null = null;
    if (r.methode === "GET") {
      compte.remettre();
      await appel(api, spec);
      tiede = resume(compte.comptage);
    }
    sortie.push({ route: r.nom, statut, froid, chaud: tiede });
  }
  return sortie;
}

/** Une table lisible des mesures (README du lot, sortie de `npm run measure:lignes`). */
export function tableau(mesures: readonly MesureRoute[]): string {
  const ligne = (m: Mesure | null) => (m ? `${String(m.lues).padStart(6)} lues (${String(m.parcourues).padStart(4)} parcourues) · ${String(m.instructions).padStart(3)} instr. · ${String(m.ecrites).padStart(3)} écrites` : "—".padStart(6));
  return mesures.map((m) => `${m.route.padEnd(30)} [${m.statut}]  froid : ${ligne(m.froid)}   chaud : ${ligne(m.chaud)}`).join("\n");
}
