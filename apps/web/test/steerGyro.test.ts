import { afterEach, describe, expect, it, vi } from "vitest";
import { GYRO_FILTER_MS, GYRO_FULL_LOCK_DEG, GyroSteerer, demanderCapteur, inPlaneRoll, meanAngle } from "../src/steerGyro";
import { DEFAULT_TOUCH_SETTINGS, TouchPad } from "../src/touch";

// Lot 52 : le gyroscope. Aucune donnée du capteur n'est gardée : tout vit en mémoire, le temps de la page.
const reglages = (patch: Partial<{ gyroSensitivity: number; gyroDeadzone: number }> = {}) => ({ gyroSensitivity: 1, gyroDeadzone: 0.05, ...patch });
/** Des mesures à 60 Hz pendant `ms` millisecondes, à l'angle `roll` (la première à `t0`). */
function stream(g: GyroSteerer, roll: number | null, ms: number, t0: number): number {
  let t = t0;
  for (; t < t0 + ms; t += 1000 / 60) g.feed(roll, t);
  return t;
}

describe("inPlaneRoll : l'inclinaison dans le plan de l'écran, comme un volant", () => {
  it("portrait, téléphone droit : 0 ; légèrement incliné vers la droite : un petit angle positif", () => {
    expect(inPlaneRoll(90, 0, 0)).toBeCloseTo(0, 9);
    expect(inPlaneRoll(80, 10, 0)!).toBeCloseTo(1.756, 2);
  });

  it("les deux paysages : même sens, « à droite » quand on penche vers la droite de l'écran (beta, gamma de DeviceOrientation)", () => {
    // Paysage, haut du téléphone à gauche (angle 90) : droit = (beta 0, gamma −90) ; tourné de θ vers la droite = (beta θ, gamma −90).
    expect(inPlaneRoll(0, -90, 90)).toBeCloseTo(0, 9);
    expect(inPlaneRoll(20, -90, 90)!).toBeCloseTo(20, 9);
    expect(inPlaneRoll(-20, -90, 90)!).toBeCloseTo(-20, 9);
    // Paysage, haut du téléphone à droite (angle 270) : droit = (beta 0, gamma 90) ; tourné de θ vers la droite = (beta −θ, gamma 90).
    expect(inPlaneRoll(0, 90, 270)).toBeCloseTo(0, 9);
    expect(inPlaneRoll(-20, 90, 270)!).toBeCloseTo(20, 9);
    expect(inPlaneRoll(20, 90, 270)!).toBeCloseTo(-20, 9);
  });

  it("retourner le téléphone d'un paysage à l'autre ne change pas le sens : la même pose réelle donne le même angle", () => {
    // La pose réelle : l'écran vu de face, tourné de 25° vers la droite. Dans l'autre paysage, le capteur donne les angles d'une pose retournée de 180° dans le plan.
    expect(inPlaneRoll(25, -90, 90)!).toBeCloseTo(inPlaneRoll(-25, 90, 270)!, 9);
  });

  it("presque à plat : pas d'angle (la direction reste à 0), sans diviser par zéro", () => {
    expect(inPlaneRoll(0, 0, 0)).toBeNull();
    expect(inPlaneRoll(10, 5, 90)).toBeNull();
    expect(inPlaneRoll(10, 5, 0)).toBeNull();
  });

  it("meanAngle : la moyenne ne se trompe pas autour de ±180°", () => {
    expect(meanAngle([10, 20, 30])).toBeCloseTo(20, 9);
    expect(Math.abs(meanAngle([179, -179]))).toBeCloseTo(180, 9);
    expect(meanAngle([])).toBe(0);
  });
});

