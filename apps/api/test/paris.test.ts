import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/sim";
import { GRACE_MS } from "../src/api";
import { DAY, NOON, circuitOf, makeApi, parisDay, parisDayStart, pilotReplay, playerId } from "./helpers";

// Le jour de Paris (lot 31) : « aujourd'hui » change à minuit, heure de Paris, pour tout le monde. L'API ne lit plus le jour UTC.
// DAY = 14/10/2026 (heure d'été, UTC+2) ; le 25/10/2026 dure 25 h (retour à l'heure d'hiver à 3 h → 2 h).

const fast = pilotReplay(DAY, 1);
const submit = (t: Awaited<ReturnType<typeof makeApi>>, day: number, code: string, n = 1) =>
  t.call("POST", "/api/submit", { playerId: playerId(n), name: `Joueur${n}`, date: formatDay(day), replay: code });
const health = async (t: Awaited<ReturnType<typeof makeApi>>) => (await t.call("GET", "/api/health")).body;
const MIN = 60_000;

describe("jour de Paris — heure d'été", () => {
  it("le jour change à minuit de Paris (22 h UTC), pas à minuit UTC", async () => {
    const t = await makeApi();
    t.clock.now = parisDayStart(DAY + 1) - MIN; // 23 h 59 à Paris = 21 h 59 UTC
    expect((await health(t)).today).toBe(formatDay(DAY));
    t.clock.now = parisDayStart(DAY + 1) + MIN; // 0 h 01 à Paris = 22 h 01 UTC
    expect((await health(t)).today).toBe(formatDay(DAY + 1));
    // 22 h 30 UTC : il est encore le même jour UTC, mais déjà le lendemain à Paris
    t.clock.now = DAY * 86_400_000 + 22.5 * 3_600_000;
    expect((await health(t)).today).toBe(formatDay(DAY + 1));
    // minuit UTC passé (2 h à Paris) : toujours le même jour de Paris, le changement a déjà eu lieu
    t.clock.now = (DAY + 1) * 86_400_000 + MIN;
    expect((await health(t)).today).toBe(formatDay(DAY + 1));
  });

  it("un envoi à 23 h 59 (Paris) compte pour ce jour ; à 0 h 05, pour la veille (grâce) ; à 0 h 15, la veille est refusée", async () => {
    const t = await makeApi();
    t.clock.now = parisDayStart(DAY + 1) - MIN;
    const evening = await submit(t, DAY, fast.code, 1);
    expect(evening.status).toBe(200);
    expect(evening.body.date ?? formatDay(DAY)).toBe(formatDay(DAY));
    t.clock.now = parisDayStart(DAY + 1) + 5 * MIN;
    const grace = await submit(t, DAY, fast.code, 2); // la course commencée avant minuit, envoyée dans les 10 minutes
    expect(grace.status).toBe(200);
    expect(grace.body.rank).toBe(2);
    t.clock.now = parisDayStart(DAY + 1) + GRACE_MS + MIN; // 0 h 11
    const late = await submit(t, DAY, fast.code, 3);
    expect(late.status).toBe(409);
    expect(late.body.error).toBe("day_closed");
    t.clock.now = parisDayStart(DAY + 1) + 15 * MIN; // 0 h 15
    expect((await submit(t, DAY, fast.code, 4)).body.error).toBe("day_closed");
  });

  it("à 22 h 30 UTC (0 h 30 à Paris) la veille est déjà fermée : l'ancienne règle UTC l'aurait laissée ouverte", async () => {
    const t = await makeApi();
    t.clock.now = DAY * 86_400_000 + 22.5 * 3_600_000;
    expect((await submit(t, DAY, fast.code)).body.error).toBe("day_closed");
  });

  it("le jour qui vient n'existe pas encore : 404 jusqu'à minuit de Paris, puis le circuit est généré à la demande", async () => {
    const t = await makeApi();
    t.clock.now = parisDayStart(DAY + 1) - MIN;
    expect((await t.call("GET", `/api/day/${formatDay(DAY + 1)}`)).status).toBe(404);
    expect((await t.call("GET", `/api/day/${formatDay(DAY + 1)}/leaderboard`)).status).toBe(404);
    t.clock.now = parisDayStart(DAY + 1) + MIN;
    expect((await t.call("GET", `/api/day/${formatDay(DAY + 1)}`)).status).toBe(200);
  });

  it("le classement du jour est celui de la date de Paris : un temps de 21 h 59 UTC et un de 22 h 01 UTC vont dans deux jours différents", async () => {
    const t = await makeApi();
    t.clock.now = parisDayStart(DAY + 1) - MIN;
    await submit(t, DAY, fast.code, 1);
    expect((await t.call("GET", `/api/day/${formatDay(DAY)}/leaderboard`)).body.participants).toBe(1);
    t.clock.now = parisDayStart(DAY + 1) + MIN;
    const next = daysFromCivil(2026, 10, 15);
    expect(next).toBe(DAY + 1);
    expect((await t.call("GET", `/api/day/${formatDay(DAY + 1)}/leaderboard`)).body.participants).toBe(0);
  });
});

