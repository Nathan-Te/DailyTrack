import { msUntilNextParisDay, parisDay } from "@cdj/clock";
import { daysFromCivil, formatDay, parseDay } from "@cdj/core";
import { premierJourDuJour } from "@cdj/core/lancement";
import { PREMIER_JOUR_ARCHIVES } from "../src/lancement";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PREMIER_JOUR_JUMP, dailyLevel, jumpMedalsFor, textHash, type DailyLevel } from "@cdj/jump-sim";
import { beforeAll, describe, expect, it } from "vitest";
import { loadDaily, type LoaderOptions } from "../src/dailyLoader";
import { FROZEN_FORMAT, decodeAscii, encodeAscii, freezeLevel, frozenJson, rleRow, thawLevel, unrleRow, type FrozenLevel } from "../src/frozen";
import { HISTORY_KEY, HISTORY_MAX, History, mayRecord, mergeDay, readHistory, streakOf, type DayRecord } from "../src/history";
import { PALIERS_MORTS, archiveDays, archiveRow, archiveStreakText, arrivalLine, countdownText, etatDuJour, helpSeen, homeHeading, homeStatus, markHelpSeen, medalThresholds, palierMorts, recordTile, streakText, wantsHome } from "../src/homeLogic";
import { COMMANDES, HOWTO_POINTS } from "../src/howtoUi";
import { CATALOGUE_JUMP } from "../src/catalogue";
import { setLangue, chargerLangue } from "../src/i18n";
import { DayMemory, type KeyValue } from "../src/memory";
import { shareLine, shareText, shareUrl } from "../src/share";
import { readUrlOptions, archiveHref, dailyHref, homeHref } from "../src/urlOptions";
import "./francais";

// Lot 10 : la ligne à partager, l'historique et la série, l'accueil, le compte à rebours, les niveaux figés. Dates et instants fixes,
// jamais l'heure réelle. Lot I5 : les textes viennent des catalogues (français par défaut ici ; l'anglais est essayé à part) ; les temps du socle ont
// une espace insécable avant l'unité (« 31,400 s ») ; la ligne à partager commence par « Du Jour · Jump #12 » (charte § 2).
const NB = "\u00a0";
beforeAll(async () => {
  await chargerLangue("en");
  await setLangue("fr", { ecrire: false });
});

const day = (d: string) => parseDay(d)!;

class MemStore implements KeyValue {
  readonly map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
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

const BROKEN: KeyValue = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
  key() {
    throw new Error("SecurityError");
  },
  get length(): number {
    throw new Error("SecurityError");
  },
};

const rec = (date: string, best: number | null, extra: Partial<DayRecord> = {}): DayRecord => ({
  id: `jour-${date}-g${JUMP_GENERATOR_VERSION}`,
  date,
  best,
  medal: best === null ? null : "gold",
  deaths: 3,
  attempts: 2,
  ...extra,
});

