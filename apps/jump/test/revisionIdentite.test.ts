import { describe, expect, it } from "vitest";
import { IDENTITY_CODE_REV_KEY, NAME_KEY, PLAYER_KEY, identityRevisionSeen, noteIdentityChange, readIdentityRevision, writeIdentity } from "@cdj/profile";
import { History, readHistory, type DayRecord } from "../src/history";
import { JUMP_SEEN_IDENTITY_KEY, applyJumpIdentity, followJumpIdentity } from "../src/jumpProfile";
import { RANKS_KEY } from "../src/rankQueue";

// Lot P4 (plateforme) : le compteur de révision d'identité de la plateforme, côté DailyJump. Charger un code ici l'avance (DailyTrack videra
// son cache de l'ancienne identité à son prochain démarrage) ; au démarrage, un code chargé dans DailyTrack depuis la dernière visite fait
// oublier les rangs connus et les jours passés de l'ancienne identité (comme un code chargé ici). Sans changement : rien.

const date = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
const rec = (d: number, best: number | null): DayRecord => ({ id: `jour-${date(d)}-g9`, date: date(d), best, medal: best === null ? null : "bronze", deaths: 30, attempts: 4 });

class Mem {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}

/** Un appareil où DailyJump a déjà tourné depuis le lot P4 : historique de deux jours, rangs connus. */
function device(): Mem {
  const store = new Mem();
  store.setItem(PLAYER_KEY, "1".repeat(32));
  store.setItem(NAME_KEY, "Ancien");
  store.setItem(RANKS_KEY, "{}");
  const history = new History(store);
  history.put(rec(19, 3700));
  history.put(rec(20, 3300));
  expect(followJumpIdentity(store, history.entries, date(20))).toBe(false); // première visite : rien
  return store;
}

describe("DailyJump et la révision d'identité de la plateforme (lot P4)", () => {
  it("charger un code ici avance la révision (un code) et la note comme vue : DailyTrack le verra, DailyJump ne revide rien", () => {
    const store = device();
    expect(applyJumpIdentity({ id: "2".repeat(32), name: "Nowy" }, store, new History(store).entries, date(20))).toBe(true);
    expect(readIdentityRevision(store)).toEqual({ rev: 1, code: 1 });
    expect(store.getItem(JUMP_SEEN_IDENTITY_KEY)).toBe("1");
    expect(identityRevisionSeen(store, "cdj:identite:vue")).toBe("aucun"); // première visite de DailyTrack depuis le lot P4
    store.setItem(RANKS_KEY, '{"x":1}'); // rempli depuis
    expect(followJumpIdentity(store, new History(store).entries, date(20))).toBe(false);
    expect(store.getItem(RANKS_KEY)).toBe('{"x":1}');
  });

  it("un code chargé dans DailyTrack depuis la dernière visite : rangs et jours passés oubliés, aujourd'hui gardé, une seule fois", () => {
    const store = device();
    writeIdentity({ id: "2".repeat(32), name: "Nowy" }, store); // ce que fait DailyTrack (`applyIdentity`)…
    noteIdentityChange(store, "code", "cdj:identite:vue"); // …puis `noteCodeLoaded`
    expect(store.getItem(IDENTITY_CODE_REV_KEY)).toBe("1");
    expect(followJumpIdentity(store, new History(store).entries, date(20))).toBe(true);
    expect(store.getItem(RANKS_KEY)).toBeNull();
    expect(readHistory(store)).toEqual([rec(20, 3300)]);
    expect(store.getItem(PLAYER_KEY)).toBe("2".repeat(32)); // l'identité n'est pas réécrite : c'est déjà celle du navigateur
    store.setItem(RANKS_KEY, "{}");
    expect(followJumpIdentity(store, new History(store).entries, date(20))).toBe(false);
    expect(store.getItem(RANKS_KEY)).toBe("{}");
  });

  it("sans changement d'identité (ou une rotation, une création ailleurs) : aucun effet", () => {
    const store = device();
    noteIdentityChange(store, "rotation");
    noteIdentityChange(store, "creation");
    expect(followJumpIdentity(store, new History(store).entries, date(20))).toBe(false);
    expect(store.getItem(RANKS_KEY)).toBe("{}");
    expect(readHistory(store)).toHaveLength(2);
  });
});