describe("GyroSteerer", () => {
  it("la première mesure fait le neutre ; ensuite la direction suit l'écart, signée (vers la droite = positif)", () => {
    const g = new GyroSteerer(reglages());
    let t = stream(g, 10, 300, 1000);
    expect(g.steer()).toBe(0);
    t = stream(g, 10 + GYRO_FULL_LOCK_DEG, 600, t);
    expect(g.steer()).toBeCloseTo(1, 3); // plein braquage à GYRO_FULL_LOCK_DEG, sensibilité ×1
    stream(g, 10 - GYRO_FULL_LOCK_DEG, 600, t);
    expect(g.steer()).toBeCloseTo(-1, 3);
  });

  it("calibrage : le neutre est la moyenne de la dernière demi-seconde du décompte, pas la dernière mesure", () => {
    const g = new GyroSteerer(reglages());
    g.begin();
    expect(g.phase).toBe("calage");
    let t = stream(g, 0, 1500, 1000); // le joueur s'installe
    t = stream(g, 8, 500, t); // puis tient le téléphone à 8°
    g.go();
    expect(g.phase).toBe("pret");
    expect(g.neutral).toBeCloseTo(8, 0);
    stream(g, 8, 300, t);
    expect(Math.abs(g.steer())).toBe(0); // 8° est maintenant le « tout droit »
  });

  it("recentrer reprend le neutre à la pose actuelle", () => {
    const g = new GyroSteerer(reglages());
    let t = stream(g, 0, 600, 1000);
    t = stream(g, 20, 700, t);
    expect(g.steer()).toBeGreaterThan(0.3);
    g.calibrate();
    stream(g, 20, 100, t);
    expect(g.steer()).toBe(0);
    expect(g.neutral).toBeCloseTo(20, 0);
  });

  it("zone morte : rien tant que l'écart reste dans la zone, puis linéaire", () => {
    const g = new GyroSteerer(reglages({ gyroDeadzone: 0.1 }));
    let t = stream(g, 0, 600, 1000);
    t = stream(g, GYRO_FULL_LOCK_DEG * 0.08, 600, t);
    expect(g.steer()).toBe(0);
    t = stream(g, GYRO_FULL_LOCK_DEG * 0.5, 600, t);
    expect(g.steer()).toBeGreaterThan(0.4);
    expect(g.steer()).toBeLessThan(0.5);
    expect(Object.is(g.steer(), 0)).toBe(false);
    const zero = new GyroSteerer(reglages());
    stream(zero, 3, 600, 1000);
    expect(Object.is(zero.steer(), 0)).toBe(true); // jamais −0
  });

  it("sensibilité : ×2 braque à fond deux fois plus tôt, ×0,5 deux fois plus tard", () => {
    const at = (gyroSensitivity: number, deg: number) => {
      const g = new GyroSteerer(reglages({ gyroSensitivity, gyroDeadzone: 0 }));
      const t = stream(g, 0, 600, 1000);
      stream(g, deg, 800, t);
      return g.steer();
    };
    expect(at(2, GYRO_FULL_LOCK_DEG / 2)).toBeCloseTo(1, 3);
    expect(at(1, GYRO_FULL_LOCK_DEG / 2)).toBeCloseTo(0.5, 3);
    expect(at(0.5, GYRO_FULL_LOCK_DEG / 2)).toBeCloseTo(0.25, 3);
    expect(new GyroSteerer(reglages({ gyroSensitivity: 2 })).fullLock()).toBeCloseTo(17.5, 9);
  });

  it("filtrage : un tremblement est atténué, un vrai mouvement passe sans retard perceptible", () => {
    // Tremblement : ±2° à 60 Hz autour de 0.
    const g = new GyroSteerer(reglages({ gyroDeadzone: 0 }));
    let t = 1000;
    for (let i = 0; i < 120; i++, t += 1000 / 60) g.feed(0, t);
    g.calibrate(); // le neutre : la pose tenue
    let pire = 0;
    for (let i = 0; i < 120; i++, t += 1000 / 60) {
      g.feed(i % 2 ? 2 : -2, t);
      pire = Math.max(pire, Math.abs(g.tilt()));
    }
    expect(pire).toBeLessThan(1.2); // ±2° en entrée, ≈ ±0,55° en sortie
    // Vrai mouvement : un échelon de 20° ; 63 % de l'échelon à la constante de temps, > 95 % après trois.
    const h = new GyroSteerer(reglages({ gyroDeadzone: 0 }));
    h.feed(0, 1000);
    h.calibrate();
    let u = 1000;
    let atTau = 0;
    for (let ms = 0; ms <= 4 * GYRO_FILTER_MS; ms += 1) {
      u += 1;
      h.feed(20, u);
      if (ms === GYRO_FILTER_MS) atTau = h.tilt();
    }
    expect(atTau / 20).toBeGreaterThan(0.55);
    expect(atTau / 20).toBeLessThan(0.7);
    expect(h.tilt() / 20).toBeGreaterThan(0.95);
  });

  it("à plat, ou avant la moindre mesure : la direction reste à 0", () => {
    const g = new GyroSteerer(reglages());
    expect(g.steer()).toBe(0);
    let t = stream(g, 0, 600, 1000);
    t = stream(g, 30, 600, t);
    expect(g.steer()).toBeGreaterThan(0.5);
    stream(g, null, 100, t); // à plat
    expect(g.steer()).toBe(0);
  });

  it("l'écart se mesure autour de ±180° : de 175° à −175° est un petit pas", () => {
    const g = new GyroSteerer(reglages({ gyroDeadzone: 0 }));
    let t = stream(g, 175, 600, 1000);
    g.calibrate();
    stream(g, -175, 800, t);
    expect(g.tilt()).toBeCloseTo(10, 0);
  });

  it("branché sur le pad : la direction du gyroscope s'ajoute aux commandes, les pédales restent aux pouces", () => {
    const p = new TouchPad({ ...DEFAULT_TOUCH_SETTINGS, steerMode: "gyro" });
    p.setGeometry(844, 390);
    const g = new GyroSteerer(p.settings);
    p.steerer = g;
    let t = stream(g, 0, 600, 1000);
    stream(g, 20, 800, t);
    const gas = p.rect("gas")!;
    p.down(1, gas.x + 10, gas.y + 10);
    const brake = p.rect("brake")!;
    p.down(2, brake.x + 10, brake.y + 10);
    expect(p.axes().steer).toBeGreaterThan(0.4);
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 1 });
    p.begin();
    expect(g.phase).toBe("calage");
    p.go();
    expect(g.phase).toBe("pret");
  });
});