describe("la ligne à partager", () => {
  it("format du seed : numéro, temps à virgule, médaille, morts", () => {
    expect(shareLine({ number: 12, date: "2026-10-27", ticks: 3768, medal: "gold", deaths: 47, kind: "jour" })).toBe(`Du Jour · Jump #12 — 31,400${NB}s — 🥇 — 47 💀`);
    // 31,402${NB}s : 3 768,24 pas n'existe pas ; le temps affiché est celui du pas (arrondi à la milliseconde).
    expect(shareLine({ number: 12, date: "2026-10-27", ticks: 3769, medal: "gold", deaths: 47, kind: "jour" })).toBe(`Du Jour · Jump #12 — 31,408${NB}s — 🥇 — 47 💀`);
  });

  it("chaque médaille a son icône ; sans médaille, le morceau est omis ; 0 mort s'écrit", () => {
    const base = { number: 5, date: "2026-10-20", ticks: 3000, deaths: 0, kind: "jour" } as const;
    expect(shareLine({ ...base, medal: "author" })).toBe(`Du Jour · Jump #5 — 25,000${NB}s — 🏆 — 0 💀`);
    expect(shareLine({ ...base, medal: "silver" })).toContain("— 🥈 —");
    expect(shareLine({ ...base, medal: "bronze" })).toContain("— 🥉 —");
    expect(shareLine({ ...base, medal: null })).toBe(`Du Jour · Jump #5 — 25,000${NB}s — 0 💀`);
  });

  it("virgule décimale, millisecondes sur trois chiffres", () => {
    expect(shareLine({ number: 1, date: "2026-10-16", ticks: 121, medal: null, deaths: 1, kind: "jour" })).toBe(`Du Jour · Jump #1 — 1,008${NB}s — 1 💀`);
    expect(shareLine({ number: 1, date: "2026-10-16", ticks: 4800, medal: null, deaths: 1, kind: "jour" })).toContain(`40,000${NB}s`);
  });

  it("une archive porte la mention « (archive) » et son lien ?seed= ; avant le premier jour, la date remplace le numéro", () => {
    const r = { number: 3, date: "2026-10-18", ticks: 3600, medal: "gold" as const, deaths: 2, kind: "archive" as const };
    expect(shareLine(r)).toBe(`Du Jour · Jump #3 (archive) — 30,000${NB}s — 🥇 — 2 💀`);
    expect(shareLine({ ...r, kind: "futur" })).toContain("(à venir)");
    expect(shareLine({ ...r, number: 0, date: "2026-10-15", kind: "jour" })).toMatch(/^Du Jour · Jump 2026-10-15 — /);
  });

  it("lot I5 : en anglais, même forme (« Du Jour · Jump #12 »), le temps et le rang au format anglais, mêmes émojis", async () => {
    await setLangue("en", { ecrire: false });
    try {
      expect(shareLine({ number: 12, date: "2026-10-27", ticks: 3768, medal: "gold", deaths: 1284, kind: "jour", rank: { rank: 3, participants: 1280 } })).toBe(`Du Jour · Jump #12 — 31.400${NB}s — 🥇 — 1,284 💀 — 3rd/1,280`);
      expect(shareLine({ number: 3, date: "2026-10-18", ticks: 3600, medal: null, deaths: 2, kind: "archive" })).toBe(`Du Jour · Jump #3 (archive) — 30.000${NB}s — 2 💀`);
    } finally {
      await setLangue("fr", { ecrire: false });
    }
  });

  it("le lien vient de l'adresse courante (aperçu de branche compris), sans aucun paramètre ; ?seed= pour une archive", () => {
    const published = { origin: "https://nathan-te.github.io", pathname: "/DailyTrack/jump/" };
    const preview = { origin: "https://nathan-te.github.io", pathname: "/DailyTrack/b/claude-lot-10/jump/" };
    expect(shareUrl(published, "2026-10-20", "jour")).toBe("https://nathan-te.github.io/DailyTrack/jump/");
    expect(shareUrl(preview, "2026-10-20", "jour")).toBe("https://nathan-te.github.io/DailyTrack/b/claude-lot-10/jump/");
    expect(shareUrl(published, "2026-10-18", "archive")).toBe("https://nathan-te.github.io/DailyTrack/jump/?seed=2026-10-18");
    // Lot R4 : le lien est construit sur l'origine courante (playdujour.com/jump/, la recette, un aperçu…).
    expect(shareUrl({ origin: "https://playdujour.com", pathname: "/jump/" }, "2026-10-20", "jour")).toBe("https://playdujour.com/jump/");
    expect(shareText({ number: 5, date: "2026-10-20", ticks: 3000, medal: "gold", deaths: 4, kind: "jour" }, published)).toBe(`Du Jour · Jump #5 — 25,000${NB}s — 🥇 — 4 💀\nhttps://nathan-te.github.io/DailyTrack/jump/`);
  });
});

