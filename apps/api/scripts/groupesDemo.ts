import { parisDayStart } from "@cdj/clock";
import { createApi } from "../src/api";
import { CLASSEMENT_DEMO_NOMS } from "../src/classementDemo";
import type { SqlDb } from "../src/db";
import { fictionalId } from "../src/history";
import { DEMO_JOUEUR_ID } from "../src/portailDemo";
import { IMAGES_DEMO } from "./avatarsDemo";

// Lot C1, partie C (plateforme) : **trois groupes** sur la recette, pour juger la page d'un groupe, le classement des groupes et le filtre « Mon groupe » en deux clics. « Les Noctambules » (le chef est « Démo », 4 membres
// classés), « Les Rapides » (5 membres classés, un emblème), « Les Deux » (2 membres classés : « Moins de 3 classés », sans rang). Les groupes viennent du **vrai `createApi`** (`POST /api/groupes`, lien d'invitation, `rejoindre`,
// `demoPlayers: true`, jamais réglé en production) ; seule l'arrivée est avancée à la veille (sinon personne ne compterait avant demain). Constaté d'abord (une lecture) : relancé, il n'écrit rien.

export const GROUPES_DEMO = [
  { nom: "Les Noctambules", description: "On joue le soir, après le dîner.", chef: "Démo", membres: ["Démo Fjord", "Démo Givre", "Démo Hibou"] },
  { nom: "Les Rapides", description: "Moyenne des trois meilleurs : on vise le podium.", chef: "Démo Abricot", membres: ["Démo Bambou", "Démo Cerise", "Démo Dahlia", "Démo Écume"], emblem: 1 },
  { nom: "Les Deux", description: "Un groupe tout neuf.", chef: "Démo Iris", membres: ["Démo Jade"] },
] as const;

export interface GroupesDemoReport {
  deja: boolean;
  crees: number;
}

export async function seedGroupesDemo(o: { db: SqlDb; today: number }): Promise<GroupesDemoReport> {
  const { db } = o;
  const existe = async (id: string) => !!(await db.first("SELECT 1 AS x FROM players WHERE id = ?", [id]));
  if (!(await existe(DEMO_JOUEUR_ID))) return { deja: false, crees: 0 };
  if (await db.first("SELECT 1 AS x FROM groupes WHERE cree_le > 0 LIMIT 1")) return { deja: true, crees: 0 };
  const idDe = (nom: string) => (nom === "Démo" ? DEMO_JOUEUR_ID : fictionalId(nom));
  for (const nom of CLASSEMENT_DEMO_NOMS) if (!(await existe(fictionalId(nom)))) return { deja: false, crees: 0 };
  let t = parisDayStart(o.today) + 14 * 3_600_000;
  const api = createApi({ db, now: () => t, demoPlayers: true, allowCopies: true, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  let n = 0;
  const appel = async (methode: string, chemin: string, joueur: string | null, corps?: unknown) => {
    t += 1000;
    const r = await api.handle(new Request(`http://seed.local${chemin}`, { method: methode, headers: { "Content-Type": "application/json", ...(joueur ? { "X-Player-Id": joueur } : {}) }, ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}) }), { clientKey: `groupes-demo-${n++}` });
    if (r.status !== 200) throw new Error(`groupes de recette : ${methode} ${chemin} → ${r.status} ${await r.text()}`);
    return (await r.json()) as Record<string, any>;
  };
  let crees = 0;
  for (const g of GROUPES_DEMO) {
    const chef = idDe(g.chef);
    const c = await appel("POST", "/api/groupes", chef, { nom: g.nom, description: g.description });
    const moi = await appel("GET", "/api/groupes/moi", chef);
    for (const m of g.membres) await appel("POST", "/api/groupes/rejoindre", idDe(m), { jeton: moi.groupe.invitation });
    if ("emblem" in g) await appel("POST", "/api/groupes/emblem", chef, { image: IMAGES_DEMO[g.emblem] });
    // Ils comptent dès aujourd'hui (l'arrivée de la vraie vie est le lendemain).
    await db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [o.today - 1, c.id]);
    crees++;
  }
  return { deja: false, crees };
}
