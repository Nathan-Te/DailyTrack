import { beforeAll, describe, expect, it } from "vitest";
import { SALON_SESSION_MS, salonTheme } from "@cdj/sim";
import { DIRECT_KEYS, dailyTitle, demoSalonStatus, homeHref, lookupSalon, medalWord, remainingMs, salonStatusFromNow, wantsHome, withoutHome } from "../src/homeLogic";
import { chargerLangue, setLangue } from "../src/i18n";
import { modeHref } from "../src/salon";

// L'anglais est un fichier à part, chargé à la demande (i18n.ts) : on le charge avant les tests qui passent en anglais.
beforeAll(() => chargerLangue("en"));

const params = (q: string) => new URLSearchParams(q);

// Les titres sont écrits dans la langue du jeu (i18n.ts) : ce fichier teste le français, puis l'anglais.
beforeAll(() => setLangue("fr", { ecrire: false }));

describe("l'accueil s'affiche… sauf lien direct", () => {
  it("au chargement simple, avec ou sans réglages d'affichage", () => {
    expect(wantsHome(params(""))).toBe(true);
    expect(wantsHome(params("?api=demo"))).toBe(true);
    expect(wantsHome(params("?api=demo&touch=1"))).toBe(true);
    expect(wantsHome(params("?quality=1&fx=off&camera=capot&ghost=off"))).toBe(true);
  });
  it("les liens de test et d'archive sautent l'accueil", () => {
    for (const q of ["?seed=2026-10-13", "?day=2026-10-13", "?scenario=essai", "?mode=salon", "?watch=best", "?demo", "?debug", "?theme=nuit", "?variant=2&seed=2026-10-20", "?debug&spec=S S"]) {
      expect(wantsHome(params(q)), q).toBe(false);
    }
    for (const k of DIRECT_KEYS) expect(wantsHome(params(`?${k}=1`)), k).toBe(false);
  });
  it("?home=1 le force, ?home=0 le coupe", () => {
    expect(wantsHome(params("?home=1&debug"))).toBe(true);
    expect(wantsHome(params("?home=1&seed=2026-10-13"))).toBe(true);
    expect(wantsHome(params("?home=0"))).toBe(false);
  });
});

describe("adresses", () => {
  it("l'accueil garde les réglages d'affichage, pas le circuit", () => {
    expect(homeHref("?seed=2026-10-13&api=demo&touch=1&theme=nuit&mode=salon&watch=best&demo")).toBe("?api=demo&touch=1&home=1");
    expect(homeHref("")).toBe("?home=1");
    expect(homeHref("?debug&today=2026-10-20")).toBe("?debug&today=2026-10-20&home=1");
  });
  it("home ne colle pas aux liens suivants", () => {
    expect(withoutHome("?home=1&api=demo")).toBe("?api=demo");
    expect(withoutHome("?home=1")).toBe("?");
    expect(modeHref("?home=1&api=demo", true)).toBe("?api=demo&mode=salon");
  });
});

describe("titres", () => {
  it("« Circuit du Jour n° 1 · mar. 13 oct. · Rallye »", () => {
    setLangue("fr", { ecrire: false });
    expect(dailyTitle(1, "2026-10-13", "Rallye")).toBe("Circuit du Jour n°\u00a01 · mar. 13 oct. · Rallye");
    expect(dailyTitle(16, "2026-10-28", "Nuit", false)).toBe("n°\u00a016 · mer. 28 oct. · Nuit");
    expect(dailyTitle(0, "2026-10-12", "Ville")).toBe("Circuit du Jour · lun. 12 oct. · Ville"); // avant le premier jour : pas de numéro
  });
  it("en anglais : « Track of the Day #1 · Tue, Oct 13 · Rally »", () => {
    setLangue("en", { ecrire: false });
    expect(dailyTitle(1, "2026-10-13", "Rally")).toBe("Track of the Day #1 · Tue, Oct 13 · Rally");
    expect(dailyTitle(16, "2026-10-28", "Night", false)).toBe("#16 · Wed, Oct 28 · Night");
    setLangue("fr", { ecrire: false });
  });
  it("médailles nommées dans la langue", () => {
    setLangue("en", { ecrire: false });
    expect(["author", "gold", "silver", "bronze"].map((m) => medalWord(m as "author"))).toEqual(["Diamond", "Gold", "Silver", "Bronze"]);
    setLangue("fr", { ecrire: false });
    expect(["author", "gold", "silver", "bronze"].map((m) => medalWord(m as "author"))).toEqual(["Diamant", "Or", "Argent", "Bronze"]);
  });
  // Lot I5 : « temps restant » (`mmss`) est devenu `formatDecompte(ms, { heures: false })` du socle : tests repris dans packages/ui/test/formats.test.ts.
});

describe("le Salon vu depuis l'accueil", () => {
  it("démonstration : session, thème, temps restant", () => {
    const at = 5 * SALON_SESSION_MS + 123_000; // 2 min 3 s dans la session 5
    const s = demoSalonStatus(at);
    expect(s.session).toBe(5);
    expect(s.theme).toBe(salonTheme(5));
    expect(remainingMs(s, at)).toBe(SALON_SESSION_MS - 123_000);
    expect(s.players).toBeGreaterThanOrEqual(0);
    expect(demoSalonStatus(at)).toEqual(s); // déterministe
  });
  it("serveur : l'heure du serveur recale le temps restant", () => {
    const now = { serverMs: 1_000_000, session: 1, startMs: 600_000, endMs: 1_200_000, trackId: "salon-1-g15", players: 3 };
    // Le serveur a répondu « 1 000 000 » au milieu de l'aller-retour (10 000 100 à l'horloge locale, qui avance de 10 s de plus ici) :
    // il est donc 1 010 100 chez lui, et la fin de session (1 200 000) est dans 189 900 ms.
    const s = salonStatusFromNow(now, 10_000_000, 10_000_200);
    expect(s.players).toBe(3);
    expect(s.sessionMs).toBe(600_000);
    expect(Math.round(remainingMs(s, 10_010_200))).toBe(189_900);
  });
  it("pas de serveur, ou serveur muet : un message clair, jamais d'exception", async () => {
    const none = await lookupSalon(null);
    expect(none.ok).toBe(false);
    const down = await lookupSalon("http://x", SALON_SESSION_MS, { now: async () => ({ ok: false as const, status: 0, code: "network", message: "Classement injoignable" }) });
    expect(down).toEqual({ ok: false, reason: "muet" });
    const no404 = await lookupSalon("http://x", SALON_SESSION_MS, { now: async () => ({ ok: false as const, status: 404, code: "x", message: "x" }) });
    expect(no404).toEqual({ ok: false, reason: "sans_serveur" });
    expect(none).toEqual({ ok: false, reason: "sans_serveur" });
  });
});
