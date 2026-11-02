import { FICTIONAL_NAMES } from "@cdj/sim";
import { parisDayStart } from "@cdj/clock";
import { createApi } from "../src/api";
import { CLASSEMENT_DEMO_NOMS } from "../src/classementDemo";
import type { SqlDb } from "../src/db";
import { fictionalId } from "../src/history";
import { DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM } from "../src/portailDemo";

// Lot F2 (plateforme) : les **amis du joueur de démonstration** « Démo » (recette seulement), pour juger le filtre « Amis » des classements, la liste et la feuille d'un joueur en deux clics. Comme
// « Démo » et les joueurs du classement, ils ne sont créés que par `recette:seed` (garde `recetteSeedTarget`), par le **vrai `createApi`** (`POST /api/amis` : aucune ligne écrite à la main) avec
// `demoPlayers: true`, option que le serveur de production ne règle jamais. « Démo » reçoit **5 amis** : 4 joueurs « Démo … » du classement du jour, **dont 3 réciproques** (ils l'ajoutent à
// leur tour), et **1 qui n'a pas joué aujourd'hui** (un pilote « Démo … » de l'historique de la recette, qui a des résultats les jours d'avant mais aucun aujourd'hui) : il est en bas du classement
// « Amis », sous « n'a pas encore joué ».
//
// **Propre à l'effacement et à la recréation habituels** : « Démo » est effacé puis recréé une fois par jour (`seedPortailDemo`) et les joueurs du classement quand leur contenu change : l'effacement d'un
// profil supprime ses amitiés dans les deux sens. Ce script se contente donc de constater (« Démo » a-t-il ses amis ? — une lecture indexée) et de recréer ce qui manque ; relancé tel quel, il n'écrit rien.

/** Combien d'amis « Démo » reçoit, dont combien le sont réciproquement. */
export const AMIS_DEMO = 5;
export const AMIS_DEMO_RECIPROQUES = 3;

export interface AmisDemoReport {
  /** « Démo » avait déjà ses amis : rien n'a été écrit. */
  deja: boolean;
  amis: string[];
  reciproques: string[];
  /** L'ami qui n'a pas joué aujourd'hui (`null` : aucun pilote de l'historique n'existe encore sur cette base). */
  absent: string | null;
}

/** Crée (ou complète) les amis de « Démo » dans la base donnée, au jour `today` (numéro de jour de Paris). */
export async function seedAmisDemo(o: { db: SqlDb; today: number }): Promise<AmisDemoReport> {
  const { db } = o;
  const existe = async (id: string) => !!(await db.first("SELECT 1 AS x FROM players WHERE id = ?", [id]));
  const aJoue = async (id: string) => !!(await db.first("SELECT 1 AS x FROM results WHERE player_id = ? AND day = ?", [id, o.today])) || !!(await db.first("SELECT 1 AS x FROM jump_results WHERE player_id = ? AND day = ?", [id, o.today]));
  const vide: AmisDemoReport = { deja: false, amis: [], reciproques: [], absent: null };

  if (!(await existe(DEMO_JOUEUR_ID))) return vide;
  const deja = (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM amities WHERE joueur = ?", [DEMO_JOUEUR_ID]))?.n ?? 0;
  if (deja >= AMIS_DEMO) return { ...vide, deja: true };

  // Les 4 qui ont joué aujourd'hui (dans l'ordre alphabétique des pseudos du classement) et 1 pilote de l'historique qui n'a pas joué.
  const joueurs: string[] = [];
  for (const nom of [...CLASSEMENT_DEMO_NOMS].sort((a, b) => a.localeCompare(b, "fr"))) {
    if (joueurs.length === AMIS_DEMO - 1) break;
    const id = fictionalId(nom);
    if ((await existe(id)) && (await aJoue(id))) joueurs.push(nom);
  }
  let absent: string | null = null;
  for (const nom of [...FICTIONAL_NAMES].sort((a, b) => a.localeCompare(b, "fr"))) {
    const id = fictionalId(nom);
    if ((await existe(id)) && !(await aJoue(id))) {
      absent = nom;
      break;
    }
  }
  const amis = absent ? [...joueurs, absent] : joueurs;

  let clock = parisDayStart(o.today) + 12 * 3_600_000;
  const api = createApi({ db, now: () => clock, demoPlayers: true, allowCopies: true, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const ecrire = async (qui: string, corps: unknown) => {
    const res = await api.handle(new Request("http://recette.local/api/amis", { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": qui }, body: JSON.stringify(corps) }), { clientKey: "192.0.2.12" });
    const texte = await res.text();
    const erreur = texte ? (JSON.parse(texte) as { error?: string }).error : undefined;
    // « Déjà dans la liste » est le résultat voulu quand le script est rejoué à moitié.
    if (res.status !== 200 && erreur !== "friend_exists") throw new Error(`amis de « ${DEMO_JOUEUR_NOM} » : ajout refusé (${res.status} ${String(erreur ?? "")})`);
  };
  clock += 1000;
  for (const nom of amis) await ecrire(DEMO_JOUEUR_ID, { pseudo: nom });
  const reciproques = joueurs.slice(0, AMIS_DEMO_RECIPROQUES);
  for (const nom of reciproques) await ecrire(fictionalId(nom), { pseudo: DEMO_JOUEUR_NOM });
  return { deja: false, amis, reciproques, absent };
}
