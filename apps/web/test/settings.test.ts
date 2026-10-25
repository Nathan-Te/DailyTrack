import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, formatSpeed, parseSettings, qualityPlan, saveSettings, SETTINGS_KEY } from "../src/settings";
import { DEFAULT_AUDIO, nextVolume, parseAudioSettings, toggleMute, withVolume } from "../src/audioLogic";
import { chargerLangue, setLangue } from "../src/i18n";
import { HOWTO_KEY, HOWTO_VERSION, howtoSeen, markHowtoSeen } from "../src/howto";

// L'anglais est un fichier à part, chargé à la demande (i18n.ts) : on le charge avant les tests qui passent en anglais.
beforeAll(() => chargerLangue("en"));

describe("réglages du jeu (lot 29)", () => {
  it("rien d'enregistré, ou illisible : valeurs par défaut", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("pas du json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("[]")).toEqual(DEFAULT_SETTINGS);
  });

  it("garde ce qui est valide, remplace le reste par le défaut", () => {
    const s = parseSettings(JSON.stringify({ version: SETTINGS_VERSION, particles: false, shake: "oui", speedFeel: "strong", ghost: "ahead", unit: "mph", board: false, splits: false, shadows: false, skids: false }));
    expect(s).toEqual({ ...DEFAULT_SETTINGS, particles: false, speedFeel: "strong", ghost: "ahead", unit: "mph", board: false, splits: false, shadows: false, skids: false });
    expect(s.shake).toBe(DEFAULT_SETTINGS.shake); // « oui » n'est pas un booléen
    expect(parseSettings(JSON.stringify({ graphismes: "ultra", unit: "m/s", ghost: 3 }))).toEqual(DEFAULT_SETTINGS);
  });

  it("l'enregistrement porte le numéro de version", () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { setItem: (k: string, v: string) => store.set(k, v), getItem: (k: string) => store.get(k) ?? null };
    try {
      saveSettings({ ...DEFAULT_SETTINGS, graphismes: "economie" });
      const raw = JSON.parse(store.get(SETTINGS_KEY)!);
      expect(raw.version).toBe(SETTINGS_VERSION);
      expect(parseSettings(store.get(SETTINGS_KEY)!).graphismes).toBe("economie");
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it("le réglage « Qualité » du lot 9 est retiré : un `quality` enregistré est ignoré et ne revient pas à l'écriture", () => {
    const vieux = JSON.stringify({ version: SETTINGS_VERSION, quality: "low", graphismes: "equilibree" });
    const s = parseSettings(vieux);
    expect(s).toEqual({ ...DEFAULT_SETTINGS, graphismes: "equilibree" });
    expect("quality" in s).toBe(false);
  });

  it("la fluidité est automatique ; seul `?quality=` (essais) la fige", () => {
    expect(qualityPlan(null)).toEqual({ fixed: false, level: 2 });
    expect(qualityPlan("0")).toEqual({ fixed: true, level: 0 });
    expect(qualityPlan("1")).toEqual({ fixed: true, level: 1 });
    expect(qualityPlan("2")).toEqual({ fixed: true, level: 2 });
    expect(qualityPlan("9")).toEqual({ fixed: false, level: 2 }); // valeur d'adresse invalide : automatique
  });

  it("l'unité de vitesse (nombre au format de la langue, espace insécable avant l'unité)", () => {
    setLangue("fr", { ecrire: false });
    expect(formatSpeed(40, "kmh")).toBe("144\u00a0km/h");
    expect(formatSpeed(40, "mph")).toBe("89\u00a0mph");
    expect(formatSpeed(0, "kmh")).toBe("0\u00a0km/h");
    setLangue("en", { ecrire: false });
    expect(formatSpeed(40, "kmh")).toBe("144\u00a0km/h");
    setLangue("fr", { ecrire: false });
  });
});

describe("son : trois voix et volume général", () => {
  it("anciens réglages (volume, dernier volume) lus avec les voix à plein niveau", () => {
    expect(parseAudioSettings('{"volume":0.25,"last":0.25}')).toEqual({ ...DEFAULT_AUDIO, volume: 0.25, last: 0.25 });
    expect(parseAudioSettings('{"engine":0.3,"effects":9,"ambience":-2}')).toMatchObject({ engine: 0.3, effects: 1, ambience: 0 });
  });
  it("muet et cran suivant gardent les voix", () => {
    const s = { ...DEFAULT_AUDIO, engine: 0.4 };
    expect(toggleMute(s).engine).toBe(0.4);
    expect(nextVolume(s).engine).toBe(0.4);
    expect(withVolume(s, 0.7)).toMatchObject({ volume: 0.7, last: 0.7, engine: 0.4 });
    expect(withVolume({ ...s, last: 0.6 }, 0)).toMatchObject({ volume: 0, last: 0.6 });
  });
});

describe("aide « Comment jouer » : vue une fois", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it("pas vue au premier passage, vue ensuite", () => {
    const store = memory();
    expect(howtoSeen(store)).toBe(false);
    markHowtoSeen(store);
    expect(howtoSeen(store)).toBe(true);
    expect(store.getItem(HOWTO_KEY)).toBe(String(HOWTO_VERSION));
  });
  it("sans stockage, elle se remontre (rien de plus grave)", () => {
    expect(howtoSeen(null)).toBe(false);
    expect(() => markHowtoSeen(null)).not.toThrow();
  });
  it("une aide d'une version plus ancienne se remontre", () => {
    const store = memory();
    store.setItem(HOWTO_KEY, "0");
    expect(howtoSeen(store)).toBe(false);
  });
});
