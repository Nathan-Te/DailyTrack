import { describe, expect, it } from "vitest";
import { astuceIphoneAPropos, basculerPleinEcran, estIphone, modeApplication, pleinEcranActif, pleinEcranPossible, surChangementPleinEcran, type Environnement } from "../src/pleinEcran";

// Lot I7 : la seule logique de plein écran de la plateforme, essayée sur des navigateurs fictifs (rien de réel : ni document, ni écran).

interface Options {
  enabled?: boolean;
  webkit?: boolean;
  standalone?: "media" | "navigator";
  ua?: string;
  verrou?: "ok" | "refuse" | "absent";
  requete?: "ok" | "refuse";
}

function navigateur(o: Options = {}) {
  const journal: string[] = [];
  let element: object | null = null;
  const ecouteurs = new Map<string, Set<() => void>>();
  const doc = {
    fullscreenEnabled: o.webkit ? undefined : (o.enabled ?? true),
    webkitFullscreenEnabled: o.webkit ? (o.enabled ?? true) : undefined,
    get fullscreenElement() {
      return o.webkit ? null : element;
    },
    get webkitFullscreenElement() {
      return o.webkit ? element : undefined;
    },
    exitFullscreen: o.webkit ? undefined : async () => (journal.push("sortie"), (element = null), undefined),
    webkitExitFullscreen: o.webkit ? async () => (journal.push("sortie"), (element = null), undefined) : undefined,
    documentElement: {
      requestFullscreen: o.webkit
        ? undefined
        : async (opts?: unknown) => {
            if (o.requete === "refuse") throw new Error("refusé");
            journal.push(`entree:${JSON.stringify(opts)}`);
            element = {};
          },
      webkitRequestFullscreen: o.webkit
        ? async () => {
            journal.push("entree:webkit");
            element = {};
          }
        : undefined,
    },
    addEventListener: (n: string, cb: () => void) => void (ecouteurs.get(n) ?? ecouteurs.set(n, new Set()).get(n)!).add(cb),
    removeEventListener: (n: string, cb: () => void) => void ecouteurs.get(n)?.delete(cb),
  };
  const env: Environnement = {
    doc: doc as unknown as Environnement["doc"],
    orientation:
      o.verrou === "absent"
        ? null
        : {
            lock: async (orientation: string) => {
              if (o.verrou === "refuse") throw new Error("NotSupportedError");
              journal.push(`verrou:${orientation}`);
            },
          },
    matchMedia: (q) => ({ matches: o.standalone === "media" && q === "(display-mode: standalone)" }),
    navigator: { standalone: o.standalone === "navigator" ? true : undefined, userAgent: o.ua ?? "Mozilla/5.0 (Linux; Android 14)" },
  };
  return { env, journal, ecouteurs };
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

describe("pleinEcranPossible", () => {
  it("oui quand l'API existe", () => expect(pleinEcranPossible(navigateur().env)).toBe(true));
  it("oui avec le préfixe webkit", () => expect(pleinEcranPossible(navigateur({ webkit: true }).env)).toBe(true));
  it("non quand le navigateur ne l'autorise pas (iPhone : fullscreenEnabled faux)", () => expect(pleinEcranPossible(navigateur({ enabled: false, ua: IPHONE }).env)).toBe(false));
  it("non quand le site est déjà ouvert comme application (display-mode: standalone)", () => expect(pleinEcranPossible(navigateur({ standalone: "media" }).env)).toBe(false));
  it("non quand le site est déjà ouvert comme application (navigator.standalone de Safari)", () => expect(pleinEcranPossible(navigateur({ standalone: "navigator" }).env)).toBe(false));
});

describe("état", () => {
  it("suit l'entrée et la sortie", async () => {
    const { env } = navigateur();
    expect(pleinEcranActif(env)).toBe(false);
    await basculerPleinEcran(env);
    expect(pleinEcranActif(env)).toBe(true);
    await basculerPleinEcran(env);
    expect(pleinEcranActif(env)).toBe(false);
  });
  it("suit aussi le préfixe webkit", async () => {
    const { env, journal } = navigateur({ webkit: true });
    await basculerPleinEcran(env);
    expect(pleinEcranActif(env)).toBe(true);
    await basculerPleinEcran(env);
    expect(journal).toEqual(["entree:webkit", "verrou:landscape", "sortie"]);
  });
  it("prévient des changements, et cesse quand on se désabonne", () => {
    const { env, ecouteurs } = navigateur();
    let n = 0;
    const off = surChangementPleinEcran(() => n++, env);
    for (const cb of ecouteurs.get("fullscreenchange")!) cb();
    off();
    expect(ecouteurs.get("fullscreenchange")!.size).toBe(0);
    expect(ecouteurs.get("webkitfullscreenchange")!.size).toBe(0);
    expect(n).toBe(1);
  });
});

describe("basculerPleinEcran", () => {
  it("entre sans barre de navigation, puis verrouille le paysage", async () => {
    const { env, journal } = navigateur();
    await basculerPleinEcran(env);
    expect(journal).toEqual(['entree:{"navigationUI":"hide"}', "verrou:landscape"]);
  });
  it("ne verrouille pas en sortant", async () => {
    const { env, journal } = navigateur();
    await basculerPleinEcran(env);
    journal.length = 0;
    await basculerPleinEcran(env);
    expect(journal).toEqual(["sortie"]);
  });
  it("un verrou refusé est ignoré, sans erreur", async () => {
    const { env } = navigateur({ verrou: "refuse" });
    await expect(basculerPleinEcran(env)).resolves.toBeUndefined();
    expect(pleinEcranActif(env)).toBe(true);
  });
  it("un navigateur sans verrou d'orientation est sans conséquence", async () => {
    const { env } = navigateur({ verrou: "absent" });
    await expect(basculerPleinEcran(env)).resolves.toBeUndefined();
    expect(pleinEcranActif(env)).toBe(true);
  });
  it("une entrée refusée laisse le jeu tel quel : pas d'erreur, pas de verrou", async () => {
    const { env, journal } = navigateur({ requete: "refuse" });
    await expect(basculerPleinEcran(env)).resolves.toBeUndefined();
    expect(pleinEcranActif(env)).toBe(false);
    expect(journal).toEqual([]);
  });
});

describe("iPhone", () => {
  it("reconnu par son agent", () => {
    expect(estIphone(navigateur({ ua: IPHONE }).env)).toBe(true);
    expect(estIphone(navigateur().env)).toBe(false);
  });
  it("l'astuce n'a lieu d'être que sur un iPhone sans plein écran, hors du mode application", () => {
    expect(astuceIphoneAPropos(navigateur({ ua: IPHONE, enabled: false }).env)).toBe(true);
    expect(astuceIphoneAPropos(navigateur({ ua: IPHONE, enabled: false, standalone: "navigator" }).env)).toBe(false);
    expect(astuceIphoneAPropos(navigateur({ enabled: false }).env)).toBe(false); // un ordinateur sans plein écran n'a rien à apprendre de l'écran d'accueil
    expect(astuceIphoneAPropos(navigateur({ ua: IPHONE, enabled: true }).env)).toBe(false); // un iPhone (futur) qui sait le faire a le bouton
  });
  it("mode application : display-mode ou navigator.standalone", () => {
    expect(modeApplication(navigateur({ standalone: "media" }).env)).toBe(true);
    expect(modeApplication(navigateur({ standalone: "navigator" }).env)).toBe(true);
    expect(modeApplication(navigateur().env)).toBe(false);
  });
});
