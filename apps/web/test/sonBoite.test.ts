import { describe, expect, it } from "vitest";
import { DUREE_PASSAGE, boiteInitiale, pasBoite, regimeNormal, regimeRoue, type EtatBoite } from "../src/son/boite";
import { ETAGEMENT, PROFILS, PROFILS_PLANCHE, frequenceAllumage, profilDe } from "../src/son/profils";
import { Compteur } from "../src/son/moteur";
import { poidsFondu, vitesseLecture } from "../src/son/moteurEchantillons";
import { DUREE_SCENARIO, MOMENTS, gazDe, voitureVirtuelle } from "../src/son/voitureVirtuelle";

// Lot 55 (partie B) — la boîte de vitesses virtuelle du son et la voiture virtuelle de la planche : pures, déterministes. Le régime et le rapport suivent la
// vitesse et le gaz ; rien de tout cela ne touche la simulation (le son ne lit que l'état de la voiture).
const DT = 1 / 60;

/** Joue le scénario entier pour un profil ; rend chaque pas. */
function jouer(id: keyof typeof PROFILS) {
  const p = profilDe(id);
  let e: EtatBoite = boiteInitiale(p);
  const pas: { t: number; e: EtatBoite; v: number; gaz: number }[] = [];
  for (let t = 0; t < DUREE_SCENARIO; t += DT) {
    const f = voitureVirtuelle(t);
    e = pasBoite(e, p, f.speed, gazDe(f), DT, !f.grounded);
    pas.push({ t, e, v: f.speed, gaz: gazDe(f) });
  }
  return { p, pas };
}

describe("les profils", () => {
  it("la planche propose quatre profils bien différents, tous valides", () => {
    expect(PROFILS_PLANCHE).toHaveLength(4);
    const regimes = new Set(PROFILS_PLANCHE.map((id) => profilDe(id).rouge));
    expect(regimes.size).toBe(4);
    for (const id of PROFILS_PLANCHE) {
      const p = profilDe(id);
      expect(p.id).toBe(id);
      expect(p.rouge).toBeGreaterThan(p.ralenti * 1.5);
      expect(p.monte).toBeGreaterThan(p.descend);
      expect(p.timbre.coupure[1]).toBeGreaterThan(p.timbre.coupure[0]);
      expect(p.niveau).toBeGreaterThan(0);
      expect(p.niveau).toBeLessThanOrEqual(1);
    }
  });
  it("la monoplace crie plus haut qu'un V8 qui gronde : fondamental au rouge et harmonique ½", () => {
    const mono = profilDe("monoplace");
    const v8 = profilDe("muscle");
    expect(frequenceAllumage(mono.rouge, mono.cylindres)).toBeGreaterThan(2 * frequenceAllumage(v8.rouge, v8.cylindres));
    expect(v8.timbre.grondement).toBeGreaterThan(mono.timbre.grondement);
  });
  it("un profil inconnu retombe sur la civile", () => {
    expect(profilDe("rallye").id).toBe("civile");
  });
  it("la fréquence d'allumage : 4 cylindres à 6 000 tr/min = 200 Hz, jamais négative", () => {
    expect(frequenceAllumage(6000, 4)).toBeCloseTo(200, 6);
    expect(frequenceAllumage(-10, 4)).toBe(0);
  });
});