describe("autorisation et capteur", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  /** Un navigateur de pacotille : un `window` qui reçoit des évènements, et `DeviceOrientationEvent` avec ou sans demande d'autorisation. */
  function navigateur(opts: { permission?: "granted" | "denied" | "throws" | null; mesure?: boolean | "nulle" }) {
    const ecouteurs = new Set<(e: unknown) => void>();
    const win = { addEventListener: (_: string, f: (e: unknown) => void) => ecouteurs.add(f), removeEventListener: (_: string, f: (e: unknown) => void) => ecouteurs.delete(f) };
    vi.stubGlobal("window", win);
    const D: { requestPermission?: () => Promise<string> } = {};
    if (opts.permission) D.requestPermission = () => (opts.permission === "throws" ? Promise.reject(new Error("pas un geste")) : Promise.resolve(opts.permission!));
    vi.stubGlobal("DeviceOrientationEvent", D);
    (win as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent = D;
    return { emettre: (beta: number | null, gamma: number | null) => ecouteurs.forEach((f) => f({ beta, gamma })), ecouteurs };
  }

  it("pas de DeviceOrientationEvent : capteur absent", async () => {
    vi.stubGlobal("window", { addEventListener: () => undefined, removeEventListener: () => undefined });
    expect(await demanderCapteur()).toBe("absent");
  });

  it("iPhone : l'autorisation refusée (ou levée hors d'un geste) = refusé", async () => {
    navigateur({ permission: "denied" });
    expect(await demanderCapteur()).toBe("refuse");
    navigateur({ permission: "throws" });
    expect(await demanderCapteur()).toBe("refuse");
  });

  it("iPhone, hors d'un geste : la demande est rejetée sans rien afficher : on rend « geste » (attendre le premier toucher), pas « refusé »", async () => {
    navigateur({ permission: "throws" });
    expect(await demanderCapteur(false)).toBe("geste");
    navigateur({ permission: "denied" });
    expect(await demanderCapteur(false)).toBe("refuse"); // refusé pour de vrai : même hors d'un geste
  });

  it("accordée, puis une mesure dans la seconde : prêt ; on n'attend pas la réponse du joueur pour compter la seconde", async () => {
    vi.useFakeTimers();
    const nav = navigateur({ permission: "granted" });
    const r = demanderCapteur();
    await vi.advanceTimersByTimeAsync(0);
    nav.emettre(null, null); // une mesure vide (ordinateur) ne compte pas
    nav.emettre(80, 5);
    expect(await r).toBe("ok");
    expect(nav.ecouteurs.size).toBe(0); // l'écoute est retirée
  });

  it("Android (aucune demande) : une mesure dans la seconde = prêt ; le silence = absent", async () => {
    vi.useFakeTimers();
    const a = navigateur({ permission: null });
    const ok = demanderCapteur();
    a.emettre(70, 3);
    expect(await ok).toBe("ok");
    const b = navigateur({ permission: null });
    const muet = demanderCapteur();
    b.emettre(null, null);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await muet).toBe("absent");
    expect(b.ecouteurs.size).toBe(0);
  });
});
