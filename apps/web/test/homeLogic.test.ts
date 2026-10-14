import { describe, expect, it } from "vitest";
import { SALON_SESSION_MS, THEMES, salonTheme } from "@cdj/sim";
import { DIRECT_KEYS, dailyTitle, demoSalonStatus, homeHref, lookupSalon, mmss, remainingMs, salonStatusFromNow, wantsHome, withoutHome } from "../src/homeLogic";
import { modeHref } from "../src/salon";

const params = (q: string) => new URLSearchParams(q);

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
  it("« Circuit du Jour n° 1 · 13 oct. · Rallye »", () => {
    expect(dailyTitle(1, "2026-10-13", "Rallye")).toBe("Circuit du Jour n° 1 · 13 oct. · Rallye");
    expect(dailyTitle(16, "2026-10-28", "Nuit", false)).toBe("n° 16 · 28 oct. · Nuit");
    expect(dailyTitle(0, "2026-10-12", "Ville")).toBe("Circuit du Jour 12 oct. · Ville"); // avant le premier jour : pas de numéro
  });
  it("temps restant", () => {
    expect(mmss(462_000)).toBe("07:42");
    expect(mmss(461_001)).toBe("07:42"); // arrondi à la seconde supérieure
    expect(mmss(-5)).toBe("00:00");
  });
});

describe("le Salon vu depuis l'accueil", () => {
  it("démonstration : session, thème, temps restant", () => {
    const at = 5 * SALON_SESSION_MS + 123_000; // 2 min 3 s dans la session 5
    const s = demoSalonStatus(at);
    expect(s.session).toBe(5);
    expect(s.themeLabel).toBe(THEMES[salonTheme(5)].label);
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
    expect(down).toEqual({ ok: false, message: expect.stringContaining("ne répond pas") });
    const no404 = await lookupSalon("http://x", SALON_SESSION_MS, { now: async () => ({ ok: false as const, status: 404, code: "x", message: "x" }) });
    expect(no404.ok === false && no404.message).toContain("besoin du serveur");
  });
});