describe("historique persistant", () => {
  it("garde chaque jour (meilleur temps, médaille, morts, essais), relu d'une page à l'autre ; une entrée par niveau", () => {
    const store = new MemStore();
    const h = new History(store);
    expect(h.entries).toEqual([]);
    h.put(rec("2026-10-20", null, { deaths: 1, attempts: 1 }));
    h.put(rec("2026-10-20", 3500, { deaths: 4, attempts: 3 }));
    h.put(rec("2026-10-19", 3600));
    const again = new History(store);
    expect(again.entries.map((r) => r.date)).toEqual(["2026-10-19", "2026-10-20"]);
    expect(again.forDate("2026-10-20")).toMatchObject({ best: 3500, deaths: 4, attempts: 3, medal: "gold" });
    expect(again.forDate("2026-10-18")).toBeNull();
    expect(JSON.parse(store.getItem(HISTORY_KEY)!)).toMatchObject({ v: 1 });
  });

  it(`plafond : les ${HISTORY_MAX} jours les plus récents`, () => {
    const store = new MemStore();
    const h = new History(store);
    const first = day("2026-10-16");
    for (let d = first; d < first + HISTORY_MAX + 25; d++) h.put(rec(formatDay(d), 3000 + (d % 7)));
    expect(h.entries).toHaveLength(HISTORY_MAX);
    expect(h.entries[0]!.date).toBe(formatDay(first + 25));
    expect(h.entries[HISTORY_MAX - 1]!.date).toBe(formatDay(first + HISTORY_MAX + 24));
    expect(readHistory(store)).toHaveLength(HISTORY_MAX);
  });

  it("stockage qui lève, absent ou illisible : rien ne casse, l'historique vit le temps de la page", () => {
    const h = new History(BROKEN);
    expect(h.entries).toEqual([]);
    expect(h.put(rec("2026-10-20", 3500))).toBe(false);
    expect(h.forDate("2026-10-20")?.best).toBe(3500);
    expect(h.streak(day("2026-10-20"))).toBe(1);
    const none = new History(null);
    expect(none.put(rec("2026-10-20", 3500))).toBe(false);
    expect(none.entries).toHaveLength(1);
    const garbage = new MemStore();
    garbage.setItem(HISTORY_KEY, "{pas du json");
    expect(readHistory(garbage)).toEqual([]);
    garbage.setItem(HISTORY_KEY, JSON.stringify({ v: 1, jours: [rec("2026-10-20", 3500), { id: "x", date: "2026-02-30", best: 1, medal: null, deaths: 0, attempts: 0 }, rec("2026-10-21", -4), null, rec("2026-10-19", 3600, { medal: "platine" as never })] }));
    expect(readHistory(garbage).map((r) => r.date)).toEqual(["2026-10-20"]);
    garbage.setItem(HISTORY_KEY, JSON.stringify({ v: 2, jours: [rec("2026-10-20", 3500)] }));
    expect(readHistory(garbage)).toEqual([]);
  });

  it("survit à la purge du jour de la mémoire (autre clé, que la mémoire ne balaie pas)", () => {
    const store = new MemStore();
    new History(store).put(rec("2026-10-19", 3600));
    const d = dailyLevel(day("2026-10-20"));
    const mem = new DayMemory({ store, level: d.level, levelId: d.id, today: () => "2026-10-20" });
    mem.purge();
    expect(readHistory(store)).toHaveLength(1);
  });

  it("deux niveaux le même jour (changement de générateur) se réunissent : meilleur temps, morts et essais additionnés", () => {
    const a = rec("2026-10-20", 3600, { id: "jour-2026-10-20-g4", medal: "silver", deaths: 5, attempts: 2 });
    const b = rec("2026-10-20", 3500, { id: "jour-2026-10-20-g5", medal: "gold", deaths: 1, attempts: 1 });
    expect(mergeDay([a, b])).toMatchObject({ best: 3500, medal: "gold", deaths: 6, attempts: 3, id: "jour-2026-10-20-g5" });
    expect(mergeDay([rec("2026-10-20", null)])).toMatchObject({ best: null, medal: null });
    expect(mergeDay([])).toBeNull();
  });
});

describe("la série", () => {
  const list = [rec("2026-10-17", 3600), rec("2026-10-18", 3600), rec("2026-10-19", 3600), rec("2026-10-20", null)];
  it("jours consécutifs avec une arrivée, jusqu'à aujourd'hui ; une entrée sans arrivée ne compte pas", () => {
    expect(streakOf([...list.slice(0, 3), rec("2026-10-20", 3500)], day("2026-10-20"))).toBe(4);
    expect(streakOf(list, day("2026-10-19"))).toBe(3);
  });

  it("aujourd'hui pas encore fini : la série d'hier tient jusqu'à minuit ; un jour manqué la casse", () => {
    expect(streakOf(list, day("2026-10-20"))).toBe(3);
    expect(streakOf(list, day("2026-10-21"))).toBe(0);
    expect(streakOf([], day("2026-10-20"))).toBe(0);
  });

  it("un trou coupe la série", () => {
    const holes = [rec("2026-10-14", 1), rec("2026-10-15", 1), rec("2026-10-17", 1), rec("2026-10-18", 1)];
    expect(streakOf(holes, day("2026-10-18"))).toBe(2);
    expect(streakOf(holes, day("2026-10-15"))).toBe(2);
  });

  it("minuit à Paris : la date du jour vient de parisDay (heure d'été et d'hiver)", () => {
    const h = [rec("2026-10-19", 3600), rec("2026-10-20", 3600)];
    // 23:59 à Paris le 20/10 (UTC+2) : aujourd'hui = le 20, série de 2.
    expect(streakOf(h, parisDay(Date.parse("2026-10-20T21:59:00Z")))).toBe(2);
    // 00:01 à Paris le 21/10 : le 21 n'est pas fini, la série d'hier tient.
    expect(streakOf(h, parisDay(Date.parse("2026-10-20T22:01:00Z")))).toBe(2);
    // Le 22 à Paris : le 21 a été manqué.
    expect(streakOf(h, parisDay(Date.parse("2026-10-21T22:30:00Z")))).toBe(0);
    // Hiver (UTC+1) : 23:30 UTC le 30/11 = 00:30 à Paris le 1/12.
    const w = [rec("2026-11-29", 1), rec("2026-11-30", 1)];
    expect(parisDay(Date.parse("2026-11-30T23:30:00Z"))).toBe(day("2026-12-01"));
    expect(streakOf(w, parisDay(Date.parse("2026-11-30T23:30:00Z")))).toBe(2);
    expect(streakOf(w, parisDay(Date.parse("2026-12-01T23:30:00Z")))).toBe(0);
  });

  it("une archive, un jour à venir, une lecture, des réglages modifiés, un niveau d'hier fini après minuit : rien n'entre", () => {
    const today = day("2026-10-20");
    const base = { mode: "jour" as const, levelDay: today, today, watching: false, tuned: false };
    expect(mayRecord(base)).toBe(true);
    expect(mayRecord({ ...base, mode: "archive", levelDay: today - 2 })).toBe(false);
    expect(mayRecord({ ...base, mode: "futur", levelDay: today + 1 })).toBe(false);
    expect(mayRecord({ ...base, watching: true })).toBe(false);
    expect(mayRecord({ ...base, tuned: true })).toBe(false);
    expect(mayRecord({ ...base, today: today + 1 })).toBe(false); // la page est restée ouverte après minuit
  });

  it("textes de la série (lot I5 : la tuile « Série Jump » de l'accueil)", () => {
    expect(streakText(0)).toBe("0 jour");
    expect(streakText(1)).toBe("1 jour");
    expect(streakText(12)).toBe("12 jours");
    expect(archiveStreakText()).toContain("ne compte pas");
  });
});

