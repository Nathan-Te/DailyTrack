import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, jumpMedalsFor } from "@cdj/jump-sim";
import { NAME_KEY, PLAYER_KEY, createIdentity, type ApiResult, type KeyValueStore, type NameCheck } from "@cdj/profile";
import { DEMO_TODAY, DemoRankSource, demoBoard, type DemoDay } from "../src/demoRank";
import { ordinal, rankApiBase, rankText, type JumpBoard, type JumpSubmitResult, type RankEntry, type RankSource } from "../src/rankApi";
import { GRACE_MS, QUEUE_KEY, RANKS_KEY, RETRY_MS, RankQueue, backoff } from "../src/rankQueue";
import { Ranking, mayRank } from "../src/ranking";
import { arrivalRankView, homeRankText } from "../src/rankView";
import { shareLine, shareText } from "../src/share";
import type { KeyValue } from "../src/memory";
import "./francais";

// Lot P1 (plateforme) : le classement côté jeu. La file hors ligne (en attente, reprise, purge, un seul envoi par jour), ce qui part et ce qui
// ne part jamais, le premier pseudo, la ligne à partager avec et sans rang, l'écran d'arrivée et l'accueil, la démonstration.

class MemStore implements KeyValue, KeyValueStore {
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

const DAY = daysFromCivil(2026, 10, 20);
const DATE = formatDay(DAY);
const ID = `jour-${DATE}-g${JUMP_GENERATOR_VERSION}`;
const entry = (ticks: number, replay = `r${ticks}`, date = DATE): RankEntry => ({ date, levelId: `jour-${date}-g${JUMP_GENERATOR_VERSION}`, replay, ticks, deaths: 1 });

describe("file d'envois hors ligne (RankQueue)", () => {
  it("un seul envoi en attente par jour, le meilleur ; jamais moins bon que le dernier temps classé", () => {
    const clock = { now: 1000 };
    const q = new RankQueue(new MemStore(), () => clock.now);
    expect(q.offer(entry(5000))).toBe(true);
    expect(q.offer(entry(5200))).toBe(false); // plus lent : l'attente ne bouge pas
    expect(q.offer(entry(5000, "autre"))).toBe(false); // égal : non plus
    expect(q.offer(entry(4800))).toBe(true);
    expect(q.pending).toHaveLength(1);
    expect(q.pendingFor(DATE)).toMatchObject({ ticks: 4800, tries: 0, nextAt: 1000 });
    q.confirm(entry(4800), { date: DATE, levelId: ID, ticks: 4800, rank: 3, participants: 10, medal: null });
    expect(q.pending).toHaveLength(0);
    expect(q.offer(entry(4900))).toBe(false); // moins bon que le classé
    expect(q.offer(entry(4800))).toBe(false);
    expect(q.offer(entry(4700))).toBe(true);
  });

  it("un échec repousse le prochain essai, avec un délai qui s'allonge ; le retour du réseau le relance tout de suite", () => {
    const clock = { now: 0 };
    const q = new RankQueue(new MemStore(), () => clock.now);
    q.offer(entry(5000));
    expect(q.due()?.ticks).toBe(5000);
    q.failed(DATE);
    expect(q.due()).toBeNull();
    expect(q.nextAt()).toBe(RETRY_MS[0]);
    clock.now = RETRY_MS[0]!;
    expect(q.due()).not.toBeNull();
    for (let i = 0; i < 10; i++) q.failed(DATE);
    expect(q.pendingFor(DATE)!.tries).toBe(11);
    expect(q.nextAt()).toBe(clock.now + RETRY_MS.at(-1)!);
    expect([backoff(1), backoff(2), backoff(3), backoff(99)]).toEqual([RETRY_MS[0], RETRY_MS[1], RETRY_MS[2], RETRY_MS.at(-1)]);
    expect(RETRY_MS.every((d, i) => i === 0 || d > RETRY_MS[i - 1]!)).toBe(true);
    q.retryNow();
    expect(q.due()?.ticks).toBe(5000);
  });

  it("un essai plus rapide arrivé pendant l'envoi reste en attente après la réponse", () => {
    const q = new RankQueue(new MemStore(), () => 0);
    q.offer(entry(5000));
    const sent = q.due()!;
    q.offer(entry(4500)); // pendant l'envoi
    q.confirm(sent, { date: DATE, levelId: ID, ticks: 5000, rank: 4, participants: 9, medal: null });
    expect(q.pendingFor(DATE)?.ticks).toBe(4500);
    expect(q.known(DATE)?.rank).toBe(4);
  });

  it("purge : hier reste pendant la grâce (10 min après minuit de Paris), puis tout jour fini est oublié", () => {
    const store = new MemStore();
    const q = new RankQueue(store, () => 0);
    q.offer(entry(5000, "a", formatDay(DAY - 2)));
    q.offer(entry(5000, "b", formatDay(DAY - 1)));
    q.offer(entry(5000, "c", DATE));
    q.confirm(entry(5000, "c", DATE), { date: DATE, levelId: ID, ticks: 5000, rank: 1, participants: 1, medal: null });
    expect(q.purge(DAY, GRACE_MS - 1)).toBe(1);
    expect(q.pending.map((p) => p.date)).toEqual([formatDay(DAY - 1)]);
    expect(q.purge(DAY, GRACE_MS)).toBe(1);
    expect(q.pending).toEqual([]);
    expect(q.known(DATE)?.rank).toBe(1);
    expect(q.purge(DAY + 1, GRACE_MS)).toBe(1);
    expect(q.known(DATE)).toBeNull();
  });

  it("survit à un rechargement (stockage du jeu) ; sans stockage, vit le temps de la page ; un stockage abîmé ne casse rien", () => {
    const store = new MemStore();
    new RankQueue(store, () => 0).offer(entry(5000));
    expect(new RankQueue(store, () => 0).pendingFor(DATE)?.ticks).toBe(5000);
    expect([...store.data.keys()].sort()).toEqual([RANKS_KEY, QUEUE_KEY].sort());
    expect(QUEUE_KEY).toBe("jump:classement:attente");
    const none = new RankQueue(null, () => 0);
    expect(none.offer(entry(5000))).toBe(true);
    expect(none.pending).toHaveLength(1);
    store.setItem(QUEUE_KEY, "{pas du json");
    store.setItem(RANKS_KEY, JSON.stringify({ [DATE]: { rank: "x" }, nimporte: 1 }));
    const broken = new RankQueue(store, () => 0);
    expect(broken.pending).toEqual([]);
    expect(broken.known(DATE)).toBeNull();
  });
});

describe("ce qui part au classement, et ce qui ne part jamais", () => {
  const base = { mode: "jour" as const, levelDay: DAY, today: DAY, watching: false, tuned: false, trial: false, carnageDemo: false };
  it("le niveau du jour joué le jour même, et lui seul", () => {
    expect(mayRank(base)).toBe(true);
    expect(mayRank({ ...base, mode: "archive", levelDay: DAY - 1 })).toBe(false); // archive
    expect(mayRank({ ...base, mode: "essai", trial: true })).toBe(false); // thème forcé
    expect(mayRank({ ...base, trial: true })).toBe(false);
    expect(mayRank({ ...base, tuned: true })).toBe(false); // réglages modifiés
    expect(mayRank({ ...base, watching: true })).toBe(false); // lecture, solution de l'auteur
    expect(mayRank({ ...base, carnageDemo: true })).toBe(false);
    expect(mayRank({ ...base, mode: "futur", levelDay: DAY + 1 })).toBe(false); // aperçu d'un jour à venir
    expect(mayRank({ ...base, mode: null })).toBe(false); // morceau, scénario
    expect(mayRank({ ...base, today: DAY + 1 })).toBe(false); // la page est restée ouverte après minuit
  });
});

/** Un faux serveur : il répond ce qu'on lui dit, et note ce qu'on lui envoie. */
class FakeSource implements RankSource {
  sent: { playerId: string; name: string | null; entry: RankEntry }[] = [];
  boards: (string | null)[] = [];
  reply: (n: number) => ApiResult<JumpSubmitResult> = (n) => ({ ok: true, data: { accepted: true, date: DATE, levelId: ID, ticks: 5000, deaths: 1, improved: true, bestTicks: 5000, bestDeaths: 1, medal: null, rank: n, participants: 12 } });
  taken = new Set<string>();
  async submit(playerId: string, name: string | null, e: RankEntry, versions: { simVersion: number; generatorVersion: number }) {
    expect(versions).toEqual({ simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION });
    this.sent.push({ playerId, name, entry: e });
    return this.reply(this.sent.length);
  }
  async board(date: string, playerId: string | null): Promise<ApiResult<JumpBoard>> {
    this.boards.push(playerId);
    return { ok: true, data: { date, open: true, participants: 12, levelId: ID, top: [], me: playerId && this.sent.length ? { rank: 2, name: "Moi", ticks: 5000, deaths: 1, medal: null } : null } };
  }
  async checkName(name: string): Promise<ApiResult<NameCheck>> {
    return { ok: true, data: this.taken.has(name) ? { available: false, suggestions: [`${name}2`] } : { available: true } };
  }
  async me() {
    return { ok: false as const, status: 404, code: "unknown_player", message: "" };
  }
  async rename(_p: string, name: string) {
    return { ok: true as const, data: { name } };
  }
  async rotateCode() {
    return { ok: false as const, status: 400, code: "x", message: "" };
  }
}

function setup(source: RankSource | null, store = new MemStore()) {
  const clock = { now: 0 };
  const timers: { at: number; fn: () => void }[] = [];
  const ranking = new Ranking({
    source,
    queue: new RankQueue(store, () => clock.now),
    identity: createIdentity(() => store),
    identityStore: () => store,
    today: () => DAY,
    sinceMidnight: () => 12 * 3_600_000,
    setTimer: (fn, ms) => {
      const t = { at: clock.now + ms, fn };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => void timers.splice(timers.indexOf(h as never), 1),
    now: () => clock.now,
  });
  return { ranking, store, clock, timers };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("Ranking : envoi, reprise, pseudo", () => {
  it("sans serveur : rien n'est envoyé ni lu, aucun identifiant créé", async () => {
    const { ranking, store } = setup(null);
    ranking.offer(entry(5000));
    await ranking.flush();
    await ranking.loadBoard(DATE);
    expect(ranking.state.status).toBe("off");
    expect(store.getItem(PLAYER_KEY)).toBeNull();
    expect(store.data.size).toBe(0);
  });

  it("une identité créée par DailyTrack est réutilisée telle quelle (même identifiant, même pseudo) ; rang connu après la réponse", async () => {
    const src = new FakeSource();
    const store = new MemStore();
    store.setItem(PLAYER_KEY, "a".repeat(32));
    store.setItem(NAME_KEY, "Pilote");
    const { ranking } = setup(src, store);
    ranking.offer(entry(5000));
    await ranking.flush();
    await settle();
    expect(src.sent).toMatchObject([{ playerId: "a".repeat(32), name: "Pilote", entry: entry(5000) }]);
    expect(ranking.state.status).toBe("ranked");
    expect(ranking.known(DATE)).toMatchObject({ ticks: 5000, rank: 2, participants: 12 }); // le classement relu a mis le rang à jour
    expect(ranking.shareRank(DATE, 5000)).toEqual({ rank: 2, participants: 12 });
    expect(ranking.shareRank(DATE, 4900)).toBeNull(); // un autre temps n'a pas de rang
  });

  it("premier envoi : sans pseudo l'envoi attend ; le pseudo choisi (vérifié par le serveur) part avec lui ; pris → suggestions", async () => {
    const src = new FakeSource();
    src.taken.add("Nowy");
    const { ranking, store } = setup(src);
    ranking.offer(entry(5000));
    await ranking.flush();
    expect(ranking.state.status).toBe("name");
    expect(src.sent).toHaveLength(0);
    expect(store.getItem(PLAYER_KEY)).toBeNull(); // rien n'est créé tant que rien ne part
    const taken = await ranking.chooseName("Nowy");
    expect(taken.ok).toBe(false);
    expect(ranking.state).toMatchObject({ status: "name", suggestions: ["Nowy2"] });
    expect(src.sent).toHaveLength(0);
    expect((await ranking.chooseName("  ")).ok).toBe(false);
    const ok = await ranking.chooseName("Nowy2");
    expect(ok.ok).toBe(true);
    expect(src.sent).toHaveLength(1);
    expect(src.sent[0]!.name).toBe("Nowy2");
    expect(store.getItem(NAME_KEY)).toBe("Nowy2"); // le pseudo de la plateforme (DailyTrack le verra aussi)
    expect(src.sent[0]!.playerId).toBe(store.getItem(PLAYER_KEY));
    expect(ranking.state.status).toBe("ranked");
  });

  it("le serveur refuse le pseudo à l'envoi (pris par un autre) : l'envoi reste en attente, avec les suggestions", async () => {
    const src = new FakeSource();
    src.reply = () => ({ ok: false, status: 409, code: "name_taken", message: "Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.", suggestions: ["Zoé2"] });
    const store = new MemStore();
    store.setItem(NAME_KEY, "Zoé");
    const { ranking } = setup(src, store);
    ranking.offer(entry(5000));
    await ranking.flush();
    expect(ranking.state).toMatchObject({ status: "name", suggestions: ["Zoé2"] });
    expect(ranking.pendingFor(DATE)).not.toBeNull();
  });

  it("serveur injoignable : en attente, nouvel essai plus tard (minuterie), puis tout de suite au retour du réseau", async () => {
    const src = new FakeSource();
    let up = false;
    src.reply = (n) => (up ? new FakeSource().reply(n) : { ok: false, status: 0, code: "network", message: "Classement injoignable" });
    const store = new MemStore();
    store.setItem(NAME_KEY, "Moi");
    const { ranking, clock, timers } = setup(src, store);
    ranking.offer(entry(5000));
    await ranking.flush();
    // Lot I5 : l'état porte un code (le texte vient du catalogue à l'affichage, rankView.ts).
    expect(ranking.state).toMatchObject({ status: "offline", code: "reseau" });
    expect(ranking.pendingFor(DATE)).toMatchObject({ tries: 1 });
    expect(timers.map((t) => t.at)).toEqual([RETRY_MS[0]]);
    // La minuterie : nouvel échec, délai plus long.
    clock.now = timers[0]!.at;
    timers.shift()!.fn();
    await settle();
    await ranking.flush();
    expect(ranking.pendingFor(DATE)).toMatchObject({ tries: 2 });
    expect(timers.at(-1)!.at).toBe(clock.now + RETRY_MS[1]!);
    // Le réseau revient : l'envoi part tout de suite, sans attendre la minuterie.
    up = true;
    ranking.wake();
    await ranking.flush();
    await settle();
    expect(ranking.state.status).toBe("ranked");
    expect(ranking.pendingFor(DATE)).toBeNull();
    expect(src.sent).toHaveLength(3);
  });

  it("une autre version : « Une nouvelle version du jeu est disponible », l'envoi est oublié ; un refus définitif aussi", async () => {
    const src = new FakeSource();
    src.reply = () => ({ ok: false, status: 409, code: "version", message: "Une nouvelle version du jeu est disponible : recharge la page" });
    const store = new MemStore();
    store.setItem(NAME_KEY, "Moi");
    const { ranking } = setup(src, store);
    ranking.offer(entry(5000));
    await ranking.flush();
    expect(ranking.state.status).toBe("version");
    expect(ranking.state.code).toBe("version");
    expect(ranking.pendingFor(DATE)).toBeNull();
    src.reply = () => ({ ok: false, status: 409, code: "day_closed", message: "Le classement de ce jour est figé" });
    ranking.offer(entry(4000));
    await ranking.flush();
    // Le `message` du serveur n'est plus lu : son code, traduit par le catalogue commun (`erreur.day_closed`).
    expect(ranking.state).toMatchObject({ status: "refused", code: "day_closed" });
    expect(ranking.pendingFor(DATE)).toBeNull();
  });

  it("lire un classement ne crée jamais d'identifiant (ta ligne seulement si tu en as un)", async () => {
    const src = new FakeSource();
    const { ranking, store } = setup(src);
    await ranking.loadBoard(DATE);
    expect(src.boards).toEqual([null]);
    expect(store.getItem(PLAYER_KEY)).toBeNull();
  });
});

describe("ligne à partager", () => {
  const r = { number: 12, date: "2026-10-27", ticks: Math.round(31.402 * 120), medal: "gold" as const, deaths: 47, kind: "jour" as const };
  it("avec le rang : il s'ajoute à la fin ; sans rang (hors ligne, pas encore envoyé) : la ligne d'avant", () => {
    expect(shareLine({ ...r, ticks: 3768 })).toBe("Du Jour · Jump #12 — 31,400\u00a0s — 🥇 — 47 💀");
    expect(shareLine({ ...r, ticks: 3768, rank: { rank: 3, participants: 128 } })).toBe("Du Jour · Jump #12 — 31,400\u00a0s — 🥇 — 47 💀 — 3e/128");
    expect(shareLine({ ...r, ticks: 3768, rank: { rank: 1, participants: 5 } })).toBe("Du Jour · Jump #12 — 31,400\u00a0s — 🥇 — 47 💀 — 1er/5");
    expect(shareLine({ ...r, ticks: 3768, rank: null })).toBe("Du Jour · Jump #12 — 31,400\u00a0s — 🥇 — 47 💀");
    // Une archive n'a jamais de rang dans sa ligne.
    expect(shareLine({ ...r, ticks: 3768, kind: "archive", rank: { rank: 3, participants: 128 } })).toBe("Du Jour · Jump #12 (archive) — 31,400\u00a0s — 🥇 — 47 💀");
    expect(shareText({ ...r, ticks: 3768, rank: { rank: 3, participants: 128 } }, { origin: "https://x.test", pathname: "/jump/" })).toBe("Du Jour · Jump #12 — 31,400\u00a0s — 🥇 — 47 💀 — 3e/128\nhttps://x.test/jump/");
  });
  it("rangs en français (lot I5 : le format du socle, `1er`, `3e`)", () => {
    expect([ordinal(1), ordinal(2), ordinal(128)]).toEqual(["1er", "2e", "128e"]);
    expect(rankText(3, 128)).toBe("3e sur 128");
  });
});

describe("écran d'arrivée et accueil", () => {
  const state = (status: string, code = "", suggestions: string[] = []) => ({ status, code, suggestions }) as never;
  const board: JumpBoard = {
    date: DATE,
    open: true,
    participants: 12,
    levelId: ID,
    top: Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, name: `J${i + 1}`, ticks: 4000 + i, deaths: i, medal: i === 0 ? "author" : null })),
    me: { rank: 12, name: "Moi", ticks: 6000, deaths: 3, medal: null },
  };
  const input = { enabled: true, mode: "jour" as const, date: DATE, state: state("ranked"), pending: false, known: null, board: { status: "ok" as const, board, code: "" } };
  it("rang « 12ᵉ sur 12 », top 10 et ta ligne ajoutée en dessous, mise en valeur", () => {
    const v = arrivalRankView(input);
    expect(v).toMatchObject({ shown: true, status: "12e sur 12", tone: "ok", gap: true, askName: false, reload: false });
    expect(v.rows).toHaveLength(11);
    expect(v.rows.at(-1)).toMatchObject({ rank: "12", name: "Moi", mine: true, deaths: "3 morts", medal: null });
    expect(v.rows[0]).toMatchObject({ medal: "author", deaths: "0 mort" });
    expect(v.rows.filter((r) => r.mine)).toHaveLength(1);
    const inTop = arrivalRankView({ ...input, board: { status: "ok", board: { ...board, me: board.top[2]! }, code: "" } });
    expect(inTop.rows).toHaveLength(10);
    expect(inTop.rows[2]!.mine).toBe(true);
    expect(inTop.status).toBe("3e sur 12");
  });
  it("états clairs : envoi, injoignable, nouvelle version, pseudo à choisir ; sans serveur, rien", () => {
    expect(arrivalRankView({ ...input, pending: true, state: state("sending"), board: null }).status).toBe("Envoi au classement…");
    expect(arrivalRankView({ ...input, pending: true, state: state("offline", "reseau"), board: null })).toMatchObject({ status: "Classement indisponible, ton temps sera envoyé.", tone: "warn" });
    expect(arrivalRankView({ ...input, pending: true, state: state("offline", "trop_envois"), board: null }).status).toBe("Trop d'envois : nouvel essai dans un moment.");
    expect(arrivalRankView({ ...input, state: state("version") })).toMatchObject({ status: "Une nouvelle version du jeu est disponible", reload: true });
    // Le pseudo refusé : le texte du code d'erreur (catalogue commun), pas le message du serveur.
    expect(arrivalRankView({ ...input, pending: true, state: state("name", "name_taken", ["A2"]) })).toMatchObject({ askName: true, nameMessage: "Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.", suggestions: ["A2"] });
    expect(arrivalRankView({ ...input, state: state("refused", "day_closed") }).status).toBe("Ce jour est terminé : son classement est figé.");
    expect(arrivalRankView({ ...input, enabled: false }).shown).toBe(false);
    expect(arrivalRankView({ ...input, mode: "essai" }).shown).toBe(false);
  });
  it("archive : le classement figé et ton rang si tu l'avais joué", () => {
    expect(arrivalRankView({ ...input, mode: "archive", date: "2026-10-18" })).toMatchObject({ title: "Classement figé du dim. 18 oct.", status: "Ton rang ce jour-là : 12e sur 12" });
    expect(arrivalRankView({ ...input, mode: "archive", board: { status: "ok", board: { ...board, me: null }, code: "" } }).status).toBe("12 classés · tu n'as pas été classé ce jour-là");
    expect(arrivalRankView({ ...input, mode: "archive", board: { status: "offline", board: null, code: "reseau" } }).status).toBe("Classement indisponible");
  });
  it("accueil : ton rang du jour si tu as un temps classé", () => {
    expect(homeRankText(true, { date: DATE, levelId: ID, ticks: 1, rank: 3, participants: 128, medal: null })).toBe("Ton rang du jour : 3e sur 128");
    expect(homeRankText(true, null)).toBe("");
    expect(homeRankText(false, { date: DATE, levelId: ID, ticks: 1, rank: 3, participants: 128, medal: null })).toBe("");
  });
  it("adresse : ?api= d'abord, sinon celle de la construction, sinon pas de classement", () => {
    expect(rankApiBase(null, undefined)).toBeNull();
    expect(rankApiBase(null, "https://recette.test/")).toBe("https://recette.test");
    // Lot R4 : « / » = le serveur de la même origine ; sans origine connue, pas de classement.
    expect(rankApiBase(null, "/", "https://playdujour.com")).toBe("https://playdujour.com");
    expect(rankApiBase("/", "https://ailleurs.test", "https://recette.playdujour.com/")).toBe("https://recette.playdujour.com");
    expect(rankApiBase(null, "/")).toBeNull();
    expect(rankApiBase("demo", "https://recette.test")).toBe("demo");
    // Lot R7 : en production (restricted), ?api= ne peut pas mener l'identifiant secret vers un autre serveur ; le serveur de la construction prime
    expect(rankApiBase("https://pirate.example", "/", "https://playdujour.com", true)).toBe("https://playdujour.com");
    expect(rankApiBase("https://pirate.example", undefined, "https://playdujour.com", true)).toBeNull();
    expect(rankApiBase("/", undefined, "https://playdujour.com", true)).toBe("https://playdujour.com");
    expect(rankApiBase("demo", undefined, "https://playdujour.com", true)).toBe("demo");
    expect(rankApiBase("http://localhost:8787", undefined, "https://playdujour.com", true)).toBe("http://localhost:8787");
    expect(rankApiBase("https://pirate.example", "/", "https://recette.playdujour.com", false)).toBe("https://pirate.example");
  });
});

