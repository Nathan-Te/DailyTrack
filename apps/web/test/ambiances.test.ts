import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_NAMES, THEMES, type ThemeName } from "@cdj/sim";
import {
  PLANCHER,
  THEMES_AMBIANCE,
  VITESSE_PLEINE,
  coupureSelonVitesse,
  niveauReaction,
  niveauSelonVitesse,
  themeAmbianceDe,
} from "../src/son/ambiance/donnees";
import { ConstructeurBanque, SR, alea, bandesDEnergie, bruitRose, crete, ecrireNote, echo, filtrer, normaliserCrete, rms } from "../src/son/ambiance/kit";

// Lot 56 — les ambiances sonores par thème. Rien ne s'écoute ici : on vérifie les règles (rien de l'ancienne ambiance ne reste ; le son ne touche jamais à la simulation ; le mixage ;
// les outils de synthèse). Le rendu des huit thèmes (Web Audio hors ligne) est testé par `e2e/vitrine-ambiances.spec.ts`.

const SRC = new URL("../src/", import.meta.url);
/** Tous les fichiers `.ts` sous un dossier (récursif). */
function fichiers(dir: URL): URL[] {
  const sortie: URL[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) sortie.push(...fichiers(new URL(`${e.name}/`, dir)));
    else if (e.name.endsWith(".ts")) sortie.push(new URL(e.name, dir));
  }
  return sortie;
}

describe("aucun reste de l'ancienne ambiance (lot 56)", () => {
  it("ni son code, ni sa recette, ni son réglage affiché, ni ses textes", () => {
    const anciens = [/\bAMBIENCE\b/, /\bAMBIENCE_KINDS\b/, /\bambienceFor\b/, /\bambienceLevel\b/, /\bsetAmbience\b/, /\bbuildAmbience\b/, /\bAmbienceKind\b/, /\bambienceKind\b/, /\bAmbienceRecipe\b/];
    for (const u of fichiers(SRC)) {
      const src = readFileSync(u, "utf8");
      for (const re of anciens) expect(src, `${u.pathname.split("/src/")[1]} : ${re}`).not.toMatch(re);
    }
    // Plus de curseur « Ambiance » dans Réglages tant que la nouvelle ambiance n'est pas dans le jeu : ni la ligne, ni ses clés de catalogue.
    const reglages = readFileSync(new URL("settingsUi.ts", SRC), "utf8");
    expect(reglages).not.toMatch(/reglages\.son\.ambiance/);
    for (const l of ["fr", "en"]) expect(readFileSync(new URL(`catalogue.reglages.${l}.ts`, SRC), "utf8")).not.toMatch(/reglages\.son\.ambiance/);
    // Le jeu ne fabrique plus de bruit de fond : audio.ts n'a ni bruit de thème ni bus d'ambiance branché à une source.
    const audio = readFileSync(new URL("audio.ts", SRC), "utf8");
    expect(audio).not.toMatch(/this\.ambience\b|ambienceWanted|ambience\?\.stop/);
  });
});

describe("le thème d'une palette", () => {
  it("chacun des huit thèmes a son ambiance, huit différentes", () => {
    const vus = new Set<string>();
    for (const nom of THEME_NAMES) vus.add(themeAmbianceDe(THEMES[nom as ThemeName].palette));
    expect(vus.size).toBe(8);
    expect([...vus].sort()).toEqual([...THEMES_AMBIANCE].sort());
  });
  it("le Néon prend l'ambiance de la Nuit ; une palette inconnue aussi (jamais de silence imprévu, jamais d'erreur)", () => {
    expect(themeAmbianceDe("neon")).toBe("nuit");
    expect(themeAmbianceDe("nuit")).toBe("nuit");
    expect(themeAmbianceDe("desert")).toBe("rallye");
    expect(themeAmbianceDe("neige")).toBe("banquise");
    expect(themeAmbianceDe("alpin")).toBe("col");
  });
});

