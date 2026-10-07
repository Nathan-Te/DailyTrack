import { apiBase, DEMO_BASE, LeaderboardApi, type LeaderboardSource } from "./api";
import { DemoApi, rankAmong } from "./demo";
import { getPlayerId } from "./identity";
import type { ArchiveDay, ArchiveExtras } from "./archive";

/**
 * Ce qui complète la liste des archives, chargé après son affichage :
 * - mode démo (`?api=demo`) : seuils de médailles et nombre de pilotes de chaque jour, et **ta place figée** (ton meilleur
 *   temps placé parmi les pilotes de démonstration) ;
 * - API réelle : ta place figée seulement (celle que le serveur a enregistrée), pour les jours que tu as joués ;
 * - sans API : rien.
 */
export async function loadArchiveExtras(days: ArchiveDay[], base = apiBase()): Promise<ArchiveExtras | null> {
  if (!base) return null;
  const extras: ArchiveExtras = { meta: new Map(), ranks: new Map() };
  const played = days.filter((d) => d.best);
  if (base === DEMO_BASE) {
    const demo = new DemoApi();
    const index = await demo.loadIndex();
    if (!index.ok) return null;
    for (const d of index.data.days) extras.meta.set(d.date, { authorMs: d.authorMs, participants: d.participants });
    await Promise.all(
      played.map(async (d) => {
        const day = await demo.day(d.date);
        if (day.ok) extras.ranks.set(d.date, rankAmong(day.data, d.best!.ms));
      }),
    );
    return extras;
  }
  const api: LeaderboardSource = new LeaderboardApi(base);
  const id = getPlayerId();
  await Promise.all(
    played.slice(0, 20).map(async (d) => {
      const r = await api.leaderboard(d.date, id, 1);
      if (r.ok && r.data.me) extras.ranks.set(d.date, { rank: r.data.me.rank, participants: r.data.participants });
    }),
  );
  return extras;
}