describe("compte à rebours jusqu'au prochain niveau (minuit, heure de Paris)", () => {
  // Lot I5 : le format HH:MM:SS est `formatDecompte` du socle (packages/ui/test/formats.test.ts, mêmes cas).

  it("midi UTC en heure d'été = 14 h à Paris : 10 h ; en hiver = 13 h : 11 h", () => {
    expect(countdownText(Date.parse("2026-10-20T12:00:00Z"))).toBe("Prochain niveau dans 10:00:00");
    expect(countdownText(Date.parse("2026-12-01T12:00:00Z"))).toBe("Prochain niveau dans 11:00:00");
    expect(countdownText(Date.parse("2026-10-20T21:59:50Z"))).toBe("Prochain niveau dans 00:00:10");
  });

  it("changements d'heure : le jour du retour à l'heure d'hiver dure 25 h, celui de l'heure d'été 23 h", () => {
    // 25/10/2026 : minuit à Paris = 22:00 UTC le 24 ; le minuit suivant = 23:00 UTC le 25.
    expect(msUntilNextParisDay(Date.parse("2026-10-24T22:00:00Z"))).toBe(25 * 3600_000);
    expect(countdownText(Date.parse("2026-10-24T22:00:00Z"))).toBe("Prochain niveau dans 25:00:00");
    expect(countdownText(Date.parse("2026-10-25T00:30:00Z"))).toBe("Prochain niveau dans 22:30:00"); // 02:30 CEST… puis l'heure recule
    expect(countdownText(Date.parse("2026-10-25T22:59:59Z"))).toBe("Prochain niveau dans 00:00:01");
    // 28/03/2027 : minuit à Paris = 23:00 UTC le 27 ; le minuit suivant = 22:00 UTC le 28.
    expect(countdownText(Date.parse("2027-03-27T23:00:00Z"))).toBe("Prochain niveau dans 23:00:00");
    expect(countdownText(Date.parse("2027-03-28T21:00:00Z"))).toBe("Prochain niveau dans 01:00:00");
  });
});

