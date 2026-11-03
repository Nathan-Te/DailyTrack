import { parisDayStart } from "@cdj/clock";
import { createApi } from "../src/api";
import { CLASSEMENT_DEMO_NOMS } from "../src/classementDemo";
import type { SqlDb } from "../src/db";
import { fictionalId } from "../src/history";
import { DEMO_JOUEUR_ID } from "../src/portailDemo";
import { semerReponse } from "../src/retours";

// Lot C1, partie A (plateforme) : **trois retours** sur la recette, dont un avec la réponse de l'éditeur à lire dans « Mes messages » (la pastille de l'avatar de « Démo »), pour juger le dialogue, la rubrique
// « Retours » du panneau et « Mes messages » en deux clics. Les retours viennent du **vrai `createApi`** (`POST /api/retours`, `demoPlayers: true`, jamais réglé en production) ; la réponse de l'éditeur est
// écrite par `semerReponse` (la recette n'a pas de session d'administration à rejouer). Comme « Démo », effacé puis recréé chaque jour avec ses retours, ce script **constate d'abord** (une lecture indexée) et
// ne recrée que ce qui manque ; relancé tel quel, il n'écrit rien.

export const RETOURS_DEMO = 3;

export interface RetoursDemoReport {
  deja: boolean;
  crees: number;
}

export async function seedRetoursDemo(o: { db: SqlDb; today: number }): Promise<RetoursDemoReport> {
  const { db } = o;
  const existe = async (id: string) => !!(await db.first("SELECT 1 AS x FROM players WHERE id = ?", [id]));
  if (!(await existe(DEMO_JOUEUR_ID))) return { deja: false, crees: 0 };
  const deja = (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM retours WHERE player_id = ?", [DEMO_JOUEUR_ID]))?.n ?? 0;
  if (deja > 0) return { deja: true, crees: 0 };
  const autres: string[] = [];
  for (const nom of [...CLASSEMENT_DEMO_NOMS].sort((a, b) => a.localeCompare(b, "fr"))) {
    const id = fictionalId(nom);
    if (autres.length < 2 && (await existe(id))) autres.push(id);
  }
  const horloge = parisDayStart(o.today) + 12 * 3_600_000;
  let t = horloge;
  const api = createApi({ db, now: () => t, demoPlayers: true, allowCopies: true, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const contexte = { jeu: "jump", page: "/jump/", jour: "", navigateur: "firefox", systeme: "linux", ecran: "390x844", langue: "fr" };
  const envois: { joueur: string; type: string; texte: string; jeu: string }[] = [
    { joueur: DEMO_JOUEUR_ID, type: "bug", jeu: "jump", texte: "Dans Jump, la scie du deuxième niveau semble sortir du mur avant de bouger. C'est voulu ?" },
    ...(autres[0] ? [{ joueur: autres[0], type: "suggestion", jeu: "track", texte: "Ce serait chouette de pouvoir revoir le meilleur tour de quelqu'un d'autre dans Track." }] : []),
    ...(autres[1] ? [{ joueur: autres[1], type: "autre", jeu: "portail", texte: "Merci pour les jeux du jour, on y joue en famille chaque soir." }] : []),
  ];
  let crees = 0;
  let premier: number | null = null;
  for (const e of envois) {
    t += 60_000;
    const r = await api.handle(new Request("http://seed.local/api/retours", { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": e.joueur }, body: JSON.stringify({ type: e.type, texte: e.texte, contexte: { ...contexte, jeu: e.jeu, page: `/${e.jeu === "portail" ? "" : `${e.jeu}/`}` } }) }), { clientKey: `retours-demo-${crees}` });
    if (r.status !== 200) throw new Error(`retours de recette : ${r.status} ${await r.text()}`);
    if (premier === null) premier = ((await r.json()) as { id: number }).id;
    crees++;
  }
  // Le premier retour (celui de « Démo ») a la réponse de l'éditeur : elle attend dans « Mes messages ».
  if (premier !== null) await semerReponse(db, premier, "Merci ! Oui, c'est voulu : la scie sort du mur pour t'avertir. On va le rendre plus lisible.", t + 60_000);
  return { deja: false, crees };
}