describe("démonstration (?api=demo)", () => {
  const index = JSON.parse(readFileSync(new URL("../public/demo/index.json", import.meta.url), "utf8")) as { simVersion: number; generatorVersion: number; demoToday: string };
  const today = JSON.parse(readFileSync(new URL(`../public/demo/${index.demoToday}.json`, import.meta.url), "utf8")) as DemoDay;

  it("le jeu de données est celui de ces versions et de cet « aujourd'hui » (sinon : relancer npm run jump:seed -w @cdj/api)", () => {
    expect([index.simVersion, index.generatorVersion], "relancer jump:seed").toEqual([JUMP_SIM_VERSION, JUMP_GENERATOR_VERSION]);
    expect(index.demoToday).toBe(formatDay(DEMO_TODAY));
    expect(today.rows!.length).toBe(today.participants);
  });

  it("ton essai est classé parmi les joueurs fictifs (à temps égal, ils passent devant : ils ont envoyé avant)", () => {
    const first = today.rows![0]!;
    const v = demoBoard(today, { date: today.date, levelId: today.levelId, name: "Moi", ticks: first.ticks, deaths: 0 });
    expect(v.participants).toBe(today.participants + 1);
    expect(v.me).toMatchObject({ rank: 2, name: "Moi" });
    const last = demoBoard(today, { date: today.date, levelId: today.levelId, name: "Moi", ticks: 999_999, deaths: 9 });
    expect(last.me!.rank).toBe(today.participants + 1);
    expect(last.top).toHaveLength(Math.min(10, today.participants + 1));
    const best = demoBoard(today, { date: today.date, levelId: today.levelId, name: "Moi", ticks: 1, deaths: 0 });
    expect(best.me!.rank).toBe(1);
    expect(best.top[0]!.medal).toBe("author");
  });

  it("la source de démonstration : envoi, pseudo de démo refusé, version, autre jour, et « injoignable » sans réseau", async () => {
    const files = new Map<string, unknown>([
      ["demo/index.json", index],
      [`demo/${today.date}.json`, today],
    ]);
    let online = true;
    const fetchImpl = async (url: string) => {
      if (!online) throw new TypeError("Failed to fetch");
      const body = files.get(url);
      return new Response(body ? JSON.stringify(body) : "{}", { status: body ? 200 : 404 });
    };
    const store = new MemStore();
    const src = new DemoRankSource("demo/", store, fetchImpl);
    const versions = { simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION };
    const e: RankEntry = { date: today.date, levelId: today.levelId, replay: "x", ticks: 999_999, deaths: 2 };
    expect(await src.submit("p", null, e, versions)).toMatchObject({ ok: false, code: "name_required" });
    expect(await src.submit("p", "Démo Renard", e, versions)).toMatchObject({ ok: false, code: "name_taken" });
    expect((await src.checkName("demo renard")).ok && (await src.checkName("demo renard"))).toMatchObject({ data: { available: false } });
    expect(await src.submit("p", "Moi", e, { ...versions, generatorVersion: 0 })).toMatchObject({ ok: false, code: "version" });
    expect(await src.submit("p", "Moi", { ...e, date: "2026-10-20" }, versions)).toMatchObject({ ok: false, code: "day_closed" });
    const ok = await src.submit("p", "Moi", e, versions);
    expect(ok).toMatchObject({ ok: true, data: { rank: today.participants + 1, participants: today.participants + 1, improved: true } });
    const board = await src.board(today.date, "p");
    expect(board).toMatchObject({ ok: true, data: { me: { name: "Moi", rank: today.participants + 1 }, open: true } });
    online = false;
    expect(await src.submit("p", "Moi", e, versions)).toMatchObject({ ok: false, status: 0 });
    // Les médailles sont celles de `jumpMedalsFor(auteur)`, ajustées par les voies lentes du niveau (lot 16 : l'or ne dépasse jamais la voie rapide, le bronze couvre toutes les voies lentes) :
    // l'auteur et l'argent sont ceux de la formule, l'or ne la dépasse pas, le bronze n'est pas en dessous.
    const plain = jumpMedalsFor(today.medals.author, 11); // les jours de démonstration sont d'une version d'avant le lot G1 (Diamant = temps de l'auteur)
    expect(today.medals.author).toBe(plain.author);
    expect(today.medals.silver).toBe(plain.silver);
    expect(today.medals.gold).toBeLessThanOrEqual(plain.gold);
    expect(today.medals.bronze).toBeGreaterThanOrEqual(plain.bronze);
  });
});