describe("l'accueil", () => {
  it("s'ouvre sur la page du niveau du jour ; les liens directs vont droit à leur contenu ; ?accueil=0 le saute ; ?archives l'ouvre", () => {
    expect(wantsHome(readUrlOptions(""))).toBe(true);
    expect(wantsHome(readUrlOptions("?debug"))).toBe(true);
    expect(wantsHome(readUrlOptions("?debug&touch=1&theme=neon"))).toBe(true);
    expect(wantsHome(readUrlOptions("?accueil=0"))).toBe(false);
    expect(wantsHome(readUrlOptions("?accueil=1"))).toBe(true);
    for (const q of ["?seed=2026-10-20", "?seed=2026-10-18&accueil=1", "?module=cheminee", "?modules", "?scenario=essai", "?solution", "?watch=best", "?carnage=demo"]) expect(wantsHome(readUrlOptions(q)), q).toBe(false);
    expect(wantsHome(readUrlOptions("?archives"))).toBe(true);
    expect(wantsHome(readUrlOptions("?archives&accueil=0"))).toBe(true);
    expect(readUrlOptions("?scenario=essai&archives").archives).toBe(false);
  });

  it("liens : l'accueil et les archives gardent les outils d'affichage ; accueil=0 suit le passage de minuit, pas l'accueil", () => {
    const from = readUrlOptions("?seed=2026-10-18&debug&touch=1&accueil=0");
    expect(homeHref(from)).toBe("?debug&touch=1");
    expect(archiveHref("2026-10-17", from)).toBe("?seed=2026-10-17&debug&touch=1");
    expect(dailyHref(from)).toBe("?debug&touch=1&accueil=0");
    expect(homeHref(readUrlOptions(""))).toBe("?");
  });

  it("titre, niveau et thème ; état du joueur ; JOUER / CONTINUER / REJOUER ; ton record et la médaille à viser", () => {
    expect(homeHeading(day("2026-10-20"), "foret")).toEqual({ title: "JUMP", subtitle: `Niveau n°${NB}5 · Forêt` });
    expect(homeHeading(day("2026-10-15"), "neon").subtitle).toBe("Niveau du Jeu. 15 oct. · Néon"); // avant le premier jour : la date à la place du numéro
    expect(homeStatus(null)).toEqual({ played: false, finished: false, text: "Pas encore joué" });
    expect(homeStatus(rec("2026-10-20", null, { deaths: 12, attempts: 4 }))).toEqual({ played: true, finished: false, text: "Pas encore d'arrivée · 12 morts · 4 essais" });
    expect(homeStatus(rec("2026-10-20", 3769, { deaths: 47, medal: "gold" }))).toEqual({ played: true, finished: true, text: `Or · Meilleur : 31,408${NB}s · 47 morts` });
    expect(homeStatus(rec("2026-10-20", 9000, { deaths: 1, medal: null })).text).toBe("Meilleur : 1:15,000 · 1 mort"); // au-delà d'une minute : le format du socle (charte § 7)
    expect([etatDuJour(null), etatDuJour(rec("2026-10-20", null, { deaths: 1, attempts: 1 })), etatDuJour(rec("2026-10-20", 3769))]).toEqual(["pas_joue", "en_cours", "fini"]);
    const m = jumpMedalsFor(3600);
    expect(recordTile(null, m).valeur).toBe("Pas encore");
    expect(recordTile(null, m).sous).toMatch(/^Bronze à \d+,\d{3}\u00a0s$/);
    expect(recordTile(m.silver, m).sous).toMatch(/^Or à /);
    expect(recordTile(m.author, m)).toEqual({ valeur: `30,000${NB}s`, sous: "Temps de l'auteur battu" });
    expect(recordTile(3600, null).sous).toBe("");
  });

  it("lot I5 : la phrase de l'arrivée selon le nombre de morts du jour (paliers 0, 1–5, 6–20, 21–50, plus de 50), en français et en anglais", async () => {
    expect([0, 1, 5, 6, 20, 21, 50, 51, 999].map(palierMorts)).toEqual([
      "arrivee.phrase.zero",
      "arrivee.phrase.peu",
      "arrivee.phrase.peu",
      "arrivee.phrase.moyen",
      "arrivee.phrase.moyen",
      "arrivee.phrase.beaucoup",
      "arrivee.phrase.beaucoup",
      "arrivee.phrase.carnage",
      "arrivee.phrase.carnage",
    ]);
    expect(PALIERS_MORTS).toHaveLength(5);
    expect(arrivalLine(1)).toBe("Une seule mort. Les pics sont vexés.");
    expect(arrivalLine(37)).toBe("37 morts. La scie te remercie pour ta fidélité.");
    expect(arrivalLine(1284)).toContain(`1${NB}284 morts`);
    await setLangue("en", { ecrire: false });
    try {
      expect(arrivalLine(37)).toBe("37 deaths. The saw thanks you for your loyalty.");
      expect(arrivalLine(1)).toBe("One death. The spikes are offended.");
    } finally {
      await setLangue("fr", { ecrire: false });
    }
    // Une seule phrase par écran (charte § 7), courte, sans émoji, dans les deux langues.
    for (const l of ["fr", "en"] as const) {
      for (const p of PALIERS_MORTS) {
        const v = CATALOGUE_JUMP[l][p.cle]!;
        for (const x of typeof v === "string" ? [v] : Object.values(v)) {
          expect(x.length, x).toBeLessThanOrEqual(70);
          expect(x, x).not.toMatch(/\p{Extended_Pictographic}/u);
        }
      }
    }
  });

  it("archives : du niveau n° 1 jusqu'à hier, le plus récent d'abord ; jamais aujourd'hui ni le futur", () => {
    expect(archiveDays(day("2026-10-20"), PREMIER_JOUR_JUMP).map(formatDay)).toEqual(["2026-10-19", "2026-10-18", "2026-10-17", "2026-10-16"]);
    expect(archiveDays(PREMIER_JOUR_JUMP, PREMIER_JOUR_JUMP)).toEqual([]);
    expect(archiveDays(PREMIER_JOUR_JUMP - 3, PREMIER_JOUR_JUMP)).toEqual([]);
    expect(archiveDays(PREMIER_JOUR_JUMP + 400, PREMIER_JOUR_JUMP)).toHaveLength(400);
    // Lot R8 : par défaut, les archives commencent à la journée n° 1 de Du Jour (le lancement public), pas au niveau n° 1 de Jump.
    const lancement = premierJourDuJour();
    expect(PREMIER_JOUR_ARCHIVES).toBe(Math.max(PREMIER_JOUR_JUMP, lancement));
    expect(archiveDays(lancement + 3).map(formatDay)).toEqual([formatDay(lancement + 2), formatDay(lancement + 1), formatDay(lancement)]);
    expect(archiveDays(lancement)).toEqual([]); // le jour du lancement : rien à rejouer, c'est le niveau du jour
    expect(archiveDays(lancement - 5)).toEqual([]);
    expect(archiveRow(day("2026-10-18"), "nuit", null)).toEqual({ date: "2026-10-18", number: 3, title: `n°${NB}3`, subtitle: "Dim. 18 oct. · Nuit", result: "", medal: null });
    expect(archiveRow(day("2026-10-18"), "nuit", rec("2026-10-18", 3600, { medal: "silver" }))).toMatchObject({ result: `30,000${NB}s`, medal: "silver" });
    expect(archiveRow(day("2026-10-18"), "nuit", rec("2026-10-18", null, { deaths: 9 })).result).toBe("pas d'arrivée · 9 morts");
  });

  it("seuils des médailles, de l'auteur au bronze, et ceux qu'un temps tient", () => {
    const m = jumpMedalsFor(3600);
    const t = medalThresholds(m, m.silver);
    expect(t.map((x) => x.medal)).toEqual(["author", "gold", "silver", "bronze"]);
    expect(t.map((x) => x.reached)).toEqual([false, false, true, true]);
    expect(t[0]).toMatchObject({ label: "Auteur", time: `30,000${NB}s` });
    expect(medalThresholds(m, null).some((x) => x.reached)).toBe(false);
  });

  it("« Comment jouer » (lot I5 : trois points courts, dans le jeu) et les commandes ; vu une seule fois", () => {
    const text = HOWTO_POINTS.map((k) => CATALOGUE_JUMP.fr[k]).join(" ");
    for (const w of ["drapeau", "chrono", "mourir", "fanion", "Tiens le saut", "mur"]) expect(text).toContain(w);
    const commandes = [...COMMANDES.clavier, ...COMMANDES.manette, ...COMMANDES.tactile].map((k) => CATALOGUE_JUMP.fr[k]).join(" ");
    for (const w of ["courir", "sauter", "recommencer", "pause", "fantôme", "Select", "Start", "SAUT"]) expect(commandes).toContain(w);
    const store = new MemStore();
    expect(helpSeen(store)).toBe(false);
    markHelpSeen(store);
    expect(helpSeen(store)).toBe(true);
    expect(helpSeen(BROKEN)).toBe(true); // stockage qui lève : on ne la remontre pas à chaque page
    expect(() => markHelpSeen(BROKEN)).not.toThrow();
  });
});

