import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { NAME_KEY, PLAYER_KEY, ProfileSync, type ApiResult } from "@cdj/profile";
import { HISTORY_KEY, History, readHistory, streakOf, type DayRecord } from "../src/history";
import { applyJumpIdentity, applyJumpProfile, jumpStats, mergeJumpHistory, type JumpMe, type JumpMeDay } from "../src/jumpProfile";
import { RANKS_KEY, RankQueue } from "../src/rankQueue";
import { cheminDuJeu, profilHref } from "../src/profilLien";
import "./francais";

// Lot P2 (plateforme) : le profil DailyJump synchronisé — la fusion « le meilleur gagne » avec l'historique local, les morts locales gardées,
// les jours d'un autre appareil ajoutés, la série recalculée, un envoi en file qui compte comme du local ; un code chargé ; un code révoqué.

const T = daysFromCivil(2026, 10, 20);
const date = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
const rec = (d: number, best: number | null, extra: Partial<DayRecord> = {}): DayRecord => ({ id: `jour-${date(d)}-g9`, date: date(d), best, medal: best === null ? null : "bronze", deaths: 30, attempts: 4, ...extra });
const srv = (d: number, ticks: number, extra: Partial<JumpMeDay> = {}): JumpMeDay => ({ date: date(d), levelId: `jour-${date(d)}-g9`, ticks, deaths: 2, medal: "gold", ...extra });