describe("la boîte virtuelle", () => {
  for (const id of PROFILS_PLANCHE) {
    it(`${id} : à fond, les six rapports montent un par un, sans pompage, et le régime reste entre le ralenti et le rouge`, () => {
      const { p, pas } = jouer(id);
      const accel = pas.filter((x) => x.t >= 3 && x.t < 14);
      const rapports = accel.map((x) => x.e.rapport);
      // Croissant, un par un.
      for (let i = 1; i < rapports.length; i++) {
        expect(rapports[i]! - rapports[i - 1]!).toBeGreaterThanOrEqual(0);
        expect(rapports[i]! - rapports[i - 1]!).toBeLessThanOrEqual(1);
      }
      expect(rapports[0]).toBe(1);
      expect(Math.max(...rapports)).toBeGreaterThanOrEqual(5);
      for (const x of pas) {
        expect(Number.isFinite(x.e.rpm)).toBe(true);
        expect(x.e.rpm).toBeGreaterThanOrEqual(p.ralenti * 0.95 - 1e-6);
        expect(x.e.rpm).toBeLessThanOrEqual(p.rouge + 1e-6);
        expect(x.e.charge).toBeGreaterThanOrEqual(0);
        expect(x.e.charge).toBeLessThanOrEqual(1);
        expect(x.e.passage).toBeGreaterThanOrEqual(0);
        expect(x.e.passage).toBeLessThanOrEqual(1);
      }
    });

    it(`${id} : le régime retombe après chaque montée de rapport, et la coupure de couple dure ${DUREE_PASSAGE} s`, () => {
      const { pas } = jouer(id);
      const accel = pas.filter((x) => x.t >= 3 && x.t < 14);
      let montees = 0;
      for (let i = 1; i < accel.length; i++) {
        if (accel[i]!.e.rapport > accel[i - 1]!.e.rapport) {
          montees++;
          expect(accel[i]!.e.passage).toBe(1);
          // Une demi-seconde après, le régime est sous celui d'avant le passage.
          const apres = accel.find((x) => x.t >= accel[i]!.t + 0.3);
          if (apres) expect(apres.e.rpm).toBeLessThan(accel[i - 1]!.e.rpm);
          // La coupure est finie après `DUREE_PASSAGE`.
          const fin = accel.find((x) => x.t >= accel[i]!.t + DUREE_PASSAGE + 0.05);
          if (fin) expect(fin.e.passage).toBe(0);
        }
      }
      expect(montees).toBeGreaterThanOrEqual(4);
    });

    it(`${id} : coup de gaz à l'arrêt : le moteur s'emballe, puis revient au ralenti`, () => {
      const { p, pas } = jouer(id);
      const ralenti0 = pas.find((x) => x.t >= 1.1)!;
      const haut = Math.max(...pas.filter((x) => x.t >= 1.2 && x.t < 2.4).map((x) => x.e.rpm));
      const retour = pas.find((x) => x.t >= 2.95)!;
      expect(ralenti0.e.rpm).toBeLessThan(p.ralenti * 1.1);
      expect(haut).toBeGreaterThan(p.ralenti + 0.3 * (p.rouge - p.ralenti));
      expect(retour.e.rpm).toBeLessThan(p.ralenti + 0.12 * (p.rouge - p.ralenti));
    });

    it(`${id} : en freinant, la boîte rétrograde et le régime ne tombe pas sous le ralenti`, () => {
      const { p, pas } = jouer(id);
      const avant = pas.find((x) => x.t >= 15.3)!;
      const apres = pas.find((x) => x.t >= 18)!;
      expect(apres.e.rapport).toBeLessThan(avant.e.rapport);
      expect(apres.e.sens === -1 || apres.e.depuis > 0).toBe(true);
      for (const x of pas.filter((y) => y.t >= 15.3 && y.t < 18)) expect(x.e.rpm).toBeGreaterThanOrEqual(p.ralenti * 0.95 - 1e-6);
    });

    it(`${id} : jamais plus de trois changements par seconde (pas de pompage : 0,45 s entre deux)`, () => {
      const { pas } = jouer(id);
      for (let i = 0; i + 60 < pas.length; i += 60) {
        expect(pas[i + 60]!.e.changements - pas[i]!.e.changements).toBeLessThanOrEqual(3);
      }
    });
  }

  it("dans un rapport, le régime suit la vitesse (monotone, entre le bas et le haut du rapport)", () => {
    const p = profilDe("civile");
    let prec = 0;
    for (let v = 0; v <= ETAGEMENT[1]!; v += 0.5) {
      const r = regimeRoue(p, 2, v);
      expect(r).toBeGreaterThanOrEqual(prec);
      prec = r;
    }
    expect(regimeRoue(p, 2, ETAGEMENT[1]!)).toBeCloseTo(p.monte * p.rouge, 6);
    expect(regimeRoue(p, 2, -5)).toBe(0);
  });

  it("le régime normalisé reste dans [0, 1]", () => {
    const p = profilDe("muscle");
    expect(regimeNormal(p, p.ralenti)).toBe(0);
    expect(regimeNormal(p, p.rouge)).toBe(1);
    expect(regimeNormal(p, 0)).toBe(0);
    expect(regimeNormal(p, 99999)).toBe(1);
  });

  it("déterministe : le même scénario donne exactement les mêmes pas", () => {
    expect(jouer("fourgon").pas.map((x) => x.e.rpm)).toEqual(jouer("fourgon").pas.map((x) => x.e.rpm));
  });

  it("en l'air, le moteur s'emballe un peu", () => {
    const p = profilDe("civile");
    let sol: EtatBoite = { ...boiteInitiale(p), rapport: 5 };
    let air: EtatBoite = { ...boiteInitiale(p), rapport: 5 };
    for (let i = 0; i < 120; i++) {
      sol = pasBoite(sol, p, 40, 0.6, DT, false);
      air = pasBoite(air, p, 40, 0.6, DT, true);
    }
    expect(air.rpm).toBeGreaterThan(sol.rpm);
  });
});