describe("mémoire du jour : morts et essais comptés (lot 10)", () => {
  it("les morts du jour ne sont pas plafonnées comme les taches ; relues au chargement ; purgées avec le jour", () => {
    const store = new MemStore();
    const d = dailyLevel(day("2026-10-20"));
    let today = "2026-10-20";
    const mem = new DayMemory({ store, level: d.level, levelId: d.id, today: () => today });
    for (let i = 0; i < 320; i++) mem.recordDeath({ x: 4096, y: 4096, cause: 1 }, false);
    expect(mem.recordDeath({ x: 4096, y: 4096, cause: 1 }, true)).toBe(false);
    expect(mem.totalDeaths).toBe(320);
    expect(mem.deaths).toHaveLength(300);
    expect(mem.attempts).toBe(0);
    const again = new DayMemory({ store, level: d.level, levelId: d.id, today: () => today });
    expect(again.totalDeaths).toBe(320);
    today = "2026-10-21";
    again.recordDeath({ x: 4096, y: 4096, cause: 1 }, false);
    expect(again.totalDeaths).toBe(1);
  });
});

// ——— Niveaux figés ———

const FROZEN_DAYS = [daysFromCivil(2026, 10, 16), daysFromCivil(2026, 11, 2), daysFromCivil(2027, 1, 19)];
const levels = new Map<number, DailyLevel>(FROZEN_DAYS.map((d) => [d, dailyLevel(d)]));
const frozenOf = (d: number): FrozenLevel => JSON.parse(frozenJson(freezeLevel(levels.get(d)!))) as FrozenLevel;