describe("jour de Paris — changements d'heure", () => {
  const OCT_25 = daysFromCivil(2026, 10, 25);
  const OCT_26 = OCT_25 + 1;

  it("le dimanche 25/10/2026 dure 25 h : le 25 commence à 22 h UTC le 24 et finit à 23 h UTC le 25", async () => {
    const t = await makeApi({ seed: false });
    t.clock.now = Date.UTC(2026, 9, 24, 21, 59);
    expect((await health(t)).today).toBe("2026-10-24");
    t.clock.now = Date.UTC(2026, 9, 24, 22, 1);
    expect((await health(t)).today).toBe("2026-10-25");
    // 1 h 30 UTC le 25 = 2 h 30 à Paris, heure d'hiver : toujours le 25 ; 22 h 59 UTC = 23 h 59 : toujours le 25
    t.clock.now = Date.UTC(2026, 9, 25, 1, 30);
    expect((await health(t)).today).toBe("2026-10-25");
    t.clock.now = Date.UTC(2026, 9, 25, 22, 59);
    expect((await health(t)).today).toBe("2026-10-25");
    t.clock.now = Date.UTC(2026, 9, 25, 23, 1);
    expect((await health(t)).today).toBe("2026-10-26");
    expect(parisDayStart(OCT_26) - parisDayStart(OCT_25)).toBe(25 * 3_600_000);
  });

  it("grâce de 10 minutes après minuit de Paris le 26/10 (23 h UTC, heure d'hiver)", async () => {
    const t = await makeApi({ seed: false });
    const code = pilotReplay(OCT_25, 1).code;
    t.clock.now = Date.UTC(2026, 9, 25, 23, 5); // 0 h 05 à Paris le 26 : le 25 est encore ouvert
    expect((await submit(t, OCT_25, code, 1)).status).toBe(200);
    t.clock.now = Date.UTC(2026, 9, 25, 23, 15); // 0 h 15 : fermé
    expect((await submit(t, OCT_25, code, 2)).body.error).toBe("day_closed");
  }, 60_000);

  it("le 28/03/2027 (passage à l'heure d'été) dure 23 h : le 28 commence à 23 h UTC le 27 et le 29 à 22 h UTC le 28", async () => {
    const t = await makeApi({ seed: false });
    t.clock.now = Date.UTC(2027, 2, 27, 22, 59);
    expect((await health(t)).today).toBe("2027-03-27");
    t.clock.now = Date.UTC(2027, 2, 27, 23, 1);
    expect((await health(t)).today).toBe("2027-03-28");
    t.clock.now = Date.UTC(2027, 2, 28, 21, 59);
    expect((await health(t)).today).toBe("2027-03-28");
    t.clock.now = Date.UTC(2027, 2, 28, 22, 1);
    expect((await health(t)).today).toBe("2027-03-29");
  });

  it("deux joueurs de fuseaux différents (Delhi, New York) envoient au même instant et sont classés dans le même jour", async () => {
    const t = await makeApi();
    t.clock.now = NOON; // 14 h à Paris, 17 h 30 à Delhi, 8 h à New York : le même jour partout ici…
    expect(parisDay(t.clock.now)).toBe(DAY);
    t.clock.now = parisDayStart(DAY + 1) - 30 * MIN; // 23 h 30 à Paris : 3 h le lendemain à Delhi, 17 h 30 à New York
    const delhi = await submit(t, DAY, fast.code, 1);
    const newYork = await submit(t, DAY, fast.code, 2);
    expect([delhi.status, newYork.status]).toEqual([200, 200]);
    expect((await t.call("GET", `/api/day/${formatDay(DAY)}/leaderboard`)).body.participants).toBe(2);
    expect(circuitOf(DAY).day).toBe(DAY);
  });
});