describe("la voiture virtuelle", () => {
  const trames = Array.from({ length: Math.round(DUREE_SCENARIO * 60) }, (_, i) => voitureVirtuelle(i / 60));
  it("couvre toutes les situations à écouter : arrêt, gaz à fond, lever de pied, freinage, terre en dérive, turbo, vibreur, saut", () => {
    expect(trames.some((f) => f.speed === 0 && f.throttle > 0.9)).toBe(true);
    expect(trames.some((f) => f.speed > 50 && f.throttle === 1)).toBe(true);
    expect(trames.some((f) => f.speed > 50 && f.throttle === 0 && !f.brake)).toBe(true);
    expect(trames.some((f) => f.brake && f.slide > 0.2)).toBe(true);
    expect(trames.some((f) => f.surface === "dirt" && f.slide > 0.2)).toBe(true);
    expect(trames.some((f) => f.boost)).toBe(true);
    expect(trames.some((f) => f.kerb > 0)).toBe(true);
    expect(trames.some((f) => !f.grounded)).toBe(true);
  });
  it("la vitesse est continue (jamais plus de 3 m/s d'un pas à l'autre) et reste dans [0, 80]", () => {
    for (let i = 1; i < trames.length; i++) {
      expect(Math.abs(trames[i]!.speed - trames[i - 1]!.speed)).toBeLessThan(3);
      expect(trames[i]!.speed).toBeGreaterThanOrEqual(0);
      expect(trames[i]!.speed).toBeLessThanOrEqual(80);
    }
  });
  it("boucle : le temps est pris modulo la durée", () => {
    expect(voitureVirtuelle(5)).toEqual(voitureVirtuelle(5 + DUREE_SCENARIO));
    expect(voitureVirtuelle(-1)).toEqual(voitureVirtuelle(DUREE_SCENARIO - 1));
  });
  it("les moments sont dans l'ordre et dans la durée", () => {
    for (let i = 1; i < MOMENTS.length; i++) expect(MOMENTS[i]!.t).toBeGreaterThan(MOMENTS[i - 1]!.t);
    expect(MOMENTS[MOMENTS.length - 1]!.t).toBeLessThan(DUREE_SCENARIO);
  });
});