describe("niveaux figés : écriture et lecture", () => {
  it("une rangée se code en plages et se décode à l'identique ; un chiffre est refusé", () => {
    expect(rleRow("#####...^")).toBe("#5.3^");
    expect(rleRow("S")).toBe("S");
    expect(rleRow("")).toBe("");
    expect(unrleRow("#5.3^")).toBe("#####...^");
    expect(unrleRow("#12")).toBe("#".repeat(12));
    expect(() => rleRow("#1#")).toThrow();
    expect(() => unrleRow("5#")).toThrow();
    expect(() => unrleRow("#0")).toThrow();
  });

  it("le texte d'un niveau (grille et bloc annexe) revient à l'identique, et le fichier est compact", () => {
    for (const [d, l] of levels) {
      const { grille, annexe } = encodeAscii(l.ascii);
      expect(decodeAscii(grille, annexe), formatDay(d)).toBe(l.ascii);
      expect(grille.length).toBe(l.level.height);
      expect(annexe.some((line) => line.startsWith("section "))).toBe(true);
      expect(frozenJson(freezeLevel(l)).length).toBeLessThan(l.ascii.length);
      expect(frozenJson(freezeLevel(l)).length).toBeLessThan(12_000);
    }
  });

  it("le fichier contient grille, sections et scies, preuve, médailles, versions, identifiant ; relu, c'est le même niveau", () => {
    for (const [d, l] of levels) {
      const f = frozenOf(d);
      expect(f).toMatchObject({ format: FROZEN_FORMAT, jeu: "dailyjump", date: l.date, id: l.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, preuve: l.code, auteur: l.authorTicks, medailles: l.medals });
      const back = thawLevel(f, d);
      expect(typeof back, formatDay(d)).not.toBe("string");
      const t = back as DailyLevel;
      expect(t.hash).toBe(l.hash);
      expect(t.ascii).toBe(l.ascii);
      expect(t.level.tiles).toEqual(l.level.tiles);
      expect(t.level.saws).toEqual(l.level.saws);
      expect(t.level.sections).toEqual(l.level.sections);
      expect(t.level.checkpoints).toEqual(l.level.checkpoints);
      expect(t.replay).toEqual(l.replay);
      expect(t.medals).toEqual(l.medals);
      expect(t.pieces).toEqual(l.pieces);
      expect(t).toMatchObject({ id: l.id, date: l.date, number: l.number, authorTicks: l.authorTicks, chosen: l.chosen, fallback: l.fallback });
    }
  });

  it("la preuve est rejouée : un temps, une preuve, une grille ou une empreinte trafiqués sont refusés", () => {
    const d = FROZEN_DAYS[0]!;
    const f = frozenOf(d);
    expect(thawLevel({ ...f, auteur: f.auteur + 1, medailles: { ...f.medailles, author: f.auteur + 1 } }, d)).toBe("la preuve ne se rejoue pas");
    expect(thawLevel({ ...f, preuve: frozenOf(FROZEN_DAYS[1]!).preuve }, d)).toMatch(/la preuve ne se rejoue pas/);
    // Un mur plein juste devant le départ, du plafond au sol : sans recalculer l'empreinte, le texte est refusé ; avec (un fichier
    // « cohérent » mais faux), c'est le rejeu de la preuve qui le refuse.
    const rows = decodeAscii(f.grille, f.annexe).split("\n");
    const r = rows.findIndex((row) => row.includes("S"));
    const c = rows[r]!.indexOf("S") + 2;
    for (let k = 1; k <= r; k++) rows[k] = `${rows[k]!.slice(0, c)}#${rows[k]!.slice(c + 1)}`;
    const walled = { ...f, ...encodeAscii(rows.join("\n")) };
    expect(thawLevel(walled, d)).toBe("empreinte du niveau");
    expect(thawLevel({ ...walled, hash: textHash(rows.join("\n")) }, d)).toBe("la preuve ne se rejoue pas");
    expect(thawLevel({ ...f, hash: "00000000" }, d)).toBe("empreinte du niveau");
    expect(thawLevel({ ...f, medailles: { ...f.medailles, gold: f.medailles.author - 1 } }, d)).toBe("médailles illisibles");
  });

  it("fichier corrompu, d'une autre date, d'une autre physique ou d'un générateur inconnu : refusé avec sa raison", () => {
    const d = FROZEN_DAYS[0]!;
    const f = frozenOf(d);
    expect(thawLevel(null, d)).toBe("fichier illisible");
    expect(thawLevel("<!doctype html>", d)).toBe("fichier illisible");
    expect(thawLevel({ ...f, format: 99 }, d)).toBe("format inconnu");
    expect(thawLevel(f, d + 1)).toBe("autre date");
    expect(thawLevel({ ...f, simVersion: JUMP_SIM_VERSION + 1 }, d)).toMatch(/^autre physique/);
    expect(thawLevel({ ...f, generatorVersion: JUMP_GENERATOR_VERSION + 1 }, d)).toBe("générateur inconnu");
    expect(thawLevel({ ...f, id: "jour-2026-10-16-g1" }, d)).toBe("autre identifiant");
    expect(thawLevel({ ...f, grille: "#4" }, d)).toBe("fichier incomplet");
    expect(thawLevel({ ...f, grille: ["5#"] }, d)).toMatch(/^illisible/);
    const { morceaux: _, ...partial } = f;
    expect(thawLevel(partial, d)).toBe("fichier incomplet");
  });
});