describe("le mixage : une ambiance discrète que la vitesse couvre", () => {
  it("pleine à l'arrêt, au plancher à partir de la vitesse pleine, jamais en dessous, qui baisse sans à-coup", () => {
    expect(niveauSelonVitesse(0)).toBe(1);
    expect(niveauSelonVitesse(VITESSE_PLEINE)).toBeCloseTo(PLANCHER, 6);
    expect(niveauSelonVitesse(300)).toBeCloseTo(PLANCHER, 6);
    expect(niveauSelonVitesse(-5)).toBe(1);
    let avant = niveauSelonVitesse(0);
    for (let v = 0; v <= 90; v += 0.5) {
      const n = niveauSelonVitesse(v);
      expect(n, `v = ${v}`).toBeLessThanOrEqual(avant + 1e-12);
      expect(avant - n, `pas de saut à v = ${v}`).toBeLessThan(0.03);
      avant = n;
    }
  });
  it("la coupure passe-bas descend avec la vitesse, et les réactions (la foule) sont moins couvertes que le reste", () => {
    expect(coupureSelonVitesse(0)).toBeGreaterThan(coupureSelonVitesse(30));
    expect(coupureSelonVitesse(30)).toBeGreaterThan(coupureSelonVitesse(VITESSE_PLEINE));
    expect(coupureSelonVitesse(VITESSE_PLEINE)).toBeGreaterThan(2000);
    for (const v of [0, 20, 40, 60, 90]) expect(niveauReaction(v)).toBeGreaterThanOrEqual(niveauSelonVitesse(v));
    expect(niveauReaction(90)).toBeGreaterThan(0.5);
  });
});

