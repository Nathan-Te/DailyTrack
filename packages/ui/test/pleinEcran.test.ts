import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { astuceIphoneAPropos, basculerPleinEcran, modeApplication, pleinEcranActif, pleinEcranBoutonVisible, pleinEcranParEcranAccueil, pleinEcranPossible, surChangementPleinEcran } from "../src/pleinEcran";

// Lot I7 : la seule logique de plein écran de la plateforme, essayée sur des navigateurs fictifs (la page est remplacée par `vi.stubGlobal` : rien de réel).

interface Options {
  enabled?: boolean;
  standalone?: "media" | "ios";
  /** Un écran tactile (`pointer: coarse`) : l'iPhone. */
  tactile?: boolean;
  ua?: string;
  verrou?: "ok" | "refuse" | "absent";
  requete?: "ok" | "refuse";
}

/** Pose un navigateur fictif ; rend le journal de ce qu'il a fait et les écouteurs du document. */
function navigateur(o: Options = {}) {
  const journal: string[] = [];
  let element: object | null = null;
  const ecouteurs = new Map<string, Set<() => void>>();
  const doc = {
    fullscreenEnabled: o.enabled ?? true,
    get fullscreenElement() {
      return element;
    },
    exitFullscreen: async () => (journal.push("sortie"), (element = null), undefined),
    documentElement: {
      requestFullscreen: async (opts?: unknown) => {
        if (o.requete === "refuse") throw new Error("refusé");
        journal.push(`entree:${JSON.stringify(opts)}`);
        element = {};
      },
    },
    addEventListener: (n: string, cb: () => void) => void (ecouteurs.get(n) ?? ecouteurs.set(n, new Set()).get(n)!).add(cb),
  };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("screen", {
    orientation:
      o.verrou === "absent"
        ? undefined
        : {
            lock: async (orientation: string) => {
              if (o.verrou === "refuse") throw new Error("NotSupportedError");
              journal.push(`verrou:${orientation}`);
            },
          },
  });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: (o.standalone === "media" && q === "(display-mode: standalone)") || (!!o.tactile && q === "(pointer: coarse)") }));
  vi.stubGlobal("navigator", { userAgent: o.ua ?? "Mozilla/5.0 (Linux; Android 14)", maxTouchPoints: o.tactile ? 5 : 0, ...(o.standalone === "ios" ? { standalone: true } : {}) });
  return { journal, ecouteurs };
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("pleinEcranPossible", () => {
  it("oui quand l'API existe", () => {
    navigateur();
    expect(pleinEcranPossible()).toBe(true);
  });
  it("non quand le navigateur ne l'autorise pas (iPhone : fullscreenEnabled faux)", () => {
    navigateur({ enabled: false, ua: IPHONE });
    expect(pleinEcranPossible()).toBe(false);
  });
  it("non quand le site est déjà ouvert comme application (display-mode: standalone)", () => {
    navigateur({ standalone: "media" });
    expect(pleinEcranPossible()).toBe(false);
  });
});

describe("état", () => {
  it("suit l'entrée et la sortie", async () => {
    navigateur();
    expect(pleinEcranActif()).toBe(false);
    await basculerPleinEcran();
    expect(pleinEcranActif()).toBe(true);
    await basculerPleinEcran();
    expect(pleinEcranActif()).toBe(false);
  });
  it("prévient des changements", () => {
    const { ecouteurs } = navigateur();
    let n = 0;
    surChangementPleinEcran(() => n++);
    for (const cb of ecouteurs.get("fullscreenchange")!) cb();
    expect(n).toBe(1);
  });
});

describe("basculerPleinEcran", () => {
  it("entre sans barre de navigation, puis verrouille le paysage", async () => {
    const { journal } = navigateur();
    await basculerPleinEcran();
    expect(journal).toEqual(['entree:{"navigationUI":"hide"}', "verrou:landscape"]);
  });
  it("ne verrouille pas en sortant", async () => {
    const { journal } = navigateur();
    await basculerPleinEcran();
    journal.length = 0;
    await basculerPleinEcran();
    expect(journal).toEqual(["sortie"]);
  });
  it("un verrou refusé est ignoré, sans erreur", async () => {
    navigateur({ verrou: "refuse" });
    await expect(basculerPleinEcran()).resolves.toBeUndefined();
    expect(pleinEcranActif()).toBe(true);
  });
  it("un navigateur sans verrou d'orientation est sans conséquence", async () => {
    navigateur({ verrou: "absent" });
    await expect(basculerPleinEcran()).resolves.toBeUndefined();
    expect(pleinEcranActif()).toBe(true);
  });
  it("une entrée refusée laisse le jeu tel quel : pas d'erreur, pas de verrou", async () => {
    const { journal } = navigateur({ requete: "refuse" });
    await expect(basculerPleinEcran()).resolves.toBeUndefined();
    expect(pleinEcranActif()).toBe(false);
    expect(journal).toEqual([]);
  });
});

describe("iPhone", () => {
  it("l'astuce et l'aide ont lieu d'être sur un écran tactile sans plein écran de page, hors du mode application — détecté par la fonction, pas par le nom", () => {
    navigateur({ enabled: false, tactile: true }); // pas d'agent d'iPhone : la fonction seule décide
    expect(astuceIphoneAPropos()).toBe(true);
    expect(pleinEcranParEcranAccueil()).toBe(true);
    navigateur({ ua: IPHONE, enabled: false, tactile: true, standalone: "media" });
    expect(astuceIphoneAPropos()).toBe(false);
    navigateur({ ua: IPHONE, enabled: false, tactile: true, standalone: "ios" }); // Safari : `navigator.standalone`
    expect(astuceIphoneAPropos()).toBe(false);
    navigateur({ enabled: false }); // un ordinateur sans plein écran n'a rien à apprendre de l'écran d'accueil
    expect(astuceIphoneAPropos()).toBe(false);
    navigateur({ ua: IPHONE, enabled: true, tactile: true }); // un appareil qui sait le faire (iPad, Android) a le vrai plein écran
    expect(astuceIphoneAPropos()).toBe(false);
  });
  it("le bouton « Plein écran » est montré s'il bascule le plein écran ou s'il ouvre l'aide ; pas en mode application, pas sur un ordinateur sans API", () => {
    navigateur({ tactile: true });
    expect([pleinEcranPossible(), pleinEcranBoutonVisible()]).toEqual([true, true]);
    navigateur({ enabled: false, tactile: true });
    expect([pleinEcranPossible(), pleinEcranBoutonVisible()]).toEqual([false, true]);
    navigateur({ enabled: false, tactile: true, standalone: "media" });
    expect(pleinEcranBoutonVisible()).toBe(false);
    navigateur({ enabled: false });
    expect(pleinEcranBoutonVisible()).toBe(false);
  });
  it("mode application : display-mode standalone, ou navigator.standalone (Safari)", () => {
    navigateur({ standalone: "media" });
    expect(modeApplication()).toBe(true);
    navigateur({ standalone: "ios" });
    expect(modeApplication()).toBe(true);
    navigateur();
    expect(modeApplication()).toBe(false);
  });
});