describe("les nœuds audio : aucun ne s'accumule", () => {
  /** Un faux nœud : le Compteur n'a besoin que de `disconnect`, `start`, `stop` et d'un évènement « ended ». */
  const faux = () => {
    const ecouteurs: (() => void)[] = [];
    return {
      disconnectes: 0,
      arretes: 0,
      disconnect() {
        this.disconnectes++;
      },
      start() {},
      stop() {
        this.arretes++;
      },
      addEventListener(_t: string, f: () => void) {
        ecouteurs.push(f);
      },
      finir() {
        for (const f of ecouteurs) f();
      },
    };
  };
  it("un nœud bref se détache seul à la fin de sa source et ne reste pas dans le compteur", () => {
    const c = new Compteur();
    const src = faux();
    const filtre = faux();
    c.bref(src as unknown as AudioScheduledSourceNode, filtre as unknown as AudioNode);
    expect(c.brefsVivants).toBe(2);
    expect(c.n).toBe(0);
    src.finir();
    expect(c.brefsVivants).toBe(0);
    expect(src.disconnectes).toBe(1);
    expect(filtre.disconnectes).toBe(1);
  });
  it("mille nœuds brefs finis ne laissent rien", () => {
    const c = new Compteur();
    for (let i = 0; i < 1000; i++) {
      const s = faux();
      c.bref(s as unknown as AudioScheduledSourceNode, faux() as unknown as AudioNode);
      s.finir();
    }
    expect(c.brefsVivants).toBe(0);
  });
  it("à l'arrêt, tout est détaché : les permanents, les sources arrêtées, les brefs encore en vol", () => {
    const c = new Compteur();
    const perm = faux();
    const src = faux();
    const vol = faux();
    c.nd(perm as unknown as AudioNode);
    c.nd(src as unknown as AudioNode);
    c.bref(vol as unknown as AudioScheduledSourceNode);
    c.tout();
    expect(perm.disconnectes).toBe(1);
    expect(src.arretes).toBe(1);
    expect(src.disconnectes).toBe(1);
    expect(vol.disconnectes).toBe(1);
    expect(c.brefsVivants).toBe(0);
    expect(c.tous).toHaveLength(0);
  });
});

describe("le lecteur d'échantillons", () => {
  const refs = [900, 2000, 3000, 4200, 5500, 6800];
  it("fond les deux boucles voisines à puissance égale, les autres à zéro", () => {
    for (let rpm = 600; rpm <= 7500; rpm += 111) {
      const w = poidsFondu(refs, rpm);
      expect(w.reduce((s, v) => s + v * v, 0)).toBeCloseTo(1, 6);
      expect(w.filter((v) => v > 0).length).toBeLessThanOrEqual(2);
    }
    expect(poidsFondu(refs, 100)[0]).toBe(1);
    expect(poidsFondu(refs, 99999)[5]).toBe(1);
    expect(poidsFondu(refs, 2000)[1]).toBeCloseTo(1, 6);
    expect(poidsFondu([], 3000)).toEqual([]);
  });
  it("la vitesse de lecture suit le régime, bornée", () => {
    expect(vitesseLecture(3000, 3000)).toBe(1);
    expect(vitesseLecture(3300, 3000)).toBeCloseTo(1.1, 6);
    expect(vitesseLecture(1, 3000)).toBe(0.4);
    expect(vitesseLecture(99999, 3000)).toBe(2.6);
  });
});

describe("le son ne lit que l'état de la voiture", () => {
  it("aucun module du nouveau son n'importe une valeur de la simulation, ni l'horloge, ni le hasard", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = new URL("../src/son/", import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      const src = readFileSync(new URL(f, dir), "utf8");
      for (const m of src.matchAll(/^import (?!type)[^;]*from "@cdj\/sim"/gm)) throw new Error(`${f} importe une valeur de la simulation : ${m[0]}`);
      expect(src, `${f} : pas de hasard non semé`).not.toMatch(/Math\.random/);
      expect(src, `${f} : pas d'horloge murale`).not.toMatch(/Date\.now|new Date\(/);
    }
  });
});
