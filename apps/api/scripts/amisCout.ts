import { formatDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { AMIS_MAX } from "../src/amis";
import { createApi } from "../src/api";
import type { ClientCompte, Comptage } from "../src/comptage";
import type { SqlDb } from "../src/db";
import { referenceId } from "./baseDeReference";

/**
 * Lot F2 — les lignes lues des routes des amis, pour 0, 10 et 100 amis, sur la base de référence (`baseDeReference.ts` : 300 joueurs, 14 jours de parties dans chaque jeu, base libSQL **locale** comptée,
 * jamais Turso). Même méthode que `routesChaudes.ts` : à froid (une instance neuve : le cas fréquent avec `min-instances=0`) et à chaud (la même instance, une seconde fois). `lues` = lignes parcourues sans
 * index + lignes rendues : **une estimation basse** (une recherche par index lit aussi les entrées qu'elle écarte, une jointure lit la ligne de chaque ami) — voir `src/comptage.ts`.
 */
export const JOUEUR_AUX_AMIS = 5;
/** Le jour de la mesure : deux semaines après la première tour (Tower ne compte pas dans la journée avant son premier jour). */
export const AMIS_AUJOURDHUI = PREMIER_JOUR_TOWER + 14;
export const NOMBRES_D_AMIS = [0, 10, 100] as const;

export interface MesureAmis {
  instructions: number;
  parcourues: number;
  renvoyees: number;
  lues: number;
  ecrites: number;
}
export interface MesureRouteAmis {
  route: string;
  statut: number;
  froid: MesureAmis;
  chaud: MesureAmis | null;
}

const resume = (c: Comptage): MesureAmis => ({ instructions: c.instructions, parcourues: c.parcourues, renvoyees: c.renvoyees, lues: c.parcourues + c.renvoyees, ecrites: c.ecrites });

/** Donne `n` amis (les joueurs de la référence qui suivent le sien) au joueur de la mesure ; les autres amitiés sont effacées. */
export async function poserAmis(db: SqlDb, n: number): Promise<void> {
  await db.run("DELETE FROM amities");
  const lignes = Array.from({ length: n }, (_, i) => ({ sql: "INSERT INTO amities (joueur, ami, origine, cree_le) VALUES (?, ?, 'ajout', 0)", params: [referenceId(JOUEUR_AUX_AMIS), referenceId(JOUEUR_AUX_AMIS + 1 + i)] }));
  for (let i = 0; i < lignes.length; i += 100) {
    const part = lignes.slice(i, i + 100);
    if (db.batch) await db.batch(part);
    else for (const s of part) await db.run(s.sql, s.params);
  }
  // Un ami sur trois est réciproque (il a le joueur pour ami) : la liste lit la ligne inverse de chacun.
  const inverses = Array.from({ length: Math.floor(n / 3) }, (_, i) => ({ sql: "INSERT INTO amities (joueur, ami, origine, cree_le) VALUES (?, ?, 'ajout', 0)", params: [referenceId(JOUEUR_AUX_AMIS + 1 + i * 3), referenceId(JOUEUR_AUX_AMIS)] }));
  for (let i = 0; i < inverses.length; i += 100) {
    const part = inverses.slice(i, i + 100);
    if (db.batch) await db.batch(part);
    else for (const s of part) await db.run(s.sql, s.params);
  }
}

export async function mesurerAmis(db: SqlDb, compte: ClientCompte, today: number, nombre: number): Promise<MesureRouteAmis[]> {
  const date = formatDay(today);
  const clock = parisDayStart(today) + 12 * 3_600_000;
  const neuve = () => createApi({ db, now: () => clock, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const moi = referenceId(JOUEUR_AUX_AMIS);
  const cibleRef = referenceId(JOUEUR_AUX_AMIS + 1).slice(-12); // la référence publique des joueurs de la base de référence (`players.ref`) : le premier ami (ou, sans ami, un joueur quelconque)
  const hors = referenceId(250).slice(-12); // quelqu'un qui n'est pas ami
  const appel = async (api: ReturnType<typeof createApi>, methode: string, chemin: string, corps?: unknown) => {
    const res = await api.handle(
      new Request(`http://mesure.local${chemin}`, { method: methode, headers: { "X-Player-Id": moi, ...(corps === undefined ? {} : { "Content-Type": "application/json" }) }, body: corps === undefined ? undefined : JSON.stringify(corps) }),
      { clientKey: "198.51.100.8" },
    );
    await res.text();
    return res.status;
  };
  // Les circuits et niveaux du jour se calculent à la première requête du jour, puis restent en base : ce n'est pas le coût d'une route.
  const prechauffe = neuve();
  for (const chemin of [`/api/day/${date}`, `/api/jump/day/${date}`, `/api/tower/day/${date}`]) await prechauffe.handle(new Request(`http://mesure.local${chemin}`), { clientKey: "198.51.100.8" }).then((r) => r.text());
  const routes: { nom: string; methode: string; chemin: string; corps?: unknown; lecture: boolean }[] = [
    { nom: "GET /api/amis", methode: "GET", chemin: "/api/amis", lecture: true },
    { nom: "portail jour (joueur, avec amis)", methode: "GET", chemin: "/api/portail/jour", lecture: true },
    { nom: "portail classement cumul, filtre=amis", methode: "GET", chemin: `/api/portail/classement?date=${date}&vue=cumul&filtre=amis`, lecture: true },
    { nom: "portail classement track, filtre=amis", methode: "GET", chemin: `/api/portail/classement?date=${date}&vue=track&filtre=amis`, lecture: true },
    { nom: "portail classement jump, filtre=amis", methode: "GET", chemin: `/api/portail/classement?date=${date}&vue=jump&filtre=amis`, lecture: true },
    { nom: "portail classement tower, filtre=amis", methode: "GET", chemin: `/api/portail/classement?date=${date}&vue=tower&filtre=amis`, lecture: true },
    { nom: "Track classement, filtre=amis", methode: "GET", chemin: `/api/day/${date}/leaderboard?filtre=amis`, lecture: true },
    { nom: "Jump classement, filtre=amis", methode: "GET", chemin: `/api/jump/day/${date}/board?filtre=amis`, lecture: true },
    { nom: "Tower classement, filtre=amis", methode: "GET", chemin: `/api/tower/day/${date}/board?filtre=amis`, lecture: true },
    { nom: "feuille d'un joueur", methode: "GET", chemin: `/api/amis/fiche/${cibleRef}?date=${date}`, lecture: true },
    { nom: "suggestions (q=pil)", methode: "GET", chemin: "/api/amis/suggestions?q=pil", lecture: true },
    { nom: "ajouter un ami", methode: "POST", chemin: "/api/amis", corps: { ref: hors }, lecture: false },
    { nom: "créer un lien d'invitation", methode: "POST", chemin: "/api/amis/invitation", lecture: false },
  ];
  const sortie: MesureRouteAmis[] = [];
  for (const r of routes) {
    // L'ajout d'un ami modifie la liste : on la remet avant chaque route (avec 100 amis la liste est pleine, l'ajout se mesure à 99).
    await poserAmis(db, r.nom === "ajouter un ami" ? Math.min(nombre, AMIS_MAX - 1) : nombre);
    compte.remettre();
    const api = neuve();
    const statut = await appel(api, r.methode, r.chemin, r.corps);
    const froid = resume(compte.comptage);
    let chaud: MesureAmis | null = null;
    if (r.lecture) {
      compte.remettre();
      await appel(api, r.methode, r.chemin, r.corps);
      chaud = resume(compte.comptage);
    }
    sortie.push({ route: r.nom, statut, froid, chaud });
  }
  await db.run("DELETE FROM amities");
  await db.run("DELETE FROM invitations_amis");
  return sortie;
}

/** Une table lisible des mesures. */
export function tableauAmis(nombre: number, mesures: readonly MesureRouteAmis[]): string {
  const ligne = (m: MesureAmis | null) => (m ? `${String(m.lues).padStart(5)} lues (${String(m.parcourues).padStart(3)} parc.) · ${String(m.instructions).padStart(2)} instr. · ${String(m.ecrites).padStart(2)} écr.` : "—".padStart(5));
  return [`${nombre} ami(s)`, ...mesures.map((m) => `  ${m.route.padEnd(40)} [${m.statut}]  froid : ${ligne(m.froid)}   chaud : ${ligne(m.chaud)}`)].join("\n");
}