describe("niveaux figés : le chargement", () => {
  const TODAY = "2026-10-20";
  const DAY = FROZEN_DAYS[0]!;
  const base = (read: (date: string) => Promise<unknown>, days = [formatDay(DAY)]): LoaderOptions => ({ store: new MemStore(), today: TODAY, frozen: { days, read } });

  it("une date figée : le fichier est lu, sa preuve rejouée, et c'est lui qui sert (ni cache ni génération)", async () => {
    const asked: string[] = [];
    const load = await loadDaily(DAY, base(async (date) => (asked.push(date), frozenOf(DAY))));
    expect(asked).toEqual([formatDay(DAY)]);
    expect(load).toMatchObject({ source: "fige", generated: false, frozenMiss: "" });
    expect(load.level.hash).toBe(levels.get(DAY)!.hash);
    expect(load.level.id).toBe(levels.get(DAY)!.id);
  });

  it("le niveau figé l'emporte même si le générateur a changé depuis : il garde son identifiant d'origine", async () => {
    // Un fichier figé sous un générateur plus ancien (fictif : g1), même physique. On n'a pas l'ancien générateur ; on fabrique un fichier
    // valide en réécrivant l'identifiant de la preuve, ce qu'un vrai fichier ancien porterait. Lot 15 : à partir du niveau v3 de la date (les
    // générateurs jusqu'à g9 faisaient des niveaux v3).
    if (JUMP_GENERATOR_VERSION < 2) return;
    const f = JSON.parse(frozenJson(freezeLevel(dailyLevel(DAY, null, 3)))) as FrozenLevel;
    expect(f.simVersion).toBe(3);
    const { decodeReplay, encodeReplay } = await import("@cdj/jump-sim");
    const oldId = `jour-${formatDay(DAY)}-g1`;
    const replay = { ...decodeReplay(f.preuve), levelId: oldId };
    const old = { ...f, id: oldId, generatorVersion: 1, preuve: encodeReplay(replay) };
    const load = await loadDaily(DAY, base(async () => old));
    expect(load.source).toBe("fige");
    expect(load.level.id).toBe(oldId);
  });

  it("repli sur la génération : fichier absent, illisible, corrompu ou d'une autre physique (avec la raison)", async () => {
    const cases: [unknown, string | RegExp][] = [
      [null, "fichier absent"],
      ["<!doctype html>", "fichier illisible"],
      [{ ...frozenOf(DAY), auteur: 1 }, "médailles illisibles"],
      [{ ...frozenOf(DAY), simVersion: JUMP_SIM_VERSION + 1 }, /^autre physique/],
    ];
    for (const [file, why] of cases) {
      const load = await loadDaily(DAY, base(async () => file));
      expect(load.source).toBe("principal");
      expect(load.generated).toBe(true);
      expect(load.frozenMiss).toMatch(why);
      expect(load.level.hash).toBe(levels.get(DAY)!.hash);
    }
    const failing = await loadDaily(DAY, base(async () => {
      throw new Error("réseau");
    }));
    expect(failing).toMatchObject({ source: "principal", frozenMiss: "fichier absent" });
  });

  it("une date qui n'est pas dans la liste n'est jamais demandée", async () => {
    let asked = 0;
    const load = await loadDaily(FROZEN_DAYS[1]!, base(async () => (asked++, null)));
    expect(asked).toBe(0);
    expect(load).toMatchObject({ source: "principal", frozenMiss: "" });
  });
});