describe("le son ne touche jamais la simulation", () => {
  const dossier = new URL("son/ambiance/", SRC);
  it("aucun module d'ambiance n'importe une valeur de la simulation ni du premier chargement, ni l'horloge murale, ni le hasard non semé", () => {
    const premierChargement = /from "\.\.\/(?:\.\.\/)?(audio|audioLogic|i18n|main|settings|storage|settingsUi|catalogue[\w.]*)"/;
    const liste = fichiers(dossier);
    expect(liste.length).toBeGreaterThanOrEqual(11); // index, kit, donnees, huit thèmes
    for (const u of liste) {
      const nom = u.pathname.split("/ambiance/")[1]!;
      const src = readFileSync(u, "utf8");
      for (const m of src.matchAll(/^import (?!type)[^;]*from "@cdj\/[^"]+"/gm)) throw new Error(`${nom} importe une valeur d'un autre paquet : ${m[0]}`);
      expect(src, `${nom} : pas d'import du premier chargement`).not.toMatch(premierChargement);
      expect(src, `${nom} : pas de hasard non semé`).not.toMatch(/Math\.random/);
      expect(src, `${nom} : pas d'horloge murale`).not.toMatch(/Date\.now|new Date\(/);
    }
  });
  it("ce que l'ambiance lit d'une course tient en quatre champs : la vitesse, « en course », le décor, l'instant — aucun état de la course", () => {
    const src = readFileSync(new URL("donnees.ts", dossier), "utf8");
    const bloc = /export interface EntreeAmbiance \{([\s\S]*?)\n\}/.exec(src)![1]!;
    const champs = [...bloc.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(champs).toEqual(["vitesse", "actif", "decor", "t"]);
  });
  it("le lecteur ne modifie pas ce qu'on lui donne : aucune écriture dans `e`", () => {
    const src = readFileSync(new URL("index.ts", dossier), "utf8");
    expect(src).not.toMatch(/\be\.(vitesse|actif|decor|t)\s*=[^=]/);
  });
});

describe("les outils de synthèse", () => {
  it("le hasard semé est le même à chaque fois, dans [0, 1[, et deux graines diffèrent", () => {
    const a = alea(5);
    const b = alea(5);
    const c = alea(6);
    let diff = 0;
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x !== c()) diff++;
    }
    expect(diff).toBeGreaterThan(990);
  });
  it("une note a la hauteur demandée (comptage des passages par zéro) et rien ne sort de son tableau", () => {
    const x = new Float32Array(SR);
    ecrireNote(x, { t: 0.1, dur: 0.5, f0: 440, attaque: 0.05, fenetre: 0.5, amp: 0.5 });
    let passages = 0;
    for (let i = 1; i < x.length; i++) if (x[i - 1]! < 0 && x[i]! >= 0) passages++;
    expect(passages / 0.5).toBeGreaterThan(420);
    expect(passages / 0.5).toBeLessThan(460);
    expect(x.slice(0, Math.round(0.09 * SR)).every((v) => v === 0)).toBe(true);
    // Une note qui dépasse la fin du tableau s'arrête au bord, sans exception.
    expect(() => ecrireNote(new Float32Array(100), { t: 0, dur: 1, f0: 300 })).not.toThrow();
  });
  it("un glissement exponentiel va de la fréquence de départ à celle d'arrivée", () => {
    const x = new Float32Array(SR);
    ecrireNote(x, { t: 0, dur: 1, f0: 200, f1: 800, attaque: 0.02, fenetre: 0.2, amp: 0.5 });
    const passages = (a: number, b: number) => {
      let n = 0;
      for (let i = Math.round(a * SR) + 1; i < Math.round(b * SR); i++) if (x[i - 1]! < 0 && x[i]! >= 0) n++;
      return n / (b - a);
    };
    expect(passages(0.02, 0.12)).toBeLessThan(passages(0.88, 0.98));
    expect(passages(0.88, 0.98) / passages(0.02, 0.12)).toBeGreaterThan(2.5);
  });
  it("le filtre passe-bas coupe l'aigu, le passe-haut le grave ; le bruit rose est fini et de niveau stable", () => {
    const a = alea(3);
    const n = bruitRose(SR, a);
    expect(n.every(Number.isFinite)).toBe(true);
    expect(rms([n])).toBeGreaterThan(0.05);
    expect(rms([n])).toBeLessThan(0.6);
    const bas = filtrer(n, "lowpass", 300, 0.7);
    const haut = filtrer(n, "highpass", 3000, 0.7);
    expect(rms([bas])).toBeLessThan(rms([n]));
    expect(rms([haut])).toBeLessThan(rms([bas])); // le rose a plus de grave que d'aigu
    // La sortie d'un passe-bas change plus lentement que celle d'un passe-haut.
    const var1 = (x: Float32Array) => {
      let s = 0;
      for (let i = 1; i < x.length; i++) s += (x[i]! - x[i - 1]!) ** 2;
      return s / rms([x]) ** 2;
    };
    expect(var1(bas)).toBeLessThan(var1(haut) / 10);
  });
  it("une banque range chaque variante à la suite (crête 0,9, début et fin à zéro), nomme ses groupes, ne se chevauche pas", async () => {
    const b = new ConstructeurBanque();
    for (let i = 0; i < 3; i++) {
      const x = new Float32Array(Math.round(0.3 * SR));
      ecrireNote(x, { t: 0, dur: 0.3, f0: 500 + 100 * i, amp: 0.2 });
      await b.ajouter("oiseau", x);
    }
    await b.ajouter("cloche", filtrer(bruitRose(SR / 2, alea(1)), "lowpass", 800));
    const { donnees, tranches } = b.construire();
    expect(tranches.oiseau).toHaveLength(3);
    expect(tranches.cloche).toHaveLength(1);
    const toutes = Object.values(tranches).flat().sort((p, q) => p.debut - q.debut);
    for (let i = 1; i < toutes.length; i++) expect(toutes[i]!.debut).toBeGreaterThanOrEqual(toutes[i - 1]!.debut + toutes[i - 1]!.duree);
    for (const t of toutes) {
      const i0 = Math.round(t.debut * SR);
      const i1 = Math.min(donnees.length, Math.round((t.debut + t.duree) * SR));
      expect(crete(donnees.subarray(i0, i1))).toBeCloseTo(0.9, 1);
      expect(Math.abs(donnees[i0]!)).toBeLessThan(0.02);
      expect(Math.abs(donnees[i1 - 1]!)).toBeLessThan(0.02);
    }
    expect(donnees.every(Number.isFinite)).toBe(true);
  });
  it("l'analyse des bandes retrouve la fréquence d'une sinusoïde et partage le bruit rose en bandes décroissantes", () => {
    const sin = new Float32Array(SR * 2);
    for (let i = 0; i < sin.length; i++) sin[i] = Math.sin((2 * Math.PI * 1000 * i) / SR);
    const [bas, milieu, haut] = bandesDEnergie(sin, [0, 250, 6000, SR / 2]) as [number, number, number];
    expect(milieu).toBeGreaterThan(0.99);
    expect(bas + haut).toBeLessThan(0.01);
    const sin100 = sin.map((_, i) => Math.sin((2 * Math.PI * 100 * i) / SR));
    expect(bandesDEnergie(sin100, [0, 250, 6000, SR / 2])[0]).toBeGreaterThan(0.99);
    const rose = bandesDEnergie(bruitRose(SR * 3, alea(8)), [0, 250, 6000, SR / 2]);
    expect(rose.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
    expect(rose[0]!).toBeGreaterThan(rose[2]!); // le rose a plus de grave que d'aigu
  });
  it("un écho ajoute des répétitions de plus en plus faibles et ne dépasse jamais l'original", () => {
    const x = new Float32Array(SR);
    ecrireNote(x, { t: 0, dur: 0.1, f0: 600, attaque: 0.1, amp: 0.5 });
    normaliserCrete(x, 0.8);
    const y = echo(x, 0.3, 3, 0.5, 3000);
    expect(y.length).toBeGreaterThan(x.length);
    const cretePart = (a: number, b: number) => crete(y.subarray(Math.round(a * SR), Math.round(b * SR)));
    expect(cretePart(0.3, 0.45)).toBeLessThan(cretePart(0, 0.15));
    expect(cretePart(0.6, 0.75)).toBeLessThan(cretePart(0.3, 0.45));
    expect(cretePart(0.3, 0.45)).toBeGreaterThan(0.05);
  });
});