class Mem {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

describe("fusion de l'historique : le meilleur gagne", () => {
  it("par jour, le temps le plus court l'emporte (avec sa médaille) ; les morts et essais du jour locaux sont gardés", () => {
    const r = mergeJumpHistory([rec(18, 5000), rec(19, 3000)], [srv(18, 4000), srv(19, 3500)]);
    const by = new Map(r.list.map((x) => [x.date, x]));
    expect(by.get(date(18))).toEqual({ id: `jour-${date(18)}-g9`, date: date(18), best: 4000, medal: "gold", deaths: 30, attempts: 4 });
    // Le local est meilleur (fait hors ligne, ou son envoi attend dans la file) : il reste.
    expect(by.get(date(19))).toEqual(rec(19, 3000));
    expect([r.changed, r.added, r.improved]).toEqual([true, 0, 1]);
  });

  it("un jour présent seulement sur le serveur (joué sur un autre appareil) est ajouté : ses morts sont celles de l'essai classé, un essai", () => {
    const r = mergeJumpHistory([rec(19, 3000)], [srv(17, 3600, { deaths: 5, medal: "silver" })]);
    expect(r.list).toContainEqual({ id: `jour-${date(17)}-g9`, date: date(17), best: 3600, medal: "silver", deaths: 5, attempts: 1 });
    expect([r.added, r.improved]).toEqual([1, 0]);
  });

  it("un jour joué sans arrivée en local (meilleur nul) prend le temps du serveur, ses morts locales restent", () => {
    const r = mergeJumpHistory([rec(19, null, { deaths: 12, attempts: 3 })], [srv(19, 3500)]);
    expect(r.list[0]).toEqual({ id: `jour-${date(19)}-g9`, date: date(19), best: 3500, medal: "gold", deaths: 12, attempts: 3 });
  });

  it("rien n'est jamais supprimé ; rien de mal formé n'entre (identifiant, date, temps, médaille, essai de thème forcé)", () => {
    const local = [rec(10, 4000), rec(19, 3000)];
    const r = mergeJumpHistory(local, [
      srv(18, 0),
      srv(18, -5),
      { ...srv(18, 4000), medal: "platine" as never },
      { ...srv(18, 4000), levelId: "n'importe quoi" },
      { ...srv(18, 4000), levelId: `jour-${date(18)}-g9-tusine` },
      { ...srv(18, 4000), date: "demain" },
      { ...srv(18, 4000), levelId: `jour-${date(17)}-g9` },
    ]);
    expect(r.list).toEqual(local);
    expect(r.changed).toBe(false);
  });

  it("la série est calculée sur l'historique fusionné ; un jour dont l'envoi est encore en file compte comme en local", () => {
    // Cet appareil : aujourd'hui (pas encore envoyé : dans la file). L'autre appareil : les deux jours d'avant.
    const store = new Mem();
    const queue = new RankQueue(store, () => 0);
    queue.offer({ date: date(20), levelId: `jour-${date(20)}-g9`, replay: "x", ticks: 3300, deaths: 1 });
    expect(queue.pendingFor(date(20))).not.toBeNull();
    const local = [rec(20, 3300)];
    expect(streakOf(local, T)).toBe(1);
    const r = mergeJumpHistory(local, [srv(18, 3900), srv(19, 3700)]);
    expect(streakOf(r.list, T)).toBe(3);
    expect(r.list.find((x) => x.date === date(20))).toEqual(rec(20, 3300));
    expect(jumpStats(r.list, T)).toEqual({ days: 3, medals: { author: 0, gold: 2, silver: 0, bronze: 1 }, streak: 3 });
  });
});

describe("synchronisation (ProfileSync de @cdj/profile, profil DailyJump)", () => {
  const me = (days: JumpMeDay[], name = "Nowy"): JumpMe => ({ name, renameRequired: false, today: date(20), simVersion: 3, generatorVersion: 9, days, stats: { days: days.length, medals: { author: 0, gold: days.length, silver: 0, bronze: 0 }, streak: 0 } });
  const make = (answer: () => ApiResult<JumpMe>, store: Mem, history: History) =>
    new ProfileSync<ReturnType<typeof applyJumpProfile>, Mem, JumpMe>({
      api: () => ({ me: async () => answer() }),
      playerId: () => "a".repeat(32),
      adopt: () => {},
      storage: store,
      merge: (m, st) => {
        const r = applyJumpProfile(m, st, history.entries);
        if (r.changed) history.replaceAll(r.list);
        return r;
      },
      identity: { pendingNextId: () => null, clearNextId: () => {} },
    });

  it("au chargement : le pseudo du serveur, l'historique fusionné écrit dans jump:historique", async () => {
    const store = new Mem();
    const history = new History(store);
    history.put(rec(20, 3300));
    const sync = make(() => ({ ok: true, data: me([srv(19, 3700)]) }), store, history);
    const out = await sync.run();
    expect(out.status).toBe("ok");
    expect(store.getItem(NAME_KEY)).toBe("Nowy");
    expect(readHistory(store).map((r) => r.date)).toEqual([date(19), date(20)]);
    expect(history.streak(T)).toBe(2);
    expect(sync.state.known).toBe(true);
  });

  it("un code révoqué (410) : état « revoked », rien de perdu en local (historique, pseudo, file)", async () => {
    const store = new Mem();
    store.setItem(NAME_KEY, "Local");
    const history = new History(store);
    history.put(rec(20, 3300));
    const before = store.getItem(HISTORY_KEY);
    const sync = make(() => ({ ok: false, status: 410, code: "code_revoked", message: "Ce code n'est plus valide" }), store, history);
    expect((await sync.run()).status).toBe("revoked");
    expect(sync.state.status).toBe("revoked");
    expect(store.getItem(HISTORY_KEY)).toBe(before);
    expect(store.getItem(NAME_KEY)).toBe("Local");
  });

  it("hors ligne : le cache local sert ; joueur inconnu : « unknown » (jamais classé)", async () => {
    const store = new Mem();
    const history = new History(store);
    expect((await make(() => ({ ok: false, status: 0, code: "network", message: "" }), store, history).run()).status).toBe("offline");
    expect((await make(() => ({ ok: false, status: 404, code: "unknown_player", message: "" }), store, history).run()).status).toBe("unknown");
  });
});

describe("charger un code dans DailyJump", () => {
  it("l'identité de la plateforme est remplacée (cdj:player, cdj:name : DailyTrack la retrouve) ; les rangs et jours passés de l'ancienne identité sont oubliés, aujourd'hui reste", () => {
    const store = new Mem();
    store.setItem(PLAYER_KEY, "1".repeat(32));
    store.setItem(NAME_KEY, "Ancien");
    store.setItem(RANKS_KEY, "{}");
    store.setItem("cdj:player:next", "3".repeat(32));
    const history = new History(store);
    history.put(rec(19, 3700));
    history.put(rec(20, 3300));
    expect(applyJumpIdentity({ id: "2".repeat(32), name: "Nowy" }, store, history.entries, date(20))).toBe(true);
    expect([store.getItem(PLAYER_KEY), store.getItem(NAME_KEY), store.getItem(RANKS_KEY), store.getItem("cdj:player:next")]).toEqual(["2".repeat(32), "Nowy", null, null]);
    expect(readHistory(store)).toEqual([rec(20, 3300)]);
  });
  it("un stockage qui refuse d'écrire : faux, rien n'a changé d'identité", () => {
    const store = new Mem();
    store.setItem(PLAYER_KEY, "1".repeat(32));
    store.setItem = () => {
      throw new Error("plein");
    };
    expect(applyJumpIdentity({ id: "2".repeat(32), name: "Nowy" }, store, [], date(20))).toBe(false);
    expect(store.getItem(PLAYER_KEY)).toBe("1".repeat(32));
  });
});

// Lot I5 : plus de profil dans le jeu (Réglages › Profil et la carte de l'accueil sont retirés) : « Mon profil Du Jour › » mène au profil commun du portail,
// avec le chemin de retour au jeu (le portail n'accepte qu'un chemin du site : apps/portail/src/retour.ts, testé là-bas).
describe("le lien vers le profil commun du portail", () => {
  it("`../profil/?retour=<chemin du jeu>`, sans `index.html`", () => {
    expect(profilHref("/jump/")).toBe("../profil/?retour=%2Fjump%2F");
    expect(profilHref("/jump/index.html")).toBe("../profil/?retour=%2Fjump%2F");
    expect(cheminDuJeu("/index.html")).toBe("/");
  });
});
